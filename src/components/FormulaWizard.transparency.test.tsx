import { render, screen } from '@testing-library/react';
import { FormulaWizard } from './FormulaWizard';

const createWizardState = (overrides: Record<string, unknown> = {}) => ({
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
});

describe('FormulaWizard — Modal Transparency for POINT Mode', () => {
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

  it('modal overlay is NOT click-through when not in POINT mode', () => {
    render(<FormulaWizard {...defaultProps} />);
    const overlay = document.querySelector('.fixed.inset-0.z-50');
    expect(overlay).toBeInTheDocument();
    // Overlay should NOT have pointer-events-none class in normal mode
    expect(overlay?.classList.contains('pointer-events-none')).toBe(false);
  });

  it('modal is completely hidden in POINT mode (only indicator visible)', () => {
    render(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'POINT_SELECTION', pointSelectionParamIndex: 0 })} />);
    // Modal and overlay should NOT be rendered in POINT mode
    const overlay = document.querySelector('.fixed.inset-0.z-50');
    expect(overlay).not.toBeInTheDocument();
    const modal = document.querySelector('.bg-white.rounded-lg');
    expect(modal).not.toBeInTheDocument();
  });

  it('POINT mode indicator is shown at top of screen in POINT mode', () => {
    render(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'POINT_SELECTION', pointSelectionParamIndex: 0 })} />);
    // The POINT mode indicator is rendered at the top of the screen
    const indicator = document.querySelector('.fixed.top-4.left-1\\/2');
    expect(indicator).toBeInTheDocument();
    expect(indicator?.classList.contains('pointer-events-auto')).toBe(true);
    // Verify it's positioned at the top (not centered like the modal)
    expect(indicator?.classList.contains('top-4')).toBe(true);
  });

  it('POINT mode indicator shows instructions and Cancel button', () => {
    render(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'POINT_SELECTION', pointSelectionParamIndex: 0 })} />);
    expect(screen.getByText(/POINT mode:/i)).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('modal is fully visible when not in POINT mode', () => {
    render(<FormulaWizard {...defaultProps} />);
    const modal = document.querySelector('.bg-white.rounded-lg');
    expect(modal).toBeInTheDocument();
    // Modal should NOT have reduced opacity in normal mode
    expect(modal?.classList.contains('opacity-75') || modal?.classList.contains('opacity-50')).toBe(false);
  });

  it('exiting POINT mode restores the modal', () => {
    // Start in POINT mode — modal is hidden
    const { rerender } = render(
      <FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'POINT_SELECTION', pointSelectionParamIndex: 0 })} />
    );
    expect(document.querySelector('.bg-white.rounded-lg')).not.toBeInTheDocument();

    // Exit POINT mode — modal reappears
    rerender(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'WIZARD_ROOT' })} />);
    expect(document.querySelector('.bg-white.rounded-lg')).toBeInTheDocument();
  });

  it('grid is fully accessible in POINT mode (no overlay blocking)', () => {
    render(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'POINT_SELECTION', pointSelectionParamIndex: 0 })} />);
    // No overlay is rendered, so the grid is fully accessible
    const overlay = document.querySelector('.fixed.inset-0.z-50');
    expect(overlay).not.toBeInTheDocument();
    // Only the indicator is rendered at the top
    const indicator = document.querySelector('.fixed.top-4.left-1\\/2');
    expect(indicator).toBeInTheDocument();
  });
});
