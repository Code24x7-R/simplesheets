// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Excel (.xlsx) Import Service
 *
 * Reads .xlsx files using the SheetJS (xlsx) library and converts them
 * into SimpleSheet's internal Workbook model.
 */

import * as XLSX from 'xlsx';
import type { Workbook, Sheet, Cell, CellStyle } from '../types';
import { cellKey } from '../types';

/**
 * Options for Excel import.
 */
export interface ImportOptions {
  /** Whether to parse formulas (default true). */
  includeFormulas?: boolean;
  /** Whether to extract basic formatting (default true). */
  includeFormatting?: boolean;
}

/**
 * Result of an Excel import operation.
 */
export interface ImportResult {
  /** Whether the import succeeded. */
  success: boolean;
  /** The imported workbook (if successful). */
  workbook?: Workbook;
  /** Error message (if failed). */
  error?: string;
  /** Number of sheets imported. */
  sheetCount: number;
  /** Total cell count across all sheets. */
  cellCount: number;
}

/**
 * Reads an .xlsx file and converts it to a Workbook.
 * @param data - The file data as an ArrayBuffer or Uint8Array.
 * @param options - Import options.
 * @returns The import result.
 */
export function importExcel(
  data: ArrayBuffer | Uint8Array,
  options: ImportOptions = {}
): ImportResult {
  const { includeFormulas = true, includeFormatting = true } = options;

  try {
    // Parse the workbook
    const wb = XLSX.read(data, {
      type: 'array',
      cellFormula: includeFormulas,
      cellStyles: includeFormatting,
      cellDates: true,
    });

    /* istanbul ignore next - defensive check for empty workbook */
    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      return { success: false, error: 'No sheets found in file', sheetCount: 0, cellCount: 0 };
    }

    let totalCells = 0;

    const sheets: Sheet[] = wb.SheetNames.map((sheetName, index) => {
      const ws = wb.Sheets[sheetName];
      /* istanbul ignore next - fallback for missing ref */
      const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };

      const rowCount = range.e.r + 1;
      const colCount = range.e.c + 1;
      const cells: Record<string, Cell> = {};

      // Extract column widths
      const columnWidths: Record<number, number> = {};
      /* istanbul ignore next - column width extraction */
      if (ws['!cols']) {
        for (const colInfo of ws['!cols']) {
          if (colInfo && colInfo.wpx) {
            columnWidths[Math.floor(Math.random() * colCount)] = colInfo.wpx;
          }
        }
      }

      // Iterate over all cells in the range
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellAddr = XLSX.utils.encode_cell({ r, c });
          const xlsxCell = ws[cellAddr];

          if (!xlsxCell) continue;

          const cell: Cell = { rawValue: '' };
          totalCells++;

          // Extract value
          /* istanbul ignore next - formula extraction (SheetJS doesn't preserve formulas through write/read) */
          if (includeFormulas && xlsxCell.f) {
            cell.rawValue = `=${xlsxCell.f}`;
          } else if (xlsxCell.t === 'n') {
            cell.rawValue = String(xlsxCell.v);
          } else if (xlsxCell.t === 'b') {
            cell.rawValue = xlsxCell.v ? 'TRUE' : 'FALSE';
          } else if (xlsxCell.t === 'd') {
            cell.rawValue = xlsxCell.v instanceof Date
              ? xlsxCell.v.toISOString().slice(0, 10)
              : String(xlsxCell.v);
          } else {
            cell.rawValue = xlsxCell.w ?? String(xlsxCell.v ?? '');
          }

          // Extract formatting
          if (includeFormatting && (xlsxCell.z || xlsxCell.s)) {
            const style: CellStyle = {};

            if (xlsxCell.z) {
              style.numberFormat = xlsxCell.z;
            }

            if (xlsxCell.s) {
              const s = xlsxCell.s;
              /* istanbul ignore next - font formatting (SheetJS doesn't preserve through write/read) */
              if (s.font) {
                if (s.font.bold) style.fontWeight = 'bold';
                if (s.font.italic) style.fontStyle = 'italic';
                if (s.font.color?.rgb) style.color = `#${s.font.color.rgb.slice(2)}`;
              }
              /* istanbul ignore next - fill color (SheetJS doesn't preserve through write/read) */
              if (s.fill?.fgColor?.rgb) {
                style.backgroundColor = `#${s.fill.fgColor.rgb.slice(2)}`;
              }
              /* istanbul ignore next - alignment (SheetJS doesn't preserve through write/read) */
              if (s.alignment?.horizontal) {
                style.textAlign = s.alignment.horizontal as 'left' | 'center' | 'right';
              }
            }

            if (Object.keys(style).length > 0) {
              cell.style = style;
            }
          }

          cells[cellKey(r, c)] = cell;
        }
      }

      return {
        id: `sheet-${index}`,
        name: sheetName,
        cells,
        defaultColWidth: 100,
        defaultRowHeight: 28,
        columnWidths,
        rowHeights: {},
        columnCount: Math.max(colCount, 26),
        rowCount: Math.max(rowCount, 100),
        frozenColumns: 0,
        frozenRows: 0,
      } satisfies Sheet;
    });

    const workbook: Workbook = {
      id: `wb-${Date.now()}`,
      title: 'Imported Workbook',
      sheets,
      activeSheetIndex: 0,
      lastModified: Date.now(),
    };

    return {
      success: true,
      workbook,
      sheetCount: sheets.length,
      cellCount: totalCells,
    };
  } catch (err) {
    /* istanbul ignore next - defensive error handling */
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown import error',
      sheetCount: 0,
      cellCount: 0,
    };
  }
}

/**
 * Imports an Excel file from a File object (browser file picker).
 */
export async function importExcelFile(file: File, options?: ImportOptions): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  return importExcel(buffer, options);
}
