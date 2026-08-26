// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Named Range utilities for SimpleSheet.
 *
 * Provides validation, parsing, and resolution of named ranges.
 * Names follow Excel conventions: start with letter/underscore, contain only
 * letters/digits/underscore/dot, cannot look like a cell reference.
 */

import type { NamedRange, Workbook } from '../types';
import { parseFormula, type ASTNode } from './formulaParser';

// ─── Name Validation ─────────────────────────────────────────────────────────

/** Maximum length of a named range (Excel limit). */
const MAX_NAME_LENGTH = 255;

/**
 * Validates a named range name against Excel naming rules.
 * @param name - The name to validate (trimmed, case-insensitive).
 * @returns An error message string if invalid, or null if valid.
 */
export function validateName(name: string): string | null {
  const trimmed = name.trim();

  if (!trimmed) {
    return 'Name cannot be empty.';
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  // Must start with a letter, underscore, or backslash.
  if (!/^[A-Za-z_\\]/.test(trimmed)) {
    return 'Name must start with a letter, underscore, or backslash.';
  }

  // Can only contain letters, digits, underscores, dots.
  if (!/^[A-Za-z0-9_.\\]+$/.test(trimmed)) {
    return 'Name can only contain letters, digits, underscores, and dots.';
  }

  // Cannot look like a cell reference (e.g., A1, $B$2, AA100).
  if (/^(\$?[A-Za-z]{1,3}\$?\d{1,7})$/.test(trimmed)) {
    return 'Name cannot be a cell reference (e.g., A1, B2).';
  }

  // Cannot be the reserved words TRUE/FALSE (used as boolean literals).
  if (/^(TRUE|FALSE)$/i.test(trimmed)) {
    return 'Name cannot be TRUE or FALSE.';
  }

  return null;
}

/**
 * Checks whether a name is already used in the given list (case-insensitive).
 * Optionally exclude a specific ID (when editing, the existing entry is allowed).
 */
export function isNameDuplicate(name: string, ranges: NamedRange[], excludeId?: string): boolean {
  const upper = name.trim().toUpperCase();
  return ranges.some((r) => r.id !== excludeId && r.name.trim().toUpperCase() === upper);
}

// ─── Reference Parsing ───────────────────────────────────────────────────────

export interface ParsedReference {
  /** Sheet name qualifier, if present (e.g., "Sheet1" for Sheet1!A1:B10). */
  sheetName?: string;
  /** Starting row index (0-based). */
  startRow: number;
  /** Starting column index (0-based). */
  startCol: number;
  /** Ending row index (0-based). */
  endRow: number;
  /** Ending column index (0-based). */
  endCol: number;
  /** Whether the column is absolute ($A). */
  absoluteCol: boolean;
  /** Whether the row is absolute ($1). */
  absoluteRow: boolean;
}

/**
 * Parses an A1-style reference string into structured bounds.
 * Reuses the formula parser for robustness (handles sheet names, absolute markers, etc.).
 * @param reference - A1-style reference (e.g., "Sheet1!$A$1:$D$10", "B5").
 * @returns ParsedReference or null if the reference is invalid.
 */
export function parseNamedRangeRef(reference: string): ParsedReference | null {
  const trimmed = reference.trim();
  if (!trimmed) return null;

  try {
    // Wrap in "=" so the formula parser treats it as a cell/range expression.
    const ast = parseFormula(trimmed);

    if (ast.type === 'cell') {
      return {
        sheetName: ast.sheetName,
        startRow: ast.row,
        startCol: ast.col,
        endRow: ast.row,
        endCol: ast.col,
        absoluteCol: ast.absoluteCol,
        absoluteRow: ast.absoluteRow,
      };
    }

    if (ast.type === 'range') {
      return {
        sheetName: ast.sheetName,
        startRow: Math.min(ast.start.row, ast.end.row),
        startCol: Math.min(ast.start.col, ast.end.col),
        endRow: Math.max(ast.start.row, ast.end.row),
        endCol: Math.max(ast.start.col, ast.end.col),
        absoluteCol: ast.start.absoluteCol,
        absoluteRow: ast.start.absoluteRow,
      };
    }

    // Any other AST type is not a valid range reference.
    return null;
  } catch {
    return null;
  }
}

/**
 * Validates a reference string.
 * @returns An error message string if invalid, or null if valid.
 */
export function validateReference(reference: string): string | null {
  const trimmed = reference.trim();
  if (!trimmed) {
    return 'Reference cannot be empty.';
  }
  const parsed = parseNamedRangeRef(trimmed);
  if (!parsed) {
    return 'Invalid reference. Use A1-style notation (e.g., Sheet1!$A$1:$D$10).';
  }
  return null;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

let idCounter = 0;

/**
 * Creates a new NamedRange with a generated ID.
 */
export function createNamedRange(
  name: string,
  reference: string,
  scope: 'workbook' | 'sheet' = 'workbook',
  opts?: { sheetId?: string; comment?: string },
): NamedRange {
  idCounter += 1;
  return {
    id: `nr-${Date.now()}-${idCounter}`,
    name: name.trim(),
    reference: reference.trim(),
    scope,
    sheetId: opts?.sheetId,
    comment: opts?.comment,
  };
}

// ─── Lookup Map ──────────────────────────────────────────────────────────────

/**
 * Builds a case-insensitive lookup map from name → NamedRange.
 * Sheet-scoped names are prefixed with "SheetName!" to avoid collisions
 * with workbook-scoped names of the same name (matching Excel behavior).
 */
export function buildNamedRangeMap(ranges: NamedRange[]): Map<string, NamedRange> {
  const map = new Map<string, NamedRange>();
  for (const nr of ranges) {
    // Workbook-scoped: keyed by uppercase name.
    // Sheet-scoped: keyed by "SHEETNAME!UPPERNAME".
    const key = nr.scope === 'sheet' && nr.sheetId
      ? `SHEET:${nr.sheetId}:${nr.name.trim().toUpperCase()}`
      : nr.name.trim().toUpperCase();
    map.set(key, nr);
  }
  return map;
}

/**
 * Resolves a name to its AST node for evaluation.
 * Returns null if the name is not found.
 */
export function resolveNameToAST(
  name: string,
  map: Map<string, NamedRange>,
  activeSheetId?: string,
): ASTNode | null {
  const upper = name.trim().toUpperCase();

  // 1. Try sheet-scoped name for the active sheet (higher priority in Excel).
  if (activeSheetId) {
    const sheetKey = `SHEET:${activeSheetId}:${upper}`;
    const sheetRange = map.get(sheetKey);
    if (sheetRange) {
      return parseNamedRangeRefToAST(sheetRange.reference);
    }
  }

  // 2. Try workbook-scoped name.
  const wbRange = map.get(upper);
  if (wbRange) {
    return parseNamedRangeRefToAST(wbRange.reference);
  }

  return null;
}

/**
 * Parses a reference string into an AST node (cell or range).
 */
function parseNamedRangeRefToAST(reference: string): ASTNode | null {
  const trimmed = reference.trim();
  if (!trimmed) return null;
  try {
    const ast = parseFormula(trimmed);
    if (ast.type === 'cell' || ast.type === 'range') {
      return ast;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Active Cell Lookup ──────────────────────────────────────────────────────

/**
 * Finds the named range that contains the given cell (for the Name Box display).
 * Returns the most specific (smallest area) match if multiple contain the cell.
 */
export function findNamedRangeForCell(
  ranges: NamedRange[],
  sheetId: string,
  row: number,
  col: number,
): NamedRange | null {
  let best: NamedRange | null = null;
  let bestArea = Infinity;

  for (const nr of ranges) {
    // Skip sheet-scoped names from other sheets.
    if (nr.scope === 'sheet' && nr.sheetId !== sheetId) continue;

    const parsed = parseNamedRangeRef(nr.reference);
    if (!parsed) continue;
    // Skip references on other sheets.
    if (parsed.sheetName) {
      // We'd need the sheet name for this sheet to compare; skip if ambiguous.
      // For now, only match if the reference has no sheet qualifier (same sheet).
      continue;
    }

    if (
      row >= parsed.startRow &&
      row <= parsed.endRow &&
      col >= parsed.startCol &&
      col <= parsed.endCol
    ) {
      const area = (parsed.endRow - parsed.startRow + 1) * (parsed.endCol - parsed.startCol + 1);
      if (area < bestArea) {
        best = nr;
        bestArea = area;
      }
    }
  }

  return best;
}

/**
 * Returns all named ranges for use in the Name Box dropdown.
 */
export function getNamedRangesForDropdown(workbook: Workbook): NamedRange[] {
  return workbook.namedRanges ?? [];
}
