// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  validateName,
  isNameDuplicate,
  parseNamedRangeRef,
  validateReference,
  createNamedRange,
  buildNamedRangeMap,
  resolveNameToAST,
  findNamedRangeForCell,
} from './namedRangeUtils';
import type { NamedRange } from '../types';

// ─── validateName ────────────────────────────────────────────────────────────

describe('validateName', () => {
  it('accepts a valid name starting with a letter', () => {
    expect(validateName('SalesData')).toBeNull();
  });

  it('accepts names with underscores', () => {
    expect(validateName('Sales_Data')).toBeNull();
  });

  it('accepts names with dots', () => {
    expect(validateName('Sales.Data')).toBeNull();
  });

  it('accepts names starting with underscore', () => {
    expect(validateName('_internal')).toBeNull();
  });

  it('accepts names with digits (not at start)', () => {
    expect(validateName('Data2026')).toBeNull();
  });

  it('rejects empty name', () => {
    expect(validateName('')).toBe('Name cannot be empty.');
  });

  it('rejects whitespace-only name', () => {
    expect(validateName('   ')).toBe('Name cannot be empty.');
  });

  it('rejects name starting with a digit', () => {
    expect(validateName('1stQuarter')).toBe('Name must start with a letter, underscore, or backslash.');
  });

  it('rejects name with spaces', () => {
    expect(validateName('Sales Data')).toBe('Name can only contain letters, digits, underscores, and dots.');
  });

  it('rejects name with special characters', () => {
    expect(validateName('Sales@Data')).toBe('Name can only contain letters, digits, underscores, and dots.');
  });

  it('rejects cell-reference-like names', () => {
    expect(validateName('A1')).toBe('Name cannot be a cell reference (e.g., A1, B2).');
    expect(validateName('B2')).toBe('Name cannot be a cell reference (e.g., A1, B2).');
    expect(validateName('AA100')).toBe('Name cannot be a cell reference (e.g., A1, B2).');
  });

  it('rejects reserved words TRUE/FALSE', () => {
    expect(validateName('TRUE')).toBe('Name cannot be TRUE or FALSE.');
    expect(validateName('false')).toBe('Name cannot be TRUE or FALSE.');
  });

  it('rejects names exceeding max length', () => {
    const longName = 'A'.repeat(256);
    expect(validateName(longName)).toBe('Name must be 255 characters or fewer.');
  });
});

// ─── isNameDuplicate ─────────────────────────────────────────────────────────

describe('isNameDuplicate', () => {
  const ranges: NamedRange[] = [
    { id: '1', name: 'SalesData', reference: 'A1:B10', scope: 'workbook' },
    { id: '2', name: 'Tax_Rate', reference: 'B5', scope: 'workbook' },
  ];

  it('detects duplicate (case-insensitive)', () => {
    expect(isNameDuplicate('salesdata', ranges)).toBe(true);
    expect(isNameDuplicate('SALESDATA', ranges)).toBe(true);
    expect(isNameDuplicate('SalesData', ranges)).toBe(true);
  });

  it('returns false for unique name', () => {
    expect(isNameDuplicate('NewName', ranges)).toBe(false);
  });

  it('excludes a specific ID (for edit scenario)', () => {
    expect(isNameDuplicate('SalesData', ranges, '1')).toBe(false);
  });
});

// ─── parseNamedRangeRef ──────────────────────────────────────────────────────

describe('parseNamedRangeRef', () => {
  it('parses a single cell reference', () => {
    const result = parseNamedRangeRef('B5');
    expect(result).toEqual({
      startRow: 4,
      startCol: 1,
      endRow: 4,
      endCol: 1,
      absoluteCol: false,
      absoluteRow: false,
    });
  });

  it('parses a range reference', () => {
    const result = parseNamedRangeRef('A1:C10');
    expect(result).toMatchObject({
      startRow: 0,
      startCol: 0,
      endRow: 9,
      endCol: 2,
    });
  });

  it('parses a reference with sheet name', () => {
    const result = parseNamedRangeRef('Sheet1!A1:B5');
    expect(result?.sheetName).toBe('Sheet1');
    expect(result?.startRow).toBe(0);
    expect(result?.endRow).toBe(4);
  });

  it('parses absolute references', () => {
    const result = parseNamedRangeRef('$A$1:$C$10');
    expect(result?.absoluteCol).toBe(true);
    expect(result?.absoluteRow).toBe(true);
  });

  it('normalizes reversed ranges (C10:A1)', () => {
    const result = parseNamedRangeRef('C10:A1');
    expect(result?.startRow).toBe(0);
    expect(result?.startCol).toBe(0);
    expect(result?.endRow).toBe(9);
    expect(result?.endCol).toBe(2);
  });

  it('returns null for invalid reference', () => {
    expect(parseNamedRangeRef('not a ref')).toBeNull();
    expect(parseNamedRangeRef('')).toBeNull();
  });
});

// ─── validateReference ───────────────────────────────────────────────────────

describe('validateReference', () => {
  it('accepts valid reference', () => {
    expect(validateReference('A1:B10')).toBeNull();
  });

  it('rejects empty reference', () => {
    expect(validateReference('')).toBe('Reference cannot be empty.');
  });

  it('rejects invalid reference', () => {
    expect(validateReference('hello world')).toBe(
      'Invalid reference. Use A1-style notation (e.g., Sheet1!$A$1:$D$10).',
    );
  });
});

// ─── createNamedRange ────────────────────────────────────────────────────────

