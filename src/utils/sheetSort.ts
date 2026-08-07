// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Sheet Sort — pure functions for sorting data in a sheet.
 *
 * Each function takes a Sheet and returns a NEW Sheet with the sort applied.
 * Cell positions are shifted and formula references are adjusted to remain valid.
 */

import type { Sheet, Cell } from '../types';
import { cellKey } from '../types';
import { adjustFormulaRefs } from './formulaParser';

/** Sort direction. */
export type SortDirection = 'asc' | 'desc';

/** A single sort column specification. */
export interface SortColumn {
  /** 0-based column index. */
  column: number;
  /** Sort direction. */
  direction: SortDirection;
}

/**
 * Finds the bounding box of all cells with data in a sheet.
 * Returns {0,0,0,0} if no cells exist.
 */
export function findUsedRange(sheet: Sheet): {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
} {
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

  if (minRow === Number.MAX_SAFE_INTEGER) {
    return { startRow: 0, endRow: 0, startCol: 0, endCol: 0 };
  }

  return { startRow: minRow, endRow: maxRow, startCol: minCol, endCol: maxCol };
}

/**
 * Gets the sortable value from a cell.
 * Numbers sort before text; empty cells sort last.
 */
function getSortValue(cell: Cell | undefined): { type: 'number' | 'text' | 'empty'; value: number | string } {
  if (!cell || cell.rawValue === '') {
    return { type: 'empty', value: '' };
  }

  const raw = cell.computedValue !== undefined && cell.computedValue !== null
    ? String(cell.computedValue)
    : cell.rawValue;

  // Try to parse as number
  const trimmed = raw.trim();
  if (trimmed !== '') {
    const num = Number(trimmed);
    if (!isNaN(num) && isFinite(num)) {
      return { type: 'number', value: num };
    }
  }

  return { type: 'text', value: raw };
}

/**
 * Compares two rows for sorting.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
function compareRows(
  a: { rowIndex: number; cells: Record<number, Cell | undefined> },
  b: { rowIndex: number; cells: Record<number, Cell | undefined> },
  sortColumns: SortColumn[],
): number {
  for (const sortCol of sortColumns) {
    const aCell = a.cells[sortCol.column];
    const bCell = b.cells[sortCol.column];

    const aVal = getSortValue(aCell);
    const bVal = getSortValue(bCell);

    // Empty cells sort last regardless of direction
    if (aVal.type === 'empty' && bVal.type === 'empty') continue;
    if (aVal.type === 'empty') return 1;
    if (bVal.type === 'empty') return -1;

    let cmp: number;

    // Numbers always sort before text
    if (aVal.type === 'number' && bVal.type === 'text') cmp = -1;
    else if (aVal.type === 'text' && bVal.type === 'number') cmp = 1;
    else if (aVal.type === 'number' && bVal.type === 'number') {
      cmp = (aVal.value as number) - (bVal.value as number);
    } else {
      // Both text - case-insensitive comparison
      cmp = String(aVal.value).toLowerCase().localeCompare(String(bVal.value).toLowerCase());
    }

    if (cmp !== 0) {
      return sortCol.direction === 'asc' ? cmp : -cmp;
    }
  }

  // All sort columns equal - preserve original order (stable sort)
  return a.rowIndex - b.rowIndex;
}

/**
 * Sorts a range of rows in a sheet by one or more columns.
 *
 * @param sheet - The sheet to sort.
 * @param startRow - Starting row index (inclusive).
 * @param endRow - Ending row index (inclusive).
 * @param sortColumns - Array of sort specifications (in priority order).
 * @param hasHeader - If true, the first row (startRow) is treated as a header and not sorted.
 * @returns A new Sheet with the sort applied.
 */
export function sortRange(
  sheet: Sheet,
  startRow: number,
  endRow: number,
  sortColumns: SortColumn[],
  hasHeader?: boolean,
): Sheet {
  if (sortColumns.length === 0) return sheet;
  if (endRow <= startRow) return sheet;

  const dataStartRow = hasHeader ? startRow + 1 : startRow;
  if (dataStartRow >= endRow) return sheet; // Only header row, nothing to sort

  // Extract rows into sortable format
  const rows: Array<{ rowIndex: number; cells: Record<number, Cell | undefined> }> = [];
  for (let r = dataStartRow; r <= endRow; r++) {
    const rowCells: Record<number, Cell | undefined> = {};
    // Get all cells in this row across all columns in the sheet
    for (let c = 0; c < sheet.columnCount; c++) {
      rowCells[c] = sheet.cells[cellKey(r, c)];
    }
    rows.push({ rowIndex: r, cells: rowCells });
  }

  // Sort rows
  rows.sort((a, b) => compareRows(a, b, sortColumns));

  // Build new cells map with remapped positions
  const newCells: Record<string, Cell> = {};

  // Copy cells outside sort range unchanged
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const colonIndex = key.indexOf(':');
    const r = parseInt(key.slice(0, colonIndex), 10);

    if (r < startRow || r > endRow) {
      newCells[key] = cell;
    } else if (hasHeader && r === startRow) {
      newCells[key] = cell; // Header row stays put
    }
    // Cells within data range will be remapped below
  }

  // Place sorted rows back into the sheet
  for (let i = 0; i < rows.length; i++) {
    const sourceRowIndex = rows[i].rowIndex;
    const destRowIndex = dataStartRow + i;
    const rowData = rows[i].cells;

    for (let c = 0; c < sheet.columnCount; c++) {
      const cell = rowData[c];
      if (!cell) continue;

      const destKey = cellKey(destRowIndex, c);

      // If formula, adjust references based on row movement
      if (cell.rawValue.startsWith('=')) {
        const rowOffset = destRowIndex - sourceRowIndex;
        if (rowOffset !== 0) {
          const formulaBody = cell.rawValue.slice(1);
          const adjusted = adjustFormulaRefs(formulaBody, rowOffset, 0);
          newCells[destKey] = { ...cell, rawValue: '=' + adjusted };
        } else {
          newCells[destKey] = { ...cell };
        }
      } else {
        newCells[destKey] = { ...cell };
      }
    }
  }

  return {
    ...sheet,
    cells: newCells,
  };
}

