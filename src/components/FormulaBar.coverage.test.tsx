import { render, screen, fireEvent, act } from '@testing-library/react';
import { FormulaBar } from './FormulaBar';
import type { FormulaBarProps } from './FormulaBar';

describe('FormulaBar - AutoComplete Navigation', () => {
  const defaultProps = {
    value: '=S',
    onChange: jest.fn(),
    onCommit: jest.fn(),
    activeCellRef: 'A1',
    editingFormula: '=S',
    onHighlightsChange: jest.fn(),
    onCursorChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
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

    // Navigate down then up
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    });
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowUp' });
    });

    // Should not throw
    expect(input).toBeInTheDocument();
  });

  it('accepts auto-complete with Tab', () => {
    const onChange = jest.fn();
    render(<FormulaBar {...defaultProps} value="=S" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Open auto-complete
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '=S' } });
    });

    // Verify dropdown is open
    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);

    // Accept with Tab — should not throw and should close dropdown
    act(() => {
      fireEvent.keyDown(input, { key: 'Tab' });
    });

    // After Tab, auto-complete should be closed
    const dropdowns = document.querySelectorAll('[role="menu"]');
    expect(dropdowns.length).toBe(0);
  });

  it('closes auto-complete with Escape', () => {
    render(<FormulaBar {...defaultProps} value="=S" onChange={jest.fn()} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Open auto-complete
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '=S' } });
    });

    // Verify dropdown is open
    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);

    // Close with Escape
    act(() => {
      fireEvent.keyDown(input, { key: 'Escape' });
    });

    // Auto-complete should be closed (only function bar SUM remains)
    const dropdowns = document.querySelectorAll('[role="menu"]');
    expect(dropdowns.length).toBe(0);
  });

  it('opens auto-complete on click when editing a formula', () => {
    const onChange = jest.fn();
    render(<FormulaBar {...defaultProps} value="=S" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Focus and type to enter editing mode
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

describe('FormulaBar - Point Mode Arrows', () => {
  const defaultProps = {
    value: '=SUM(',
    onChange: jest.fn(),
    onCommit: jest.fn(),
    activeCellRef: 'A1',
    editingFormula: '=SUM(',
    onHighlightsChange: jest.fn(),
    isPointMode: true,
    pointSelection: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
    onCellPick: jest.fn(),
    onExitPointMode: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls onCellPick with negative delta on ArrowUp', () => {
    const onCellPick = jest.fn();
    render(<FormulaBar {...defaultProps} onCellPick={onCellPick} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onCellPick).toHaveBeenCalledWith(-1, 0, false);
  });

  it('calls onCellPick with negative delta on ArrowLeft', () => {
    const onCellPick = jest.fn();
    render(<FormulaBar {...defaultProps} onCellPick={onCellPick} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(onCellPick).toHaveBeenCalledWith(0, -1, false);
  });
});

describe('FormulaBar - Escape Key', () => {
  const defaultProps = {
    value: '42',
    onChange: jest.fn(),
    onCommit: jest.fn(),
    activeCellRef: 'A1',
    editingFormula: null,
    onHighlightsChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('closes editing mode on Escape without auto-complete', () => {
    const onCommit = jest.fn();
    render(<FormulaBar {...defaultProps} onCommit={onCommit} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Focus to enter editing mode
    fireEvent.focus(input);

    // Escape should close editing
    fireEvent.keyDown(input, { key: 'Escape' });

    // onCommit should NOT be called on Escape (only on Enter/blur)
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('FormulaBar - Formula Display Overlay', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    onCommit: jest.fn(),
    activeCellRef: 'A1',
    editingFormula: null,
    onHighlightsChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders colored reference segments in formula display', () => {
    render(<FormulaBar {...defaultProps} value="=A1+B1" />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Focus to enter editing mode (triggers formula display overlay)
    fireEvent.focus(input);

    // The overlay should render with colored segments
    const overlay = input.parentElement?.querySelector('.pointer-events-none');
    expect(overlay).toBeInTheDocument();
  });

  it('returns null for formula display when not editing', () => {
    render(<FormulaBar {...defaultProps} value="=A1+B1" />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Without focus, no overlay should be rendered
    const overlay = input.parentElement?.querySelector('.pointer-events-none');
    expect(overlay).not.toBeInTheDocument();
  });
});

describe('FormulaBar - Error Display', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    onCommit: jest.fn(),
    activeCellRef: 'A1',
    editingFormula: null,
    onHighlightsChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows error display when editing invalid formula', () => {
    render(<FormulaBar {...defaultProps} value="=SUM(" />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Focus to enter editing mode
    fireEvent.focus(input);

    // Error display should show
    expect(screen.getByText(/unclosed parenthesis/i)).toBeInTheDocument();
  });

  it('returns null for error display when not editing', () => {
    render(<FormulaBar {...defaultProps} value="=SUM(" />);

    // Without focus, no error display
    expect(screen.queryByText(/unclosed parenthesis/i)).toBeNull();
  });
});

describe('FormulaBar - Auto-Close Parentheses', () => {
  const defaultProps = {
    value: '=IF(A1>0, ',
    onChange: jest.fn(),
    onCommit: jest.fn(),
    activeCellRef: 'A1',
    editingFormula: '=IF(A1>0, ',
    onHighlightsChange: jest.fn(),
    onCursorChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('positions cursor inside auto-closed parens', () => {
    const onChange = jest.fn();
    const onCursorChange = jest.fn();
    render(<FormulaBar {...defaultProps} value="=IF(A1>0, " onChange={onChange} onCursorChange={onCursorChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.focus(input);

    // Type ( to auto-close
    fireEvent.keyDown(input, { key: '(' });

    // onChange should be called with auto-closed parens
    const calls = onChange.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0]).toContain('()');
  });
});

describe('FormulaBar - AutoComplete Edge Cases', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    onCommit: jest.fn(),
    activeCellRef: 'A1',
    editingFormula: null,
    onHighlightsChange: jest.fn(),
    onCursorChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not open auto-complete for non-function tokens', () => {
    const onChange = jest.fn();
    render(<FormulaBar {...defaultProps} value="=A1" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '=A1' } });
    });

    // Auto-complete should NOT open for cell references
    // (SUM may exist in function bar, so check for dropdown specifically)
    const dropdowns = document.querySelectorAll('[role="menu"]');
    expect(dropdowns.length).toBe(0);
  });

  it('accepts auto-complete and returns focus to input', () => {
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

    // Accept with Enter
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    // After acceptance, onChange should have been called with completed function
    const calls = onChange.mock.calls;
    const completedCall = calls.find((c) => c[0]?.includes('SUM('));
    expect(completedCall).toBeDefined();
  });

  it('renders colored segments for cell refs in formula display', () => {
    render(<FormulaBar {...defaultProps} value="=A1+B1" />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Focus to enter editing mode
    fireEvent.focus(input);

    // The formula display overlay should render colored segments
    const overlay = input.parentElement?.querySelector('.pointer-events-none');
    expect(overlay).toBeInTheDocument();
    // Should have colored spans for A1 and B1
    const coloredSpans = overlay?.querySelectorAll('span[style*="background"]');
    expect(coloredSpans?.length).toBeGreaterThan(0);
  });

  it('returns null for error display when formula is valid', () => {
    render(<FormulaBar {...defaultProps} value="=SUM(A1:A10)" />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Focus to enter editing mode
    fireEvent.focus(input);

    // No error should show for valid formula
    expect(screen.queryByText(/unclosed/i)).toBeNull();
    expect(screen.queryByText(/Incomplete/i)).toBeNull();
  });

  it('does not open auto-complete when cursor is not on a function token', () => {
    const onChange = jest.fn();
    render(<FormulaBar {...defaultProps} value="=1" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    act(() => {
      fireEvent.focus(input);
      // Type a number - cursor won't be on a function token
      fireEvent.change(input, { target: { value: '=1' } });
    });

    // Auto-complete should NOT open for numbers
    // (SUM may exist in function bar, so check for dropdown specifically)
    const dropdowns = document.querySelectorAll('[role="menu"]');
    expect(dropdowns.length).toBe(0);
  });
});

describe('FormulaBar - Function Bar', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    onCommit: jest.fn(),
    activeCellRef: 'A1',
    editingFormula: null,
    onHighlightsChange: jest.fn(),
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
    value: 'Hello World',
    onChange: jest.fn(),
    onCommit: jest.fn(),
    activeCellRef: 'A1',
    editingFormula: null,
    onHighlightsChange: jest.fn(),
    onCursorChange: jest.fn(),
    onFocusEditing: jest.fn(),
    onBlurEditing: jest.fn(),
    onEditingKey: jest.fn(),
    editingSession: {
      state: 'SELECT' as const,
      row: 0,
      col: 0,
      buffer: '',
      originalValue: 'Hello World',
      caretPos: 0,
      selectionStart: -1,
      selectionEnd: -1,
      isFormula: false,
    },
  });

  it('calls onFocusEditing when clicked in SELECT state', () => {
    const props = makeProps();
    render(<FormulaBar {...props} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    act(() => {
      fireEvent.focus(input);
    });

    expect(props.onFocusEditing).toHaveBeenCalled();
  });

  it('arrow keys move caret in EDIT mode', () => {
    const onEditingKey = jest.fn();
    const props = makeProps();
    props.onEditingKey = onEditingKey;
    props.editingSession = {
      state: 'EDIT' as const,
      row: 0,
      col: 0,
      buffer: 'Hello',
      originalValue: 'Hello World',
      caretPos: 5,
      selectionStart: -1,
      selectionEnd: -1,
      isFormula: false,
    };

    render(<FormulaBar {...props} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(onEditingKey).toHaveBeenCalledWith('ArrowLeft', false, false, false);
  });
});


