/**
 * Tests for the core data model types.
 * Verifies that all interfaces can be instantiated correctly.
 */

import type { Workbook, Sheet, Cell, CellStyle, HistoryEntry, Selection } from './types';
import { cellKey, colToLetter, refToRowCol } from './types';

describe('Core Data Model', () => {
  describe('Cell', () => {
    it('can be instantiated with a rawValue', () => {
      const cell: Cell = { rawValue: '42' };
      expect(cell.rawValue).toBe('42');
    });

    it('can include style properties', () => {
      const style: CellStyle = {
        fontWeight: 'bold',
        color: '#FF0000',
        backgroundColor: '#FFFF00',
        textAlign: 'center',
      };
      const cell: Cell = { rawValue: 'Hello', style };
      expect(cell.style?.fontWeight).toBe('bold');
      expect(cell.style?.color).toBe('#FF0000');
    });

  });

  describe('Sheet', () => {
    it('can be instantiated with default values', () => {
      const sheet: Sheet = {
        id: 'sheet-1',
        name: 'Sheet1',
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
      expect(sheet.name).toBe('Sheet1');
      expect(sheet.columnCount).toBe(26);
      expect(Object.keys(sheet.cells).length).toBe(0);
    });

    it('can store cells with sparse keys', () => {
      const sheet: Sheet = {
        id: 'sheet-1',
        name: 'Sheet1',
        cells: {
          '0:0': { rawValue: 'A1' },
          '0:1': { rawValue: 'B1' },
          '5:3': { rawValue: 'D6' },
        },
        defaultColWidth: 100,
        defaultRowHeight: 28,
        columnWidths: {},
        rowHeights: {},
        columnCount: 26,
        rowCount: 100,
        frozenColumns: 0,
        frozenRows: 0,
      };
      expect(sheet.cells['0:0']?.rawValue).toBe('A1');
      expect(sheet.cells['5:3']?.rawValue).toBe('D6');
      expect(sheet.cells['1:1']).toBeUndefined();
    });
  });

  describe('Workbook', () => {
    it('can be instantiated with multiple sheets', () => {
      const workbook: Workbook = {
        id: 'wb-1',
        title: 'Test Workbook',
        sheets: [
          {
            id: 'sheet-1',
            name: 'First',
            cells: {},
            defaultColWidth: 100,
            defaultRowHeight: 28,
            columnWidths: {},
            rowHeights: {},
            columnCount: 26,
            rowCount: 100,
            frozenColumns: 0,
            frozenRows: 0,
          },
        ],
        activeSheetIndex: 0,
        lastModified: Date.now(),
      };
      expect(workbook.sheets.length).toBe(1);
      expect(workbook.activeSheetIndex).toBe(0);
    });
  });

  describe('HistoryEntry', () => {
    it('can capture a workbook snapshot', () => {
      const workbook: Workbook = {
        id: 'wb-1',
        title: 'Test',
        sheets: [],
        activeSheetIndex: 0,
        lastModified: Date.now(),
      };
      const entry: HistoryEntry = {
        workbook,
        description: 'Edit cell A1',
        timestamp: Date.now(),
      };
      expect(entry.description).toBe('Edit cell A1');
      expect(entry.workbook.id).toBe('wb-1');
    });
  });

  describe('Selection', () => {
    it('can represent a single cell selection', () => {
      const sel: Selection = {
        type: 'cell',
        startRow: 0,
        startCol: 0,
        endRow: 0,
        endCol: 0,
        anchorRow: 0,
        anchorCol: 0,
      };
      expect(sel.startRow).toBe(0);
      expect(sel.endCol).toBe(0);
      expect(sel.type).toBe('cell');
    });

    it('can represent a range selection', () => {
      const sel: Selection = {
        type: 'cell',
        startRow: 0,
        startCol: 0,
        endRow: 4,
        endCol: 3,
        anchorRow: 0,
        anchorCol: 0,
      };
      expect(sel.endRow).toBe(4);
      expect(sel.type).toBe('cell');
    });

    it('can represent a row selection', () => {
      const sel: Selection = {
        type: 'row',
        startRow: 2,
        startCol: 0,
        endRow: 2,
        endCol: 25,
        anchorRow: 2,
        anchorCol: 0,
      };
      expect(sel.type).toBe('row');
      expect(sel.startRow).toBe(2);
    });

    it('can represent a column selection', () => {
      const sel: Selection = {
        type: 'col',
        startRow: 0,
        startCol: 1,
        endRow: 9999,
        endCol: 1,
        anchorRow: 0,
        anchorCol: 1,
      };
      expect(sel.type).toBe('col');
      expect(sel.startCol).toBe(1);
      expect(sel.endCol).toBe(1);
    });
  });

  describe('Utility functions', () => {
    it('cellKey generates correct keys', () => {
      expect(cellKey(0, 0)).toBe('0:0');
      expect(cellKey(5, 3)).toBe('5:3');
      expect(cellKey(99, 25)).toBe('99:25');
    });

    it('colToLetter converts indices to letters', () => {
      expect(colToLetter(0)).toBe('A');
      expect(colToLetter(1)).toBe('B');
      expect(colToLetter(25)).toBe('Z');
      expect(colToLetter(26)).toBe('AA');
      expect(colToLetter(27)).toBe('AB');
      expect(colToLetter(51)).toBe('AZ');
      expect(colToLetter(52)).toBe('BA');
    });

    it('colToLetter handles triple-letter columns', () => {
      expect(colToLetter(702)).toBe('AAA');
      expect(colToLetter(703)).toBe('AAB');
    });

    it('refToRowCol parses A1 references', () => {
      expect(refToRowCol('A1')).toEqual([0, 0]);
      expect(refToRowCol('B3')).toEqual([2, 1]);
      expect(refToRowCol('Z1')).toEqual([0, 25]);
      expect(refToRowCol('AA1')).toEqual([0, 26]);
      expect(refToRowCol('AB10')).toEqual([9, 27]);
    });

    it('refToRowCol handles lowercase references', () => {
      expect(refToRowCol('a1')).toEqual([0, 0]);
      expect(refToRowCol('ab10')).toEqual([9, 27]);
      expect(refToRowCol('zz100')).toEqual([99, 701]);
    });

    it('refToRowCol throws on invalid input', () => {
      expect(() => refToRowCol('invalid')).toThrow();
      expect(() => refToRowCol('123')).toThrow();
    });
  });
});
