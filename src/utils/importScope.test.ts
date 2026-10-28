// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { applyReplace, applyAddSheets, applyInsertAtCell } from './importScope';
import type { Workbook, Sheet } from '../types';

function makeSheet(id: string, name: string, cells: Record<string, { rawValue: string }> = {}): Sheet {
  return {
    id,
    name,
    cells,
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

function makeWorkbook(sheets: Sheet[], activeSheetIndex = 0): Workbook {
  return {
    id: 'wb-1',
    title: 'Workbook',
    sheets,
    activeSheetIndex,
    lastModified: 1000,
  };
}

describe('applyReplace', () => {
  it('returns the imported workbook unchanged without a title', () => {
    const wb = makeWorkbook([makeSheet('s1', 'Sheet1')]);
    expect(applyReplace(wb)).toBe(wb);
  });

  it('renames the workbook when a title is provided', () => {
    const wb = makeWorkbook([makeSheet('s1', 'Sheet1')]);
    const result = applyReplace(wb, 'Budget');
    expect(result.title).toBe('Budget');
    expect(result.sheets).toBe(wb.sheets);
  });

  it('keeps the same title when it already matches', () => {
    const wb = makeWorkbook([makeSheet('s1', 'Sheet1')]);
    expect(applyReplace(wb, wb.title)).toBe(wb);
  });
});

describe('applyAddSheets', () => {
  it('appends imported sheets and activates the first appended sheet', () => {
    const current = makeWorkbook([makeSheet('a', 'Existing')], 0);
    const imported = makeWorkbook([makeSheet('i0', 'Imported')], 0);
    const result = applyAddSheets(current, imported);

    expect(result.sheets).toHaveLength(2);
    expect(result.sheets[1].name).toBe('Imported');
    expect(result.activeSheetIndex).toBe(1);
  });

  it('renames colliding sheet names', () => {
    const current = makeWorkbook([makeSheet('a', 'Imported')], 0);
    const imported = makeWorkbook([makeSheet('i0', 'Imported')], 0);
    const result = applyAddSheets(current, imported);

    expect(result.sheets[1].name).toBe('Imported (2)');
  });

  it('handles multiple collisions', () => {
    const current = makeWorkbook([
      makeSheet('a', 'Imported'),
      makeSheet('b', 'Imported (2)'),
    ], 0);
    const imported = makeWorkbook([makeSheet('i0', 'Imported')], 0);
    const result = applyAddSheets(current, imported);

    expect(result.sheets[2].name).toBe('Imported (3)');
  });
});

describe('applyInsertAtCell', () => {
  it('inserts imported cells at the offset', () => {
    const current = makeWorkbook([makeSheet('a', 'Target', { '0:0': { rawValue: 'keep' } })], 0);
    const imported = makeWorkbook([
      makeSheet('i0', 'Src', {
        '0:0': { rawValue: 'a' },
        '0:1': { rawValue: 'b' },
        '1:0': { rawValue: 'c' },
      }),
    ], 0);

    const result = applyInsertAtCell(current, imported, 2, 3);
    const cells = result.sheets[0].cells;

    expect(cells['0:0'].rawValue).toBe('keep');
    expect(cells['2:3'].rawValue).toBe('a');
    expect(cells['2:4'].rawValue).toBe('b');
    expect(cells['3:3'].rawValue).toBe('c');
  });

  it('expands row/column counts to fit inserted data', () => {
    const current = makeWorkbook([makeSheet('a', 'Target')], 0);
    const imported = makeWorkbook([
      makeSheet('i0', 'Src', { '5:7': { rawValue: 'far' } }),
    ], 0);

    const result = applyInsertAtCell(current, imported, 0, 0);
    expect(result.sheets[0].cells['5:7'].rawValue).toBe('far');
    expect(result.sheets[0].rowCount).toBeGreaterThanOrEqual(6);
    expect(result.sheets[0].columnCount).toBeGreaterThanOrEqual(8);
  });

  it('does not modify other sheets', () => {
    const current = makeWorkbook([makeSheet('a', 'Target'), makeSheet('b', 'Other')], 0);
    const imported = makeWorkbook([makeSheet('i0', 'Src', { '0:0': { rawValue: 'x' } })], 0);

    const result = applyInsertAtCell(current, imported, 0, 0);
    expect(result.sheets[1]).toBe(current.sheets[1]);
  });
});
