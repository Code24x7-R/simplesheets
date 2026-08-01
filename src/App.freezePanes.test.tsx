// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

// Mock the virtualizer
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { horizontal?: boolean }) => {
    if (options.horizontal) {
      return {
        getVirtualItems: () => {
          const items = [];
          for (let i = 0; i < 5; i++) {
            items.push({ index: i, start: i * 100, size: 100, end: (i + 1) * 100 });
          }
          return items;
        },
        getTotalSize: () => 500,
        scrollToIndex: jest.fn(),
        measure: jest.fn(),
      };
    }
    return {
      getVirtualItems: () => {
        const items = [];
        for (let i = 0; i < 5; i++) {
          items.push({ index: i, start: i * 28, size: 28, end: (i + 1) * 28 });
        }
        return items;
      },
      getTotalSize: () => 140,
      scrollToIndex: jest.fn(),
      measure: jest.fn(),
    };
  },
}));

// Helper: get the cell element at (row, col) in the grid
function getCell(row: number, col: number): HTMLElement | null {
  const cells = Array.from(document.querySelectorAll('.grid-cell')) as HTMLElement[];
  return cells[row * 5 + col] ?? null;
}

// Helper: click a cell to make it active
function selectCell(row: number, col: number) {
  const cell = getCell(row, col);
  if (!cell) throw new Error(`Cell (${row},${col}) not found`);
  fireEvent.mouseDown(cell);
}

// Helper: get the footer's freeze info text
function getFooterFreezeText(): string {
  const footer = document.querySelector('footer');
  return footer?.textContent ?? '';
}

