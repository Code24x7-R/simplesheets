// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Import scope reducers.
 *
 * Pure functions that apply an imported workbook to the current workbook
 * according to the user's chosen scope: replace, add as new sheets, or insert
 * at the active cell. Kept pure and side-effect free for easy unit testing.
 */

import type { Workbook, Sheet, Cell } from '../types';
import { cellKey } from '../types';

/** Where imported data should land. */
export type ImportScope = 'replace' | 'new-sheets' | 'insert';

/** The source format of an import. */
export type ImportKind = 'excel' | 'csv' | 'json';

/** Payload passed from an import entry point to the scope dialog. */
export interface IncomingImport {
  workbook: Workbook;
  fileName?: string;
  kind: ImportKind;
  /** Raw text for CSV/TSV re-parsing after the dialog changes options. */
  rawText?: string;
  /** Detected delimiter for CSV/TSV (may be overridden in the dialog). */
  detectedDelimiter?: string;
}

/** Options confirmed by the import scope dialog. */
export interface ImportScopeOptions {
  scope: ImportScope;
  hasHeader: boolean;
  delimiter: string;
}

/**
 * Replace the current workbook with the imported one, optionally renaming it.
 */
export function applyReplace(importedWb: Workbook, title?: string): Workbook {
  if (!title || title === importedWb.title) return importedWb;
  return { ...importedWb, title, lastModified: Date.now() };
}

/**
 * Pick a unique sheet name (e.g. "Imported", "Imported (2)", …).
 */
function uniqueSheetName(existing: string[], base: string): string {
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base} (${n})`)) n += 1;
  return `${base} (${n})`;
}

/**
 * Append the imported workbook's sheets to the current workbook as new sheets.
 */
export function applyAddSheets(current: Workbook, importedWb: Workbook): Workbook {
  const existingNames = current.sheets.map((s) => s.name);
  const appended: Sheet[] = importedWb.sheets.map((sheet, index) => {
    const name = uniqueSheetName(existingNames, sheet.name);
    existingNames.push(name);
    return { ...sheet, id: `import-${Date.now()}-${index}`, name };
  });

  return {
    ...current,
    sheets: [...current.sheets, ...appended],
    activeSheetIndex: current.sheets.length,
    lastModified: Date.now(),
  };
}

/**
 * Insert the imported workbook's active sheet cells into the current active
 * sheet, offset from the given cell.
 */
export function applyInsertAtCell(
  current: Workbook,
  importedWb: Workbook,
  row: number,
  col: number,
): Workbook {
  const source = importedWb.sheets[importedWb.activeSheetIndex] ?? importedWb.sheets[0];
  const targetIndex = current.activeSheetIndex ?? 0;
  const target = current.sheets[targetIndex] ?? current.sheets[0];

  const cells: Record<string, Cell> = { ...target.cells };
  let maxRow = 0;
  let maxCol = 0;

  for (const [key, cell] of Object.entries(source.cells)) {
    const [r, c] = key.split(':').map(Number);
    const targetKey = cellKey(row + r, col + c);
    cells[targetKey] = cell;
    maxRow = Math.max(maxRow, row + r);
    maxCol = Math.max(maxCol, col + c);
  }

  const sheets = current.sheets.map((sheet, index) =>
    index === targetIndex
      ? {
          ...sheet,
          cells,
          rowCount: Math.max(sheet.rowCount, maxRow + 1),
          columnCount: Math.max(sheet.columnCount, maxCol + 1),
        }
      : sheet,
  );

  return { ...current, sheets, lastModified: Date.now() };
}
