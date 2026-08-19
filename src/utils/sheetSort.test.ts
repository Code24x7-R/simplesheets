// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  sortRange,
  sortEntireSheet,
  sortSelection,
  findUsedRange,
  getCurrentRegion,
  type SortColumn,
} from './sheetSort';
import { createFilterState } from './sheetFilter';
import { cellKey } from '../types';
import type { Sheet, Cell } from '../types';

function createTestSheet(): Sheet {
  return {
    id: 'test-sheet',
    name: 'Test',
    cells: {},
    defaultColWidth: 100,
    defaultRowHeight: 28,
    columnWidths: {},
    rowHeights: {},
    columnCount: 26,
    rowCount: 100,
    frozenColumns: 0,
    frozenRows: 0,
  };
}

function makeCell(rawValue: string, computedValue?: string | number): Cell {
  return { rawValue, ...(computedValue !== undefined ? { computedValue } : {}) };
}

describe('sheetSort', () => {
  describe('findUsedRange', () => {
    it('returns zeros for empty sheet', () => {
      const sheet = createTestSheet();
      const range = findUsedRange(sheet);
      expect(range).toEqual({ startRow: 0, endRow: 0, startCol: 0, endCol: 0 });
    });

    it('finds range from single cell', () => {
      const sheet = createTestSheet();
      sheet.cells['5:3'] = makeCell('hello');
      const range = findUsedRange(sheet);
      expect(range).toEqual({ startRow: 5, endRow: 5, startCol: 3, endCol: 3 });
    });

    it('finds bounding box of multiple cells', () => {
      const sheet = createTestSheet();
      sheet.cells['2:1'] = makeCell('a');
      sheet.cells['5:4'] = makeCell('b');
      sheet.cells['3:2'] = makeCell('c');
      const range = findUsedRange(sheet);
      expect(range).toEqual({ startRow: 2, endRow: 5, startCol: 1, endCol: 4 });
    });
  });

  describe('getCurrentRegion', () => {
    it('returns just the cell when it is empty', () => {
      const sheet = createTestSheet();
      const region = getCurrentRegion(sheet, 5, 5);
      expect(region).toEqual({ startRow: 5, endRow: 5, startCol: 5, endCol: 5 });
    });

    it('returns just the single populated cell when isolated', () => {
      const sheet = createTestSheet();
      sheet.cells['3:3'] = makeCell('solo');
      const region = getCurrentRegion(sheet, 3, 3);
      expect(region).toEqual({ startRow: 3, endRow: 3, startCol: 3, endCol: 3 });
    });

    it('expands to contiguous block of data', () => {
      const sheet = createTestSheet();
      // 3x3 block at rows 2-4, cols 1-3
      sheet.cells['2:1'] = makeCell('a');
      sheet.cells['2:2'] = makeCell('b');
      sheet.cells['2:3'] = makeCell('c');
      sheet.cells['3:1'] = makeCell('d');
      sheet.cells['3:2'] = makeCell('e');
      sheet.cells['3:3'] = makeCell('f');
      sheet.cells['4:1'] = makeCell('g');
      sheet.cells['4:2'] = makeCell('h');
      sheet.cells['4:3'] = makeCell('i');

      // Start from center cell
      const region = getCurrentRegion(sheet, 3, 2);
      expect(region).toEqual({ startRow: 2, endRow: 4, startCol: 1, endCol: 3 });
    });

    it('does not cross an empty row', () => {
      const sheet = createTestSheet();
      // Row 1 has data, row 2 is empty, row 3 has data
      sheet.cells['1:0'] = makeCell('top');
      sheet.cells['3:0'] = makeCell('bottom');

      // From row 1, should not expand past the gap
      const region = getCurrentRegion(sheet, 1, 0);
      expect(region).toEqual({ startRow: 1, endRow: 1, startCol: 0, endCol: 0 });

      // From row 3, same
      const region2 = getCurrentRegion(sheet, 3, 0);
      expect(region2).toEqual({ startRow: 3, endRow: 3, startCol: 0, endCol: 0 });
    });

    it('does not cross an empty column', () => {
      const sheet = createTestSheet();
      // Col A has data, col B is empty, col C has data
      sheet.cells['0:0'] = makeCell('left');
      sheet.cells['0:2'] = makeCell('right');

      const region = getCurrentRegion(sheet, 0, 0);
      expect(region).toEqual({ startRow: 0, endRow: 0, startCol: 0, endCol: 0 });
    });

    it('expands around an L-shaped region', () => {
      const sheet = createTestSheet();
      // Horizontal: row 2, cols 0-2
      sheet.cells['2:0'] = makeCell('a');
      sheet.cells['2:1'] = makeCell('b');
      sheet.cells['2:2'] = makeCell('c');
      // Vertical: col 1, rows 3-4 (connected via row 2)
      sheet.cells['3:1'] = makeCell('d');
      sheet.cells['4:1'] = makeCell('e');

      const region = getCurrentRegion(sheet, 2, 1);
      expect(region).toEqual({ startRow: 2, endRow: 4, startCol: 0, endCol: 2 });
    });

    it('expands from any interior cell', () => {
      const sheet = createTestSheet();
      // 4x2 block at rows 5-8, cols 3-4
      for (let r = 5; r <= 8; r++) {
        for (let c = 3; c <= 4; c++) {
          sheet.cells[cellKey(r, c)] = makeCell(`${r},${c}`);
        }
      }

      // Start from bottom-right
      const region = getCurrentRegion(sheet, 8, 4);
      expect(region).toEqual({ startRow: 5, endRow: 8, startCol: 3, endCol: 4 });
    });

    it('stops at sheet boundaries', () => {
      const sheet = createTestSheet();
      // Data in top-left corner
      sheet.cells['0:0'] = makeCell('corner');
      const region = getCurrentRegion(sheet, 0, 0);
      expect(region).toEqual({ startRow: 0, endRow: 0, startCol: 0, endCol: 0 });
    });
  });

  describe('sortRange - single column', () => {
    it('sorts strings ascending', () => {
      const sheet = createTestSheet();
      sheet.cells['1:0'] = makeCell('Banana');
      sheet.cells['2:0'] = makeCell('Apple');
      sheet.cells['3:0'] = makeCell('Cherry');

      const result = sortRange(sheet, 1, 3, [{ column: 0, direction: 'asc' }]);

      expect(result.cells['1:0']?.rawValue).toBe('Apple');
      expect(result.cells['2:0']?.rawValue).toBe('Banana');
      expect(result.cells['3:0']?.rawValue).toBe('Cherry');
    });

    it('sorts strings descending', () => {
      const sheet = createTestSheet();
      sheet.cells['1:0'] = makeCell('Apple');
      sheet.cells['2:0'] = makeCell('Cherry');
      sheet.cells['3:0'] = makeCell('Banana');

      const result = sortRange(sheet, 1, 3, [{ column: 0, direction: 'desc' }]);

      expect(result.cells['1:0']?.rawValue).toBe('Cherry');
      expect(result.cells['2:0']?.rawValue).toBe('Banana');
      expect(result.cells['3:0']?.rawValue).toBe('Apple');
    });

    it('sorts numbers ascending', () => {
      const sheet = createTestSheet();
      sheet.cells['1:0'] = makeCell('30');
      sheet.cells['2:0'] = makeCell('10');
      sheet.cells['3:0'] = makeCell('20');

      const result = sortRange(sheet, 1, 3, [{ column: 0, direction: 'asc' }]);

      expect(result.cells['1:0']?.rawValue).toBe('10');
      expect(result.cells['2:0']?.rawValue).toBe('20');
      expect(result.cells['3:0']?.rawValue).toBe('30');
    });

    it('sorts numbers descending', () => {
      const sheet = createTestSheet();
      sheet.cells['1:0'] = makeCell('10');
      sheet.cells['2:0'] = makeCell('20');
      sheet.cells['3:0'] = makeCell('30');

      const result = sortRange(sheet, 1, 3, [{ column: 0, direction: 'desc' }]);

      expect(result.cells['1:0']?.rawValue).toBe('30');
      expect(result.cells['2:0']?.rawValue).toBe('20');
      expect(result.cells['3:0']?.rawValue).toBe('10');
    });

    it('numbers sort before text', () => {
      const sheet = createTestSheet();
      sheet.cells['1:0'] = makeCell('Zebra');
      sheet.cells['2:0'] = makeCell('10');
      sheet.cells['3:0'] = makeCell('Apple');

      const result = sortRange(sheet, 1, 3, [{ column: 0, direction: 'asc' }]);

      expect(result.cells['1:0']?.rawValue).toBe('10');
      expect(result.cells['2:0']?.rawValue).toBe('Apple');
      expect(result.cells['3:0']?.rawValue).toBe('Zebra');
    });

    it('empty cells sort last', () => {
      const sheet = createTestSheet();
      sheet.cells['1:0'] = makeCell('Banana');
      sheet.cells['2:0'] = makeCell('');
      sheet.cells['3:0'] = makeCell('Apple');

      const result = sortRange(sheet, 1, 3, [{ column: 0, direction: 'asc' }]);

      expect(result.cells['1:0']?.rawValue).toBe('Apple');
      expect(result.cells['2:0']?.rawValue).toBe('Banana');
      // Row 3 had empty, it should now be last (but still empty)
      expect(result.cells['3:0']?.rawValue).toBe('');
    });
  });

  describe('sortRange - multi-column', () => {
    it('sorts by second column when first column ties', () => {
      const sheet = createTestSheet();
      // Col A: name, Col B: age
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['1:1'] = makeCell('30');
      sheet.cells['2:0'] = makeCell('Alice');
      sheet.cells['2:1'] = makeCell('25');
      sheet.cells['3:0'] = makeCell('Bob');
      sheet.cells['3:1'] = makeCell('20');

      const sortColumns: SortColumn[] = [
        { column: 0, direction: 'asc' },
        { column: 1, direction: 'asc' },
      ];

      const result = sortRange(sheet, 1, 3, sortColumns);

      // Alice (25) should come before Alice (30)
      expect(result.cells['1:0']?.rawValue).toBe('Alice');
      expect(result.cells['1:1']?.rawValue).toBe('25');
      expect(result.cells['2:0']?.rawValue).toBe('Alice');
      expect(result.cells['2:1']?.rawValue).toBe('30');
      expect(result.cells['3:0']?.rawValue).toBe('Bob');
      expect(result.cells['3:1']?.rawValue).toBe('20');
    });
  });

  describe('sortRange - date sorting', () => {
    it('sorts ISO date strings chronologically (ascending)', () => {
      const sheet = createTestSheet();
      sheet.cells['1:0'] = makeCell('2026-03-15');
      sheet.cells['2:0'] = makeCell('2025-01-01');
      sheet.cells['3:0'] = makeCell('2026-01-01');

      const result = sortRange(sheet, 1, 3, [{ column: 0, direction: 'asc' }]);

      expect(result.cells['1:0']?.rawValue).toBe('2025-01-01');
      expect(result.cells['2:0']?.rawValue).toBe('2026-01-01');
      expect(result.cells['3:0']?.rawValue).toBe('2026-03-15');
    });

    it('sorts ISO date strings chronologically (descending)', () => {
      const sheet = createTestSheet();
      sheet.cells['1:0'] = makeCell('2025-01-01');
      sheet.cells['2:0'] = makeCell('2026-03-15');
      sheet.cells['3:0'] = makeCell('2026-01-01');

      const result = sortRange(sheet, 1, 3, [{ column: 0, direction: 'desc' }]);

      expect(result.cells['1:0']?.rawValue).toBe('2026-03-15');
      expect(result.cells['2:0']?.rawValue).toBe('2026-01-01');
      expect(result.cells['3:0']?.rawValue).toBe('2025-01-01');
    });

    it('sorts dates mixed with text and numbers correctly', () => {
      const sheet = createTestSheet();
      // Numbers sort before text; dates are ISO strings so they sort as text
      sheet.cells['1:0'] = makeCell('2026-03-15'); // date (ISO string)
      sheet.cells['2:0'] = makeCell('Apple');      // text
      sheet.cells['3:0'] = makeCell('10');         // number

      const result = sortRange(sheet, 1, 3, [{ column: 0, direction: 'asc' }]);

      // Number first, then ISO date string, then text
      expect(result.cells['1:0']?.rawValue).toBe('10');
      expect(result.cells['2:0']?.rawValue).toBe('2026-03-15');
      expect(result.cells['3:0']?.rawValue).toBe('Apple');
    });
  });

  describe('sortRange - header handling', () => {
    it('preserves header row position when hasHeader is true', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Name'); // Header
      sheet.cells['1:0'] = makeCell('Charlie');
      sheet.cells['2:0'] = makeCell('Alice');
      sheet.cells['3:0'] = makeCell('Bob');

      const result = sortRange(sheet, 0, 3, [{ column: 0, direction: 'asc' }], true);

      // Header stays at row 0
      expect(result.cells['0:0']?.rawValue).toBe('Name');
      // Data sorted
      expect(result.cells['1:0']?.rawValue).toBe('Alice');
      expect(result.cells['2:0']?.rawValue).toBe('Bob');
      expect(result.cells['3:0']?.rawValue).toBe('Charlie');
    });

    it('sorts all rows when hasHeader is false', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Zebra');
      sheet.cells['1:0'] = makeCell('Apple');

      const result = sortRange(sheet, 0, 1, [{ column: 0, direction: 'asc' }], false);

      expect(result.cells['0:0']?.rawValue).toBe('Apple');
      expect(result.cells['1:0']?.rawValue).toBe('Zebra');
    });
  });

  describe('sortRange - row integrity', () => {
    it('keeps cells in a row together after sort', () => {
      const sheet = createTestSheet();
      sheet.cells['1:0'] = makeCell('Charlie');
      sheet.cells['1:1'] = makeCell('30');
      sheet.cells['1:2'] = makeCell('NYC');
      sheet.cells['2:0'] = makeCell('Alice');
      sheet.cells['2:1'] = makeCell('25');
      sheet.cells['2:2'] = makeCell('LA');
      sheet.cells['3:0'] = makeCell('Bob');
      sheet.cells['3:1'] = makeCell('35');
      sheet.cells['3:2'] = makeCell('Chicago');

      const result = sortRange(sheet, 1, 3, [{ column: 0, direction: 'asc' }]);

      // Alice should still be with 25 and LA
      expect(result.cells['1:0']?.rawValue).toBe('Alice');
      expect(result.cells['1:1']?.rawValue).toBe('25');
      expect(result.cells['1:2']?.rawValue).toBe('LA');

      // Bob should still be with 35 and Chicago
      expect(result.cells['2:0']?.rawValue).toBe('Bob');
      expect(result.cells['2:1']?.rawValue).toBe('35');
      expect(result.cells['2:2']?.rawValue).toBe('Chicago');

      // Charlie should still be with 30 and NYC
      expect(result.cells['3:0']?.rawValue).toBe('Charlie');
      expect(result.cells['3:1']?.rawValue).toBe('30');
      expect(result.cells['3:2']?.rawValue).toBe('NYC');
    });
  });

  describe('sortRange - formula adjustment', () => {
    it('adjusts formula references after vertical sort', () => {
      const sheet = createTestSheet();
      // Row 1: =A1 (points to row 0, which is outside sort range)
      // Row 2: =A2 (points to self)
      // Row 3: =A3 (points to self)
      sheet.cells['1:1'] = makeCell('=A1');
      sheet.cells['2:1'] = makeCell('=A2');
      sheet.cells['3:1'] = makeCell('=A3');

      // Sort by column B (all empty, so no movement - formulas unchanged)
      const result = sortRange(sheet, 1, 3, [{ column: 0, direction: 'asc' }]);

      // No movement expected since column 0 is empty for all
      expect(result.cells['1:1']?.rawValue).toBe('=A1');
      expect(result.cells['2:1']?.rawValue).toBe('=A2');
      expect(result.cells['3:1']?.rawValue).toBe('=A3');
    });

    it('adjusts formula when row moves', () => {
      const sheet = createTestSheet();
      // Sort by column A, row 2 moves to row 1
      sheet.cells['1:0'] = makeCell('B');
      sheet.cells['1:1'] = makeCell('=A2'); // Points to A2 (value A)
      sheet.cells['2:0'] = makeCell('A');
      sheet.cells['2:1'] = makeCell('=A3'); // Points to A3 (value C)
      sheet.cells['3:0'] = makeCell('C');
      sheet.cells['3:1'] = makeCell('=A1'); // Points to A1 (value B)

      // Sort ascending by column A: A, B, C -> row 2 becomes row 1, row 1 becomes row 2, row 3 stays
      const result = sortRange(sheet, 1, 3, [{ column: 0, direction: 'asc' }]);

      // After sort:
      // Row 1: A (was row 2), =A3 -> =A1 (ref adjusted from A3 to A1 because row moved from 2 to 1, delta=-1)
      // Row 2: B (was row 1), =A2 -> =A2 (ref adjusted from A2 to A2 because row moved from 1 to 2, delta=+1)
      // Row 3: C (was row 3), =A1 -> =A3 (ref adjusted from A1 to A3 because row stayed at 3)
      // Wait, let me think again...
      // Original: row2 has =A3 (refers to row 3). After sort, row2 is at row 1. So =A3 becomes =A1 (row offset = 1-2 = -1)
      // Original: row1 has =A2 (refers to row 2). After sort, row1 is at row 2. So =A2 becomes =A2 (row offset = 2-1 = +1, A2->A3... wait no)
      // Hmm, the formula references are adjusted by the row offset of the cell itself
      // If cell moves from row 2 to row 1 (delta=-1), its formula refs shift by -1
      // =A3 in original row 2 -> =A(3-1) = =A2? But the data in A3 (C) is now at row 1...
      // Actually, the formula should follow the data. When row 2 (with formula =A3) moves to row 1,
      // the formula should still refer to the same logical data. If A3 meant "the cell 1 row below me",
      // after moving up by 1 row, it should still refer to the cell 1 row below, which is now A2.

      // Let me just verify the behavior matches Excel: Excel adjusts relative refs so they still
      // point to the same relative position after the sort.

      // Actually, Excel adjusts formula references to maintain the SAME RELATIVE position.
      // If formula was =A2 and cell was at row 1 (refers to row 1+1=2),
      // after moving to row 2, it should =A3 (row 2+1=3).
      // But wait, that doesn't match what I'm seeing...

      // The current implementation uses adjustFormulaRefs which adjusts by the offset of the cell.
      // If cell moves from row 1 to row 2 (delta=+1), =A2 becomes =A3.
      // This is Excel behavior: the formula follows the cell's data relationships.

      // After sort ascending by col A: order becomes A(row2), B(row1), C(row3)
      // So new row 1 = old row 2, new row 2 = old row 1, new row 3 = old row 3
      // Old row 2 formula =A3 -> new row 1 formula =A(3 + (1-2)) = =A2
      // Old row 1 formula =A2 -> new row 2 formula =A(2 + (2-1)) = =A3
      // Old row 3 formula =A1 -> new row 3 formula =A(1 + (3-3)) = =A1

      expect(result.cells['1:0']?.rawValue).toBe('A');
      expect(result.cells['1:1']?.rawValue).toBe('=A2');
      expect(result.cells['2:0']?.rawValue).toBe('B');
      expect(result.cells['2:1']?.rawValue).toBe('=A3');
      expect(result.cells['3:0']?.rawValue).toBe('C');
      expect(result.cells['3:1']?.rawValue).toBe('=A1');
    });
  });

  describe('sortRange - edge cases', () => {
    it('returns same sheet for single row range', () => {
      const sheet = createTestSheet();
      sheet.cells['1:0'] = makeCell('Only');

      const result = sortRange(sheet, 1, 1, [{ column: 0, direction: 'asc' }]);
      expect(result).toBe(sheet);
    });

    it('returns same sheet for empty sort columns', () => {
      const sheet = createTestSheet();
      sheet.cells['1:0'] = makeCell('A');

      const result = sortRange(sheet, 1, 1, []);
      expect(result).toBe(sheet);
    });

    it('does not mutate original sheet', () => {
      const sheet = createTestSheet();
      sheet.cells['1:0'] = makeCell('B');
      sheet.cells['2:0'] = makeCell('A');

      const originalCells = { ...sheet.cells };
      sortRange(sheet, 1, 2, [{ column: 0, direction: 'asc' }]);

      expect(sheet.cells).toEqual(originalCells);
    });

    it('preserves cells outside sort range', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Header');
      sheet.cells['1:0'] = makeCell('B');
      sheet.cells['2:0'] = makeCell('A');
      sheet.cells['5:0'] = makeCell('Outside');

      const result = sortRange(sheet, 1, 2, [{ column: 0, direction: 'asc' }]);

      expect(result.cells['0:0']?.rawValue).toBe('Header');
      expect(result.cells['5:0']?.rawValue).toBe('Outside');
      expect(result.cells['1:0']?.rawValue).toBe('A');
      expect(result.cells['2:0']?.rawValue).toBe('B');
    });
  });

  describe('sortEntireSheet', () => {
    it('sorts entire sheet by column', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Header');
      sheet.cells['1:0'] = makeCell('Charlie');
      sheet.cells['2:0'] = makeCell('Alice');
      sheet.cells['3:0'] = makeCell('Bob');

      const result = sortEntireSheet(sheet, 0, 'asc', true);

      expect(result.cells['0:0']?.rawValue).toBe('Header');
      expect(result.cells['1:0']?.rawValue).toBe('Alice');
      expect(result.cells['2:0']?.rawValue).toBe('Bob');
      expect(result.cells['3:0']?.rawValue).toBe('Charlie');
    });

    it('returns same sheet for empty sheet', () => {
      const sheet = createTestSheet();
      const result = sortEntireSheet(sheet, 0, 'asc');
      expect(result).toBe(sheet);
    });
  });

  describe('sortSelection - selection types', () => {
    it('sorts entire sheet when single row is selected', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Charlie');
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['2:0'] = makeCell('Bob');

      // Single row selection (selectionStartRow === selectionEndRow)
      // This triggers sortEntireSheet by the active column
      const result = sortSelection(sheet, 1, 0, 1, 0, 'asc', false);

      // Should sort entire sheet by column 0
      expect(result.cells['0:0']?.rawValue).toBe('Alice');
      expect(result.cells['1:0']?.rawValue).toBe('Bob');
      expect(result.cells['2:0']?.rawValue).toBe('Charlie');
    });

    it('sorts entire sheet when column selection spans multiple columns', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Charlie');
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['2:0'] = makeCell('Bob');

      // Column selection (selectionStartCol !== selectionEndCol)
      // This triggers sortEntireSheet by the first column of selection
      const result = sortSelection(sheet, 0, 0, 2, 2, 'asc', false);

      // Should sort entire sheet by column 0
      expect(result.cells['0:0']?.rawValue).toBe('Alice');
      expect(result.cells['1:0']?.rawValue).toBe('Bob');
      expect(result.cells['2:0']?.rawValue).toBe('Charlie');
    });
  });

  // ─── Sort + Filter Integration ─────────────────────────────────────
  // When a sort is applied with an active filter, the filter's hiddenRows
  // (row indices) become stale because sortRange physically reorders rows.
  // The fix: recompute the filter against the sorted sheet.
  describe('sort + filter interaction', () => {
    it('recomputing filter after sort keeps hidden rows correct', () => {
      // Sheet: header row 0, data rows 1-4
      // Col A = category, Col B = value
      // Row 1: A=1, B=30   (visible — A=1)
      // Row 2: A=2, B=10   (hidden — A=2)
      // Row 3: A=1, B=40   (visible — A=1)
      // Row 4: A=2, B=20   (hidden — A=2)
      const sheet = createTestSheet();
      sheet.rowCount = 5;
      sheet.cells['0:0'] = makeCell('Category');
      sheet.cells['0:1'] = makeCell('Value');
      sheet.cells['1:0'] = makeCell('1');
      sheet.cells['1:1'] = makeCell('30');
      sheet.cells['2:0'] = makeCell('2');
      sheet.cells['2:1'] = makeCell('10');
      sheet.cells['3:0'] = makeCell('1');
      sheet.cells['3:1'] = makeCell('40');
      sheet.cells['4:0'] = makeCell('2');
      sheet.cells['4:1'] = makeCell('20');

      // Filter: show only rows where column A = "1"
      const filterCols: Record<number, import('./sheetFilter').ColumnFilter> = {
        0: { conditions: [{ type: 'equals', value: '1' }] },
      };
      const filterBefore = createFilterState(sheet, 0, filterCols);
      // Rows 2 and 4 (category=2) should be hidden
      expect(filterBefore.hiddenRows).toEqual(new Set([2, 4]));

      // Sort by column B (Value) ascending (header pinned)
      const sorted = sortRange(sheet, 0, 4, [{ column: 1, direction: 'asc' }], true);

      // After sort (header pinned, data sorted by B):
      // Row 0: header (stays)
      // Row 1: A=2, B=10  (was row 2)
      // Row 2: A=2, B=20  (was row 4)
      // Row 3: A=1, B=30  (was row 1)
      // Row 4: A=1, B=40  (was row 3)
      expect(sorted.cells['1:1']?.rawValue).toBe('10');
      expect(sorted.cells['2:1']?.rawValue).toBe('20');
      expect(sorted.cells['3:1']?.rawValue).toBe('30');
      expect(sorted.cells['4:1']?.rawValue).toBe('40');

      // THE BUG: old hiddenRows {2, 4} would now:
      //   - hide row 2 (A=2, B=20) — correct by luck
      //   - hide row 4 (A=1, B=40) — WRONG (A=1 should be visible!)
      //   - NOT hide row 1 (A=2, B=10) — WRONG (A=2 should be hidden!)
      expect(filterBefore.hiddenRows.has(1)).toBe(false); // bug: row 1 not hidden
      expect(filterBefore.hiddenRows.has(4)).toBe(true);  // bug: row 4 wrongly hidden

      // THE FIX: recompute filter against the sorted sheet
      const filterAfter = createFilterState(sorted, 0, filterCols);
      // Rows with category=2 are now at positions 1 and 2
      expect(filterAfter.hiddenRows).toEqual(new Set([1, 2]));
      expect(filterAfter.hiddenRows.has(1)).toBe(true);  // correct: row 1 now hidden
      expect(filterAfter.hiddenRows.has(4)).toBe(false); // correct: row 4 now visible
    });

    it('filter recomputation is stable across multiple sorts', () => {
      const sheet = createTestSheet();
      sheet.rowCount = 4;
      sheet.cells['0:0'] = makeCell('Header');
      sheet.cells['1:0'] = makeCell('B');
      sheet.cells['2:0'] = makeCell('A');
      sheet.cells['3:0'] = makeCell('C');

      const filterCols: Record<number, import('./sheetFilter').ColumnFilter> = {
        0: { conditions: [{ type: 'equals', value: 'A' }] },
      };

      // Ascending sort by col 0 (header pinned): A, B, C
      const sortedAsc = sortRange(sheet, 0, 3, [{ column: 0, direction: 'asc' }], true);
      const filterAsc = createFilterState(sortedAsc, 0, filterCols);
      // Row 0 = header, Row 1 = A (visible), Row 2 = B (hidden), Row 3 = C (hidden)
      expect(sortedAsc.cells['1:0']?.rawValue).toBe('A');
      expect(filterAsc.hiddenRows).toEqual(new Set([2, 3]));

      // Descending sort by col 0 (header pinned): C, B, A
      const sortedDesc = sortRange(sheet, 0, 3, [{ column: 0, direction: 'desc' }], true);
      const filterDesc = createFilterState(sortedDesc, 0, filterCols);
      // Row 0 = header, Row 1 = C (hidden), Row 2 = B (hidden), Row 3 = A (visible)
      expect(sortedDesc.cells['3:0']?.rawValue).toBe('A');
      expect(filterDesc.hiddenRows).toEqual(new Set([1, 2]));
    });
  });
});
