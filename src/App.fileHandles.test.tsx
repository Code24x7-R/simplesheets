// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import type { Workbook } from './types';

jest.mock('./services/pdfExport', () => ({ downloadPdf: jest.fn(() => Promise.resolve()) }));
jest.mock('./services/excelExport', () => ({ downloadExcel: jest.fn(), exportExcel: jest.fn(() => new Blob()) }));
jest.mock('./utils/handleStore', () => ({
  storeFileHandle: jest.fn().mockResolvedValue(true),
  loadFileHandle: jest.fn(),
  deleteFileHandle: jest.fn().mockResolvedValue(undefined),
}));

import { storeFileHandle, loadFileHandle } from './utils/handleStore';

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { horizontal?: boolean }) => {
    if (options.horizontal) {
      return {
        getVirtualItems: () => [{ index: 0, start: 0, size: 100, end: 100 }],
        getTotalSize: () => 100,
        scrollToIndex: jest.fn(),
        measure: jest.fn(),
      };
    }
    return {
      getVirtualItems: () => [{ index: 0, start: 0, size: 28, end: 28 }],
      getTotalSize: () => 28,
      scrollToIndex: jest.fn(),
      measure: jest.fn(),
    };
  },
}));

function makeWorkbook(): Workbook {
  return {
    id: 'wb-1',
    title: 'Budget',
    sheets: [
      {
        id: 's1',
        name: 'Sheet1',
        cells: { '0:0': { rawValue: 'x' } },
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
    lastModified: 1000,
  };
}

function fireGlobalKeyDown(key: string): void {
  fireEvent.keyDown(window, { key, ctrlKey: true, shiftKey: false, metaKey: false });
}

function mockFileReader(text: string): jest.SpyInstance {
  return jest.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function(this: FileReader) {
    Object.defineProperty(this, 'result', { value: text });
    this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
  });
}

describe('App File System Access integration', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    delete (window as Partial<Window>).showOpenFilePicker;
  });

  afterEach(() => {
    delete (window as Partial<Window>).showOpenFilePicker;
  });

  it('captures a handle on open and records it in the MRU', async () => {
    const wb = makeWorkbook();
    const text = JSON.stringify(wb);
    const file = new File([text], 'budget.ssjson', { type: 'application/json' });
    const handle = {
      getFile: jest.fn().mockResolvedValue(file),
      queryPermission: jest.fn().mockResolvedValue('granted'),
    } as unknown as FileSystemFileHandle;
    (window as Partial<Window>).showOpenFilePicker = jest.fn().mockResolvedValue([handle]);

    const readerSpy = mockFileReader(text);
    render(<App />);
    fireGlobalKeyDown('o');

    await waitFor(() => {
      expect(storeFileHandle).toHaveBeenCalled();
    });

    const raw = localStorage.getItem('simplesheets:mru');
    expect(raw).toBeTruthy();
    const entries = JSON.parse(raw!);
    const entry = entries.find((e: { source: string }) => e.source === 'local');
    expect(entry.canReopen).toBe(true);
    expect(entry.handleId).toBeTruthy();
    expect(screen.getByTestId('status-message').textContent).toContain('Imported "budget"');
    readerSpy.mockRestore();
  });

  it('falls back to the hidden picker when File System Access is unsupported', () => {
    const clickSpy = jest.spyOn(HTMLInputElement.prototype, 'click');
    render(<App />);
    fireGlobalKeyDown('o');
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('reopens a recent local file from its retained handle', async () => {
    const wb = makeWorkbook();
    const text = JSON.stringify(wb);
    const file = new File([text], 'budget.ssjson', { type: 'application/json' });
    const handle = {
      getFile: jest.fn().mockResolvedValue(file),
      queryPermission: jest.fn().mockResolvedValue('granted'),
      requestPermission: jest.fn(),
    } as unknown as FileSystemFileHandle;
    jest.mocked(loadFileHandle).mockResolvedValue(handle);

    localStorage.setItem('simplesheets:mru', JSON.stringify([
      { id: 'mru-1', name: 'budget.ssjson', size: 10, timestamp: 1000, source: 'local', handleId: 'h1', canReopen: true },
    ]));

    const readerSpy = mockFileReader(text);
    render(<App />);

    fireEvent.click(screen.getByText('File'));
    fireEvent.mouseEnter(screen.getByText('Recent'));
    fireEvent.click(screen.getByText('budget.ssjson'));

    await waitFor(() => {
      expect(screen.getByTestId('status-message').textContent).toContain('Imported "budget"');
    });
    expect(loadFileHandle).toHaveBeenCalledWith('h1');
    readerSpy.mockRestore();
  });

  it('falls back to the picker when a retained handle is missing', async () => {
    jest.mocked(loadFileHandle).mockResolvedValue(null);
    localStorage.setItem('simplesheets:mru', JSON.stringify([
      { id: 'mru-1', name: 'budget.ssjson', size: 10, timestamp: 1000, source: 'local', handleId: 'gone', canReopen: true },
    ]));

    const clickSpy = jest.spyOn(HTMLInputElement.prototype, 'click');
    render(<App />);

    fireEvent.click(screen.getByText('File'));
    fireEvent.mouseEnter(screen.getByText('Recent'));
    fireEvent.click(screen.getByText('budget.ssjson'));

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });
    clickSpy.mockRestore();
  });

  it('Save retains a file handle and records it in the MRU', async () => {
    const write = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const handle = {
      createWritable: jest.fn().mockResolvedValue({ write, close }),
    } as unknown as FileSystemFileHandle;
    (window as Partial<Window>).showSaveFilePicker = jest.fn().mockResolvedValue(handle);

    render(<App />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(write).toHaveBeenCalled();
    });

    const raw = localStorage.getItem('simplesheets:mru');
    const entries = JSON.parse(raw!);
    const entry = entries.find((e: { source: string }) => e.source === 'local');
    expect(entry.canReopen).toBe(true);
    expect(entry.handleId).toBeTruthy();
    expect(screen.getByTestId('save-state').textContent).toContain('Saved ·');
  });

  it('Save As retains a file handle', async () => {
    const write = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const handle = {
      createWritable: jest.fn().mockResolvedValue({ write, close }),
    } as unknown as FileSystemFileHandle;
    (window as Partial<Window>).showSaveFilePicker = jest.fn().mockResolvedValue(handle);

    render(<App />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Save As…'));

    await waitFor(() => {
      expect(write).toHaveBeenCalled();
    });

    const raw = localStorage.getItem('simplesheets:mru');
    const entries = JSON.parse(raw!);
    const entry = entries.find((e: { source: string }) => e.source === 'local');
    expect(entry.canReopen).toBe(true);
    expect(entry.handleId).toBeTruthy();
  });
});
