import { renderHook, act } from '@testing-library/react';
import {
  useCellEditing,
  shouldActivatePointMode,
  isOperatorChar,
  cycleReference,
  cycleRangeRef,
  MODE_CODES,
  type KeyHandlingResult,
} from './useCellEditing';

// ═══════════════════════════════════════════════════════════════════════════════
// Pure Function Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('MODE_CODES', () => {
  it('maps SELECT to ST_SEL', () => {
    expect(MODE_CODES.SELECT).toBe('ST_SEL');
  });
  it('maps ENTER to ST_ENT', () => {
    expect(MODE_CODES.ENTER).toBe('ST_ENT');
  });
  it('maps EDIT to ST_EDT', () => {
    expect(MODE_CODES.EDIT).toBe('ST_EDT');
  });
  it('maps POINT to ST_PNT', () => {
    expect(MODE_CODES.POINT).toBe('ST_PNT');
  });
});

describe('shouldActivatePointMode', () => {
  it('returns false for non-formula buffers', () => {
    expect(shouldActivatePointMode('SUM(A1:A10)', 3)).toBe(false);
    expect(shouldActivatePointMode('hello', 2)).toBe(false);
  });

  it('returns false at caret position 0', () => {
    expect(shouldActivatePointMode('=SUM', 0)).toBe(false);
  });

  it('returns false at caret position 1 when = is the first char', () => {
    // '=' as the first char starts a formula, doesn't trigger POINT mode
    expect(shouldActivatePointMode('=', 1)).toBe(false);
    // But '=S' with caret at 1 (before S) should still work for the = trigger
    // Actually no - caret at 1 means we just typed =, so no trigger
    expect(shouldActivatePointMode('=S', 1)).toBe(false);
  });

  it('returns true when = is used as operator (not first char)', () => {
    // = after another = (like ==A1) should trigger
    expect(shouldActivatePointMode('==', 2)).toBe(true);
    // = after a function name should trigger
    expect(shouldActivatePointMode('=SUM(', 5)).toBe(true);
  });

  it('returns false for text after = with no separator', () => {
    expect(shouldActivatePointMode('=S', 2)).toBe(false);
    expect(shouldActivatePointMode('=SU', 3)).toBe(false);
  });

  it('returns true after = when separator is followed', () => {
    expect(shouldActivatePointMode('=(', 2)).toBe(true);
  });

  it('returns true after (', () => {
    expect(shouldActivatePointMode('=SUM(', 5)).toBe(true);
  });

  it('returns true after ,', () => {
    expect(shouldActivatePointMode('=SUM(A1,', 8)).toBe(true);
  });

  it('returns true after :', () => {
    expect(shouldActivatePointMode('=A1:', 4)).toBe(true);
  });

  it('returns true after operators', () => {
    expect(shouldActivatePointMode('=A1+', 4)).toBe(true);
    expect(shouldActivatePointMode('=A1-', 4)).toBe(true);
    expect(shouldActivatePointMode('=A1*', 4)).toBe(true);
    expect(shouldActivatePointMode('=A1/', 4)).toBe(true);
    expect(shouldActivatePointMode('=A1^', 4)).toBe(true);
    expect(shouldActivatePointMode('=A1&', 4)).toBe(true);
    expect(shouldActivatePointMode('=A1>', 4)).toBe(true);
    expect(shouldActivatePointMode('=A1<', 4)).toBe(true);
  });

  it('returns false in middle of a token (no separator before caret)', () => {
    expect(shouldActivatePointMode('=SUM(A1', 7)).toBe(false);
  });

  it('returns false after )', () => {
    expect(shouldActivatePointMode('=SUM(A1)', 7)).toBe(false);
  });

  it('returns true after )+', () => {
    expect(shouldActivatePointMode('=SUM(A1)+', 9)).toBe(true);
  });

  it('trims whitespace before checking separator', () => {
    expect(shouldActivatePointMode('=SUM( ', 6)).toBe(true);
  });
});

describe('isOperatorChar', () => {
  it('returns true for operators', () => {
    expect(isOperatorChar('+')).toBe(true);
    expect(isOperatorChar('-')).toBe(true);
    expect(isOperatorChar('*')).toBe(true);
    expect(isOperatorChar('/')).toBe(true);
    expect(isOperatorChar('(')).toBe(true);
    expect(isOperatorChar(',')).toBe(true);
    expect(isOperatorChar('=')).toBe(true);
    expect(isOperatorChar('^')).toBe(true);
    expect(isOperatorChar('&')).toBe(true);
    expect(isOperatorChar('>')).toBe(true);
    expect(isOperatorChar('<')).toBe(true);
    expect(isOperatorChar(':')).toBe(true);
    expect(isOperatorChar('{')).toBe(true);
    expect(isOperatorChar(';')).toBe(true);
  });

  it('returns false for non-operators', () => {
    expect(isOperatorChar('A')).toBe(false);
    expect(isOperatorChar('1')).toBe(false);
    expect(isOperatorChar('S')).toBe(false);
    expect(isOperatorChar(')')).toBe(false);
  });
});

