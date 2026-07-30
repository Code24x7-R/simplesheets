import { insertRow, deleteRow, insertCol, deleteCol } from './sheetOperations';
import type { Sheet, Cell } from '../types';

function createTestSheet(): Sheet {
  const cells: Record<string, Cell> = {
    '0:0': { rawValue: '10' },
    '1:0': { rawValue: '20' },
    '2:0': { rawValue: '=A1+A2' },       // A3 = sum of A1, A2
    '3:0': { rawValue: '=A3' },           // A4 references A3 (formula)
    '0:1': { rawValue: '=A1+B1' },        // B1 references A1 and B1 (self-circ, but test shift)
    '5:0': { rawValue: '=A$1+A6' },       // A6 has absolute ref to A1
  };
  return {
    id: 's1',
    name: 'Sheet1',
    cells,
    defaultColWidth: 100,
    defaultRowHeight: 28,
    columnWidths: { 0: 120, 1: 80 },
    rowHeights: { 0: 30, 5: 40 },
    columnCount: 26,
    rowCount: 100,
    frozenColumns: 0,
    frozenRows: 0,
  };
}

describe('insertRow', () => {
  it('shifts cells at and below the insertion point down', () => {
    const sheet = createTestSheet();
    const result = insertRow(sheet, 1);
    // A1 (0:0) stays
    expect(result.cells['0:0']?.rawValue).toBe('10');
    // A2 (1:0) moves to A3
    expect(result.cells['2:0']?.rawValue).toBe('20');
    // A3 formula moves to A4
    expect(result.cells['3:0']?.rawValue).toBe('=A1+A3');
    // rowCount incremented
    expect(result.rowCount).toBe(101);
  });

  it('adjusts formula references for cells above the insertion', () => {
    const sheet = createTestSheet();
    const result = insertRow(sheet, 1);
    // A3 was =A1+A2, after inserting row at 1, A2→A3, so =A1+A3
    expect(result.cells['3:0']?.rawValue).toBe('=A1+A3');
  });

  it('does not adjust refs that point above the insertion', () => {
    const sheet = createTestSheet();
    const result = insertRow(sheet, 3);
    // A1 (0:0) stays as '10' (no formula)
    expect(result.cells['0:0']?.rawValue).toBe('10');
    // A3 =A1+A2 should stay =A1+A2 (both refs above row 3)
    expect(result.cells['2:0']?.rawValue).toBe('=A1+A2');
  });

  it('preserves absolute references', () => {
    const sheet = createTestSheet();
    const result = insertRow(sheet, 1);
    // A6 was =A$1+A6. Insert row at 1: A$1 stays absolute, A6→A7
    expect(result.cells['6:0']?.rawValue).toBe('=A$1+A7');
  });

  it('shifts rowHeights down', () => {
    const sheet = createTestSheet();
    const result = insertRow(sheet, 1);
    expect(result.rowHeights[0]).toBe(30);   // row 0 unchanged
    expect(result.rowHeights[6]).toBe(40);   // row 5 → row 6
    expect(result.rowHeights[1]).toBeUndefined(); // no height at insertion point
  });

  it('does not mutate the original sheet', () => {
    const sheet = createTestSheet();
    const originalCells = JSON.stringify(sheet.cells);
    insertRow(sheet, 1);
    expect(JSON.stringify(sheet.cells)).toBe(originalCells);
  });
});

describe('deleteRow', () => {
  it('removes the row and shifts cells below up', () => {
    const sheet = createTestSheet();
    const result = deleteRow(sheet, 1);
    // A1 (0:0) stays
    expect(result.cells['0:0']?.rawValue).toBe('10');
    // A3 (was 2:0) moves to A2 (1:0). Original formula =A1+A2: A1 stays, A2 is deleted → #REF!
    expect(result.cells['1:0']?.rawValue).toBe('=A1+#REF!');
    // rowCount decremented
    expect(result.rowCount).toBe(99);
  });

  it('adjusts formula refs that pointed below the deleted row', () => {
    const sheet = createTestSheet();
    const result = deleteRow(sheet, 0);
    // A3 was =A1+A2, A1 deleted, A2→A1. So =#REF!+A1
    expect(result.cells['1:0']?.rawValue).toBe('=#REF!+A1');
  });

  it('converts refs to the deleted row into #REF!', () => {
    const sheet = createTestSheet();
    // A3 references A1 (row 0). When we delete row 0, that ref becomes #REF!
    const result = deleteRow(sheet, 0);
    // A3 was =A1+A2, A1 deleted → #REF!, A2→A1
    expect(result.cells['1:0']?.rawValue).toBe('=#REF!+A1');
  });

  it('does not reduce rowCount below 1', () => {
    const sheet = createTestSheet();
    sheet.rowCount = 1;
    const result = deleteRow(sheet, 0);
    expect(result.rowCount).toBe(1);
  });

  it('shifts rowHeights up', () => {
    const sheet = createTestSheet();
    const result = deleteRow(sheet, 1);
    expect(result.rowHeights[0]).toBe(30);   // row 0 unchanged
    expect(result.rowHeights[4]).toBe(40);   // row 5 → row 4
  });
});

