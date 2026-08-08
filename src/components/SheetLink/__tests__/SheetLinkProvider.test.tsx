// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Unit tests for SheetLinkProvider.
 *
 * Tests the cross-tab data bridge provider component that responds
 * to requests from consumer tabs via BroadcastChannel.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { SheetLinkProvider } from '../SheetLinkProvider';
import type { Workbook } from '../../../types';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function createTestWorkbook(): Workbook {
  return {
    id: 'test-wb',
    title: 'Test Workbook',
    sheets: [
      {
        id: 's1',
        name: 'Sheet1',
        cells: {
          '0:0': { rawValue: 'Hello', computedValue: 'Hello' },
          '0:1': { rawValue: '=SUM(1,2)', computedValue: 3 },
          '1:0': { rawValue: '42', computedValue: 42 },
        },
        defaultColWidth: 100,
        defaultRowHeight: 28,
        columnWidths: {},
        rowHeights: {},
        columnCount: 26,
        rowCount: 100,
        frozenColumns: 0,
        frozenRows: 0,
      },
      {
        id: 's2',
        name: 'Data',
        cells: {
          '0:0': { rawValue: 'Item', computedValue: 'Item' },
        },
        defaultColWidth: 100,
        defaultRowHeight: 28,
        columnWidths: {},
        rowHeights: {},
        columnCount: 26,
        rowCount: 100,
        frozenColumns: 0,
        frozenRows: 0,
      },
    ],
    activeSheetIndex: 0,
    lastModified: Date.now(),
  };
}

