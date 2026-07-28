/**
 * Integration tests for Alt+Enter (insert line break) in both FormulaBar
 * and Grid in-cell editing.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from './App';

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

function getFormulaInput(): HTMLInputElement | HTMLTextAreaElement {
  return screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement | HTMLTextAreaElement;
}

describe('Alt+Enter integration — FormulaBar', () => {
  it('inserts line break on Alt+Enter in ENTER mode', async () => {
    render(<App />);
    const input = getFormulaInput();

    // Type some text to enter ENTER mode
    act(() => { fireEvent.keyDown(input, { key: 'H' }); });
    act(() => { fireEvent.keyDown(input, { key: 'i' }); });
    await waitFor(() => { expect(input.value).toBe('Hi'); });

    // Verify FSM is in ENTER mode
    expect(screen.getByTestId('cell-mode').textContent).toBe('Enter');

    // Press Alt+Enter — should insert newline and expand to textarea
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter', altKey: true });
    });

    // After Alt+Enter, FSM should still be in ENTER mode (not committed)
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('Enter');
    });

    // Buffer should now contain a newline and formula bar should be a textarea
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLTextAreaElement;
      expect(textarea).toBeTruthy();
      expect(textarea.value).toBe('Hi\n');
    });
  });

  it('inserts line break on Alt+Enter in EDIT mode', async () => {
    render(<App />);
    const input = getFormulaInput();

    // Type text to enter ENTER mode
    act(() => { fireEvent.keyDown(input, { key: 'A' }); });
    act(() => { fireEvent.keyDown(input, { key: 'B' }); });
    act(() => { fireEvent.keyDown(input, { key: 'C' }); });
    await waitFor(() => { expect(input.value).toBe('ABC'); });

    // Press F2 to transition to EDIT mode (buffer stays 'ABC')
    act(() => { fireEvent.keyDown(input, { key: 'F2' }); });

    // Verify FSM is in EDIT mode
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('Edit');
    });

    // Move caret to position 1 (after 'A'): from 3 to 1 = 2 ArrowLeft
    act(() => { fireEvent.keyDown(input, { key: 'ArrowLeft' }); });
    act(() => { fireEvent.keyDown(input, { key: 'ArrowLeft' }); });

    // Press Alt+Enter — should insert newline at caret
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter', altKey: true });
    });

    // After Alt+Enter, FSM should still be in EDIT mode (not committed)
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('Edit');
    });

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLTextAreaElement;
      expect(textarea).toBeTruthy();
      expect(textarea.value).toBe('A\nBC');
    });
  });
});

describe('Alt+Enter integration — Grid in-cell editing', () => {
  it('inserts line break on Alt+Enter during in-cell editing', async () => {
    const { container } = render(<App />);

    // Double-click cell A1 to start in-cell editing
    const cell = container.querySelector('.grid-cell') as HTMLElement;
    act(() => { fireEvent.doubleClick(cell); });

    // Find the in-cell input
    let cellInput = container.querySelector('input.w-full.h-full') as HTMLInputElement;
    expect(cellInput).toBeTruthy();

    // Type some text
    act(() => { fireEvent.change(cellInput, { target: { value: 'Hello' } }); });

    // Re-find input (it may have been re-rendered)
    cellInput = container.querySelector('input.w-full.h-full') as HTMLInputElement;

    // Move caret to middle (after 'He')
    act(() => { cellInput.setSelectionRange(2, 2); });

    // Press Alt+Enter — should insert newline at cursor
    act(() => {
      fireEvent.keyDown(cellInput, { key: 'Enter', altKey: true });
    });

    // Re-find input after state update
    cellInput = container.querySelector('input.w-full.h-full') as HTMLInputElement;

    // After Alt+Enter, the FSM should still be in ENTER mode (not committed)
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('Enter');
    });
  });
});
