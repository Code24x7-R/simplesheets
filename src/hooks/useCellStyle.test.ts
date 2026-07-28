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
  NUMBER_FORMATS,
  makeBorder,
  BORDER_PRESETS,
  BORDER_COLORS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_BORDER_STYLE,
  DEFAULT_BORDER_COLOR,
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

describe('clearStyles', () => {
  it('returns an empty object', () => {
    expect(clearStyles()).toEqual({});
  });
});

describe('COLOR_PALETTE', () => {
  it('contains 80 colors (10 columns x 8 rows)', () => {
    expect(COLOR_PALETTE).toHaveLength(80);
  });

  it('all entries are valid hex colors', () => {
    for (const color of COLOR_PALETTE) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
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

describe('BORDER_COLORS', () => {
  it('contains 16 colors', () => {
    expect(BORDER_COLORS).toHaveLength(16);
  });

  it('first color is black', () => {
    expect(BORDER_COLORS[0]).toBe('#000000');
  });

  it('all entries are valid hex colors', () => {
    for (const color of BORDER_COLORS) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
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
