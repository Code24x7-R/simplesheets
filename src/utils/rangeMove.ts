import type { Selection } from '../types';

export interface RangeMove {
  /** Top-left row of the source range. */
  sourceRow: number;
  /** Top-left column of the source range. */
  sourceCol: number;
  /** Top-left row of the target range. */
  targetRow: number;
  /** Top-left column of the target range. */
  targetCol: number;
  /** Number of rows in the range. */
  rowCount: number;
  /** Number of columns in the range. */
  colCount: number;
  /** Row offset from source to target. */
  rowOffset: number;
  /** Column offset from source to target. */
  colOffset: number;
  /** Cell keys for the source range (row-major order). */
  sourceKeys: string[];
  /** Cell keys for the target range (row-major order). */
  targetKeys: string[];
}

/**
 * Computes the parameters for moving a selected range to a new location.
 * The target is the top-left corner where the range will be dropped.
 * Source cells are cleared and target cells receive the source values.
 */
export function computeRangeMove(selection: Selection, targetRow: number, targetCol: number): RangeMove {
  const minRow = Math.min(selection.startRow, selection.endRow);
  const maxRow = Math.max(selection.startRow, selection.endRow);
  const minCol = Math.min(selection.startCol, selection.endCol);
  const maxCol = Math.max(selection.startCol, selection.endCol);

  const rowCount = maxRow - minRow + 1;
  const colCount = maxCol - minCol + 1;

  // Clamp target to non-negative
  const clampedTargetRow = Math.max(0, targetRow);
  const clampedTargetCol = Math.max(0, targetCol);

  const rowOffset = clampedTargetRow - minRow;
  const colOffset = clampedTargetCol - minCol;

  // Generate source and target keys
  const sourceKeys: string[] = [];
  const targetKeys: string[] = [];
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const srcRow = minRow + r;
      const srcCol = minCol + c;
      sourceKeys.push(`${srcRow}:${srcCol}`);
      targetKeys.push(`${srcRow + rowOffset}:${srcCol + colOffset}`);
    }
  }

  return {
    sourceRow: minRow,
    sourceCol: minCol,
    targetRow: clampedTargetRow,
    targetCol: clampedTargetCol,
    rowCount,
    colCount,
    rowOffset,
    colOffset,
    sourceKeys,
    targetKeys,
  };
}