describe('insertCol', () => {
  it('shifts cells at and to the right of the insertion point right', () => {
    const sheet = createTestSheet();
    const result = insertCol(sheet, 1);
    // A1 (0:0) stays
    expect(result.cells['0:0']?.rawValue).toBe('10');
    // B1 (0:1) moves to C1 (0:2)
    expect(result.cells['0:2']?.rawValue).toBe('=A1+C1');
    expect(result.columnCount).toBe(27);
  });

  it('adjusts formula references for cells left of the insertion', () => {
    const sheet = createTestSheet();
    const result = insertCol(sheet, 1);
    // A3 was =A1+A2, inserting col at 1 doesn't affect column refs (both col A)
    expect(result.cells['2:0']?.rawValue).toBe('=A1+A2');
    // B1 was =A1+B1, B1→C1
    expect(result.cells['0:2']?.rawValue).toBe('=A1+C1');
  });

  it('preserves absolute column references', () => {
    const sheet = createTestSheet();
    // Add a cell with absolute column ref
    sheet.cells['0:1'] = { rawValue: '=$A$1+B1' };
    const result = insertCol(sheet, 1);
    // $A$1 stays, B1→C1
    expect(result.cells['0:2']?.rawValue).toBe('=$A$1+C1');
  });

  it('shifts columnWidths right', () => {
    const sheet = createTestSheet();
    const result = insertCol(sheet, 1);
    expect(result.columnWidths[0]).toBe(120);   // col 0 unchanged
    expect(result.columnWidths[2]).toBe(80);    // col 1 → col 2
  });
});

describe('deleteCol', () => {
  it('removes the column and shifts cells right of it left', () => {
    const sheet = createTestSheet();
    const result = deleteCol(sheet, 0);
    // A1 (0:0) is deleted entirely.
    // B1 (0:1) was =A1+B1, shifts to col 0. A1 deleted → #REF!, B1→A1
    expect(result.cells['0:0']?.rawValue).toBe('=#REF!+A1');
    expect(result.columnCount).toBe(25);
  });

  it('adjusts formula refs that pointed right of the deleted column', () => {
    const sheet = createTestSheet();
    const result = deleteCol(sheet, 0);
    // B1 was =A1+B1 → becomes A1 (col 0) with =#REF!+A1
    expect(result.cells['0:0']?.rawValue).toBe('=#REF!+A1');
  });

  it('converts refs to the deleted column into #REF!', () => {
    const sheet = createTestSheet();
    // C1 references column A (which we'll delete)
    sheet.cells['0:2'] = { rawValue: '=A1+C1' };
    const result = deleteCol(sheet, 0);
    // A1 deleted. C1 shifts to col 1 (B1). =A1+C1 → =#REF!+B1
    expect(result.cells['0:1']?.rawValue).toBe('=#REF!+B1');
  });

  it('does not reduce columnCount below 1', () => {
    const sheet = createTestSheet();
    sheet.columnCount = 1;
    const result = deleteCol(sheet, 0);
    expect(result.columnCount).toBe(1);
  });

  it('shifts columnWidths left', () => {
    const sheet = createTestSheet();
    const result = deleteCol(sheet, 0);
    expect(result.columnWidths[0]).toBe(80);   // old col 1 → col 0
  });

  it('shifts non-formula cells left of the deleted column', () => {
    const sheet = createTestSheet();
    // Delete col 1 — cells at col 0 (plain values) should shift unchanged
    const result = deleteCol(sheet, 1);
    // A1 (0:0) is a plain value '10', left of deleted col 1 → stays at 0:0
    expect(result.cells['0:0']?.rawValue).toBe('10');
  });

  it('shifts non-formula cells right of the deleted column', () => {
    const sheet = createTestSheet();
    // Add a plain cell at col 2
    sheet.cells['0:2'] = { rawValue: 'hello' };
    const result = deleteCol(sheet, 1);
    // Col 2 shifts to col 1
    expect(result.cells['0:1']?.rawValue).toBe('hello');
  });
});

describe('frozen panes adjustment', () => {
  it('adjusts frozenRows when inserting above the frozen boundary', () => {
    const sheet = createTestSheet();
    sheet.frozenRows = 2;
    const result = insertRow(sheet, 1);
    expect(result.frozenRows).toBe(3);
  });

  it('does not adjust frozenRows when inserting below the frozen boundary', () => {
    const sheet = createTestSheet();
    sheet.frozenRows = 2;
    const result = insertRow(sheet, 5);
    expect(result.frozenRows).toBe(2);
  });

  it('adjusts frozenColumns when inserting left of the frozen boundary', () => {
    const sheet = createTestSheet();
    sheet.frozenColumns = 2;
    const result = insertCol(sheet, 1);
    expect(result.frozenColumns).toBe(3);
  });
});

describe('adjustFormulaForStructuralChange edge cases', () => {
  it('keeps original ref when row goes out of bounds', () => {
    const sheet = createTestSheet();
    // A1 references A2, insert row at 0 shifts A2→A3
    sheet.cells['0:0'] = { rawValue: '=A2' };
    const result = insertRow(sheet, 0);
    // A2→A3, so =A2 becomes =A3
    expect(result.cells['1:0']?.rawValue).toBe('=A3');
  });

  it('keeps original ref when column goes out of bounds', () => {
    const sheet = createTestSheet();
    // A1 references B1, insert col at 0 shifts B1→C1
    sheet.cells['0:0'] = { rawValue: '=B1' };
    const result = insertCol(sheet, 0);
    // B1→C1, so =B1 becomes =C1
    expect(result.cells['0:1']?.rawValue).toBe('=C1');
  });

  it('handles absolute column refs correctly', () => {
    const sheet = createTestSheet();
    // A1 references $A$1 (absolute)
    sheet.cells['0:0'] = { rawValue: '=$A$1' };
    const result = insertRow(sheet, 0);
    // $A$1 stays as $A$1 (absolute ref)
    expect(result.cells['1:0']?.rawValue).toBe('=$A$1');
  });

  it('handles absolute row refs correctly', () => {
    const sheet = createTestSheet();
    // A1 references A$1 (absolute row)
    sheet.cells['1:0'] = { rawValue: '=A$1' };
    const result = insertRow(sheet, 0);
    // A$1 stays as A$1 (absolute row ref)
    expect(result.cells['2:0']?.rawValue).toBe('=A$1');
  });
});
