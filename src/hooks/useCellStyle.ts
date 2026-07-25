import type { CellStyle } from '../types';

/**
 * Represents the style state derived from the active/selected cell.
 * Used to show toggle state in the UI (e.g., Bold button pressed).
 */
export interface CellStyleState {
  fontWeight: 'normal' | 'bold' | number;
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline' | 'line-through';
  color: string | undefined;
  backgroundColor: string | undefined;
  textAlign: 'left' | 'center' | 'right';
  numberFormat: string | undefined;
}

/** Default style for an empty/unstyled cell. */
export const DEFAULTCellStyle: CellStyleState = {
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  color: undefined,
  backgroundColor: undefined,
  textAlign: 'left',
  numberFormat: undefined,
};

/**
 * Derives a complete CellStyleState from a CellStyle (which has all-optional fields).
 * Missing fields fall back to defaults.
 */
export function deriveCellStyleState(style: CellStyle | undefined): CellStyleState {
  return {
    fontWeight: style?.fontWeight ?? 'normal',
    fontStyle: style?.fontStyle ?? 'normal',
    textDecoration: style?.textDecoration ?? 'none',
    color: style?.color,
    backgroundColor: style?.backgroundColor,
    textAlign: style?.textAlign ?? 'left',
    numberFormat: style?.numberFormat,
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
 * Removes all styling, returning an empty CellStyle.
 */
export function clearStyles(): CellStyle {
  return {};
}

/**
 * Predefined color palette for text/fill color pickers.
 */
export const COLOR_PALETTE = [
  '#000000', '#434343', '#666666', '#999999', '#B7B7B7', '#CCCCCC', '#D9D9D9', '#EFEFEF', '#F3F3F3', '#FFFFFF',
  '#980000', '#FF0000', '#FF9900', '#FFFF00', '#00FF00', '#00FFFF', '#4A86E8', '#0000FF', '#9900FF', '#FF00FF',
  '#E6B8AF', '#F4CCCC', '#FCE5CD', '#FFF2CC', '#D9EAD3', '#D0E0E3', '#C9DAF8', '#CFE2F3', '#D9D2E9', '#EAD1DC',
  '#DD7E6B', '#EA9999', '#F9CB9C', '#FFE599', '#B6D7A8', '#A2C4C9', '#A4C2F4', '#9FC5E8', '#B4A7D6', '#D5A6BD',
  '#CC4125', '#E06666', '#F6B26B', '#FFD966', '#93C47D', '#76A5AF', '#6D9EEB', '#6FA8DC', '#8E7CC3', '#C27BA0',
  '#A61C00', '#CC0000', '#E69138', '#F1C232', '#6AA84F', '#45818E', '#3C78D8', '#3D85C6', '#674EA7', '#A64D79',
  '#85200C', '#990000', '#B45F06', '#BF9000', '#38761D', '#134F5C', '#1155CC', '#0B5394', '#351C75', '#741B47',
  '#5B0F00', '#660000', '#783F04', '#7F6000', '#274E13', '#0C343D', '#1C4587', '#073763', '#20124D', '#4C1130',
];

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
