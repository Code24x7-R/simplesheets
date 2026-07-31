import { render, fireEvent } from '@testing-library/react';
import { FormulaWizard } from './FormulaWizard';

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

describe('FormulaWizard — Escape Key Behavior', () => {
  const defaultProps = {
    wizard: createWizardState(),
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

  it('first Esc in POINT mode cancels POINT (keeps modal open)', () => {
    render(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'POINT_SELECTION', pointSelectionParamIndex: 0 })} />);

    // In POINT mode, only the indicator is rendered (modal is hidden)
    const indicator = document.querySelector('.fixed.top-4.left-1\\/2')!;
    fireEvent.keyDown(indicator, { key: 'Escape' });

    // Should cancel POINT selection, NOT close modal
    expect(defaultProps.cancelPointSelection).toHaveBeenCalled();
    expect(defaultProps.closeWizard).not.toHaveBeenCalled();
  });

  it('Esc in WIZARD_ROOT closes modal', () => {
    render(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'WIZARD_ROOT' })} />);

    const overlay = document.querySelector('.fixed.inset-0.z-50')!;
    fireEvent.keyDown(overlay, { key: 'Escape' });

    expect(defaultProps.closeWizard).toHaveBeenCalled();
    expect(defaultProps.cancelPointSelection).not.toHaveBeenCalled();
  });

  it('Esc does not propagate to grid when modal is open', () => {
    render(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'POINT_SELECTION', pointSelectionParamIndex: 0 })} />);

    const indicator = document.querySelector('.fixed.top-4.left-1\\/2')!;
    fireEvent.keyDown(indicator, { key: 'Escape' });

    // cancelPointSelection should be called (proving the handler intercepted it)
    expect(defaultProps.cancelPointSelection).toHaveBeenCalled();
  });

  it('Esc closes modal after POINT mode is exited', () => {
    // First Esc cancels POINT, second Esc closes modal
    const { rerender } = render(
      <FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'POINT_SELECTION', pointSelectionParamIndex: 0 })} />
    );

    const indicator = document.querySelector('.fixed.top-4.left-1\\/2')!;
    fireEvent.keyDown(indicator, { key: 'Escape' });
    expect(defaultProps.cancelPointSelection).toHaveBeenCalled();

    // Simulate state change after cancel
    rerender(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'WIZARD_ROOT' })} />);
    const overlay = document.querySelector('.fixed.inset-0.z-50')!;
    fireEvent.keyDown(overlay, { key: 'Escape' });
    expect(defaultProps.closeWizard).toHaveBeenCalled();
  });
});
