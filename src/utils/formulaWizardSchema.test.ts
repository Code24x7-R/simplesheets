import { getFunctionSchema, getAllFunctionSchemas, getFunctionsByCategory, getCategories } from '../utils/formulaWizardSchema';

describe('formulaWizardSchema', () => {
  describe('getFunctionSchema', () => {
    it('returns schema for SUM', () => {
      const schema = getFunctionSchema('SUM');
      expect(schema).not.toBeNull();
      expect(schema?.name).toBe('SUM');
      expect(schema?.parameters.length).toBeGreaterThan(0);
    });

    it('returns schema for VLOOKUP', () => {
      const schema = getFunctionSchema('VLOOKUP');
      expect(schema).not.toBeNull();
      expect(schema?.parameters.length).toBe(4);
    });

    it('is case-insensitive', () => {
      expect(getFunctionSchema('sum')).not.toBeNull();
      expect(getFunctionSchema('Sum')).not.toBeNull();
    });

    it('returns null for unknown function', () => {
      expect(getFunctionSchema('UNKNOWN')).toBeNull();
    });

    it('returns schema for all documented functions', () => {
      const schemas = getAllFunctionSchemas();
      expect(schemas.length).toBeGreaterThan(40);
    });
  });

  describe('function parameter definitions', () => {
    it('SUM has correct parameter structure', () => {
      const schema = getFunctionSchema('SUM')!;
      expect(schema.parameters[0].id).toBe('number1');
      expect(schema.parameters[0].type).toBe('RANGE');
      expect(schema.parameters[0].isRequired).toBe(true);
      expect(schema.parameters[0].allowNestedFunction).toBe(true);
      expect(schema.parameters[1].isVariadic).toBe(true);
    });

    it('SUMIF has correct parameter types', () => {
      const schema = getFunctionSchema('SUMIF')!;
      expect(schema.parameters[0].type).toBe('RANGE');
      expect(schema.parameters[0].id).toBe('range');
      expect(schema.parameters[1].type).toBe('STRING');
      expect(schema.parameters[1].id).toBe('criteria');
      expect(schema.parameters[2].type).toBe('RANGE');
      expect(schema.parameters[2].isRequired).toBe(false);
    });

    it('IF has BOOLEAN condition and ANY return values', () => {
      const schema = getFunctionSchema('IF')!;
      expect(schema.parameters[0].type).toBe('BOOLEAN');
      expect(schema.parameters[1].type).toBe('ANY');
      expect(schema.parameters[2].type).toBe('ANY');
      expect(schema.parameters[2].isRequired).toBe(false);
    });

    it('NOW has no parameters', () => {
      const schema = getFunctionSchema('NOW')!;
      expect(schema.parameters.length).toBe(0);
    });

    it('ROUND has two required NUMBER parameters', () => {
      const schema = getFunctionSchema('ROUND')!;
      expect(schema.parameters[0].type).toBe('NUMBER');
      expect(schema.parameters[0].isRequired).toBe(true);
      expect(schema.parameters[0].allowNestedFunction).toBe(true);
      expect(schema.parameters[1].type).toBe('NUMBER');
      expect(schema.parameters[1].isRequired).toBe(true);
      expect(schema.parameters[1].allowNestedFunction).toBe(false);
    });
  });

  describe('getFunctionsByCategory', () => {
    it('returns math functions', () => {
      const math = getFunctionsByCategory('MATH');
      expect(math.length).toBeGreaterThan(0);
      expect(math.some((fn) => fn.name === 'SUM')).toBe(true);
    });

    it('returns empty array for unknown category', () => {
      expect(getFunctionsByCategory('UNKNOWN')).toEqual([]);
    });
  });

  describe('getCategories', () => {
    it('returns all categories', () => {
      const categories = getCategories();
      expect(categories).toContain('MATH');
      expect(categories).toContain('LOGICAL');
      expect(categories).toContain('TEXT');
      expect(categories).toContain('LOOKUP');
    });
  });

  describe('syntaxTemplate', () => {
    it('has valid syntax template for each function', () => {
      const schemas = getAllFunctionSchemas();
      for (const schema of schemas) {
        expect(schema.syntaxTemplate).toContain(schema.name);
        expect(schema.syntaxTemplate).toContain('(');
        expect(schema.syntaxTemplate).toContain(')');
      }
    });
  });
});
