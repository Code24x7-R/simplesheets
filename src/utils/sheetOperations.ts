/**
 * Sheet Operations — pure functions for structural changes to a sheet.
 *
 * Each function takes a Sheet and returns a NEW Sheet with the operation applied.
 * Cell positions are shifted and formula references are adjusted to remain valid.
 */

import type { Sheet, Cell } from '../types';
import { cellKey } from '../types';
import { colToLetter } from '../types';

/**
 * Adjusts formula references in a single cell's rawValue for a structural change.
 *
 * For insert at `index` with delta +1: refs at row/col >= index shift by +1.
 * For delete at `index` with delta -1: refs at row/col > index shift by -1.
 * Refs pointing exactly at a deleted index become #REF!.
 *
 * @param formula - The formula string (must start with '=' to be processed).
 * @param index - The row or column index where the operation happens.
 * @param delta - +1 for insert, -1 for delete.
 * @param axis - Whether to adjust 'row' or 'col' references.
 * @returns The adjusted formula string.
 */
function adjustFormulaForStructuralChange(
  formula: string,
  index: number,
  delta: number,
  axis: 'row' | 'col',
): string {
  if (!formula.startsWith('=')) return formula;

  // Match cell refs: optional $ col, column letters, optional $ row, row digits.
  // Negative lookbehind avoids matching scientific notation (e.g. 1e5).
  const cellRefRegex = /(?<![0-9])(\$?)([A-Za-z]+)(\$?)(\d+)/gi;

  return formula.replace(cellRefRegex, (match, dollarCol: string, colLetters: string, dollarRow: string, rowStr: string) => {
    if (axis === 'row') {
      const absRow = dollarRow === '$';
      const absCol = dollarCol === '$';
      const rowNum = parseInt(rowStr, 10) - 1; // 0-based

      // Adjust column letters to uppercase even if no shift
      const normalizedCol = colLetters.toUpperCase();

      if (absRow) {
        // Absolute row — only normalize column case
        return `${absCol ? '$' : ''}${normalizedCol}$${rowStr}`;
      }

      // Relative row
      if (delta < 0 && rowNum === index) {
        // This ref pointed at the deleted row — entire ref becomes #REF!
        return '#REF!';
      }

      if (rowNum >= index) {
        const newRow = rowNum + delta;
        if (newRow >= 0) {
          return `${absCol ? '$' : ''}${normalizedCol}${dollarRow}${newRow + 1}`;
        }
        /* istanbul ignore next - edge case: row out of bounds */
        return match; // out of bounds, keep original
      }

      // Above the change — just normalize column case
      return `${absCol ? '$' : ''}${normalizedCol}${dollarRow}${rowStr}`;
    } else {
      // axis === 'col'
      const absCol = dollarCol === '$';
      const absRow = dollarRow === '$';

      // Convert column letters to 0-based number
      let colNum = 0;
      for (const ch of colLetters.toUpperCase()) {
        colNum = colNum * 26 + (ch.charCodeAt(0) - 64);
      }
      colNum -= 1; // 0-based

      if (absCol) {
        // Absolute column — keep as-is (just normalize case)
        return `$${colLetters.toUpperCase()}${absRow ? '$' : ''}${rowStr}`;
      }

      // Relative column
      if (delta < 0 && colNum === index) {
        // This ref pointed at the deleted column — entire ref becomes #REF!
        return '#REF!';
      }

      if (colNum >= index) {
        const newCol = colNum + delta;
        if (newCol >= 0) {
          return `${dollarCol}${colToLetter(newCol)}${absRow ? '$' : ''}${rowStr}`;
        }
        return match;
      }

      // Left of the change — just normalize
      return `${dollarCol}${colLetters.toUpperCase()}${absRow ? '$' : ''}${rowStr}`;
    }
  });
}

/**
 * Checks if a cell contains a formula.
 */
function isFormula(cell: Cell): boolean {
  return cell.rawValue.startsWith('=');
}

/**
 * Inserts a blank row at the given index.
 * Cells at and below the index shift down by 1.
 * Formula references at or below the index are adjusted.
 */
export function insertRow(sheet: Sheet, rowIndex: number): Sheet {
  const newCells: Record<string, Cell> = {};

  for (const [key, cell] of Object.entries(sheet.cells)) {
    const [r, c] = key.split(':').map(Number);
    if (r >= rowIndex) {
      // Shift down
      const newKey = cellKey(r + 1, c);
      newCells[newKey] = isFormula(cell)
        ? { ...cell, rawValue: adjustFormulaForStructuralChange(cell.rawValue, rowIndex, +1, 'row') }
        : cell;
    } else {
      // Above insertion — adjust formulas that reference rows >= rowIndex
      newCells[key] = isFormula(cell)
        ? { ...cell, rawValue: adjustFormulaForStructuralChange(cell.rawValue, rowIndex, +1, 'row') }
        : cell;
    }
  }

  // Shift rowHeights down
  const newRowHeights: Record<number, number> = {};
  for (const [r, h] of Object.entries(sheet.rowHeights)) {
    const ri = Number(r);
    newRowHeights[ri >= rowIndex ? ri + 1 : ri] = h;
  }

  // Adjust frozen rows: if frozen boundary is at or below the insertion, it moves down
  const newFrozenRows = sheet.frozenRows > 0 && sheet.frozenRows >= rowIndex
    ? sheet.frozenRows + 1
    : sheet.frozenRows;

  return {
    ...sheet,
    cells: newCells,
    rowHeights: newRowHeights,
    rowCount: sheet.rowCount + 1,
    frozenRows: newFrozenRows,
  };
}