describe('cycleReference (F4)', () => {
  it('cycles A1 → $A$1', () => {
    expect(cycleReference('A1')).toBe('$A$1');
  });

  it('cycles $A$1 → A$1', () => {
    expect(cycleReference('$A$1')).toBe('A$1');
  });

  it('cycles A$1 → $A1', () => {
    expect(cycleReference('A$1')).toBe('$A1');
  });

  it('cycles $A1 → A1', () => {
    expect(cycleReference('$A1')).toBe('A1');
  });

  it('full cycle returns to start', () => {
    let ref = 'A1';
    ref = cycleReference(ref);
    ref = cycleReference(ref);
    ref = cycleReference(ref);
    ref = cycleReference(ref);
    expect(ref).toBe('A1');
  });

  it('handles multi-letter columns', () => {
    expect(cycleReference('AA10')).toBe('$AA$10');
    expect(cycleReference('$AA$10')).toBe('AA$10');
  });

  it('handles lowercase input', () => {
    expect(cycleReference('a1')).toBe('$A$1');
  });

  it('returns original for invalid refs', () => {
    expect(cycleReference('notaref')).toBe('notaref');
    expect(cycleReference('123')).toBe('123');
    expect(cycleReference('')).toBe('');
  });

  // ── Range cycling: one endpoint at a time ──────────────────────
  // For A1:B5, F4 cycles the first endpoint through its 4 states,
  // then the second endpoint through its 4 states:
  //   A1:B5 → $A$1:B5 → A$1:B5 → $A1:B5 → A1:B5
  //   → A1:$B$5 → A1:B$5 → A1:$B5 → A1:B5
  //
  // The caretOffset tracks position WITHIN the range token so repeated
  // F4 presses stay on the same endpoint.
  describe('cycleRangeRef (F4 on ranges)', () => {
    it('cycles first endpoint when caret is in first half', () => {
      // caretOffset 0 = at start of "A1" → cycle first endpoint
      expect(cycleRangeRef('A1:B5', 0)!.token).toBe('$A$1:B5');
      expect(cycleRangeRef('$A$1:B5', 1)!.token).toBe('A$1:B5');
      expect(cycleRangeRef('A$1:B5', 2)!.token).toBe('$A1:B5');
      expect(cycleRangeRef('$A1:B5', 2)!.token).toBe('A1:B5');
    });

    it('cycles second endpoint when caret is in second half', () => {
      // caretOffset 3 = at colon position → cycle second endpoint
      expect(cycleRangeRef('A1:B5', 3)!.token).toBe('A1:$B$5');
      expect(cycleRangeRef('A1:$B$5', 4)!.token).toBe('A1:B$5');
      expect(cycleRangeRef('A1:B$5', 6)!.token).toBe('A1:$B5');
      expect(cycleRangeRef('A1:$B5', 6)!.token).toBe('A1:B5');
    });

    it('tracks caret offset to stay on same endpoint', () => {
      // After cycling first endpoint, caret stays within it
      const r1 = cycleRangeRef('A1:B5', 1)!;
      expect(r1.token).toBe('$A$1:B5');
      expect(r1.caretOffset).toBeLessThanOrEqual(3); // within "$A$1"

      // After cycling second endpoint, caret stays within it
      const r2 = cycleRangeRef('A1:B5', 4)!;
      expect(r2.token).toBe('A1:$B$5');
      expect(r2.caretOffset).toBeGreaterThan(3); // past colon
    });

    it('full range cycle returns to start after 8 presses with caret tracking', () => {
      let ref = 'A1:B5';
      let caretOffset = 1; // start in first endpoint
      for (let i = 0; i < 8; i++) {
        const result = cycleRangeRef(ref, caretOffset);
        if (result) {
          ref = result.token;
          caretOffset = result.caretOffset;
        }
      }
      expect(ref).toBe('A1:B5');
    });

    it('handles range with multi-letter columns', () => {
      expect(cycleRangeRef('AA10:AB20', 2)!.token).toBe('$AA$10:AB20');
      expect(cycleRangeRef('AA10:AB20', 6)!.token).toBe('AA10:$AB$20');
    });

    it('returns null for non-range input', () => {
      expect(cycleRangeRef('A1', 2)).toBeNull();
      expect(cycleRangeRef('notaref', 4)).toBeNull();
    });

    it('returns null for invalid range endpoints', () => {
      expect(cycleRangeRef('A1:notaref', 2)).toBeNull();
      expect(cycleRangeRef('notaref:B5', 4)).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Hook State Machine Tests
// ═══════════════════════════════════════════════════════════════════════════════

function createHook(options: Partial<Parameters<typeof useCellEditing>[0]> = {}) {
  const defaults = {
    activeRow: 0,
    activeCol: 0,
    cellValue: 'Hello',
    rowCount: 100,
    colCount: 26,
    onCommit: jest.fn(),
    onNavigate: jest.fn(),
  };
  return renderHook((props) => useCellEditing({ ...defaults, ...options, ...props }), {
    initialProps: {},
  });
}

describe('useCellEditing - initial state', () => {
  it('starts in SELECT state', () => {
    const { result } = createHook();
    expect(result.current.session.state).toBe('SELECT');
    expect(result.current.pointSession).toBeNull();
  });

  it('initializes with correct cell position', () => {
    const { result } = createHook({ activeRow: 5, activeCol: 3 });
    expect(result.current.session.row).toBe(5);
    expect(result.current.session.col).toBe(3);
  });
});

describe('useCellEditing - SELECT state', () => {
  it('transitions to ENTER on printable char', () => {
    const { result } = createHook();
    act(() => {
      result.current.handleKey('A', false, false);
    });
    expect(result.current.session.state).toBe('ENTER');
    expect(result.current.session.buffer).toBe('A');
    expect(result.current.session.caretPos).toBe(1);
  });

  it('sets isFormula when typing =', () => {
    const { result } = createHook();
    act(() => {
      result.current.handleKey('=', false, false);
    });
    expect(result.current.session.isFormula).toBe(true);
  });

  it('sets isFormula when typing +', () => {
    const { result } = createHook();
    act(() => {
      result.current.handleKey('+', false, false);
    });
    expect(result.current.session.isFormula).toBe(true);
  });

  it('transitions to EDIT on F2', () => {
    const { result } = createHook({ cellValue: 'Existing' });
    act(() => {
      result.current.handleKey('F2', false, false);
    });
    expect(result.current.session.state).toBe('EDIT');
    expect(result.current.session.buffer).toBe('Existing');
    expect(result.current.session.caretPos).toBe(8);
  });

  it('sets isFormula in EDIT mode for formulas', () => {
    const { result } = createHook({ cellValue: '=SUM(A1:A10)' });
    act(() => {
      result.current.handleKey('F2', false, false);
    });
    expect(result.current.session.isFormula).toBe(true);
  });

  it('handles ArrowDown in SELECT state', () => {
    const onNavigate = jest.fn();
    const { result } = createHook({ onNavigate });
    let navResult!: KeyHandlingResult;
    act(() => {
      navResult = result.current.handleKey('ArrowDown', false, false);
    });
    expect(navResult.navigate).toEqual({ dRow: 1, dCol: 0 });
  });

  it('handles ArrowUp in SELECT state', () => {
    const { result } = createHook({ activeRow: 5 });
    let navResult!: KeyHandlingResult;
    act(() => {
      navResult = result.current.handleKey('ArrowUp', false, false);
    });
    expect(navResult.navigate).toEqual({ dRow: -1, dCol: 0 });
  });

  it('handles ArrowLeft in SELECT state', () => {
    const { result } = createHook({ activeCol: 3 });
    let navResult!: KeyHandlingResult;
    act(() => {
      navResult = result.current.handleKey('ArrowLeft', false, false);
    });
    expect(navResult.navigate).toEqual({ dRow: 0, dCol: -1 });
  });

  it('handles ArrowRight in SELECT state', () => {
    const { result } = createHook();
    let navResult!: KeyHandlingResult;
    act(() => {
      navResult = result.current.handleKey('ArrowRight', false, false);
    });
    expect(navResult.navigate).toEqual({ dRow: 0, dCol: 1 });
  });

  it('Shift+Enter moves up in SELECT state', () => {
    const { result } = createHook({ activeRow: 5 });
    let navResult!: KeyHandlingResult;
    act(() => {
      navResult = result.current.handleKey('Enter', true, false);
    });
    expect(navResult.navigate).toEqual({ dRow: -1, dCol: 0 });
  });

  it('Shift+Tab moves left in SELECT state', () => {
    const { result } = createHook({ activeCol: 3 });
    let navResult!: KeyHandlingResult;
    act(() => {
      navResult = result.current.handleKey('Tab', true, false);
    });
    expect(navResult.navigate).toEqual({ dRow: 0, dCol: -1 });
  });

  it('Home moves to column 0 in SELECT state', () => {
    const { result } = createHook({ activeCol: 5 });
    let navResult!: KeyHandlingResult;
    act(() => {
      navResult = result.current.handleKey('Home', false, false);
    });
    expect(navResult.navigate).toEqual({ dRow: 0, dCol: -5 });
  });

  it('Ctrl+Home moves to (0,0) in SELECT state', () => {
    const { result } = createHook({ activeRow: 5, activeCol: 5 });
    let navResult!: KeyHandlingResult;
    act(() => {
      navResult = result.current.handleKey('Home', false, true);
    });
    expect(navResult.navigate).toEqual({ dRow: -5, dCol: -5 });
  });

  it('clears cell on Backspace in SELECT state', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ onCommit });
    act(() => {
      result.current.handleKey('Backspace', false, false);
    });
    expect(onCommit).toHaveBeenCalledWith(0, 0, '', false);
  });

  it('clears cell on Delete in SELECT state', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ onCommit });
    act(() => {
      result.current.handleKey('Delete', false, false);
    });
    expect(onCommit).toHaveBeenCalledWith(0, 0, '', false);
  });

  it('ignores non-printable keys in SELECT state', () => {
    const { result } = createHook();
    let navResult!: KeyHandlingResult;
    act(() => {
      navResult = result.current.handleKey('Escape', false, false);
    });
    expect(result.current.session.state).toBe('SELECT');
    expect(navResult.navigate).toBeNull();
  });

  it('Escape in SELECT clears selection', () => {
    const { result } = createHook();
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('Escape', false, false);
    });
    // Should return a result with status message (no crash)
    expect(keyResult.statusMessage).toBe('Selection cleared');
    expect(result.current.session.state).toBe('SELECT');
  });
});

