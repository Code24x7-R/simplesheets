// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FormulaBar } from './FormulaBar';
import type { FormulaBarProps } from './FormulaBar';
import type { EditingSession } from '../hooks/useCellEditing';
import type { FunctionInfo } from '../utils/formulaAutocomplete';

const defaultSession: EditingSession = {
  state: 'SELECT',
  row: 0,
  col: 0,
  buffer: '',
  originalValue: '',
  caretPos: 0,
  isFormula: false,
};

/** Default auto-complete state (closed). */
const defaultAutoComplete: FormulaBarProps['autoComplete'] = {
  open: false,
  matches: [],
  index: 0,
  tokenStart: 0,
};

/** Sample function matches for testing the dropdown. */
const sampleMatches: FunctionInfo[] = [
  { name: 'SUM', description: 'Adds numbers', signature: 'SUM(number1, ...)', category: 'Math' },
  { name: 'SIGN', description: 'Sign of number', signature: 'SIGN(number)', category: 'Math' },
  { name: 'SIN', description: 'Sine', signature: 'SIN(angle)', category: 'Trigonometry' },
];

const makeProps = (overrides: Partial<FormulaBarProps> = {}): FormulaBarProps => ({
  session: { ...defaultSession, state: 'EDIT', buffer: '=S', isFormula: true },
  value: '=S',
  cursorPos: 2,
  onRawKeyDown: jest.fn(),
  onRawChange: jest.fn(),
  onRawFocus: jest.fn(),
  onRawBlur: jest.fn(),
  onRawCaretMove: jest.fn(),
  autoComplete: defaultAutoComplete,
  onAcceptAutoComplete: jest.fn(),
  onNavigateAutoComplete: jest.fn(),
  onDismissAutoComplete: jest.fn(),
  ...overrides,
});

/** Helper: create props with auto-complete open and sample matches. */
const makeOpenProps = (overrides: Partial<FormulaBarProps> = {}): FormulaBarProps =>
  makeProps({
    autoComplete: { open: true, matches: sampleMatches, index: 0, tokenStart: 1 },
    session: { ...defaultSession, state: 'EDIT', buffer: '=S', isFormula: true },
    value: '=S',
    cursorPos: 2,
    ...overrides,
  });

/** Helper: get the formula bar input element */
function getFormulaInput(): HTMLInputElement {
  return screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;
}

describe('FormulaBar - Autocomplete Rendering (prop-driven)', () => {
  it('renders dropdown when autoComplete.open is true', () => {
    render(<FormulaBar {...makeOpenProps()} />);
    // Autocomplete should show SUM (first sample match)
    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);
  });

  it('renders all matches from autoComplete.matches', () => {
    render(<FormulaBar {...makeOpenProps()} />);
    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SIGN').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SIN').length).toBeGreaterThan(0);
  });

  it('highlights the selected index', () => {
    render(<FormulaBar {...makeOpenProps({ autoComplete: { open: true, matches: sampleMatches, index: 1, tokenStart: 1 } })} />);
    // The selected item (index 1 = SIGN) should have the highlight class
    const signItem = screen.getByText('SIGN').closest('.cursor-pointer');
    expect(signItem?.className).toContain('bg-blue-50');
  });

  it('does not render dropdown when autoComplete.open is false', () => {
    render(<FormulaBar {...makeProps()} />);
    const dropdowns = document.querySelectorAll('.max-h-64');
    expect(dropdowns.length).toBe(0);
  });

  it('does not render dropdown for non-formula buffers (open=false)', () => {
    render(<FormulaBar {...makeProps({ value: 'Hello', session: { ...defaultSession, state: 'EDIT', buffer: 'Hello', isFormula: false } })} />);
    const dropdowns = document.querySelectorAll('.max-h-64');
    expect(dropdowns.length).toBe(0);
  });

  it('does not render dropdown for cell references (open=false)', () => {
    render(<FormulaBar {...makeProps({ value: '=A1' })} />);
    const dropdowns = document.querySelectorAll('.max-h-64');
    expect(dropdowns.length).toBe(0);
  });

  it('does not render dropdown in POINT mode (open=false)', () => {
    render(<FormulaBar {...makeProps({
      value: '=SUM(',
      session: { ...defaultSession, state: 'POINT', buffer: '=SUM(', isFormula: true },
    })} />);
    const dropdowns = document.querySelectorAll('.max-h-64');
    expect(dropdowns.length).toBe(0);
  });
});

