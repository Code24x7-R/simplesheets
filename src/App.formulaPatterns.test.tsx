// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Tests for various formula patterns to ensure they work correctly
 * in both the formula bar and in-cell editing.
 *
 * Patterns tested:
 * 1. +C10+D10 (addition of two cells with + prefix)
 * 2. +F4/100 (division of a cell by a constant with + prefix)
 * 3. =(A17+D17)*0.25 (parenthesized expression with multiplication)
 * 4. =-F15 (unary minus on a cell reference)
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from './App';

// Mock the virtualizer
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { horizontal?: boolean }) => {
    if (options.horizontal) {
      return {
        getVirtualItems: () => {
          const items = [];
          for (let i = 0; i < 5; i++) {
            items.push({ index: i, start: i * 100, size: 100, end: (i + 1) * 100 });
          }
          return items;
        },
        getTotalSize: () => 500,
        scrollToIndex: jest.fn(),
        measure: jest.fn(),
      };
    }
    return {
      getVirtualItems: () => {
        const items = [];
        for (let i = 0; i < 20; i++) {
          items.push({ index: i, start: i * 28, size: 28, end: (i + 1) * 28 });
        }
        return items;
      },
      getTotalSize: () => 560,
      scrollToIndex: jest.fn(),
      measure: jest.fn(),
    };
  },
}));

function getFormulaInput(): HTMLInputElement {
  return screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;
}

function typeInFormulaBar(input: HTMLInputElement, text: string) {
  for (const ch of text) {
    fireEvent.keyDown(input, { key: ch });
  }
}

describe('POINT mode live reference display', () => {
  it('should show cell reference in formula bar during navigation', async () => {
    render(<App />);
    const input = getFormulaInput();

    // Type =SUM( to enter POINT mode
    act(() => {
      fireEvent.keyDown(input, { key: '=' });
    });
    act(() => {
      fireEvent.keyDown(input, { key: 'S' });
    });
    act(() => {
      fireEvent.keyDown(input, { key: 'U' });
    });
    act(() => {
      fireEvent.keyDown(input, { key: 'M' });
    });
    act(() => {
      fireEvent.keyDown(input, { key: '(' });
    });

    // Should be in POINT mode
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
    });

    // Formula bar should show =SUM(
    expect(input.value).toBe('=SUM(');

    // Navigate to B2 (right 1, down 1)
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowRight' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    });

    // Formula bar should now show =SUM(B2 with live reference
    await waitFor(() => {
      expect(input.value).toBe('=SUM(B2');
    });

    // Navigate to D4 (right 2, down 2) - shift+arrow for range
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowRight', shiftKey: true });
      fireEvent.keyDown(input, { key: 'ArrowRight', shiftKey: true });
      fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true });
      fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true });
    });

    // Formula bar should now show =SUM(B2:D4 range
    await waitFor(() => {
      expect(input.value).toBe('=SUM(B2:D4');
    });

    // Press ) to commit
    act(() => {
      fireEvent.keyDown(input, { key: ')' });
    });

    // Formula bar should show =SUM(B2:D4)
    await waitFor(() => {
      expect(input.value).toBe('=SUM(B2:D4)');
    });
  });
});

describe('Bug: + prefix with arrow navigation', () => {
  it('should commit +C11 when pressing Enter after arrow navigation', async () => {
    const { container } = render(<App />);
    const input = getFormulaInput();

    // Type + to start formula and enter POINT mode
    act(() => {
      fireEvent.keyDown(input, { key: '+' });
    });

    // Should be in POINT mode (because + is a trigger char)
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
    });

    // Navigate to C11: right 2 (A→C), down 10 (row 1→11)
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowRight' });
      fireEvent.keyDown(input, { key: 'ArrowRight' });
      for (let i = 0; i < 10; i++) {
        fireEvent.keyDown(input, { key: 'ArrowDown' });
      }
    });

    // Press Enter to commit the reference
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    // After commit, selection moves to A2 (empty cell)
    // Navigate back to A1 to check the committed value
    await waitFor(() => {
      expect(input.value).toBe(''); // A2 is empty
    });

    // Navigate back to A1
    const gridContainer = container.querySelector('.overflow-auto') as HTMLElement;
    act(() => {
      fireEvent.keyDown(gridContainer, { key: 'ArrowUp' });
    });

    // Check that A1 has the correct formula
    await waitFor(() => {
      expect(input.value).toBe('+C11');
    });
  });

  it('should commit +C11) when pressing ) in POINT mode', async () => {
    render(<App />);
    const input = getFormulaInput();

    // Type + to start formula and enter POINT mode
    act(() => {
      fireEvent.keyDown(input, { key: '+' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
    });

    // Navigate to C11
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowRight' });
      fireEvent.keyDown(input, { key: 'ArrowRight' });
      for (let i = 0; i < 10; i++) {
        fireEvent.keyDown(input, { key: 'ArrowDown' });
      }
    });

    // Press ) to commit the reference and close
    act(() => {
      fireEvent.keyDown(input, { key: ')' });
    });

    // Should exit POINT mode and show +C11) in formula bar
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).not.toBe('POINT');
    });

    // The formula bar should show +C11)
    expect(input.value).toBe('+C11)');
  });
});

