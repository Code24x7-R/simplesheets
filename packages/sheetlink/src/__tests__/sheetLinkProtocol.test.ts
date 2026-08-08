// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Unit tests for SheetLink protocol types and version.
 */

import { SHEETLINK_PROTOCOL_VERSION } from '../sheetLinkProtocol';
import type {
  CellData,
  CellRef,
  SheetLinkMessage,
  SheetLinkHelloMessage,
  SheetLinkWelcomeMessage,
  SheetLinkRequestMessage,
  SheetLinkSuccessResponseMessage,
  SheetLinkSubscribeMessage,
  SheetLinkUpdateMessage,
  SheetLinkPickRangeRequestMessage,
  SheetLinkPickRangeResultMessage,
  SheetLinkPickRangeCancelMessage,
} from '../sheetLinkProtocol';

describe('sheetLinkProtocol', () => {
  describe('SHEETLINK_PROTOCOL_VERSION', () => {
    it('is a positive integer', () => {
      expect(SHEETLINK_PROTOCOL_VERSION).toBeGreaterThan(0);
      expect(Number.isInteger(SHEETLINK_PROTOCOL_VERSION)).toBe(true);
    });

    it('is version 1', () => {
      expect(SHEETLINK_PROTOCOL_VERSION).toBe(1);
    });
  });

  describe('CellData type', () => {
    it('accepts valid cell data objects', () => {
      const cell: CellData = {
        rawValue: '=SUM(A1:A3)',
        computedValue: 42,
        isFormula: true,
      };
      expect(cell.rawValue).toBe('=SUM(A1:A3)');
      expect(cell.computedValue).toBe(42);
      expect(cell.isFormula).toBe(true);
    });

    it('accepts null computed value', () => {
      const cell: CellData = {
        rawValue: '',
        computedValue: null,
        isFormula: false,
      };
      expect(cell.computedValue).toBeNull();
    });
  });

  describe('CellRef type', () => {
    it('accepts a basic cell reference', () => {
      const ref: CellRef = { row: 0, col: 0, absoluteCol: false, absoluteRow: false };
      expect(ref.row).toBe(0);
      expect(ref.col).toBe(0);
    });

    it('accepts a cross-sheet cell reference', () => {
      const ref: CellRef = { row: 5, col: 2, absoluteCol: true, absoluteRow: true, sheetName: 'Sheet2' };
      expect(ref.sheetName).toBe('Sheet2');
      expect(ref.absoluteCol).toBe(true);
    });
  });

  describe('message types', () => {
    it('HELLO message has correct shape', () => {
      const msg: SheetLinkHelloMessage = {
        type: 'SSL_HELLO',
        protocolVersion: 1,
        tabId: 'tab-abc',
      };
      expect(msg.type).toBe('SSL_HELLO');
    });

    it('WELCOME message has correct shape', () => {
      const msg: SheetLinkWelcomeMessage = {
        type: 'SSL_WELCOME',
        protocolVersion: 1,
        tabId: 'provider-1',
      };
      expect(msg.type).toBe('SSL_WELCOME');
    });

    it('REQUEST message has correct shape', () => {
      const msg: SheetLinkRequestMessage = {
        type: 'SSL_REQUEST',
        corrId: 'corr-1',
        operation: 'getCellValue',
        args: { sheetName: 'Sheet1', ref: 'A1' },
      };
      expect(msg.type).toBe('SSL_REQUEST');
      expect(msg.operation).toBe('getCellValue');
    });

    it('SUCCESS RESPONSE message has correct shape', () => {
      const msg: SheetLinkSuccessResponseMessage = {
        type: 'SSL_RESPONSE',
        corrId: 'corr-1',
        ok: true,
        result: { rawValue: '42', computedValue: 42, isFormula: false },
      };
      expect(msg.ok).toBe(true);
    });

    it('SUBSCRIBE message has correct shape', () => {
      const msg: SheetLinkSubscribeMessage = {
        type: 'SSL_SUBSCRIBE',
        subscriptionId: 'sub-1',
        sheetName: 'Sheet1',
        range: 'A1:B2',
      };
      expect(msg.subscriptionId).toBe('sub-1');
    });

    it('UPDATE message has correct shape', () => {
      const msg: SheetLinkUpdateMessage = {
        type: 'SSL_UPDATE',
        subscriptionId: 'sub-1',
        data: [[{ rawValue: '42', computedValue: 42, isFormula: false }]],
      };
      expect(msg.data).toHaveLength(1);
    });

    it('PICK_RANGE_REQUEST message has correct shape', () => {
      const msg: SheetLinkPickRangeRequestMessage = {
        type: 'SSL_PICK_RANGE_REQUEST',
        corrId: 'corr-1',
        prompt: 'Select data',
      };
      expect(msg.prompt).toBe('Select data');
    });

    it('PICK_RANGE_RESULT message has correct shape', () => {
      const msg: SheetLinkPickRangeResultMessage = {
        type: 'SSL_PICK_RANGE_RESULT',
        corrId: 'corr-1',
        range: 'Sheet1!A1:D10',
      };
      expect(msg.range).toBe('Sheet1!A1:D10');
    });

    it('PICK_RANGE_CANCEL message has correct shape', () => {
      const msg: SheetLinkPickRangeCancelMessage = {
        type: 'SSL_PICK_RANGE_CANCEL',
        corrId: 'corr-1',
      };
      expect(msg.type).toBe('SSL_PICK_RANGE_CANCEL');
    });
  });

  describe('SheetLinkMessage union', () => {
    it('accepts all message variants', () => {
      const messages: SheetLinkMessage[] = [
        { type: 'SSL_HELLO', protocolVersion: 1, tabId: 'a' },
        { type: 'SSL_WELCOME', protocolVersion: 1, tabId: 'b' },
        { type: 'SSL_REQUEST', corrId: 'c', operation: 'listSheets', args: {} },
        { type: 'SSL_RESPONSE', corrId: 'c', ok: true, result: [] },
        { type: 'SSL_SUBSCRIBE', subscriptionId: 's1', sheetName: 'S1', range: 'A1' },
        { type: 'SSL_UNSUBSCRIBE', subscriptionId: 's1' },
        { type: 'SSL_UPDATE', subscriptionId: 's1', data: [] },
        { type: 'SSL_PICK_RANGE_REQUEST', corrId: 'c' },
        { type: 'SSL_PICK_RANGE_RESULT', corrId: 'c', range: 'A1' },
        { type: 'SSL_PICK_RANGE_CANCEL', corrId: 'c' },
      ];
      expect(messages).toHaveLength(10);
    });
  });
});
