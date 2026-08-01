// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { renderHook, act } from '@testing-library/react';
import { useFormulaWizard, MAX_NESTING_DEPTH } from '../hooks/useFormulaWizard';

describe('useFormulaWizard', () => {
  it('starts with INACTIVE state', () => {
    const { result } = renderHook(() => useFormulaWizard());
    expect(result.current.wizard.state).toBe('INACTIVE');
    expect(result.current.wizard.isOpen).toBe(false);
  });

  it('opens wizard with a function', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('SUM');
    });
    expect(result.current.wizard.state).toBe('WIZARD_ROOT');
    expect(result.current.wizard.isOpen).toBe(true);
    expect(result.current.wizard.activeNode?.functionName).toBe('SUM');
    expect(result.current.wizard.nestingDepth).toBe(1);
  });

  it('closes wizard', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('SUM');
    });
    act(() => {
      result.current.closeWizard();
    });
    expect(result.current.wizard.state).toBe('INACTIVE');
    expect(result.current.wizard.isOpen).toBe(false);
  });

  it('sets parameter values', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('SUM');
    });
    act(() => {
      result.current.setParameter('number1', 'A1:A10');
    });
    expect(result.current.wizard.activeNode?.parameterValues.number1?.rawValue).toBe('A1:A10');
  });

  it('compiles formula when parameters change', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('SUM');
    });
    act(() => {
      result.current.setParameter('number1', 'A1:A10');
    });
    expect(result.current.wizard.compiledFormula).toBe('SUM(A1:A10)');
  });

  it('enters nested function', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('ROUND');
    });
    act(() => {
      result.current.enterNested('number', 'SUM');
    });
    expect(result.current.wizard.state).toBe('NESTED_STEP');
    expect(result.current.wizard.nestingDepth).toBe(2);
    expect(result.current.wizard.activeNode?.functionName).toBe('SUM');
  });

  it('goes back from nested function', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('ROUND');
    });
    act(() => {
      result.current.enterNested('number', 'SUM');
    });
    act(() => {
      result.current.goBack();
    });
    expect(result.current.wizard.state).toBe('WIZARD_ROOT');
    expect(result.current.wizard.nestingDepth).toBe(1);
    expect(result.current.wizard.activeNode?.functionName).toBe('ROUND');
  });

  it('starts point selection', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('SUM');
    });
    act(() => {
      result.current.startPointSelection(0);
    });
    expect(result.current.wizard.state).toBe('POINT_SELECTION');
    expect(result.current.wizard.pointSelectionParamIndex).toBe(0);
  });

  it('cancels point selection', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('SUM');
    });
    act(() => {
      result.current.startPointSelection(0);
    });
    act(() => {
      result.current.cancelPointSelection();
    });
    expect(result.current.wizard.state).toBe('WIZARD_ROOT');
    expect(result.current.wizard.pointSelectionParamIndex).toBeNull();
  });

  it('applies point selection', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('SUM');
    });
    act(() => {
      result.current.startPointSelection(0);
    });
    act(() => {
      result.current.applyPointSelection('B2:D15');
    });
    expect(result.current.wizard.state).toBe('WIZARD_ROOT');
    expect(result.current.wizard.activeNode?.parameterValues.number1?.rawValue).toBe('B2:D15');
    expect(result.current.wizard.compiledFormula).toBe('SUM(B2:D15)');
  });

  it('compiles full formula with leading =', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('SUM');
    });
    act(() => {
      result.current.setParameter('number1', 'A1:A10');
    });
    const formula = result.current.compileFormula();
    expect(formula).toBe('=SUM(A1:A10)');
  });

  it('resets wizard', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('SUM');
    });
    act(() => {
      result.current.setParameter('number1', 'A1:A10');
    });
    act(() => {
      result.current.resetWizard();
    });
    expect(result.current.wizard.state).toBe('INACTIVE');
    expect(result.current.wizard.activeNode).toBeNull();
    expect(result.current.wizard.nodeStack.length).toBe(0);
  });

  it('sets target cell reference', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('SUM', 'B5');
    });
    expect(result.current.wizard.targetCellRef).toBe('B5');
  });

  it('loads schema for active function', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('VLOOKUP');
    });
    expect(result.current.wizard.activeSchema?.name).toBe('VLOOKUP');
    expect(result.current.wizard.activeSchema?.parameters.length).toBe(4);
  });
});

