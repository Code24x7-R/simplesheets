/**
 * Formula Validation for SimpleSheet
 *
 * Provides real-time validation of formula strings with detailed error messages
 * and position information for highlighting errors in the UI.
 */

import { parseFormula, FormulaError } from './formulaParser';

/** Represents a validation error with position information. */
export interface ValidationError {
  /** Human-readable error message. */
  message: string;
  /** Start position in the formula string (0-based, after the "="). */
  startPos: number;
  /** End position in the formula string. */
  endPos: number;
  /** Error severity. */
  severity: 'error' | 'warning';
}

/** Result of validating a formula. */
export interface ValidationResult {
  /** Whether the formula is valid. */
  isValid: boolean;
  /** List of errors (empty if valid). */
  errors: ValidationError[];
  /** Whether the formula is incomplete (e.g., unclosed paren, trailing operator). */
  isIncomplete: boolean;
}

/**
 * Checks for structural issues that the parser may not catch (unbalanced parens, etc).
 */
function checkStructuralIssues(formula: string): ValidationError[] {
  const errors: ValidationError[] = [];
  let depth = 0;
  let lastOpenParen = -1;

  for (let i = 0; i < formula.length; i++) {
    const ch = formula[i];
    if (ch === '(') {
      depth++;
      lastOpenParen = i;
    } else if (ch === ')') {
      depth--;
      if (depth < 0) {
        errors.push({
          message: 'Unexpected closing parenthesis',
          startPos: i,
          endPos: i + 1,
          severity: 'error',
        });
        depth = 0;
      }
    }
  }

  if (depth > 0) {
    errors.push({
      message: `${depth} unclosed parenthesis${depth > 1 ? 'es' : ''}`,
      startPos: lastOpenParen,
      endPos: lastOpenParen + 1,
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Checks if the formula ends with an operator (incomplete expression).
 */
function isIncompleteFormula(formula: string): boolean {
  if (!formula || formula.length === 0) return false;

  const trimmed = formula.trimEnd();
  const lastChar = trimmed[trimmed.length - 1];

  // Ends with binary operator
  if (['+', '-', '*', '/', '&', '=', '<', '>'].includes(lastChar)) return true;

  // Ends with a function name and open paren but no close (caught by structural check)
  // Ends with a comma (incomplete argument list)
  if (lastChar === ',') return true;

  // Ends with a colon (incomplete range)
  if (lastChar === ':') return true;

  return false;
}

/**
 * Validates a formula string (including the leading "=").
 * Returns detailed error information for display in the UI.
 *
 * @param formula - The full formula string (e.g., "=SUM(A1:A10)").
 * @returns Validation result with errors and completeness status.
 */
export function validateFormula(formula: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Empty or non-formula is valid
  if (!formula || !formula.startsWith('=')) {
    return { isValid: true, errors: [], isIncomplete: false };
  }

  const body = formula.slice(1); // Remove leading "="

  if (body.length === 0) {
    return { isValid: false, errors: [{ message: 'Empty formula', startPos: 0, endPos: 0, severity: 'error' }], isIncomplete: true };
  }

  // Check structural issues first
  const structuralErrors = checkStructuralIssues(body);
  errors.push(...structuralErrors);

  // Check if formula appears incomplete before parsing
  const appearsIncomplete = isIncompleteFormula(body);

  // Try to parse
  try {
    parseFormula(body);
  } catch (err) {
    const isEOFError = err instanceof FormulaError && err.message.includes('EOF');

    if (appearsIncomplete && isEOFError) {
      // Trailing operator/comma/colon with EOF = incomplete, not an error
      // Don't add to errors — just mark as incomplete
    } else if (err instanceof FormulaError) {
      errors.push({
        message: err.message,
        startPos: err.pos ?? 0,
        endPos: (err.pos ?? 0) + 1,
        severity: 'error',
      });
    } else /* istanbul ignore next - unexpected error fallback */ if (err instanceof Error) {
      errors.push({
        message: err.message,
        startPos: 0,
        endPos: body.length,
        severity: 'error',
      });
    }
  }

  const isIncomplete = appearsIncomplete || (errors.length === 0 && structuralErrors.length > 0);

  return {
    isValid: errors.filter((e) => e.severity === 'error').length === 0,
    errors,
    isIncomplete,
  };
}

/**
 * Extracts the token at a given position in the formula.
 * Useful for context-aware auto-complete.
 *
 * @param formula - The formula body (without "=").
 * @param pos - Cursor position (0-based).
 * @returns The token string at the position, or null.
 */
export function getTokenAtPosition(formula: string, pos: number): string | null {
  // Walk backwards to find the start of the token
  let start = pos;
  while (start > 0 && /[A-Za-z0-9_$]/.test(formula[start - 1])) {
    start--;
  }

  // Walk forwards to find the end of the token
  let end = pos;
  while (end < formula.length && /[A-Za-z0-9_$]/.test(formula[end])) {
    end++;
  }

  if (start === end) return null;

  return formula.slice(start, end);
}

/**
 * Checks if the cursor is inside a function call (after the function name and open paren).
 *
 * @param formula - The formula body (without "=").
 * @param pos - Cursor position (0-based).
 * @returns The function name if inside a call, null otherwise.
 */
export function getEnclosingFunction(formula: string, pos: number): string | null {
  // Walk backwards from cursor to find an open paren that's preceded by a function name
  let depth = 0;
  let i = pos - 1;

  while (i >= 0) {
    const ch = formula[i];
    if (ch === ')') depth++;
    else if (ch === '(') {
      if (depth === 0) {
        // Check if preceded by a function name
        const nameEnd = i - 1;
        let nameStart = nameEnd;
        while (nameStart >= 0 && /[A-Za-z]/.test(formula[nameStart])) {
          nameStart--;
        }
        nameStart++;

        if (nameEnd >= nameStart) {
          return formula.slice(nameStart, nameEnd + 1).toUpperCase();
        }
        /* istanbul ignore next - no valid function name found */
        return null;
      }
      depth--;
    }
    i--;
  }

  return null;
}
