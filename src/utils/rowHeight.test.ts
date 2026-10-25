// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  measureTextWidth,
  countWrappedLines,
  computeAutoRowHeight,
  computeAutoRowHeights,
  applyAutoRowHeights,
  isWrappedCell,
  ROW_LINE_HEIGHT,
  LINE_HEIGHT_RATIO,
  lineHeightForFont,
} from './rowHeight';
import type { Sheet } from '../types';

/** Deterministic canvas mock: every character is `charWidth` px wide. */
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

describe('measureTextWidth', () => {
  it('measures with the mocked canvas font', () => {
    const spy = mockCanvas(8);
    try {
      expect(measureTextWidth('hello')).toBe(40);
    } finally {
      spy.mockRestore();
    }
  });

  it('falls back to a per-character estimate without a canvas', () => {
    // jsdom has no canvas 2d context; the fallback is length * 8.
    const spy = jest.spyOn(document, 'createElement').mockReturnValue({
      getContext: () => null,
    } as unknown as HTMLCanvasElement);
    try {
      expect(measureTextWidth('abc')).toBe(24);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('countWrappedLines', () => {
  const spy = mockCanvas(8);
  afterAll(() => spy.mockRestore());

  it('returns 1 for text that fits on one line', () => {
    expect(countWrappedLines('hello', 100)).toBe(1);
  });

  it('counts explicit newlines', () => {
    expect(countWrappedLines('a\nb\nc', 100)).toBe(3);
  });

  it('wraps long text to multiple lines based on width', () => {
    // usable = 100 - 12 = 88px; 8px/char → 11 chars per line.
    expect(countWrappedLines('x'.repeat(50), 100)).toBe(5);
  });

  it('wraps at word boundaries when possible', () => {
    // 'hello world foo' = 15 chars = 120px > 88px.
    expect(countWrappedLines('hello world foo', 100)).toBe(2);
  });

  it('breaks a word longer than the line', () => {
    // 30 chars = 240px; 11 chars/line → 3 lines.
    expect(countWrappedLines('y'.repeat(30), 100)).toBe(3);
  });

  it('narrower columns produce more lines', () => {
    const wide = countWrappedLines('word '.repeat(10), 200);
    const narrow = countWrappedLines('word '.repeat(10), 60);
    expect(narrow).toBeGreaterThan(wide);
  });

  it('preserves whitespace for pre-wrap', () => {
    // Leading spaces count toward the width when preserved.
    const collapsed = countWrappedLines('    abcdefghijklmnop', 60);
    const preserved = countWrappedLines('    abcdefghijklmnop', 60, undefined, true);
    expect(preserved).toBeGreaterThanOrEqual(collapsed);
  });
});

describe('computeAutoRowHeight', () => {
  const spy = mockCanvas(8);
  afterAll(() => spy.mockRestore());

  it('returns the default height for a single line', () => {
    expect(computeAutoRowHeight('hello', 100, 28)).toBe(28);
  });

  it('scales with the number of wrapped lines', () => {
    // 5 lines * 28px line-height.
    expect(computeAutoRowHeight('x'.repeat(50), 100, 28)).toBe(5 * ROW_LINE_HEIGHT);
  });

  it('never goes below the default height', () => {
    expect(computeAutoRowHeight('', 100, 40)).toBe(40);
  });

  it('uses the same line height as the grid for the default font', () => {
    expect(computeAutoRowHeight('x'.repeat(50), 100, 28, undefined, false, 14)).toBe(5 * ROW_LINE_HEIGHT);
  });

  it('scales the line height for larger fonts', () => {
    // 1 line at 14px -> 28px; 1 line at 36px -> 36 * 1.4 = 50px.
    const small = computeAutoRowHeight('hello', 400, 28, undefined, false, 14);
    const large = computeAutoRowHeight('hello', 400, 28, undefined, false, 36);
    expect(small).toBe(ROW_LINE_HEIGHT);
    expect(large).toBe(lineHeightForFont(36));
    expect(large).toBeGreaterThan(small);
  });
});

describe('lineHeightForFont', () => {
  it('floors at the default grid line height', () => {
    expect(lineHeightForFont(8)).toBe(ROW_LINE_HEIGHT);
    expect(lineHeightForFont(14)).toBe(ROW_LINE_HEIGHT);
    expect(lineHeightForFont(20)).toBe(ROW_LINE_HEIGHT);
  });

  it('scales for larger fonts', () => {
    expect(lineHeightForFont(24)).toBe(Math.round(24 * LINE_HEIGHT_RATIO));
    expect(lineHeightForFont(36)).toBe(Math.round(36 * LINE_HEIGHT_RATIO));
  });
});

describe('computeAutoRowHeights', () => {
  const spy = mockCanvas(8);
  afterAll(() => spy.mockRestore());

  it('includes only rows with wrapped cells', () => {
    const sheet = createSheet({
      cells: {
        '0:0': { rawValue: 'x'.repeat(50), style: { whiteSpace: 'normal' } },
        '1:0': { rawValue: 'x'.repeat(50) }, // no wrap
      },
    });
    const heights = computeAutoRowHeights(sheet);
    expect(0 in heights).toBe(true);
    expect(1 in heights).toBe(false);
  });

  it('uses the column width override', () => {
    const sheet = createSheet({
      columnWidths: { 0: 400 },
      cells: {
        '0:0': { rawValue: 'x'.repeat(50), style: { whiteSpace: 'normal' } },
      },
    });
    // 400 - 12 = 388px usable → 48 chars/line → 2 lines.
    expect(computeAutoRowHeights(sheet)[0]).toBe(2 * ROW_LINE_HEIGHT);
  });

  it('scales a row by its wrapped cell font size', () => {
    const sheet = createSheet({
      cells: {
        '0:0': { rawValue: 'hello', style: { whiteSpace: 'normal', fontSize: 36 } },
      },
    });
    expect(computeAutoRowHeights(sheet)[0]).toBe(lineHeightForFont(36));
  });

  it('takes the tallest wrapped cell in a row', () => {
    const sheet = createSheet({
      cells: {
        '2:0': { rawValue: 'short', style: { whiteSpace: 'normal' } },
        '2:1': { rawValue: 'x'.repeat(60), style: { whiteSpace: 'normal' } },
      },
    });
    const heights = computeAutoRowHeights(sheet);
    expect(heights[2]).toBe(computeAutoRowHeight('x'.repeat(60), 100, 28));
  });
});

describe('applyAutoRowHeights', () => {
  const spy = mockCanvas(8);
  afterAll(() => spy.mockRestore());

  it('sets heights for wrapped rows', () => {
    const sheet = createSheet({
      cells: { '0:0': { rawValue: 'x'.repeat(50), style: { whiteSpace: 'normal' } } },
    });
    const next = applyAutoRowHeights(sheet);
    expect(next.rowHeights[0]).toBe(5 * ROW_LINE_HEIGHT);
  });

  it('reverts a row that was auto-fit but no longer wraps', () => {
    const sheet = createSheet({
      cells: { '0:0': { rawValue: 'x'.repeat(50), style: { whiteSpace: 'normal' } } },
    });
    const auto = computeAutoRowHeights(sheet);
    const unwrapped = applyAutoRowHeights({
      ...sheet,
      cells: { '0:0': { rawValue: 'x'.repeat(50), style: { whiteSpace: 'nowrap' } } },
    }, auto);
    expect(unwrapped.rowHeights[0]).toBeUndefined();
  });

  it('preserves manual heights on rows without wrapped cells', () => {
    const sheet = createSheet({
      rowHeights: { 3: 80 },
      cells: { '0:0': { rawValue: 'x'.repeat(50), style: { whiteSpace: 'normal' } } },
    });
    const next = applyAutoRowHeights(sheet);
    expect(next.rowHeights[3]).toBe(80);
    expect(next.rowHeights[0]).toBe(5 * ROW_LINE_HEIGHT);
  });
});

describe('isWrappedCell', () => {
  it('detects normal and pre wrap', () => {
    expect(isWrappedCell({ rawValue: '', style: { whiteSpace: 'normal' } })).toBe(true);
    expect(isWrappedCell({ rawValue: '', style: { whiteSpace: 'pre' } })).toBe(true);
  });

  it('rejects nowrap and undefined styles', () => {
    expect(isWrappedCell({ rawValue: '', style: { whiteSpace: 'nowrap' } })).toBe(false);
    expect(isWrappedCell({ rawValue: '' })).toBe(false);
    expect(isWrappedCell(undefined)).toBe(false);
  });
});