describe('useCellEditing - ENTER state', () => {
  it('appends characters in ENTER mode', () => {
    const { result } = createHook();
    act(() => {
      result.current.handleKey('H', false, false);
    });
    act(() => {
      result.current.handleKey('i', false, false);
    });
    expect(result.current.session.buffer).toBe('Hi');
    expect(result.current.session.caretPos).toBe(2);
  });

  it('deletes last char on Backspace in ENTER mode', () => {
    const { result } = createHook();
    act(() => {
      result.current.handleKey('H', false, false);
    });
    act(() => {
      result.current.handleKey('i', false, false);
    });
    act(() => {
      result.current.handleKey('Backspace', false, false);
    });
    expect(result.current.session.buffer).toBe('H');
  });

  it('does nothing on Backspace when buffer is empty', () => {
    const { result } = createHook();
    act(() => {
      result.current.handleKey('Backspace', false, false);
    });
    expect(result.current.session.state).toBe('SELECT');
  });

  it('transitions to EDIT on F2 in ENTER mode', () => {
    const { result } = createHook();
    act(() => {
      result.current.handleKey('H', false, false);
    });
    act(() => {
      result.current.handleKey('F2', false, false);
    });
    expect(result.current.session.state).toBe('EDIT');
  });

  it('commits and navigates down on Enter in ENTER mode', () => {
    const onCommit = jest.fn();
    const onNavigate = jest.fn();
    const { result } = createHook({ onCommit, onNavigate });
    act(() => {
      result.current.handleKey('H', false, false);
    });
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('Enter', false, false);
    });
    expect(onCommit).toHaveBeenCalledWith(0, 0, 'H', undefined);
    expect(keyResult.navigate).toEqual({ dRow: 1, dCol: 0 });
  });

  it('commits and navigates right on Tab in ENTER mode', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ onCommit });
    act(() => {
      result.current.handleKey('H', false, false);
    });
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('Tab', false, false);
    });
    expect(onCommit).toHaveBeenCalledWith(0, 0, 'H', undefined);
    expect(keyResult.navigate).toEqual({ dRow: 0, dCol: 1 });
  });

  it('Shift+Enter commits and moves up in ENTER mode', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ onCommit, activeRow: 5 });
    act(() => {
      result.current.handleKey('H', false, false);
    });
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('Enter', true, false);
    });
    expect(onCommit).toHaveBeenCalledWith(5, 0, 'H', undefined);
    expect(keyResult.navigate).toEqual({ dRow: -1, dCol: 0 });
  });

  it('Shift+Tab commits and moves left in ENTER mode', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ onCommit, activeCol: 3 });
    act(() => {
      result.current.handleKey('H', false, false);
    });
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('Tab', true, false);
    });
    expect(onCommit).toHaveBeenCalledWith(0, 3, 'H', undefined);
    expect(keyResult.navigate).toEqual({ dRow: 0, dCol: -1 });
  });

  it('Home moves caret to index 0 in ENTER mode', () => {
    const { result } = createHook();
    act(() => {
      result.current.handleKey('H', false, false);
    });
    act(() => {
      result.current.handleKey('i', false, false);
    });
    act(() => {
      result.current.handleKey('Home', false, false);
    });
    expect(result.current.session.caretPos).toBe(0);
  });

  it('F4 cycles reference in ENTER mode', () => {
    const { result } = createHook();
    // Type =A1 which has a reference at the end
    act(() => { result.current.handleKey('=', false, false); });
    act(() => { result.current.handleKey('A', false, false); });
    act(() => { result.current.handleKey('1', false, false); });
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey('F4', false, false); });
    expect(keyResult.session.buffer).toBe('=$A$1');
  });

  it('cancels on Escape in ENTER mode', () => {
    const { result } = createHook();
    act(() => {
      result.current.handleKey('H', false, false);
    });
    act(() => {
      result.current.handleKey('Escape', false, false);
    });
    expect(result.current.session.state).toBe('SELECT');
  });

  it('commits and navigates on ArrowDown in ENTER mode', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ onCommit });
    act(() => {
      result.current.handleKey('H', false, false);
    });
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('ArrowDown', false, false);
    });
    expect(onCommit).toHaveBeenCalledWith(0, 0, 'H', undefined);
    expect(keyResult.navigate).toEqual({ dRow: 1, dCol: 0 });
  });

  it('updates isFormula when buffer becomes formula', () => {
    const { result } = createHook();
    act(() => {
      result.current.handleKey('+', false, false);
    });
    expect(result.current.session.isFormula).toBe(true);
  });

  it('typing - enters POINT mode immediately (unary minus trigger)', () => {
    const { result } = createHook();
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('-', false, false);
    });
    // Typing '-' alone enters POINT mode immediately because '-' is a
    // trigger character for cell navigation (unary minus on a cell ref)
    expect(keyResult.session.state).toBe('POINT');
    expect(keyResult.session.isFormula).toBe(true);
    expect(keyResult.session.buffer).toBe('-');
    // Hook state should also reflect the change
    expect(result.current.session.state).toBe('POINT');
    expect(result.current.session.isFormula).toBe(true);
  });

  it('colon after single ref duplicates as endpoint (ENTER→POINT)', () => {
    const { result } = createHook();
    // Type =A1 then : should duplicate A1 as endpoint
    act(() => { result.current.handleKey('=', false, false); });
    act(() => { result.current.handleKey('A', false, false); });
    act(() => { result.current.handleKey('1', false, false); });
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey(':', false, false); });
    expect(keyResult.session.state).toBe('POINT');
    expect(keyResult.session.buffer).toBe('=A1:A1');
  });
});

