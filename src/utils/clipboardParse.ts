// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import type { CellStyle } from '../types';

/**
 * Classification of clipboard content for paste behavior.
 *   - 'grid': Content is tab/comma delimited data to be spread across cells
 *   - 'rich-grid': HTML table with formatting to be spread across cells
 */
export type PasteContentKind = 'grid' | 'rich-grid';

/**
 * Maximum number of cells to parse from HTML tables.
 * Prevents lockups from very large tables (e.g., MathJax matrices).
 */
const MAX_HTML_TABLE_CELLS = 10000;

/**
 * Result of parsing clipboard data into a grid of cell values + styles.
 */
export interface ParsedClipboardGrid {
  /** 2D array of cell values (row-major). */
  values: string[][];
  /** 2D array of cell styles (row-major). null = no style. */
  styles: (CellStyle | null)[][];
  /** Number of rows. */
  rowCount: number;
  /** Number of columns. */
  colCount: number;
}

/**
 * Detects whether a string represents a number and extracts a sensible
 * default number format. Returns null for non-numeric strings.
 *
 * Handles:
 *   - Plain numbers: "42", "3.14", "-7"
 *   - Currency: "$1,234.56", "£50", "€100.50"
 *   - Percentage: "50%", "12.5%"
 *   - Thousands separator: "1,234", "10,000"
 *   - Parentheses for negatives (accounting): "(123)"
 */
export function detectNumeric(
  raw: string
): { value: string; format: string | null } | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  // Parentheses negatives: "(123)" → "-123"
  const parenMatch = trimmed.match(/^\(([\d,]+\.?\d*)\)$/);
  if (parenMatch) {
    const inner = parenMatch[1].replace(/,/g, '');
    const num = parseFloat(inner);
    if (!isNaN(num)) {
      return { value: String(-num), format: '#,##0' };
    }
  }

  // Currency: symbol + number (optional commas/decimals)
  const currencyMatch = trimmed.match(/^([$£€¥])\s*([\d,]+\.?\d*)$/);
  if (currencyMatch) {
    const inner = currencyMatch[2].replace(/,/g, '');
    const num = parseFloat(inner);
    if (!isNaN(num)) {
      return { value: String(num), format: '$#,##0.00' };
    }
  }

  // Percentage: number + "%"
  const percentMatch = trimmed.match(/^(-?[\d,]+\.?\d*)%$/);
  if (percentMatch) {
    const inner = percentMatch[1].replace(/,/g, '');
    const num = parseFloat(inner);
    if (!isNaN(num)) {
      // Store the decimal form (50% → 0.5) so arithmetic works
      return { value: String(num / 100), format: '0.00%' };
    }
  }

  // Plain number (optional thousands separators, optional decimal)
  if (/^-?[\d,]+\.?\d*$/.test(trimmed)) {
    const cleaned = trimmed.replace(/,/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      // If the original had thousands separators, keep that format
      if (trimmed.includes(',')) {
        return { value: String(num), format: '#,##0' };
      }
      return { value: String(num), format: null };
    }
  }

  return null;
}

/**
 * Classifies clipboard content to determine smart paste behavior.
 *
 * Returns:
 *   - 'single-value': No tabs, no commas, has newlines → paste as multi-line
 *                     text into a single cell (like Excel)
 *   - 'grid': Contains tabs or comma-delimited rows → spread across cells
 *   - 'rich-grid': HTML table present → spread with formatting
 *
 * The key insight: if the user copies multi-line text (e.g. from a paragraph)
 * and pastes into a single cell, it should go INTO that cell, not create a
 * column per line.
 */
export function classifyPasteContent(
  _text: string,
  html: string | null
): PasteContentKind {
  // HTML table → rich grid
  if (html && html.includes('<table')) {
    return 'rich-grid';
  }

  // Everything else → grid (plain text, CSV, TSV all parse to grid)
  return 'grid';
}

/**
 * Parses plain text (from clipboard) into a grid of cell values + styles.
 *
 * Only tab characters are treated as column delimiters (matching Excel
 * paste behavior). Each line becomes a row. Commas are NOT treated as
 * delimiters because pasting plain text should preserve the text as-is.
 * Auto-detects numeric values and applies sensible formats.
 */
