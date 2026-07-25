/**
 * Tests for sheetSearch utility — search & replace engine.
 */
import { searchSheets, replaceInSheets } from './sheetSearch';
import type { Workbook } from '../types';

// ════════════════════════════════════════════════════════════════
// Fixtures
// ════════════════════════════════════════════════════════════════

function makeWorkbook(): Workbook {
  const sheet = (name: string, cells: Record<string, { rawValue: string }>) => ({
    id: `sheet-${name}`,
    name,
    rowCount: 100,
    columnCount: 26,
    defaultColWidth: 80,
    defaultRowHeight: 24,
    columnWidths: {},
    rowHeights: {},
    frozenRows: 0,
    frozenColumns: 0,
    cells,
  });
  return {
    id: 'wb-1',
    title: 'Test',
    activeSheetIndex: 0,
    sheets: [
      sheet('Sheet1', {
        '0:0': { rawValue: 'hello' },
        '0:1': { rawValue: 'world' },
        '0:2': { rawValue: 'Hello World' },
        '0:3': { rawValue: '=SUM(A1:B1)' },
        '0:4': { rawValue: 'foo' },
        '0:5': { rawValue: 'foobar' },
      }),
      sheet('Sheet2', {
        '0:0': { rawValue: 'HELLO' },
        '0:1': { rawValue: 'hello again' },
        '0:2': { rawValue: '=A1+B1' },
      }),
    ],
    lastModified: Date.now(),
  };
}

// ════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════

describe('searchSheets', () => {
  it('counts matches on the active sheet (default)', () => {
    const wb = makeWorkbook();
    const result = searchSheets(wb, 0, { query: 'hello', caseSensitive: false, matchEntire: false });
    // "hello", "Hello World" on sheet1 = 2 matches (formula not included by default)
    expect(result.matches).toBe(2);
  });

  it('respects caseSensitive=true', () => {
    const wb = makeWorkbook();
    const result = searchSheets(wb, 0, { query: 'hello', caseSensitive: true, matchEntire: false });
    // Only exact-case "hello" on sheet1
    expect(result.matches).toBe(1);
  });

  it('respects matchEntire=true', () => {
    const wb = makeWorkbook();
    const result = searchSheets(wb, 0, { query: 'hello', caseSensitive: false, matchEntire: true });
    // Only cells whose entire value is "hello" (case-insensitive)
    expect(result.matches).toBe(1);
  });

  it('includes formulas when alsoInFormulas=true', () => {
    const wb = makeWorkbook();
    const result = searchSheets(wb, 0, { query: 'SUM', caseSensitive: false, matchEntire: false, alsoInFormulas: true });
    // Only "=SUM(A1:B1)" on sheet1
    expect(result.matches).toBe(1);
  });

  it('excludes formulas when alsoInFormulas is unset', () => {
    const wb = makeWorkbook();
    const result = searchSheets(wb, 0, { query: 'SUM', caseSensitive: false, matchEntire: false });
    expect(result.matches).toBe(0);
  });

  it('returns 0 when query is empty', () => {
    const wb = makeWorkbook();
    const result = searchSheets(wb, 0, { query: '', caseSensitive: false, matchEntire: false });
    expect(result.matches).toBe(0);
  });

  it('does not count formulas as exact-match even with matchEntire=true', () => {
    const wb = makeWorkbook();
    const result = searchSheets(wb, 0, { query: '=SUM(A1:B1)', caseSensitive: true, matchEntire: true, alsoInFormulas: true });
    // Formula cells use substring mode, so "=SUM(A1:B1)" with query "=SUM(A1:B1)" still matches
    expect(result.matches).toBe(1);
  });
});

