import { applyPasteOptions } from './pasteSpecial';
import type { ClipboardData } from './clipboard';
import type { Cell } from '../types';

function createClipboard(cells: (Cell | null)[][]): ClipboardData {
  return {
    cells,
    rowCount: cells.length,
    colCount: cells[0]?.length ?? 0,
    isCut: false,
    selectionType: 'cell',
  };
}

describe('applyPasteOptions', () => {
  describe('paste mode: all (default)', () => {
    it('preserves both formulas and styles', () => {
      const clipboard = createClipboard([
        [{ rawValue: '=A1+B1', style: { fontWeight: 'bold' } }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'all' });
      expect(result.cells[0][0]?.rawValue).toBe('=A1+B1');
      expect(result.cells[0][0]?.style).toEqual({ fontWeight: 'bold' });
    });

    it('preserves values and styles', () => {
      const clipboard = createClipboard([
        [{ rawValue: 'Hello', style: { color: '#FF0000' } }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'all' });
      expect(result.cells[0][0]?.rawValue).toBe('Hello');
      expect(result.cells[0][0]?.style).toEqual({ color: '#FF0000' });
    });
  });

  describe('paste mode: formulas', () => {
    it('preserves formulas but strips styles', () => {
      const clipboard = createClipboard([
        [{ rawValue: '=SUM(A1:A10)', style: { fontWeight: 'bold' } }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'formulas' });
      expect(result.cells[0][0]?.rawValue).toBe('=SUM(A1:A10)');
      expect(result.cells[0][0]?.style).toBeUndefined();
    });

    it('preserves literal values (they are not formulas to strip)', () => {
      const clipboard = createClipboard([
        [{ rawValue: 'Hello', style: { fontWeight: 'bold' } }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'formulas' });
      expect(result.cells[0][0]?.rawValue).toBe('Hello');
      expect(result.cells[0][0]?.style).toBeUndefined();
    });

    it('strips styles from all cells in range', () => {
      const clipboard = createClipboard([
        [
          { rawValue: '=A1', style: { fontWeight: 'bold' } },
          { rawValue: 'Plain', style: { color: '#FF0000' } },
        ],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'formulas' });
      expect(result.cells[0][0]?.style).toBeUndefined();
      expect(result.cells[0][1]?.style).toBeUndefined();
    });
  });

  describe('paste mode: values', () => {
    it('converts formulas to their computed string representation', () => {
      const clipboard = createClipboard([
        [{ rawValue: '=A1+B1', computedValue: 42, style: { fontWeight: 'bold' } }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'values' });
      expect(result.cells[0][0]?.rawValue).toBe('42');
      expect(result.cells[0][0]?.style).toBeUndefined();
    });

    it('preserves literal values as-is', () => {
      const clipboard = createClipboard([
        [{ rawValue: 'Hello', style: { color: '#FF0000' } }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'values' });
      expect(result.cells[0][0]?.rawValue).toBe('Hello');
      expect(result.cells[0][0]?.style).toBeUndefined();
    });

    it('handles formula with null computed value', () => {
      const clipboard = createClipboard([
        [{ rawValue: '=A1', computedValue: null }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'values' });
      expect(result.cells[0][0]?.rawValue).toBe('');
    });

    it('handles formula with string computed value', () => {
      const clipboard = createClipboard([
        [{ rawValue: '=A1', computedValue: 'text' }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'values' });
      expect(result.cells[0][0]?.rawValue).toBe('text');
    });

    it('handles formula with boolean computed value', () => {
      const clipboard = createClipboard([
        [{ rawValue: '=A1>0', computedValue: true }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'values' });
      expect(result.cells[0][0]?.rawValue).toBe('TRUE');
    });

    it('strips styles from all cells', () => {
      const clipboard = createClipboard([
        [
          { rawValue: '=A1', computedValue: 10, style: { fontWeight: 'bold' } },
          { rawValue: 'Text', style: { color: '#FF0000' } },
        ],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'values' });
      expect(result.cells[0][0]?.style).toBeUndefined();
      expect(result.cells[0][1]?.style).toBeUndefined();
    });
  });

  describe('paste mode: formatting', () => {
    it('preserves styles but strips values', () => {
      const clipboard = createClipboard([
        [{ rawValue: '=A1+B1', style: { fontWeight: 'bold' } }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'formatting' });
      expect(result.cells[0][0]?.rawValue).toBe('');
      expect(result.cells[0][0]?.style).toEqual({ fontWeight: 'bold' });
    });

    it('preserves only style, not value', () => {
      const clipboard = createClipboard([
        [{ rawValue: 'Hello', style: { color: '#FF0000', backgroundColor: '#FFFF00' } }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'formatting' });
      expect(result.cells[0][0]?.rawValue).toBe('');
      expect(result.cells[0][0]?.style).toEqual({ color: '#FF0000', backgroundColor: '#FFFF00' });
    });

    it('keeps styles across range', () => {
      const clipboard = createClipboard([
        [
          { rawValue: 'A', style: { fontWeight: 'bold' } },
          { rawValue: 'B', style: { fontStyle: 'italic' } },
        ],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'formatting' });
      expect(result.cells[0][0]?.style).toEqual({ fontWeight: 'bold' });
      expect(result.cells[0][1]?.style).toEqual({ fontStyle: 'italic' });
    });
  });

  describe('transpose', () => {
    it('swaps rows and columns', () => {
      const clipboard = createClipboard([
        [{ rawValue: 'A' }, { rawValue: 'B' }, { rawValue: 'C' }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'all', transpose: true });
      expect(result.rowCount).toBe(3);
      expect(result.colCount).toBe(1);
      expect(result.cells[0][0]?.rawValue).toBe('A');
      expect(result.cells[1][0]?.rawValue).toBe('B');
      expect(result.cells[2][0]?.rawValue).toBe('C');
    });

    it('transposes a 2x2 range', () => {
      const clipboard = createClipboard([
        [{ rawValue: 'A' }, { rawValue: 'B' }],
        [{ rawValue: 'C' }, { rawValue: 'D' }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'all', transpose: true });
      expect(result.rowCount).toBe(2);
      expect(result.colCount).toBe(2);
      expect(result.cells[0][0]?.rawValue).toBe('A');
      expect(result.cells[0][1]?.rawValue).toBe('C');
      expect(result.cells[1][0]?.rawValue).toBe('B');
      expect(result.cells[1][1]?.rawValue).toBe('D');
    });

    it('transposes with styles preserved', () => {
      const clipboard = createClipboard([
        [{ rawValue: 'A', style: { fontWeight: 'bold' } }, { rawValue: 'B', style: { color: '#FF0000' } }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'all', transpose: true });
      expect(result.cells[0][0]?.rawValue).toBe('A');
      expect(result.cells[0][0]?.style).toEqual({ fontWeight: 'bold' });
      expect(result.cells[1][0]?.rawValue).toBe('B');
      expect(result.cells[1][0]?.style).toEqual({ color: '#FF0000' });
    });

    it('transposes combined with values mode', () => {
      const clipboard = createClipboard([
        [{ rawValue: '=A1', computedValue: 10, style: { fontWeight: 'bold' } }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'values', transpose: true });
      expect(result.rowCount).toBe(1);
      expect(result.colCount).toBe(1);
      expect(result.cells[0][0]?.rawValue).toBe('10');
      expect(result.cells[0][0]?.style).toBeUndefined();
    });

    it('does not transpose when transpose is false', () => {
      const clipboard = createClipboard([
        [{ rawValue: 'A' }, { rawValue: 'B' }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'all', transpose: false });
      expect(result.rowCount).toBe(1);
      expect(result.colCount).toBe(2);
    });
  });

  describe('combined options', () => {
    it('formulas mode + transpose', () => {
      const clipboard = createClipboard([
        [{ rawValue: '=A1', style: { fontWeight: 'bold' } }, { rawValue: '=B1', style: { color: '#FF0000' } }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'formulas', transpose: true });
      expect(result.rowCount).toBe(2);
      expect(result.colCount).toBe(1);
      expect(result.cells[0][0]?.rawValue).toBe('=A1');
      expect(result.cells[0][0]?.style).toBeUndefined();
      expect(result.cells[1][0]?.rawValue).toBe('=B1');
      expect(result.cells[1][0]?.style).toBeUndefined();
    });

    it('formatting mode + transpose', () => {
      const clipboard = createClipboard([
        [{ rawValue: 'A', style: { fontWeight: 'bold' } }, { rawValue: 'B', style: { fontStyle: 'italic' } }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'formatting', transpose: true });
      expect(result.rowCount).toBe(2);
      expect(result.colCount).toBe(1);
      expect(result.cells[0][0]?.rawValue).toBe('');
      expect(result.cells[0][0]?.style).toEqual({ fontWeight: 'bold' });
      expect(result.cells[1][0]?.rawValue).toBe('');
      expect(result.cells[1][0]?.style).toEqual({ fontStyle: 'italic' });
    });
  });

  describe('edge cases', () => {
    it('handles null cells in clipboard', () => {
      const clipboard = createClipboard([[null, { rawValue: 'B' }]]);
      const result = applyPasteOptions(clipboard, { mode: 'all' });
      expect(result.cells[0][0]).toBeNull();
      expect(result.cells[0][1]?.rawValue).toBe('B');
    });

    it('handles empty clipboard', () => {
      const clipboard = createClipboard([[]]);
      const result = applyPasteOptions(clipboard, { mode: 'all' });
      expect(result.rowCount).toBe(1);
      expect(result.colCount).toBe(0);
    });

    it('handles single cell clipboard', () => {
      const clipboard = createClipboard([[{ rawValue: 'X' }]]);
      const result = applyPasteOptions(clipboard, { mode: 'all' });
      expect(result.rowCount).toBe(1);
      expect(result.colCount).toBe(1);
      expect(result.cells[0][0]?.rawValue).toBe('X');
    });

    it('handles cell with no computedValue in values mode', () => {
      const clipboard = createClipboard([
        [{ rawValue: '=A1' }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'values' });
      expect(result.cells[0][0]?.rawValue).toBe('');
    });

    it('handles cell with undefined computedValue in values mode', () => {
      const clipboard = createClipboard([
        [{ rawValue: '=A1', computedValue: undefined }],
      ]);
      const result = applyPasteOptions(clipboard, { mode: 'values' });
      expect(result.cells[0][0]?.rawValue).toBe('');
    });
  });
});
