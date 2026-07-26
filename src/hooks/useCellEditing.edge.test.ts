import { renderHook, act } from '@testing-library/react';
import { useCellEditing } from './useCellEditing';
import type { KeyHandlingResult } from './useCellEditing';

function createHook(options: Partial<Parameters<typeof useCellEditing>[0]> = {}) {
  const defaults = {
    activeRow: 0,
    activeCol: 0,
    cellValue: 'Hello World',
    rowCount: 100,
    colCount: 26,
    onCommit: jest.fn(),
    onNavigate: jest.fn(),
  };
  return renderHook((props) => useCellEditing({ ...defaults, ...options, ...props }), {
    initialProps: {},
  });
}

describe('useCellEditing - Alt+Enter (line break)', () => {
  it('inserts line break on Alt+Enter in ENTER state', () => {
    const { result } = createHook();
    act(() => result.current.handleKey('H', false, false));
    act(() => result.current.handleKey('i', false, false));
    // Buffer is "Hi", caret at 2
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey('Enter', false, false, true); });
    // Alt+Enter should insert a newline and stay in ENTER
    expect(keyResult.session.state).toBe('ENTER');
    expect(keyResult.session.buffer).toBe('Hi\n');
    expect(keyResult.session.caretPos).toBe(3);
  });

  it('inserts line break on Alt+Enter in EDIT state', () => {
    const { result } = createHook({ cellValue: 'Hello World' });
    act(() => result.current.handleKey('F2', false, false));
    // Buffer is "Hello World", caret at 11
    // Move caret to position 5 (after "Hello")
    for (let i = 0; i < 6; i++) {
      act(() => result.current.handleKey('ArrowLeft', false, false));
    }
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey('Enter', false, false, true); });
    expect(keyResult.session.state).toBe('EDIT');
    expect(keyResult.session.buffer).toBe('Hello\n World');
    expect(keyResult.session.caretPos).toBe(6);
  });
});

describe('useCellEditing - Ctrl+Enter (commit and stay)', () => {
  it('commits and stays on Ctrl+Enter in ENTER state', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ onCommit });
    act(() => result.current.handleKey('H', false, false));
    act(() => result.current.handleKey('i', false, false));
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey('Enter', false, true); });
    expect(onCommit).toHaveBeenCalledWith(0, 0, 'Hi', true);
    expect(keyResult.session.state).toBe('SELECT');
  });

  it('commits and stays on Ctrl+Enter in EDIT state', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ cellValue: 'Test', onCommit });
    act(() => result.current.handleKey('F2', false, false));
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey('Enter', false, true); });
    expect(onCommit).toHaveBeenCalledWith(0, 0, 'Test', true);
    expect(keyResult.session.state).toBe('SELECT');
  });
});

describe('useCellEditing - Ctrl+Arrow word navigation', () => {
  it('Ctrl+ArrowLeft moves caret to previous word boundary in EDIT', () => {
    const { result } = createHook({ cellValue: 'Hello World Foo' });
    act(() => result.current.handleKey('F2', false, false));
    // Caret at end (15), Ctrl+ArrowLeft should jump to start of "Foo" (12)
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey('ArrowLeft', false, true); });
    expect(keyResult.session.caretPos).toBe(12);
  });

  it('Ctrl+ArrowRight moves caret to next word boundary in EDIT', () => {
    const { result } = createHook({ cellValue: 'Hello World Foo' });
    act(() => result.current.handleKey('F2', false, false));
    // Move caret to start
    for (let i = 0; i < 15; i++) {
      act(() => result.current.handleKey('ArrowLeft', false, false));
    }
    // Caret at 0, Ctrl+ArrowRight skips "Hello" and lands at position 5 (the space)
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey('ArrowRight', false, true); });
    expect(keyResult.session.caretPos).toBe(5);
  });

  it('Ctrl+ArrowLeft at position 0 stays at 0', () => {
    const { result } = createHook({ cellValue: 'Hello' });
    act(() => result.current.handleKey('F2', false, false));
    // Move caret to start
    for (let i = 0; i < 5; i++) {
      act(() => result.current.handleKey('ArrowLeft', false, false));
    }
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey('ArrowLeft', false, true); });
    expect(keyResult.session.caretPos).toBe(0);
  });

  it('Ctrl+ArrowRight at end stays at end', () => {
    const { result } = createHook({ cellValue: 'Hi' });
    act(() => result.current.handleKey('F2', false, false));
    // Caret at end (2)
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey('ArrowRight', false, true); });
    expect(keyResult.session.caretPos).toBe(2);
  });

  it('Ctrl+ArrowLeft in ENTER state moves caret by word', () => {
    const { result } = createHook();
    act(() => result.current.handleKey('H', false, false));
    act(() => result.current.handleKey('e', false, false));
    act(() => result.current.handleKey('l', false, false));
    act(() => result.current.handleKey('l', false, false));
    act(() => result.current.handleKey('o', false, false));
    // Buffer "Hello", caret at 5
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey('ArrowLeft', false, true); });
    expect(keyResult.session.caretPos).toBe(0);
  });
});

