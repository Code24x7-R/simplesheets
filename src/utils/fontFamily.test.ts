// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  buildCanvasFont,
  cssFontFamily,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_FAMILY_LABEL,
  listSystemFontFamilies,
  normalizeFontFamily,
  resetFontFamilyCache,
  COMMON_FONT_FAMILIES,
} from './fontFamily';

function setLocalFontsApi(api: (() => Promise<Array<{ family?: string }>>) | undefined): void {
  Object.defineProperty(window, 'queryLocalFonts', {
    configurable: true,
    writable: true,
    value: api,
  });
}

afterEach(() => {
  setLocalFontsApi(undefined);
  resetFontFamilyCache();
  jest.restoreAllMocks();
});

describe('fontFamily', () => {
  it('normalizes empty and whitespace-only values', () => {
    expect(normalizeFontFamily(undefined)).toBeUndefined();
    expect(normalizeFontFamily('   ')).toBeUndefined();
    expect(normalizeFontFamily('  Calibri  ')).toBe('Calibri');
  });

  it('falls back to the grid monospace stack', () => {
    expect(cssFontFamily(undefined)).toBe(DEFAULT_FONT_FAMILY);
    expect(DEFAULT_FONT_FAMILY_LABEL).toBe('Default (monospace)');
  });

  it('builds canvas fonts with weight, style, and quoted family names', () => {
    expect(buildCanvasFont(14)).toBe(`14px ${DEFAULT_FONT_FAMILY}`);
    expect(buildCanvasFont(20, 'Times New Roman')).toBe('20px "Times New Roman"');
    expect(buildCanvasFont(20, 'Arial', 'bold', 'italic')).toBe('italic 700 20px Arial');
    expect(buildCanvasFont(20, 'Arial, sans-serif', 'normal')).toBe('20px Arial, sans-serif');
  });

  it('enumerates, deduplicates, and sorts installed families', async () => {
    setLocalFontsApi(async () => [
      { family: 'Verdana' },
      { family: 'Arial' },
      { family: 'Verdana' },
      { family: '   ' },
    ]);
    await expect(listSystemFontFamilies()).resolves.toEqual({
      families: ['Arial', 'Verdana'],
      source: 'system',
    });
  });

  it('falls back to common families when the API is unavailable', async () => {
    const result = await listSystemFontFamilies();
    expect(result.source).toBe('fallback');
    expect(result.families).toEqual([...COMMON_FONT_FAMILIES]);
  });

  it('falls back when the user denies font access', async () => {
    setLocalFontsApi(async () => {
      throw new Error('denied');
    });
    const result = await listSystemFontFamilies();
    expect(result.source).toBe('fallback');
    expect(result.families).toContain('Calibri');
  });

  it('falls back when the API returns no usable families', async () => {
    setLocalFontsApi(async () => [{ family: '' }]);
    await expect(listSystemFontFamilies()).resolves.toEqual({
      families: [...COMMON_FONT_FAMILIES],
      source: 'fallback',
    });
  });

  it('caches the result until reset', async () => {
    const api = jest.fn(async () => [{ family: 'Calibri' }]);
    setLocalFontsApi(api);
    await listSystemFontFamilies();
    await listSystemFontFamilies();
    expect(api).toHaveBeenCalledTimes(1);
  });
});
