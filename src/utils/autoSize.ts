// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Auto-fit calculations for double-clicking a column or row margin.
 *
 * These helpers inspect the whole sheet (not just virtualized cells), use the
 * same canvas measurement as wrapped-row sizing, and clamp to the drag bounds
 * exposed by the resize handle.
 */
import type { Cell, Sheet } from '../types';
import { DEFAULT_FONT_SIZE } from '../hooks/useCellStyle';
import { formatCellDisplayValue } from './numberFormat';
import {
  CELL_PADDING_X,
  ROW_LINE_HEIGHT,
  countWrappedLines,
  lineHeightForFont,
  measureTextWidth,
} from './rowHeight';
import { buildCanvasFont } from './fontFamily';

/** Minimum column width in pixels (matches resize drag). */
export const MIN_COLUMN_WIDTH = 30;

/** Maximum column width in pixels (matches resize drag). */
export const MAX_COLUMN_WIDTH = 500;

/** Minimum row height in pixels (matches the grid line-height floor). */
export const MIN_ROW_HEIGHT = ROW_LINE_HEIGHT;

/** Maximum row height in pixels (matches resize drag). */
export const MAX_ROW_HEIGHT = 500;

/** Clamp a column width to the supported range. */
export function clampColumnWidth(width: number): number {
  if (!Number.isFinite(width)) return MIN_COLUMN_WIDTH;
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)));
}

/** Clamp a row height to the supported range. */
export function clampRowHeight(height: number): number {
  if (!Number.isFinite(height)) return MIN_ROW_HEIGHT;
  return Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, Math.round(height)));
}

function canvasFontForCell(cell: Cell | undefined): string {
  const style = cell?.style;
  return buildCanvasFont(
    style?.fontSize ?? DEFAULT_FONT_SIZE,
    style?.fontFamily,
    style?.fontWeight,
    style?.fontStyle,
  );
}

function forEachCellInColumn(sheet: Sheet, col: number, visit: (cell: Cell) => void): void {
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const colon = key.indexOf(':');
    if (colon < 0) continue;
    if (Number(key.slice(colon + 1)) === col) visit(cell);
  }
}

function forEachCellInRow(
  sheet: Sheet,
  row: number,
  visit: (cell: Cell, col: number) => void,
): void {
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const colon = key.indexOf(':');
    if (colon < 0) continue;
    if (Number(key.slice(0, colon)) === row) visit(cell, Number(key.slice(colon + 1)));
  }
}

/**
 * Compute the width needed to display the widest line in a column.
 *
 * @param sheet - Sheet containing the column.
 * @param col - Zero-based column index.
 * @returns Clamped width in pixels.
 */
export function computeAutoFitColumnWidth(sheet: Sheet, col: number): number {
  let widest = 0;

  forEachCellInColumn(sheet, col, (cell) => {
    const font = canvasFontForCell(cell);
    const text = formatCellDisplayValue(cell);
    for (const line of text.split('\n')) {
      widest = Math.max(widest, measureTextWidth(line, font));
    }
  });

  // `widest` is the text-only width; add horizontal cell padding and a small
  // buffer so the glyph's right edge is not clipped by the cell border.
  return clampColumnWidth(widest + CELL_PADDING_X + 2);
}

/**
 * Compute the height needed to display a row's content at its current widths.
 *
 * Wrapped and `pre` cells wrap at the column width; other cells contribute a
 * single line (explicit newlines are preserved by the editor for all modes).
 *
 * @param sheet - Sheet containing the row.
 * @param row - Zero-based row index.
 * @returns Clamped height in pixels.
 */
export function computeAutoFitRowHeight(sheet: Sheet, row: number): number {
  let tallest = MIN_ROW_HEIGHT;

  forEachCellInRow(sheet, row, (cell, col) => {
    const text = formatCellDisplayValue(cell);
    if (text.length === 0) return;

    const style = cell.style;
    const fontSize = style?.fontSize ?? DEFAULT_FONT_SIZE;
    const width = sheet.columnWidths[col] ?? sheet.defaultColWidth;
    const font = canvasFontForCell(cell);
    const preserveWhitespace = style?.whiteSpace === 'pre';
    const wraps = style?.whiteSpace === 'normal' || preserveWhitespace;
    const lines = wraps
      ? countWrappedLines(text, width, font, preserveWhitespace)
      : text.split('\n').length;

    tallest = Math.max(tallest, lines * lineHeightForFont(fontSize));
  });

  return clampRowHeight(tallest);
}
