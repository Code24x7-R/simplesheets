// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, fireEvent } from '@testing-library/react';
import { Grid } from './components/Grid';
import type { Sheet } from './types';
import type { EditingSession } from './hooks/useCellEditing';

// Simulated scroll state for the mock virtualizer
let scrollLeft = 0;
let scrollTop = 0;

// Mock the virtualizer with scroll simulation
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { horizontal?: boolean }) => {
    if (options.horizontal) {
      return {
        getVirtualItems: () => {
          // Simulate horizontal scrolling: only return columns near scrollLeft
          // Column width is 100px by default
          const colWidth = 100;
          const viewportWidth = 400;
          const overscan = 3;
          const startCol = Math.max(0, Math.floor(scrollLeft / colWidth) - overscan);
          const endCol = Math.min(26, Math.ceil((scrollLeft + viewportWidth) / colWidth) + overscan);
          const items = [];
          for (let i = startCol; i < endCol; i++) {
            items.push({ index: i, start: i * colWidth, size: colWidth, end: (i + 1) * colWidth });
          }
          return items;
        },
        getTotalSize: () => 26 * 100,
        scrollToIndex: jest.fn(),
        measure: jest.fn(),
      };
    }
    return {
      getVirtualItems: () => {
        // Simulate vertical scrolling
        const rowHeight = 28;
        const viewportHeight = 200;
        const overscan = 5;
        const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
        const endRow = Math.min(1000, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
        const items = [];
        for (let i = startRow; i < endRow; i++) {
          items.push({ index: i, start: i * rowHeight, size: rowHeight, end: (i + 1) * rowHeight });
        }
        return items;
      },
      getTotalSize: () => 1000 * 28,
      scrollToIndex: jest.fn(),
      measure: jest.fn(),
    };
  },
}));

