// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  deriveCellStyleState,
  mergeCellStyle,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleWrapText,
  clearStyles,
  DEFAULTCellStyle,
  COLOR_PALETTE,
  COLOR_LABELS,
  NUMBER_FORMATS,
  makeBorder,
  BORDER_PRESETS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_BORDER_STYLE,
  DEFAULT_BORDER_COLOR,
  DEFAULT_FONT_SIZE,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  FONT_SIZES,
  clampFontSize,
} from './useCellStyle';
import type { CellStyle } from '../types';

describe('deriveCellStyleState', () => {
  it('returns defaults for undefined style', () => {
    expect(deriveCellStyleState(undefined)).toEqual(DEFAULTCellStyle);
  });

  it('returns defaults for empty style object', () => {
    expect(deriveCellStyleState({})).toEqual(DEFAULTCellStyle);
  });

  it('preserves existing values', () => {
    const style: CellStyle = { fontWeight: 'bold', color: '#FF0000' };
    const result = deriveCellStyleState(style);
    expect(result.fontWeight).toBe('bold');
    expect(result.color).toBe('#FF0000');
    expect(result.fontStyle).toBe('normal'); // default
    expect(result.textAlign).toBe('left'); // default
  });

  it('handles numeric fontWeight', () => {
    const style: CellStyle = { fontWeight: 700 };
    expect(deriveCellStyleState(style).fontWeight).toBe(700);
  });

  it('handles all properties set', () => {
    const style: CellStyle = {
      fontWeight: 'bold',
      fontStyle: 'italic',
      fontSize: 20,
      textDecoration: 'underline',
      color: '#000000',
      backgroundColor: '#FFFFFF',
      textAlign: 'center',
      numberFormat: '0.00',
      whiteSpace: 'normal',
    };
    const result = deriveCellStyleState(style);
    expect(result).toEqual({
      fontWeight: 'bold',
      fontStyle: 'italic',
      fontSize: 20,
      textDecoration: 'underline',
      color: '#000000',
      backgroundColor: '#FFFFFF',
      textAlign: 'center',
      numberFormat: '0.00',
      whiteSpace: 'normal',
    });
  });
});

describe('toggleWrapText', () => {
  it('toggles nowrap to normal', () => {
    expect(toggleWrapText(DEFAULTCellStyle)).toBe('normal');
  });

  it('toggles normal to nowrap', () => {
    expect(toggleWrapText({ ...DEFAULTCellStyle, whiteSpace: 'normal' })).toBe('nowrap');
  });
});

describe('mergeCellStyle', () => {
  it('returns the update when no existing style', () => {
    expect(mergeCellStyle(undefined, { fontWeight: 'bold' })).toEqual({ fontWeight: 'bold' });
  });

  it('merges update into existing style', () => {
    const existing: CellStyle = { color: '#FF0000', fontWeight: 'normal' };
    const result = mergeCellStyle(existing, { fontWeight: 'bold' });
    expect(result).toEqual({ color: '#FF0000', fontWeight: 'bold' });
  });

  it('does not mutate the original', () => {
    const existing: CellStyle = { color: '#FF0000' };
    const result = mergeCellStyle(existing, { fontWeight: 'bold' });
    expect(existing).toEqual({ color: '#FF0000' });
    expect(result).not.toBe(existing);
  });
});

describe('toggleBold', () => {
  it('toggles normal to bold', () => {
    expect(toggleBold(DEFAULTCellStyle)).toBe('bold');
  });

  it('toggles bold to normal', () => {
    expect(toggleBold({ ...DEFAULTCellStyle, fontWeight: 'bold' })).toBe('normal');
  });

  it('toggles numeric weight to normal', () => {
    expect(toggleBold({ ...DEFAULTCellStyle, fontWeight: 700 })).toBe('normal');
  });
});

describe('toggleItalic', () => {
  it('toggles normal to italic', () => {
    expect(toggleItalic(DEFAULTCellStyle)).toBe('italic');
  });

  it('toggles italic to normal', () => {
    expect(toggleItalic({ ...DEFAULTCellStyle, fontStyle: 'italic' })).toBe('normal');
  });
});

describe('toggleUnderline', () => {
  it('cycles none to underline', () => {
    expect(toggleUnderline(DEFAULTCellStyle)).toBe('underline');
  });

  it('cycles underline to line-through', () => {
    expect(toggleUnderline({ ...DEFAULTCellStyle, textDecoration: 'underline' })).toBe('line-through');
  });

  it('cycles line-through to none', () => {
    expect(toggleUnderline({ ...DEFAULTCellStyle, textDecoration: 'line-through' })).toBe('none');
  });
});