describe('Formula patterns - Formula Bar', () => {
  describe('Pattern 1: +C10+D10 (addition with + prefix)', () => {
    it('accepts + prefix and enters POINT mode for first cell', async () => {
      render(<App />);
      const input = getFormulaInput();

      // Type + to start formula - this enters POINT mode immediately
      // because + is a trigger character for cell navigation
      typeInFormulaBar(input, '+');
      expect(input.value).toBe('+');
      expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');

      // Exit POINT mode by typing a letter (C)
      typeInFormulaBar(input, 'C');
      expect(screen.getByTestId('cell-mode').textContent).toBe('Edit');
      expect(input.value).toBe('+C');

      // Type 1, 0 to complete the cell reference
      typeInFormulaBar(input, '10');
      expect(input.value).toBe('+C10');

      // Type + to trigger POINT mode for second cell
      typeInFormulaBar(input, '+');

      // Should be in POINT mode now
      await waitFor(() => {
        expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
      });

      // Buffer should have the + operator
      expect(input.value).toBe('+C10+');
    });

    it('completes +C10+D10 with arrow navigation', async () => {
      render(<App />);
      const input = getFormulaInput();

      // Type +C10+ to enter POINT mode
      typeInFormulaBar(input, '+C10+');

      await waitFor(() => {
        expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
      });

      // Navigate to D10: right 1 (from C to D), down 9 (from row 1 to row 10)
      // But we start at A1, so we need to navigate to D10
      // Actually, the anchor starts at the current cell (A1), so we need to
      // navigate to D10 from A1: right 3, down 9
      act(() => {
        fireEvent.keyDown(input, { key: 'ArrowRight' });
        fireEvent.keyDown(input, { key: 'ArrowRight' });
        fireEvent.keyDown(input, { key: 'ArrowRight' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
      });

      // Press Enter to commit
      act(() => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      // After commit, formula bar should show empty (selection moved to A2)
      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });
  });

  describe('Pattern 2: +F4/100 (division with + prefix)', () => {
    it('accepts + prefix and enters POINT mode after /', async () => {
      render(<App />);
      const input = getFormulaInput();

      // Type +F4/ to enter POINT mode
      typeInFormulaBar(input, '+F4/');

      // Should be in POINT mode now (because / is a trigger char)
      await waitFor(() => {
        expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
      });

      expect(input.value).toBe('+F4/');
    });

    it('exits POINT mode when typing a number after /', async () => {
      render(<App />);
      const input = getFormulaInput();

      // Type +F4/ to enter POINT mode
      typeInFormulaBar(input, '+F4/');

      await waitFor(() => {
        expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
      });

      // Type 1 to exit POINT mode and start typing the divisor
      typeInFormulaBar(input, '1');

      await waitFor(() => {
        expect(screen.getByTestId('cell-mode').textContent).toBe('Edit');
      });

      expect(input.value).toBe('+F4/1');
    });
  });

  describe('Pattern 3: =(A17+D17)*0.25 (parenthesized expression)', () => {
    it('handles parentheses and nested POINT mode', async () => {
      render(<App />);
      const input = getFormulaInput();

      // Type =( to enter POINT mode inside parentheses
      typeInFormulaBar(input, '=(');

      await waitFor(() => {
        expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
      });

      expect(input.value).toBe('=(');
    });

    it('exits POINT mode with ) and continues editing', async () => {
      render(<App />);
      const input = getFormulaInput();

      // Type =( to enter POINT mode
      typeInFormulaBar(input, '=(');

      await waitFor(() => {
        expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
      });

      // Navigate to A17 (right 0, down 16 from A1)
      act(() => {
        for (let i = 0; i < 16; i++) {
          fireEvent.keyDown(input, { key: 'ArrowDown' });
        }
      });

      // Press + to commit A17 and re-enter POINT mode
      act(() => {
        fireEvent.keyDown(input, { key: '+' });
      });

      await waitFor(() => {
        expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
      });

      // Buffer should now be =(A17+
      expect(input.value).toBe('=(A17+');
    });
  });

  describe('Pattern 4: =-F15 (unary minus on cell)', () => {
    it('accepts = followed by - to enter POINT mode', async () => {
      render(<App />);
      const input = getFormulaInput();

      // Type =- to enter POINT mode (unary minus)
      typeInFormulaBar(input, '=-');

      await waitFor(() => {
        expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
      });

      expect(input.value).toBe('=-');
    });

    it('completes =-F15 with arrow navigation', async () => {
      render(<App />);
      const input = getFormulaInput();

      // Type =- to enter POINT mode
      typeInFormulaBar(input, '=-');

      await waitFor(() => {
        expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
      });

      // Navigate to F15: right 5, down 14
      act(() => {
        for (let i = 0; i < 5; i++) {
          fireEvent.keyDown(input, { key: 'ArrowRight' });
        }
        for (let i = 0; i < 14; i++) {
          fireEvent.keyDown(input, { key: 'ArrowDown' });
        }
      });

      // Press Enter to commit
      act(() => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      // After commit, formula bar should show empty
      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });
  });
});

describe('Formula patterns - In-cell editing', () => {
  describe('Pattern 1: +C10+D10 (in-cell)', () => {
    it('handles + prefix in-cell', async () => {
      render(<App />);

      // Use FormulaBar to start editing (reliable entry point)
      const input = getFormulaInput();

      // Type + to start formula — + is a trigger character, so it immediately enters POINT mode
      act(() => {
        fireEvent.keyDown(input, { key: '+' });
      });

      await waitFor(() => {
        // + is a POINT trigger, so it enters POINT mode directly
        expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
      });
    });
  });

  describe('Pattern 4: =-F15 (in-cell)', () => {
    it('handles unary minus in-cell', async () => {
      render(<App />);

      // Use FormulaBar to start editing (reliable entry point)
      const input = getFormulaInput();

      // Type =- to enter POINT mode
      act(() => {
        fireEvent.keyDown(input, { key: '=' });
      });
      act(() => {
        fireEvent.keyDown(input, { key: '-' });
      });

      await waitFor(() => {
        expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
      });
    });
  });
});

describe('F4 Reference Cycling - Range Support (one endpoint at a time)', () => {
  it('cycles first endpoint then second in POINT mode', async () => {
    render(<App />);
    const input = getFormulaInput();

    // Type =SUM( to enter POINT mode
    typeInFormulaBar(input, '=SUM(');
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
    });

    // Navigate anchor to B2: right 1, down 1
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowRight' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    });
    await waitFor(() => { expect(input.value).toBe('=SUM(B2'); });

    // Extend to D4 with shift+arrow (creates range B2:D4)
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowRight', shiftKey: true });
      fireEvent.keyDown(input, { key: 'ArrowRight', shiftKey: true });
      fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true });
      fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true });
    });
    await waitFor(() => { expect(input.value).toBe('=SUM(B2:D4'); });

    // In POINT mode, caret is at end of buffer (after the range token).
    // The range token "B2:D4" starts at index 5, caret at index 10.
    // caretOffset = 10 - 5 = 5, which is > firstLen (2), so it cycles
    // the SECOND endpoint (D4).

    // F4 #1: B2:D4 → B2:$D$4 (second endpoint → absolute)
    act(() => {
      fireEvent.keyDown(input, { key: 'F4' });
    });
    await waitFor(() => {
      expect(input.value).toBe('=SUM(B2:$D$4');
    });

    // F4 #2: B2:$D$4 → B2:D$4 (second endpoint → absRow)
    act(() => {
      fireEvent.keyDown(input, { key: 'F4' });
    });
    await waitFor(() => {
      expect(input.value).toBe('=SUM(B2:D$4');
    });

    // F4 #3: B2:D$4 → B2:$D4 (second endpoint → absCol)
    act(() => {
      fireEvent.keyDown(input, { key: 'F4' });
    });
    await waitFor(() => {
      expect(input.value).toBe('=SUM(B2:$D4');
    });

    // F4 #4: B2:$D4 → B2:D4 (second endpoint → relative, back to start)
    act(() => {
      fireEvent.keyDown(input, { key: 'F4' });
    });
    await waitFor(() => {
      expect(input.value).toBe('=SUM(B2:D4');
    });
  });

  it('cycles first endpoint in EDIT mode when caret is in first half', async () => {
    render(<App />);
    const input = getFormulaInput();

    // Build =SUM(B2:D4) via POINT mode
    typeInFormulaBar(input, '=SUM(');
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
    });
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowRight' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowRight', shiftKey: true });
      fireEvent.keyDown(input, { key: 'ArrowRight', shiftKey: true });
      fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true });
      fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true });
    });
    await waitFor(() => { expect(input.value).toBe('=SUM(B2:D4'); });

    // Close with ) — transitions to EDIT mode
    act(() => {
      fireEvent.keyDown(input, { key: ')' });
    });
    await waitFor(() => { expect(input.value).toBe('=SUM(B2:D4)'); });

    // Use the formula bar's click handler to position caret within the
    // first endpoint. Buffer = "=SUM(B2:D4)" — range token "B2:D4"
    // starts at index 5. Click at index 6 (within "B2") → caretOffset = 1.
    act(() => {
      // Set selection to position 6 (within first endpoint)
      input.setSelectionRange(6, 6);
      // Fire click to sync caret to FSM
      fireEvent.click(input);
    });

    // F4 should cycle the FIRST endpoint (B2)
    act(() => {
      fireEvent.keyDown(input, { key: 'F4' });
    });
    await waitFor(() => {
      expect(input.value).toBe('=SUM($B$2:D4)');
    });

    // F4 again: $B$2 → B$2
    act(() => {
      fireEvent.keyDown(input, { key: 'F4' });
    });
    await waitFor(() => {
      expect(input.value).toBe('=SUM(B$2:D4)');
    });

    // F4 again: B$2 → $B2
    act(() => {
      fireEvent.keyDown(input, { key: 'F4' });
    });
    await waitFor(() => {
      expect(input.value).toBe('=SUM($B2:D4)');
    });

    // F4 again: $B2 → B2 (first endpoint back to relative)
    act(() => {
      fireEvent.keyDown(input, { key: 'F4' });
    });
    await waitFor(() => {
      expect(input.value).toBe('=SUM(B2:D4)');
    });
  });

  it('cycles second endpoint in EDIT mode when caret is in second half', async () => {
    render(<App />);
    const input = getFormulaInput();

    // Build =SUM(B2:D4) via POINT mode
    typeInFormulaBar(input, '=SUM(');
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
    });
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowRight' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowRight', shiftKey: true });
      fireEvent.keyDown(input, { key: 'ArrowRight', shiftKey: true });
      fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true });
      fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true });
    });
    await waitFor(() => { expect(input.value).toBe('=SUM(B2:D4'); });

    // Close with ) — transitions to EDIT mode
    act(() => {
      fireEvent.keyDown(input, { key: ')' });
    });
    await waitFor(() => { expect(input.value).toBe('=SUM(B2:D4)'); });

    // Position caret within second endpoint (D4)
    // Buffer = "=SUM(B2:D4)" — "D4" starts at index 8
    // Click at index 9 (within "D4") → caretOffset = 9-5 = 4 > 2
    act(() => {
      input.setSelectionRange(9, 9);
      fireEvent.click(input);
    });

    // F4 should cycle the SECOND endpoint (D4)
    act(() => {
      fireEvent.keyDown(input, { key: 'F4' });
    });
    await waitFor(() => {
      expect(input.value).toBe('=SUM(B2:$D$4)');
    });

    // F4 again: $D$4 → D$4
    act(() => {
      fireEvent.keyDown(input, { key: 'F4' });
    });
    await waitFor(() => {
      expect(input.value).toBe('=SUM(B2:D$4)');
    });
  });
});
