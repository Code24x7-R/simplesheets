// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Chart data extraction utilities.
 * Parses cell ranges from sheets and produces structured data for chart rendering.
 */

import type { Sheet } from '../types';
import { cellKey } from '../types';

/**
 * Parsed chart data ready for rendering.
 */
export interface ChartData {
  /** Category labels for the x-axis. */
  categories: string[];
  /** Data series with numeric values. */
  series: Array<{
    label: string;
    values: (number | null)[];
  }>;
}

/**
 * Parsed numeric result from a cell.
 */
export interface CellNumericValue {
  raw: string;
  numeric: number | null;
}

/**
 * Parses a cell reference string into row/col indices.
 * @param ref - A1-style cell reference (e.g., "B3").
 * @returns Tuple of [row, col] (zero-based).
 */
export function parseCellRef(ref: string): { row: number; col: number } {
  const match = ref.match(/^\$?([A-Za-z]+)\$?(\d+)$/);
  if (!match) return { row: -1, col: -1 };

  let col = 0;
  for (const ch of match[1].toUpperCase()) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }

  return { row: parseInt(match[2], 10) - 1, col: col - 1 };
}

/**
 * Parses a range string into start and end row/col.
 * @param range - Range string (e.g., "A1:B10").
 * @returns Object with startRow, endRow, startCol, endCol (all inclusive, zero-based).
 */
export function parseRange(range: string): {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
} {
  const parts = range.split(':').map((s) => s.trim());
  if (parts.length !== 2) {
    const single = parseCellRef(parts[0]);
    return { startRow: single.row, endRow: single.row, startCol: single.col, endCol: single.col };
  }

  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);

  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endCol: Math.max(start.col, end.col),
  };
}

/**
 * Gets a cell value from a sheet.
 * @param sheet - The sheet to read from.
 * @param row - Zero-based row index.
 * @param col - Zero-based column index.
 * @returns The cell's computed value as string, or empty string if not found.
 */
export function getCellValue(sheet: Sheet, row: number, col: number): string {
  const cell = sheet.cells[cellKey(row, col)];
  if (!cell) return '';

  const val = cell.computedValue;
  if (val === null || val === undefined) return cell.rawValue;
  return String(val);
}

/**
 * Attempts to parse a string as a number.
 * @param str - The string to parse.
 * @returns The numeric value, or null if not parseable.
 */
