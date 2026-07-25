import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'simplesheets-reference-format';

export type ReferenceFormat = 'A1' | 'R1C1';

/**
 * Hook to manage the reference format preference (A1 vs R1C1).
 * Persists the preference to localStorage.
 */
export function useReferenceFormat() {
  const [format, setFormat] = useState<ReferenceFormat>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'R1C1' || stored === 'A1') return stored;
    } catch {
      // ignore
    }
    return 'A1';
  });

  const toggle = useCallback(() => {
    setFormat((prev) => {
      const next = prev === 'A1' ? 'R1C1' : 'A1';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, format);
    } catch {
      // ignore
    }
  }, [format]);

  return { format, toggle, setFormat };
}

/**
 * Convert a row/col pair to R1C1 notation.
 * @param row 0-based row index
 * @param col 0-based column index
 * @returns R1C1 string like "R1C1", "R3C27"
 */
export function toR1C1(row: number, col: number): string {
  return `R${row + 1}C${col + 1}`;
}

/**
 * Format a cell reference according to the given format.
 */
export function formatCellRef(row: number, col: number, format: ReferenceFormat): string {
  if (format === 'R1C1') return toR1C1(row, col);
  // A1 format: need colToLetter
  return `${colToLetterA1(col)}${row + 1}`;
}

/**
 * Convert column index to letter(s) for A1 format.
 */
function colToLetterA1(col: number): string {
  let result = '';
  let n = col;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}
