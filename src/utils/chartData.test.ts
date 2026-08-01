// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  parseCellRef,
  parseRange,
  parseRangeWithSheet,
  getCellValue,
  tryParseNumber,
  extractChartData,
  extractChartDataFromWorkbook,
  getMinMax,
  getPieData,
  generateColors,
  findDataRange,
  findSheetByName,
} from './chartData';
import type { Workbook } from '../types';
import type { Sheet } from '../types';

/**
 * Helper to create a test sheet.
 */
function createTestSheet(cells: Record<string, { rawValue: string; computedValue?: string | number }>): Sheet {
  return {
    id: 'test-sheet',
    name: 'Test',
    cells: Object.fromEntries(
      Object.entries(cells).map(([k, v]) => [k, { rawValue: v.rawValue, computedValue: v.computedValue ?? v.rawValue }])
    ),
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

describe('parseCellRef', () => {
  it('parses single-letter column', () => {
    expect(parseCellRef('A1')).toEqual({ row: 0, col: 0 });
    expect(parseCellRef('B3')).toEqual({ row: 2, col: 1 });
    expect(parseCellRef('Z10')).toEqual({ row: 9, col: 25 });
  });

  it('parses multi-letter column', () => {
    expect(parseCellRef('AA1')).toEqual({ row: 0, col: 26 });
    expect(parseCellRef('AB5')).toEqual({ row: 4, col: 27 });
  });

  it('handles absolute references', () => {
    expect(parseCellRef('$A$1')).toEqual({ row: 0, col: 0 });
    expect(parseCellRef('$B$3')).toEqual({ row: 2, col: 1 });
  });

  it('returns -1 for invalid refs', () => {
    expect(parseCellRef('invalid')).toEqual({ row: -1, col: -1 });
    expect(parseCellRef('')).toEqual({ row: -1, col: -1 });
  });
});

describe('parseRange', () => {
  it('parses standard range', () => {
    expect(parseRange('A1:B5')).toEqual({ startRow: 0, endRow: 4, startCol: 0, endCol: 1 });
  });

  it('parses single cell range', () => {
    expect(parseRange('C3')).toEqual({ startRow: 2, endRow: 2, startCol: 2, endCol: 2 });
  });

  it('handles reversed ranges', () => {
    expect(parseRange('B5:A1')).toEqual({ startRow: 0, endRow: 4, startCol: 0, endCol: 1 });
  });

  it('parses larger ranges', () => {
    expect(parseRange('A1:D10')).toEqual({ startRow: 0, endRow: 9, startCol: 0, endCol: 3 });
  });
});

describe('getCellValue', () => {
  const sheet = createTestSheet({
    '0:0': { rawValue: 'Hello' },
    '1:0': { rawValue: '42', computedValue: 42 },
    '2:0': { rawValue: '3.14', computedValue: 3.14 },
  });

  it('returns rawValue for text cells', () => {
    expect(getCellValue(sheet, 0, 0)).toBe('Hello');
  });

  it('returns computedValue for numeric cells', () => {
    expect(getCellValue(sheet, 1, 0)).toBe('42');
    expect(getCellValue(sheet, 2, 0)).toBe('3.14');
  });

  it('returns empty string for missing cells', () => {
    expect(getCellValue(sheet, 99, 99)).toBe('');
  });
});

describe('tryParseNumber', () => {
  it('parses integers', () => {
    expect(tryParseNumber('42')).toBe(42);
    expect(tryParseNumber('-10')).toBe(-10);
  });

  it('parses decimals', () => {
    expect(tryParseNumber('3.14')).toBe(3.14);
    expect(tryParseNumber('0.5')).toBe(0.5);
  });

  it('returns null for non-numeric strings', () => {
    expect(tryParseNumber('hello')).toBeNull();
    expect(tryParseNumber('')).toBeNull();
    expect(tryParseNumber('  ')).toBeNull();
  });

  it('handles whitespace', () => {
    expect(tryParseNumber(' 42 ')).toBe(42);
  });
});

describe('extractChartData', () => {
  it('extracts data with header row and category column', () => {
    const sheet = createTestSheet({
      '0:0': { rawValue: 'Month' },
      '0:1': { rawValue: 'Sales' },
      '0:2': { rawValue: 'Profit' },
      '1:0': { rawValue: 'Jan' },
      '1:1': { rawValue: '100', computedValue: 100 },
      '1:2': { rawValue: '20', computedValue: 20 },
      '2:0': { rawValue: 'Feb' },
      '2:1': { rawValue: '150', computedValue: 150 },
      '2:2': { rawValue: '30', computedValue: 30 },
    });

    const data = extractChartData(sheet, 'A1:C3');
    expect(data.categories).toEqual(['Jan', 'Feb']);
    expect(data.series).toHaveLength(2);
    expect(data.series[0].label).toBe('Sales');
    expect(data.series[0].values).toEqual([100, 150]);
    expect(data.series[1].label).toBe('Profit');
    expect(data.series[1].values).toEqual([20, 30]);
  });

  it('extracts data without header row', () => {
    const sheet = createTestSheet({
      '0:0': { rawValue: '100', computedValue: 100 },
      '0:1': { rawValue: '10', computedValue: 10 },
      '1:0': { rawValue: '200', computedValue: 200 },
      '1:1': { rawValue: '20', computedValue: 20 },
    });

    const data = extractChartData(sheet, 'A1:B2');
    expect(data.categories).toEqual(['1', '2']);
    expect(data.series[0].values).toEqual([100, 200]);
    expect(data.series[1].values).toEqual([10, 20]);
  });

  it('handles numeric-only data (no headers)', () => {
    const sheet = createTestSheet({
      '0:0': { rawValue: '10', computedValue: 10 },
      '0:1': { rawValue: '20', computedValue: 20 },
      '1:0': { rawValue: '30', computedValue: 30 },
      '1:1': { rawValue: '40', computedValue: 40 },
    });

    const data = extractChartData(sheet, 'A1:B2');
    expect(data.categories).toEqual(['1', '2']);
    expect(data.series).toHaveLength(2);
  });

  it('handles empty cells as null', () => {
    const sheet = createTestSheet({
      '0:0': { rawValue: 'A' },
      '0:1': { rawValue: '10', computedValue: 10 },
      '1:0': { rawValue: 'B' },
      '1:1': { rawValue: '', computedValue: '' },
    });

    const data = extractChartData(sheet, 'A1:B2');
    // First row is header (A is non-numeric), first col is category
    expect(data.categories).toEqual(['B']);
    expect(data.series[0].values).toEqual([null]);
  });

  it('returns empty data for invalid range', () => {
    const sheet = createTestSheet({});
    const data = extractChartData(sheet, 'invalid');
    expect(data.categories).toEqual([]);
    expect(data.series).toEqual([]);
  });

  it('handles single column (pie chart data)', () => {
    const sheet = createTestSheet({
      '0:0': { rawValue: 'Category' },
      '0:1': { rawValue: 'Value' },
      '1:0': { rawValue: 'A' },
      '1:1': { rawValue: '30', computedValue: 30 },
      '2:0': { rawValue: 'B' },
      '2:1': { rawValue: '70', computedValue: 70 },
    });

    const data = extractChartData(sheet, 'A1:B3');
    expect(data.categories).toEqual(['A', 'B']);
    expect(data.series[0].values).toEqual([30, 70]);
  });
});

describe('getMinMax', () => {
  it('returns correct min and max', () => {
    const data = {
      categories: ['A', 'B', 'C'],
      series: [{ label: 'S1', values: [10, 20, 30] }],
    };
    expect(getMinMax(data)).toEqual({ min: 10, max: 30 });
  });

  it('handles negative values', () => {
    const data = {
      categories: ['A', 'B'],
      series: [{ label: 'S1', values: [-10, 5] }],
    };
    expect(getMinMax(data)).toEqual({ min: -10, max: 5 });
  });

  it('handles null values', () => {
    const data = {
      categories: ['A', 'B'],
      series: [{ label: 'S1', values: [10, null] }],
    };
    // Single value 10 → min=0, max=11 (zero-range expansion)
    expect(getMinMax(data)).toEqual({ min: 0, max: 11 });
  });

  it('returns default range for empty data', () => {
    const data = { categories: [], series: [] };
    expect(getMinMax(data)).toEqual({ min: 0, max: 1 });
  });

  it('handles single value (zero range)', () => {
    const data = {
      categories: ['A'],
      series: [{ label: 'S1', values: [42] }],
    };
    expect(getMinMax(data)).toEqual({ min: 0, max: 43 });
  });

  it('handles multiple series', () => {
    const data = {
      categories: ['A', 'B'],
      series: [
        { label: 'S1', values: [10, 50] },
        { label: 'S2', values: [20, 30] },
      ],
    };
    expect(getMinMax(data)).toEqual({ min: 10, max: 50 });
  });
});

describe('getPieData', () => {
  it('calculates percentages correctly', () => {
    const data = {
      categories: ['A', 'B', 'C'],
      series: [{ label: 'S1', values: [30, 20, 50] }],
    };
    const pie = getPieData(data);
    expect(pie).toEqual([
      { label: 'A', value: 30, percent: 30 },
      { label: 'B', value: 20, percent: 20 },
      { label: 'C', value: 50, percent: 50 },
    ]);
  });

  it('handles zero total', () => {
    const data = {
      categories: ['A', 'B'],
      series: [{ label: 'S1', values: [0, 0] }],
    };
    const pie = getPieData(data);
    expect(pie[0].percent).toBe(0);
    expect(pie[1].percent).toBe(0);
  });

  it('handles single category', () => {
    const data = {
      categories: ['Only'],
      series: [{ label: 'S1', values: [100] }],
    };
    const pie = getPieData(data);
    expect(pie[0].percent).toBe(100);
  });
});

describe('generateColors', () => {
  it('generates requested number of colors', () => {
    expect(generateColors(3)).toHaveLength(3);
    expect(generateColors(5)).toHaveLength(5);
  });

  it('cycles palette when count exceeds palette size', () => {
    const colors = generateColors(15);
    expect(colors).toHaveLength(15);
    // First and 13th should be same (palette has 12 colors)
    expect(colors[0]).toBe(colors[12]);
  });

  it('returns valid hex colors', () => {
    const colors = generateColors(5);
    for (const c of colors) {
      expect(c).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe('findDataRange', () => {
  it('finds range for populated sheet', () => {
    const sheet = createTestSheet({
      '0:0': { rawValue: 'A1' },
      '0:2': { rawValue: 'C1' },
      '4:0': { rawValue: 'A5' },
    });
    expect(findDataRange(sheet)).toBe('A1:C5');
  });

  it('returns empty string for empty sheet', () => {
    const sheet = createTestSheet({});
    expect(findDataRange(sheet)).toBe('');
  });

  it('handles single cell', () => {
    const sheet = createTestSheet({
      '2:3': { rawValue: 'D3' },
    });
    expect(findDataRange(sheet)).toBe('D3:D3');
  });
});

describe('parseRangeWithSheet', () => {
  it('parses range without sheet name', () => {
    const result = parseRangeWithSheet('A1:B10');
    expect(result.sheetName).toBeUndefined();
    expect(result.startRow).toBe(0);
    expect(result.endRow).toBe(9);
    expect(result.startCol).toBe(0);
    expect(result.endCol).toBe(1);
  });

  it('parses range with simple sheet name', () => {
    const result = parseRangeWithSheet('Sales!A1:B10');
    expect(result.sheetName).toBe('Sales');
    expect(result.startRow).toBe(0);
    expect(result.endRow).toBe(9);
  });

  it('parses range with quoted sheet name', () => {
    const result = parseRangeWithSheet("'My Sheet'!A1:B10");
    expect(result.sheetName).toBe('My Sheet');
    expect(result.startRow).toBe(0);
    expect(result.endRow).toBe(9);
  });

  it('parses range with underscore sheet name', () => {
    const result = parseRangeWithSheet('Sheet_1!C5:D10');
    expect(result.sheetName).toBe('Sheet_1');
    expect(result.startCol).toBe(2);
    expect(result.endCol).toBe(3);
  });

  it('handles single cell with sheet name', () => {
    const result = parseRangeWithSheet('Data!B3');
    expect(result.sheetName).toBe('Data');
    expect(result.startRow).toBe(2);
    expect(result.endRow).toBe(2);
    expect(result.startCol).toBe(1);
    expect(result.endCol).toBe(1);
  });
});

describe('findSheetByName', () => {
  const workbook: Workbook = {
    id: 'wb1',
    title: 'Test',
    sheets: [
      { id: 's1', name: 'Sheet1', cells: {}, defaultColWidth: 100, defaultRowHeight: 28, columnWidths: {}, rowHeights: {}, columnCount: 26, rowCount: 100, frozenColumns: 0, frozenRows: 0 },
      { id: 's2', name: 'Sales Data', cells: {}, defaultColWidth: 100, defaultRowHeight: 28, columnWidths: {}, rowHeights: {}, columnCount: 26, rowCount: 100, frozenColumns: 0, frozenRows: 0 },
      { id: 's3', name: 'Q3 Report', cells: {}, defaultColWidth: 100, defaultRowHeight: 28, columnWidths: {}, rowHeights: {}, columnCount: 26, rowCount: 100, frozenColumns: 0, frozenRows: 0 },
    ],
    activeSheetIndex: 0,
    lastModified: 0,
  };

  it('finds sheet by exact name', () => {
    expect(findSheetByName(workbook, 'Sheet1')).toBe(workbook.sheets[0]);
    expect(findSheetByName(workbook, 'Q3 Report')).toBe(workbook.sheets[2]);
  });

  it('finds sheet by case-insensitive name', () => {
    expect(findSheetByName(workbook, 'sheet1')).toBe(workbook.sheets[0]);
    expect(findSheetByName(workbook, 'SALES DATA')).toBe(workbook.sheets[1]);
  });

  it('returns undefined for non-existent sheet', () => {
    expect(findSheetByName(workbook, 'NonExistent')).toBeUndefined();
  });
});

describe('extractChartDataFromWorkbook', () => {
  const workbook: Workbook = {
    id: 'wb1',
    title: 'Test',
    sheets: [
      {
        id: 's1', name: 'Sheet1', cells: {
          '0:0': { rawValue: 'Month', computedValue: 'Month' },
          '0:1': { rawValue: 'Sales', computedValue: 'Sales' },
          '1:0': { rawValue: 'Jan', computedValue: 'Jan' },
          '1:1': { rawValue: '100', computedValue: 100 },
          '2:0': { rawValue: 'Feb', computedValue: 'Feb' },
          '2:1': { rawValue: '200', computedValue: 200 },
        },
        defaultColWidth: 100, defaultRowHeight: 28, columnWidths: {}, rowHeights: {},
        columnCount: 26, rowCount: 100, frozenColumns: 0, frozenRows: 0,
      },
      {
        id: 's2', name: 'Data', cells: {
          '0:0': { rawValue: 'Q1', computedValue: 'Q1' },
          '0:1': { rawValue: '50', computedValue: 50 },
          '1:0': { rawValue: 'Q2', computedValue: 'Q2' },
          '1:1': { rawValue: '75', computedValue: 75 },
        },
        defaultColWidth: 100, defaultRowHeight: 28, columnWidths: {}, rowHeights: {},
        columnCount: 26, rowCount: 100, frozenColumns: 0, frozenRows: 0,
      },
    ],
    activeSheetIndex: 0,
    lastModified: 0,
  };

  it('extracts data from active sheet when no sheet name', () => {
    const data = extractChartDataFromWorkbook(workbook, 'A1:B3');
    expect(data.categories).toEqual(['Jan', 'Feb']);
    expect(data.series[0].values).toEqual([100, 200]);
  });

  it('extracts data from named sheet', () => {
    // Data sheet has Q1/50 in row 0, Q2/75 in row 1
    // Row 0 (Q1, 50) detected as header; col 0 (Q1, Q2) as categories
    const data = extractChartDataFromWorkbook(workbook, 'Data!A1:B2');
    expect(data.categories).toEqual(['Q2']);
    expect(data.series[0].values).toEqual([75]);
  });

  it('extracts from named sheet with explicit header', () => {
    const workbookWithHeader: Workbook = {
      ...workbook,
      sheets: [
        workbook.sheets[0],
        {
          ...workbook.sheets[1],
          cells: {
            '0:0': { rawValue: 'Quarter', computedValue: 'Quarter' },
            '0:1': { rawValue: 'Revenue', computedValue: 'Revenue' },
            '1:0': { rawValue: 'Q1', computedValue: 'Q1' },
            '1:1': { rawValue: '50', computedValue: 50 },
            '2:0': { rawValue: 'Q2', computedValue: 'Q2' },
            '2:1': { rawValue: '75', computedValue: 75 },
          },
        },
      ],
    };
    const data = extractChartDataFromWorkbook(workbookWithHeader, 'Data!A1:C3');
    expect(data.categories).toEqual(['Q1', 'Q2']);
    expect(data.series[0].label).toBe('Revenue');
    expect(data.series[0].values).toEqual([50, 75]);
  });

  it('returns empty data for non-existent sheet', () => {
    const data = extractChartDataFromWorkbook(workbook, 'NonExistent!A1:B3');
    expect(data.categories).toEqual([]);
    expect(data.series).toEqual([]);
  });
});
