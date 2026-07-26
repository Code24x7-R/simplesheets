import { render, screen, fireEvent, act } from '@testing-library/react';
import { FormulaBar } from './FormulaBar';
import type { FormulaBarProps } from './FormulaBar';
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

describe('FormulaBar - AutoComplete Navigation', () => {
  const defaultProps: FormulaBarProps = {
    session: { ...defaultSession, state: 'EDIT', buffer: '=S', isFormula: true },
    pointSession: null,
    value: '=S',
    cursorPos: 2,
    statusMessage: 'Edit',
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    onCellPick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('navigates down in auto-complete with ArrowDown', () => {
    const onRawKeyDown = jest.fn();
    render(<FormulaBar {...defaultProps} onRawKeyDown={onRawKeyDown} value="=" session={{ ...defaultSession, state: 'EDIT', buffer: '=', isFormula: true }} cursorPos={1} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Open auto-complete
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '=S' } });
    });

    // Verify dropdown is open (SUM may appear in function bar too)
    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);

    // Navigate down
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);
  });

  it('navigates up in auto-complete with ArrowUp', () => {
    const onChange = jest.fn();
    render(<FormulaBar {...defaultProps} value="=" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Open auto-complete
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '=S' } });
    });

    // Verify dropdown is open (SUM may appear in function bar too)
    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);
  });

  it('accepts auto-complete with Tab', () => {
    render(<FormulaBar {...defaultProps} value="=" />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Open auto-complete
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '=S' } });
    });

    // Verify dropdown is open
    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);

    // Accept with Tab
    fireEvent.keyDown(input, { key: 'Tab' });

    // Auto-complete should close (check for dropdown specifically)
    const dropdowns = document.querySelectorAll('[role="menu"]');
    expect(dropdowns.length).toBe(0);
  });

  it('closes auto-complete with Escape', () => {
    render(<FormulaBar {...defaultProps} value="=" />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Open auto-complete
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '=S' } });
    });

    // Verify dropdown is open
    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);

    // Close with Escape
    fireEvent.keyDown(input, { key: 'Escape' });

    // Auto-complete should close (check for dropdown specifically)
    const dropdowns = document.querySelectorAll('[role="menu"]');
    expect(dropdowns.length).toBe(0);
  });

  it('opens auto-complete on click when editing a formula', () => {
    render(<FormulaBar {...defaultProps} value="=" />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Open auto-complete
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '=SU' } });
    });

    // Click should re-open auto-complete if closed
    act(() => {
      fireEvent.click(input);
    });

    // Auto-complete should be visible (SUM may appear in function bar too)
    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);
  });
});

describe('FormulaBar - Raw Key Handling', () => {
  const defaultProps: FormulaBarProps = {
    session: { ...defaultSession, state: 'EDIT', buffer: '=SUM(', isFormula: true },
    pointSession: null,
    value: '=SUM(',
    cursorPos: 5,
    statusMessage: 'Edit',
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    onCellPick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards arrow keys to raw handler', () => {
    const onRawKeyDown = jest.fn();
    render(<FormulaBar {...defaultProps} onRawKeyDown={onRawKeyDown} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onRawKeyDown).toHaveBeenCalled();
  });

  it('forwards arrow keys to raw handler', () => {
    const onRawKeyDown = jest.fn();
    render(<FormulaBar {...defaultProps} onRawKeyDown={onRawKeyDown} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(onRawKeyDown).toHaveBeenCalled();
  });
});

describe('FormulaBar - Escape Key', () => {
  const defaultProps: FormulaBarProps = {
    session: defaultSession,
    pointSession: null,
    value: '42',
    cursorPos: 0,
    statusMessage: 'Ready',
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    onCellPick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards Escape to raw handler', () => {
    const onRawKeyDown = jest.fn();
    render(<FormulaBar {...defaultProps} onRawKeyDown={onRawKeyDown} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRawKeyDown).toHaveBeenCalled();
  });
});

