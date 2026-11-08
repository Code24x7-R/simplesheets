// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { renderHook, waitFor } from '@testing-library/react';
import type { Workbook } from '../types';
import type { DesktopBridge } from '../types/desktop';
import { useDesktopRecovery } from './useDesktopRecovery';

const WORKBOOK: Workbook = {
  id: 'wb',
  title: 'Budget',
  sheets: [
    {
      id: 's1',
      name: 'Sheet1',
      cells: {},
      defaultColWidth: 100,
      defaultRowHeight: 25,
      columnWidths: {},
      rowHeights: {},
      columnCount: 5,
      rowCount: 10,
      frozenColumns: 0,
      frozenRows: 0,
    },
  ],
  activeSheetIndex: 0,
  lastModified: 0,
};

function bridge(overrides: Partial<DesktopBridge> = {}): DesktopBridge {
  return {
    isDesktop: true,
    platform: 'win32',
    writeRecovery: async () => ({ ok: true }),
    clearRecovery: async () => ({ ok: true }),
    ...overrides,
  } as unknown as DesktopBridge;
}

describe('useDesktopRecovery', () => {
  afterEach(() => {
    delete window.simplesheetsDesktop;
    jest.useRealTimers();
  });

  it('does nothing while disabled', async () => {
    const writeRecovery = jest.fn(async (_input: unknown) => ({ ok: true }));
    window.simplesheetsDesktop = bridge({ writeRecovery });
    renderHook(() => useDesktopRecovery(WORKBOOK, true, 'C:/a.ssjson', false));
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(writeRecovery).not.toHaveBeenCalled();
  });

  it('writes a debounced dirty snapshot with the current path', async () => {
    const writeRecovery = jest.fn(async (_input: unknown) => ({ ok: true }));
    window.simplesheetsDesktop = bridge({ writeRecovery });
    renderHook(() => useDesktopRecovery(WORKBOOK, true, 'C:/a.ssjson', true));

    await waitFor(() => expect(writeRecovery).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(writeRecovery.mock.calls[0][0]).toMatchObject({
      path: 'C:/a.ssjson',
      displayName: 'Budget',
    });
  });

  it('clears recovery when the document is clean', async () => {
    const clearRecovery = jest.fn(async () => ({ ok: true }));
    window.simplesheetsDesktop = bridge({ clearRecovery });
    renderHook(() => useDesktopRecovery(WORKBOOK, false, null, true));
    await waitFor(() => expect(clearRecovery).toHaveBeenCalledTimes(1));
  });

  it('reports write failures', async () => {
    const onError = jest.fn();
    window.simplesheetsDesktop = bridge({
      writeRecovery: async () => ({ ok: false, code: 'TOO_LARGE', message: 'too large' }),
    });
    renderHook(() => useDesktopRecovery(WORKBOOK, true, null, true, onError));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('too large'), { timeout: 3000 });
  });
});
