import { render, screen, fireEvent } from '@testing-library/react';
import { FormulaWizard } from './FormulaWizard';
import type { WizardStateData } from '../hooks/useFormulaWizard';
import type { FormulaASTNode } from '../utils/formulaWizardSchema';

// Helper to create a minimal wizard state
function createWizardState(overrides: Partial<WizardStateData> = {}): WizardStateData {
  return {
    state: 'WIZARD_ROOT',
    nodeStack: [{
      id: 'node_1',
      functionName: 'SUM',
      parameterValues: {},
    }],
    nodeMap: new Map(),
    activeNode: {
      id: 'node_1',
      functionName: 'SUM',
      parameterValues: {},
    },
    nestingDepth: 1,
    compiledFormula: 'SUM()',
    isOpen: true,
    targetCellRef: 'A1',
    pointSelectionParamIndex: null,
    activeSchema: {
      name: 'SUM',
      category: 'MATH',
      description: 'Adds all numbers in a range',
      returnType: 'NUMBER',
      syntaxTemplate: 'SUM(number1, [number2], ...)',
      parameters: [
        { id: 'number1', name: 'Number1', description: 'Primary range or value to sum', type: 'RANGE', isRequired: true, allowNestedFunction: true },
        { id: 'number2', name: 'Number2', description: 'Additional ranges or numbers to add', type: 'RANGE', isRequired: false, isVariadic: true, allowNestedFunction: true },
      ],
    },
    ...overrides,
  };
}

const defaultProps = {
  wizard: createWizardState(),
  setParameter: jest.fn(),
  enterNested: jest.fn(),
  enterExistingNested: jest.fn(),
  goBack: jest.fn(),
  startPointSelection: jest.fn(),
  cancelPointSelection: jest.fn(),
  closeWizard: jest.fn(),
  onApply: jest.fn(),
  onFunctionSelect: jest.fn(),
  targetRow: 0,
  targetCol: 0,
};