describe('replaceInSheets', () => {
  it('replaces across the active sheet only by default', () => {
    const wb = makeWorkbook();
    const result = replaceInSheets(wb, { query: 'hello', replacement: 'hi', caseSensitive: false, matchEntire: false });
    expect(result.totalReplaced).toBe(2);
    expect(result.sheetResults).toHaveLength(1);
    expect(result.sheetResults[0].sheetName).toBe('Sheet1');
    // Original workbook is not mutated
    expect(wb.sheets[0].cells['0:0'].rawValue).toBe('hello');
    // Updated sheets have the new value
    expect(result.updatedSheets[0].cells['0:0'].rawValue).toBe('hi');
    expect(result.updatedSheets[0].cells['0:2'].rawValue).toBe('hi World');
  });

  it('respects case-sensitive replacement', () => {
    const wb = makeWorkbook();
    const result = replaceInSheets(wb, { query: 'hello', replacement: 'hi', caseSensitive: true, matchEntire: false }, [0]);
    // Only exact-case "hello" → "hi"; "Hello World" stays unchanged
    expect(result.totalReplaced).toBe(1);
    expect(result.updatedSheets[0].cells['0:0'].rawValue).toBe('hi');
    expect(result.updatedSheets[0].cells['0:2'].rawValue).toBe('Hello World');
  });

  it('respects matchEntire — only cells whose whole value matches', () => {
    const wb = makeWorkbook();
    const result = replaceInSheets(wb, { query: 'hello', replacement: 'hi', caseSensitive: false, matchEntire: true }, [0]);
    expect(result.totalReplaced).toBe(1);
    expect(result.updatedSheets[0].cells['0:0'].rawValue).toBe('hi');
    // "Hello World" untouched because matchEntire=true
    expect(result.updatedSheets[0].cells['0:2'].rawValue).toBe('Hello World');
  });

  it('replaces in formulas when alsoInFormulas=true', () => {
    const wb = makeWorkbook();
    const result = replaceInSheets(
      wb,
      { query: 'SUM', replacement: 'TOTAL', caseSensitive: false, matchEntire: false, alsoInFormulas: true },
      [0],
    );
    expect(result.totalReplaced).toBe(1);
    expect(result.updatedSheets[0].cells['0:3'].rawValue).toBe('=TOTAL(A1:B1)');
  });

  it('does NOT replace in formulas when alsoInFormulas is unset', () => {
    const wb = makeWorkbook();
    const result = replaceInSheets(wb, { query: 'SUM', replacement: 'TOTAL', caseSensitive: false, matchEntire: false }, [0]);
    expect(result.totalReplaced).toBe(0);
    expect(result.updatedSheets[0].cells['0:3'].rawValue).toBe('=SUM(A1:B1)');
  });

  it('replaces across multiple sheets when sheetIndices provided', () => {
    const wb = makeWorkbook();
    const result = replaceInSheets(
      wb,
      { query: 'hello', replacement: 'hi', caseSensitive: false, matchEntire: false },
      [0, 1],
    );
    // Sheet1: "hello" + "Hello World" = 2
    // Sheet2: "HELLO" + "hello again" = 2
    expect(result.totalReplaced).toBe(4);
    expect(result.sheetResults).toHaveLength(2);
  });

  it('returns empty result when no matches', () => {
    const wb = makeWorkbook();
    const result = replaceInSheets(wb, { query: 'nonexistent', replacement: 'x', caseSensitive: false, matchEntire: false }, [0]);
    expect(result.totalReplaced).toBe(0);
    expect(result.sheetResults).toHaveLength(0);
    // updatedSheets is a shallow copy; unchanged sheets are the same refs
    expect(result.updatedSheets[0]).toBe(wb.sheets[0]);
  });

  it('handles empty cells gracefully', () => {
    const wb = makeWorkbook();
    wb.sheets[0].cells['0:6'] = { rawValue: '' };
    const result = replaceInSheets(wb, { query: 'hello', replacement: 'hi', caseSensitive: false, matchEntire: false }, [0]);
    expect(result.totalReplaced).toBe(2);
  });

  it('does not mutate the original workbook', () => {
    const wb = makeWorkbook();
    const originalCells = { ...wb.sheets[0].cells };
    replaceInSheets(wb, { query: 'hello', replacement: 'hi', caseSensitive: false, matchEntire: false }, [0]);
    expect(wb.sheets[0].cells).toEqual(originalCells);
  });
});
