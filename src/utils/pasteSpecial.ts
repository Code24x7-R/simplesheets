// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import type { ClipboardData } from './clipboard';
import type { Cell } from '../types';

export type PasteMode = 'all' | 'formulas' | 'values' | 'formatting';

export interface PasteOptions {
  /** What to paste: everything, formulas only, values only, or formatting only. */
  mode: PasteMode;
  /** Whether to transpose rows and columns. */
  transpose?: boolean;
}

/**
 * Converts a computed value to its string representation for paste.
 */
function computedValueToString(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}

/**
 * Applies paste special options to clipboard data, returning a new ClipboardData.
 * The original clipboard data is not mutated.
 */
export function applyPasteOptions(clipboard: ClipboardData, options: PasteOptions): ClipboardData {
  const { mode, transpose = false } = options;

  // First, transform cells according to paste mode
  const transformedCells: (Cell | null)[][] = clipboard.cells.map((row: (Cell | null)[]) =>
    row.map((cell: Cell | null) => {
      if (!cell) return null;

      switch (mode) {
        case 'all': {
          // Preserve everything
          return { ...cell };
        }

        case 'formulas': {
          // Preserve rawValue (formulas and literals), strip styles
          return { rawValue: cell.rawValue };
        }

        case 'values': {
          // Convert formulas to values, strip styles
          let newRawValue = cell.rawValue;
          if (cell.rawValue.startsWith('=')) {
            newRawValue = computedValueToString(cell.computedValue);
          }
          return { rawValue: newRawValue };
        }

        case 'formatting': {
          // Preserve styles, clear values
          const newCell: Cell = { rawValue: '' };
          if (cell.style) {
            newCell.style = { ...cell.style };
          }
          return newCell;
        }

        /* istanbul ignore next - exhaustive switch */
        default:
          return { ...cell };
      }
    })
  );

  // Then, transpose if requested
  let resultCells = transformedCells;
  let resultRowCount = clipboard.rowCount;
  let resultColCount = clipboard.colCount;

  if (transpose && transformedCells.length > 0) {
    const srcRows = transformedCells.length;
    const srcCols = transformedCells[0]?.length ?? 0;
    const transposed: (Cell | null)[][] = [];
    for (let c = 0; c < srcCols; c++) {
      const newRow: (Cell | null)[] = [];
      for (let r = 0; r < srcRows; r++) {
        newRow.push(transformedCells[r][c] ?? null);
      }
      transposed.push(newRow);
    }
    resultCells = transposed;
    resultRowCount = srcCols;
    resultColCount = srcRows;
  }

  return {
    cells: resultCells,
    rowCount: resultRowCount,
    colCount: resultColCount,
    isCut: clipboard.isCut,
    selectionType: clipboard.selectionType,
    sourceSheetIndex: clipboard.sourceSheetIndex,
    sourceRow: clipboard.sourceRow,
    sourceCol: clipboard.sourceCol,
  };
}
