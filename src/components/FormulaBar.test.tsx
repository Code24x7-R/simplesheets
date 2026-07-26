import { render, screen, fireEvent, act } from '@testing-library/react';
import { FormulaBar } from './FormulaBar';

describe('FormulaBar', () => {
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

  it('renders with active cell reference', () => {
    render(<FormulaBar {...defaultProps} activeCellRef="B2" />);
    // Use getAllByText since "B2" might appear in multiple places
    expect(screen.getAllByText('B2').length).toBeGreaterThan(0);
  });

  it('renders with fx indicator', () => {
    render(<FormulaBar {...defaultProps} />);
    expect(screen.getByText('fx')).toBeInTheDocument();
  });

  it('renders input with placeholder', () => {
    render(<FormulaBar {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    expect(input).toBeInTheDocument();
  });

  it('displays the current value', () => {
    render(<FormulaBar {...defaultProps} value="=SUM(A1:A10)" />);
    const input = screen.getByDisplayValue('=SUM(A1:A10)') as HTMLInputElement;
    expect(input.value).toBe('=SUM(A1:A10)');
  });

  it('calls onChange when typing', () => {
    render(<FormulaBar {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.change(input, { target: { value: '=A1' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('=A1');
  });

  it('calls onCommit on blur', () => {
    render(<FormulaBar {...defaultProps} value="42" />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.blur(input);
    expect(defaultProps.onCommit).toHaveBeenCalledWith('42');
  });

  it('calls onCommit on Enter key', () => {
    render(<FormulaBar {...defaultProps} value="=A1+1" />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onCommit).toHaveBeenCalledWith('=A1+1');
  });

  it('does not call onCommit on other keys', () => {
    render(<FormulaBar {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(defaultProps.onCommit).not.toHaveBeenCalled();
  });

  it('calls onHighlightsChange when formula changes', () => {
    render(<FormulaBar {...defaultProps} value="=A1+B1" />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Focus to enter editing mode
    fireEvent.focus(input);
    // Trigger highlight computation
    fireEvent.change(input, { target: { value: '=A1+B1+C1' } });

    expect(defaultProps.onHighlightsChange).toHaveBeenCalled();
  });

  it('does not emit highlights for non-formula values', () => {
    render(<FormulaBar {...defaultProps} value="hello" />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'world' } });

    // Should be called with empty array for non-formulas
    expect(defaultProps.onHighlightsChange).toHaveBeenCalledWith([]);
  });

  it('emits highlights for formula when not editing (via editingFormula prop)', () => {
    const highlightFn = jest.fn();
    render(
      <FormulaBar
        {...defaultProps}
        value=""
        editingFormula="=SUM(A1:A10)"
        onHighlightsChange={highlightFn}
      />,
    );

    // Should have been called with highlight ranges
    expect(highlightFn).toHaveBeenCalled();
  });

  it('handles empty formula gracefully', () => {
    render(<FormulaBar {...defaultProps} value="" />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.focus(input);
    // No errors should occur
    expect(input).toBeInTheDocument();
  });

  it('handles invalid formula gracefully', () => {
    render(<FormulaBar {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '=INVALID(' } });
    // Should not throw
    expect(input).toBeInTheDocument();
  });

  it('displays colored references for formula', () => {
    render(<FormulaBar {...defaultProps} value="=A1+B1" />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.focus(input);

    // The colored overlay should be rendered
    // Check that the container has the reference spans
    const container = input.parentElement;
    expect(container?.querySelector('.pointer-events-null, .pointer-events-none')).toBeInTheDocument();
  });
});

describe('FormulaBar Auto-Complete', () => {
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

  it('shows auto-complete when typing a function name', () => {
    const onChange = jest.fn();
    render(<FormulaBar {...defaultProps} value="=" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '=S' } });
    });

    // Auto-complete dropdown should be visible (multiple 'SUM' may exist due to function bar)
    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);
  });

  it('filters auto-complete as user types more', () => {
    const onChange = jest.fn();
    render(<FormulaBar {...defaultProps} value="=SU" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '=SUM' } });
    });

    // Should show SUM-related functions (may appear in function bar too)
    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SUMIF').length).toBeGreaterThan(0);
  });

  it('does not show auto-complete for non-function tokens', () => {
    const onChange = jest.fn();
    render(<FormulaBar {...defaultProps} value="=A1" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '=A1' } });
    });

    // The auto-complete dropdown should not be open
    // (SUM may exist in the function bar, but not in a dropdown)
    const dropdown = document.querySelector('.menu-dropdown');
    expect(dropdown).toBeNull();
  });

  it('accepts auto-complete on Tab', () => {
    const onChange = jest.fn();
    const onCommit = jest.fn();
    render(<FormulaBar {...defaultProps} value="=" onChange={onChange} onCommit={onCommit} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '=S' } });
    });

    // Tab to accept the first suggestion
    act(() => {
      fireEvent.keyDown(input, { key: 'Tab' });
    });

    // onChange should have been called with the completed function
    const calls = onChange.mock.calls;
    const completedCall = calls.find((call) => call[0]?.includes('SUM('));
    expect(completedCall).toBeDefined();
  });

  it('shows function signature in dropdown', () => {
    const onChange = jest.fn();
    render(<FormulaBar {...defaultProps} value="=" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '=IF' } });
    });

    // Should show the signature text
    expect(screen.getByText(/IF\(condition/)).toBeInTheDocument();
  });

  it('dismisses auto-complete on Escape', () => {
    const onChange = jest.fn();
    render(<FormulaBar {...defaultProps} value="=" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '=S' } });
    });

    // Verify dropdown is open (check for a function that appears in the dropdown)
    // 'SIN' is in the first 8 results for 'S' query
    const matches = screen.getAllByText('SIN');
    expect(matches.length).toBeGreaterThan(0);

    // Escape to dismiss
    act(() => {
      fireEvent.keyDown(input, { key: 'Escape' });
    });

    // After escape, the dropdown should be gone
    expect(screen.queryByText('SIN')).toBeNull();
  });
});