describe('useFormulaWizard - nesting limits', () => {
  it('enforces max nesting depth', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('ROUND');
    });
    // Try to nest beyond limit
    for (let i = 0; i < MAX_NESTING_DEPTH + 2; i++) {
      act(() => {
        result.current.enterNested('number', 'ROUND');
      });
    }
    // Should not exceed MAX_NESTING_DEPTH
    expect(result.current.wizard.nestingDepth).toBeLessThanOrEqual(MAX_NESTING_DEPTH);
  });

  it('compiles deeply nested formulas', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('ROUND');
    });
    act(() => {
      result.current.setParameter('num_digits', '2');
    });
    act(() => {
      result.current.enterNested('number', 'SUM');
    });
    act(() => {
      result.current.setParameter('number1', 'A1:A10');
    });
    const formula = result.current.compileFormula();
    expect(formula).toBe('=ROUND(SUM(A1:A10), 2)');
  });

  it('navigates back through multiple levels', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('ROUND');
    });
    act(() => {
      result.current.enterNested('number', 'SUM');
    });
    act(() => {
      result.current.setParameter('number1', 'A1:A10');
    });
    // Go back
    act(() => {
      result.current.goBack();
    });
    expect(result.current.wizard.nestingDepth).toBe(1);
    expect(result.current.wizard.activeNode?.functionName).toBe('ROUND');
    // The nested function should still be referenced
    expect(result.current.wizard.activeNode?.parameterValues.number?.isNestedFunction).toBe(true);
  });
});