describe('FormulaWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when wizard is open', () => {
    render(<FormulaWizard {...defaultProps} />);
    expect(screen.getByText('Nested Formula Wizard')).toBeInTheDocument();
  });

  it('does not render when wizard is closed', () => {
    render(<FormulaWizard {...defaultProps} wizard={createWizardState({ isOpen: false })} />);
    expect(screen.queryByText('Nested Formula Wizard')).not.toBeInTheDocument();
  });

  it('shows function name in breadcrumb', () => {
    render(<FormulaWizard {...defaultProps} />);
    // Breadcrumb shows function name as a button
    const breadcrumbButton = screen.getByRole('button', { name: 'SUM' });
    expect(breadcrumbButton).toBeInTheDocument();
  });

  it('shows function description', () => {
    render(<FormulaWizard {...defaultProps} />);
    expect(screen.getByText('Adds all numbers in a range')).toBeInTheDocument();
  });

  it('renders parameter inputs', () => {
    render(<FormulaWizard {...defaultProps} />);
    expect(screen.getByText('Number1')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Primary range or value to sum')).toBeInTheDocument();
  });

  it('shows required indicator for required parameters', () => {
    render(<FormulaWizard {...defaultProps} />);
    // Required params have an asterisk
    const label = screen.getByText('Number1');
    expect(label.textContent).toContain('*');
  });

  it('calls setParameter when parameter value changes', () => {
    const setParameter = jest.fn();
    render(<FormulaWizard {...defaultProps} setParameter={setParameter} />);
    const input = screen.getByPlaceholderText('Primary range or value to sum');
    fireEvent.change(input, { target: { value: 'A1:A10' } });
    expect(setParameter).toHaveBeenCalledWith('number1', 'A1:A10');
  });

  it('calls startPointSelection when range picker is clicked', () => {
    const startPointSelection = jest.fn();
    render(<FormulaWizard {...defaultProps} startPointSelection={startPointSelection} />);
    const rangePickers = screen.getAllByTitle('Select range on grid');
    fireEvent.click(rangePickers[0]);
    expect(startPointSelection).toHaveBeenCalled();
  });

  it('shows POINT mode indicator when in point selection', () => {
    render(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'POINT_SELECTION', pointSelectionParamIndex: 0 })} />);
    expect(screen.getByText(/POINT mode:/)).toBeInTheDocument();
  });

  it('calls cancelPointSelection when cancel is clicked in POINT mode', () => {
    const cancelPointSelection = jest.fn();
    render(<FormulaWizard {...defaultProps} wizard={createWizardState({ state: 'POINT_SELECTION' })} cancelPointSelection={cancelPointSelection} />);
    // In POINT mode, the indicator has a "Cancel" link (not the button)
    const pointModeText = screen.getByText(/POINT mode:/);
    const cancelLink = pointModeText.querySelector('button') || pointModeText.nextElementSibling;
    if (cancelLink) {
      fireEvent.click(cancelLink);
    }
    expect(cancelPointSelection).toHaveBeenCalled();
  });

  it('calls onApply when Apply to Cell is clicked', () => {
    const onApply = jest.fn();
    render(<FormulaWizard {...defaultProps} onApply={onApply} wizard={createWizardState({ compiledFormula: 'SUM(A1:A10)' })} />);
    fireEvent.click(screen.getByText('Apply to Cell'));
    expect(onApply).toHaveBeenCalledWith('=SUM(A1:A10)');
  });

  it('calls closeWizard when close button is clicked', () => {
    const closeWizard = jest.fn();
    render(<FormulaWizard {...defaultProps} closeWizard={closeWizard} />);
    fireEvent.click(screen.getByTitle('Close wizard'));
    expect(closeWizard).toHaveBeenCalled();
  });

  it('shows nesting depth when nested', () => {
    const wizard = createWizardState({
      nestingDepth: 2,
      nodeStack: [
        { id: 'node_1', functionName: 'ROUND', parameterValues: {} },
        { id: 'node_2', parentId: 'node_1', functionName: 'SUM', parameterValues: {} },
      ],
      activeNode: { id: 'node_2', parentId: 'node_1', functionName: 'SUM', parameterValues: {} },
      activeSchema: {
        name: 'SUM',
        category: 'MATH',
        description: 'Adds all numbers in a range',
        returnType: 'NUMBER',
        syntaxTemplate: 'SUM(number1, [number2], ...)',
        parameters: [
          { id: 'number1', name: 'Number1', description: 'Primary range or value to sum', type: 'RANGE', isRequired: true, allowNestedFunction: true },
        ],
      },
    });
    render(<FormulaWizard {...defaultProps} wizard={wizard} />);
    expect(screen.getByText(/Nested depth: 2/)).toBeInTheDocument();
  });

  it('shows Back button when nested', () => {
    const wizard = createWizardState({ nestingDepth: 2 });
    render(<FormulaWizard {...defaultProps} wizard={wizard} />);
    expect(screen.getByText('← Back')).toBeInTheDocument();
  });

  it('calls goBack when Back button is clicked', () => {
    const goBack = jest.fn();
    const wizard = createWizardState({ nestingDepth: 2 });
    render(<FormulaWizard {...defaultProps} wizard={wizard} goBack={goBack} />);
    fireEvent.click(screen.getByText('← Back'));
    expect(goBack).toHaveBeenCalled();
  });

  it('shows circular reference warning when applicable', () => {
    const wizard = createWizardState({ compiledFormula: 'SUM(A1:A10)' });
    render(<FormulaWizard {...defaultProps} wizard={wizard} targetRow={0} targetCol={0} />);
    expect(screen.getByText(/circular dependency/)).toBeInTheDocument();
  });

  it('shows compiled formula in preview', () => {
    const wizard = createWizardState({ compiledFormula: 'SUM(A1:A10)' });
    render(<FormulaWizard {...defaultProps} wizard={wizard} />);
    expect(screen.getByText('=SUM(A1:A10)')).toBeInTheDocument();
  });

  it('shows Cancel button that calls closeWizard', () => {
    const closeWizard = jest.fn();
    render(<FormulaWizard {...defaultProps} closeWizard={closeWizard} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(closeWizard).toHaveBeenCalled();
  });

  it('shows nested function picker when f(x) button is clicked', () => {
    const enterNested = jest.fn();
    render(<FormulaWizard {...defaultProps} enterNested={enterNested} />);
    // Two params allow nested functions → two f(x) buttons
    const fxButtons = screen.getAllByTitle('Insert nested function');
    expect(fxButtons.length).toBeGreaterThanOrEqual(1);
    // Click the first f(x) — picker should appear with function list
    fireEvent.click(fxButtons[0]);
    // The picker renders available functions — verify one is shown
    expect(screen.getByText('AVERAGE')).toBeInTheDocument();
    // Clicking a function in the picker calls enterNested
    fireEvent.click(screen.getByText('AVERAGE'));
    expect(enterNested).toHaveBeenCalled();
  });

  it('shows no-parameters message for parameterless functions', () => {
    const wizard = createWizardState({
      activeSchema: {
        name: 'NOW',
        category: 'DATE',
        description: 'Returns the current date and time',
        returnType: 'ANY',
        syntaxTemplate: 'NOW()',
        parameters: [],
      },
    });
    render(<FormulaWizard {...defaultProps} wizard={wizard} />);
    expect(screen.getByText('This function takes no parameters.')).toBeInTheDocument();
  });

  it('navigates to parent when breadcrumb is clicked', () => {
    const goBack = jest.fn();
    const wizard = createWizardState({
      nestingDepth: 3,
      nodeStack: [
        { id: 'node_1', functionName: 'IF', parameterValues: {} },
        { id: 'node_2', parentId: 'node_1', functionName: 'ROUND', parameterValues: {} },
        { id: 'node_3', parentId: 'node_2', functionName: 'SUM', parameterValues: {} },
      ],
      activeNode: { id: 'node_3', parentId: 'node_2', functionName: 'SUM', parameterValues: {} },
    });
    render(<FormulaWizard {...defaultProps} wizard={wizard} goBack={goBack} />);
    // Click the IF breadcrumb (first in stack) — should call goBack twice
    const buttons = screen.getAllByRole('button', { name: 'IF' });
    fireEvent.click(buttons[0]);
    expect(goBack).toHaveBeenCalledTimes(2);
  });
});