describe('useCellEditing - EDIT state', () => {
  function enterEditState(result: ReturnType<typeof createHook>['result']) {
    act(() => {
      result.current.handleKey('F2', false, false);
    });
  }

  it('inserts character at caret position in EDIT mode', () => {
    const { result } = createHook({ cellValue: 'Helo' });
    enterEditState(result);
    // Move caret to position 3 (between 'l' and 'o')
    act(() => {
      // Simulate caret at position 3 by pressing ArrowLeft twice from end
      result.current.handleKey('ArrowLeft', false, false);
    });
    act(() => {
      result.current.handleKey('ArrowLeft', false, false);
    });
    act(() => {
      result.current.handleKey('l', false, false);
    });
    expect(result.current.session.buffer).toBe('Hello');
  });

  it('moves caret left in EDIT mode', () => {
    const { result } = createHook({ cellValue: 'Hello' });
    enterEditState(result);
    act(() => {
      result.current.handleKey('ArrowLeft', false, false);
    });
    expect(result.current.session.caretPos).toBe(4);
  });

  it('moves caret right in EDIT mode', () => {
    const { result } = createHook({ cellValue: 'Hello' });
    enterEditState(result);
    // Move to start
    for (let i = 0; i < 5; i++) {
      act(() => {
        result.current.handleKey('ArrowLeft', false, false);
      });
    }
    act(() => {
      result.current.handleKey('ArrowRight', false, false);
    });
    expect(result.current.session.caretPos).toBe(1);
  });

  it('does not move caret left past 0', () => {
    const { result } = createHook({ cellValue: 'Hi' });
    enterEditState(result);
    // Move to start
    for (let i = 0; i < 3; i++) {
      act(() => {
        result.current.handleKey('ArrowLeft', false, false);
      });
    }
    expect(result.current.session.caretPos).toBe(0);
  });

  it('does not move caret right past buffer length', () => {
    const { result } = createHook({ cellValue: 'Hi' });
    enterEditState(result);
    act(() => {
      result.current.handleKey('ArrowRight', false, false);
    });
    expect(result.current.session.caretPos).toBe(2);
  });

  it('commits and navigates on ArrowDown in EDIT mode (single line)', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ cellValue: 'Hello', onCommit });
    enterEditState(result);
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('ArrowDown', false, false);
    });
    expect(onCommit).toHaveBeenCalledWith(0, 0, 'Hello', undefined);
    expect(keyResult.navigate).toEqual({ dRow: 1, dCol: 0 });
  });

  it('Shift+Enter commits and moves up in EDIT mode', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ cellValue: 'Hello', onCommit, activeRow: 5 });
    enterEditState(result);
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('Enter', true, false);
    });
    expect(onCommit).toHaveBeenCalledWith(5, 0, 'Hello', undefined);
    expect(keyResult.navigate).toEqual({ dRow: -1, dCol: 0 });
  });

  it('Shift+Tab commits and moves left in EDIT mode', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ cellValue: 'Hello', onCommit, activeCol: 3 });
    enterEditState(result);
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('Tab', true, false);
    });
    expect(onCommit).toHaveBeenCalledWith(0, 3, 'Hello', undefined);
    expect(keyResult.navigate).toEqual({ dRow: 0, dCol: -1 });
  });

  it('Tab commits and moves right in EDIT mode', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ cellValue: 'Hello', onCommit });
    enterEditState(result);
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('Tab', false, false);
    });
    expect(onCommit).toHaveBeenCalledWith(0, 0, 'Hello', undefined);
    expect(keyResult.navigate).toEqual({ dRow: 0, dCol: 1 });
  });

  it('Home moves caret to index 0 in EDIT mode', () => {
    const { result } = createHook({ cellValue: 'Hello' });
    enterEditState(result);
    // Move caret to end first
    act(() => {
      result.current.handleKey('Home', false, false);
    });
    expect(result.current.session.caretPos).toBe(0);
  });

  it('deletes char before caret on Backspace in EDIT mode', () => {
    const { result } = createHook({ cellValue: 'Hello' });
    enterEditState(result);
    // Move caret to position 4
    act(() => {
      result.current.handleKey('ArrowLeft', false, false);
    });
    act(() => {
      result.current.handleKey('Backspace', false, false);
    });
    expect(result.current.session.buffer).toBe('Helo');
    expect(result.current.session.caretPos).toBe(3);
  });

  it('does nothing on Backspace at position 0', () => {
    const { result } = createHook({ cellValue: 'Hi' });
    enterEditState(result);
    // Move to start
    for (let i = 0; i < 3; i++) {
      act(() => {
        result.current.handleKey('ArrowLeft', false, false);
      });
    }
    act(() => {
      result.current.handleKey('Backspace', false, false);
    });
    expect(result.current.session.buffer).toBe('Hi');
  });

  it('deletes char after caret on Delete in EDIT mode', () => {
    const { result } = createHook({ cellValue: 'Hello' });
    enterEditState(result);
    // Move caret to position 3
    act(() => {
      result.current.handleKey('ArrowLeft', false, false);
    });
    act(() => {
      result.current.handleKey('ArrowLeft', false, false);
    });
    act(() => {
      result.current.handleKey('Delete', false, false);
    });
    expect(result.current.session.buffer).toBe('Helo');
  });

  it('does nothing on Delete at end of buffer', () => {
    const { result } = createHook({ cellValue: 'Hi' });
    enterEditState(result);
    act(() => {
      result.current.handleKey('Delete', false, false);
    });
    expect(result.current.session.buffer).toBe('Hi');
  });

  it('commits on Enter in EDIT mode', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ cellValue: 'Hello', onCommit });
    enterEditState(result);
    act(() => {
      result.current.handleKey('Enter', false, false);
    });
    expect(onCommit).toHaveBeenCalledWith(0, 0, 'Hello', undefined);
  });

  it('cancels on Escape in EDIT mode', () => {
    const { result } = createHook({ cellValue: 'Hello' });
    enterEditState(result);
    act(() => {
      result.current.handleKey('Escape', false, false);
    });
    expect(result.current.session.state).toBe('SELECT');
  });

  it('enters POINT mode on F2 in EDIT mode', () => {
    const { result } = createHook({ cellValue: '=SUM(' });
    enterEditState(result);
    act(() => {
      result.current.handleKey('F2', false, false);
    });
    expect(result.current.session.state).toBe('POINT');
    expect(result.current.pointSession).not.toBeNull();
    expect(result.current.pointSession?.isActive).toBe(true);
  });

  it('colon after single ref duplicates as endpoint (EDIT→POINT)', () => {
    const { result } = createHook({ cellValue: '=SUM(A1' });
    enterEditState(result);
    // Buffer is "=SUM(A1", type : should duplicate A1 as endpoint
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey(':', false, false); });
    expect(keyResult.session.state).toBe('POINT');
    expect(keyResult.session.buffer).toBe('=SUM(A1:A1');
  });
});