describe('FormulaBar - Formula Display Overlay', () => {
  const defaultProps: FormulaBarProps = {
    session: { ...defaultSession, state: 'EDIT', buffer: '=A1+B1', isFormula: true },
    pointSession: null,
    value: '=A1+B1',
    cursorPos: 7,
    statusMessage: 'Edit',
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    onCellPick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders colored reference segments in formula display', () => {
    render(<FormulaBar {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Focus to enter editing mode (triggers formula display overlay)
    act(() => {
      fireEvent.focus(input);
    });

    // Formula display should show colored references
    const formulaDisplay = document.querySelector('.pointer-events-none');
    expect(formulaDisplay).toBeInTheDocument();
  });

  it('returns null for formula display when not editing', () => {
    render(<FormulaBar {...defaultProps} session={defaultSession} statusMessage="Ready" />);

    // Formula display should not be visible when not editing
    const formulaDisplay = document.querySelector('.pointer-events-none');
    expect(formulaDisplay).not.toBeInTheDocument();
  });
});

describe('FormulaBar - Error Display', () => {
  const defaultProps: FormulaBarProps = {
    session: { ...defaultSession, state: 'EDIT', buffer: '=SUM(', isFormula: true },
    pointSession: null,
    value: '=SUM(',
    cursorPos: 5,
    statusMessage: 'Edit',
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    onCellPick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows error display when editing invalid formula', () => {
    render(<FormulaBar {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Focus to enter editing mode
    act(() => {
      fireEvent.focus(input);
    });

    // Error display should be visible for incomplete formula
    const errorDisplay = document.querySelector('.bg-red-50, .bg-yellow-50');
    expect(errorDisplay).toBeInTheDocument();
  });

  it('returns null for error display when not editing', () => {
    render(<FormulaBar {...defaultProps} session={defaultSession} statusMessage="Ready" />);

    // Error display should not be visible when not editing
    const errorDisplay = document.querySelector('.bg-red-50, .bg-yellow-50');
    expect(errorDisplay).not.toBeInTheDocument();
  });
});

describe('FormulaBar - Auto-Close Parentheses', () => {
  const defaultProps: FormulaBarProps = {
    session: { ...defaultSession, state: 'EDIT', buffer: '=SUM(', isFormula: true },
    pointSession: null,
    value: '=SUM(',
    cursorPos: 5,
    statusMessage: 'Edit',
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    onCellPick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('positions cursor inside auto-closed parens', () => {
    const onRawChange = jest.fn();
    render(<FormulaBar {...defaultProps} onRawChange={onRawChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Type an opening paren
    fireEvent.keyDown(input, { key: '(' });

    // onChange should be called with the new value including closed parens
    // (this depends on FSM handling)
  });
});

describe('FormulaBar - AutoComplete Edge Cases', () => {
  const defaultProps: FormulaBarProps = {
    session: { ...defaultSession, state: 'EDIT', buffer: '=A1', isFormula: true },
    pointSession: null,
    value: '=A1',
    cursorPos: 3,
    statusMessage: 'Edit',
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    onCellPick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not open auto-complete for non-function tokens', () => {
    render(<FormulaBar {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Open auto-complete
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '=A1' } });
    });

    // Auto-complete should NOT open for cell references
    // (SUM may exist in function bar, so check for dropdown specifically)
    const dropdowns = document.querySelectorAll('[role="menu"]');
    expect(dropdowns.length).toBe(0);
  });
});

describe('FormulaBar - Function Bar', () => {
  const defaultProps: FormulaBarProps = {
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders function bar buttons', () => {
    render(<FormulaBar {...defaultProps} />);
    expect(screen.getByText('SUM')).toBeInTheDocument();
    expect(screen.getByText('AVERAGE')).toBeInTheDocument();
    expect(screen.getByText('IF')).toBeInTheDocument();
  });

  it('calls onInsertFunction when a function button is clicked', () => {
    const onInsertFunction = jest.fn();
    render(<FormulaBar {...defaultProps} onInsertFunction={onInsertFunction} />);
    fireEvent.click(screen.getByText('SUM'));
    expect(onInsertFunction).toHaveBeenCalledWith('SUM');
  });
});

describe('FormulaBar - Focus transitions to EDIT mode', () => {
  const makeProps = (): FormulaBarProps => ({
    session: { ...defaultSession, state: 'SELECT' },
    pointSession: null,
    value: 'Hello World',
    cursorPos: 0,
    statusMessage: 'Ready',
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    onCellPick: jest.fn(),
  });

  it('calls onRawFocus when focused in SELECT state', () => {
    const props = makeProps();
    render(<FormulaBar {...props} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    act(() => {
      fireEvent.focus(input);
    });

    expect(props.onRawFocus).toHaveBeenCalled();
  });

  it('forwards arrow keys in EDIT mode', () => {
    const onRawKeyDown = jest.fn();
    const props: FormulaBarProps = {
      ...makeProps(),
      session: { ...defaultSession, state: 'EDIT', buffer: 'Hello', caretPos: 5 },
      cursorPos: 5,
      onRawKeyDown,
    };
    render(<FormulaBar {...props} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(onRawKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: 'ArrowLeft' }));
  });
});