describe('font size constants', () => {
  it('DEFAULT_FONT_SIZE matches the grid text-sm size', () => {
    expect(DEFAULT_FONT_SIZE).toBe(14);
  });

  it('FONT_SIZES contains the Excel standard size list', () => {
    expect(FONT_SIZES).toEqual([8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]);
  });

  it('all FONT_SIZES are within the supported range', () => {
    for (const size of FONT_SIZES) {
      expect(size).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
      expect(size).toBeLessThanOrEqual(MAX_FONT_SIZE);
    }
  });

  it('FONT_SIZES is strictly increasing', () => {
    for (let i = 1; i < FONT_SIZES.length; i++) {
      expect(FONT_SIZES[i]).toBeGreaterThan(FONT_SIZES[i - 1]);
    }
  });
});

describe('clampFontSize', () => {
  it('passes through in-range values', () => {
    expect(clampFontSize(12)).toBe(12);
    expect(clampFontSize(72)).toBe(72);
  });

  it('clamps below the minimum', () => {
    expect(clampFontSize(4)).toBe(MIN_FONT_SIZE);
  });

  it('clamps above the maximum', () => {
    expect(clampFontSize(500)).toBe(MAX_FONT_SIZE);
  });

  it('rounds fractional values', () => {
    expect(clampFontSize(13.6)).toBe(14);
  });

  it('falls back to the default for non-finite values', () => {
    expect(clampFontSize(NaN)).toBe(DEFAULT_FONT_SIZE);
    expect(clampFontSize(Infinity)).toBe(DEFAULT_FONT_SIZE);
  });
});

describe('clearStyles', () => {
  it('returns an empty object', () => {
    expect(clearStyles()).toEqual({});
  });
});

describe('COLOR_PALETTE', () => {
  it('contains the common 16 colors (2 rows x 8 columns)', () => {
    expect(COLOR_PALETTE).toHaveLength(16);
  });

  it('matches the Excel standard color set', () => {
    expect(COLOR_PALETTE).toEqual([
      '#000000', '#595959', '#A6A6A6', '#D9D9D9', '#F2F2F2', '#FFFFFF', '#C00000', '#FF0000',
      '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0',
    ]);
  });

  it('all entries are valid hex colors', () => {
    for (const color of COLOR_PALETTE) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('COLOR_LABELS', () => {
  it('has a label for every palette color', () => {
    for (const color of COLOR_PALETTE) {
      expect(COLOR_LABELS[color]).toBeTruthy();
    }
  });

  it('has no duplicate labels', () => {
    const labels = COLOR_PALETTE.map((color) => COLOR_LABELS[color]);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('NUMBER_FORMATS', () => {
  it('contains 7 presets', () => {
    expect(NUMBER_FORMATS).toHaveLength(7);
  });

  it('has General as first preset', () => {
    expect(NUMBER_FORMATS[0].label).toBe('General');
  });

  it('each preset has label and value', () => {
    for (const fmt of NUMBER_FORMATS) {
      expect(fmt.label).toBeTruthy();
      expect(fmt.value).toBeTruthy();
    }
  });
});

describe('makeBorder', () => {
  it('creates a CSS border string', () => {
    expect(makeBorder('1px', 'solid', '#000000')).toBe('1px solid #000000');
  });

  it('creates a thick border', () => {
    expect(makeBorder('3px', 'solid', '#FF0000')).toBe('3px solid #FF0000');
  });

  it('creates a dashed border', () => {
    expect(makeBorder('1px', 'dashed', '#333333')).toBe('1px dashed #333333');
  });

  it('returns "none" for none style', () => {
    expect(makeBorder('0', 'none', '#000000')).toBe('none');
  });

  it('returns "none" for 0 width', () => {
    expect(makeBorder('0', 'solid', '#000000')).toBe('none');
  });
});

describe('BORDER_PRESETS', () => {
  it('contains 8 presets', () => {
    expect(BORDER_PRESETS).toHaveLength(8);
  });

  it('first preset is None', () => {
    expect(BORDER_PRESETS[0].label).toBe('None');
    expect(BORDER_PRESETS[0].style).toBe('none');
  });

  it('has Thin as second preset', () => {
    expect(BORDER_PRESETS[1].label).toBe('Thin');
    expect(BORDER_PRESETS[1].width).toBe('1px');
    expect(BORDER_PRESETS[1].style).toBe('solid');
  });

  it('each preset has label, width, and style', () => {
    for (const preset of BORDER_PRESETS) {
      expect(preset.label).toBeTruthy();
      expect(preset.width).toBeTruthy();
      expect(preset.style).toBeTruthy();
    }
  });
});

describe('default border constants', () => {
  it('DEFAULT_BORDER_WIDTH is 1px', () => {
    expect(DEFAULT_BORDER_WIDTH).toBe('1px');
  });

  it('DEFAULT_BORDER_STYLE is solid', () => {
    expect(DEFAULT_BORDER_STYLE).toBe('solid');
  });

  it('DEFAULT_BORDER_COLOR is black', () => {
    expect(DEFAULT_BORDER_COLOR).toBe('#000000');
  });
});
