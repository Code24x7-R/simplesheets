// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
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

function makeImportWorkbook(title = 'Imported', sheetName = 'Imported'): Workbook {
  return {
    id: 'import-wb',
    title,
    sheets: [
      {
        id: 'import-sheet',
        name: sheetName,
        cells: { '0:0': { rawValue: 'hello' } },
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

/** Simulate selecting a file in the hidden Import→JSON button (3rd file input). */
function triggerJsonImport(wb: Workbook, fileName: string): void {
  const inputs = document.querySelectorAll('input[type="file"]');
  const input = inputs[2] as HTMLInputElement;
  const text = JSON.stringify(wb);
  const file = new File([text], fileName, { type: 'application/json' });

  const spy = jest.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function(this: FileReader) {
    Object.defineProperty(this, 'result', { value: text });
    this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
  });

  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
  spy.mockRestore();
}

describe('App import scope dialog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the scope dialog after an import (not replacing immediately)', () => {
    render(<App />);
    triggerJsonImport(makeImportWorkbook(), 'mydata.json');

    expect(screen.getByText('Import Data')).toBeInTheDocument();
    expect(screen.getByText(/Replace workbook/)).toBeInTheDocument();
    expect(screen.getByText(/Add as new sheet/)).toBeInTheDocument();
    expect(screen.getByText(/Insert at active cell/)).toBeInTheDocument();
  });

  it('replaces the workbook when Replace is chosen', () => {
    render(<App />);
    triggerJsonImport(makeImportWorkbook('Imported Budget'), 'budget.json');

    // Default scope is replace.
    fireEvent.click(screen.getByText('Import'));

    expect(screen.getByText('budget')).toBeInTheDocument();
    expect(screen.getByTestId('status-message').textContent).toContain('Imported "budget"');
  });

  it('appends sheets when Add as new sheet(s) is chosen', () => {
    render(<App />);
    triggerJsonImport(makeImportWorkbook('Imported', 'Imported'), 'data.json');

    fireEvent.click(screen.getByLabelText(/Add as new sheet/));
    fireEvent.click(screen.getByText('Import'));

    expect(screen.getByTestId('status-message').textContent).toContain('Imported 1 sheet(s) into the workbook');
  });

  it('inserts at the active cell when Insert is chosen', () => {
    render(<App />);
    triggerJsonImport(makeImportWorkbook(), 'data.json');

    fireEvent.click(screen.getByLabelText(/Insert at active cell/));
    fireEvent.click(screen.getByText('Import'));

    expect(screen.getByTestId('status-message').textContent).toContain('Imported data at the active cell');
  });

  it('cancels the scope dialog without changing the workbook', () => {
    render(<App />);
    triggerJsonImport(makeImportWorkbook(), 'data.json');

    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Import Data')).not.toBeInTheDocument();
    expect(screen.getByTestId('status-message').textContent).not.toContain('Imported');
  });
});
