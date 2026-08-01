// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import type { Cell } from '../types';

/**
 * Represents a rectangular range of cell data copied to the clipboard.
 */
export interface ClipboardData {
  /** 2D array of cells (row-major). null means empty cell. */
  cells: (Cell | null)[][];
  /** Number of rows in the clipboard. */
  rowCount: number;
  /** Number of columns in the clipboard. */
  colCount: number;
  /** Whether this is a cut operation (source cells should be cleared). */
  isCut: boolean;
  /** The type of selection that produced this clipboard data. */
  selectionType?: 'cell' | 'row' | 'col';
  /** Index of the sheet this data was copied from (for cross-sheet paste). */
  sourceSheetIndex?: number;
  /** Top-left row of the source range (for correct formula offset calculation). */
  sourceRow?: number;
  /** Top-left column of the source range (for correct formula offset calculation). */
  sourceCol?: number;
}

// Module-level clipboard (survives within the session)
let clipboardData: ClipboardData | null = null;

/**
 * Copies a rectangular range of cells to the clipboard.
 * @param cells - Map of cell key ("row:col") to Cell.
 * @param startRow - Starting row (inclusive).
 * @param startCol - Starting column (inclusive).
 * @param endRow - Ending row (inclusive).
 * @param endCol - Ending column (inclusive).
 * @param selectionType - Type of selection that produced this clipboard data.
 * @param sourceSheetIndex - Index of the source sheet (for cross-sheet paste).
 * @returns The clipboard data for inspection/testing.
 */
export function copyRange(
  cells: Record<string, Cell>,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  selectionType?: 'cell' | 'row' | 'col',
  sourceSheetIndex?: number
): ClipboardData {
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);

  const rowCount = maxRow - minRow + 1;
  const colCount = maxCol - minCol + 1;

  const grid: (Cell | null)[][] = [];
  for (let r = 0; r < rowCount; r++) {
    const row: (Cell | null)[] = [];
    for (let c = 0; c < colCount; c++) {
      const key = `${minRow + r}:${minCol + c}`;
      row.push(cells[key] ?? null);
    }
    grid.push(row);
  }

  clipboardData = { cells: grid, rowCount, colCount, isCut: false, selectionType, sourceSheetIndex, sourceRow: minRow, sourceCol: minCol };
  return clipboardData;
}

/**
 * Cuts a rectangular range — copies then marks as cut.
 * Source cells should be cleared by the caller after this.
 */
export function cutRange(
  cells: Record<string, Cell>,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  selectionType?: 'cell' | 'row' | 'col',
  sourceSheetIndex?: number
): ClipboardData {
  const data = copyRange(cells, startRow, startCol, endRow, endCol, selectionType, sourceSheetIndex);
  data.isCut = true;
  return data;
}

/**
 * Retrieves the current clipboard data.
 */
export function getClipboard(): ClipboardData | null {
  return clipboardData;
}

/**
 * Clears the clipboard.
 */
export function clearClipboard(): void {
  clipboardData = null;
}

/**
 * Checks if the clipboard has data.
 */
export function hasClipboardData(): boolean {
  return clipboardData !== null && clipboardData.rowCount > 0;
}

/**
 * Parses the clipboard as a CSV string.
 * Useful for cross-application paste.
 */
export function clipboardAsCsv(data: ClipboardData, delimiter: string = ','): string {
  return data.cells
    .map((row) =>
      row
        .map((cell) => {
          const value = cell?.rawValue ?? '';
          // Escape values containing the delimiter, newlines, or quotes
          if (value.includes(delimiter) || value.includes('\n') || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(delimiter)
    )
    .join('\n');
}

/**
 * Converts clipboard data to TSV (tab-separated values) format.
 * TSV is preferred for pasting into spreadsheet applications.
 * @param data - The clipboard data to convert.
 * @returns The TSV string representation.
 */
export function clipboardAsTsv(data: ClipboardData): string {
  return clipboardAsCsv(data, '\t');
}

/**
 * Writes clipboard data to the system clipboard as TSV.
 * This enables pasting into external applications (Excel, Google Sheets, etc.).
 * @param data - The clipboard data to write.
 * @returns A promise that resolves when the write is complete.
 */
export function writeClipboardToSystem(data: ClipboardData): Promise<void> {
  const tsv = clipboardAsTsv(data);
  return navigator.clipboard.writeText(tsv);
}

/**
 * Generates a fill series from a starting value.
 * Handles numbers (incrementing), dates (incrementing by day), and text+number patterns.
 * @param startValue - The starting cell value.
 * @param count - How many values to generate.
 * @returns Array of fill values.
 */
export function generateFillSeries(startValue: string, count: number): string[] {
  const result: string[] = [startValue];

  // Try numeric series
  const num = parseFloat(startValue);
  if (!isNaN(num) && /^-?\d*\.?\d+$/.test(startValue.trim())) {
    for (let i = 1; i < count; i++) {
      result.push(String(num + i));
    }
    return result;
  }

  // Try date series (ISO format: YYYY-MM-DD)
  const dateMatch = startValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const start = new Date(startValue);
    if (!isNaN(start.getTime())) {
      for (let i = 1; i < count; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        result.push(d.toISOString().slice(0, 10));
      }
      return result;
    }
  }

  // Try text+number pattern (e.g., "Item 1", "Item 2")
  const textNumMatch = startValue.match(/^(.*?)(\d+)$/);
  if (textNumMatch) {
    const prefix = textNumMatch[1];
    const startNum = parseInt(textNumMatch[2], 10);
    const padLen = textNumMatch[2].length;
    for (let i = 1; i < count; i++) {
      const padded = String(startNum + i).padStart(padLen, '0');
      result.push(`${prefix}${padded}`);
    }
    return result;
  }

  // Default: repeat the value
  for (let i = 1; i < count; i++) {
    result.push(startValue);
  }
  return result;
}

/**
 * Handles the fill-handle drag operation.
 * Given a source cell and a target row/col, generates the fill values.
 */
export function computeFillHandle(
  sourceCell: Cell | null,
  _fillDirection: 'down' | 'right',
  fillCount: number
): string[] {
  if (!sourceCell) return Array(fillCount).fill('');
  return generateFillSeries(sourceCell.rawValue, fillCount + 1).slice(1);
}