export function tryParseNumber(str: string): number | null {
  const trimmed = str.trim();
  if (trimmed === '') return null;
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

/**
 * Extracts chart data from a sheet range.
 * Assumes first row contains headers (series names) and first column contains categories.
 * If first row values are all numeric, no header row is assumed.
 *
 * @param sheet - The sheet to read from.
 * @param range - The cell range string (e.g., "A1:C10").
 * @returns Structured chart data with categories and series.
 */
export function extractChartData(sheet: Sheet, range: string): ChartData {
  const { startRow, endRow, startCol, endCol } = parseRange(range);

  if (startRow < 0 || startCol < 0) {
    return { categories: [], series: [] };
  }

  const rowCount = endRow - startRow + 1;
  const colCount = endCol - startCol + 1;

  if (rowCount <= 0 || colCount <= 0) {
    return { categories: [], series: [] };
  }

  // Determine if first row is headers (all non-numeric = headers)
  let hasHeaderRow = false;
  if (rowCount > 1) {
    let nonNumericCount = 0;
    for (let c = startCol; c <= endCol; c++) {
      const val = getCellValue(sheet, startRow, c);
      if (tryParseNumber(val) === null && val.trim() !== '') {
        nonNumericCount++;
      }
    }
    hasHeaderRow = nonNumericCount > 0;
  }

  // Determine if first column is categories (all non-numeric = categories)
  let hasCategoryCol = false;
  if (colCount > 1) {
    let nonNumericCount = 0;
    const dataStartRow = hasHeaderRow ? startRow + 1 : startRow;
    for (let r = dataStartRow; r <= endRow; r++) {
      const val = getCellValue(sheet, r, startCol);
      if (tryParseNumber(val) === null && val.trim() !== '') {
        nonNumericCount++;
      }
    }
    hasCategoryCol = nonNumericCount > 0;
  }

  // Extract categories from first column (if it's categories)
  const categories: string[] = [];
  if (hasCategoryCol) {
    const dataStartRow = hasHeaderRow ? startRow + 1 : startRow;
    for (let r = dataStartRow; r <= endRow; r++) {
      categories.push(getCellValue(sheet, r, startCol));
    }
  } else {
    // Generate numeric category labels
    const dataStartRow = hasHeaderRow ? startRow + 1 : startRow;
    for (let i = 0; i < endRow - dataStartRow + 1; i++) {
      categories.push(`${i + 1}`);
    }
  }

  // Extract series data
  const seriesStartCol = hasCategoryCol ? startCol + 1 : startCol;
  const seriesList: Array<{ label: string; values: (number | null)[] }> = [];

  for (let c = seriesStartCol; c <= endCol; c++) {
    const label = hasHeaderRow
      ? getCellValue(sheet, startRow, c)
      : `Series ${c - seriesStartCol + 1}`;

    const values: (number | null)[] = [];
    const dataStartRow = hasHeaderRow ? startRow + 1 : startRow;
    for (let r = dataStartRow; r <= endRow; r++) {
      const val = getCellValue(sheet, r, c);
      values.push(tryParseNumber(val));
    }

    seriesList.push({ label: label.trim() || `Series ${c - seriesStartCol + 1}`, values });
  }

  return { categories, series: seriesList };
}

/**
 * Gets the minimum and maximum numeric values across all series.
 * @param data - Chart data to analyze.
 * @returns Object with min and max values (0 and 1 if no data).
 */
export function getMinMax(data: ChartData): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;

  for (const s of data.series) {
    for (const v of s.values) {
      if (v !== null) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }

  if (min === Infinity) return { min: 0, max: 1 };
  if (min === max) {
    // Avoid zero-range axis
    return { min: min > 0 ? 0 : min - 1, max: max + 1 };
  }

  return { min, max };
}

/**
 * Gets the total sum of all values (for pie chart).
 * @param data - Chart data.
 * @returns Array of { label, value, percent } for each category.
 */
export function getPieData(data: ChartData): Array<{ label: string; value: number; percent: number }> {
  const total = data.series.reduce((sum: number, s) => {
    return sum + s.values.reduce((vs: number, v) => vs + (v ?? 0), 0);
  }, 0);

  if (total === 0) {
    return data.categories.map((label) => ({ label, value: 0, percent: 0 }));
  }

  return data.categories.map((label, i) => {
    const value = data.series.reduce((sum: number, s) => sum + (s.values[i] ?? 0), 0);
    return { label, value, percent: (value / total) * 100 };
  });
}

/**
 * Generates a color palette for chart series.
 * @param count - Number of colors needed.
 * @returns Array of hex color strings.
 */
export function generateColors(count: number): string[] {
  const palette = [
    '#3B82EF', // blue
    '#EF4444', // red
    '#22C55E', // green
    '#EAB308', // yellow
    '#A855F7', // purple
    '#EC4899', // pink
    '#F97316', // orange
    '#06B6D4', // cyan
    '#6366F1', // indigo
    '#14B8A6', // teal
    '#F43F5E', // rose
    '#84CC16', // lime
  ];

  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(palette[i % palette.length]);
  }
  return colors;
}

/**
 * Finds the used range of a sheet (for default chart data range).
 * @param sheet - The sheet to analyze.
 * @returns Range string (e.g., "A1:C10") or empty string if no data.
 */
export function findDataRange(sheet: Sheet): string {
  let minRow = Number.MAX_SAFE_INTEGER;
  let maxRow = 0;
  let minCol = Number.MAX_SAFE_INTEGER;
  let maxCol = 0;

  for (const key of Object.keys(sheet.cells)) {
    const colonIndex = key.indexOf(':');
    const r = parseInt(key.slice(0, colonIndex), 10);
    const c = parseInt(key.slice(colonIndex + 1), 10);
    if (r < minRow) minRow = r;
    if (r > maxRow) maxRow = r;
    if (c < minCol) minCol = c;
    if (c > maxCol) maxCol = c;
  }

  if (minRow === Number.MAX_SAFE_INTEGER) return '';

  // Convert to A1 notation
  const startCol = colToLetters(minCol);
  const endCol = colToLetters(maxCol);

  return `${startCol}${minRow + 1}:${endCol}${maxRow + 1}`;
}

/**
 * Converts a column index to A1-style letters.
 * @param col - Zero-based column index.
 * @returns Column letter(s).
 */
function colToLetters(col: number): string {
  let result = '';
  let n = col;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}