describe('FormulaBar Validation Display', () => {
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

  it('shows error for unclosed parenthesis', () => {
    const onChange = jest.fn();
    render(<FormulaBar {...defaultProps} value="=SUM(A1:A10" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.focus(input);

    // Error message should be visible
    expect(screen.getByText(/unclosed parenthesis/i)).toBeInTheDocument();
  });

  it('shows incomplete warning for trailing operator', () => {
    const onChange = jest.fn();
    render(<FormulaBar {...defaultProps} value="=A1+" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.focus(input);

    // Incomplete warning should be visible
    expect(screen.getByText(/Incomplete formula/i)).toBeInTheDocument();
  });

  it('does not show errors when not editing', () => {
    render(<FormulaBar {...defaultProps} value="=SUM(A1:A10" />);
    // No focus — no error display
    expect(screen.queryByText(/unclosed parenthesis/i)).toBeNull();
  });

  it('shows no errors for valid formula', () => {
    const onChange = jest.fn();
    render(<FormulaBar {...defaultProps} value="=SUM(A1:A10)" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.focus(input);

    expect(screen.queryByText(/unclosed/i)).toBeNull();
    expect(screen.queryByText(/Incomplete/i)).toBeNull();
  });
});

describe('FormulaBar Highlight Edge Cases', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    onCommit: jest.fn(),
    activeCellRef: 'A1',
    editingFormula: null,
    onHighlightsChange: jest.fn(),
  };

  it('highlights numbers and strings in formulas', () => {
    const highlightFn = jest.fn();
    render(
      <FormulaBar
        {...defaultProps}
        value="=A1+42+hello"
        editingFormula="=A1+42+hello"
        onHighlightsChange={highlightFn}
      />,
    );
    // Should compute highlights (only cell refs get highlighted, numbers/strings don't)
    expect(highlightFn).toHaveBeenCalled();
  });

  it('highlights nested function arguments', () => {
    const highlightFn = jest.fn();
    render(
      <FormulaBar
        {...defaultProps}
        value="=SUM(A1, B1, C1)"
        editingFormula="=SUM(A1, B1, C1)"
        onHighlightsChange={highlightFn}
      />,
    );
    expect(highlightFn).toHaveBeenCalled();
  });

  it('highlights unary expressions', () => {
    const highlightFn = jest.fn();
    render(
      <FormulaBar
        {...defaultProps}
        value="=-A1"
        editingFormula="=-A1"
        onHighlightsChange={highlightFn}
      />,
    );
    expect(highlightFn).toHaveBeenCalled();
  });
});

describe('FormulaBar Point Mode', () => {
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

  it('shows POINT indicator when in point mode', () => {
    render(<FormulaBar {...defaultProps} />);
    expect(screen.getByText('POINT')).toBeInTheDocument();
  });

  it('calls onCellPick with delta on arrow key', () => {
    const onCellPick = jest.fn();
    render(<FormulaBar {...defaultProps} onCellPick={onCellPick} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onCellPick).toHaveBeenCalledWith(1, 0, false);

    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(onCellPick).toHaveBeenCalledWith(0, 1, false);
  });

  it('passes shiftKey to onCellPick', () => {
    const onCellPick = jest.fn();
    render(<FormulaBar {...defaultProps} onCellPick={onCellPick} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true });
    expect(onCellPick).toHaveBeenCalledWith(1, 0, true);
  });

  it('calls onExitPointMode on Enter', () => {
    const onExitPointMode = jest.fn();
    render(<FormulaBar {...defaultProps} onExitPointMode={onExitPointMode} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onExitPointMode).toHaveBeenCalled();
  });

  it('calls onExitPointMode on Escape', () => {
    const onExitPointMode = jest.fn();
    render(<FormulaBar {...defaultProps} onExitPointMode={onExitPointMode} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onExitPointMode).toHaveBeenCalled();
  });

  it('does not show POINT indicator when not in point mode', () => {
    render(<FormulaBar {...defaultProps} isPointMode={false} />);
    expect(screen.queryByText('POINT')).toBeNull();
  });
});