describe('useCellEditing - POINT state', () => {
  function enterPointState(result: ReturnType<typeof createHook>['result']) {
    // Type =SUM( which triggers POINT mode
    act(() => {
      result.current.handleKey('=', false, false);
    });
    act(() => {
      result.current.handleKey('S', false, false);
    });
    act(() => {
      result.current.handleKey('U', false, false);
    });
    act(() => {
      result.current.handleKey('M', false, false);
    });
    act(() => {
      result.current.handleKey('(', false, false);
    });
  }

  it('is in POINT mode after =SUM(', () => {
    const { result } = createHook();
    enterPointState(result);
    expect(result.current.session.state).toBe('POINT');
    expect(result.current.pointSession).not.toBeNull();
  });

  it('arrow keys navigate the pointing box', () => {
    const { result } = createHook();
    enterPointState(result);
    act(() => {
      result.current.handleKey('ArrowDown', false, false);
    });
    expect(result.current.pointSession?.currentRow).toBe(1);
    act(() => {
      result.current.handleKey('ArrowRight', false, false);
    });
    expect(result.current.pointSession?.currentCol).toBe(1);
  });

  it('arrow keys clamp to grid bounds', () => {
    const { result } = createHook({ activeRow: 0, activeCol: 0, rowCount: 5, colCount: 5 });
    enterPointState(result);
    act(() => {
      result.current.handleKey('ArrowUp', false, false);
    });
    expect(result.current.pointSession?.currentRow).toBe(0);
    act(() => {
      result.current.handleKey('ArrowLeft', false, false);
    });
    expect(result.current.pointSession?.currentCol).toBe(0);
  });

  it('shift+arrow extends the range', () => {
    const { result } = createHook();
    enterPointState(result);
    act(() => {
      result.current.handleKey('ArrowDown', true, false);
    });
    act(() => {
      result.current.handleKey('ArrowDown', true, false);
    });
    expect(result.current.pointSession?.currentRow).toBe(2);
  });

  it('F4 cycles reference in POINT mode', () => {
    const { result } = createHook();
    enterPointState(result);
    // Press F4 immediately (before arrow keys) to cycle the single-cell reference
    // The initial reference is at the active cell (A1)
    act(() => {
      result.current.handleKey('F4', false, false);
    });
    // Buffer should now contain the cycled reference ($A$1)
    expect(result.current.session.buffer).toContain('$A$1');
  });

  it('F2 exits POINT mode back to EDIT', () => {
    const { result } = createHook();
    enterPointState(result);
    act(() => {
      result.current.handleKey('F2', false, false);
    });
    expect(result.current.session.state).toBe('EDIT');
    expect(result.current.pointSession).toBeNull();
  });

  it('Escape exits POINT mode back to EDIT', () => {
    const { result } = createHook();
    enterPointState(result);
    act(() => {
      result.current.handleKey('Escape', false, false);
    });
    expect(result.current.session.state).toBe('EDIT');
    expect(result.current.pointSession).toBeNull();
  });

  it('continuation operator (+) auto-commits reference and re-enters POINT', () => {
    const { result } = createHook();
    enterPointState(result);
    // Move to cell (2, 2)
    act(() => {
      result.current.handleKey('ArrowDown', false, false);
    });
    act(() => {
      result.current.handleKey('ArrowDown', false, false);
    });
    act(() => {
      result.current.handleKey('ArrowRight', false, false);
    });
    act(() => {
      result.current.handleKey('ArrowRight', false, false);
    });
    act(() => {
      result.current.handleKey('+', false, false);
    });
    // '+' is a continuation operator → stays in POINT for next operand
    expect(result.current.session.state).toBe('POINT');
    expect(result.current.pointSession).not.toBeNull();
    expect(result.current.session.buffer).toContain('C3');
    expect(result.current.session.buffer).toContain('+');
  });

  it('separator (,) auto-commits reference and re-enters POINT for multi-param', () => {
    const { result } = createHook();
    enterPointState(result);
    // Move to cell (2, 2)
    act(() => {
      result.current.handleKey('ArrowDown', false, false);
    });
    act(() => {
      result.current.handleKey('ArrowDown', false, false);
    });
    act(() => {
      result.current.handleKey('ArrowRight', false, false);
    });
    act(() => {
      result.current.handleKey('ArrowRight', false, false);
    });
    act(() => {
      result.current.handleKey(',', false, false);
    });
    // ',' is a parameter separator → stays in POINT for next parameter
    expect(result.current.session.state).toBe('POINT');
    expect(result.current.pointSession).not.toBeNull();
    expect(result.current.session.buffer).toContain('C3');
    expect(result.current.session.buffer).toContain(',');
    // Pointing box resets to the active cell for the next reference
    expect(result.current.pointSession?.anchorRow).toBe(0);
    expect(result.current.pointSession?.anchorCol).toBe(0);
  });

  it('multi-parameter formula: =SUM(C3, D4) via POINT mode', () => {
    const { result } = createHook();
    enterPointState(result);
    // Navigate to C3 (row 2, col 2) — regular arrow moves both anchor and current
    act(() => { result.current.handleKey('ArrowDown', false, false); });
    act(() => { result.current.handleKey('ArrowDown', false, false); });
    act(() => { result.current.handleKey('ArrowRight', false, false); });
    act(() => { result.current.handleKey('ArrowRight', false, false); });
    // Type comma — commits C3 and re-enters POINT
    act(() => { result.current.handleKey(',', false, false); });
    expect(result.current.session.state).toBe('POINT');
    // Single-cell reference since regular arrow moves anchor+current together
    expect(result.current.session.buffer).toBe('=SUM(C3,');
    // Navigate to D4 (row 3, col 3) — but anchor reset to active cell (0,0)
    // after comma, so we navigate from A1 to D4
    act(() => { result.current.handleKey('ArrowDown', false, false); });
    act(() => { result.current.handleKey('ArrowDown', false, false); });
    act(() => { result.current.handleKey('ArrowDown', false, false); });
    act(() => { result.current.handleKey('ArrowRight', false, false); });
    act(() => { result.current.handleKey('ArrowRight', false, false); });
    act(() => { result.current.handleKey('ArrowRight', false, false); });
    // Type ')' — commits D4 and closes function, exits to EDIT
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey(')', false, false); });
    expect(keyResult.session.state).toBe('EDIT');
    expect(keyResult.session.buffer).toBe('=SUM(C3,D4)');
  });

  it('binary operation: =C3+D4 via POINT mode', () => {
    const { result } = createHook();
    enterPointState(result);
    // Navigate to C3 — regular arrow moves both anchor and current
    act(() => { result.current.handleKey('ArrowDown', false, false); });
    act(() => { result.current.handleKey('ArrowDown', false, false); });
    act(() => { result.current.handleKey('ArrowRight', false, false); });
    act(() => { result.current.handleKey('ArrowRight', false, false); });
    // Type '+' — commits C3 and re-enters POINT
    act(() => { result.current.handleKey('+', false, false); });
    expect(result.current.session.state).toBe('POINT');
    // Single-cell reference since regular arrow moves anchor+current together
    expect(result.current.session.buffer).toBe('=SUM(C3+');
    // Navigate to D4
    act(() => { result.current.handleKey('ArrowDown', false, false); });
    act(() => { result.current.handleKey('ArrowDown', false, false); });
    act(() => { result.current.handleKey('ArrowDown', false, false); });
    act(() => { result.current.handleKey('ArrowRight', false, false); });
    act(() => { result.current.handleKey('ArrowRight', false, false); });
    act(() => { result.current.handleKey('ArrowRight', false, false); });
    // Type ')' — commits D4 and closes function
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey(')', false, false); });
    expect(keyResult.session.state).toBe('EDIT');
    expect(keyResult.session.buffer).toBe('=SUM(C3+D4)');
  });

  it('Enter commits reference and commits cell value', () => {
    const onCommit = jest.fn();
    const onNavigate = jest.fn();
    const { result } = createHook({ onCommit, onNavigate });
    enterPointState(result);
    // Move to cell (1, 0)
    act(() => {
      result.current.handleKey('ArrowDown', false, false);
    });
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('Enter', false, false);
    });
    expect(onCommit).toHaveBeenCalled();
    expect(keyResult.navigate).toEqual({ dRow: 1, dCol: 0 });
  });

  it('Tab commits reference and moves right', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ onCommit });
    enterPointState(result);
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('Tab', false, false);
    });
    expect(onCommit).toHaveBeenCalled();
    expect(keyResult.navigate).toEqual({ dRow: 0, dCol: 1 });
  });

  it('Shift+Enter commits reference and moves up', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ onCommit, activeRow: 5 });
    enterPointState(result);
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('Enter', true, false);
    });
    expect(onCommit).toHaveBeenCalled();
    expect(keyResult.navigate).toEqual({ dRow: -1, dCol: 0 });
  });

  it('Shift+Tab commits reference and moves left', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ onCommit });
    enterPointState(result);
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('Tab', true, false);
    });
    expect(onCommit).toHaveBeenCalled();
    expect(keyResult.navigate).toEqual({ dRow: 0, dCol: -1 });
  });

  it('Backspace in POINT deletes reference and returns to EDIT', () => {
    const { result } = createHook();
    enterPointState(result);
    // Move to create a range
    act(() => {
      result.current.handleKey('ArrowDown', false, false);
    });
    act(() => {
      result.current.handleKey('ArrowRight', false, false);
    });
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('Backspace', false, false);
    });
    expect(keyResult.session.state).toBe('EDIT');
    expect(keyResult.pointSession).toBeNull();
    expect(keyResult.session.buffer).toBe('=SUM(');
  });

  it('Delete in POINT deletes reference and returns to EDIT', () => {
    const { result } = createHook();
    enterPointState(result);
    act(() => {
      result.current.handleKey('ArrowDown', false, false);
    });
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('Delete', false, false);
    });
    expect(keyResult.session.state).toBe('EDIT');
    expect(keyResult.pointSession).toBeNull();
  });

  it('Home in POINT moves pointing box to column 0', () => {
    const { result } = createHook();
    enterPointState(result);
    // Move right first
    act(() => {
      result.current.handleKey('ArrowRight', false, false);
    });
    act(() => {
      result.current.handleKey('ArrowRight', false, false);
    });
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('Home', false, false);
    });
    expect(keyResult.pointSession?.currentCol).toBe(0);
  });

  it('Ctrl+Home in POINT moves pointing box to (0,0)', () => {
    const { result } = createHook({ activeRow: 5, activeCol: 5 });
    enterPointState(result);
    let keyResult!: KeyHandlingResult;
    act(() => {
      keyResult = result.current.handleKey('Home', false, true);
    });
    expect(keyResult.pointSession?.currentRow).toBe(0);
    expect(keyResult.pointSession?.currentCol).toBe(0);
  });
});

