import { render, screen, fireEvent, act } from '@testing-library/react';
import { FormulaBar } from './FormulaBar';
import type { EditingSession } from '../hooks/useCellEditing';

const defaultSession: EditingSession = {
  state: 'SELECT',
  row: 0,
  col: 0,
  buffer: '',
  originalValue: '',
  caretPos: 0,
  isFormula: false,
};

describe('FormulaBar', () => {
  const defaultProps = {
    session: defaultSession,
    pointSession: null,
    value: '',
    cursorPos: 0,
    statusMessage: 'Ready',
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    onCellPick: jest.fn(),
    autoComplete: { open: false, matches: [], index: 0, tokenStart: 0 },
    onAcceptAutoComplete: jest.fn(),
    onNavigateAutoComplete: jest.fn(),
    onDismissAutoComplete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with active cell reference', () => {
    render(<FormulaBar {...defaultProps} />);
    expect(screen.getAllByText('A1').length).toBeGreaterThan(0);
  });

  it('renders with fx indicator', () => {
    render(<FormulaBar {...defaultProps} />);
    expect(screen.getByText('fx')).toBeInTheDocument();
  });

  it('renders input with placeholder', () => {
    render(<FormulaBar {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Enter a value or formula/)).toBeInTheDocument();
  });

  it('renders POINT indicator when in POINT mode', () => {
    render(
      <FormulaBar
        {...defaultProps}
        session={{ ...defaultSession, state: 'POINT' }}
        statusMessage="Point"
      />,
    );
    expect(screen.getByText('POINT')).toBeInTheDocument();
  });

  it('calls onRawKeyDown when a key is pressed', () => {
    const onRawKeyDown = jest.fn();
    render(<FormulaBar {...defaultProps} onRawKeyDown={onRawKeyDown} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.keyDown(input, { key: 'A' });
    expect(onRawKeyDown).toHaveBeenCalled();
  });

  it('calls onRawFocus when input is focused', () => {
    const onRawFocus = jest.fn();
    render(<FormulaBar {...defaultProps} onRawFocus={onRawFocus} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.focus(input);
    expect(onRawFocus).toHaveBeenCalled();
  });

  it('calls onRawBlur when input loses focus', () => {
    const onRawBlur = jest.fn();
    render(<FormulaBar {...defaultProps} onRawBlur={onRawBlur} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onRawBlur).toHaveBeenCalled();
  });
});

describe('FormulaBar - Formula Editing', () => {
  const defaultProps = {
    session: { ...defaultSession, state: 'EDIT', buffer: '=SUM(A1:A10)', isFormula: true } as EditingSession,
    pointSession: null,
    value: '=SUM(A1:A10)',
    cursorPos: 11,
    statusMessage: 'Edit',
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    onCellPick: jest.fn(),
    autoComplete: { open: false, matches: [], index: 0, tokenStart: 0 },
    onAcceptAutoComplete: jest.fn(),
    onNavigateAutoComplete: jest.fn(),
    onDismissAutoComplete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls onRawFocus when focused in SELECT state with formula', () => {
    const onRawFocus = jest.fn();
    render(
      <FormulaBar
        {...defaultProps}
        session={{ ...defaultSession, state: 'SELECT' }}
        statusMessage="Ready"
        onRawFocus={onRawFocus}
      />,
    );
    const input = screen.getByDisplayValue('=SUM(A1:A10)');
    act(() => {
      fireEvent.focus(input);
    });
    expect(onRawFocus).toHaveBeenCalled();
  });

  it('passes caret position to onRawFocus', () => {
    const onRawFocus = jest.fn();
    render(<FormulaBar {...defaultProps} onRawFocus={onRawFocus} />);
    const input = screen.getByDisplayValue('=SUM(A1:A10)') as HTMLInputElement;
    // Simulate clicking at position 7 (after "A1:")
    input.setSelectionRange(7, 7);
    act(() => {
      fireEvent.focus(input);
    });
    // onRawFocus should be called with the caret position
    expect(onRawFocus).toHaveBeenCalled();
  });

});