describe('FormulaBar - Autocomplete Key Handling (prop-driven)', () => {
  it('calls onAcceptAutoComplete with selected index when Enter is pressed', () => {
    const onAcceptAutoComplete = jest.fn();
    render(<FormulaBar {...makeOpenProps({ onAcceptAutoComplete })} />);
    const input = getFormulaInput();

    // Autocomplete should be open
    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);

    // Press Enter to accept
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onAcceptAutoComplete).toHaveBeenCalledWith(0);
  });

  it('calls onAcceptAutoComplete with selected index when Tab is pressed', () => {
    const onAcceptAutoComplete = jest.fn();
    render(<FormulaBar {...makeOpenProps({ onAcceptAutoComplete })} />);
    const input = getFormulaInput();

    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);

    // Press Tab to accept
    fireEvent.keyDown(input, { key: 'Tab' });

    expect(onAcceptAutoComplete).toHaveBeenCalledWith(0);
  });

  it('calls onAcceptAutoComplete with the highlighted index', () => {
    const onAcceptAutoComplete = jest.fn();
    render(<FormulaBar {...makeOpenProps({
      autoComplete: { open: true, matches: sampleMatches, index: 2, tokenStart: 1 },
      onAcceptAutoComplete,
    })} />);
    const input = getFormulaInput();

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onAcceptAutoComplete).toHaveBeenCalledWith(2);
  });

  it('calls onDismissAutoComplete when Escape is pressed', () => {
    const onDismissAutoComplete = jest.fn();
    render(<FormulaBar {...makeOpenProps({ onDismissAutoComplete })} />);
    const input = getFormulaInput();

    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onDismissAutoComplete).toHaveBeenCalled();
  });

  it('calls onNavigateAutoComplete(1) when ArrowDown is pressed', () => {
    const onNavigateAutoComplete = jest.fn();
    render(<FormulaBar {...makeOpenProps({ onNavigateAutoComplete })} />);
    const input = getFormulaInput();

    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(onNavigateAutoComplete).toHaveBeenCalledWith(1);
  });

  it('calls onNavigateAutoComplete(-1) when ArrowUp is pressed', () => {
    const onNavigateAutoComplete = jest.fn();
    render(<FormulaBar {...makeOpenProps({ onNavigateAutoComplete })} />);
    const input = getFormulaInput();

    expect(screen.getAllByText('SUM').length).toBeGreaterThan(0);

    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(onNavigateAutoComplete).toHaveBeenCalledWith(-1);
  });

  it('does not intercept keys when autocomplete is closed', () => {
    const onAcceptAutoComplete = jest.fn();
    const onRawKeyDown = jest.fn();
    render(<FormulaBar {...makeProps({ onAcceptAutoComplete, onRawKeyDown })} />);
    const input = getFormulaInput();

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(onAcceptAutoComplete).not.toHaveBeenCalled();
    expect(onRawKeyDown).toHaveBeenCalled();
  });
});

describe('FormulaBar - Autocomplete Mouse Interaction', () => {
  it('calls onNavigateAutoComplete on mouse hover', () => {
    const onNavigateAutoComplete = jest.fn();
    render(<FormulaBar {...makeOpenProps({ onNavigateAutoComplete })} />);

    // Scope to the dropdown (function bar also has clickable items)
    const dropdown = document.querySelector('.max-h-64');
    const signItem = dropdown!.querySelectorAll('.cursor-pointer')[1];
    expect(signItem).toBeTruthy();

    /* istanbul ignore next - mouseEnter handler */
    act(() => {
      fireEvent.mouseEnter(signItem!);
    });

    // Hovering SIGN (index 1) from index 0 → delta = +1
    expect(onNavigateAutoComplete).toHaveBeenCalledWith(1);
  });

  it('calls onAcceptAutoComplete on mouse click', () => {
    const onAcceptAutoComplete = jest.fn();
    render(<FormulaBar {...makeOpenProps({ onAcceptAutoComplete })} />);

    // Scope to the dropdown (function bar also has a SUM button)
    const dropdown = document.querySelector('.max-h-64');
    const sumItem = dropdown!.querySelector('.cursor-pointer') as HTMLElement;
    expect(sumItem).toBeTruthy();

    /* istanbul ignore next - mouseDown handler */
    act(() => {
      fireEvent.mouseDown(sumItem);
    });

    expect(onAcceptAutoComplete).toHaveBeenCalledWith(0);
  });

  it('calls onRawCaretMove on input click (not autocomplete)', () => {
    const onRawCaretMove = jest.fn();
    render(<FormulaBar {...makeProps({ onRawCaretMove })} />);
    const input = getFormulaInput();

    act(() => {
      fireEvent.click(input);
    });

    expect(onRawCaretMove).toHaveBeenCalled();
  });
});
