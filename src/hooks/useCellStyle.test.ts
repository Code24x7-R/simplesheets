import {
  deriveCellStyleState,
  mergeCellStyle,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  clearStyles,
  DEFAULTCellStyle,
  COLOR_PALETTE,
  NUMBER_FORMATS,
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
    });
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