describe('useCellEditing - End key in ENTER and EDIT states', () => {
  it('End moves caret to end of buffer in ENTER state', () => {
    const { result } = createHook();
    act(() => result.current.handleKey('H', false, false));
    act(() => result.current.handleKey('i', false, false));
    // Move caret to start first
    act(() => result.current.handleKey('ArrowLeft', false, false));
    act(() => result.current.handleKey('ArrowLeft', false, false));
    expect(result.current.session.caretPos).toBe(0);
    // End should move to end
    act(() => result.current.handleKey('End', false, false));
    expect(result.current.session.caretPos).toBe(2);
  });

  it('End moves caret to end of buffer in EDIT state', () => {
    const { result } = createHook({ cellValue: 'Hello' });
    act(() => result.current.handleKey('F2', false, false));
    // Move caret to start
    for (let i = 0; i < 5; i++) {
      act(() => result.current.handleKey('ArrowLeft', false, false));
    }
    expect(result.current.session.caretPos).toBe(0);
    act(() => result.current.handleKey('End', false, false));
    expect(result.current.session.caretPos).toBe(5);
  });
});

describe('useCellEditing - Home key in EDIT state', () => {
  it('Home moves caret to start in EDIT state', () => {
    const { result } = createHook({ cellValue: 'Hello' });
    act(() => result.current.handleKey('F2', false, false));
    act(() => result.current.handleKey('Home', false, false));
    expect(result.current.session.caretPos).toBe(0);
  });

  it('Ctrl+Home in EDIT state moves caret to start (same as Home)', () => {
    const { result } = createHook({ cellValue: 'Hello' });
    act(() => result.current.handleKey('F2', false, false));
    act(() => result.current.handleKey('Home', false, true));
    expect(result.current.session.caretPos).toBe(0);
  });
});

describe('useCellEditing - setBuffer and setCaretPos', () => {
  it('setBuffer updates buffer and caret in EDIT state', () => {
    const { result } = createHook({ cellValue: 'Hello' });
    act(() => result.current.handleKey('F2', false, false));
    act(() => result.current.setBuffer('Updated', 7));
    expect(result.current.session.buffer).toBe('Updated');
    expect(result.current.session.caretPos).toBe(7);
    expect(result.current.session.isFormula).toBe(false);
  });

  it('setBuffer detects formula when buffer starts with =', () => {
    const { result } = createHook({ cellValue: 'Test' });
    act(() => result.current.handleKey('F2', false, false));
    act(() => result.current.setBuffer('=SUM(A1)', 9));
    expect(result.current.session.isFormula).toBe(true);
  });

  it('setBuffer does nothing in SELECT state', () => {
    const { result } = createHook();
    act(() => result.current.setBuffer('New', 3));
    expect(result.current.session.buffer).toBe('');
    expect(result.current.session.state).toBe('SELECT');
  });

  it('setCaretPos updates caret in EDIT state', () => {
    const { result } = createHook({ cellValue: 'Hello' });
    act(() => result.current.handleKey('F2', false, false));
    act(() => result.current.setCaretPos(3));
    expect(result.current.session.caretPos).toBe(3);
  });

  it('setCaretPos clamps to buffer length', () => {
    const { result } = createHook({ cellValue: 'Hi' });
    act(() => result.current.handleKey('F2', false, false));
    act(() => result.current.setCaretPos(100));
    expect(result.current.session.caretPos).toBe(2);
  });

  it('setCaretPos clamps negative to 0', () => {
    const { result } = createHook({ cellValue: 'Hi' });
    act(() => result.current.handleKey('F2', false, false));
    act(() => result.current.setCaretPos(-5));
    expect(result.current.session.caretPos).toBe(0);
  });

  it('setCaretPos does nothing in SELECT state', () => {
    const { result } = createHook();
    act(() => result.current.setCaretPos(3));
    expect(result.current.session.caretPos).toBe(0);
  });
});