/**
 * Finds the contiguous region of data surrounding a given cell (Excel's "Current Region").
 * Expands in all four directions until it hits an entirely empty row or column.
 * If the starting cell is empty, returns just that cell.
 */
export function getCurrentRegion(
  sheet: Sheet,
  row: number,
  col: number,
): {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
} {
  // If the starting cell itself has no data, return just that cell
  if (!sheet.cells[cellKey(row, col)]) {
    return { startRow: row, endRow: row, startCol: col, endCol: col };
  }

  let startRow = row;
  let endRow = row;
  let startCol = col;
  let endCol = col;

  // Iteratively expand in all 4 directions until no more expansion
  let expanded = true;
  while (expanded) {
    expanded = false;

    // Expand up: check if row (startRow-1) has any data in [startCol, endCol]
    if (startRow > 0 && rowHasAnyCell(sheet, startRow - 1, startCol, endCol)) {
      startRow--;
      expanded = true;
    }
    // Expand down: check if row (endRow+1) has any data in [startCol, endCol]
    if (rowHasAnyCell(sheet, endRow + 1, startCol, endCol)) {
      endRow++;
      expanded = true;
    }
    // Expand left: check if col (startCol-1) has any data in [startRow, endRow]
    if (startCol > 0 && colHasAnyCell(sheet, startCol - 1, startRow, endRow)) {
      startCol--;
      expanded = true;
    }
    // Expand right: check if col (endCol+1) has any data in [startRow, endRow]
    if (colHasAnyCell(sheet, endCol + 1, startRow, endRow)) {
      endCol++;
      expanded = true;
    }
  }

  return { startRow, endRow, startCol, endCol };
}

/** Checks whether a row has any cells with data within a column range. */
function rowHasAnyCell(sheet: Sheet, row: number, startCol: number, endCol: number): boolean {
  for (let c = startCol; c <= endCol; c++) {
    if (sheet.cells[cellKey(row, c)]) return true;
  }
  return false;
}

/** Checks whether a column has any cells with data within a row range. */
function colHasAnyCell(sheet: Sheet, col: number, startRow: number, endRow: number): boolean {
  for (let r = startRow; r <= endRow; r++) {
    if (sheet.cells[cellKey(r, col)]) return true;
  }
  return false;
}

/**
 * Convenience function: sorts the entire sheet by a single column.
 * Detects the used range automatically.
 *
 * @param sheet - The sheet to sort.
 * @param column - Column index to sort by.
 * @param direction - Sort direction.
 * @param hasHeader - Whether row 0 is a header row.
 * @returns A new Sheet with the sort applied.
 */
export function sortEntireSheet(
  sheet: Sheet,
  column: number,
  direction: SortDirection,
  hasHeader?: boolean,
): Sheet {
  const range = findUsedRange(sheet);
  if (range.startRow === range.endRow && range.startCol === range.endCol && !sheet.cells[cellKey(0, 0)]) {
    return sheet; // Empty sheet
  }

  return sortRange(sheet, range.startRow, range.endRow, [{ column, direction }], hasHeader);
}

/**
 * Sorts the currently selected range by its first column.
 * Falls back to sorting entire sheet if selection is a single cell.
 */
export function sortSelection(
  sheet: Sheet,
  selectionStartRow: number,
  selectionStartCol: number,
  selectionEndRow: number,
  selectionEndCol: number,
  direction: SortDirection,
  hasHeader?: boolean,
): Sheet {
  // If selection is a single cell or column selection, sort entire sheet by that column
  if (selectionStartRow === selectionEndRow || selectionStartCol !== selectionEndCol) {
    // Single row or full column selection - sort entire sheet by the active column
    const sortCol = selectionStartCol === selectionEndCol ? selectionStartCol : selectionStartCol;
    return sortEntireSheet(sheet, sortCol, direction, hasHeader);
  }

  // Range selection - sort by first column of selection
  return sortRange(sheet, selectionStartRow, selectionEndRow, [{ column: selectionStartCol, direction }], hasHeader);
}
