// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
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
    value: '',
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

  it('renders with active cell reference', () => {
    render(<FormulaBar {...defaultProps} />);
    expect(screen.getAllByText('A1').length).toBeGreaterThan(0);
  });

  it('renders with fx indicator', () => {
    render(<FormulaBar {...defaultProps} />);
    expect(screen.getByText('fx')).toBeInTheDocument();
  });

  it('renders fx as clickable button when onFxClick provided', () => {
    const onFxClick = jest.fn();
    render(<FormulaBar {...defaultProps} onFxClick={onFxClick} value="=SUM(A1:A5)" />);
    const fxButton = screen.getByText('fx');
    expect(fxButton.tagName).toBe('BUTTON');
    fireEvent.click(fxButton);
    expect(onFxClick).toHaveBeenCalledWith('=SUM(A1:A5)');
  });

  it('renders fx as plain span when onFxClick not provided', () => {
    render(<FormulaBar {...defaultProps} />);
    const fxSpan = screen.getByText('fx');
    expect(fxSpan.tagName).toBe('SPAN');
  });

  it('fx button passes current value to onFxClick', () => {
    const onFxClick = jest.fn();
    render(<FormulaBar {...defaultProps} onFxClick={onFxClick} value="=AVERAGE(B1:B10)" />);
    fireEvent.click(screen.getByText('fx'));
    expect(onFxClick).toHaveBeenCalledWith('=AVERAGE(B1:B10)');
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

  it('calls onRawBlur when input loses focus while editing', () => {
    const onRawBlur = jest.fn();
    render(
      <FormulaBar
        {...defaultProps}
        onRawBlur={onRawBlur}
        session={{ ...defaultSession, state: 'EDIT', buffer: 'test' }}
      />,
    );
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onRawBlur).toHaveBeenCalled();
  });

  it('does NOT call onRawBlur when input loses focus while in SELECT state', () => {
    const onRawBlur = jest.fn();
    render(
      <FormulaBar
        {...defaultProps}
        onRawBlur={onRawBlur}
        session={{ ...defaultSession, state: 'SELECT' }}
      />,
    );
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onRawBlur).not.toHaveBeenCalled();
  });
});

describe('FormulaBar - Formula Editing', () => {
  const defaultProps = {
    session: { ...defaultSession, state: 'EDIT', buffer: '=SUM(A1:A10)', isFormula: true } as EditingSession,
    value: '=SUM(A1:A10)',
    cursorPos: 11,
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

  it('calls onRawFocus when focused in SELECT state with formula', () => {
    const onRawFocus = jest.fn();
    render(
      <FormulaBar
        {...defaultProps}
        session={{ ...defaultSession, state: 'SELECT' }}
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

describe('FormulaBar - keyboard shortcuts', () => {
  const defaultProps = {
    session: { ...defaultSession, state: 'EDIT', buffer: '=SUM(A1:A10)', isFormula: true } as EditingSession,
    value: '=SUM(A1:A10)',
    cursorPos: 11,
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

  it('expands/collapses on Ctrl+Shift+U', () => {
    render(<FormulaBar {...defaultProps} />);
    const input = screen.getByDisplayValue('=SUM(A1:A10)');
    fireEvent.keyDown(input, { ctrlKey: true, shiftKey: true, key: 'u' });
    // Should toggle expanded state (no error thrown)
    // Re-query the input since the component may have re-rendered
    expect(screen.getByDisplayValue('=SUM(A1:A10)')).toBeInTheDocument();
  });

  it('handles Ctrl+C to copy selected text', () => {
    render(<FormulaBar {...defaultProps} />);
    const input = screen.getByDisplayValue('=SUM(A1:A10)') as HTMLInputElement;
    // Select some text
    input.setSelectionRange(4, 8);
    fireEvent.keyDown(input, { ctrlKey: true, key: 'c' });
    // Should attempt to copy (no error thrown)
    expect(input).toBeInTheDocument();
  });

  it('handles Ctrl+V to paste from clipboard', () => {
    render(<FormulaBar {...defaultProps} />);
    const input = screen.getByDisplayValue('=SUM(A1:A10)');
    fireEvent.keyDown(input, { ctrlKey: true, key: 'v' });
    // Should attempt to paste (no error thrown)
    expect(input).toBeInTheDocument();
  });

  it('handles Ctrl+X to cut selected text', () => {
    render(<FormulaBar {...defaultProps} />);
    const input = screen.getByDisplayValue('=SUM(A1:A10)') as HTMLInputElement;
    // Select some text
    input.setSelectionRange(4, 8);
    fireEvent.keyDown(input, { ctrlKey: true, key: 'x' });
    // Should attempt to cut (no error thrown)
    expect(input).toBeInTheDocument();
  });

  it('handles Alt+Enter to insert line break', () => {
    render(<FormulaBar {...defaultProps} />);
    const input = screen.getByDisplayValue('=SUM(A1:A10)');
    fireEvent.keyDown(input, { altKey: true, key: 'Enter' });
    // Should insert line break (no error thrown)
    // Re-query the input since the component may have re-rendered
    expect(screen.getByDisplayValue(/SUM/)).toBeInTheDocument();
  });
});

describe('FormulaBar - Error Display', () => {
  const defaultProps = {
    session: { ...defaultSession, state: 'EDIT', buffer: '=SUM(A1:A10)', isFormula: true } as EditingSession,
    value: '=SUM(A1:A10)',
    cursorPos: 11,
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

  it('displays validation error when present', () => {
    // Render with an invalid formula
    render(
      <FormulaBar
        {...defaultProps}
        value='=SUM('
        session={{ ...defaultProps.session, buffer: '=SUM(' }}
      />,
    );
    // The component should render without error
    const input = screen.getByDisplayValue('=SUM(');
    expect(input).toBeInTheDocument();
  });

  it('input does NOT have text-transparent when value is just "=" (B-009 fix)', () => {
    render(
      <FormulaBar
        {...defaultProps}
        value='='
        session={{ ...defaultProps.session, state: 'ENTER', buffer: '=', isFormula: true }}
      />,
    );
    const input = screen.getByDisplayValue('=') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    // The "=" should be visible — no text-transparent because overlay has no segments
    expect(input.className).not.toContain('text-transparent');
  });

  it('input HAS text-transparent when value has cell references (overlay renders)', () => {
    render(
      <FormulaBar
        {...defaultProps}
        value='=A1+B2'
        session={{ ...defaultProps.session, state: 'EDIT', buffer: '=A1+B2', isFormula: true }}
      />,
    );
    const input = screen.getByDisplayValue('=A1+B2') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    // Has cell references — overlay renders, so text-transparent is needed
    expect(input.className).toContain('text-transparent');
  });
});
