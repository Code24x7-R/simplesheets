// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { importCsv, importTsv, exportCsv, exportTsv, downloadCsv, downloadTsv, downloadTxt } from './csvService';
import type { Sheet, Cell } from '../types';

describe('CSV Service', () => {
  describe('importCsv', () => {
    it('imports simple CSV data', () => {
      const csv = 'Name,Age,City\nAlice,30,NYC\nBob,25,LA';
      const result = importCsv(csv, { hasHeader: true });
      expect(result.success).toBe(true);
      expect(result.workbook).toBeDefined();
      expect(result.rowCount).toBe(2);
      expect(result.colCount).toBe(3);
    });

    it('imports without headers includes all rows', () => {
      const csv = '1,2,3\n4,5,6';
      const result = importCsv(csv);
      expect(result.success).toBe(true);
      // Without hasHeader, all rows are data rows
      expect(result.rowCount).toBe(2);
    });

    it('handles quoted fields', () => {
      const csv = 'Name,Description\nAlice,"Hello, World"\nBob,"Multi\nLine"';
      const result = importCsv(csv);
      expect(result.success).toBe(true);
    });

    it('handles empty file', () => {
      const result = importCsv('');
      expect(result.success).toBe(false);
    });

    it('returns error for malformed CSV with no valid data', () => {
      // A single unclosed quote produces parse errors with zero data rows
      const csv = '"';
      const result = importCsv(csv);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('respects custom delimiter', () => {
      const csv = 'a;b;c\n1;2;3';
      const result = importCsv(csv, { delimiter: ';' });
      expect(result.success).toBe(true);
      expect(result.colCount).toBe(3);
    });
  });

  describe('importTsv', () => {
    it('imports tab-separated data', () => {
      const tsv = 'A\tB\tC\n1\t2\t3';
      const result = importTsv(tsv, { hasHeader: true });
      expect(result.success).toBe(true);
      expect(result.workbook?.sheets[0].cells['0:0']?.rawValue).toBe('1');
    });
  });

  describe('exportCsv', () => {
    it('exports sheet to CSV', () => {
      const sheet = createTestSheet({
        '0:0': 'Hello',
        '0:1': 'World',
        '1:0': '42',
        '1:1': '3.14',
      });
      const csv = exportCsv(sheet);
      expect(csv).toContain('Hello');
      expect(csv).toContain('World');
    });

    it('uses specified delimiter', () => {
      const sheet = createTestSheet({ '0:0': 'a', '0:1': 'b' });
      const csv = exportCsv(sheet, '|');
      expect(csv).toContain('a|b');
    });

    it('includes computed values', () => {
      const sheet = createTestSheet({
        '0:0': { rawValue: '=1+2', computedValue: 3 } as Cell,
      });
      const csv = exportCsv(sheet);
      expect(csv).toContain('3');
    });
  });

  describe('exportTsv', () => {
    it('exports sheet as tab-separated', () => {
      const sheet = createTestSheet({ '0:0': 'a', '0:1': 'b' });
      const tsv = exportTsv(sheet);
      expect(tsv).toContain('a\tb');
    });
  });

  describe('round-trip', () => {
    it('preserves data through import and export', () => {
      const csv = 'Alice,30\nBob,25';
      const importResult = importCsv(csv);
      expect(importResult.success).toBe(true);

      const sheet = importResult.workbook!.sheets[0];
      const exported = exportCsv(sheet);
      expect(exported).toContain('Alice');
      expect(exported).toContain('30');
      expect(exported).toContain('Bob');
      expect(exported).toContain('25');
    });
  });

  describe('download functions', () => {
    beforeEach(() => {
      URL.createObjectURL = jest.fn(() => 'blob:mock');
      URL.revokeObjectURL = jest.fn();
    });

    it('downloads CSV', () => {
      const sheet = createTestSheet({ '0:0': 'A' });
      downloadCsv(sheet);
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('downloads TSV', () => {
      const sheet = createTestSheet({ '0:0': 'A' });
      downloadTsv(sheet);
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('downloads TXT', () => {
      const sheet = createTestSheet({ '0:0': 'A' });
      downloadTxt(sheet);
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('large imports', () => {
    it('handles CSV with more than 26 columns', () => {
      const headers = Array.from({ length: 30 }, (_, i) => `Col${i}`);
      const row = Array.from({ length: 30 }, (_, i) => String(i));
      const csv = [headers.join(','), row.join(',')].join('\n');

      const result = importCsv(csv, { hasHeader: true });
      expect(result.success).toBe(true);
      expect(result.colCount).toBe(30);
      expect(result.workbook!.sheets[0].columnCount).toBe(30);
    });

    it('handles CSV with many rows', () => {
      const rows: string[] = [];
      for (let r = 0; r < 1000; r++) {
        rows.push(`${r},${r * 2},${r * 3}`);
      }
      const csv = rows.join('\n');

      const result = importCsv(csv);
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1000);
      expect(result.workbook!.sheets[0].rowCount).toBe(1010); // 1000 + 10 padding
    });
  });
});

function createTestSheet(cells: Record<string, Cell | string>): Sheet {
  const cellMap: Record<string, Cell> = {};
  for (const [key, value] of Object.entries(cells)) {
    cellMap[key] = typeof value === 'string' ? { rawValue: value } : value;
  }

  return {
    id: 'test',
    name: 'Test',
    cells: cellMap,
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
