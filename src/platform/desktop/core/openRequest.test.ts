// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  MAX_OPEN_BYTES,
  isSpreadsheetImportPath,
  isSupportedOpenPath,
} from './openRequest';

describe('isSupportedOpenPath', () => {
  it.each([
    'budget.ssjson',
    'budget.json',
    'budget.xlsx',
    'budget.xls',
    'budget.csv',
    'budget.tsv',
    'budget.txt',
    'C:\\Users\\me\\BUDGET.SSJSON',
    '/home/me/budget.Xlsx',
  ])('accepts %s', (file) => {
    expect(isSupportedOpenPath(file)).toBe(true);
  });

  it.each([
    'budget.ssjson.bak',
    'budget.xlsx.tmp',
    'budget',
    'budget.pdf',
    'budget.exe',
    'budget.jsonc',
    '',
  ])('rejects %s', (file) => {
    expect(isSupportedOpenPath(file)).toBe(false);
  });
});

describe('isSpreadsheetImportPath', () => {
  it.each(['a.xlsx', 'a.xls', 'a.csv', 'a.tsv', 'a.txt', 'A.CSV'])(
    'routes %s through the import scope dialog',
    (file) => {
      expect(isSpreadsheetImportPath(file)).toBe(true);
    },
  );

  it.each(['a.ssjson', 'a.json', 'a.pdf', 'a'])(
    'opens %s as a document',
    (file) => {
      expect(isSpreadsheetImportPath(file)).toBe(false);
    },
  );
});

describe('MAX_OPEN_BYTES', () => {
  it('is 100 MB', () => {
    expect(MAX_OPEN_BYTES).toBe(100 * 1024 * 1024);
  });
});
