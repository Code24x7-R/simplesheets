import { computeFillRange } from './fillRange';
import type { Sheet } from '../types';

function createTestSheet(overrides: Partial<Sheet> = {}): Sheet {
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
    ...overrides,
  };
}

describe('computeFillRange', () => {
  describe('1D horizontal fill', () => {
    it('fills horizontal numeric series', () => {
      const sheet = createTestSheet({
        cells: {
          '0:0': { rawValue: '1' },
          '0:1': { rawValue: '2' },
          '0:2': { rawValue: '3' },
        },
      });
      const result = computeFillRange(sheet, 0, 0, 0, 2, 0, 5);
      expect(result).toEqual([
        { row: 0, col: 3, value: '4' },
        { row: 0, col: 4, value: '5' },
        { row: 0, col: 5, value: '6' },
      ]);
    });

    it('fills horizontal date series', () => {
      const sheet = createTestSheet({
        cells: {
          '0:0': { rawValue: '2024-01-01' },
          '0:1': { rawValue: '2024-01-02' },
          '0:2': { rawValue: '2024-01-03' },
        },
      });
      const result = computeFillRange(sheet, 0, 0, 0, 2, 0, 4);
      expect(result).toEqual([
        { row: 0, col: 3, value: '2024-01-04' },
        { row: 0, col: 4, value: '2024-01-05' },
      ]);
    });
  });

  describe('1D vertical fill', () => {
    it('fills vertical numeric series', () => {
      const sheet = createTestSheet({
        cells: {
          '0:0': { rawValue: '1' },
          '1:0': { rawValue: '2' },
          '2:0': { rawValue: '3' },
        },
      });
      const result = computeFillRange(sheet, 0, 0, 2, 0, 5, 0);
      expect(result).toEqual([
        { row: 3, col: 0, value: '4' },
        { row: 4, col: 0, value: '5' },
        { row: 5, col: 0, value: '6' },
      ]);
    });
  });

  describe('2D range fill', () => {
    it('fills 2D range vertically', () => {
      const sheet = createTestSheet({
        cells: {
          '0:0': { rawValue: '1' },
          '0:1': { rawValue: '10' },
          '1:0': { rawValue: '2' },
          '1:1': { rawValue: '20' },
          '2:0': { rawValue: '3' },
          '2:1': { rawValue: '30' },
        },
      });
      const result = computeFillRange(sheet, 0, 0, 2, 1, 5, 1);
      // Each column should be filled independently
      expect(result).toEqual([
        { row: 3, col: 0, value: '4' },
        { row: 3, col: 1, value: '40' },
        { row: 4, col: 0, value: '5' },
        { row: 4, col: 1, value: '50' },
        { row: 5, col: 0, value: '6' },
        { row: 5, col: 1, value: '60' },
      ]);
    });

    it('fills 2D range horizontally', () => {
      const sheet = createTestSheet({
        cells: {
          '0:0': { rawValue: '1' },
          '0:1': { rawValue: '2' },
          '0:2': { rawValue: '3' },
          '1:0': { rawValue: '10' },
          '1:1': { rawValue: '20' },
          '1:2': { rawValue: '30' },
        },
      });
      const result = computeFillRange(sheet, 0, 0, 1, 2, 1, 5);
      // Each row should be filled independently
      expect(result).toEqual([
        { row: 0, col: 3, value: '4' },
        { row: 0, col: 4, value: '5' },
        { row: 0, col: 5, value: '6' },
        { row: 1, col: 3, value: '40' },
        { row: 1, col: 4, value: '50' },
        { row: 1, col: 5, value: '60' },
      ]);
    });
  });

  describe('filtered rows', () => {
    it('skips hidden rows when filling vertically', () => {
      const sheet = createTestSheet({
        cells: {
          '0:0': { rawValue: '1' },
          '1:0': { rawValue: '2' },
          '2:0': { rawValue: '3' },
        },
      });
      const hiddenRows = new Set([3, 4]); // Rows 3 and 4 are hidden
      const result = computeFillRange(sheet, 0, 0, 2, 0, 6, 0, hiddenRows);
      // Should skip rows 3 and 4, fill rows 5 and 6
      expect(result).toEqual([
        { row: 5, col: 0, value: '4' },
        { row: 6, col: 0, value: '5' },
      ]);
    });

    it('does not skip rows when no hidden rows', () => {
      const sheet = createTestSheet({
        cells: {
          '0:0': { rawValue: '1' },
          '1:0': { rawValue: '2' },
          '2:0': { rawValue: '3' },
        },
      });
      const result = computeFillRange(sheet, 0, 0, 2, 0, 5, 0, new Set());
      expect(result).toEqual([
        { row: 3, col: 0, value: '4' },
        { row: 4, col: 0, value: '5' },
        { row: 5, col: 0, value: '6' },
      ]);
    });

    it('skips hidden rows when filling horizontally', () => {
      const sheet = createTestSheet({
        cells: {
          '0:0': { rawValue: '1' },
          '0:1': { rawValue: '2' },
          '0:2': { rawValue: '3' },
        },
      });
      // Horizontal fill doesn't use row skipping (only vertical does)
      const result = computeFillRange(sheet, 0, 0, 0, 2, 0, 5, new Set([0]));
      expect(result).toEqual([
        { row: 0, col: 3, value: '4' },
        { row: 0, col: 4, value: '5' },
        { row: 0, col: 5, value: '6' },
      ]);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for unknown pattern', () => {
      const sheet = createTestSheet({
        cells: {
          '0:0': { rawValue: 'abc' },
          '0:1': { rawValue: 'def' },
          '0:2': { rawValue: 'ghi' },
        },
      });
      const result = computeFillRange(sheet, 0, 0, 0, 2, 0, 5);
      expect(result).toEqual([]);
    });

    it('returns empty for single cell source (needs 3+ for pattern)', () => {
      const sheet = createTestSheet({
        cells: {
          '0:0': { rawValue: '1' },
        },
      });
      const result = computeFillRange(sheet, 0, 0, 0, 0, 3, 0);
      // Single cell — computeFillSeries requires 3+ cells, so no fill
      expect(result).toEqual([]);
    });

    it('respects target bounds', () => {
      const sheet = createTestSheet({
        cells: {
          '0:0': { rawValue: '1' },
          '1:0': { rawValue: '2' },
          '2:0': { rawValue: '3' },
        },
        rowCount: 5,
      });
      const result = computeFillRange(sheet, 0, 0, 2, 0, 10, 0);
      // Should clamp to rowCount - 1 = 4
      expect(result.every((c) => c.row < 5)).toBe(true);
    });
  });
});