describe('FormulaBar Auto-Close Parentheses', () => {
  const defaultProps = {
    value: '=SUM(',
    onChange: jest.fn(),
    onCommit: jest.fn(),
    activeCellRef: 'A1',
    editingFormula: '=SUM(',
    onHighlightsChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('auto-closes parenthesis when typing (', () => {
    const onChange = jest.fn();
    render(<FormulaBar {...defaultProps} value="=IF(A1>0, " onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.focus(input);

    // Simulate typing (
    fireEvent.keyDown(input, { key: '(' });

    // onChange should have been called with auto-closed parens
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(lastCall[0]).toContain('()');
  });

  it('skips over existing closing paren when typing )', () => {
    const onChange = jest.fn();
    render(<FormulaBar {...defaultProps} value="=SUM()" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.focus(input);

    // Position cursor at position 5 (between the parens: =SUM|())
    (input as HTMLInputElement).setSelectionRange(5, 5);

    // Typing ) should not add another )
    fireEvent.keyDown(input, { key: ')' });

    // onChange should NOT have been called with extra )
    const lastOnChange = onChange.mock.calls[onChange.mock.calls.length - 1];
    if (lastOnChange) {
      // If onChange was called, it shouldn't have double parens
      expect(lastOnChange[0]).not.toContain('())');
    }
  });
});

describe('FormulaBar Focus Editing (onFocusEditing)', () => {
  const defaultProps = {
    value: '=SUM(A1:A10)',
    onChange: jest.fn(),
    onCommit: jest.fn(),
    activeCellRef: 'A1',
    editingFormula: null,
    onHighlightsChange: jest.fn(),
    onEditingKey: jest.fn(),
    editingSession: { state: 'SELECT' as const, row: 0, col: 0, buffer: '', originalValue: '', caretPos: 0, selectionStart: -1, selectionEnd: -1, isFormula: false },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls onFocusEditing when focused in SELECT state with formula', () => {
    const onFocusEditing = jest.fn();
    render(<FormulaBar {...defaultProps} onFocusEditing={onFocusEditing} />);
    const input = screen.getByDisplayValue('=SUM(A1:A10)');
    act(() => {
      fireEvent.focus(input);
    });
    expect(onFocusEditing).toHaveBeenCalled();
  });

  it('does not call onFocusEditing when no onEditingKey is provided', () => {
    const onFocusEditing = jest.fn();
    const propsWithoutHook = { ...defaultProps, onEditingKey: undefined };
    render(<FormulaBar {...propsWithoutHook} onFocusEditing={onFocusEditing} />);
    const input = screen.getByDisplayValue('=SUM(A1:A10)');
    act(() => {
      fireEvent.focus(input);
    });
    expect(onFocusEditing).not.toHaveBeenCalled();
  });

  it('does not call onFocusEditing when hook is in EDIT state', () => {
    const onFocusEditing = jest.fn();
    render(
      <FormulaBar
        {...defaultProps}
        onFocusEditing={onFocusEditing}
        editingSession={{ state: 'EDIT' as const, row: 0, col: 0, buffer: '=SUM(A1:A10)', originalValue: '', caretPos: 5, selectionStart: -1, selectionEnd: -1, isFormula: true }}
      />,
    );
    const input = screen.getByDisplayValue('=SUM(A1:A10)');
    act(() => {
      fireEvent.focus(input);
    });
    expect(onFocusEditing).not.toHaveBeenCalled();
  });

  it('passes caret position to onFocusEditing', () => {
    const onFocusEditing = jest.fn();
    render(<FormulaBar {...defaultProps} onFocusEditing={onFocusEditing} />);
    const input = screen.getByDisplayValue('=SUM(A1:A10)') as HTMLInputElement;
    // Simulate clicking at position 7 (after "A1:")
    input.setSelectionRange(7, 7);
    act(() => {
      fireEvent.focus(input);
    });
    expect(onFocusEditing).toHaveBeenCalledWith(expect.any(Number));
  });

  it('calls onFocusEditing on focus even without prior selection', () => {
    const onFocusEditing = jest.fn();
    render(<FormulaBar {...defaultProps} onFocusEditing={onFocusEditing} />);
    const input = screen.getByDisplayValue('=SUM(A1:A10)');
    act(() => {
      fireEvent.focus(input);
    });
    // jsdom places caret at end of input on focus (length = 12)
    expect(onFocusEditing).toHaveBeenCalledWith(12);
  });
});
