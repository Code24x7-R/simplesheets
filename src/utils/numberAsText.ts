// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import type { Cell } from '../types';

/**
 * Detects when a cell contains a numeric value stored as text.
 *
 * This occurs when:
 * - The rawValue starts with a leading apostrophe (our text marker), e.g. '123
 * - OR the rawValue is a non-empty numeric string (parses as a number) but the
 *   cell has an explicit text numberFormat.
 *
 * Numbers stored as text are ignored by math functions (treated as zero) and
 * can cause lookup failures. Excel shows a small green triangle indicator on
 * such cells.
 */
export function isNumberStoredAsText(cell: Cell | undefined): boolean {
  if (!cell) return false;
  const raw = cell.rawValue;
  if (!raw) return false;

  // Formulas are never "number stored as text"
  if (raw.startsWith('=')) return false;

  // Leading apostrophe marks explicit text entry
  if (raw.startsWith("'")) {
    return isNumericString(raw.slice(1));
  }

  // Explicit text format with a numeric-looking value
  const fmt = cell.style?.numberFormat;
  if (fmt && fmt === '@') {
    return isNumericString(raw);
  }

  return false;
}

/** Checks whether a string parses as a finite number. */
function isNumericString(s: string): boolean {
  if (s.trim() === '') return false;
  return !isNaN(Number(s));
}