describe('FormulaWizard - Imported Formula Display', () => {
  it('shows imported parameter values', () => {
    const wizard = createWizardState({
      activeNode: {
        id: 'node_1',
        functionName: 'SUM',
        parameterValues: {
          number1: { parameterId: 'number1', rawValue: 'B4:D4', isNestedFunction: false },
        },
      },
      compiledFormula: 'SUM(B4:D4)',
    });
    render(<FormulaWizard {...defaultProps} wizard={wizard} />);
    // The input should have the imported value
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(inputs[0].value).toBe('B4:D4');
  });

  it('shows nested function as clickable element', () => {
    const wizard = createWizardState({
      activeNode: {
        id: 'node_1',
        functionName: 'IF',
        parameterValues: {
          condition: { parameterId: 'condition', rawValue: 'A1>0', isNestedFunction: false },
          true_val: { parameterId: 'true_val', rawValue: '', isNestedFunction: true, nestedNodeId: 'node_2' },
        },
      },
      nodeMap: new Map<string, FormulaASTNode>([
        ['node_1', { id: 'node_1', functionName: 'IF', parameterValues: {
          condition: { parameterId: 'condition', rawValue: 'A1>0', isNestedFunction: false },
          true_val: { parameterId: 'true_val', rawValue: '', isNestedFunction: true, nestedNodeId: 'node_2' },
        } } as FormulaASTNode],
        ['node_2', { id: 'node_2', parentId: 'node_1', functionName: 'SUM', parameterValues: {
          number1: { parameterId: 'number1', rawValue: 'B4:D4', isNestedFunction: false },
        } } as FormulaASTNode],
      ]),
      compiledFormula: 'IF(A1>0, SUM(B4:D4), 0)',
      activeSchema: {
        name: 'IF',
        category: 'LOGICAL',
        description: 'Conditional: if true then A else B',
        returnType: 'ANY',
        syntaxTemplate: 'IF(condition, true_val, [false_val])',
        parameters: [
          { id: 'condition', name: 'Condition', description: 'Expression that evaluates to TRUE or FALSE', type: 'BOOLEAN', isRequired: true, allowNestedFunction: true },
          { id: 'true_val', name: 'True_val', description: 'Value returned when condition is TRUE', type: 'ANY', isRequired: true, allowNestedFunction: true },
          { id: 'false_val', name: 'False_val', description: 'Value returned when condition is FALSE', type: 'ANY', isRequired: false, allowNestedFunction: true },
        ],
      },
    });
    render(<FormulaWizard {...defaultProps} wizard={wizard} />);
    // The nested function should be shown as a clickable button
    const nestedButton = screen.getByText('SUM(B4:D4)');
    expect(nestedButton.tagName).toBe('BUTTON');
  });

  it('navigates into nested function when clicked', () => {
    const enterExistingNested = jest.fn();
    const wizard = createWizardState({
      activeNode: {
        id: 'node_1',
        functionName: 'IF',
        parameterValues: {
          true_val: { parameterId: 'true_val', rawValue: '', isNestedFunction: true, nestedNodeId: 'node_2' },
        },
      },
      nodeMap: new Map([
        ['node_2', { id: 'node_2', parentId: 'node_1', functionName: 'SUM', parameterValues: {
          number1: { parameterId: 'number1', rawValue: 'B4:D4', isNestedFunction: false },
        } }],
      ]),
      compiledFormula: 'IF(A1>0, SUM(B4:D4), 0)',
      activeSchema: {
        name: 'IF',
        category: 'LOGICAL',
        description: 'Conditional: if true then A else B',
        returnType: 'ANY',
        syntaxTemplate: 'IF(condition, true_val, [false_val])',
        parameters: [
          { id: 'condition', name: 'Condition', description: 'Expression that evaluates to TRUE or FALSE', type: 'BOOLEAN', isRequired: true, allowNestedFunction: true },
          { id: 'true_val', name: 'True_val', description: 'Value returned when condition is TRUE', type: 'ANY', isRequired: true, allowNestedFunction: true },
          { id: 'false_val', name: 'False_val', description: 'Value returned when condition is FALSE', type: 'ANY', isRequired: false, allowNestedFunction: true },
        ],
      },
    });
    render(<FormulaWizard {...defaultProps} wizard={wizard} enterExistingNested={enterExistingNested} />);
    // Click the nested function button
    const nestedButton = screen.getByText('SUM(B4:D4)');
    fireEvent.click(nestedButton);
    expect(enterExistingNested).toHaveBeenCalledWith('node_2');
  });
});