describe('useCellEditing - commit with batch parameter', () => {
  it('commit passes batch=true to onCommit', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ onCommit });
    act(() => result.current.startEnter('V'));
    act(() => result.current.commit(undefined, true));
    expect(onCommit).toHaveBeenCalledWith(0, 0, 'V', true);
  });

  it('commit passes batch=false to onCommit', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ onCommit });
    act(() => result.current.startEnter('V'));
    act(() => result.current.commit(undefined, false));
    expect(onCommit).toHaveBeenCalledWith(0, 0, 'V', false);
  });

  it('commit with direction and batch calls both callbacks', () => {
    const onCommit = jest.fn();
    const onNavigate = jest.fn();
    const { result } = createHook({ onCommit, onNavigate });
    act(() => result.current.startEnter('V'));
    act(() => result.current.commit({ dRow: 1, dCol: 0 }, true));
    expect(onCommit).toHaveBeenCalledWith(0, 0, 'V', true);
    expect(onNavigate).toHaveBeenCalledWith(1, 0);
  });
});

describe('useCellEditing - POINT state edge cases', () => {
  it('typing a cell ref character in POINT mode exits to EDIT', () => {
    const { result } = createHook();
    // Enter POINT mode
    act(() => result.current.handleKey('=', false, false));
    act(() => result.current.handleKey('S', false, false));
    act(() => result.current.handleKey('U', false, false));
    act(() => result.current.handleKey('M', false, false));
    act(() => result.current.handleKey('(', false, false));
    expect(result.current.session.state).toBe('POINT');
    // Type a cell reference character — should exit POINT and insert the char
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey('B', false, false); });
    expect(keyResult.session.state).toBe('EDIT');
    expect(keyResult.pointSession).toBeNull();
    expect(keyResult.session.buffer).toBe('=SUM(B');
  });

  it('typing ) in POINT mode commits reference and closes function', () => {
    const { result } = createHook();
    act(() => result.current.handleKey('=', false, false));
    act(() => result.current.handleKey('S', false, false));
    act(() => result.current.handleKey('U', false, false));
    act(() => result.current.handleKey('M', false, false));
    act(() => result.current.handleKey('(', false, false));
    // Move to a cell (creates a range from anchor A1 to current B2)
    act(() => result.current.handleKey('ArrowDown', false, false));
    act(() => result.current.handleKey('ArrowRight', false, false));
    // Type ) to commit reference and close
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey(')', false, false); });
    expect(keyResult.session.state).toBe('EDIT');
    expect(keyResult.pointSession).toBeNull();
    // ) commits the full range from anchor to current: A1:B2
    expect(keyResult.session.buffer).toBe('=SUM(A1:B2)');
  });

  it('colon in POINT mode with existing range falls through to operator', () => {
    const { result } = createHook();
    act(() => result.current.handleKey('=', false, false));
    act(() => result.current.handleKey('S', false, false));
    act(() => result.current.handleKey('U', false, false));
    act(() => result.current.handleKey('M', false, false));
    act(() => result.current.handleKey('(', false, false));
    // Move to create a range (anchor ≠ current)
    act(() => result.current.handleKey('ArrowDown', false, false));
    act(() => result.current.handleKey('ArrowRight', false, false));
    // Type : — anchor≠current so it's not single-cell duplication, falls through to operator commit
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey(':', false, false); });
    expect(keyResult.session.state).toBe('EDIT');
    expect(keyResult.pointSession).toBeNull();
  });
});

describe('useCellEditing - Enter Point Mode (enterPointMode)', () => {
  it('enterPointMode from EDIT sets POINT state with correct anchor', () => {
    const { result } = createHook({ cellValue: '=SUM(' });
    act(() => result.current.handleKey('F2', false, false));
    // Trigger F2 again to enter POINT mode (it's already in EDIT)
    act(() => result.current.handleKey('F2', false, false));
    expect(result.current.session.state).toBe('POINT');
    expect(result.current.pointSession).not.toBeNull();
    expect(result.current.pointSession?.anchorRow).toBe(0);
    expect(result.current.pointSession?.anchorCol).toBe(0);
  });
});

describe('useCellEditing - Arrow in ENTER state commits and navigates', () => {
  it('ArrowLeft in ENTER moves caret left (does NOT commit)', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ onCommit });
    act(() => result.current.handleKey('H', false, false));
    act(() => result.current.handleKey('i', false, false));
    // Buffer "Hi", caret at 2. ArrowLeft should move caret to 1, not commit
    act(() => result.current.handleKey('ArrowLeft', false, false));
    expect(result.current.session.caretPos).toBe(1);
    expect(result.current.session.state).toBe('ENTER');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('ArrowUp in ENTER commits and navigates up', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ onCommit, activeRow: 5 });
    act(() => result.current.handleKey('H', false, false));
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey('ArrowUp', false, false); });
    expect(onCommit).toHaveBeenCalledWith(5, 0, 'H', undefined);
    expect(keyResult.navigate).toEqual({ dRow: -1, dCol: 0 });
  });
});