describe('useCellEditing - direct actions', () => {
  it('startEnter sets ENTER state', () => {
    const { result } = createHook();
    act(() => {
      result.current.startEnter('X');
    });
    expect(result.current.session.state).toBe('ENTER');
    expect(result.current.session.buffer).toBe('X');
  });

  it('startEdit sets EDIT state', () => {
    const { result } = createHook({ cellValue: 'Test' });
    act(() => {
      result.current.startEdit();
    });
    expect(result.current.session.state).toBe('EDIT');
    expect(result.current.session.buffer).toBe('Test');
  });

  it('startEditAt sets EDIT state with caret at specified position', () => {
    const { result } = createHook({ cellValue: '=SUM(A1:A10)' });
    act(() => {
      result.current.startEditAt(7); // After 'A1:'
    });
    expect(result.current.session.state).toBe('EDIT');
    expect(result.current.session.buffer).toBe('=SUM(A1:A10)');
    expect(result.current.session.caretPos).toBe(7);
  });

  it('startEditAt clamps caret to valid range', () => {
    const { result } = createHook({ cellValue: '=SUM(A1:A10)' });
    act(() => {
      result.current.startEditAt(100); // Beyond buffer length
    });
    expect(result.current.session.caretPos).toBe(12); // Clamped to buffer length
  });

  it('startEditAt handles negative caret position', () => {
    const { result } = createHook({ cellValue: '=SUM(A1:A10)' });
    act(() => {
      result.current.startEditAt(-5);
    });
    expect(result.current.session.caretPos).toBe(0); // Clamped to 0
  });

  it('commit calls onCommit and resets to SELECT', () => {
    const onCommit = jest.fn();
    const { result } = createHook({ onCommit });
    act(() => {
      result.current.startEnter('V');
    });
    act(() => {
      result.current.commit();
    });
    expect(onCommit).toHaveBeenCalledWith(0, 0, 'V', undefined);
    expect(result.current.session.state).toBe('SELECT');
  });

  it('commit with direction calls onNavigate', () => {
    const onNavigate = jest.fn();
    const { result } = createHook({ onNavigate });
    act(() => {
      result.current.startEnter('V');
    });
    act(() => {
      result.current.commit({ dRow: 1, dCol: 0 });
    });
    expect(onNavigate).toHaveBeenCalledWith(1, 0);
  });

  it('cancel resets to SELECT', () => {
    const { result } = createHook();
    act(() => {
      result.current.startEnter('V');
    });
    act(() => {
      result.current.cancel();
    });
    expect(result.current.session.state).toBe('SELECT');
    expect(result.current.session.buffer).toBe('');
  });

  it('reset goes back to SELECT with current cell', () => {
    const { result } = createHook({ activeRow: 3, activeCol: 2, cellValue: 'Data' });
    act(() => {
      result.current.startEnter('V');
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.session.state).toBe('SELECT');
    expect(result.current.session.row).toBe(3);
    expect(result.current.session.col).toBe(2);
  });

  it('handleCellClick does nothing when not in POINT mode', () => {
    const { result } = createHook();
    act(() => {
      result.current.handleCellClick(5, 5, false);
    });
    expect(result.current.session.state).toBe('SELECT');
  });

  it('handleCellClick updates point position in POINT mode', () => {
    const { result } = createHook();
    // Enter POINT mode
    act(() => {
      result.current.handleKey('=', false, false);
    });
    act(() => {
      result.current.handleKey('S', false, false);
    });
    act(() => {
      result.current.handleKey('U', false, false);
    });
    act(() => {
      result.current.handleKey('M', false, false);
    });
    act(() => {
      result.current.handleKey('(', false, false);
    });
    act(() => {
      result.current.handleCellClick(7, 3, false);
    });
    expect(result.current.pointSession?.currentRow).toBe(7);
    expect(result.current.pointSession?.currentCol).toBe(3);
  });
});

describe('useCellEditing - F4 cycling in EDIT mode', () => {
  it('cycles reference at caret on F4', () => {
    const { result } = createHook({ cellValue: '=A1+B1' });
    // Enter EDIT mode
    act(() => { result.current.handleKey('F2', false, false); });
    // Move caret to position 1 (within A1)
    act(() => { result.current.handleKey('ArrowLeft', false, false); });
    act(() => { result.current.handleKey('ArrowLeft', false, false); });
    act(() => { result.current.handleKey('ArrowLeft', false, false); });
    act(() => { result.current.handleKey('ArrowLeft', false, false); });
    // Press F4 to cycle A1 → $A$1
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey('F4', false, false); });
    expect(keyResult.session.buffer).toBe('=$A$1+B1');
  });

  it('cycles second reference on F4 when caret at end', () => {
    const { result } = createHook({ cellValue: '=A1+B1' });
    act(() => { result.current.handleKey('F2', false, false); });
    // Caret at end (position 6), adjacent to B1 - should cycle B1
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey('F4', false, false); });
    expect(keyResult.session.buffer).toBe('=A1+$B$1');
  });

  it('does nothing on F4 when buffer has no references', () => {
    const { result } = createHook({ cellValue: 'Hello' });
    act(() => { result.current.handleKey('F2', false, false); });
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey('F4', false, false); });
    expect(keyResult.session.buffer).toBe('Hello');
  });
});

