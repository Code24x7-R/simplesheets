import { render } from '@testing-library/react';
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

  it('modal overlay IS click-through when in POINT mode', () => {
    render(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'POINT_SELECTION', pointSelectionParamIndex: 0 })} />);
    const overlay = document.querySelector('.fixed.inset-0.z-50');
    expect(overlay).toBeInTheDocument();
    // Overlay SHOULD have pointer-events-none class in POINT mode
    expect(overlay?.classList.contains('pointer-events-none')).toBe(true);
  });

  it('modal content is click-through in POINT mode (so grid is accessible)', () => {
    render(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'POINT_SELECTION', pointSelectionParamIndex: 0 })} />);
    const content = document.querySelector('.bg-white.rounded-lg');
    expect(content).toBeInTheDocument();
    // Content SHOULD have pointer-events-none so clicks reach the grid
    expect(content?.classList.contains('pointer-events-none')).toBe(true);
  });

  it('POINT mode indicator is clickable (positioned at top, outside modal)', () => {
    render(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'POINT_SELECTION', pointSelectionParamIndex: 0 })} />);
    // The POINT mode indicator is rendered outside the modal with pointer-events-auto
    const indicator = document.querySelector('.fixed.top-4.left-1\\/2.-translate-x-1\\/2.z-\\[60\\]');
    expect(indicator).toBeInTheDocument();
    expect(indicator?.classList.contains('pointer-events-auto')).toBe(true);
  });

  it('modal is semi-transparent in POINT mode', () => {
    render(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'POINT_SELECTION', pointSelectionParamIndex: 0 })} />);
    const modal = document.querySelector('.bg-white.rounded-lg');
    expect(modal).toBeInTheDocument();
    // Modal should have reduced opacity in POINT mode
    expect(modal?.classList.contains('opacity-75') || modal?.classList.contains('opacity-50')).toBe(true);
  });

  it('modal is fully opaque when not in POINT mode', () => {
    render(<FormulaWizard {...defaultProps} />);
    const modal = document.querySelector('.bg-white.rounded-lg');
    expect(modal).toBeInTheDocument();
    // Modal should NOT have reduced opacity in normal mode
    expect(modal?.classList.contains('opacity-75') || modal?.classList.contains('opacity-50')).toBe(false);
  });

  it('exiting POINT mode restores full opacity', () => {
    // Start in POINT mode
    const { rerender } = render(
      <FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'POINT_SELECTION', pointSelectionParamIndex: 0 })} />
    );
    let modal = document.querySelector('.bg-white.rounded-lg');
    expect(modal?.classList.contains('opacity-75') || modal?.classList.contains('opacity-50')).toBe(true);

    // Exit POINT mode
    rerender(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'WIZARD_ROOT' })} />);
    modal = document.querySelector('.bg-white.rounded-lg');
    expect(modal?.classList.contains('opacity-75') || modal?.classList.contains('opacity-50')).toBe(false);
  });

  it('grid receives click events when modal is in POINT mode', () => {
    render(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'POINT_SELECTION', pointSelectionParamIndex: 0 })} />);
    const overlay = document.querySelector('.fixed.inset-0.z-50');
    // pointer-events-none means clicks pass through to grid
    expect(overlay?.classList.contains('pointer-events-none')).toBe(true);
  });
});