describe('App — Freeze Panes per Excel specification', () => {
  it('freezes based on active cell position (C3 → 2 rows, 2 cols)', () => {
    render(<App />);

    // Select cell C3 (row=2, col=2) — like Excel, this should freeze
    // rows 1-2 (indices 0-1) and columns A-B (indices 0-1)
    selectCell(2, 2);

    // Open View menu → Freeze Panes
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Freeze Panes'));

    // Footer should reflect 2 frozen rows and 2 frozen columns
    expect(getFooterFreezeText()).toContain('2 frozen row(s)');
    expect(getFooterFreezeText()).toContain('2 frozen col(s)');

    // Grid rendering: Excel freezes all rows above and all cols to the left.
    // A cell is frozen if its row < frozenRows OR its col < frozenColumns.
    // frozenRows=2, frozenColumns=2.
    // Row 0 (all cols) frozen — above C3
    expect(getCell(0, 0)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(0, 1)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(0, 2)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(0, 3)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(0, 4)?.classList.contains('grid-cell-frozen')).toBe(true);
    // Row 1 (all cols) frozen — above C3
    expect(getCell(1, 0)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(1, 1)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(1, 2)?.classList.contains('grid-cell-frozen')).toBe(true);
    // Col 0 (all rows) frozen — left of C3
    expect(getCell(2, 0)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(3, 0)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(4, 0)?.classList.contains('grid-cell-frozen')).toBe(true);
    // Col 1 (all rows) frozen — left of C3
    expect(getCell(2, 1)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(3, 1)?.classList.contains('grid-cell-frozen')).toBe(true);
    // Active cell C3 (row=2, col=2) and beyond: NOT frozen
    expect(getCell(2, 2)?.classList.contains('grid-cell-frozen')).toBe(false);
    expect(getCell(2, 3)?.classList.contains('grid-cell-frozen')).toBe(false);
    expect(getCell(3, 2)?.classList.contains('grid-cell-frozen')).toBe(false);
    expect(getCell(3, 3)?.classList.contains('grid-cell-frozen')).toBe(false);
  });

  it('freezes 0 rows and 0 cols when active cell is A1', () => {
    render(<App />);

    // Select A1 (row=0, col=0) — nothing to freeze
    selectCell(0, 0);

    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Freeze Panes'));

    // Footer should not show any frozen panes
    expect(getFooterFreezeText()).not.toContain('frozen row');
    expect(getFooterFreezeText()).not.toContain('frozen col');

    // No cells should have the frozen class
    expect(getCell(0, 0)?.classList.contains('grid-cell-frozen')).toBe(false);
    expect(getCell(0, 1)?.classList.contains('grid-cell-frozen')).toBe(false);
    expect(getCell(1, 0)?.classList.contains('grid-cell-frozen')).toBe(false);
  });

  it('freezes only rows when active cell is in column A', () => {
    render(<App />);

    // Select A3 (row=2, col=0) — freeze 2 rows, 0 cols
    selectCell(2, 0);

    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Freeze Panes'));

    expect(getFooterFreezeText()).toContain('2 frozen row(s)');
    expect(getFooterFreezeText()).not.toContain('frozen col');

    // Rows 0 and 1 are frozen (all columns)
    expect(getCell(0, 0)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(0, 1)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(0, 2)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(1, 0)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(1, 1)?.classList.contains('grid-cell-frozen')).toBe(true);
    // Row 2 is NOT frozen (active cell's row)
    expect(getCell(2, 0)?.classList.contains('grid-cell-frozen')).toBe(false);
    expect(getCell(2, 1)?.classList.contains('grid-cell-frozen')).toBe(false);
  });

  it('freezes only columns when active cell is in row 1', () => {
    render(<App />);

    // Select C1 (row=0, col=2) — freeze 0 rows, 2 cols
    selectCell(0, 2);

    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Freeze Panes'));

    expect(getFooterFreezeText()).toContain('2 frozen col(s)');
    expect(getFooterFreezeText()).not.toContain('frozen row');

    // Columns 0 and 1 are frozen (all visible rows)
    expect(getCell(0, 0)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(1, 0)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(0, 1)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(1, 1)?.classList.contains('grid-cell-frozen')).toBe(true);
    // Column 2 is NOT frozen (active cell's column)
    expect(getCell(0, 2)?.classList.contains('grid-cell-frozen')).toBe(false);
    expect(getCell(1, 2)?.classList.contains('grid-cell-frozen')).toBe(false);
  });

  it('freeze with active cell at D5 freezes 4 rows and 3 cols', () => {
    render(<App />);

    // Select D5 (row=4, col=3) — freeze 4 rows, 3 cols
    selectCell(4, 3);

    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Freeze Panes'));

    expect(getFooterFreezeText()).toContain('4 frozen row(s)');
    expect(getFooterFreezeText()).toContain('3 frozen col(s)');

    // frozenRows=4, frozenColumns=3
    // Rows 0-3 (all cols) frozen
    expect(getCell(0, 0)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(3, 2)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(3, 3)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(3, 4)?.classList.contains('grid-cell-frozen')).toBe(true);
    // Cols 0-2 (all rows) frozen
    expect(getCell(4, 0)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(4, 1)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(4, 2)?.classList.contains('grid-cell-frozen')).toBe(true);
    // Active cell D5 (row=4, col=3) and beyond: NOT frozen
    expect(getCell(4, 3)?.classList.contains('grid-cell-frozen')).toBe(false);
    expect(getCell(4, 4)?.classList.contains('grid-cell-frozen')).toBe(false);
    expect(getCell(0, 3)?.classList.contains('grid-cell-frozen')).toBe(true); // row 0 is frozen
  });

  it('status message reports correct freeze dimensions from active cell', () => {
    render(<App />);

    // Select B5 (row=4, col=1) — freeze 4 rows, 1 col
    selectCell(4, 1);

    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Freeze Panes'));

    // Status message should report the actual freeze point
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar.textContent).toContain('4 row');
    expect(statusBar.textContent).toContain('1 col');

    // Grid rendering: frozenRows=4, frozenColumns=1
    // Col 0 (all rows) frozen — left of B5
    expect(getCell(0, 0)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(4, 0)?.classList.contains('grid-cell-frozen')).toBe(true);
    // Rows 0-3 (all cols) frozen — above B5
    expect(getCell(0, 1)?.classList.contains('grid-cell-frozen')).toBe(true);
    expect(getCell(3, 1)?.classList.contains('grid-cell-frozen')).toBe(true);
    // Active cell B5 (row=4, col=1) and beyond: NOT frozen
    expect(getCell(4, 1)?.classList.contains('grid-cell-frozen')).toBe(false);
    expect(getCell(4, 2)?.classList.contains('grid-cell-frozen')).toBe(false);
  });

  it('freezes using selection anchor when a range is selected', () => {
    render(<App />);

    // Select A1 (row=0, col=0) first
    selectCell(0, 0);
    // Then shift+click C3 (row=2, col=2) to create a range selection
    // The anchor remains at A1, so nothing should freeze
    const c3 = getCell(2, 2);
    if (c3) fireEvent.mouseDown(c3, { shiftKey: true });

    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Freeze Panes'));

    // Anchor is at A1, so nothing frozen
    expect(getFooterFreezeText()).not.toContain('frozen row');
    expect(getFooterFreezeText()).not.toContain('frozen col');
  });

  it('arrow navigation is bounded by frozen rows and columns', () => {
    render(<App />);

    // Select C3 (row=2, col=2) — freeze 2 rows, 2 cols
    selectCell(2, 2);

    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Freeze Panes'));

    // frozenRows=2, frozenColumns=2
    expect(getFooterFreezeText()).toContain('2 frozen row(s)');
    expect(getFooterFreezeText()).toContain('2 frozen col(s)');

    // Select a cell in the scrollable area (row=4, col=4)
    selectCell(4, 4);

    // Press ArrowUp — should stop at row 2 (first scrollable row)
    const grid = document.querySelector('.overflow-auto') as HTMLElement;
    expect(grid).toBeTruthy();
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    fireEvent.keyDown(grid, { key: 'ArrowUp' }); // Try to go past frozen area

    // After ArrowUp x3 from row=4, should be at row=2 (E3, not row=1 or row=0)
    // Row is bounded by frozenRows=2
    const cellRefBtn = document.querySelector('button[title*="Active cell"]') as HTMLElement;
    expect(cellRefBtn).toBeTruthy();
    expect(cellRefBtn.textContent).toBe('E3');

    // Press ArrowLeft x3 — should stop at col 2 (C3, not col=1 or col=0)
    // Col is bounded by frozenColumns=2
    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    fireEvent.keyDown(grid, { key: 'ArrowLeft' });

    // Should be at C3 (col=2, not col=1 or col=0)
    expect(cellRefBtn.textContent).toBe('C3');
  });
});
