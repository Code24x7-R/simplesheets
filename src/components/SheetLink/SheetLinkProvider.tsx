// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * SheetLink Provider
 *
 * React component mounted in SimpleSheets that listens for cross-tab
 * data requests and responds with live spreadsheet data.
 *
 * Features:
 * - Trust prompt: first request from a new consumer tab shows an "Allow" dialog
 * - Auto-push: subscribed ranges update automatically when the workbook changes
 * - Range picker: visual range selection modal for consumer apps
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { Workbook } from '../../types';
import { cellKey } from '../../types';
import type { Cell } from '../../types';
import { findDataRange } from '../../utils/chartData';
import { parseFormula, extractCellRefs } from '../../utils/formulaParser';
import { refToRowCol } from '../../types';
import { parseRangeWithSheet } from '../../utils/chartData';
import type {
  SheetLinkMessage,
  CellData,
  SheetLinkErrorPayload,
  SheetLinkRequestArgs,
} from '../../../packages/sheetlink/src/sheetLinkProtocol';
import { SHEETLINK_PROTOCOL_VERSION } from '../../../packages/sheetlink/src/sheetLinkProtocol';
import type { SheetLinkTransport } from '../../../packages/sheetlink/src/sheetLinkTransport';
import { BroadcastChannelTransport } from '../../../packages/sheetlink/src/sheetLinkTransport';
import { SheetLinkTrustPrompt } from './SheetLinkTrustPrompt';
import { SheetLinkRangePicker } from './SheetLinkRangePicker';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SheetLinkProviderProps {
  /** The current workbook state from HistoryContext. */
  workbook: Workbook;
  /** BroadcastChannel name. Override for testing. */
  channelName?: string;
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface Subscription {
  id: string;
  sheetName: string;
  range: string;
  lastHash: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SheetLinkProvider({ workbook, channelName = 'simplesheets-link' }: SheetLinkProviderProps) {
  const transportRef = useRef<SheetLinkTransport | null>(null);
  const workbookRef = useRef<Workbook>(workbook);
  const authorizedTabsRef = useRef<Set<string>>(new Set());
  const pendingAuthRef = useRef<Map<string, { resolve: () => void; reject: (code: string) => void }>>(new Map());
  const subscriptionsRef = useRef<Map<string, Subscription>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State for the trust prompt
  const [trustPrompt, setTrustPrompt] = useState<{
    tabId: string;
    operation: string;
    target: string;
  } | null>(null);

  // State for the range picker
  const [rangePicker, setRangePicker] = useState<{
    isOpen: boolean;
    prompt?: string;
    corrId: string;
  }>({ isOpen: false, corrId: '' });

  // Keep workbook ref fresh
  useEffect(() => {
    workbookRef.current = workbook;
  }, [workbook]);

  // ─── Authorization ─────────────────────────────────────────────────────

  const handleTrustAllow = useCallback(() => {
    if (!trustPrompt) return;
    const pending = pendingAuthRef.current.get(trustPrompt.tabId);
    if (pending) {
      authorizedTabsRef.current.add(trustPrompt.tabId);
      pendingAuthRef.current.delete(trustPrompt.tabId);
      pending.resolve();
    }
    setTrustPrompt(null);
  }, [trustPrompt]);

  const handleTrustDeny = useCallback(() => {
    if (!trustPrompt) return;
    const pending = pendingAuthRef.current.get(trustPrompt.tabId);
    if (pending) {
      pendingAuthRef.current.delete(trustPrompt.tabId);
      pending.reject('NOT_AUTHORIZED');
    }
    setTrustPrompt(null);
  }, [trustPrompt]);

  // ─── Subscription Updates (Auto-Push) ─────────────────────────────────

  const computeRangeHash = useCallback((data: CellData[][]): string => {
    return JSON.stringify(data);
  }, []);

  const pushSubscriptionUpdates = useCallback(() => {
    const transport = transportRef.current;
    if (!transport) return;

    const wb = workbookRef.current;
    for (const [subId, sub] of subscriptionsRef.current) {
      const sheet = wb.sheets.find(s => s.name === sub.sheetName);
      if (!sheet) continue;

      const rangeData = extractRangeData(sheet, sub.range);
      const newHash = computeRangeHash(rangeData);

      if (newHash !== sub.lastHash) {
        sub.lastHash = newHash;
        transport.send({
          type: 'SSL_UPDATE',
          subscriptionId: subId,
          data: rangeData,
        } as SheetLinkMessage);
      }
    }
  }, [computeRangeHash]);

  // Debounced auto-push on workbook change
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      pushSubscriptionUpdates();
    }, 50);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [workbook, pushSubscriptionUpdates]);

  // ─── Range Picker ──────────────────────────────────────────────────────

  const handleRangePickerConfirm = useCallback((range: string) => {
    const transport = transportRef.current;
    if (transport && rangePicker.corrId) {
      transport.send({
        type: 'SSL_PICK_RANGE_RESULT',
        corrId: rangePicker.corrId,
        range,
      } as SheetLinkMessage);
    }
    setRangePicker({ isOpen: false, corrId: '' });
  }, [rangePicker.corrId]);

  const handleRangePickerCancel = useCallback(() => {
    const transport = transportRef.current;
    if (transport && rangePicker.corrId) {
      transport.send({
        type: 'SSL_PICK_RANGE_CANCEL',
        corrId: rangePicker.corrId,
      } as SheetLinkMessage);
    }
    setRangePicker({ isOpen: false, corrId: '' });
  }, [rangePicker.corrId]);

  // ─── Operation Execution (defined before handleMessage) ───────────────

  const executeOperation = useCallback(async (operation: string, args: SheetLinkRequestArgs): Promise<unknown> => {
    const wb = workbookRef.current;

    switch (operation) {
      case 'listSheets': {
        return wb.sheets.map(s => s.name);
      }

      case 'getUsedRange': {
        if (!('sheetName' in args)) {
          throw { code: 'INVALID_REF', message: 'Missing sheetName', recoverable: true };
        }
        const sheet = wb.sheets.find(s => s.name === args.sheetName);
        if (!sheet) throw { code: 'SHEET_NOT_FOUND', message: `Sheet "${args.sheetName}" not found`, recoverable: true };
        return findDataRange(sheet);
      }

      case 'getCellValue': {
        if (!('ref' in args)) {
          throw { code: 'INVALID_REF', message: 'Missing ref', recoverable: true };
        }
        const sheet = wb.sheets.find(s => s.name === args.sheetName);
        if (!sheet) throw { code: 'SHEET_NOT_FOUND', message: `Sheet "${args.sheetName}" not found`, recoverable: true };
        const [row, col] = refToRowCol(args.ref);
        return cellToCellData(sheet.cells[cellKey(row, col)]);
      }

      case 'getFormula': {
        if (!('ref' in args)) {
          throw { code: 'INVALID_REF', message: 'Missing ref', recoverable: true };
        }
        const sheet = wb.sheets.find(s => s.name === args.sheetName);
        if (!sheet) throw { code: 'SHEET_NOT_FOUND', message: `Sheet "${args.sheetName}" not found`, recoverable: true };
        const [row, col] = refToRowCol(args.ref);
        const cell = sheet.cells[cellKey(row, col)];
        if (!cell) return null;
        return cell.rawValue.startsWith('=') ? cell.rawValue : null;
      }

      case 'getRangeValues': {
        if (!('range' in args)) {
          throw { code: 'INVALID_RANGE', message: 'Missing range', recoverable: true };
        }
        const sheet = wb.sheets.find(s => s.name === args.sheetName);
        if (!sheet) throw { code: 'SHEET_NOT_FOUND', message: `Sheet "${args.sheetName}" not found`, recoverable: true };
        return extractRangeData(sheet, args.range);
      }

      case 'getFormulas': {
        if (!('range' in args)) {
          throw { code: 'INVALID_RANGE', message: 'Missing range', recoverable: true };
        }
        const sheet = wb.sheets.find(s => s.name === args.sheetName);
        if (!sheet) throw { code: 'SHEET_NOT_FOUND', message: `Sheet "${args.sheetName}" not found`, recoverable: true };
        const { startRow, endRow, startCol, endCol } = parseRangeWithSheet(args.range);
        const result: (string | null)[][] = [];
        for (let r = startRow; r <= endRow; r++) {
          const row: (string | null)[] = [];
          for (let c = startCol; c <= endCol; c++) {
            const cell = sheet.cells[cellKey(r, c)];
            row.push(cell?.rawValue.startsWith('=') ? cell.rawValue : null);
          }
          result.push(row);
        }
        return result;
      }

      case 'getDependencies': {
        if (!('ref' in args)) {
          throw { code: 'INVALID_REF', message: 'Missing ref', recoverable: true };
        }
        const sheet = wb.sheets.find(s => s.name === args.sheetName);
        if (!sheet) throw { code: 'SHEET_NOT_FOUND', message: `Sheet "${args.sheetName}" not found`, recoverable: true };
        const [row, col] = refToRowCol(args.ref);
        const cell = sheet.cells[cellKey(row, col)];
        if (!cell?.rawValue.startsWith('=')) return [];
        const ast = parseFormula(cell.rawValue.slice(1));
        return extractCellRefs(ast);
      }

      default:
        throw { code: 'INVALID_RANGE', message: `Unknown operation: ${operation}`, recoverable: true };
    }
  }, []);

  // ─── Message Handling (uses executeOperation) ─────────────────────────

  const handleMessage = useCallback(async (message: SheetLinkMessage) => {
    const transport = transportRef.current;
    if (!transport) return;

    switch (message.type) {
      case 'SSL_HELLO': {
        transport.send({
          type: 'SSL_WELCOME',
          protocolVersion: SHEETLINK_PROTOCOL_VERSION,
          tabId: 'provider',
        } as SheetLinkMessage);
        break;
      }

      case 'SSL_REQUEST': {
        try {
          const result = await executeOperation(message.operation, message.args);
          transport.send({
            type: 'SSL_RESPONSE',
            corrId: message.corrId,
            ok: true,
            result,
          } as SheetLinkMessage);
        } catch (err) {
          const errorPayload: SheetLinkErrorPayload = {
            code: (err as SheetLinkErrorPayload).code || 'NO_PROVIDER',
            message: (err as SheetLinkErrorPayload).message || 'Unknown error',
            recoverable: (err as SheetLinkErrorPayload).recoverable !== false,
          };
          transport.send({
            type: 'SSL_RESPONSE',
            corrId: message.corrId,
            ok: false,
            error: errorPayload,
          } as SheetLinkMessage);
        }
        break;
      }

      case 'SSL_SUBSCRIBE': {
        const { subscriptionId: subId, sheetName, range } = message;
        const sheet = workbookRef.current.sheets.find(s => s.name === sheetName);
        if (sheet) {
          const data = extractRangeData(sheet, range);
          subscriptionsRef.current.set(subId, {
            id: subId,
            sheetName,
            range,
            lastHash: computeRangeHash(data),
          });
          // Send initial data immediately
          transport.send({
            type: 'SSL_UPDATE',
            subscriptionId: subId,
            data,
          } as SheetLinkMessage);
        }
        break;
      }

      case 'SSL_UNSUBSCRIBE': {
        subscriptionsRef.current.delete(message.subscriptionId);
        break;
      }

      case 'SSL_PICK_RANGE_REQUEST': {
        setRangePicker({ isOpen: true, prompt: message.prompt, corrId: message.corrId });
        break;
      }

      default:
        break;
    }
  }, [computeRangeHash, executeOperation]);

  // ─── Setup & Cleanup ───────────────────────────────────────────────────

  useEffect(() => {
    const transport = new BroadcastChannelTransport(channelName);
    transportRef.current = transport;

    const unsub = transport.onMessage(handleMessage);

    return () => {
      unsub();
      transport.close();
      transportRef.current = null;
      // Refs are intentionally cleared on unmount — these are stable references
      /* eslint-disable react-hooks/exhaustive-deps */
      subscriptionsRef.current.clear();
      authorizedTabsRef.current.clear();
      /* eslint-enable react-hooks/exhaustive-deps */
    };
  }, [handleMessage, channelName]);

  return (
    <>
      {trustPrompt && (
        <SheetLinkTrustPrompt
          isOpen={true}
          consumerTabId={trustPrompt.tabId}
          consumerOrigin={window.location.hostname}
          requestedOperation={trustPrompt.operation}
          requestedTarget={trustPrompt.target}
          onAllow={handleTrustAllow}
          onDeny={handleTrustDeny}
        />
      )}
      <SheetLinkRangePicker
        isOpen={rangePicker.isOpen}
        prompt={rangePicker.prompt}
        workbook={workbook}
        onConfirm={handleRangePickerConfirm}
        onCancel={handleRangePickerCancel}
      />
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cellToCellData(cell: Cell | undefined): CellData {
  if (!cell) {
    return { rawValue: '', computedValue: null, isFormula: false };
  }
  return {
    rawValue: cell.rawValue,
    computedValue: cell.computedValue ?? null,
    isFormula: cell.rawValue.startsWith('='),
  };
}

function extractRangeData(sheet: import('../../types').Sheet, range: string): CellData[][] {
  const { startRow, endRow, startCol, endCol } = parseRangeWithSheet(range);
  const result: CellData[][] = [];
  for (let r = startRow; r <= endRow; r++) {
    const row: CellData[] = [];
    for (let c = startCol; c <= endCol; c++) {
      row.push(cellToCellData(sheet.cells[cellKey(r, c)]));
    }
    result.push(row);
  }
  return result;
}
