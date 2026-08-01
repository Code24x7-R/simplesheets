// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  copyRange,
  cutRange,
  getClipboard,
  clearClipboard,
  hasClipboardData,
} from './clipboard';
import type { Cell, CellStyle } from '../types';

describe('Clipboard — Style Preservation', () => {
  beforeEach(() => {
    clearClipboard();
  });

  const boldStyle: CellStyle = { fontWeight: 'bold' };
  const redStyle: CellStyle = { color: '#FF0000' };
  const complexStyle: CellStyle = {
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#0000FF',
    backgroundColor: '#FFFF00',
    textAlign: 'center',
    numberFormat: '0.00',
    borderTop: '1px solid #000000',
  };

  describe('copyRange preserves styles', () => {
    it('preserves bold style on copied cell', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'Hello', style: boldStyle },
      };
      const data = copyRange(cells, 0, 0, 0, 0);
      expect(data.cells[0][0]?.style).toEqual(boldStyle);
    });

    it('preserves complex style with multiple properties', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: '42', style: complexStyle },
      };
      const data = copyRange(cells, 0, 0, 0, 0);
      expect(data.cells[0][0]?.style).toEqual(complexStyle);
    });

    it('preserves different styles across a range', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'A', style: boldStyle },
        '0:1': { rawValue: 'B', style: redStyle },
        '1:0': { rawValue: 'C', style: complexStyle },
        '1:1': { rawValue: 'D' }, // no style
      };
      const data = copyRange(cells, 0, 0, 1, 1);
      expect(data.cells[0][0]?.style).toEqual(boldStyle);
      expect(data.cells[0][1]?.style).toEqual(redStyle);
      expect(data.cells[1][0]?.style).toEqual(complexStyle);
      expect(data.cells[1][1]?.style).toBeUndefined();
    });

    it('preserves style when copying a row selection', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'A', style: boldStyle },
        '0:1': { rawValue: 'B', style: boldStyle },
        '0:2': { rawValue: 'C', style: boldStyle },
      };
      const data = copyRange(cells, 0, 0, 0, 2, 'row');
      expect(data.selectionType).toBe('row');
      expect(data.cells[0][0]?.style).toEqual(boldStyle);
      expect(data.cells[0][1]?.style).toEqual(boldStyle);
      expect(data.cells[0][2]?.style).toEqual(boldStyle);
    });

    it('preserves style when copying a column selection', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'A', style: redStyle },
        '1:0': { rawValue: 'B', style: redStyle },
      };
      const data = copyRange(cells, 0, 0, 1, 0, 'col');
      expect(data.selectionType).toBe('col');
      expect(data.cells[0][0]?.style).toEqual(redStyle);
      expect(data.cells[1][0]?.style).toEqual(redStyle);
    });
  });

  describe('cutRange preserves styles', () => {
    it('preserves style when cutting a range', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'Cut', style: boldStyle },
        '0:1': { rawValue: 'Me', style: redStyle },
      };
      const data = cutRange(cells, 0, 0, 0, 1);
      expect(data.isCut).toBe(true);
      expect(data.cells[0][0]?.style).toEqual(boldStyle);
      expect(data.cells[0][1]?.style).toEqual(redStyle);
    });
  });

  describe('getClipboard returns styles', () => {
    it('retrieves clipboard with styles intact', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'Test', style: complexStyle },
      };
      copyRange(cells, 0, 0, 0, 0);
      const clipboard = getClipboard();
      expect(clipboard).not.toBeNull();
      expect(clipboard?.cells[0][0]?.style).toEqual(complexStyle);
    });
  });

  describe('clearClipboard removes styles', () => {
    it('clears clipboard including style data', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'Data', style: boldStyle },
      };
      copyRange(cells, 0, 0, 0, 0);
      expect(hasClipboardData()).toBe(true);
      clearClipboard();
      expect(hasClipboardData()).toBe(false);
      expect(getClipboard()).toBeNull();
    });
  });

  describe('style edge cases', () => {
    it('handles empty style object', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'Empty', style: {} },
      };
      const data = copyRange(cells, 0, 0, 0, 0);
      expect(data.cells[0][0]?.style).toEqual({});
    });

    it('handles style with only one property', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'Center', style: { textAlign: 'center' } },
      };
      const data = copyRange(cells, 0, 0, 0, 0);
      expect(data.cells[0][0]?.style).toEqual({ textAlign: 'center' });
    });

    it('preserves number format style', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: '1234.5', style: { numberFormat: '#,##0.00' } },
      };
      const data = copyRange(cells, 0, 0, 0, 0);
      expect(data.cells[0][0]?.style?.numberFormat).toBe('#,##0.00');
    });

    it('preserves border styles', () => {
      const borderStyle: CellStyle = {
        borderTop: '2px solid #FF0000',
        borderBottom: '1px dashed #00FF00',
        borderLeft: '3px double #0000FF',
        borderRight: '1px solid #000000',
      };
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'Border', style: borderStyle },
      };
      const data = copyRange(cells, 0, 0, 0, 0);
      expect(data.cells[0][0]?.style).toEqual(borderStyle);
    });

    it('preserves whiteSpace style', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'Wrap', style: { whiteSpace: 'normal' } },
      };
      const data = copyRange(cells, 0, 0, 0, 0);
      expect(data.cells[0][0]?.style?.whiteSpace).toBe('normal');
    });
  });
});
