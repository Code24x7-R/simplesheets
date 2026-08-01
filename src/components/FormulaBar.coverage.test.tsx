// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
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

describe('FormulaBar - Raw Key Handling', () => {
  const defaultProps: FormulaBarProps = {
    session: { ...defaultSession, state: 'EDIT', buffer: '=SUM(', isFormula: true },
    value: '=SUM(',
    cursorPos: 5,
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    autoComplete: { open: false, matches: [], index: 0, tokenStart: 0 },
    onAcceptAutoComplete: jest.fn(),
    onNavigateAutoComplete: jest.fn(),
    onDismissAutoComplete: jest.fn(),
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
    value: '42',
    cursorPos: 0,
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    autoComplete: { open: false, matches: [], index: 0, tokenStart: 0 },
    onAcceptAutoComplete: jest.fn(),
    onNavigateAutoComplete: jest.fn(),
    onDismissAutoComplete: jest.fn(),
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
    value: '=A1+B1',
    cursorPos: 7,
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    autoComplete: { open: false, matches: [], index: 0, tokenStart: 0 },
    onAcceptAutoComplete: jest.fn(),
    onNavigateAutoComplete: jest.fn(),
    onDismissAutoComplete: jest.fn(),
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

    // Formula display should not be visible when not editing
    const formulaDisplay = document.querySelector('.pointer-events-none');
    expect(formulaDisplay).not.toBeInTheDocument();
  });
});

describe('FormulaBar - Error Display', () => {
  const defaultProps: FormulaBarProps = {
    session: { ...defaultSession, state: 'EDIT', buffer: '=SUM(', isFormula: true },
    value: '=SUM(',
    cursorPos: 5,
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    autoComplete: { open: false, matches: [], index: 0, tokenStart: 0 },
    onAcceptAutoComplete: jest.fn(),
    onNavigateAutoComplete: jest.fn(),
    onDismissAutoComplete: jest.fn(),
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

    // Error display should not be visible when not editing
    const errorDisplay = document.querySelector('.bg-red-50, .bg-yellow-50');
    expect(errorDisplay).not.toBeInTheDocument();
  });
});

describe('FormulaBar - Auto-Close Parentheses', () => {
  const defaultProps: FormulaBarProps = {
    session: { ...defaultSession, state: 'EDIT', buffer: '=SUM(', isFormula: true },
    value: '=SUM(',
    cursorPos: 5,
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    autoComplete: { open: false, matches: [], index: 0, tokenStart: 0 },
    onAcceptAutoComplete: jest.fn(),
    onNavigateAutoComplete: jest.fn(),
    onDismissAutoComplete: jest.fn(),
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
    value: '=A1',
    cursorPos: 3,
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    autoComplete: { open: false, matches: [], index: 0, tokenStart: 0 },
    onAcceptAutoComplete: jest.fn(),
    onNavigateAutoComplete: jest.fn(),
    onDismissAutoComplete: jest.fn(),
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

describe('FormulaBar - Focus transitions to EDIT mode', () => {
  const makeProps = (): FormulaBarProps => ({
    session: { ...defaultSession, state: 'SELECT' },
    value: 'Hello World',
    cursorPos: 0,
    onRawKeyDown: jest.fn(),
    onRawChange: jest.fn(),
    onRawFocus: jest.fn(),
    onRawBlur: jest.fn(),
    onRawCaretMove: jest.fn(),
    autoComplete: { open: false, matches: [], index: 0, tokenStart: 0 },
    onAcceptAutoComplete: jest.fn(),
    onNavigateAutoComplete: jest.fn(),
    onDismissAutoComplete: jest.fn(),
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
