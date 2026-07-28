import {
  computeHiddenRows,
  createFilterState,
  getUniqueValues,
  clearColumnFilter,
  clearAllFilters,
  isRowVisible,
  getVisibleRowIndices,
  displayToActualRow,
  actualToDisplayRow,
  type ColumnFilter,
} from './sheetFilter';
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

describe('sheetFilter', () => {
  describe('computeHiddenRows', () => {
    it('returns empty set when no filters', () => {
      const sheet = createTestSheet();
      const hidden = computeHiddenRows(sheet, 0, {});
      expect(hidden.size).toBe(0);
    });

    it('hides rows not matching includes filter', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['2:0'] = makeCell('Bob');
      sheet.cells['3:0'] = makeCell('Charlie');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'includes', values: ['Alice', 'Charlie'] }] },
      };

      const hidden = computeHiddenRows(sheet, 0, filters);
      expect(hidden.has(1)).toBe(false); // Alice visible
      expect(hidden.has(2)).toBe(true);  // Bob hidden
      expect(hidden.has(3)).toBe(false); // Charlie visible
      expect(hidden.has(0)).toBe(false); // Header never hidden
    });

    it('hides rows not matching contains filter', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Apple');
      sheet.cells['2:0'] = makeCell('Banana');
      sheet.cells['3:0'] = makeCell('Cherry');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'contains', value: 'an' }] },
      };

      const hidden = computeHiddenRows(sheet, 0, filters);
      expect(hidden.has(1)).toBe(true);  // Apple hidden
      expect(hidden.has(2)).toBe(false); // Banana visible (contains 'an')
      expect(hidden.has(3)).toBe(true);  // Cherry hidden
    });

    it('hides rows not matching greaterThan filter', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Score');
      sheet.cells['1:0'] = makeCell('85');
      sheet.cells['2:0'] = makeCell('70');
      sheet.cells['3:0'] = makeCell('90');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'greaterThan', value: 80 }] },
      };

      const hidden = computeHiddenRows(sheet, 0, filters);
      expect(hidden.has(1)).toBe(false); // 85 > 80 visible
      expect(hidden.has(2)).toBe(true);  // 70 <= 80 hidden
      expect(hidden.has(3)).toBe(false); // 90 > 80 visible
    });

    it('hides rows not matching lessThan filter', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Score');
      sheet.cells['1:0'] = makeCell('85');
      sheet.cells['2:0'] = makeCell('70');
      sheet.cells['3:0'] = makeCell('90');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'lessThan', value: 80 }] },
      };

      const hidden = computeHiddenRows(sheet, 0, filters);
      expect(hidden.has(1)).toBe(true);  // 85 >= 80 hidden
      expect(hidden.has(2)).toBe(false); // 70 < 80 visible
      expect(hidden.has(3)).toBe(true);  // 90 >= 80 hidden
    });

    it('hides empty rows when isNotEmpty filter applied', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['2:0'] = makeCell('');
      sheet.cells['3:0'] = makeCell('Bob');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'isNotEmpty' }] },
      };

      const hidden = computeHiddenRows(sheet, 0, filters);
      expect(hidden.has(1)).toBe(false); // Alice visible
      expect(hidden.has(2)).toBe(true);  // Empty hidden
      expect(hidden.has(3)).toBe(false); // Bob visible
    });

    it('hides non-empty rows when isEmpty filter applied', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['2:0'] = makeCell('');
      sheet.cells['3:0'] = makeCell('Bob');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'isEmpty' }] },
      };

      const hidden = computeHiddenRows(sheet, 0, filters);
      expect(hidden.has(1)).toBe(true);  // Alice hidden
      expect(hidden.has(2)).toBe(false); // Empty visible
      expect(hidden.has(3)).toBe(true);  // Bob hidden
    });

    it('applies equals filter case-insensitively', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('ALICE');
      sheet.cells['2:0'] = makeCell('alice');
      sheet.cells['3:0'] = makeCell('Bob');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'equals', value: 'Alice' }] },
      };

      const hidden = computeHiddenRows(sheet, 0, filters);
      expect(hidden.has(1)).toBe(false); // ALICE matches
      expect(hidden.has(2)).toBe(false); // alice matches
      expect(hidden.has(3)).toBe(true);  // Bob hidden
    });

    it('applies startsWith filter', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['2:0'] = makeCell('Bob');
      sheet.cells['3:0'] = makeCell('Alex');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'startsWith', value: 'Al' }] },
      };

      const hidden = computeHiddenRows(sheet, 0, filters);
      expect(hidden.has(1)).toBe(false); // Alice starts with Al
      expect(hidden.has(2)).toBe(true);  // Bob hidden
      expect(hidden.has(3)).toBe(false); // Alex starts with Al
    });

    it('applies endsWith filter', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['2:0'] = makeCell('Bob');
      sheet.cells['3:0'] = makeCell('Alex');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'endsWith', value: 'e' }] },
      };

      const hidden = computeHiddenRows(sheet, 0, filters);
      expect(hidden.has(1)).toBe(false); // Alice ends with e
      expect(hidden.has(2)).toBe(true);  // Bob hidden
      expect(hidden.has(3)).toBe(true);  // Alex hidden
    });

    it('applies notContains filter', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Apple');
      sheet.cells['2:0'] = makeCell('Banana');
      sheet.cells['3:0'] = makeCell('Cherry');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'notContains', value: 'a' }] },
      };

      const hidden = computeHiddenRows(sheet, 0, filters);
      expect(hidden.has(1)).toBe(true);  // Apple contains 'a'
      expect(hidden.has(2)).toBe(true);  // Banana contains 'a'
      expect(hidden.has(3)).toBe(false); // Cherry does not contain 'a'
    });

    it('applies notEquals filter', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['2:0'] = makeCell('Bob');
      sheet.cells['3:0'] = makeCell('Charlie');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'notEquals', value: 'Bob' }] },
      };

      const hidden = computeHiddenRows(sheet, 0, filters);
      expect(hidden.has(1)).toBe(false); // Alice != Bob, visible
      expect(hidden.has(2)).toBe(true);  // Bob == Bob, hidden
      expect(hidden.has(3)).toBe(false); // Charlie != Bob, visible
    });

    it('applies greaterOrEqual filter', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Score');
      sheet.cells['1:0'] = makeCell('80');
      sheet.cells['2:0'] = makeCell('79');
      sheet.cells['3:0'] = makeCell('81');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'greaterOrEqual', value: 80 }] },
      };

      const hidden = computeHiddenRows(sheet, 0, filters);
      expect(hidden.has(1)).toBe(false); // 80 >= 80 visible
      expect(hidden.has(2)).toBe(true);  // 79 < 80 hidden
      expect(hidden.has(3)).toBe(false); // 81 >= 80 visible
    });

    it('applies lessOrEqual filter', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Score');
      sheet.cells['1:0'] = makeCell('80');
      sheet.cells['2:0'] = makeCell('81');
      sheet.cells['3:0'] = makeCell('79');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'lessOrEqual', value: 80 }] },
      };

      const hidden = computeHiddenRows(sheet, 0, filters);
      expect(hidden.has(1)).toBe(false); // 80 <= 80 visible
      expect(hidden.has(2)).toBe(true);  // 81 > 80 hidden
      expect(hidden.has(3)).toBe(false); // 79 <= 80 visible
    });

    it('applies AND logic across multiple conditions', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['2:0'] = makeCell('Alex');
      sheet.cells['3:0'] = makeCell('Bob');

      const filters: Record<number, ColumnFilter> = {
        0: {
          conditions: [
            { type: 'startsWith', value: 'Al' },
            { type: 'endsWith', value: 'e' },
          ],
        },
      };

      const hidden = computeHiddenRows(sheet, 0, filters);
      expect(hidden.has(1)).toBe(false); // Alice: starts with Al AND ends with e
      expect(hidden.has(2)).toBe(true);  // Alex: starts with Al but doesn't end with e
      expect(hidden.has(3)).toBe(true);  // Bob: doesn't start with Al
    });

    it('applies AND logic across multiple columns', () => {
      const sheet = createTestSheet();
      sheet.rowCount = 4; // Only 4 rows
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['0:1'] = makeCell('Score');
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['1:1'] = makeCell('85');
      sheet.cells['2:0'] = makeCell('Bob');
      sheet.cells['2:1'] = makeCell('90');
      sheet.cells['3:0'] = makeCell('Alice');
      sheet.cells['3:1'] = makeCell('70');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'equals', value: 'Alice' }] },
        1: { conditions: [{ type: 'greaterThan', value: 80 }] },
      };

      const hidden = computeHiddenRows(sheet, 0, filters);
      expect(hidden.has(1)).toBe(false); // Alice + 85 > 80: visible
      expect(hidden.has(2)).toBe(true);  // Bob: hidden by name filter
      expect(hidden.has(3)).toBe(true);  // Alice + 70 <= 80: hidden by score filter
    });

    it('never hides header row', () => {
      const sheet = createTestSheet();
      sheet.rowCount = 2; // Only 2 rows
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Alice');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'equals', value: 'Bob' }] },
      };

      const hidden = computeHiddenRows(sheet, 0, filters);
      expect(hidden.has(0)).toBe(false); // Header never hidden
      expect(hidden.has(1)).toBe(true);  // Alice hidden
    });
  });

  describe('createFilterState', () => {
    it('creates filter state with correct counts', () => {
      const sheet = createTestSheet();
      sheet.rowCount = 4; // Only 4 rows for this test
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['2:0'] = makeCell('Bob');
      sheet.cells['3:0'] = makeCell('Charlie');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'includes', values: ['Alice'] }] },
      };

      const state = createFilterState(sheet, 0, filters);
      expect(state.active).toBe(true);
      expect(state.headerRow).toBe(0);
      expect(state.totalDataRows).toBe(3); // 4 - 0 - 1
      expect(state.visibleDataRows).toBe(1); // Only Alice visible
      expect(state.hiddenRows.has(2)).toBe(true); // Bob hidden
      expect(state.hiddenRows.has(3)).toBe(true); // Charlie hidden
    });

    it('returns inactive state when no filters', () => {
      const sheet = createTestSheet();
      const state = createFilterState(sheet, 0, {});
      expect(state.active).toBe(false);
      expect(state.hiddenRows.size).toBe(0);
    });
  });

  describe('getUniqueValues', () => {
    it('returns sorted unique values excluding header', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Charlie');
      sheet.cells['2:0'] = makeCell('Alice');
      sheet.cells['3:0'] = makeCell('Bob');
      sheet.cells['4:0'] = makeCell('Alice'); // Duplicate

      const values = getUniqueValues(sheet, 0, 0);
      expect(values).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('excludes empty values', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['2:0'] = makeCell('');
      sheet.cells['3:0'] = makeCell('Bob');

      const values = getUniqueValues(sheet, 0, 0);
      expect(values).toEqual(['Alice', 'Bob']);
    });

    it('returns empty array for empty column', () => {
      const sheet = createTestSheet();
      const values = getUniqueValues(sheet, 0, 0);
      expect(values).toEqual([]);
    });
  });

  describe('clearColumnFilter', () => {
    it('removes filter for specific column', () => {
      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'equals', value: 'Alice' }] },
        1: { conditions: [{ type: 'greaterThan', value: 80 }] },
      };

      const result = clearColumnFilter(filters, 0);
      expect(result[0]).toBeUndefined();
      expect(result[1]).toBeDefined();
    });
  });

  describe('clearAllFilters', () => {
    it('returns empty object', () => {
      const result = clearAllFilters();
      expect(Object.keys(result).length).toBe(0);
    });
  });

  describe('isRowVisible', () => {
    it('returns true when no filter state', () => {
      expect(isRowVisible(null, 5)).toBe(true);
    });

    it('returns true when filter not active', () => {
      const state = createFilterState(createTestSheet(), 0, {});
      expect(isRowVisible(state, 5)).toBe(true);
    });

    it('returns false for hidden row', () => {
      const sheet = createTestSheet();
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['2:0'] = makeCell('Bob');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'equals', value: 'Alice' }] },
      };

      const state = createFilterState(sheet, 0, filters);
      expect(isRowVisible(state, 1)).toBe(true);  // Alice visible
      expect(isRowVisible(state, 2)).toBe(false); // Bob hidden
    });
  });

  describe('getVisibleRowIndices', () => {
    it('returns all rows when no filter', () => {
      const rows = getVisibleRowIndices(null, 5);
      expect(rows).toEqual([0, 1, 2, 3, 4]);
    });

    it('returns only visible rows when filter active', () => {
      const sheet = createTestSheet();
      sheet.rowCount = 4; // Only 4 rows
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['2:0'] = makeCell('Bob');
      sheet.cells['3:0'] = makeCell('Charlie');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'includes', values: ['Alice', 'Charlie'] }] },
      };

      const state = createFilterState(sheet, 0, filters);
      const rows = getVisibleRowIndices(state, 4);
      expect(rows).toEqual([0, 1, 3]); // Bob (row 2) hidden
    });
  });

  describe('displayToActualRow', () => {
    it('returns same index when no filter', () => {
      expect(displayToActualRow(null, 3, 10)).toBe(3);
    });

    it('maps display index to actual row', () => {
      const sheet = createTestSheet();
      sheet.rowCount = 4; // Only 4 rows
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['2:0'] = makeCell('Bob');
      sheet.cells['3:0'] = makeCell('Charlie');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'includes', values: ['Alice', 'Charlie'] }] },
      };

      const state = createFilterState(sheet, 0, filters);
      // Visible rows: 0 (header), 1 (Alice), 3 (Charlie)
      expect(displayToActualRow(state, 0, 4)).toBe(0);
      expect(displayToActualRow(state, 1, 4)).toBe(1);
      expect(displayToActualRow(state, 2, 4)).toBe(3);
    });
  });

  describe('actualToDisplayRow', () => {
    it('returns same index when no filter', () => {
      expect(actualToDisplayRow(null, 3, 10)).toBe(3);
    });

    it('returns -1 for hidden row', () => {
      const sheet = createTestSheet();
      sheet.rowCount = 4; // Only 4 rows
      sheet.cells['0:0'] = makeCell('Name');
      sheet.cells['1:0'] = makeCell('Alice');
      sheet.cells['2:0'] = makeCell('Bob');
      sheet.cells['3:0'] = makeCell('Charlie');

      const filters: Record<number, ColumnFilter> = {
        0: { conditions: [{ type: 'includes', values: ['Alice', 'Charlie'] }] },
      };

      const state = createFilterState(sheet, 0, filters);
      expect(actualToDisplayRow(state, 0, 4)).toBe(0);  // Header visible
      expect(actualToDisplayRow(state, 1, 4)).toBe(1);  // Alice visible
      expect(actualToDisplayRow(state, 2, 4)).toBe(-1); // Bob hidden
      expect(actualToDisplayRow(state, 3, 4)).toBe(2);  // Charlie visible
    });
  });
});
