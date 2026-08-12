// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

// Mock URL.createObjectURL for export tests
beforeAll(() => {
  URL.createObjectURL = jest.fn(() => 'blob:mock');
  URL.revokeObjectURL = jest.fn();
});

// Track all scrollToIndex mock instances across virtualizer renders.
// The Grid creates a fresh virtualizer each render, so we collect all of them
// and assert that at least one was called with the expected args.
let rowScrollSpies: jest.Mock[] = [];
let colScrollSpies: jest.Mock[] = [];

beforeEach(() => {
  rowScrollSpies = [];
  colScrollSpies = [];
});

// Mock the virtualizer
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { horizontal?: boolean }) => {
    if (options.horizontal) {
      const scrollToIndex = jest.fn();
      colScrollSpies.push(scrollToIndex);
      return {
        getVirtualItems: () => {
          const items = [];
          for (let i = 0; i < 5; i++) {
            items.push({ index: i, start: i * 100, size: 100, end: (i + 1) * 100 });
          }
          return items;
        },
        getTotalSize: () => 500,
        scrollToIndex,
        measure: jest.fn(),
      };
    }
    const scrollToIndex = jest.fn();
    rowScrollSpies.push(scrollToIndex);
    return {
      getVirtualItems: () => {
        const items = [];
        for (let i = 0; i < 5; i++) {
          items.push({ index: i, start: i * 28, size: 28, end: (i + 1) * 28 });
        }
        return items;
      },
      getTotalSize: () => 140,
      scrollToIndex,
      measure: jest.fn(),
    };
  },
}));

// Helper: check if any scroll spy was called with the given index
function anyRowScrollToIndex(targetRow: number): boolean {
  return rowScrollSpies.some(spy => spy.mock.calls.some(call => call[0] === targetRow));
}
function anyColScrollToIndex(targetCol: number): boolean {
  return colScrollSpies.some(spy => spy.mock.calls.some(call => call[0] === targetCol));
}

// Helper: get all grid cells in row-major order (5 visible columns in mock)
function getAllCells(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.grid-cell'));
}

// Helper: get the cell element at (row, col) in the grid
// The mock renders 5 visible columns, so cell (row, col) is at index row*5 + col
function getCell(row: number, col: number): HTMLElement | null {
  const cells = getAllCells();
  return cells[row * 5 + col] ?? null;
}

// Helper: select a cell (single click)
function selectCell(row: number, col: number) {
  const cell = getCell(row, col);
  if (!cell) throw new Error(`Cell (${row},${col}) not found`);
  fireEvent.mouseDown(cell);
}

// Helper: get the currently selected cell by checking for the selected class
function getSelectedCell(): { row: number; col: number } | null {
  const cells = getAllCells();
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].classList.contains('grid-cell-selected')) {
      const row = Math.floor(i / 5);
      const col = i % 5;
      return { row, col };
    }
  }
  return null;
}

