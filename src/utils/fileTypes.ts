// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Canonical file-extension and accept-list definitions.
 *
 * Single source of truth for every file picker and download in the app.
 * `.ssjson` is the native format; `.json` remains accepted on open/import for
 * backward compatibility with files exported by earlier versions.
 */

/** Native SimpleSheets document extension. */
export const NATIVE_EXT = '.ssjson';

/** Legacy extension accepted on open/import (never written). */
export const LEGACY_EXT = '.json';

/** Native MIME type (both `.ssjson` and `.json` are JSON on disk). */
export const NATIVE_MIME = 'application/json';

/** Known native/legacy extensions, used for name normalization. */
export const KNOWN_NATIVE_EXTS = [NATIVE_EXT, LEGACY_EXT] as const;

/** Accept list for the native document picker (`.ssjson` + legacy `.json`). */
export const ACCEPT_NATIVE = `${NATIVE_EXT},${LEGACY_EXT},${NATIVE_MIME}`;

/** Spreadsheet import formats handled by the Excel/CSV importers. */
export const SPREADSHEET_IMPORT_EXTS = ['.xlsx', '.xls', '.csv', '.tsv'] as const;

/** Accept list for the import picker (spreadsheets + native documents). */
export const ACCEPT_IMPORT = [...SPREADSHEET_IMPORT_EXTS, NATIVE_EXT, LEGACY_EXT].join(',');

/** Combined accept list (any file the app can open). */
export const ACCEPT_ALL = `${ACCEPT_IMPORT},${NATIVE_MIME}`;

/**
 * Strip a trailing native/legacy extension (case-insensitive) from a filename.
 * Returns the name unchanged when no known extension is present.
 *
 * @param name - The filename to inspect (e.g. "budget.ssjson", "budget.json").
 * @returns The filename without the extension.
 */
export function stripKnownExtension(name: string): string {
  const trimmed = name.trim();
  for (const ext of KNOWN_NATIVE_EXTS) {
    if (trimmed.length > ext.length && trimmed.toLowerCase().endsWith(ext)) {
      return trimmed.slice(0, -ext.length);
    }
  }
  return trimmed;
}

/**
 * Normalize a filename to a canonical name with the given extension.
 * Strips duplicate known extensions (`budget.ssjson.ssjson` → `budget`),
 * sanitizes invalid filename characters, trims trailing dots/spaces, and
 * falls back to "Untitled".
 *
 * @param name - Raw name (may be empty or include an existing extension).
 * @param ext - Target extension, defaults to {@link NATIVE_EXT}.
 * @returns Canonical filename including the extension.
 */
export function normalizeFileName(name: string, ext: string = NATIVE_EXT): string {
  let base = name.trim();

  // Strip any number of repeated known extensions
  // ("budget.ssjson.ssjson" → "budget").
  let previous = '';
  while (previous !== base) {
    previous = base;
    base = stripKnownExtension(base);
  }

  // Sanitize characters that are invalid in Windows/macOS/Linux filenames.
  base = base.replace(/[<>:"/\\|?*]/g, '_');
  // Trim trailing periods and spaces (invalid on Windows).
  base = base.replace(/[.\s]+$/, '');

  if (!base) base = 'Untitled';
  return `${base}${ext}`;
}
