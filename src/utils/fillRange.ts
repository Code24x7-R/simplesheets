// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import type { Sheet, Cell } from '../types';
import { computeFillSeries } from './fillSeries';

export interface FillChange {
  row: number;
  col: number;
  value: string;
}

/**
 * Computes the fill values for extending a range to a target location.
 * Supports 1D (horizontal/vertical) and 2D range fills.
 * Respects hidden rows (skips them when filling vertically).
 *
 * @param sheet - The source sheet
 * @param sourceStartRow - Top row of source range
 * @param sourceStartCol - Left column of source range
 * @param sourceEndRow - Bottom row of source range
 * @param sourceEndCol - Right column of source range
 * @param targetEndRow - Bottom row of target range
 * @param targetEndCol - Right column of target range
 * @param hiddenRows - Set of row indices that are hidden (skipped during vertical fill)
 * @returns Array of cell changes to apply
 */
export function computeFillRange(
  sheet: Sheet,
  sourceStartRow: number,
  sourceStartCol: number,
  sourceEndRow: number,
  sourceEndCol: number,
  targetEndRow: number,
  targetEndCol: number,
  hiddenRows?: Set<number>
): FillChange[] {
  const changes: FillChange[] = [];
  const minRow = Math.min(sourceStartRow, sourceEndRow);
  const maxRow = Math.max(sourceStartRow, sourceEndRow);
  const minCol = Math.min(sourceStartCol, sourceEndCol);
  const maxCol = Math.max(sourceStartCol, sourceEndCol);
  const rowCount = maxRow - minRow + 1;
  const colCount = maxCol - minCol + 1;

  // Clamp target to sheet bounds
  const clampedTargetEndRow = Math.min(targetEndRow, sheet.rowCount - 1);
  const clampedTargetEndCol = Math.min(targetEndCol, sheet.columnCount - 1);

  const isVertical = clampedTargetEndRow > maxRow;
  const isHorizontal = clampedTargetEndCol > maxCol;

  if (isVertical) {
    // Vertical fill: each column is filled independently
    // First, compute fill values for each column
    const colFillValues: string[][] = [];
    for (let c = 0; c < colCount; c++) {
      const col = minCol + c;
      const sourceCells: Cell[] = [];
      for (let r = 0; r < rowCount; r++) {
        const cell = sheet.cells[`${minRow + r}:${col}`];
        if (cell) sourceCells.push(cell);
      }
      if (sourceCells.length === 0) {
        colFillValues.push([]);
        continue;
      }

      const fillCount = clampedTargetEndRow - maxRow;
      const fillValues = computeFillSeries(sourceCells, fillCount);
      colFillValues.push(fillValues ?? []);
    }

    // Then, output in row-major order, skipping hidden rows
    let fillIdx = 0;
    for (let r = maxRow + 1; r <= clampedTargetEndRow; r++) {
      if (hiddenRows?.has(r)) continue;
      for (let c = 0; c < colCount; c++) {
        const fillValues = colFillValues[c];
        if (fillIdx < fillValues.length) {
          changes.push({ row: r, col: minCol + c, value: fillValues[fillIdx] });
        }
      }
      fillIdx++;
    }
  } else if (isHorizontal) {
    // Horizontal fill: each row is filled independently
    for (let r = 0; r < rowCount; r++) {
      const row = minRow + r;
      const sourceCells: Cell[] = [];
      for (let c = 0; c < colCount; c++) {
        const cell = sheet.cells[`${row}:${minCol + c}`];
        if (cell) sourceCells.push(cell);
      }
      if (sourceCells.length === 0) continue;

      const fillCount = clampedTargetEndCol - maxCol;
      const fillValues = computeFillSeries(sourceCells, fillCount);
      if (!fillValues) continue; // No pattern — skip

      for (let i = 0; i < fillValues.length && maxCol + 1 + i <= clampedTargetEndCol; i++) {
        changes.push({ row, col: maxCol + 1 + i, value: fillValues[i] });
      }
    }
  }

  return changes;
}
