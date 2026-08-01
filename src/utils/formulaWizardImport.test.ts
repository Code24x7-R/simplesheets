// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { importFormulaToWizard, canImportFormula } from './formulaWizardImport';

describe('formulaWizardImport', () => {
  describe('importFormulaToWizard', () => {
    it('returns null for empty string', () => {
      expect(importFormulaToWizard('')).toBeNull();
    });

    it('returns null for null-like input', () => {
      expect(importFormulaToWizard('   ')).toBeNull();
    });

    it('returns null for formula without function (binary op)', () => {
      expect(importFormulaToWizard('=A1+B1')).toBeNull();
    });

    it('returns null for literal formula', () => {
      expect(importFormulaToWizard('=5')).toBeNull();
    });

    it('returns null for cell ref formula', () => {
      expect(importFormulaToWizard('=A1')).toBeNull();
    });

    it('returns null for unary formula', () => {
      expect(importFormulaToWizard('=-A1')).toBeNull();
    });

    it('returns null for syntax error', () => {
      expect(importFormulaToWizard('=SUM(')).toBeNull();
    });

    it('imports simple function =SUM(B4:D4)', () => {
      const result = importFormulaToWizard('=SUM(B4:D4)');
      expect(result).not.toBeNull();

      const { root, nodeMap } = result!;
      expect(root.functionName).toBe('SUM');
      expect(nodeMap.has(root.id)).toBe(true);

      // Check parameter populated
      const number1 = root.parameterValues['number1'];
      expect(number1).toBeDefined();
      expect(number1.rawValue).toBe('B4:D4');
      expect(number1.isNestedFunction).toBe(false);
    });

    it('imports lowercase function =sum(B3:D3)', () => {
      const result = importFormulaToWizard('=sum(B3:D3)');
      expect(result).not.toBeNull();
      expect(result!.root.functionName).toBe('SUM');
      expect(result!.root.parameterValues['number1']?.rawValue).toBe('B3:D3');
    });

    it('imports function without leading = (SUM(B4:D4))', () => {
      const result = importFormulaToWizard('SUM(B4:D4)');
      expect(result).not.toBeNull();
      expect(result!.root.functionName).toBe('SUM');
      expect(result!.root.parameterValues['number1']?.rawValue).toBe('B4:D4');
    });

    it('imports nested function =IF(A1>0, SUM(B4:D4), 0)', () => {
      const result = importFormulaToWizard('=IF(A1>0, SUM(B4:D4), 0)');
      expect(result).not.toBeNull();

      const { root, nodeMap } = result!;
      expect(root.functionName).toBe('IF');

      // Condition is a binary op string
      const condition = root.parameterValues['condition'];
      expect(condition).toBeDefined();
      expect(condition.rawValue).toBe('A1 > 0');
      expect(condition.isNestedFunction).toBe(false);

      // True_val is a nested function
      const trueVal = root.parameterValues['true_val'];
      expect(trueVal).toBeDefined();
      expect(trueVal.isNestedFunction).toBe(true);
      expect(trueVal.nestedNodeId).toBeDefined();

      // Resolve nested node
      const nestedNode = nodeMap.get(trueVal.nestedNodeId!);
      expect(nestedNode).toBeDefined();
      expect(nestedNode!.functionName).toBe('SUM');
      expect(nestedNode!.parameterValues['number1']?.rawValue).toBe('B4:D4');

      // False_val is a literal
      const falseVal = root.parameterValues['false_val'];
      expect(falseVal).toBeDefined();
      expect(falseVal.rawValue).toBe('0');
      expect(falseVal.isNestedFunction).toBe(false);
    });

    it('imports deeply nested function', () => {
      const result = importFormulaToWizard('=IF(A1>0, IF(B1>0, SUM(C1:C10), 0), -1)');
      expect(result).not.toBeNull();

      const { root, nodeMap } = result!;
      expect(root.functionName).toBe('IF');

      // Navigate into nested IF
      const trueVal = root.parameterValues['true_val'];
      expect(trueVal.isNestedFunction).toBe(true);
      const innerIf = nodeMap.get(trueVal.nestedNodeId!);
      expect(innerIf).toBeDefined();
      expect(innerIf!.functionName).toBe('IF');

      // Navigate into inner SUM
      const innerTrueVal = innerIf!.parameterValues['true_val'];
      expect(innerTrueVal.isNestedFunction).toBe(true);
      const innerSum = nodeMap.get(innerTrueVal.nestedNodeId!);
      expect(innerSum).toBeDefined();
      expect(innerSum!.functionName).toBe('SUM');
      expect(innerSum!.parameterValues['number1']?.rawValue).toBe('C1:C10');
    });

    it('imports function with multiple args =VLOOKUP(A1, B1:D10, 2, FALSE)', () => {
      const result = importFormulaToWizard('=VLOOKUP(A1, B1:D10, 2, FALSE)');
      expect(result).not.toBeNull();

      const { root } = result!;
      expect(root.functionName).toBe('VLOOKUP');
      expect(root.parameterValues['value']?.rawValue).toBe('A1');
      expect(root.parameterValues['table']?.rawValue).toBe('B1:D10');
      expect(root.parameterValues['col']?.rawValue).toBe('2');
      expect(root.parameterValues['exact']?.rawValue).toBe('FALSE');
    });

    it('imports function with absolute refs =SUM($A$1:$B$2)', () => {
      const result = importFormulaToWizard('=SUM($A$1:$B$2)');
      expect(result).not.toBeNull();
      expect(result!.root.parameterValues['number1']?.rawValue).toBe('$A$1:$B$2');
    });

    it('imports function with mixed absolute refs', () => {
      const result = importFormulaToWizard('=SUM($A1:B$2)');
      expect(result).not.toBeNull();
      expect(result!.root.parameterValues['number1']?.rawValue).toBe('$A1:B$2');
    });

    it('imports function with string argument =LEFT("Hello", 3)', () => {
      const result = importFormulaToWizard('=LEFT("Hello", 3)');
      expect(result).not.toBeNull();
      expect(result!.root.parameterValues['text']?.rawValue).toBe('"Hello"');
      expect(result!.root.parameterValues['count']?.rawValue).toBe('3');
    });

    it('imports function with boolean =IF(A1>0, TRUE, FALSE)', () => {
      const result = importFormulaToWizard('=IF(A1>0, TRUE, FALSE)');
      expect(result).not.toBeNull();
      expect(result!.root.parameterValues['true_val']?.rawValue).toBe('TRUE');
      expect(result!.root.parameterValues['false_val']?.rawValue).toBe('FALSE');
    });

    it('imports unknown function as raw strings', () => {
      const result = importFormulaToWizard('=CUSTOM(A1, B1)');
      expect(result).not.toBeNull();
      expect(result!.root.functionName).toBe('CUSTOM');
      expect(result!.root.parameterValues['arg0']?.rawValue).toBe('A1');
      expect(result!.root.parameterValues['arg1']?.rawValue).toBe('B1');
    });

    it('imports function with unary operator =IF(A1>0, -B1, 0)', () => {
      const result = importFormulaToWizard('=IF(A1>0, -B1, 0)');
      expect(result).not.toBeNull();
      expect(result!.root.parameterValues['true_val']?.rawValue).toBe('-B1');
    });

    it('imports function with concatenation =CONCAT(A1, " ", B1)', () => {
      const result = importFormulaToWizard('=CONCAT(A1, " ", B1)');
      expect(result).not.toBeNull();
      expect(result!.root.parameterValues['text1']?.rawValue).toBe('A1');
      expect(result!.root.parameterValues['text2']?.rawValue).toBe('" "');
      expect(result!.root.parameterValues['text2_1']?.rawValue).toBe('B1');
    });

    it('imports COUNTIF with criteria string', () => {
      const result = importFormulaToWizard('=COUNTIF(A1:A10, ">5")');
      expect(result).not.toBeNull();
      expect(result!.root.functionName).toBe('COUNTIF');
      expect(result!.root.parameterValues['range']?.rawValue).toBe('A1:A10');
      expect(result!.root.parameterValues['criteria']?.rawValue).toBe('">5"');
    });

    it('imports SUMIF with all args', () => {
      const result = importFormulaToWizard('=SUMIF(A1:A10, ">5", B1:B10)');
      expect(result).not.toBeNull();
      expect(result!.root.functionName).toBe('SUMIF');
      expect(result!.root.parameterValues['range']?.rawValue).toBe('A1:A10');
      expect(result!.root.parameterValues['criteria']?.rawValue).toBe('">5"');
      expect(result!.root.parameterValues['sum_range']?.rawValue).toBe('B1:B10');
    });

    it('builds correct nodeMap with all nested nodes', () => {
      const result = importFormulaToWizard('=IF(A1>0, SUM(B4:D4), 0)');
      expect(result).not.toBeNull();

      const { root, nodeMap } = result!;
      // Should have 2 nodes: IF and SUM
      expect(nodeMap.size).toBe(2);
      expect(nodeMap.has(root.id)).toBe(true);

      const trueVal = root.parameterValues['true_val'];
      expect(nodeMap.has(trueVal.nestedNodeId!)).toBe(true);
    });

    it('sets parentId on nested nodes', () => {
      const result = importFormulaToWizard('=IF(A1>0, SUM(B4:D4), 0)');
      const { root, nodeMap } = result!;

      const trueVal = root.parameterValues['true_val'];
      const sumNode = nodeMap.get(trueVal.nestedNodeId!);
      expect(sumNode!.parentId).toBe(root.id);
    });
  });

  describe('variadic function import', () => {
    it('imports function with extra args beyond defined params (SUM with 3 args)', () => {
      const result = importFormulaToWizard('=SUM(B4:D4, E1:F1, G1:H1)');
      expect(result).not.toBeNull();
      // SUM has 2 defined params (number1, number2 variadic). Third arg goes into variadic slot.
      const values = Object.values(result?.root.parameterValues ?? {});
      expect(values.length).toBeGreaterThanOrEqual(3);
    });

    it('imports variadic function with nested function in extra arg', () => {
      // 3 args, 2 params → variadic handling triggers for 3rd arg (nested SUM)
      const result = importFormulaToWizard('=SUM(B4:D4, E1:F1, SUM(G1:G10))');
      expect(result).not.toBeNull();
      // The 3rd arg (SUM nested) should be imported as a nested function node
      const nestedParam = Object.values(result?.root.parameterValues ?? {}).find((p) => p.isNestedFunction);
      expect(nestedParam).toBeDefined();
    });
  });

  describe('canImportFormula', () => {
    it('returns true for importable formula', () => {
      expect(canImportFormula('=SUM(B4:D4)')).toBe(true);
    });

    it('returns true for nested formula', () => {
      expect(canImportFormula('=IF(A1>0, SUM(B4:D4), 0)')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(canImportFormula('')).toBe(false);
    });

    it('returns false for binary op', () => {
      expect(canImportFormula('=A1+B1')).toBe(false);
    });

    it('returns false for literal', () => {
      expect(canImportFormula('=5')).toBe(false);
    });

    it('returns false for cell ref', () => {
      expect(canImportFormula('=A1')).toBe(false);
    });

    it('returns false for unknown function', () => {
      expect(canImportFormula('=CUSTOM(A1)')).toBe(false);
    });

    it('returns false for syntax error', () => {
      expect(canImportFormula('=SUM(')).toBe(false);
    });
  });
});
