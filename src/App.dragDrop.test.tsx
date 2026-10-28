// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import type { Workbook } from './types';

// Mock pdfExport/excelExport to avoid ESM issues in tests
jest.mock('./services/pdfExport', () => ({
  downloadPdf: jest.fn(() => Promise.resolve()),
}));
jest.mock('./services/excelExport', () => ({
  downloadExcel: jest.fn(),
  exportExcel: jest.fn(() => new Blob()),
}));

// Mock the virtualizer
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
    title: 'Dropped',
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

function dropFiles(files: File[]): void {
  const zone = screen.getByTestId('grid-drop-zone');
  fireEvent.drop(zone, { dataTransfer: { files } });
}

describe('App drag & drop import', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens the scope dialog for a dropped .ssjson file', async () => {
    const wb = makeWorkbook();
    const text = JSON.stringify(wb);
    const file = new File([text], 'dropped.ssjson', { type: 'application/json' });

    const spy = jest.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function(this: FileReader) {
      Object.defineProperty(this, 'result', { value: text });
      this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
    });

    render(<App />);
    dropFiles([file]);

    await waitFor(() => {
      expect(screen.getByText('Import Data')).toBeInTheDocument();
    });
    // JSON imports do not show CSV options.
    expect(screen.queryByText('Delimiter')).not.toBeInTheDocument();
    spy.mockRestore();
  });

  it('opens the scope dialog with CSV options for a dropped .csv file', async () => {
    const csv = 'a;b;c\n1;2;3';
    const file = new File([csv], 'data.csv', { type: 'text/csv' });

    const spy = jest.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function(this: FileReader) {
      Object.defineProperty(this, 'result', { value: csv });
      this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
    });

    render(<App />);
    dropFiles([file]);

    await waitFor(() => {
      expect(screen.getByText('Import Data')).toBeInTheDocument();
    });
    expect(screen.getByText('Delimiter')).toBeInTheDocument();
    expect(screen.getByText('First row is a header')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('shows an error for an unsupported file type', () => {
    render(<App />);
    const file = new File(['png-data'], 'image.png', { type: 'image/png' });
    dropFiles([file]);

    expect(screen.queryByText('Import Data')).not.toBeInTheDocument();
    expect(screen.getByTestId('status-message').textContent).toContain('Unsupported file type');
  });

  it('uses the first file when multiple files are dropped', async () => {
    const wb = makeWorkbook();
    const text = JSON.stringify(wb);
    const good = new File([text], 'first.ssjson', { type: 'application/json' });
    const bad = new File(['x'], 'second.png', { type: 'image/png' });

    const spy = jest.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function(this: FileReader) {
      Object.defineProperty(this, 'result', { value: text });
      this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
    });

    render(<App />);
    dropFiles([good, bad]);

    await waitFor(() => {
      expect(screen.getByText('Import Data')).toBeInTheDocument();
    });
    spy.mockRestore();
  });
});
