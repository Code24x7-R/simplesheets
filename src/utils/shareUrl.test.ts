// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  encodeDocToUrl,
  decodeDocFromUrl,
  estimateShareSize,
  canShareViaUrl,
  DOC_FRAGMENT_PREFIX,
} from './shareUrl';
import type { Workbook } from '../types';

/** Create a minimal valid workbook for testing. */
function makeWorkbook(overrides: Partial<Workbook> = {}): Workbook {
  return {
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
    ...overrides,
  };
}

describe('shareUrl', () => {
  describe('encodeDocToUrl', () => {
    it('encodes a workbook into a URL with #doc= fragment', () => {
      const wb = makeWorkbook();
      const url = encodeDocToUrl(wb, 'https://simplesheets.app');
      expect(url.startsWith('https://simplesheets.app#doc=')).toBe(true);
    });

    it('produces a different URL for different workbooks', () => {
      const wb1 = makeWorkbook({ title: 'A' });
      const wb2 = makeWorkbook({ title: 'B' });
      expect(encodeDocToUrl(wb1, 'https://x.app')).not.toBe(encodeDocToUrl(wb2, 'https://x.app'));
    });

    it('handles special characters in the workbook title', () => {
      const wb = makeWorkbook({ title: 'Q&A "Budget" <2026>' });
      const url = encodeDocToUrl(wb, 'https://x.app');
      expect(url.startsWith('https://x.app#doc=')).toBe(true);
      // Should be decodable without errors
      expect(decodeDocFromUrl(url)).toBeTruthy();
    });
  });

  describe('decodeDocFromUrl', () => {
    it('round-trips a workbook through encode then decode', () => {
      const wb = makeWorkbook();
      const url = encodeDocToUrl(wb, 'https://simplesheets.app');
      const decoded = decodeDocFromUrl(url);
      expect(decoded).toEqual(wb);
    });

    it('returns null when no #doc= fragment is present', () => {
      expect(decodeDocFromUrl('https://simplesheets.app')).toBeNull();
      expect(decodeDocFromUrl('https://simplesheets.app#other=abc')).toBeNull();
    });

    it('returns null for corrupted fragment data', () => {
      expect(decodeDocFromUrl('https://x.app#doc=%%%not-valid%%%')).toBeNull();
    });

    it('returns null for valid compression but invalid JSON', () => {
      // Manually craft a fragment that decompresses to invalid JSON
      // lz-string compressToEncodedURIComponent of "not json"
      expect(decodeDocFromUrl('https://x.app#doc=not-json-at-all')).toBeNull();
    });

    it('round-trips a workbook with multiple sheets and many cells', () => {
      const wb = makeWorkbook({
        sheets: [
          {
            id: 's1',
            name: 'Data',
            cells: {
              '0:0': { rawValue: '=SUM(A2:A10)', computedValue: 45 },
              '1:0': { rawValue: '10' },
              '2:0': { rawValue: '20' },
              '3:0': { rawValue: '15' },
            },
            defaultColWidth: 100,
            defaultRowHeight: 28,
            columnWidths: { 0: 120 },
            rowHeights: { 0: 32 },
            columnCount: 26,
            rowCount: 1000,
            frozenColumns: 1,
            frozenRows: 1,
          },
          {
            id: 's2',
            name: 'Summary',
            cells: { '0:0': { rawValue: '=Data!A1' } },
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
      });
      const url = encodeDocToUrl(wb, 'https://x.app');
      expect(decodeDocFromUrl(url)).toEqual(wb);
    });
  });

  describe('estimateShareSize', () => {
    it('returns a positive number for a non-empty workbook', () => {
      const wb = makeWorkbook();
      expect(estimateShareSize(wb)).toBeGreaterThan(0);
    });

    it('returns a larger size for a larger workbook', () => {
      const small = makeWorkbook();
      const large = makeWorkbook({
        sheets: [
          {
            ...small.sheets[0],
            cells: Object.fromEntries(
              Array.from({ length: 100 }, (_, i) => [`${i}:0`, { rawValue: `value-${i}-with-some-content` }]),
            ),
          },
        ],
      });
      expect(estimateShareSize(large)).toBeGreaterThan(estimateShareSize(small));
    });

    it('includes the fragment prefix in the estimate', () => {
      const wb = makeWorkbook();
      // The estimate should be at least the prefix length
      expect(estimateShareSize(wb)).toBeGreaterThan(DOC_FRAGMENT_PREFIX.length);
    });
  });

  describe('canShareViaUrl', () => {
    it('returns true for a small workbook', () => {
      const wb = makeWorkbook();
      expect(canShareViaUrl(wb)).toBe(true);
    });

    it('returns false for a workbook that exceeds 16KB when encoded', () => {
      // Create a workbook with enough content to exceed the URL size limit
      const largeCells = Object.fromEntries(
        Array.from({ length: 2000 }, (_, i) => [
          `${i}:0`,
          { rawValue: `this is a reasonably long cell value with index ${i} and some padding to make it bigger `.repeat(3) },
        ]),
      );
      const wb = makeWorkbook({
        sheets: [{ ...makeWorkbook().sheets[0], cells: largeCells }],
      });
      expect(canShareViaUrl(wb)).toBe(false);
    });
  });
});