describe('FormulaWizard - Autocomplete Integration', () => {
  it('shows FunctionPicker when state is AUTOCOMPLETE', () => {
    const wizard = createWizardState({ state: 'AUTOCOMPLETE' });
    render(<FormulaWizard {...defaultProps} wizard={wizard} />);
    expect(screen.getByText('Choose a Function')).toBeInTheDocument();
  });

  it('calls onFunctionSelect when function is picked', () => {
    const onFunctionSelect = jest.fn();
    const wizard = createWizardState({ state: 'AUTOCOMPLETE' });
    render(<FormulaWizard {...defaultProps} wizard={wizard} onFunctionSelect={onFunctionSelect} />);
    fireEvent.click(screen.getByText('SUM'));
    expect(onFunctionSelect).toHaveBeenCalledWith('SUM');
  });

  it('calls closeWizard when FunctionPicker is closed', () => {
    const closeWizard = jest.fn();
    const wizard = createWizardState({ state: 'AUTOCOMPLETE' });
    render(<FormulaWizard {...defaultProps} wizard={wizard} closeWizard={closeWizard} />);
    fireEvent.click(screen.getByTitle('Close'));
    expect(closeWizard).toHaveBeenCalled();
  });
});

describe('FormulaWizard - Variadic Parameters (B-010)', () => {
  it('renders extra variadic parameters when present', () => {
    const wizard = createWizardState({
      activeNode: {
        id: 'node_1',
        functionName: 'SUM',
        parameterValues: {
          number1: { parameterId: 'number1', rawValue: 'A1:A3', isNestedFunction: false },
          number2: { parameterId: 'number2', rawValue: 'D3:D7', isNestedFunction: false },
          number2_1: { parameterId: 'number2_1', rawValue: 'F1:F5', isNestedFunction: false },
        },
      },
      compiledFormula: 'SUM(A1:A3, D3:D7, F1:F5)',
    });
    render(<FormulaWizard {...defaultProps} wizard={wizard} />);
    // Should render the extra variadic parameter as "Number3"
    expect(screen.getByText('Number3')).toBeInTheDocument();
    // Should have 3 textboxes (Number1, Number2, Number3)
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(inputs.length).toBe(3);
    expect(inputs[0].value).toBe('A1:A3');
    expect(inputs[1].value).toBe('D3:D7');
    expect(inputs[2].value).toBe('F1:F5');
  });

  it('shows Add parameter button for variadic functions', () => {
    render(<FormulaWizard {...defaultProps} />);
    expect(screen.getByText('+ Add parameter')).toBeInTheDocument();
  });

  it('Add parameter button adds a new variadic parameter', () => {
    const setParameter = jest.fn();
    render(<FormulaWizard {...defaultProps} setParameter={setParameter} />);
    fireEvent.click(screen.getByText('+ Add parameter'));
    // Should call setParameter with the next variadic ID
    expect(setParameter).toHaveBeenCalledWith('number2_1', '');
  });

  it('does not show Add parameter button for non-variadic functions', () => {
    const wizard = createWizardState({
      activeSchema: {
        name: 'IF',
        category: 'LOGICAL',
        description: 'Conditional: if true then A else B',
        returnType: 'ANY',
        syntaxTemplate: 'IF(condition, true_val, [false_val])',
        parameters: [
          { id: 'condition', name: 'Condition', description: 'Expression that evaluates to TRUE or FALSE', type: 'BOOLEAN', isRequired: true, allowNestedFunction: true },
          { id: 'true_val', name: 'True_val', description: 'Value returned when condition is TRUE', type: 'ANY', isRequired: true, allowNestedFunction: true },
          { id: 'false_val', name: 'False_val', description: 'Value returned when condition is FALSE', type: 'ANY', isRequired: false, allowNestedFunction: true },
        ],
      },
    });
    render(<FormulaWizard {...defaultProps} wizard={wizard} />);
    expect(screen.queryByText('+ Add parameter')).not.toBeInTheDocument();
  });
});
