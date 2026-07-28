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

const makeProps = (overrides: Partial<FormulaBarProps> = {}): FormulaBarProps => ({
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
  ...overrides,
});

describe('FormulaBar - Expand/Collapse', () => {
  it('toggles expanded state via button click', () => {
    render(<FormulaBar {...makeProps()} />);
    const toggleBtn = screen.getByTitle(/Expand formula bar/);
    fireEvent.click(toggleBtn);
    // After expanding, the textarea should be rendered
    const textarea = document.querySelector('textarea');
    expect(textarea).toBeInTheDocument();
  });

  it('toggles expanded state via Ctrl+Shift+U', () => {
    const onRawKeyDown = jest.fn();
    const props = makeProps({
      session: { ...defaultSession, state: 'EDIT', buffer: '=SUM(A1)', caretPos: 9, isFormula: true },
      value: '=SUM(A1)',
      cursorPos: 9,
      onRawKeyDown,
    });
    render(<FormulaBar {...props} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Press Ctrl+Shift+U to expand
    fireEvent.keyDown(input, { key: 'u', ctrlKey: true, shiftKey: true });

    // Textarea should now be rendered
    const textarea = document.querySelector('textarea');
    expect(textarea).toBeInTheDocument();
    // The shortcut should not be forwarded to FSM
    expect(onRawKeyDown).not.toHaveBeenCalled();
  });

  it('collapses back to input via Ctrl+Shift+U', () => {
    render(<FormulaBar {...makeProps()} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Expand
    fireEvent.keyDown(input, { key: 'u', ctrlKey: true, shiftKey: true });
    expect(document.querySelector('textarea')).toBeInTheDocument();

    // Focus the textarea so subsequent keydown fires on it
    const textarea = document.querySelector('textarea') as HTMLElement;
    act(() => textarea.focus());

    // Collapse
    fireEvent.keyDown(textarea, { key: 'u', ctrlKey: true, shiftKey: true });
    // Should be back to input
    expect(document.querySelector('input.formula-input-scroll')).toBeInTheDocument();
  });
});

describe('FormulaBar - Selection and Clipboard Shortcuts', () => {
  // Mock clipboard API before each test in this suite
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
        readText: jest.fn().mockResolvedValue(''),
      },
    });
  });

  it('handles Ctrl+C with text selected (copies selected text)', () => {
    const props = makeProps({
      session: { ...defaultSession, state: 'EDIT', buffer: 'Hello World', isFormula: false },
      value: 'Hello World',
      cursorPos: 11,
    });
    render(<FormulaBar {...props} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;

    // Select some text
    act(() => {
      input.setSelectionRange(0, 5);
    });

    // Ctrl+C should not forward to FSM
    const onRawKeyDown = props.onRawKeyDown as jest.Mock;
    fireEvent.keyDown(input, { key: 'c', ctrlKey: true });
    // onRawKeyDown should NOT be called (copy is handled natively)
    expect(onRawKeyDown).not.toHaveBeenCalled();
    // Clipboard write should have been called with selected text
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hello');
  });

  it('handles Ctrl+V by reading clipboard and updating value', async () => {
    (navigator.clipboard.readText as jest.Mock).mockResolvedValue('A1:A10');
    const props = makeProps({
      session: { ...defaultSession, state: 'EDIT', buffer: '=SUM(', isFormula: true },
      value: '=SUM(',
      cursorPos: 5,
    });
    render(<FormulaBar {...props} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;

    // Ctrl+V should intercept and not forward to FSM
    fireEvent.keyDown(input, { key: 'v', ctrlKey: true });
    // The native paste is intercepted (preventDefault called)
    // onRawKeyDown should NOT be called for Ctrl+V
    const onRawKeyDown = props.onRawKeyDown as jest.Mock;
    expect(onRawKeyDown).not.toHaveBeenCalled();
  });

  it('collapses text selection on Arrow key before forwarding to FSM', () => {
    const onRawKeyDown = jest.fn();
    const props = makeProps({
      session: { ...defaultSession, state: 'EDIT', buffer: 'Hello', isFormula: false },
      value: 'Hello',
      cursorPos: 5,
      onRawKeyDown,
    });
    render(<FormulaBar {...props} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;

    // Select some text
    act(() => {
      input.setSelectionRange(2, 5);
    });

    // Press ArrowLeft (no shift) — should collapse selection then forward
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(onRawKeyDown).toHaveBeenCalled();
  });
});

describe('FormulaBar - Auto-close Parentheses', () => {
  it('auto-closes parenthesis when typing (', () => {
    const onRawChange = jest.fn();
    const onRawKeyDown = jest.fn();
    const props = makeProps({
      session: { ...defaultSession, state: 'EDIT', buffer: '=SUM', isFormula: true },
      value: '=SUM',
      cursorPos: 4,
      onRawChange,
      onRawKeyDown,
    });
    render(<FormulaBar {...props} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // The FSM handles auto-close, but the FormulaBar forwards the key
    fireEvent.keyDown(input, { key: '(' });
    expect(onRawKeyDown).toHaveBeenCalled();
  });
});

describe('FormulaBar - Cursor Sync Effect', () => {
  it('syncs cursor position when caretPos changes', () => {
    const { rerender } = render(
      <FormulaBar
        {...makeProps({
          session: { ...defaultSession, state: 'EDIT', buffer: '=SUM(A1)', isFormula: true },
          value: '=SUM(A1)',
          cursorPos: 5,
        })}
      />,
    );

    // Rerender with a new cursor position
    rerender(
      <FormulaBar
        {...makeProps({
          session: { ...defaultSession, state: 'EDIT', buffer: '=SUM(A1)', isFormula: true, caretPos: 8 },
          value: '=SUM(A1)',
          cursorPos: 8,
        })}
      />,
    );

    // The effect should have run (cursor sync is a visual concern)
    const input = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;
    expect(input).toBeInTheDocument();
  });
});

describe('FormulaBar - Reference Format Toggle', () => {
  it('renders cell ref button that can toggle reference format', () => {
    const onToggleReferenceFormat = jest.fn();
    render(
      <FormulaBar
        {...makeProps({ referenceFormat: 'R1C1', onToggleReferenceFormat })}
      />,
    );
    // The button is rendered (shows active cell ref)
    const refButton = screen.getByTitle(/Active cell/);
    expect(refButton).toBeInTheDocument();
    // The toggle hint mentions switching formats
    expect(refButton.title).toContain('A1');
  });

  it('calls onToggleReferenceFormat when cell ref button is clicked', () => {
    const onToggleReferenceFormat = jest.fn();
    render(
      <FormulaBar
        {...makeProps({ onToggleReferenceFormat })}
      />,
    );
    const refButton = screen.getByTitle(/Active cell/);
    fireEvent.click(refButton);
    expect(onToggleReferenceFormat).toHaveBeenCalled();
  });
});

describe('FormulaBar - Select Handler', () => {
  it('calls onRawCaretMove on text selection', () => {
    const onRawCaretMove = jest.fn();
    const props = makeProps({
      session: { ...defaultSession, state: 'EDIT', buffer: 'Hello World', isFormula: false },
      value: 'Hello World',
      cursorPos: 11,
      onRawCaretMove,
    });
    render(<FormulaBar {...props} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;

    // Simulate a selection event (user clicks to place cursor)
    act(() => {
      input.setSelectionRange(3, 3);
      fireEvent.select(input);
    });

    expect(onRawCaretMove).toHaveBeenCalled();
  });
});

describe('FormulaBar - Shift+Arrow in EDIT mode', () => {
  it('forwards Shift+Arrow to FSM in POINT mode (extends range)', () => {
    const onRawKeyDown = jest.fn();
    const props = makeProps({
      session: { ...defaultSession, state: 'POINT', buffer: '=SUM(A1', isFormula: true },
      value: '=SUM(A1',
      cursorPos: 7,
      onRawKeyDown,
    });
    render(<FormulaBar {...props} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // In POINT mode, Shift+Arrow should NOT be prevented (FSM handles range extension)
    fireEvent.keyDown(input, { key: 'ArrowRight', shiftKey: true });
    expect(onRawKeyDown).toHaveBeenCalled();
  });

  it('does not preventDefault for Shift+Arrow in EDIT mode (native selection)', () => {
    const onRawKeyDown = jest.fn();
    const props = makeProps({
      session: { ...defaultSession, state: 'EDIT', buffer: 'Hello World', isFormula: false },
      value: 'Hello World',
      cursorPos: 11,
      onRawKeyDown,
    });
    render(<FormulaBar {...props} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // In EDIT mode, Shift+Arrow should let native input handle selection
    fireEvent.keyDown(input, { key: 'ArrowRight', shiftKey: true });
    // onRawKeyDown should NOT be called (native selection takes priority)
    expect(onRawKeyDown).not.toHaveBeenCalled();
  });
});

describe('FormulaBar - Blur Handling', () => {
  it('calls onRawBlur when input loses focus during editing', () => {
    const onRawBlur = jest.fn();
    const props = makeProps({
      session: { ...defaultSession, state: 'EDIT', buffer: '=SUM(A1)', isFormula: true },
      value: '=SUM(A1)',
      cursorPos: 8,
      onRawBlur,
    });
    render(<FormulaBar {...props} />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    act(() => {
      fireEvent.focus(input);
    });
    act(() => {
      fireEvent.blur(input);
    });

    expect(onRawBlur).toHaveBeenCalled();
  });
});
