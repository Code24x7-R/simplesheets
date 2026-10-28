// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { readFileAsText, readWorkbookFile, readSpreadsheetFile, ACCEPTED_FILE_TYPES } from './fileIO';
import type { Workbook } from '../types';

jest.mock('../services/csvService', () => ({
  importCsv: jest.fn(),
  detectDelimiter: jest.fn(() => ','),
}));
jest.mock('../services/excelImport', () => ({
  importExcelFile: jest.fn(),
}));

import { importCsv, detectDelimiter } from '../services/csvService';
import { importExcelFile } from '../services/excelImport';

/** Create a minimal valid workbook JSON string. */
function makeWorkbookJson(): { json: string; wb: Workbook } {
  const wb: Workbook = {
    id: 'test-wb',
    title: 'Test',
    sheets: [
      {
        id: 'sheet-1',
        name: 'Sheet1',
        cells: { '0:0': { rawValue: 'hello' } },
        defaultColWidth: 100,
        defaultRowHeight: 28,
        columnWidths: {},
        rowHeights: {},
        columnCount: 26,
        rowCount: 1000,
        frozenColumns: 0,
        frozenRows: 0,
      },
    ],
    activeSheetIndex: 0,
    lastModified: 1_700_000_000_000,
  };
  return { json: JSON.stringify(wb), wb };
}

describe('fileIO', () => {
  describe('readFileAsText', () => {
    it('reads a text file and returns its contents', async () => {
      const { json } = makeWorkbookJson();
      const file = new File([json], 'test.json', { type: 'application/json' });
      const text = await readFileAsText(file);
      expect(text).toBe(json);
    });

    it('rejects when the reader errors', async () => {
      const file = new File(['data'], 'test.json');
      // Override FileReader to simulate a read error
      const OrigFileReader = global.FileReader;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).FileReader = jest.fn().mockImplementation(() => {
        const instance: Record<string, unknown> = {
          readAsText: jest.fn(),
          onerror: null,
          onload: null,
          result: null,
        };
        // Trigger error asynchronously so handlers are attached
        setTimeout(() => {
          if (instance.onerror) {
            (instance.onerror as (e: ProgressEvent) => void)(
              new ProgressEvent('error'),
            );
          }
        }, 0);
        return instance;
      });

      await expect(readFileAsText(file)).rejects.toBeDefined();

      // Restore
      global.FileReader = OrigFileReader;
    });
  });

  describe('readWorkbookFile', () => {
    it('reads and parses a valid workbook file', async () => {
      const { json, wb } = makeWorkbookJson();
      const file = new File([json], 'test.ssjson', { type: 'application/json' });
      const result = await readWorkbookFile(file);
      // importJson assigns a fresh id and lastModified, so compare those separately
      expect(result.id).toMatch(/^json-wb-/);
      expect(result.lastModified).toBeGreaterThan(0);
      // The rest of the workbook should match
      expect(result.title).toBe(wb.title);
      expect(result.sheets).toEqual(wb.sheets);
      expect(result.activeSheetIndex).toBe(wb.activeSheetIndex);
    });

    it('throws for invalid JSON', async () => {
      const file = new File(['not json at all'], 'bad.json', { type: 'application/json' });
      await expect(readWorkbookFile(file)).rejects.toThrow();
    });

    it('throws for JSON that is not a valid workbook', async () => {
      const file = new File([JSON.stringify({ foo: 'bar' })], 'bad.json', { type: 'application/json' });
      await expect(readWorkbookFile(file)).rejects.toThrow('Invalid workbook format');
    });
  });

  describe('ACCEPTED_FILE_TYPES', () => {
    it('includes .ssjson and .json extensions', () => {
      expect(ACCEPTED_FILE_TYPES).toContain('.ssjson');
      expect(ACCEPTED_FILE_TYPES).toContain('.json');
    });
  });

  describe('readSpreadsheetFile', () => {
    const wb = { id: 'x', title: 'X', sheets: [], activeSheetIndex: 0 } as unknown as Workbook;

    it('routes .xlsx through importExcelFile', async () => {
      jest.mocked(importExcelFile).mockResolvedValue({ success: true, workbook: wb, sheetCount: 1, cellCount: 0 });
      const file = new File(['x'], 'data.xlsx');
      await expect(readSpreadsheetFile(file)).resolves.toBe(wb);
      expect(importExcelFile).toHaveBeenCalledWith(file);
    });

    it('routes .csv through importCsv with a detected delimiter', async () => {
      jest.mocked(detectDelimiter).mockReturnValue(';');
      jest.mocked(importCsv).mockReturnValue({ success: true, workbook: wb, rowCount: 1, colCount: 1 });
      const file = new File(['a;b'], 'data.csv');
      const spy = jest.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function(this: FileReader) {
        Object.defineProperty(this, 'result', { value: 'a;b' });
        this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
      });
      await expect(readSpreadsheetFile(file)).resolves.toBe(wb);
      expect(importCsv).toHaveBeenCalledWith('a;b', { delimiter: ';' });
      spy.mockRestore();
    });

    it('throws when Excel import fails', async () => {
      jest.mocked(importExcelFile).mockResolvedValue({ success: false, error: 'bad', sheetCount: 0, cellCount: 0 });
      const file = new File(['x'], 'data.xlsx');
      await expect(readSpreadsheetFile(file)).rejects.toThrow('bad');
    });
  });
});
