// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Shared open-intent types and path rules.
 *
 * Used by the Electron main process, the renderer adapter, and Jest tests.
 * Keep this module free of Electron and Node imports.
 */

export type OpenRequestSource =
  | 'argv'
  | 'open-with'
  | 'second-instance'
  | 'picker'
  | 'recent'
  | 'drag-drop';

/**
 * A single file-open intent delivered from main to the renderer.
 * `data` is the whole file; the IPC ceiling is enforced in main.
 */
export interface OpenRequest {
  readonly seq: number;
  readonly source: OpenRequestSource;
  readonly path: string;
  readonly name: string;
  readonly size: number;
  readonly mtimeMs: number;
  readonly data: ArrayBuffer;
}

/** Maximum size for a single open request (100 MB). */
export const MAX_OPEN_BYTES = 100 * 1024 * 1024;

/** Every extension the app can open. */
export const SUPPORTED_OPEN_EXTENSIONS = [
  '.ssjson',
  '.json',
  '.xlsx',
  '.xls',
  '.csv',
  '.tsv',
  '.txt',
] as const;

/** Extensions that are saved in place as a workbook document. */
export const WORKBOOK_SAVE_EXTENSIONS = ['.ssjson', '.json'] as const;

/** Extensions that route through the Import Scope dialog. */
export const SPREADSHEET_OPEN_EXTENSIONS = [
  '.xlsx',
  '.xls',
  '.csv',
  '.tsv',
  '.txt',
] as const;

function endsWithAny(filePath: string, extensions: readonly string[]): boolean {
  const lower = filePath.toLowerCase();
  return extensions.some((extension) => lower.endsWith(extension));
}

/**
 * Return true when a path has an extension the app can open.
 *
 * @param filePath - File name or absolute path.
 * @returns True for a supported extension.
 */
export function isSupportedOpenPath(filePath: string): boolean {
  return endsWithAny(filePath, SUPPORTED_OPEN_EXTENSIONS);
}

/**
 * Return true when a path can be saved in place as a workbook document.
 *
 * @param filePath - File name or absolute path.
 * @returns True for `.ssjson` and `.json`.
 */
export function isWorkbookSavePath(filePath: string): boolean {
  return endsWithAny(filePath, WORKBOOK_SAVE_EXTENSIONS);
}

/**
 * Return true when opening the file should show the Import Scope dialog
 * instead of replacing the workbook directly.
 *
 * @param filePath - File name or absolute path.
 * @returns True for Excel, CSV, TSV, and TXT files.
 */
export function isSpreadsheetImportPath(filePath: string): boolean {
  return endsWithAny(filePath, SPREADSHEET_OPEN_EXTENSIONS);
}
