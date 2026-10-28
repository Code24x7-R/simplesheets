// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import { encodeDocToUrl } from './utils/shareUrl';
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
    id: 'shared-wb',
    title: 'Shared Budget',
    sheets: [
      {
        id: 'sheet-1',
        name: 'Sheet1',
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

function setSharedLinkUrl(workbook: Workbook): string {
  const url = encodeDocToUrl(workbook, 'http://localhost/');
  window.history.replaceState(null, '', url);
  return url;
}

describe('App shared-link open (read-only)', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('opens a #doc= link as a read-only snapshot', () => {
    setSharedLinkUrl(makeWorkbook());

    render(<App />);

    expect(screen.getByTestId('save-state').textContent).toBe('Shared snapshot (read-only)');
    expect(screen.getByText('Shared Budget')).toBeInTheDocument();
    expect(screen.getByTestId('status-message').textContent).toContain('Opened shared document');
  });

  it('strips the #doc= fragment after loading', () => {
    setSharedLinkUrl(makeWorkbook());

    render(<App />);

    expect(window.location.href).not.toContain('#doc=');
    expect(window.location.hash).toBe('');
  });

  it('records the shared document in the MRU as a url source', () => {
    setSharedLinkUrl(makeWorkbook());

    render(<App />);

    const raw = localStorage.getItem('simplesheets:mru');
    expect(raw).toBeTruthy();
    const entries = JSON.parse(raw!);
    expect(entries.some((e: { source: string; path?: string }) => e.source === 'url')).toBe(true);
    const urlEntry = entries.find((e: { source: string }) => e.source === 'url');
    expect(urlEntry.path).toContain('#doc=');
  });

  it('ignores an invalid #doc= fragment', () => {
    window.history.replaceState(null, '', 'http://localhost/#doc=%%%not-valid%%%');

    render(<App />);

    expect(screen.getByTestId('save-state').textContent).toBe('Not saved');
    expect(screen.getByTestId('status-message').textContent).not.toContain('Opened shared document');
  });

  it('marks the formula bar read-only for a shared snapshot', () => {
    setSharedLinkUrl(makeWorkbook());

    render(<App />);

    const input = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });

  it('does not start cell editing when typing in a read-only snapshot', () => {
    setSharedLinkUrl(makeWorkbook());

    render(<App />);

    // Select a cell so the grid has an active selection.
    const cell = document.querySelector('.grid-cell') as HTMLElement | null;
    expect(cell).toBeTruthy();
    fireEvent.mouseDown(cell!);

    // Type a printable character into the grid.
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;
    fireEvent.keyDown(grid, { key: 'x' });

    // The editing FSM must stay in SELECT (cell-mode "Ready"), not ENTER/EDIT.
    expect(screen.getByTestId('cell-mode').textContent).toBe('Ready');
  });
});