export function parsePlainText(text: string): ParsedClipboardGrid {
  // Normalize line endings
  const normalized = text.replace(/\r\n?/g, '\n');
  // Split into rows, drop leading/trailing empty lines
  const lines = normalized.split('\n');
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  if (lines.length === 0) {
    return { values: [], styles: [], rowCount: 0, colCount: 0 };
  }

  // Only tabs are treated as column delimiters (Excel paste behavior)
  const hasTabs = lines.some((line) => line.includes('\t'));

  const values: string[][] = [];
  const styles: (CellStyle | null)[][] = [];
  let maxCols = 0;

  for (const line of lines) {
    // Split by tab if present, otherwise treat as single cell
    const cells = hasTabs ? line.split('\t') : [line];
    const rowValues: string[] = [];
    const rowStyles: (CellStyle | null)[] = [];

    for (const cell of cells) {
      const cellTrimmed = cell.trim();
      const numeric = detectNumeric(cellTrimmed);
      if (numeric) {
        rowValues.push(numeric.value);
        rowStyles.push(numeric.format ? { numberFormat: numeric.format } : null);
      } else {
        rowValues.push(cellTrimmed);
        rowStyles.push(null);
      }
    }

    if (rowValues.length > maxCols) maxCols = rowValues.length;
    values.push(rowValues);
    styles.push(rowStyles);
  }

  // Pad rows to uniform width
  for (const row of values) {
    while (row.length < maxCols) row.push('');
  }
  for (const row of styles) {
    while (row.length < maxCols) row.push(null);
  }

  return {
    values,
    styles,
    rowCount: values.length,
    colCount: maxCols,
  };
}

/**
 * Parses an HTML table (from clipboard) into a grid of cell values + styles.
 *
 * Extracts inline CSS styles from <td>/<th> elements:
 *   - font-weight: bold → fontWeight: 'bold'
 *   - font-style: italic → fontStyle: 'italic'
 *   - text-decoration: underline → textDecoration: 'underline'
 *   - color: #rrggbb → color
 *   - background-color: #rrggbb → backgroundColor
 *   - text-align: center/right → textAlign
 *   - number-format (Excel mso-number-format) → numberFormat
 *
 * Numeric values in cells still get auto-detected for sensible defaults.
 */
export function parseHtmlTable(html: string): ParsedClipboardGrid {
  // Use DOMParser (available in browsers and jsdom)
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) {
    // Fallback: treat as plain text
    const text = doc.body.textContent ?? '';
    return parsePlainText(text);
  }

  const rows = table.querySelectorAll('tr');
  const values: string[][] = [];
  const styles: (CellStyle | null)[][] = [];
  let maxCols = 0;
  let totalCells = 0;

  for (const row of rows) {
    // Safety limit: prevent lockups from very large tables
    if (totalCells >= MAX_HTML_TABLE_CELLS) break;

    const cells = row.querySelectorAll('th, td');
    const rowValues: string[] = [];
    const rowStyles: (CellStyle | null)[] = [];

    for (const cell of cells) {
      // Safety limit: prevent lockups from very large tables
      if (totalCells >= MAX_HTML_TABLE_CELLS) break;
      totalCells++;

      const td = cell as HTMLElement;
      const textContent = (td.textContent ?? '').trim();
      const style = extractCellStyle(td);

      // Auto-detect numbers even in HTML paste
      const numeric = detectNumeric(textContent);
      if (numeric) {
        rowValues.push(numeric.value);
        rowStyles.push({
          ...style,
          numberFormat: numeric.format ?? style?.numberFormat,
        });
      } else {
        rowValues.push(textContent);
        rowStyles.push(style);
      }
    }

    if (rowValues.length > maxCols) maxCols = rowValues.length;
    values.push(rowValues);
    styles.push(rowStyles);
  }

  // Drop fully empty trailing rows
  while (
    values.length > 0 &&
    values[values.length - 1].every((v) => v.trim() === '')
  ) {
    values.pop();
    styles.pop();
  }

  // Pad to uniform width
  for (const row of values) {
    while (row.length < maxCols) row.push('');
  }
  for (const row of styles) {
    while (row.length < maxCols) row.push(null);
  }

  return {
    values,
    styles,
    rowCount: values.length,
    colCount: maxCols,
  };
}

