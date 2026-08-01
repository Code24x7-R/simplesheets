// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  copyRange,
  cutRange,
  getClipboard,
  clearClipboard,
  hasClipboardData,
  clipboardAsCsv,
  generateFillSeries,
  computeFillHandle,
} from './clipboard';
import type { Cell } from '../types';

describe('Clipboard', () => {
  beforeEach(() => {
    clearClipboard();
  });

  describe('copyRange', () => {
    it('copies a single cell', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'A1' },
      };
      const data = copyRange(cells, 0, 0, 0, 0);
      expect(data.rowCount).toBe(1);
      expect(data.colCount).toBe(1);
      expect(data.cells[0][0]?.rawValue).toBe('A1');
      expect(data.isCut).toBe(false);
    });

    it('copies a 2x2 range', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'A1' },
        '0:1': { rawValue: 'B1' },
        '1:0': { rawValue: 'A2' },
        '1:1': { rawValue: 'B2' },
      };
      const data = copyRange(cells, 0, 0, 1, 1);
      expect(data.rowCount).toBe(2);
      expect(data.colCount).toBe(2);
      expect(data.cells[1][1]?.rawValue).toBe('B2');
    });

    it('includes null for empty cells in range', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'A1' },
      };
      const data = copyRange(cells, 0, 0, 0, 2);
      expect(data.cells[0][0]).not.toBeNull();
      expect(data.cells[0][1]).toBeNull();
    });

    it('stores data in module clipboard', () => {
      const cells: Record<string, Cell> = { '0:0': { rawValue: 'test' } };
      copyRange(cells, 0, 0, 0, 0);
      expect(hasClipboardData()).toBe(true);
      expect(getClipboard()?.cells[0][0]?.rawValue).toBe('test');
    });

    it('stores selectionType when provided', () => {
      const cells: Record<string, Cell> = { '0:0': { rawValue: 'test' } };
      const data = copyRange(cells, 0, 0, 0, 0, 'row');
      expect(data.selectionType).toBe('row');
      expect(getClipboard()?.selectionType).toBe('row');
    });

    it('stores col selectionType from cut', () => {
      const cells: Record<string, Cell> = { '0:0': { rawValue: 'test' } };
      const data = cutRange(cells, 0, 0, 0, 0, 'col');
      expect(data.isCut).toBe(true);
      expect(data.selectionType).toBe('col');
    });

    it('leaves selectionType undefined when not provided', () => {
      const cells: Record<string, Cell> = { '0:0': { rawValue: 'test' } };
      const data = copyRange(cells, 0, 0, 0, 0);
      expect(data.selectionType).toBeUndefined();
    });
  });

  describe('cutRange', () => {
    it('marks clipboard as cut', () => {
      const cells: Record<string, Cell> = { '0:0': { rawValue: 'cut' } };
      const data = cutRange(cells, 0, 0, 0, 0);
      expect(data.isCut).toBe(true);
    });
  });

  describe('clearClipboard', () => {
    it('clears stored data', () => {
      const cells: Record<string, Cell> = { '0:0': { rawValue: 'data' } };
      copyRange(cells, 0, 0, 0, 0);
      clearClipboard();
      expect(hasClipboardData()).toBe(false);
      expect(getClipboard()).toBeNull();
    });
  });

  describe('clipboardAsCsv', () => {
    it('converts clipboard to CSV string', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'hello' },
        '0:1': { rawValue: 'world' },
        '1:0': { rawValue: 'foo' },
        '1:1': { rawValue: 'bar' },
      };
      const data = copyRange(cells, 0, 0, 1, 1);
      const csv = clipboardAsCsv(data);
      expect(csv).toContain('hello,world');
      expect(csv).toContain('foo,bar');
    });

    it('escapes values containing commas', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'hello, world' },
      };
      const data = copyRange(cells, 0, 0, 0, 0);
      const csv = clipboardAsCsv(data);
      expect(csv).toBe('"hello, world"');
    });

    it('escapes values containing newlines', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'line1\nline2' },
      };
      const data = copyRange(cells, 0, 0, 0, 0);
      const csv = clipboardAsCsv(data);
      expect(csv).toBe('"line1\nline2"');
    });

    it('escapes values containing quotes', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'say "hello"' },
      };
      const data = copyRange(cells, 0, 0, 0, 0);
      const csv = clipboardAsCsv(data);
      expect(csv).toBe('"say ""hello"""');
    });

    it('supports custom delimiter', () => {
      const cells: Record<string, Cell> = {
        '0:0': { rawValue: 'a;b' },
      };
      const data = copyRange(cells, 0, 0, 0, 0);
      const csv = clipboardAsCsv(data, ';');
      expect(csv).toBe('"a;b"');
    });
  });

  describe('generateFillSeries', () => {
    it('generates numeric series', () => {
      const series = generateFillSeries('1', 5);
      expect(series).toEqual(['1', '2', '3', '4', '5']);
    });

    it('generates decimal series', () => {
      const series = generateFillSeries('0.5', 3);
      expect(series).toEqual(['0.5', '1.5', '2.5']);
    });

    it('generates date series', () => {
      const series = generateFillSeries('2024-01-01', 3);
      expect(series).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
    });

    it('generates text+number series', () => {
      const series = generateFillSeries('Item 1', 4);
      expect(series).toEqual(['Item 1', 'Item 2', 'Item 3', 'Item 4']);
    });

    it('pads numbers in text+number series', () => {
      const series = generateFillSeries('Item 01', 3);
      expect(series).toEqual(['Item 01', 'Item 02', 'Item 03']);
    });

    it('repeats unrecognized patterns', () => {
      const series = generateFillSeries('text', 3);
      expect(series).toEqual(['text', 'text', 'text']);
    });
  });

  describe('computeFillHandle', () => {
    it('computes fill-down series', () => {
      const cell: Cell = { rawValue: '1' };
      const series = computeFillHandle(cell, 'down', 4);
      expect(series).toEqual(['2', '3', '4', '5']);
    });

    it('returns empty strings for null cell', () => {
      const series = computeFillHandle(null, 'down', 3);
      expect(series).toEqual(['', '', '']);
    });
  });
});