/**
 * Deletes the row at the given index.
 * Cells below the index shift up by 1.
 * Formula references below the index shift up; refs at the deleted index become #REF!.
 */
export function deleteRow(sheet: Sheet, rowIndex: number): Sheet {
  const newCells: Record<string, Cell> = {};

  for (const [key, cell] of Object.entries(sheet.cells)) {
    const [r, c] = key.split(':').map(Number);
    if (r < rowIndex) {
      // Above deletion — adjust formulas referencing rows > rowIndex or = rowIndex
      newCells[key] = isFormula(cell)
        ? { ...cell, rawValue: adjustFormulaForStructuralChange(cell.rawValue, rowIndex, -1, 'row') }
        : cell;
    } else if (r > rowIndex) {
      // Below deletion — shift up
      const newKey = cellKey(r - 1, c);
      newCells[newKey] = isFormula(cell)
        ? { ...cell, rawValue: adjustFormulaForStructuralChange(cell.rawValue, rowIndex, -1, 'row') }
        : cell;
    }
    // r === rowIndex → cell is deleted (omitted from newCells)
  }

  // Shift rowHeights up
  const newRowHeights: Record<number, number> = {};
  for (const [r, h] of Object.entries(sheet.rowHeights)) {
    const ri = Number(r);
    if (ri < rowIndex) {
      newRowHeights[ri] = h;
    } else if (ri > rowIndex) {
      newRowHeights[ri - 1] = h;
    }
    // ri === rowIndex → deleted
  }

  // Adjust frozen rows
  const newFrozenRows = sheet.frozenRows > 0
    ? sheet.frozenRows <= rowIndex
      ? sheet.frozenRows // frozen region is above the deleted row
      : Math.max(0, sheet.frozenRows - 1)
    : 0;

  return {
    ...sheet,
    cells: newCells,
    rowHeights: newRowHeights,
    rowCount: Math.max(1, sheet.rowCount - 1),
    frozenRows: newFrozenRows,
  };
}

/**
 * Inserts a blank column at the given index.
 * Cells at and to the right of the index shift right by 1.
 */
export function insertCol(sheet: Sheet, colIndex: number): Sheet {
  const newCells: Record<string, Cell> = {};

  for (const [key, cell] of Object.entries(sheet.cells)) {
    const [r, c] = key.split(':').map(Number);
    if (c >= colIndex) {
      const newKey = cellKey(r, c + 1);
      newCells[newKey] = isFormula(cell)
        ? { ...cell, rawValue: adjustFormulaForStructuralChange(cell.rawValue, colIndex, +1, 'col') }
        : cell;
    } else {
      newCells[key] = isFormula(cell)
        ? { ...cell, rawValue: adjustFormulaForStructuralChange(cell.rawValue, colIndex, +1, 'col') }
        : cell;
    }
  }

  // Shift columnWidths right
  const newColWidths: Record<number, number> = {};
  for (const [c, w] of Object.entries(sheet.columnWidths)) {
    const ci = Number(c);
    newColWidths[ci >= colIndex ? ci + 1 : ci] = w;
  }

  // Adjust frozen columns
  const newFrozenCols = sheet.frozenColumns > 0 && sheet.frozenColumns >= colIndex
    ? sheet.frozenColumns + 1
    : sheet.frozenColumns;

  return {
    ...sheet,
    cells: newCells,
    columnWidths: newColWidths,
    columnCount: sheet.columnCount + 1,
    frozenColumns: newFrozenCols,
  };
}

/**
 * Deletes the column at the given index.
 * Cells to the right shift left by 1.
 */
export function deleteCol(sheet: Sheet, colIndex: number): Sheet {
  const newCells: Record<string, Cell> = {};

  for (const [key, cell] of Object.entries(sheet.cells)) {
    const [r, c] = key.split(':').map(Number);
    if (c < colIndex) {
      newCells[key] = isFormula(cell)
        ? { ...cell, rawValue: adjustFormulaForStructuralChange(cell.rawValue, colIndex, -1, 'col') }
        : cell;
    } else if (c > colIndex) {
      const newKey = cellKey(r, c - 1);
      newCells[newKey] = isFormula(cell)
        ? { ...cell, rawValue: adjustFormulaForStructuralChange(cell.rawValue, colIndex, -1, 'col') }
        : cell;
    }
    // c === colIndex → deleted
  }

  // Shift columnWidths left
  const newColWidths: Record<number, number> = {};
  for (const [c, w] of Object.entries(sheet.columnWidths)) {
    const ci = Number(c);
    if (ci < colIndex) {
      newColWidths[ci] = w;
    } else if (ci > colIndex) {
      newColWidths[ci - 1] = w;
    }
  }

  // Adjust frozen columns
  const newFrozenCols = sheet.frozenColumns > 0
    ? sheet.frozenColumns <= colIndex
      ? sheet.frozenColumns
      : Math.max(0, sheet.frozenColumns - 1)
    : 0;

  return {
    ...sheet,
    cells: newCells,
    columnWidths: newColWidths,
    columnCount: Math.max(1, sheet.columnCount - 1),
    frozenColumns: newFrozenCols,
  };
}