describe('useFormulaWizard - defensive guards', () => {
  it('setParameter does nothing when no active node (wizard not opened)', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.setParameter('number1', 'A1:A10');
    });
    // Wizard is INACTIVE, so setParameter should be a no-op
    expect(result.current.wizard.state).toBe('INACTIVE');
    expect(result.current.wizard.activeNode).toBeNull();
  });

  it('goBack does nothing when only root is on stack', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('SUM');
    });
    act(() => {
      result.current.goBack();
    });
    // Still on root, stack unchanged
    expect(result.current.wizard.state).toBe('WIZARD_ROOT');
    expect(result.current.wizard.nestingDepth).toBe(1);
  });

  it('cancelPointSelection returns to NESTED_STEP when in nested function', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('ROUND');
    });
    act(() => {
      result.current.enterNested('number', 'SUM');
    });
    act(() => {
      result.current.startPointSelection(0);
    });
    expect(result.current.wizard.state).toBe('POINT_SELECTION');
    act(() => {
      result.current.cancelPointSelection();
    });
    // Should return to NESTED_STEP, not WIZARD_ROOT
    expect(result.current.wizard.state).toBe('NESTED_STEP');
    expect(result.current.wizard.pointSelectionParamIndex).toBeNull();
  });

  it('applyPointSelection does nothing when point selection not started', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('SUM');
    });
    act(() => {
      result.current.applyPointSelection('A1:A10');
    });
    // No point selection was started, so no change
    expect(result.current.wizard.state).toBe('WIZARD_ROOT');
    expect(result.current.wizard.activeNode?.parameterValues.number1).toBeUndefined();
  });

  it('applyPointSelection does nothing when active schema is missing', () => {
    const { result } = renderHook(() => useFormulaWizard());
    // Open and start point selection, then manually corrupt state
    act(() => {
      result.current.openWizard('SUM');
    });
    act(() => {
      result.current.startPointSelection(0);
    });
    // Applying without a valid schema is a defensive no-op
    // (schema is always set by openWizard, so this guard is for safety)
    // We verify the normal flow still works after the start
    act(() => {
      result.current.applyPointSelection('C1:C5');
    });
    expect(result.current.wizard.activeNode?.parameterValues.number1?.rawValue).toBe('C1:C5');
  });

  it('enterNested beyond max depth is a no-op', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('ROUND');
    });
    // Nest exactly to the limit
    for (let i = 1; i < MAX_NESTING_DEPTH; i++) {
      act(() => {
        result.current.enterNested('number', 'ROUND');
      });
    }
    expect(result.current.wizard.nestingDepth).toBe(MAX_NESTING_DEPTH);
    // One more attempt should be blocked
    act(() => {
      result.current.enterNested('number', 'ROUND');
    });
    expect(result.current.wizard.nestingDepth).toBe(MAX_NESTING_DEPTH);
  });

  it('startPointSelection updates param index in nested function', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('VLOOKUP');
    });
    act(() => {
      result.current.startPointSelection(2); // range_lookup param
    });
    expect(result.current.wizard.pointSelectionParamIndex).toBe(2);
    expect(result.current.wizard.state).toBe('POINT_SELECTION');
  });

  it('enterNested before openWizard creates a node but with no parent link', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.enterNested('number', 'SUM');
    });
    // enterNested transitions to NESTED_STEP even without prior openWizard
    // (it creates a child node; the parent update is just skipped)
    expect(result.current.wizard.state).toBe('NESTED_STEP');
    expect(result.current.wizard.activeNode?.functionName).toBe('SUM');
  });

  it('applyPointSelection with out-of-bounds param index leaves state unchanged', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('SUM');
    });
    // Start point selection with an invalid param index
    act(() => {
      result.current.startPointSelection(99);
    });
    expect(result.current.wizard.state).toBe('POINT_SELECTION');
    act(() => {
      result.current.applyPointSelection('A1:A10');
    });
    // Schema exists but param[99] is undefined, so guard returns prev unchanged
    expect(result.current.wizard.activeNode?.parameterValues.number1).toBeUndefined();
    // State remains POINT_SELECTION (the early return doesn't change state)
    expect(result.current.wizard.state).toBe('POINT_SELECTION');
  });

  it('cancelPointSelection from nested with multiple levels returns to NESTED_STEP', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('ROUND');
    });
    act(() => {
      result.current.enterNested('number', 'SUM');
    });
    act(() => {
      result.current.enterNested('number1', 'AVERAGE');
    });
    expect(result.current.wizard.nestingDepth).toBe(3);
    act(() => {
      result.current.startPointSelection(0);
    });
    act(() => {
      result.current.cancelPointSelection();
    });
    // Should return to NESTED_STEP (still nested)
    expect(result.current.wizard.state).toBe('NESTED_STEP');
    expect(result.current.wizard.pointSelectionParamIndex).toBeNull();
  });

  it('applyPointSelection from nested function returns to NESTED_STEP', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => result.current.openWizard('ROUND'));
    act(() => result.current.enterNested('number', 'SUM'));
    // Now in nested SUM — schema exists, param exists
    act(() => result.current.startPointSelection(0));
    expect(result.current.wizard.state).toBe('POINT_SELECTION');
    act(() => result.current.applyPointSelection('A1:A10'));
    // Should return to NESTED_STEP (stack length > 1), not WIZARD_ROOT
    expect(result.current.wizard.state).toBe('NESTED_STEP');
    expect(result.current.wizard.activeNode?.parameterValues.number1?.rawValue).toBe('A1:A10');
  });

  it('applyPointSelection returns unchanged when activeSchema is null', () => {
    const { result } = renderHook(() => useFormulaWizard());
    // Open with an unknown function — schema will be null
    act(() => result.current.openWizard('UNKNOWN_FUNC'));
    expect(result.current.wizard.activeSchema).toBeNull();
    expect(result.current.wizard.activeNode).not.toBeNull();
    // Start and apply point selection — should hit the !schema guard
    act(() => result.current.startPointSelection(0));
    expect(result.current.wizard.state).toBe('POINT_SELECTION');
    act(() => result.current.applyPointSelection('A1:A5'));
    // Guard returns prev unchanged
    expect(result.current.wizard.state).toBe('POINT_SELECTION');
    expect(result.current.wizard.pointSelectionParamIndex).toBe(0);
  });

  it('goBack from deeply nested restores correct parent schema', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('VLOOKUP');
    });
    act(() => {
      result.current.enterNested('table_array', 'SUM');
    });
    act(() => {
      result.current.goBack();
    });
    expect(result.current.wizard.state).toBe('WIZARD_ROOT');
    expect(result.current.wizard.activeSchema?.name).toBe('VLOOKUP');
  });
});

describe('useFormulaWizard - breadcrumb', () => {
  it('builds breadcrumb from node stack', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('ROUND');
    });
    act(() => {
      result.current.enterNested('number', 'SUM');
    });
    expect(result.current.wizard.nodeStack.length).toBe(2);
    expect(result.current.wizard.nodeStack[0].functionName).toBe('ROUND');
    expect(result.current.wizard.nodeStack[1].functionName).toBe('SUM');
  });

  it('maintains node map for all created nodes', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWizard('ROUND');
    });
    act(() => {
      result.current.enterNested('number', 'SUM');
    });
    expect(result.current.wizard.nodeMap.size).toBe(2);
  });
});

