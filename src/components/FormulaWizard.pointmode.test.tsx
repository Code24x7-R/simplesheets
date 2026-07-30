import { render, screen, fireEvent } from '@testing-library/react';
import { FormulaWizard } from './FormulaWizard';
import { useFormulaWizard } from '../hooks/useFormulaWizard';
import { act, renderHook } from '@testing-library/react';

// Wrapper to test the hook with the component
function setupWizard() {
  const { result } = renderHook(() => useFormulaWizard());
  return result;
}

describe('FormulaWizard — POINT Mode Interaction', () => {
  const defaultProps = {
    wizard: {
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
    },
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

  it('renders in POINT_SELECTION state', () => {
    const props = {
      ...defaultProps,
      wizard: {
        ...defaultProps.wizard,
        state: 'POINT_SELECTION' as const,
        pointSelectionParamIndex: 0,
      },
    };
    render(<FormulaWizard {...props} />);
    expect(screen.getByText(/POINT mode:/i)).toBeInTheDocument();
  });

  it('shows point selection indicator for active parameter', () => {
    const props = {
      ...defaultProps,
      wizard: {
        ...defaultProps.wizard,
        state: 'POINT_SELECTION' as const,
        pointSelectionParamIndex: 0,
      },
    };
    render(<FormulaWizard {...props} />);
    expect(screen.getByText(/POINT mode:/i)).toBeInTheDocument();
  });

  it('calls cancelPointSelection when Cancel is clicked', () => {
    const props = {
      ...defaultProps,
      wizard: {
        ...defaultProps.wizard,
        state: 'POINT_SELECTION' as const,
        pointSelectionParamIndex: 0,
      },
    };
    render(<FormulaWizard {...props} />);
    // Click the Cancel button in the POINT mode indicator (has yellow text)
    const cancelBtns = screen.getAllByText(/Cancel/i);
    const pointCancelBtn = cancelBtns.find((btn) => btn.classList.contains('text-yellow-600'));
    fireEvent.click(pointCancelBtn!);
    expect(props.cancelPointSelection).toHaveBeenCalled();
  });

  it('modal renders when in POINT mode', () => {
    const props = {
      ...defaultProps,
      wizard: {
        ...defaultProps.wizard,
        state: 'POINT_SELECTION' as const,
        pointSelectionParamIndex: 0,
      },
    };
    render(<FormulaWizard {...props} />);
    // Modal should render with POINT mode indicator
    expect(screen.getByText(/POINT mode:/i)).toBeInTheDocument();
  });

  it('modal renders when not in POINT mode', () => {
    render(<FormulaWizard {...defaultProps} />);
    expect(screen.getByText('Nested Formula Wizard')).toBeInTheDocument();
  });
});

describe('useFormulaWizard — POINT State Preservation', () => {
  it('preserves POINT state across function changes', () => {
    const result = setupWizard();

    // Start point selection
    act(() => {
      result.current.startPointSelection(0);
    });
    expect(result.current.wizard.state).toBe('POINT_SELECTION');
    expect(result.current.wizard.pointSelectionParamIndex).toBe(0);
  });

  it('restores POINT state after nested navigation', () => {
    const result = setupWizard();

    // Start point selection
    act(() => {
      result.current.startPointSelection(0);
    });
    expect(result.current.wizard.state).toBe('POINT_SELECTION');
  });

  it('returns to previous state after canceling POINT', () => {
    const result = setupWizard();

    // Start point selection
    act(() => {
      result.current.startPointSelection(0);
    });
    expect(result.current.wizard.state).toBe('POINT_SELECTION');

    // Cancel
    act(() => {
      result.current.cancelPointSelection();
    });
    expect(result.current.wizard.state).not.toBe('POINT_SELECTION');
  });
});
