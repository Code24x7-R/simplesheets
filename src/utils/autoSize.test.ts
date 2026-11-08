// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import type { Sheet } from '../types';
import {
  clampColumnWidth,
  clampRowHeight,
  computeAutoFitColumnWidth,
  computeAutoFitRowHeight,
  MAX_COLUMN_WIDTH,
  MAX_ROW_HEIGHT,
  MIN_COLUMN_WIDTH,
  MIN_ROW_HEIGHT,
} from './autoSize';

function mockCanvas(charWidth: number) {
  const original = document.createElement.bind(document);
  const ctx = {
    font: '',
    measureText: (text: string) => ({ width: text.length * charWidth }),
  };
  return jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
    if (tagName === 'canvas') return { getContext: () => ctx } as unknown as HTMLCanvasElement;
    return original(tagName);
  }) as typeof document.createElement);
}

function createSheet(overrides: Partial<Sheet> = {}): Sheet {
  return {
    id: 's1',
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
    ...overrides,
  };
}

describe('autoSize', () => {
  const spy = mockCanvas(8);
  afterAll(() => spy.mockRestore());

  describe('clamps', () => {
    it('keeps column widths within the resize-handle bounds', () => {
      expect(clampColumnWidth(1)).toBe(MIN_COLUMN_WIDTH);
      expect(clampColumnWidth(200)).toBe(200);
      expect(clampColumnWidth(9999)).toBe(MAX_COLUMN_WIDTH);
      expect(clampColumnWidth(Number.NaN)).toBe(MIN_COLUMN_WIDTH);
    });

    it('keeps row heights within the resize-handle bounds', () => {
      expect(clampRowHeight(1)).toBe(MIN_ROW_HEIGHT);
      expect(clampRowHeight(50)).toBe(50);
      expect(clampRowHeight(9999)).toBe(MAX_ROW_HEIGHT);
      expect(clampRowHeight(Number.NaN)).toBe(MIN_ROW_HEIGHT);
    });
  });

  describe('computeAutoFitColumnWidth', () => {
    it('fits the longest displayed line plus padding', () => {
      const sheet = createSheet({
        cells: {
          '0:0': { rawValue: 'Hello' },
          '1:0': { rawValue: 'Hello\nWorld' },
        },
      });
      // 5 chars * 8px + 12px padding + 2px buffer.
      expect(computeAutoFitColumnWidth(sheet, 0)).toBe(54);
    });

    it('returns the minimum width for an empty column', () => {
      expect(computeAutoFitColumnWidth(createSheet(), 3)).toBe(MIN_COLUMN_WIDTH);
    });

    it('caps very wide content at the maximum', () => {
      const sheet = createSheet({ cells: { '0:0': { rawValue: 'x'.repeat(200) } } });
      expect(computeAutoFitColumnWidth(sheet, 0)).toBe(MAX_COLUMN_WIDTH);
    });

    it('uses the computed value for formula cells', () => {
      const sheet = createSheet({
        cells: { '0:0': { rawValue: '=SUM(A1:A10)', computedValue: 12345 } },
      });
      // "12345" is narrower than the formula text; the displayed value wins.
      expect(computeAutoFitColumnWidth(sheet, 0)).toBe(54);
    });
  });

  describe('computeAutoFitRowHeight', () => {
    it('fits wrapped content at the current column width', () => {
      const sheet = createSheet({
        cells: { '0:0': { rawValue: 'x'.repeat(50), style: { whiteSpace: 'normal' } } },
      });
      expect(computeAutoFitRowHeight(sheet, 0)).toBe(5 * MIN_ROW_HEIGHT);
    });

    it('does not expand rows for nowrap content', () => {
      const sheet = createSheet({
        cells: { '0:0': { rawValue: 'x'.repeat(50) } },
      });
      expect(computeAutoFitRowHeight(sheet, 0)).toBe(MIN_ROW_HEIGHT);
    });

    it('expands for a larger font even on one line', () => {
      const sheet = createSheet({
        cells: { '0:0': { rawValue: 'Hello', style: { fontSize: 36 } } },
      });
      expect(computeAutoFitRowHeight(sheet, 0)).toBe(50);
    });

    it('uses the column width override when wrapping', () => {
      const sheet = createSheet({
        columnWidths: { 0: 400 },
        cells: { '0:0': { rawValue: 'x'.repeat(50), style: { whiteSpace: 'normal' } } },
      });
      expect(computeAutoFitRowHeight(sheet, 0)).toBe(2 * MIN_ROW_HEIGHT);
    });

    it('counts explicit newlines', () => {
      const sheet = createSheet({
        cells: { '0:0': { rawValue: 'a\nb\nc' } },
      });
      expect(computeAutoFitRowHeight(sheet, 0)).toBe(3 * MIN_ROW_HEIGHT);
    });

    it('returns the minimum height for an empty row', () => {
      expect(computeAutoFitRowHeight(createSheet(), 4)).toBe(MIN_ROW_HEIGHT);
    });

    it('caps very tall content at the maximum', () => {
      const sheet = createSheet({
        cells: { '0:0': { rawValue: 'x'.repeat(5000), style: { whiteSpace: 'normal' } } },
      });
      expect(computeAutoFitRowHeight(sheet, 0)).toBe(MAX_ROW_HEIGHT);
    });
  });
});
