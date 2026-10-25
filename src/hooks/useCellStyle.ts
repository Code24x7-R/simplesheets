// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import type { CellStyle } from '../types';

/**
 * Represents a cell border edge.
 */
export type BorderEdge = 'top' | 'bottom' | 'left' | 'right';

/**
 * Represents a border style preset.
 */
export interface BorderPreset {
  label: string;
  width: string;
  style: string;
}

/**
 * Common border style presets.
 */
export const BORDER_PRESETS: BorderPreset[] = [
  { label: 'None', width: '0', style: 'none' },
  { label: 'Thin', width: '1px', style: 'solid' },
  { label: 'Medium', width: '2px', style: 'solid' },
  { label: 'Thick', width: '3px', style: 'solid' },
  { label: 'Double', width: '3px', style: 'double' },
  { label: 'Dashed', width: '1px', style: 'dashed' },
  { label: 'Dotted', width: '1px', style: 'dotted' },
  { label: 'Hair', width: '1px', style: 'solid' },
];

/**
 * The common 16-color palette used by the text, fill, and border color
 * pickers.
 *
 * Mirrors Excel's color picker: the 10 Excel "Standard Colors" plus the 6
 * Excel theme neutrals (black, white, and four grays). Laid out as two rows
 * of eight to match the picker's `repeat(8)` grid.
 *
 * Row 1 — neutrals:
 *   Black #000000, Dark Gray #595959, Gray #A6A6A6, Light Gray #D9D9D9,
 *   Lighter Gray #F2F2F2, White #FFFFFF, Dark Red #C00000, Red #FF0000
 * Row 2 — Excel Standard Colors:
 *   Orange #FFC000, Yellow #FFFF00, Light Green #92D050, Green #00B050,
 *   Light Blue #00B0F0, Blue #0070C0, Dark Blue #002060, Purple #7030A0
 */
export const COLOR_PALETTE = [
  '#000000',
  '#595959',
  '#A6A6A6',
  '#D9D9D9',
  '#F2F2F2',
  '#FFFFFF',
  '#C00000',
  '#FF0000',
  '#FFC000',
  '#FFFF00',
  '#92D050',
  '#00B050',
  '#00B0F0',
  '#0070C0',
  '#002060',
  '#7030A0',
];

/**
 * Human-readable label for each palette color, keyed by hex value.
 * Used by menus so every picker shows the same names.
 */
export const COLOR_LABELS: Record<string, string> = {
  '#000000': 'Black',
  '#595959': 'Dark Gray',
  '#A6A6A6': 'Gray',
  '#D9D9D9': 'Light Gray',
  '#F2F2F2': 'Lighter Gray',
  '#FFFFFF': 'White',
  '#C00000': 'Dark Red',
  '#FF0000': 'Red',
  '#FFC000': 'Orange',
  '#FFFF00': 'Yellow',
  '#92D050': 'Light Green',
  '#00B050': 'Green',
  '#00B0F0': 'Light Blue',
  '#0070C0': 'Blue',
  '#002060': 'Dark Blue',
  '#7030A0': 'Purple',
};

/** Default font size for grid cells (Tailwind `text-sm`). */
export const DEFAULT_FONT_SIZE = 14;

/** Smallest font size offered by the UI. */
export const MIN_FONT_SIZE = 8;

/** Largest font size offered by the UI. */
export const MAX_FONT_SIZE = 72;

/**
 * Font sizes offered by the font-size pickers (menu + toolbar).
 * Mirrors Excel's standard size list.
 */
export const FONT_SIZES = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72,
];

/**
 * Snaps a font size to the nearest entry in `FONT_SIZES`.
 *
 * This is what a typed (custom) size resolves to. Values outside the range
 * snap to the nearest bound (8 or 72), and exact midpoints round up:
 * 11.5 → 12, 13 → 14, 30 → 28. Non-finite values fall back to the default.
 */