/** Helper to create a typed response promise from a BroadcastChannel */
function waitForMessage<T extends { type: string }>(
  channel: BroadcastChannel,
  predicate: (data: T) => boolean,
): Promise<T> {
  return new Promise<T>((resolve) => {
    const handler = (event: MessageEvent) => {
      const data = event.data as T;
      if (predicate(data)) {
        channel.removeEventListener('message', handler);
        resolve(data);
      }
    };
    channel.addEventListener('message', handler);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SheetLinkProvider', () => {
  it('renders without crashing', () => {
    const workbook = createTestWorkbook();
    expect(() => {
      render(<SheetLinkProvider workbook={workbook} />);
    }).not.toThrow();
  });

  it('renders no modals by default', () => {
    const workbook = createTestWorkbook();
    render(<SheetLinkProvider workbook={workbook} />);
    // No trust prompt or range picker visible initially
    expect(screen.queryByText('Data Access Request')).not.toBeInTheDocument();
    expect(screen.queryByText('Select Range')).not.toBeInTheDocument();
  });
});

describe('SheetLinkProvider integration (simulated consumer)', () => {
  // Use a unique channel name per test to avoid cross-test interference
  const TEST_CHANNEL = 'test-sheetlink-integration';

  it('responds to HELLO with WELCOME', async () => {
    const workbook = createTestWorkbook();
    const { unmount } = render(
      <SheetLinkProvider workbook={workbook} channelName={TEST_CHANNEL} />,
    );

    const requestChannel = new BroadcastChannel(TEST_CHANNEL);
    const welcomePromise = waitForMessage<{ type: string; protocolVersion: number }>(
      requestChannel,
      (data) => data.type === 'SSL_WELCOME',
    );

    requestChannel.postMessage({
      type: 'SSL_HELLO',
      protocolVersion: 1,
      tabId: 'test-consumer',
    });

    const welcome = await waitFor(() => welcomePromise, { timeout: 500 });

    expect(welcome.type).toBe('SSL_WELCOME');
    expect(welcome.protocolVersion).toBe(1);

    requestChannel.close();
    unmount();
  });

  it('handles listSheets request', async () => {
    const workbook = createTestWorkbook();
    const { unmount } = render(
      <SheetLinkProvider workbook={workbook} channelName={TEST_CHANNEL} />,
    );

    const requestChannel = new BroadcastChannel(TEST_CHANNEL);
    const responsePromise = waitForMessage<{
      type: string;
      corrId: string;
      ok: boolean;
      result: unknown;
    }>(
      requestChannel,
      (data) => data.type === 'SSL_RESPONSE' && data.corrId === 'test-corr-1',
    );

    requestChannel.postMessage({
      type: 'SSL_REQUEST',
      corrId: 'test-corr-1',
      operation: 'listSheets',
      args: {},
    });

    const response = await waitFor(() => responsePromise, { timeout: 500 });

    expect(response.ok).toBe(true);
    expect(response.result).toEqual(['Sheet1', 'Data']);

    requestChannel.close();
    unmount();
  });

  it('handles getUsedRange request', async () => {
    const workbook = createTestWorkbook();
    const { unmount } = render(
      <SheetLinkProvider workbook={workbook} channelName={TEST_CHANNEL} />,
    );

    const requestChannel = new BroadcastChannel(TEST_CHANNEL);
    const responsePromise = waitForMessage<{
      type: string;
      corrId: string;
      ok: boolean;
      result: unknown;
    }>(
      requestChannel,
      (data) => data.type === 'SSL_RESPONSE' && data.corrId === 'test-corr-2',
    );

    requestChannel.postMessage({
      type: 'SSL_REQUEST',
      corrId: 'test-corr-2',
      operation: 'getUsedRange',
      args: { sheetName: 'Sheet1' },
    });

    const response = await waitFor(() => responsePromise, { timeout: 500 });

    expect(response.ok).toBe(true);
    expect(response.result).toBe('A1:B2');

    requestChannel.close();
    unmount();
  });

  it('returns error for non-existent sheet', async () => {
    const workbook = createTestWorkbook();
    const { unmount } = render(
      <SheetLinkProvider workbook={workbook} channelName={TEST_CHANNEL} />,
    );

    const requestChannel = new BroadcastChannel(TEST_CHANNEL);
    const responsePromise = waitForMessage<{
      type: string;
      corrId: string;
      ok: boolean;
      error: { code: string };
    }>(
      requestChannel,
      (data) => data.type === 'SSL_RESPONSE' && data.corrId === 'test-corr-3',
    );

    requestChannel.postMessage({
      type: 'SSL_REQUEST',
      corrId: 'test-corr-3',
      operation: 'getCellValue',
      args: { sheetName: 'Missing', ref: 'A1' },
    });

    const response = await waitFor(() => responsePromise, { timeout: 500 });

    expect(response.ok).toBe(false);
    expect(response.error.code).toBe('SHEET_NOT_FOUND');

    requestChannel.close();
    unmount();
  });

  it('handles getCellValue request', async () => {
    const workbook = createTestWorkbook();
    const { unmount } = render(
      <SheetLinkProvider workbook={workbook} channelName={TEST_CHANNEL} />,
    );

    const requestChannel = new BroadcastChannel(TEST_CHANNEL);
    const responsePromise = waitForMessage<{
      type: string;
      corrId: string;
      ok: boolean;
      result: { rawValue: string; computedValue: number | string | boolean | null; isFormula: boolean };
    }>(
      requestChannel,
      (data) => data.type === 'SSL_RESPONSE' && data.corrId === 'test-corr-4',
    );

    requestChannel.postMessage({
      type: 'SSL_REQUEST',
      corrId: 'test-corr-4',
      operation: 'getCellValue',
      args: { sheetName: 'Sheet1', ref: 'B1' },
    });

    const response = await waitFor(() => responsePromise, { timeout: 500 });

    expect(response.ok).toBe(true);
    expect(response.result.rawValue).toBe('=SUM(1,2)');
    expect(response.result.computedValue).toBe(3);
    expect(response.result.isFormula).toBe(true);

    requestChannel.close();
    unmount();
  });

  it('handles getFormula request', async () => {
    const workbook = createTestWorkbook();
    const { unmount } = render(
      <SheetLinkProvider workbook={workbook} channelName={TEST_CHANNEL} />,
    );

    const requestChannel = new BroadcastChannel(TEST_CHANNEL);
    const responsePromise = waitForMessage<{
      type: string;
      corrId: string;
      ok: boolean;
      result: string | null;
    }>(
      requestChannel,
      (data) => data.type === 'SSL_RESPONSE' && data.corrId === 'test-corr-5',
    );

    requestChannel.postMessage({
      type: 'SSL_REQUEST',
      corrId: 'test-corr-5',
      operation: 'getFormula',
      args: { sheetName: 'Sheet1', ref: 'B1' },
    });

    const response = await waitFor(() => responsePromise, { timeout: 500 });

    expect(response.ok).toBe(true);
    expect(response.result).toBe('=SUM(1,2)');

    requestChannel.close();
    unmount();
  });
});
