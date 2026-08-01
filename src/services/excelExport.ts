// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Excel (.xlsx) Export Service
 *
 * Converts SimpleSheet's internal Workbook model to .xlsx format
 * using the SheetJS (xlsx) library.
 */

import * as XLSX from 'xlsx';
import type { Workbook, Sheet, Cell } from '../types';
import { colToLetter } from '../types';

/**
 * Options for Excel export.
 */
export interface ExportOptions {
  /** Whether to include formulas (default true). */
  includeFormulas?: boolean;
  /** Whether to include cell styling (default true). */
  includeFormatting?: boolean;
}

/**
 * Converts a Workbook to an .xlsx Blob.
 * @param workbook - The workbook to export.
 * @param options - Export options.
 * @returns A Blob containing the .xlsx file data.
 */
export function exportExcel(workbook: Workbook, options: ExportOptions = {}): Blob {
  const { includeFormulas = true, includeFormatting = true } = options;

  const wb = XLSX.utils.book_new();

  for (const sheet of workbook.sheets) {
    const ws = sheetToWorkSheet(sheet, { includeFormulas, includeFormatting });

    // Set the sheet range
    const range = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: sheet.rowCount - 1, c: sheet.columnCount - 1 },
    });
    ws['!ref'] = range;

    // Add column widths
    ws['!cols'] = [];
    for (let c = 0; c < sheet.columnCount; c++) {
      const width = sheet.columnWidths[c] ?? sheet.defaultColWidth;
      ws['!cols'].push({ wpx: width });
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  // Generate the xlsx file as a binary array
  const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Converts a Sheet to a SheetJS worksheet object.
 */
function sheetToWorkSheet(
  sheet: Sheet,
  options: Required<ExportOptions>
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  for (const [key, cell] of Object.entries(sheet.cells)) {
    const [rowStr, colStr] = key.split(':');
    const row = parseInt(rowStr, 10);
    const col = parseInt(colStr, 10);
    const addr = `${colToLetter(col)}${row + 1}`;

    // Determine the cell type and value
    const isFormula = cell.rawValue.startsWith('=');

    if (isFormula && options.includeFormulas) {
      ws[addr] = {
        t: 'n', // Will be computed by the target app
        f: cell.rawValue.slice(1),
        v: (cell.computedValue !== undefined && cell.computedValue !== null)
          ? Number(cell.computedValue)
          : 0,
      };
    } else {
      const { type, value } = detectExportType(cell.rawValue);
      ws[addr] = { t: type, v: value };

      // Add formatted text if available
      if (cell.computedValue !== undefined && cell.computedValue !== null) {
        ws[addr].w = String(cell.computedValue);
      }
    }

    // Add styling
    if (options.includeFormatting && cell.style) {
      ws[addr].s = convertCellStyle(cell.style);
    }
  }

  return ws;
}

/**
 * Detects the appropriate SheetJS cell type for a raw value.
 */
function detectExportType(raw: string): { type: XLSX.ExcelDataType; value: unknown } {
  const trimmed = raw.trim();

  if (trimmed === '') return { type: 's', value: '' };
  if (trimmed.toUpperCase() === 'TRUE') return { type: 'b', value: true };
  if (trimmed.toUpperCase() === 'FALSE') return { type: 'b', value: false };

  const num = parseFloat(trimmed);
  if (!isNaN(num) && /^-?\d*\.?\d+$/.test(trimmed)) {
    return { type: 'n', value: num };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { type: 'd', value: new Date(trimmed) };
  }

  return { type: 's', value: raw };
}

/**
 * Converts SimpleSheet CellStyle to SheetJS cell style object.
 */
function convertCellStyle(style: NonNullable<Cell['style']>): object {
  const result: Record<string, unknown> = {};

  if (style.fontWeight || style.fontStyle || style.color || style.textDecoration) {
    result.font = {};
    if (style.fontWeight === 'bold') (result.font as Record<string, unknown>).bold = true;
    if (style.fontStyle === 'italic') (result.font as Record<string, unknown>).italic = true;
    if (style.color) (result.font as Record<string, unknown>).color = { rgb: style.color.replace('#', '') };
  }

  if (style.backgroundColor) {
    result.fill = {
      fgColor: { rgb: style.backgroundColor.replace('#', '') },
      patternType: 'solid',
    };
  }

  if (style.textAlign) {
    result.alignment = { horizontal: style.textAlign };
  }

  /* istanbul ignore next - numberFormat styling */
  if (style.numberFormat) {
    result.numFmt = style.numberFormat;
  }

  return result;
}

/**
 * Triggers a browser download of the workbook as an .xlsx file.
 */
export function downloadExcel(workbook: Workbook, filename?: string): void {
  const blob = exportExcel(workbook);
  const name = filename ?? workbook.title.replace(/[^a-zA-Z0-9-_]/g, '_');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
