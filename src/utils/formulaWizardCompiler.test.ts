import { compileASTNodeToString, compileASTToFormula, validateParameter, checkCircularReference, generateNodeId, createASTNode } from '../utils/formulaWizardCompiler';
import type { FormulaASTNode } from '../utils/formulaWizardSchema';

describe('formulaWizardCompiler', () => {
  describe('compileASTNodeToString', () => {
    it('compiles a simple SUM function', () => {
      const node: FormulaASTNode = {
        id: 'node_1',
        functionName: 'SUM',
        parameterValues: {
          number1: { parameterId: 'number1', rawValue: 'A1:A10', isNestedFunction: false },
        },
      };
      const nodeMap = new Map([['node_1', node]]);
      const result = compileASTNodeToString(node, nodeMap);
      expect(result).toBe('SUM(A1:A10)');
    });

    it('compiles SUM with multiple arguments', () => {
      const node: FormulaASTNode = {
        id: 'node_1',
        functionName: 'SUM',
        parameterValues: {
          number1: { parameterId: 'number1', rawValue: 'A1:A10', isNestedFunction: false },
          number2: { parameterId: 'number2', rawValue: 'B1:B10', isNestedFunction: false },
        },
      };
      const nodeMap = new Map([['node_1', node]]);
      const result = compileASTNodeToString(node, nodeMap);
      expect(result).toBe('SUM(A1:A10, B1:B10)');
    });

    it('compiles nested functions', () => {
      const childNode: FormulaASTNode = {
        id: 'node_2',
        parentId: 'node_1',
        functionName: 'SUM',
        parameterValues: {
          number1: { parameterId: 'number1', rawValue: 'A1:A10', isNestedFunction: false },
        },
      };
      const parentNode: FormulaASTNode = {
        id: 'node_1',
        functionName: 'ROUND',
        parameterValues: {
          number: { parameterId: 'number', rawValue: '', isNestedFunction: true, nestedNodeId: 'node_2' },
          num_digits: { parameterId: 'num_digits', rawValue: '2', isNestedFunction: false },
        },
      };
      const nodeMap = new Map([['node_1', parentNode], ['node_2', childNode]]);
      const result = compileASTNodeToString(parentNode, nodeMap);
      expect(result).toBe('ROUND(SUM(A1:A10), 2)');
    });

    it('trims trailing empty optional parameters', () => {
      const node: FormulaASTNode = {
        id: 'node_1',
        functionName: 'IF',
        parameterValues: {
          condition: { parameterId: 'condition', rawValue: 'A1>0', isNestedFunction: false },
          true_val: { parameterId: 'true_val', rawValue: '"yes"', isNestedFunction: false },
          false_val: { parameterId: 'false_val', rawValue: '', isNestedFunction: false },
        },
      };
      const nodeMap = new Map([['node_1', node]]);
      const result = compileASTNodeToString(node, nodeMap);
      expect(result).toBe('IF(A1>0, "yes")');
    });

    it('handles unknown function gracefully', () => {
      const node: FormulaASTNode = {
        id: 'node_1',
        functionName: 'UNKNOWN',
        parameterValues: {
          param1: { parameterId: 'param1', rawValue: 'A1', isNestedFunction: false },
        },
      };
      const nodeMap = new Map([['node_1', node]]);
      const result = compileASTNodeToString(node, nodeMap);
      expect(result).toBe('UNKNOWN(A1)');
    });

    it('handles unknown function with nested function', () => {
      const childNode: FormulaASTNode = {
        id: 'node_2',
        parentId: 'node_1',
        functionName: 'SUM',
        parameterValues: {
          number1: { parameterId: 'number1', rawValue: 'A1:A10', isNestedFunction: false },
        },
      };
      const parentNode: FormulaASTNode = {
        id: 'node_1',
        functionName: 'UNKNOWN',
        parameterValues: {
          param1: { parameterId: 'param1', rawValue: '', isNestedFunction: true, nestedNodeId: 'node_2' },
        },
      };
      const nodeMap = new Map([['node_1', parentNode], ['node_2', childNode]]);
      const result = compileASTNodeToString(parentNode, nodeMap);
      expect(result).toBe('UNKNOWN(SUM(A1:A10))');
    });

    it('handles missing nested node in nodeMap', () => {
      const parentNode: FormulaASTNode = {
        id: 'node_1',
        functionName: 'ROUND',
        parameterValues: {
          number: { parameterId: 'number', rawValue: '', isNestedFunction: true, nestedNodeId: 'missing_node' },
          num_digits: { parameterId: 'num_digits', rawValue: '2', isNestedFunction: false },
        },
      };
      const nodeMap = new Map([['node_1', parentNode]]);
      const result = compileASTNodeToString(parentNode, nodeMap);
      expect(result).toBe('ROUND(, 2)');
    });

    it('compiles SUMIF with all parameters', () => {
      const node: FormulaASTNode = {
        id: 'node_1',
        functionName: 'SUMIF',
        parameterValues: {
          range: { parameterId: 'range', rawValue: 'A1:A10', isNestedFunction: false },
          criteria: { parameterId: 'criteria', rawValue: '>10', isNestedFunction: false },
          sum_range: { parameterId: 'sum_range', rawValue: 'B1:B10', isNestedFunction: false },
        },
      };
      const nodeMap = new Map([['node_1', node]]);
      const result = compileASTNodeToString(node, nodeMap);
      expect(result).toBe('SUMIF(A1:A10, >10, B1:B10)');
    });

    it('compiles SUM with variadic extra parameters (B-010)', () => {
      const node: FormulaASTNode = {
        id: 'node_1',
        functionName: 'SUM',
        parameterValues: {
          number1: { parameterId: 'number1', rawValue: 'A1:A3', isNestedFunction: false },
          number2: { parameterId: 'number2', rawValue: 'D3:D7', isNestedFunction: false },
          number2_1: { parameterId: 'number2_1', rawValue: 'F1:F5', isNestedFunction: false },
        },
      };
      const nodeMap = new Map([['node_1', node]]);
      const result = compileASTNodeToString(node, nodeMap);
      expect(result).toBe('SUM(A1:A3, D3:D7, F1:F5)');
    });
  });

  describe('compileASTToFormula', () => {
    it('adds leading = to compiled string', () => {
      const node: FormulaASTNode = {
        id: 'node_1',
        functionName: 'SUM',
        parameterValues: {
          number1: { parameterId: 'number1', rawValue: 'A1:A10', isNestedFunction: false },
        },
      };
      const nodeMap = new Map([['node_1', node]]);
      const result = compileASTToFormula(node, nodeMap);
      expect(result).toBe('=SUM(A1:A10)');
    });
  });

  describe('validateParameter', () => {
    it('validates NUMBER type accepts numbers', () => {
      expect(validateParameter('42', 'NUMBER')).toBeNull();
    });

    it('validates NUMBER type accepts cell refs', () => {
      expect(validateParameter('A1', 'NUMBER')).toBeNull();
    });

    it('validates NUMBER type accepts ranges', () => {
      expect(validateParameter('A1:B10', 'NUMBER')).toBeNull();
    });

    it('rejects non-numeric text for NUMBER type', () => {
      expect(validateParameter('hello', 'NUMBER')).not.toBeNull();
    });

    it('validates RANGE type accepts ranges', () => {
      expect(validateParameter('A1:B10', 'RANGE')).toBeNull();
    });

    it('validates RANGE type accepts cell refs', () => {
      expect(validateParameter('A1', 'RANGE')).toBeNull();
    });

    it('rejects non-range values for RANGE type', () => {
      expect(validateParameter('42', 'RANGE')).not.toBeNull();
    });

    it('validates BOOLEAN type accepts TRUE/FALSE', () => {
      expect(validateParameter('TRUE', 'BOOLEAN')).toBeNull();
      expect(validateParameter('FALSE', 'BOOLEAN')).toBeNull();
    });

    it('rejects non-boolean for BOOLEAN type', () => {
      expect(validateParameter('hello', 'BOOLEAN')).not.toBeNull();
    });

    it('validates STRING type accepts quoted text', () => {
      expect(validateParameter('"hello"', 'STRING')).toBeNull();
    });

    it('validates STRING type accepts criteria expressions', () => {
      expect(validateParameter('>10', 'STRING')).toBeNull();
    });

    it('allows empty value (handled by required check)', () => {
      expect(validateParameter('', 'NUMBER')).toBeNull();
    });

    it('ANY type accepts anything', () => {
      expect(validateParameter('anything', 'ANY')).toBeNull();
    });

    it('BOOLEAN type accepts 0 and 1', () => {
      expect(validateParameter('0', 'BOOLEAN')).toBeNull();
      expect(validateParameter('1', 'BOOLEAN')).toBeNull();
    });

    it('FUNCTION type always returns null', () => {
      expect(validateParameter('SUM', 'FUNCTION')).toBeNull();
    });

    it('default case returns null for unknown types', () => {
      expect(validateParameter('value', 'UNKNOWN_TYPE')).toBeNull();
    });
  });

  describe('checkCircularReference', () => {
    it('returns false for non-formula', () => {
      expect(checkCircularReference('hello', 0, 0)).toBe(false);
    });

    it('returns false for formula without target cell', () => {
      expect(checkCircularReference('=SUM(B1:B10)', 0, 0)).toBe(false);
    });

    it('returns true when formula references target cell', () => {
      expect(checkCircularReference('=SUM(A1:A10)', 0, 0)).toBe(true);
    });

    it('returns true when target is in range', () => {
      expect(checkCircularReference('=A1+B1', 0, 0)).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(checkCircularReference('=SUM(a1:a10)', 0, 0)).toBe(true);
    });

    it('returns true when target is in range bounds', () => {
      // Target A1 (row 0, col 0) is the start of range A1:B10
      expect(checkCircularReference('=SUM(A1:B10)', 0, 0)).toBe(true);
    });

    it('returns false for empty formula', () => {
      expect(checkCircularReference('', 0, 0)).toBe(false);
    });
  });

  describe('generateNodeId', () => {
    it('generates unique IDs', () => {
      const id1 = generateNodeId();
      const id2 = generateNodeId();
      expect(id1).not.toBe(id2);
    });

    it('generates string IDs', () => {
      expect(typeof generateNodeId()).toBe('string');
    });
  });

  describe('createASTNode', () => {
    it('creates a node with function name', () => {
      const node = createASTNode('SUM');
      expect(node.functionName).toBe('SUM');
      expect(node.parameterValues).toEqual({});
      expect(node.id).toBeTruthy();
    });

    it('creates a node with parent ID', () => {
      const node = createASTNode('ROUND', 'parent_123');
      expect(node.parentId).toBe('parent_123');
    });

    it('uppercases function name', () => {
      const node = createASTNode('sum');
      expect(node.functionName).toBe('SUM');
    });
  });
});