/**
 * Extracts cell style from an HTML element's inline CSS.
 */
function extractCellStyle(el: HTMLElement): CellStyle | null {
  const style = el.getAttribute('style') ?? '';
  if (!style) return null;

  const css: CellStyle = {};

  // font-weight
  const fontWeight = extractCssValue(style, 'font-weight');
  if (fontWeight) {
    if (fontWeight === 'bold' || fontWeight === '700' || /^([7-9]\d{2})$/.test(fontWeight)) {
      css.fontWeight = 'bold';
    } else if (fontWeight === 'normal' || fontWeight === '400') {
      css.fontWeight = 'normal';
    }
  }

  // font-style
  const fontStyle = extractCssValue(style, 'font-style');
  if (fontStyle === 'italic') {
    css.fontStyle = 'italic';
  }

  // text-decoration
  const textDecoration = extractCssValue(style, 'text-decoration');
  if (textDecoration) {
    if (textDecoration.includes('underline')) {
      css.textDecoration = 'underline';
    } else if (textDecoration.includes('line-through')) {
      css.textDecoration = 'line-through';
    }
  }

  // color
  const color = extractCssValue(style, 'color');
  if (color) {
    css.color = normalizeColor(color);
  }

  // background-color
  const bgColor = extractCssValue(style, 'background-color');
  if (bgColor) {
    css.backgroundColor = normalizeColor(bgColor);
  }

  // text-align
  const textAlign = extractCssValue(style, 'text-align');
  if (textAlign === 'center' || textAlign === 'right' || textAlign === 'left') {
    css.textAlign = textAlign;
  }

  // Excel number format
  const msoNumberFormat = extractCssValue(style, 'mso-number-format');
  if (msoNumberFormat) {
    css.numberFormat = normalizeMsoNumberFormat(msoNumberFormat);
  }

  return Object.keys(css).length > 0 ? css : null;
}

/**
 * Extracts a CSS property value from an inline style string.
 */
function extractCssValue(style: string, property: string): string | null {
  // Match property: value; (handles optional whitespace)
  const regex = new RegExp(`${property}\\s*:\\s*([^;]+)`, 'i');
  const match = style.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Normalizes a CSS color string to a hex format when possible.
 * Accepts: "#rgb", "#rrggbb", "rgb(r,g,b)", named colors (basic).
 */
function normalizeColor(color: string): string {
  const trimmed = color.trim();

  // Already hex
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    // Expand #abc → #aabbcc
    if (trimmed.length === 4) {
      const r = trimmed[1];
      const g = trimmed[2];
      const b = trimmed[3];
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return trimmed;
  }

  // rgb() / rgba()
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
  }

  // Basic named colors
  const namedColors: Record<string, string> = {
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    white: '#ffffff',
    black: '#000000',
    yellow: '#ffff00',
    orange: '#ffa500',
    purple: '#800080',
    gray: '#808080',
    grey: '#808080',
    pink: '#ffc0cb',
    cyan: '#00ffff',
    magenta: '#ff00ff',
  };
  const lower = trimmed.toLowerCase();
  if (namedColors[lower]) {
    return namedColors[lower];
  }

  return trimmed;
}

/**
 * Converts Excel mso-number-format values to our numberFormat syntax.
 * Handles the most common Excel formats.
 */
function normalizeMsoNumberFormat(mso: string): string {
  const format = mso.replace(/"/g, '').trim();

  // Currency: "£#,##0.00" or "$#,##0.00"
  if (format.includes('£') || format.includes('€') || format.includes('¥')) {
    return '$#,##0.00';
  }
  if (format.startsWith('$')) {
    return '$#,##0.00';
  }

  // Percentage: "0%" or "0.00%"
  if (format === '0%') return '0%';
  if (format === '0.00%') return '0.00%';
  if (format === '0.0%') return '0.0%';

  // General number with thousands: "#,##0"
  if (format === '#,##0') return '#,##0';
  if (format === '#,##0.00') return '#,##0.00';

  // Date formats
  if (format.toLowerCase().includes('yyyy') || format.toLowerCase().includes('mmmm')) {
    return 'mm/dd/yyyy';
  }

  // Default: General
  return 'General';
}