describe('createNamedRange', () => {
  it('creates a named range with defaults', () => {
    const nr = createNamedRange('SalesData', 'A1:B10');
    expect(nr.name).toBe('SalesData');
    expect(nr.reference).toBe('A1:B10');
    expect(nr.scope).toBe('workbook');
    expect(nr.id).toMatch(/^nr-/);
  });

  it('creates a sheet-scoped named range', () => {
    const nr = createNamedRange('Local', 'A1', 'sheet', { sheetId: 'sheet-1' });
    expect(nr.scope).toBe('sheet');
    expect(nr.sheetId).toBe('sheet-1');
  });

  it('trims name and reference', () => {
    const nr = createNamedRange('  Sales  ', '  A1  ');
    expect(nr.name).toBe('Sales');
    expect(nr.reference).toBe('A1');
  });
});

// ─── buildNamedRangeMap ──────────────────────────────────────────────────────

describe('buildNamedRangeMap', () => {
  const ranges: NamedRange[] = [
    { id: '1', name: 'SalesData', reference: 'A1:B10', scope: 'workbook' },
    { id: '2', name: 'Local', reference: 'A1', scope: 'sheet', sheetId: 'sheet-1' },
  ];

  it('builds case-insensitive map for workbook-scoped names', () => {
    const map = buildNamedRangeMap(ranges);
    // Keys are stored uppercase; lookups must normalize (done by resolveNameToAST).
    expect(map.has('SALESDATA')).toBe(true);
    expect(map.get('SALESDATA')?.reference).toBe('A1:B10');
  });

  it('prefixes sheet-scoped names with sheet ID', () => {
    const map = buildNamedRangeMap(ranges);
    expect(map.has('SHEET:sheet-1:LOCAL')).toBe(true);
    expect(map.has('LOCAL')).toBe(false); // not at workbook level
  });
});

// ─── resolveNameToAST ────────────────────────────────────────────────────────

describe('resolveNameToAST', () => {
  const ranges: NamedRange[] = [
    { id: '1', name: 'SalesData', reference: 'A1:C10', scope: 'workbook' },
    { id: '2', name: 'Tax_Rate', reference: '$B$5', scope: 'workbook' },
    { id: '3', name: 'Local', reference: 'D1:D5', scope: 'sheet', sheetId: 'sheet-1' },
  ];
  const map = buildNamedRangeMap(ranges);

  it('resolves a workbook-scoped name to a range AST', () => {
    const ast = resolveNameToAST('SalesData', map);
    expect(ast?.type).toBe('range');
  });

  it('resolves a workbook-scoped name to a cell AST', () => {
    const ast = resolveNameToAST('Tax_Rate', map);
    expect(ast?.type).toBe('cell');
  });

  it('is case-insensitive', () => {
    const ast = resolveNameToAST('salesdata', map);
    expect(ast?.type).toBe('range');
  });

  it('resolves sheet-scoped name when active sheet matches', () => {
    const ast = resolveNameToAST('Local', map, 'sheet-1');
    expect(ast?.type).toBe('range');
  });

  it('does NOT resolve sheet-scoped name for a different sheet', () => {
    const ast = resolveNameToAST('Local', map, 'sheet-2');
    expect(ast).toBeNull();
  });

  it('returns null for unknown name', () => {
    const ast = resolveNameToAST('Unknown', map);
    expect(ast).toBeNull();
  });

  it('gives sheet-scoped names priority over workbook-scoped', () => {
    // If both exist, sheet-scoped wins for the matching sheet.
    const rangesWithBoth: NamedRange[] = [
      { id: '1', name: 'Data', reference: 'A1:A10', scope: 'workbook' },
      { id: '2', name: 'Data', reference: 'B1:B5', scope: 'sheet', sheetId: 'sheet-1' },
    ];
    const dualMap = buildNamedRangeMap(rangesWithBoth);
    const ast = resolveNameToAST('Data', dualMap, 'sheet-1');
    expect(ast?.type).toBe('range');
    // Sheet-scoped reference is B1:B5 (col 1), workbook is A1:A10 (col 0)
    if (ast?.type === 'range') {
      expect(ast.start.col).toBe(1);
    }
  });
});

// ─── findNamedRangeForCell ───────────────────────────────────────────────────

describe('findNamedRangeForCell', () => {
  const ranges: NamedRange[] = [
    { id: '1', name: 'BigRange', reference: 'A1:D10', scope: 'workbook' },
    { id: '2', name: 'SmallRange', reference: 'B2:C3', scope: 'workbook' },
    { id: '3', name: 'OtherSheet', reference: 'A1:B2', scope: 'sheet', sheetId: 'sheet-2' },
  ];

  it('finds the named range containing the cell', () => {
    const result = findNamedRangeForCell(ranges, 'sheet-1', 0, 0); // A1 — only in BigRange
    expect(result?.name).toBe('BigRange');
  });

  it('returns the most specific (smallest) match when multiple contain the cell', () => {
    const result = findNamedRangeForCell(ranges, 'sheet-1', 2, 2); // C3 — in both BigRange and SmallRange
    expect(result?.name).toBe('SmallRange');
  });

  it('returns null when no range contains the cell', () => {
    const result = findNamedRangeForCell(ranges, 'sheet-1', 20, 20);
    expect(result).toBeNull();
  });

  it('excludes sheet-scoped names from other sheets', () => {
    const result = findNamedRangeForCell(ranges, 'sheet-1', 0, 0); // A1 — OtherSheet is scoped to sheet-2
    // A1 is in BigRange (workbook-scoped) but OtherSheet reference has no sheet qualifier
    // so it's treated as same-sheet. But OtherSheet is scoped to sheet-2, so excluded.
    expect(result?.name).toBe('BigRange');
  });
});
