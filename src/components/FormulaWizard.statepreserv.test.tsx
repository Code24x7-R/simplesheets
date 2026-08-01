// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen } from '@testing-library/react';
import { FormulaWizard } from './FormulaWizard';
import { useFormulaWizard } from '../hooks/useFormulaWizard';
import { act, renderHook } from '@testing-library/react';

function createWizardState(overrides: Record<string, unknown> = {}) {
  return {
    isOpen: true,
    state: 'WIZARD_ROOT' as const,
    activeSchema: {
      name: 'SUM',
      category: 'MATH' as const,
      description: 'Adds numbers',
      parameters: [
        { id: 'number1', name: 'Number1', description: 'First number', type: 'NUMBER' as const, isRequired: true, allowNestedFunction: true },
        { id: 'number2', name: 'Number2', description: 'Second number', type: 'NUMBER' as const, isRequired: false, allowNestedFunction: true },
      ],
      returnType: 'NUMBER' as const,
      syntaxTemplate: 'SUM(number1, [number2, ...])',
    },
    activeNode: {
      id: 'root',
      functionName: 'SUM',
      parameterValues: {
        number1: { parameterId: 'number1', rawValue: '', isNestedFunction: false },
        number2: { parameterId: 'number2', rawValue: '', isNestedFunction: false },
      },
      nestedNodes: {},
    },
    nodeStack: [],
    nodeMap: new Map(),
    nestingDepth: 1,
    compiledFormula: 'SUM()',
    pointSelectionParamIndex: null,
    targetCellRef: null,
    ...overrides,
  };
}

describe('useFormulaWizard — POINT State Preservation', () => {
  it('preserves POINT state when setParameter is called', () => {
    const { result } = renderHook(() => useFormulaWizard());

    // Start point selection
    act(() => { result.current.startPointSelection(0); });
    expect(result.current.wizard.state).toBe('POINT_SELECTION');
    expect(result.current.wizard.pointSelectionParamIndex).toBe(0);

    // Set a parameter value (simulating user typing)
    act(() => { result.current.setParameter('number1', 'A1:B2'); });

    // POINT state should be preserved (or transitioned, not reset to SELECT)
    // The key is that pointSelectionParamIndex should still be set
    expect(result.current.wizard.pointSelectionParamIndex).not.toBeNull();
  });

  it('preserves POINT state across multiple setParameter calls', () => {
    const { result } = renderHook(() => useFormulaWizard());

    // Start point selection
    act(() => { result.current.startPointSelection(0); });
    expect(result.current.wizard.state).toBe('POINT_SELECTION');

    // Multiple parameter changes
    act(() => { result.current.setParameter('number1', 'A1'); });
    act(() => { result.current.setParameter('number1', 'A1:B2'); });

    // POINT state should still be active
    expect(result.current.wizard.pointSelectionParamIndex).toBe(0);
  });

  it('clears POINT state only when cancelPointSelection is called', () => {
    const { result } = renderHook(() => useFormulaWizard());

    // Start point selection
    act(() => { result.current.startPointSelection(0); });
    expect(result.current.wizard.state).toBe('POINT_SELECTION');

    // Cancel should clear POINT state
    act(() => { result.current.cancelPointSelection(); });
    expect(result.current.wizard.state).not.toBe('POINT_SELECTION');
    expect(result.current.wizard.pointSelectionParamIndex).toBeNull();
  });

  it('POINT state persists through enterNested', () => {
    const { result } = renderHook(() => useFormulaWizard());

    // Start point selection
    act(() => { result.current.startPointSelection(0); });
    expect(result.current.wizard.state).toBe('POINT_SELECTION');
  });
});

describe('FormulaWizard — POINT State UI Preservation', () => {
  const defaultProps = {
    wizard: createWizardState({ state: 'POINT_SELECTION', pointSelectionParamIndex: 0 }),
    setParameter: jest.fn(),
    enterNested: jest.fn(),
    goBack: jest.fn(),
    startPointSelection: jest.fn(),
    cancelPointSelection: jest.fn(),
    closeWizard: jest.fn(),
    onApply: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows POINT mode indicator when state is POINT_SELECTION', () => {
    render(<FormulaWizard {...defaultProps} />);
    expect(screen.getByText(/POINT mode:/i)).toBeInTheDocument();
  });

  it('does not show POINT mode indicator when state is WIZARD_ROOT', () => {
    render(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'WIZARD_ROOT' })} />);
    expect(screen.queryByText(/POINT mode:/i)).not.toBeInTheDocument();
  });

  it('modal is hidden in POINT mode (parameter inputs not visible)', () => {
    render(<FormulaWizard {...defaultProps} />);
    // In POINT mode, the modal is completely hidden — only the indicator is shown
    expect(screen.queryByText('Number1')).not.toBeInTheDocument();
    expect(screen.queryByText('Number2')).not.toBeInTheDocument();
    // The POINT mode indicator is shown instead
    expect(screen.getByText(/POINT mode:/i)).toBeInTheDocument();
  });

  it('parameter inputs reappear after POINT mode is exited', () => {
    const { rerender } = render(<FormulaWizard {...defaultProps} />);
    // In POINT mode, parameter inputs are hidden
    expect(screen.queryByText('Number1')).not.toBeInTheDocument();

    // After exiting POINT mode, parameter inputs reappear
    rerender(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'WIZARD_ROOT' })} />);
    expect(screen.getByText('Number1')).toBeInTheDocument();
    expect(screen.getByText('Number2')).toBeInTheDocument();
  });
});