// Mock scroll event to update scroll position
const mockScrollElement = {
  scrollLeft: 0,
  scrollTop: 0,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

beforeEach(() => {
  scrollLeft = 0;
  scrollTop = 0;
  mockScrollElement.scrollLeft = 0;
  mockScrollElement.scrollTop = 0;
});

// Helper to create a sheet with frozen panes
function createSheet(frozenRows: number, frozenColumns: number): Sheet {
  return {
    id: 'test-sheet',
    name: 'Test',
    cells: {
      '0:0': { rawValue: 'A1' },
      '0:1': { rawValue: 'B1' },
      '0:2': { rawValue: 'C1' },
      '1:0': { rawValue: 'A2' },
      '1:1': { rawValue: 'B2' },
      '1:2': { rawValue: 'C2' },
      '2:0': { rawValue: 'A3' },
      '2:1': { rawValue: 'B3' },
      '2:2': { rawValue: 'C3' },
    },
    defaultColWidth: 100,
    defaultRowHeight: 28,
    columnWidths: {},
    rowHeights: {},
    columnCount: 26,
    rowCount: 1000,
    frozenRows,
    frozenColumns,
  };
}

// Minimal mock session (SELECT state = not editing)
const mockSession: EditingSession = {
  state: 'SELECT',
  row: 0,
  col: 0,
  buffer: '',
  originalValue: '',
  caretPos: 0,
  isFormula: false,
};

describe('Grid — Frozen cells remain visible when scrolling', () => {
  it('keeps frozen column A visible when scrolled right', () => {
    // Freeze 1 row and 1 column (like selecting B2 and freezing)
    const sheet = createSheet(1, 1);

    const { container } = render(
      <Grid
        sheet={sheet}
        selectedCell={{ row: 1, col: 1 }}
        session={mockSession}
        onSelect={() => {}}
        onCellChange={() => {}}
        onStartEdit={() => {}}
        onStartEnter={() => {}}
        onSelectionChange={() => {}}
        onFillSeries={() => {}}
        onMoveRange={() => {}}
        filterState={{ active: false, filters: {}, visibleDataRows: 0, totalDataRows: 0, headerRow: 0, hiddenRows: new Set() }}
      />
    );

    // Initially, column A (col=0) should be rendered and frozen
    const frozenCellsBefore = container.querySelectorAll('.grid-cell-frozen');
    const frozenTextsBefore = Array.from(frozenCellsBefore).map((el) => el.textContent);
    expect(frozenTextsBefore).toContain('A1');
    expect(frozenTextsBefore).toContain('A2');
    expect(frozenTextsBefore).toContain('A3');

    // Simulate scrolling right past column A
    scrollLeft = 500; // Scrolled 500px right (past column A at 0-100px)

    // Trigger a re-render by updating a prop
    const updatedSheet = { ...sheet, cells: { ...sheet.cells, '5:5': { rawValue: 'F6' } } };
    render(
      <Grid
        sheet={updatedSheet}
        selectedCell={{ row: 1, col: 1 }}
        session={mockSession}
        onSelect={() => {}}
        onCellChange={() => {}}
        onStartEdit={() => {}}
        onStartEnter={() => {}}
        onSelectionChange={() => {}}
        onFillSeries={() => {}}
        onMoveRange={() => {}}
        filterState={{ active: false, filters: {}, visibleDataRows: 0, totalDataRows: 0, headerRow: 0, hiddenRows: new Set() }}
      />
    );

    // After scrolling, column A should STILL be rendered and frozen
    const frozenCellsAfter = container.querySelectorAll('.grid-cell-frozen');
    const frozenTextsAfter = Array.from(frozenCellsAfter).map((el) => el.textContent);
    expect(frozenTextsAfter).toContain('A1');
    expect(frozenTextsAfter).toContain('A2');
    expect(frozenTextsAfter).toContain('A3');
  });

  it('keeps frozen row 1 visible when scrolled down', () => {
    // Freeze 1 row and 1 column
    const sheet = createSheet(1, 1);

    const { container } = render(
      <Grid
        sheet={sheet}
        selectedCell={{ row: 1, col: 1 }}
        session={mockSession}
        onSelect={() => {}}
        onCellChange={() => {}}
        onStartEdit={() => {}}
        onStartEnter={() => {}}
        onSelectionChange={() => {}}
        onFillSeries={() => {}}
        onMoveRange={() => {}}
        filterState={{ active: false, filters: {}, visibleDataRows: 0, totalDataRows: 0, headerRow: 0, hiddenRows: new Set() }}
      />
    );

    // Initially, row 0 should be frozen
    const frozenCellsBefore = container.querySelectorAll('.grid-cell-frozen');
    const frozenTextsBefore = Array.from(frozenCellsBefore).map((el) => el.textContent);
    expect(frozenTextsBefore).toContain('A1');
    expect(frozenTextsBefore).toContain('B1');
    expect(frozenTextsBefore).toContain('C1');

    // Simulate scrolling down past row 0
    scrollTop = 500; // Scrolled 500px down (past row 0 at 0-28px)

    // Trigger a re-render
    const updatedSheet = { ...sheet, cells: { ...sheet.cells, '5:5': { rawValue: 'F6' } } };
    render(
      <Grid
        sheet={updatedSheet}
        selectedCell={{ row: 1, col: 1 }}
        session={mockSession}
        onSelect={() => {}}
        onCellChange={() => {}}
        onStartEdit={() => {}}
        onStartEnter={() => {}}
        onSelectionChange={() => {}}
        onFillSeries={() => {}}
        onMoveRange={() => {}}
        filterState={{ active: false, filters: {}, visibleDataRows: 0, totalDataRows: 0, headerRow: 0, hiddenRows: new Set() }}
      />
    );

    // After scrolling, row 0 should STILL be rendered and frozen
    const frozenCellsAfter = container.querySelectorAll('.grid-cell-frozen');
    const frozenTextsAfter = Array.from(frozenCellsAfter).map((el) => el.textContent);
    expect(frozenTextsAfter).toContain('A1');
    expect(frozenTextsAfter).toContain('B1');
    expect(frozenTextsAfter).toContain('C1');
  });

  it('keeps multiple frozen columns visible when scrolled right', () => {
    // Freeze 2 rows and 2 columns (like selecting C3 and freezing)
    const sheet = createSheet(2, 2);

    const { container } = render(
      <Grid
        sheet={sheet}
        selectedCell={{ row: 2, col: 2 }}
        session={mockSession}
        onSelect={() => {}}
        onCellChange={() => {}}
        onStartEdit={() => {}}
        onStartEnter={() => {}}
        onSelectionChange={() => {}}
        onFillSeries={() => {}}
        onMoveRange={() => {}}
        filterState={{ active: false, filters: {}, visibleDataRows: 0, totalDataRows: 0, headerRow: 0, hiddenRows: new Set() }}
      />
    );

    // Initially, columns A and B should be frozen
    const frozenCellsBefore = container.querySelectorAll('.grid-cell-frozen');
    const frozenTextsBefore = Array.from(frozenCellsBefore).map((el) => el.textContent);
    expect(frozenTextsBefore).toContain('A1');
    expect(frozenTextsBefore).toContain('B1');
    expect(frozenTextsBefore).toContain('A2');
    expect(frozenTextsBefore).toContain('B2');

    // Simulate scrolling right past columns A and B
    scrollLeft = 500; // Scrolled 500px right (past columns A and B at 0-200px)

    // Trigger a re-render
    const updatedSheet = { ...sheet, cells: { ...sheet.cells, '5:5': { rawValue: 'F6' } } };
    render(
      <Grid
        sheet={updatedSheet}
        selectedCell={{ row: 2, col: 2 }}
        session={mockSession}
        onSelect={() => {}}
        onCellChange={() => {}}
        onStartEdit={() => {}}
        onStartEnter={() => {}}
        onSelectionChange={() => {}}
        onFillSeries={() => {}}
        onMoveRange={() => {}}
        filterState={{ active: false, filters: {}, visibleDataRows: 0, totalDataRows: 0, headerRow: 0, hiddenRows: new Set() }}
      />
    );

    // After scrolling, columns A and B should STILL be rendered and frozen
    const frozenCellsAfter = container.querySelectorAll('.grid-cell-frozen');
    const frozenTextsAfter = Array.from(frozenCellsAfter).map((el) => el.textContent);
    expect(frozenTextsAfter).toContain('A1');
    expect(frozenTextsAfter).toContain('B1');
    expect(frozenTextsAfter).toContain('A2');
    expect(frozenTextsAfter).toContain('B2');
  });

  it('frozen row cells in non-frozen columns scroll horizontally with content', () => {
    // Freeze 2 rows and 1 column (like selecting B3 and freezing)
    const sheet = createSheet(2, 1);

    const { container } = render(
      <Grid
        sheet={sheet}
        selectedCell={{ row: 2, col: 1 }}
        session={mockSession}
        onSelect={() => {}}
        onCellChange={() => {}}
        onStartEdit={() => {}}
        onStartEnter={() => {}}
        onSelectionChange={() => {}}
        onFillSeries={() => {}}
        onMoveRange={() => {}}
        filterState={{ active: false, filters: {}, visibleDataRows: 0, totalDataRows: 0, headerRow: 0, hiddenRows: new Set() }}
      />
    );

    // Get all frozen row cells (row 0 and 1)
    const frozenRowCells = container.querySelectorAll('[data-frozen-rows] .grid-cell-frozen');
    expect(frozenRowCells.length).toBeGreaterThan(0);

    // Check positioning: cells in non-frozen columns should be absolute (scroll with content)
    // Only cells in frozen columns (col=0) should be sticky
    frozenRowCells.forEach((cell) => {
      const col = parseInt(cell.getAttribute('data-col') || '0', 10);
      const position = (cell as HTMLElement).style.position;
      if (col < 1) {
        // Frozen column (intersection): should stick horizontally
        expect(position).toBe('sticky');
      } else {
        // Non-frozen column: should scroll horizontally (absolute positioning)
        expect(position).toBe('absolute');
      }
    });
  });

  it('scrollable rows start immediately below frozen rows (no gap)', () => {
    // Freeze 2 rows and 1 column
    const sheet = createSheet(2, 1);

    const { container } = render(
      <Grid
        sheet={sheet}
        selectedCell={{ row: 2, col: 1 }}
        session={mockSession}
        onSelect={() => {}}
        onCellChange={() => {}}
        onStartEdit={() => {}}
        onStartEnter={() => {}}
        onSelectionChange={() => {}}
        onFillSeries={() => {}}
        onMoveRange={() => {}}
        filterState={{ active: false, filters: {}, visibleDataRows: 0, totalDataRows: 0, headerRow: 0, hiddenRows: new Set() }}
      />
    );

    // The scrollable row container should start at frozenRowHeight (2 rows * 28px = 56px)
    // plus the header height (28px), so the first scrollable row (row 2) should be at:
    // headerHeight + frozenRowHeight = 28 + 56 = 84px from top
    const spacer = container.querySelector('[data-spacer]') as HTMLElement;
    expect(spacer).toBeTruthy();

    // The paddingTop should NOT create a gap — the frozen rows container already
    // occupies space in normal flow. The spacer should have paddingTop = 0 or
    // the frozen rows container should not occupy space.
    const spacerPaddingTop = parseInt(spacer.style.paddingTop || '0', 10);
    expect(spacerPaddingTop).toBe(0);
  });

  it('double-clicking a scrollable row cell triggers onStartEdit', () => {
    // Freeze 2 rows and 1 column
    const sheet = createSheet(2, 1);

    let editRow = -1;
    let editCol = -1;

    const { container } = render(
      <Grid
        sheet={sheet}
        selectedCell={{ row: 2, col: 1 }}
        session={mockSession}
        onSelect={() => {}}
        onCellChange={() => {}}
        onStartEdit={(row, col) => { editRow = row; editCol = col; }}
        onStartEnter={() => {}}
        onSelectionChange={() => {}}
        onFillSeries={() => {}}
        onMoveRange={() => {}}
        filterState={{ active: false, filters: {}, visibleDataRows: 0, totalDataRows: 0, headerRow: 0, hiddenRows: new Set() }}
      />
    );

    // Row 2 (first scrollable row) should have cells
    const row2Cells = container.querySelectorAll('[data-row-container="2"] .grid-cell');
    expect(row2Cells.length).toBeGreaterThan(0);

    // Double-click on cell at row 2, col 1
    const cell = row2Cells[0]; // First cell in row 2
    fireEvent.doubleClick(cell);

    // onStartEdit should have been called with row 2, col 0
    expect(editRow).toBe(2);
    expect(editCol).toBe(0);
  });

  it('single-clicking a scrollable row cell triggers onSelect', () => {
    // Freeze 2 rows and 1 column
    const sheet = createSheet(2, 1);

    let selectedRow = -1;
    let selectedCol = -1;

    const { container } = render(
      <Grid
        sheet={sheet}
        selectedCell={{ row: 2, col: 1 }}
        session={mockSession}
        onSelect={(row, col) => { selectedRow = row; selectedCol = col; }}
        onCellChange={() => {}}
        onStartEdit={() => {}}
        onStartEnter={() => {}}
        onSelectionChange={() => {}}
        onFillSeries={() => {}}
        onMoveRange={() => {}}
        filterState={{ active: false, filters: {}, visibleDataRows: 0, totalDataRows: 0, headerRow: 0, hiddenRows: new Set() }}
      />
    );

    // Row 2 (first scrollable row) should have cells
    const row2Cells = container.querySelectorAll('[data-row-container="2"] .grid-cell');
    expect(row2Cells.length).toBeGreaterThan(0);

    // Single-click on cell at row 2, col 1
    fireEvent.mouseDown(row2Cells[1]); // Second cell in row 2 (col 1)

    // onSelect should have been called with row 2, col 1
    expect(selectedRow).toBe(2);
    expect(selectedCol).toBe(1);
  });
});
