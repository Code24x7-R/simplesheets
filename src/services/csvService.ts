/**
 * CSV / TSV Import & Export Service
 *
 * Uses PapaParse for robust CSV/TSV parsing with support for
 * quoted fields, newlines in cells, and configurable delimiters.
 */

import Papa from 'papaparse';
import type { Workbook, Sheet, Cell } from '../types';
import { cellKey } from '../types';

/**
 * Options for CSV/TSV import.
 */
export interface CsvImportOptions {
  /** Field delimiter (default ','). */
  delimiter?: string;
  /** Whether the first row contains headers. */
  hasHeader?: boolean;
  /** Encoding (default 'UTF-8'). */
  encoding?: string;
}

/**
 * Result of a CSV/TSV import operation.
 */
export interface CsvImportResult {
  success: boolean;
  workbook?: Workbook;
  error?: string;
  rowCount: number;
  colCount: number;
}

/**
 * Imports a CSV string into a Workbook.
 * @param csv - The CSV content as a string.
 * @param options - Import options.
 */
export function importCsv(csv: string, options: CsvImportOptions = {}): CsvImportResult {
  const { delimiter = ',', hasHeader = false } = options;

  try {
    const result = Papa.parse<string[]>(csv, {
      delimiter,
      skipEmptyLines: true,
      dynamicTyping: false, // Keep everything as strings for cell-level type detection
    });

    if (result.errors.length > 0 && result.data.length === 0) {
      return {
        success: false,
        error: result.errors[0]?.message ?? /* istanbul ignore next */ 'Parse error',
        rowCount: 0,
        colCount: 0,
      };
    }

    return createWorkbookFromRows(result.data, hasHeader ? result.data[0] : undefined);
  } catch {
    /* istanbul ignore next - Papa.parse rarely throws */
    return {
      success: false,
      error: 'Unknown error',
      rowCount: 0,
      colCount: 0,
    };
  }
}

/**
 * Imports a TSV (tab-separated) string.
 */
export function importTsv(tsv: string, options: Omit<CsvImportOptions, 'delimiter'> = {}): CsvImportResult {
  return importCsv(tsv, { ...options, delimiter: '\t' });
}

/**
 * Exports a sheet to CSV format.
 * @param sheet - The sheet to export.
 * @param delimiter - Field delimiter (default ',').
 * @returns CSV string.
 */
export function exportCsv(sheet: Sheet, delimiter: string = ','): string {
  const rows: string[][] = [];

  // Use the used range to avoid iterating over millions of empty cells
  const usedRange = findUsedRange(sheet);
  if (!usedRange) return '';

  const { minRow, maxRow, minCol, maxCol } = usedRange;

  for (let r = minRow; r <= maxRow; r++) {
    const row: string[] = [];
    for (let c = minCol; c <= maxCol; c++) {
      const cell = sheet.cells[cellKey(r, c)];
      const value = cell?.computedValue !== undefined && cell?.computedValue !== null
        ? String(cell.computedValue)
        : cell?.rawValue ?? '';
      row.push(value);
    }
    rows.push(row);
  }

  return Papa.unparse(rows, {
    delimiter,
  });
}

/**
 * Finds the bounding range of cells that contain data.
 * Returns null if the sheet is empty.
 */
function findUsedRange(sheet: Sheet): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null {
  const keys = Object.keys(sheet.cells);
  if (keys.length === 0) return null;

  let minRow = Infinity, maxRow = -Infinity;
  let minCol = Infinity, maxCol = -Infinity;

  for (const key of keys) {
    const [rowStr, colStr] = key.split(':');
    const row = parseInt(rowStr, 10);
    const col = parseInt(colStr, 10);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
  }

  return { minRow, maxRow, minCol, maxCol };
}

/**
 * Exports a sheet to TSV format.
 */
export function exportTsv(sheet: Sheet): string {
  return exportCsv(sheet, '\t');
}

/**
 * Triggers a download of a string as a file.
 */
export function downloadTextFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads the sheet as a CSV file.
 */
export function downloadCsv(sheet: Sheet, filename?: string): void {
  const csv = exportCsv(sheet);
  downloadTextFile(csv, `${filename ?? sheet.name}.csv`, 'text/csv');
}

/**
 * Downloads the sheet as a TSV file.
 */
export function downloadTsv(sheet: Sheet, filename?: string): void {
  const tsv = exportTsv(sheet);
  downloadTextFile(tsv, `${filename ?? sheet.name}.tsv`, 'text/tab-separated-values');
}

/**
 * Downloads the sheet as a .txt file (tab-delimited).
 */
export function downloadTxt(sheet: Sheet, filename?: string): void {
  const tsv = exportTsv(sheet);
  downloadTextFile(tsv, `${filename ?? sheet.name}.txt`, 'text/plain');
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

function createWorkbookFromRows(
  rows: string[][],
  headerRow?: string[]
): CsvImportResult {
  if (rows.length === 0) {
    return { success: false, error: 'Empty file', rowCount: 0, colCount: 0 };
  }

  const dataRows = headerRow ? rows.slice(1) : rows;
  const maxCols = Math.max(...rows.map((r) => r.length));

  const cells: Record<string, Cell> = {};

  for (let r = 0; r < dataRows.length; r++) {
    for (let c = 0; c < dataRows[r].length; c++) {
      const value = dataRows[r][c];
      if (value !== '' && value !== undefined) {
        cells[cellKey(r, c)] = { rawValue: value };
      }
    }
  }

  const sheet: Sheet = {
    id: 'csv-sheet',
    name: 'Imported',
    cells,
    defaultColWidth: 100,
    defaultRowHeight: 28,
    columnWidths: {},
    rowHeights: {},
    columnCount: Math.max(maxCols, 26),
    rowCount: Math.max(dataRows.length + 10, 100),
    frozenColumns: 0,
    frozenRows: 0,
  };

  const workbook: Workbook = {
    id: `csv-wb-${Date.now()}`,
    title: headerRow ? 'CSV Import' : 'Imported Data',
    sheets: [sheet],
    activeSheetIndex: 0,
    lastModified: Date.now(),
  };

  return {
    success: true,
    workbook,
    rowCount: dataRows.length,
    colCount: maxCols,
  };
}
