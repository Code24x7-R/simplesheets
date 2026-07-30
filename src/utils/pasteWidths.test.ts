import { extractColumnWidths, applyColumnWidths } from './pasteWidths';
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

describe('extractColumnWidths', () => {
  it('extracts custom widths for columns in range', () => {
    const sheet = createTestSheet({
      columnWidths: { 0: 150, 1: 200, 2: 120 },
    });
    const widths = extractColumnWidths(sheet, 0, 2);
    expect(widths).toEqual({ 0: 150, 1: 200, 2: 120 });
  });

  it('returns empty object when no custom widths', () => {
    const sheet = createTestSheet({ columnWidths: {} });
    const widths = extractColumnWidths(sheet, 0, 2);
    expect(widths).toEqual({});
  });

  it('only includes columns with custom widths', () => {
    const sheet = createTestSheet({
      columnWidths: { 1: 200 }, // Only column 1 has custom width
    });
    const widths = extractColumnWidths(sheet, 0, 2);
    expect(widths).toEqual({ 1: 200 });
  });

  it('handles single column range', () => {
    const sheet = createTestSheet({
      columnWidths: { 5: 180 },
    });
    const widths = extractColumnWidths(sheet, 5, 5);
    expect(widths).toEqual({ 5: 180 });
  });

  it('does not include columns outside range', () => {
    const sheet = createTestSheet({
      columnWidths: { 0: 150, 3: 200, 5: 180 },
    });
    const widths = extractColumnWidths(sheet, 0, 2);
    expect(widths).toEqual({ 0: 150 }); // Only col 0 is in range
  });

  it('handles empty columnWidths', () => {
    const sheet = createTestSheet({ columnWidths: {} });
    const widths = extractColumnWidths(sheet, 0, 5);
    expect(widths).toEqual({});
  });
});

describe('applyColumnWidths', () => {
  it('applies widths to target sheet', () => {
    const target = createTestSheet({ columnWidths: {} });
    const sourceWidths = { 0: 150, 1: 200 };
    const result = applyColumnWidths(target, sourceWidths, 0);
    expect(result.columnWidths).toEqual({ 0: 150, 1: 200 });
  });

  it('offsets target columns by target start column', () => {
    const target = createTestSheet({ columnWidths: {} });
    const sourceWidths = { 0: 150, 1: 200 };
    const result = applyColumnWidths(target, sourceWidths, 3);
    expect(result.columnWidths).toEqual({ 3: 150, 4: 200 });
  });

  it('preserves existing widths not in range', () => {
    const target = createTestSheet({
      columnWidths: { 10: 300 },
    });
    const sourceWidths = { 0: 150 };
    const result = applyColumnWidths(target, sourceWidths, 0);
    expect(result.columnWidths).toEqual({ 0: 150, 10: 300 });
  });

  it('does not mutate original sheet', () => {
    const target = createTestSheet({ columnWidths: {} });
    const sourceWidths = { 0: 150 };
    applyColumnWidths(target, sourceWidths, 0);
    expect(target.columnWidths).toEqual({});
  });

  it('handles empty source widths', () => {
    const target = createTestSheet({ columnWidths: {} });
    const result = applyColumnWidths(target, {}, 0);
    expect(result.columnWidths).toEqual({});
  });

  it('overwrites existing width at target column', () => {
    const target = createTestSheet({
      columnWidths: { 0: 100 },
    });
    const sourceWidths = { 0: 200 };
    const result = applyColumnWidths(target, sourceWidths, 0);
    expect(result.columnWidths).toEqual({ 0: 200 });
  });
});