describe('App - Per-Sheet Active Cell Preservation', () => {
  it('restores the active cell when switching back to a sheet', () => {
    render(<App />);

    // Add a second sheet
    fireEvent.click(screen.getByTitle('Add a new sheet'));
    expect(screen.getByText('Sheet2')).toBeInTheDocument();

    // Switch to Sheet2 first so Sheet1's default A1 is saved
    fireEvent.click(screen.getByText('Sheet2'));

    // Switch back to Sheet1
    fireEvent.click(screen.getByText('Sheet1'));

    // Select B4 (row 3, col 1) on Sheet1
    selectCell(3, 1);
    expect(getSelectedCell()).toEqual({ row: 3, col: 1 });

    // Switch to Sheet2
    fireEvent.click(screen.getByText('Sheet2'));

    // Sheet2 should default to A1 (row 0, col 0) since it was never visited
    expect(getSelectedCell()).toEqual({ row: 0, col: 0 });

    // Select A2 (row 1, col 0) on Sheet2
    selectCell(1, 0);
    expect(getSelectedCell()).toEqual({ row: 1, col: 0 });

    // Switch back to Sheet1 — should restore B4 (row 3, col 1), NOT A2
    fireEvent.click(screen.getByText('Sheet1'));
    expect(getSelectedCell()).toEqual({ row: 3, col: 1 });
  });

  it('does not bleed active cell position from one sheet to another', () => {
    render(<App />);

    // Add a second sheet
    fireEvent.click(screen.getByTitle('Add a new sheet'));

    // Switch to Sheet2
    fireEvent.click(screen.getByText('Sheet2'));

    // Switch back to Sheet1
    fireEvent.click(screen.getByText('Sheet1'));

    // Select D2 (row 1, col 3) on Sheet1
    selectCell(1, 3);
    expect(getSelectedCell()).toEqual({ row: 1, col: 3 });

    // Switch to Sheet2 — should NOT show D2 (row 1, col 3) as selected
    fireEvent.click(screen.getByText('Sheet2'));
    const selected = getSelectedCell();
    // Sheet2 was never visited, so it defaults to A1
    expect(selected).toEqual({ row: 0, col: 0 });
  });

  it('preserves different active cells across three sheets', () => {
    render(<App />);

    // Add two more sheets
    fireEvent.click(screen.getByTitle('Add a new sheet'));
    fireEvent.click(screen.getByTitle('Add a new sheet'));
    expect(screen.getByText('Sheet3')).toBeInTheDocument();

    // Sheet1: select B2 (row 1, col 1)
    fireEvent.click(screen.getByText('Sheet1'));
    selectCell(1, 1);
    expect(getSelectedCell()).toEqual({ row: 1, col: 1 });

    // Sheet2: select C3 (row 2, col 2)
    fireEvent.click(screen.getByText('Sheet2'));
    selectCell(2, 2);
    expect(getSelectedCell()).toEqual({ row: 2, col: 2 });

    // Sheet3: select A4 (row 3, col 0)
    fireEvent.click(screen.getByText('Sheet3'));
    selectCell(3, 0);
    expect(getSelectedCell()).toEqual({ row: 3, col: 0 });

    // Return to Sheet1 — should be B2
    fireEvent.click(screen.getByText('Sheet1'));
    expect(getSelectedCell()).toEqual({ row: 1, col: 1 });

    // Return to Sheet2 — should be C3
    fireEvent.click(screen.getByText('Sheet2'));
    expect(getSelectedCell()).toEqual({ row: 2, col: 2 });

    // Return to Sheet3 — should be A4
    fireEvent.click(screen.getByText('Sheet3'));
    expect(getSelectedCell()).toEqual({ row: 3, col: 0 });
  });

  it('clears range selection when switching sheets', () => {
    render(<App />);

    // Add a second sheet
    fireEvent.click(screen.getByTitle('Add a new sheet'));

    // Switch to Sheet2
    fireEvent.click(screen.getByText('Sheet2'));

    // Switch back to Sheet1
    fireEvent.click(screen.getByText('Sheet1'));

    // Select a cell on Sheet1
    selectCell(2, 2);
    expect(getSelectedCell()).toEqual({ row: 2, col: 2 });

    // Switch to Sheet2 — active cell should be A1 (default), single cell selected
    fireEvent.click(screen.getByText('Sheet2'));
    expect(getSelectedCell()).toEqual({ row: 0, col: 0 });
  });

  it('scrolls to the restored active cell when switching sheets', () => {
    render(<App />);

    // Add a second sheet
    fireEvent.click(screen.getByTitle('Add a new sheet'));

    // Switch to Sheet2 first so Sheet1's default A1 is saved
    fireEvent.click(screen.getByText('Sheet2'));

    // Switch back to Sheet1
    fireEvent.click(screen.getByText('Sheet1'));

    // Select row 4, col 3 on Sheet1 (a cell far from origin)
    selectCell(4, 3);
    expect(getSelectedCell()).toEqual({ row: 4, col: 3 });

    // Switch to Sheet2
    fireEvent.click(screen.getByText('Sheet2'));

    // Clear scroll spies created during the Sheet2 render
    rowScrollSpies = [];
    colScrollSpies = [];

    // Switch back to Sheet1 — should scroll to row 4, col 3
    fireEvent.click(screen.getByText('Sheet1'));

    // The grid should have scrolled to make the restored cell visible
    expect(anyRowScrollToIndex(4)).toBe(true);
    expect(anyColScrollToIndex(3)).toBe(true);
  });
});
