// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Sheet Search & Replace Engine
 *
 * Searches and replaces text in cell raw values across one or more sheets.
 * Formulas are treated as opaque text; skip them unless `alsoInFormulas` is true.
 */

import type { Workbook, Sheet } from '../types';

// ════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════

export interface SearchResult {
  /** Total number of cells that contain the query. */
  matches: number;
}

export interface ReplaceResult {
  /** Updated sheet list (only sheets with changes are new objects). */
  updatedSheets: Sheet[];
  /** Total number of cells replaced across all sheets. */
  totalReplaced: number;
  /** Per-sheet counts. */
  sheetResults: Array<{ sheetName: string; replaced: number }>;
}

export interface SearchOptions {
  query: string;
  caseSensitive: boolean;
  matchEntire: boolean;
  alsoInFormulas?: boolean; // default false — skip formula cells
}

// ════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════

/**
 * Counts how many cells contain the search query.
 * @param workbook - Current workbook state.
 * @param activeSheetIndex - Index of the active sheet (used when shallow=true).
 * @param opts - Search options including case sensitivity and matching mode.
 * @param shallow - When true, stops after finding the first match.
 */
export function searchSheets(
  workbook: Workbook,
  activeSheetIndex: number,
  opts: SearchOptions,
  sheetIndices?: number[],
): SearchResult {
  const { query, caseSensitive, matchEntire, alsoInFormulas } = opts;
  if (!query) return { matches: 0 };

  const sheets = sheetIndices
    ? sheetIndices.map((i) => workbook.sheets[i])
    : [workbook.sheets[activeSheetIndex]];

  let totalCount = 0;

  for (const sheet of sheets) {
    for (const cell of Object.values(sheet.cells)) {
      const raw = cell.rawValue;
      if (raw.startsWith('=') && !alsoInFormulas) continue;
      if (matchRaw(raw, query, caseSensitive, matchEntire)) {
        totalCount++;
      }
    }
  }

  return { matches: totalCount };
}

/**
 * Replaces all occurrences of query with replacement across specified sheets.
 * Pushes a new workbook snapshot via onUpdate (caller manages history).
 * @param workbook - Current workbook state.
 * @param searchOpts - Same options as searchSheets plus the replacement text.
 * @param sheetIndices - Which sheet indices to modify (defaults to active sheet only).
 */
export function replaceInSheets(
  workbook: Workbook,
  searchOpts: SearchOptions & { replacement: string },
  sheetIndices?: number[],
): ReplaceResult {
  const { query, replacement, caseSensitive, matchEntire, alsoInFormulas } = searchOpts;
  const sheetsToSearch = sheetIndices ?? [workbook.activeSheetIndex];

  const updatedSheets = [...workbook.sheets];
  let totalReplaced = 0;
  const sheetResults: Array<{ sheetName: string; replaced: number }> = [];

  for (const idx of sheetsToSearch) {
    const sheet = updatedSheets[idx];
    let replacedCount = 0;
    const newCells = { ...sheet.cells };

    for (const [key, cell] of Object.entries(sheet.cells)) {
      const raw = cell.rawValue;
      if (!raw) continue;
      if (raw.startsWith('=') && !alsoInFormulas) continue; // Skip formulas unless requested

      if (matchRaw(raw, query, caseSensitive, matchEntire)) {
        newCells[key] = { ...cell, rawValue: doReplace(raw, query, replacement, caseSensitive) };
        replacedCount++;
      }
    }

    if (replacedCount > 0) {
      updatedSheets[idx] = { ...sheet, cells: newCells };
      totalReplaced += replacedCount;
      sheetResults.push({ sheetName: sheet.name, replaced: replacedCount });
    }
  }

  return { updatedSheets, totalReplaced, sheetResults };
}

// ════════════════════════════════════════════════════════════════
// Internal helpers
// ════════════════════════════════════════════════════════════════

/** Checks if a raw value matches the query. Formulas always use substring mode. */
function matchRaw(cellRaw: string, query: string, caseSensitive: boolean, matchEntire: boolean): boolean {
  if (cellRaw.startsWith('=')) {
    return matchSimpleString(cellRaw, query, caseSensitive, false);
  }
  return matchSimpleString(cellRaw, query, caseSensitive, matchEntire);
}

function matchSimpleString(text: string, query: string, caseSensitive: boolean, exact: boolean): boolean {
  if (exact) {
    if (caseSensitive) return text === query;
    return text.toLowerCase() === query.toLowerCase();
  }
  if (caseSensitive) return text.includes(query);
  return text.toLowerCase().includes(query.toLowerCase());
}

/** Performs find-and-replace on a text string. */
function doReplace(text: string, query: string, replacement: string, caseSensitive: boolean): string {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, caseSensitive ? 'g' : 'gi'), replacement);
}