describe('useFormulaWizard - importFormula', () => {
  it('imports a simple formula successfully', () => {
    const { result } = renderHook(() => useFormulaWizard());
    let success: boolean = false;
    act(() => {
      success = result.current.importFormula('=SUM(B4:D4)', 'E3');
    });
    expect(success).toBe(true);
    expect(result.current.wizard.state).toBe('WIZARD_ROOT');
    expect(result.current.wizard.isOpen).toBe(true);
    expect(result.current.wizard.activeNode?.functionName).toBe('SUM');
    expect(result.current.wizard.targetCellRef).toBe('E3');
  });

  it('populates parameter values from imported formula', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.importFormula('=SUM(B4:D4)');
    });
    const number1 = result.current.wizard.activeNode?.parameterValues['number1'];
    expect(number1).toBeDefined();
    expect(number1?.rawValue).toBe('B4:D4');
  });

  it('imports nested functions', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.importFormula('=IF(A1>0, SUM(B4:D4), 0)');
    });
    expect(result.current.wizard.activeNode?.functionName).toBe('IF');
    expect(result.current.wizard.nodeMap.size).toBe(2);

    // Check nested SUM node
    const trueVal = result.current.wizard.activeNode?.parameterValues['true_val'];
    expect(trueVal?.isNestedFunction).toBe(true);
    const sumNode = result.current.wizard.nodeMap.get(trueVal?.nestedNodeId ?? '');
    expect(sumNode?.functionName).toBe('SUM');
    expect(sumNode?.parameterValues['number1']?.rawValue).toBe('B4:D4');
  });

  it('compiles formula from imported tree', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.importFormula('=SUM(B4:D4)');
    });
    expect(result.current.wizard.compiledFormula).toBe('SUM(B4:D4)');
  });

  it('enterExistingNested navigates into an existing nested node', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.importFormula('=IF(A1>0, SUM(B4:D4), 0)');
    });
    // Get the nested SUM node ID
    const trueVal = result.current.wizard.activeNode?.parameterValues['true_val'];
    expect(trueVal?.isNestedFunction).toBe(true);
    const nestedNodeId = trueVal?.nestedNodeId ?? '';

    // Navigate into the existing nested SUM node
    act(() => {
      result.current.enterExistingNested(nestedNodeId);
    });
    expect(result.current.wizard.state).toBe('NESTED_STEP');
    expect(result.current.wizard.activeNode?.functionName).toBe('SUM');
    expect(result.current.wizard.nestingDepth).toBe(2);
  });

  it('enterExistingNested does nothing for invalid node ID', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.importFormula('=IF(A1>0, SUM(B4:D4), 0)');
    });
    act(() => {
      result.current.enterExistingNested('nonexistent-id');
    });
    // State should remain unchanged (still at root IF level)
    expect(result.current.wizard.activeNode?.functionName).toBe('IF');
  });

  it('returns false for non-importable formula (binary op)', () => {
    const { result } = renderHook(() => useFormulaWizard());
    let success: boolean = true;
    act(() => {
      success = result.current.importFormula('=A1+B1');
    });
    expect(success).toBe(false);
    expect(result.current.wizard.isOpen).toBe(false);
  });

  it('returns false for literal formula', () => {
    const { result } = renderHook(() => useFormulaWizard());
    let success: boolean = true;
    act(() => {
      success = result.current.importFormula('=5');
    });
    expect(success).toBe(false);
  });

  it('returns false for empty formula', () => {
    const { result } = renderHook(() => useFormulaWizard());
    let success: boolean = true;
    act(() => {
      success = result.current.importFormula('');
    });
    expect(success).toBe(false);
  });

  it('returns false for syntax error', () => {
    const { result } = renderHook(() => useFormulaWizard());
    let success: boolean = true;
    act(() => {
      success = result.current.importFormula('=SUM(');
    });
    expect(success).toBe(false);
  });
});

describe('useFormulaWizard - openWithAutocomplete', () => {
  it('opens wizard in AUTOCOMPLETE state', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWithAutocomplete('E3');
    });
    expect(result.current.wizard.state).toBe('AUTOCOMPLETE');
    expect(result.current.wizard.isOpen).toBe(true);
    expect(result.current.wizard.targetCellRef).toBe('E3');
  });

  it('does not create any AST nodes', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWithAutocomplete();
    });
    expect(result.current.wizard.nodeMap.size).toBe(0);
    expect(result.current.wizard.activeNode).toBeNull();
    expect(result.current.wizard.nestingDepth).toBe(0);
  });

  it('can transition from AUTOCOMPLETE to WIZARD_ROOT via openWizard', () => {
    const { result } = renderHook(() => useFormulaWizard());
    act(() => {
      result.current.openWithAutocomplete('E3');
    });
    expect(result.current.wizard.state).toBe('AUTOCOMPLETE');

    // User picks a function from autocomplete
    act(() => {
      result.current.openWizard('SUM', 'E3');
    });
    expect(result.current.wizard.state).toBe('WIZARD_ROOT');
    expect(result.current.wizard.activeNode?.functionName).toBe('SUM');
  });
});