export function snapFontSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_FONT_SIZE;
  let best = FONT_SIZES[0];
  let bestDistance = Infinity;
  for (const candidate of FONT_SIZES) {
    const distance = Math.abs(candidate - size);
    // `<` keeps the first (smaller) candidate on a tie; `candidate > best`
    // then flips it to the larger one, i.e. round half up.
    if (distance < bestDistance || (distance === bestDistance && candidate > best)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Constructs a CSS border string from width, style, and color.
 */
export function makeBorder(width: string, style: string, color: string): string {
  if (style === 'none' || width === '0') return 'none';
  return `${width} ${style} ${color}`;
}

/**
 * Default border style used when applying borders.
 */
export const DEFAULT_BORDER_WIDTH = '1px';
export const DEFAULT_BORDER_STYLE = 'solid';
export const DEFAULT_BORDER_COLOR = '#000000';

/**
 * Represents the style state derived from the active/selected cell.
 * Used to show toggle state in the UI (e.g., Bold button pressed).
 */
export interface CellStyleState {
  fontWeight: 'normal' | 'bold' | number;
  fontStyle: 'normal' | 'italic';
  fontSize: number;
  textDecoration: 'none' | 'underline' | 'line-through';
  color: string | undefined;
  backgroundColor: string | undefined;
  textAlign: 'left' | 'center' | 'right';
  numberFormat: string | undefined;
  whiteSpace: 'normal' | 'nowrap' | 'pre';
}

/** Default style for an empty/unstyled cell. */
export const DEFAULTCellStyle: CellStyleState = {
  fontWeight: 'normal',
  fontStyle: 'normal',
  fontSize: DEFAULT_FONT_SIZE,
  textDecoration: 'none',
  color: undefined,
  backgroundColor: undefined,
  textAlign: 'left',
  numberFormat: undefined,
  whiteSpace: 'nowrap',
};

/**
 * Derives a complete CellStyleState from a CellStyle (which has all-optional fields).
 * Missing fields fall back to defaults.
 */
export function deriveCellStyleState(style: CellStyle | undefined): CellStyleState {
  return {
    fontWeight: style?.fontWeight ?? 'normal',
    fontStyle: style?.fontStyle ?? 'normal',
    fontSize: style?.fontSize ?? DEFAULT_FONT_SIZE,
    textDecoration: style?.textDecoration ?? 'none',
    color: style?.color,
    backgroundColor: style?.backgroundColor,
    textAlign: style?.textAlign ?? 'left',
    numberFormat: style?.numberFormat,
    whiteSpace: style?.whiteSpace ?? 'nowrap',
  };
}

/**
 * Merges a partial style update into an existing CellStyle.
 * Returns a new CellStyle object (immutable).
 */
export function mergeCellStyle(
  existing: CellStyle | undefined,
  update: Partial<CellStyle>
): CellStyle {
  return { ...existing, ...update };
}

/**
 * Toggles bold state. Returns the fontWeight value to set.
 */
export function toggleBold(current: CellStyleState): 'bold' | 'normal' {
  return current.fontWeight !== 'normal' ? 'normal' : 'bold';
}

/**
 * Toggles italic state. Returns the fontStyle value to set.
 */
export function toggleItalic(current: CellStyleState): 'italic' | 'normal' {
  return current.fontStyle === 'italic' ? 'normal' : 'italic';
}

/**
 * Cycles underline state: none → underline → line-through → none.
 */
export function toggleUnderline(current: CellStyleState): 'none' | 'underline' | 'line-through' {
  switch (current.textDecoration) {
    case 'underline':
      return 'line-through';
    case 'line-through':
      return 'none';
    default:
      return 'underline';
  }
}

/**
 * Toggles text wrap state: nowrap → normal → nowrap.
 * 'pre' is an alternative wrap mode that preserves whitespace.
 */
export function toggleWrapText(current: CellStyleState): 'normal' | 'nowrap' {
  return current.whiteSpace === 'normal' ? 'nowrap' : 'normal';
}

/**
 * Removes all styling, returning an empty CellStyle.
 */
export function clearStyles(): CellStyle {
  return {};
}

/**
 * Common number format presets.
 */
export const NUMBER_FORMATS = [
  { label: 'General', value: 'General' },
  { label: 'Number', value: '0.00' },
  { label: 'Currency', value: '$#,##0.00' },
  { label: 'Percent', value: '0.00%' },
  { label: 'Date', value: 'mm/dd/yyyy' },
  { label: 'Time', value: 'hh:mm:ss' },
  { label: 'Scientific', value: '0.00E+00' },
];
