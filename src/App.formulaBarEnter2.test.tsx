/**
 * Reproduce: Typing in FormulaBar then pressing Enter clears the cell.
 *
 * Bug: Edit in FormulaBar, press Enter → cell is cleared.
 * Expected: Cell should contain the typed value.
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
        for (let i = 0; i < 10; i++) {
          items.push({ index: i, start: i * 28, size: 28, end: (i + 1) * 28 });
        }
        return items;
      },
      getTotalSize: () => 280,
      scrollToIndex: jest.fn(),
      measure: jest.fn(),
    };
  },
}));

describe('FormulaBar typing then Enter commits value', () => {
  it('typing in FormulaBar then pressing Enter commits typed value', async () => {
    const { container } = render(<App />);
    const gridContainer = container.querySelector('[tabindex="0"]') as HTMLElement;

    // Navigate to C2
    act(() => { fireEvent.keyDown(gridContainer, { key: 'ArrowRight' }); });
    act(() => { fireEvent.keyDown(gridContainer, { key: 'ArrowRight' }); });
    act(() => { fireEvent.keyDown(gridContainer, { key: 'ArrowDown' }); });

    // Click in the formula bar to start editing
    const formulaInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;
    act(() => { fireEvent.focus(formulaInput); });

    // Type '123' in the formula bar
    act(() => {
      fireEvent.change(formulaInput, { target: { value: '123' } });
    });

    // Formula bar should show the typed value
    expect(formulaInput.value).toBe('123');

    // Press Enter in formula bar to commit
    act(() => { fireEvent.keyDown(formulaInput, { key: 'Enter' }); });

    // After commit, selection moves down to C3
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('Ready');
    });

    // Navigate back to C2 to verify the value was committed
    act(() => { fireEvent.keyDown(gridContainer, { key: 'ArrowUp' }); });

    // C2 should have '123'
    expect(formulaInput.value).toBe('123');
  });

  it('typing in FormulaBar then pressing Tab commits typed value', async () => {
    const { container } = render(<App />);
    const gridContainer = container.querySelector('[tabindex="0"]') as HTMLElement;

    // Navigate to C2
    act(() => { fireEvent.keyDown(gridContainer, { key: 'ArrowRight' }); });
    act(() => { fireEvent.keyDown(gridContainer, { key: 'ArrowRight' }); });
    act(() => { fireEvent.keyDown(gridContainer, { key: 'ArrowDown' }); });

    // Click in the formula bar to start editing
    const formulaInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;
    act(() => { fireEvent.focus(formulaInput); });

    // Type '456' in the formula bar
    act(() => {
      fireEvent.change(formulaInput, { target: { value: '456' } });
    });

    // Formula bar should show the typed value
    expect(formulaInput.value).toBe('456');

    // Press Tab in formula bar to commit
    act(() => { fireEvent.keyDown(formulaInput, { key: 'Tab' }); });

    // After commit, selection moves right to D2
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('Ready');
    });

    // Navigate back to C2 to verify the value was committed
    act(() => { fireEvent.keyDown(gridContainer, { key: 'ArrowLeft' }); });

    // C2 should have '456'
    expect(formulaInput.value).toBe('456');
  });
});