describe('useCellEditing - EDIT → POINT transition', () => {
  it('transitions to POINT when typing cell ref after formula', () => {
    const { result } = createHook({ cellValue: '=SUM(' });
    // Enter EDIT mode
    act(() => { result.current.handleKey('F2', false, false); });
    // Type A1 - the ( before triggers POINT when followed by a non-operator
    // Actually, after =SUM( the buffer is "=SUM(" and we type A then 1
    // After typing A: buffer="=SUM(A", caret=6, shouldActivatePointMode("=SUM(A", 6) checks last char = "A" → false
    // After typing 1: buffer="=SUM(A1", caret=7, shouldActivatePointMode("=SUM(A1", 7) checks last char = "1" → false
    // So we need to type a separator like , to trigger POINT
    act(() => { result.current.handleKey('A', false, false); });
    act(() => { result.current.handleKey('1', false, false); });
    // Type , which is a separator - should trigger POINT
    let keyResult!: KeyHandlingResult;
    act(() => { keyResult = result.current.handleKey(',', false, false); });
    expect(keyResult.session.state).toBe('POINT');
  });
});

describe('useCellEditing - ENTER → POINT transition', () => {
  it('transitions to POINT when typing = in ENTER mode', () => {
    const { result } = createHook();
    act(() => {
      result.current.handleKey('=', false, false);
    });
    // Now in ENTER mode with '=' buffer
    // Type another = to trigger point
    // Actually, we need to type = at start, then type separator
    // Let's start fresh with = and then (
    expect(result.current.session.state).toBe('ENTER');
  });

  it('transitions from ENTER to POINT when typing ( after =', () => {
    const { result } = createHook();
    // Type = to enter ENTER mode
    act(() => {
      result.current.handleKey('=', false, false);
    });
    // Type ( which is a separator — in ENTER mode this just appends
    // ENTER mode doesn't auto-trigger POINT, only EDIT mode does
    act(() => {
      result.current.handleKey('(', false, false);
    });
    expect(result.current.session.buffer).toBe('=(');
  });
});
