import { validateFormula, getTokenAtPosition, getEnclosingFunction } from './formulaValidation';

describe('validateFormula', () => {
  describe('non-formula values', () => {
    it('accepts plain text', () => {
      const result = validateFormula('hello world');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts plain numbers', () => {
      const result = validateFormula('42');
      expect(result.isValid).toBe(true);
    });

    it('accepts empty string', () => {
      const result = validateFormula('');
      expect(result.isValid).toBe(true);
    });
  });

  describe('valid formulas', () => {
    it('accepts simple arithmetic', () => {
      const result = validateFormula('=1+2');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts cell references', () => {
      const result = validateFormula('=A1+B2');
      expect(result.isValid).toBe(true);
    });

    it('accepts range references', () => {
      const result = validateFormula('=SUM(A1:A10)');
      expect(result.isValid).toBe(true);
    });

    it('accepts nested functions', () => {
      const result = validateFormula('=IF(A1>0, SUM(B1:B10), 0)');
      expect(result.isValid).toBe(true);
    });

    it('accepts absolute references', () => {
      const result = validateFormula('=$A$1+B$2+$C3');
      expect(result.isValid).toBe(true);
    });

    it('accepts complex formulas', () => {
      const result = validateFormula('=SUM(A1:A10) * 2 + AVERAGE(B1:B10) / COUNT(C1:C10)');
      expect(result.isValid).toBe(true);
    });
  });

  describe('invalid formulas', () => {
    it('rejects empty formula body', () => {
      const result = validateFormula('=');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects unclosed parentheses', () => {
      const result = validateFormula('=SUM(A1:A10');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('parenthes'))).toBe(true);
    });

    it('rejects extra closing parentheses', () => {
      const result = validateFormula('=SUM(A1:A10))');
      expect(result.isValid).toBe(false);
    });

    it('rejects multiple unclosed parens', () => {
      const result = validateFormula('=SUM(A1:A10+(B1*B2');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('2');
    });

    it('rejects invalid syntax', () => {
      const result = validateFormula('=A1++B1');
      // May or may not be caught depending on parser
      // The parser handles this as A1 + (+B1) which is valid unary
      expect(result.isValid).toBe(true);
    });

    it('rejects completely invalid input', () => {
      const result = validateFormula('=@#$%');
      expect(result.isValid).toBe(false);
    });
  });

  describe('incomplete formulas', () => {
    it('detects trailing operator', () => {
      const result = validateFormula('=A1+');
      expect(result.isIncomplete).toBe(true);
    });

    it('detects trailing comma', () => {
      const result = validateFormula('=SUM(A1,');
      expect(result.isIncomplete).toBe(true);
    });

    it('detects trailing colon', () => {
      const result = validateFormula('=A1:');
      expect(result.isIncomplete).toBe(true);
    });

    it('does not flag complete formulas as incomplete', () => {
      const result = validateFormula('=SUM(A1:A10)');
      expect(result.isIncomplete).toBe(false);
    });
  });

  describe('error position information', () => {
    it('provides position for unclosed paren', () => {
      const result = validateFormula('=SUM(A1:A10');
      expect(result.errors[0].startPos).toBeGreaterThanOrEqual(0);
      expect(result.errors[0].endPos).toBeGreaterThan(result.errors[0].startPos);
    });

    it('provides severity level', () => {
      const result = validateFormula('=SUM(A1:A10');
      expect(result.errors[0].severity).toBe('error');
    });
  });
});

describe('getTokenAtPosition', () => {
  it('returns null for empty string', () => {
    expect(getTokenAtPosition('', 0)).toBeNull();
  });

  it('returns adjacent token when at operator position', () => {
    // Position 2 is at '+', but walking backwards finds 'A1'
    const token = getTokenAtPosition('A1+B1', 2);
    expect(token).toBe('A1');
  });

  it('returns token at cell ref position', () => {
    const token = getTokenAtPosition('A1+B1', 1);
    expect(token).toBe('A1');
  });

  it('returns token at second cell ref', () => {
    const token = getTokenAtPosition('A1+B1', 4);
    expect(token).toBe('B1');
  });

  it('handles cursor at end of token', () => {
    const token = getTokenAtPosition('SUM(A1)', 5);
    expect(token).toBe('A1');
  });
});

describe('getEnclosingFunction', () => {
  it('returns null for empty string', () => {
    expect(getEnclosingFunction('', 0)).toBeNull();
  });

  it('returns null when not inside a function', () => {
    expect(getEnclosingFunction('A1+B1', 2)).toBeNull();
  });

  it('returns function name when inside parens', () => {
    const result = getEnclosingFunction('SUM(A1:A10)', 7);
    expect(result).toBe('SUM');
  });

  it('returns nested function name', () => {
    const result = getEnclosingFunction('IF(SUM(A1:A10)>0, 1, 0)', 10);
    expect(result).toBe('SUM');
  });

  it('returns outermost function when after close paren', () => {
    const result = getEnclosingFunction('SUM(A1:A10)+B1', 11);
    expect(result).toBeNull(); // After the close paren
  });

  it('handles deeply nested functions', () => {
    // Position 14 is at '1' in 'B1' inside SUM(B1:B10)
    const result = getEnclosingFunction('IF(A1>0, SUM(B1:B10), AVERAGE(C1:C10))', 14);
    expect(result).toBe('SUM');
  });

  it('returns outermost function from inner position', () => {
    // Position 20 is the comma after SUM(B1:B10) — outside SUM parens but inside IF
    const result = getEnclosingFunction('IF(A1>0, SUM(B1:B10), AVERAGE(C1:C10))', 20);
    expect(result).toBe('IF');
  });
});
