// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Row-height auto-fit for wrapped cells.
 *
 * When a cell has Wrap Text enabled (`whiteSpace: 'normal'` or `'pre'`), the
 * row height should "snap" to the wrapped content height, which depends on the
 * column width. These helpers estimate that height using canvas text
 * measurement (the same technique the grid uses for rendering).
 */
import type { Cell, Sheet } from '../types';
import { DEFAULT_FONT_SIZE } from '../hooks/useCellStyle';

/** Line-height of a grid cell (Tailwind `leading-7` on `.grid-cell`). */
export const ROW_LINE_HEIGHT = 28;

/**
 * Ratio of line-height to font-size for a cell. `leading-7` (28px) on the
 * default 14px font is 2.0, but 1.4 keeps larger fonts readable without
 * excessive vertical padding.
 */
export const LINE_HEIGHT_RATIO = 1.4;

/**
 * Line-height in px for a given font size, floored at the grid's default.
 * Grid cells set this inline so the rendered lines match the auto-fit.
 */
export function lineHeightForFont(fontSize: number): number {
  return Math.max(ROW_LINE_HEIGHT, Math.round(fontSize * LINE_HEIGHT_RATIO));
}

/** Horizontal padding inside a cell (Tailwind `px-1.5` + border). */
export const CELL_PADDING_X = 12;

/** Font used by grid cells (Tailwind `font-mono text-sm`). */
export const CELL_FONT = '14px Menlo, Monaco, Consolas, monospace';

/** Width of a fallback estimate when no DOM/canvas is available. */
const FALLBACK_CHAR_WIDTH = 8;

/**
 * Measures the pixel width of a string with the given CSS font.
 * Falls back to a rough per-character estimate outside a measurable DOM.
 */
export function measureTextWidth(text: string, font: string = CELL_FONT): number {
  if (typeof document === 'undefined') return text.length * FALLBACK_CHAR_WIDTH;
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return text.length * FALLBACK_CHAR_WIDTH;
    ctx.font = font;
    return ctx.measureText(text).width;
  } catch {
    return text.length * FALLBACK_CHAR_WIDTH;
  }
}

/** Length of the longest prefix of `text` that fits within `usable` px. */
function fittingPrefixLength(text: string, usable: number, font: string): number {
  let lo = 1;
  let hi = text.length;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (measureTextWidth(text.slice(0, mid), font) <= usable) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/**
 * Counts how many visual lines a single (newline-free) line occupies when
 * wrapped to `usable` px. Long words are broken (matching `break-words`).
 */
function countLineWraps(
  line: string,
  usable: number,
  font: string,
  preserveWhitespace: boolean,
): number {
  if (line.length === 0) return 1;

  let lines = 0;
  let remaining = line;

  while (remaining.length > 0) {
    // The whole remainder fits — one final line.
    if (measureTextWidth(remaining, font) <= usable) {
      lines++;
      break;
    }

    let end = fittingPrefixLength(remaining, usable, font);
    if (end === 0) end = 1; // force at least one character (break-word)

    // Prefer to break at the last space inside the fitting prefix.
    const spaceIdx = remaining.lastIndexOf(' ', end - 1);
    const breakAt = spaceIdx > 0 ? spaceIdx + 1 : end;

    lines++;
    remaining = remaining.slice(breakAt);
    if (!preserveWhitespace) remaining = remaining.replace(/^\s+/, '');
  }

  return lines;
}

/**
 * Counts the visual lines a cell's text occupies at the given column width.
 * Explicit newlines always start a new line; `pre` whitespace is preserved.
 */
export function countWrappedLines(
  text: string,
  widthPx: number,
  font: string = CELL_FONT,
  preserveWhitespace = false,
): number {
  const usable = Math.max(1, widthPx - CELL_PADDING_X);
  const rawLines = text.split('\n');
  let total = 0;
  for (const rawLine of rawLines) {
    total += countLineWraps(rawLine, usable, font, preserveWhitespace);
  }
  return Math.max(1, total);
}

/**
 * Computes the auto-fit row height for a single cell value at a column width.
 * Returns at least `defaultRowHeight`.
 */
export function computeAutoRowHeight(
  text: string,
  widthPx: number,
  defaultRowHeight: number,
  font: string = CELL_FONT,
  preserveWhitespace = false,
  fontSize: number = DEFAULT_FONT_SIZE,
): number {
  const lines = countWrappedLines(text, widthPx, font, preserveWhitespace);
  return Math.max(defaultRowHeight, lines * lineHeightForFont(fontSize));
}

/**
 * Returns the auto-fit height for every row that contains at least one
 * wrapped cell. Rows without wrapped cells are omitted (their height is left
 * untouched — typically a manual height or the default).
 */
export function computeAutoRowHeights(sheet: Sheet, font: string = CELL_FONT): Record<number, number> {
  const result: Record<number, number> = {};
  for (const [key, cell] of Object.entries(sheet.cells)) {
    if (!isWrappedCell(cell)) continue;
    const colon = key.indexOf(':');
    const row = parseInt(key.slice(0, colon), 10);
    const col = parseInt(key.slice(colon + 1), 10);
    const width = sheet.columnWidths[col] ?? sheet.defaultColWidth;
    const height = computeAutoRowHeight(
      cell.rawValue,
      width,
      sheet.defaultRowHeight,
      font,
      cell.style?.whiteSpace === 'pre',
      cell.style?.fontSize ?? DEFAULT_FONT_SIZE,
    );
    result[row] = Math.max(result[row] ?? 0, height);
  }
  return result;
}

/** Whether a cell's style enables text wrapping. */
export function isWrappedCell(cell: Cell | undefined): boolean {
  const ws = cell?.style?.whiteSpace;
  return ws === 'normal' || ws === 'pre';
}

/**
 * Applies auto-fit heights to a sheet.
 *
 * - Rows with wrapped cells get their computed height.
 * - Rows that were auto-fit in `previous` but no longer have a wrapped cell
 *   are reverted to the default height (their `rowHeights` entry is removed),
 *   so disabling Wrap Text "snaps" the row back.
 * - All other rows keep their existing height (manual heights preserved).
 */
export function applyAutoRowHeights(
  sheet: Sheet,
  previous?: Record<number, number>,
  font: string = CELL_FONT,
): Sheet {
  const auto = computeAutoRowHeights(sheet, font);
  const rowHeights = { ...sheet.rowHeights };

  for (const [row, height] of Object.entries(auto)) {
    rowHeights[Number(row)] = height;
  }

  if (previous) {
    for (const row of Object.keys(previous)) {
      const r = Number(row);
      if (!(r in auto)) {
        delete rowHeights[r];
      }
    }
  }

  return { ...sheet, rowHeights };
}
