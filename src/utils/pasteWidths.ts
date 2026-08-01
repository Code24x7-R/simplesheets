// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import type { Sheet } from '../types';

/**
 * Extracts custom column widths from a sheet for a given column range.
 * Only includes columns that have custom widths (not the default).
 */
export function extractColumnWidths(
  sheet: Sheet,
  startCol: number,
  endCol: number
): Record<number, number> {
  const widths: Record<number, number> = {};
  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  for (let col = minCol; col <= maxCol; col++) {
    if (sheet.columnWidths[col] !== undefined) {
      widths[col] = sheet.columnWidths[col];
    }
  }
  return widths;
}

/**
 * Applies extracted column widths to a target sheet, offset by the target's
 * start column. Returns a new sheet without mutating the original.
 */
export function applyColumnWidths(
  targetSheet: Sheet,
  sourceWidths: Record<number, number>,
  targetStartCol: number
): Sheet {
  const newWidths = { ...targetSheet.columnWidths };
  for (const [colStr, width] of Object.entries(sourceWidths)) {
    const sourceCol = parseInt(colStr, 10);
    const targetCol = sourceCol + targetStartCol;
    newWidths[targetCol] = width;
  }
  return {
    ...targetSheet,
    columnWidths: newWidths,
  };
}
