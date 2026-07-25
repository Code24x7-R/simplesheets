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
