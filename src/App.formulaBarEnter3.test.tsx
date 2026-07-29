/**
 * Reproduce: Type in grid, click FormulaBar, type more, press Enter → cell cleared.
 *
 * Exact user scenario:
 * 1. Navigate to C2
 * 2. Type "12" in grid (starts editing)
 * 3. Click formula bar (switches editor)
 * 4. Type "3" in formula bar (buffer should be "123")
 * 5. Press Enter → BUG: C2 is cleared instead of containing "123"
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

describe('Grid type then FormulaBar type then Enter', () => {
  it('type in grid, click FormulaBar, type more, Enter → preserves value', async () => {
    const { container } = render(<App />);
    const gridContainer = container.querySelector('[tabindex="0"]') as HTMLElement;

    // Navigate to C2
    act(() => { fireEvent.keyDown(gridContainer, { key: 'ArrowRight' }); });
    act(() => { fireEvent.keyDown(gridContainer, { key: 'ArrowRight' }); });
    act(() => { fireEvent.keyDown(gridContainer, { key: 'ArrowDown' }); });

    // Step 1: Type '1' in grid to start editing
    act(() => { fireEvent.keyDown(gridContainer, { key: '1' }); });

    // Verify we're in ENTER mode
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('Enter');
    });

    // Step 2: Type '2' in the grid cell input (now buffer is '12')
    const cellInput = document.querySelector('input.border-blue-500') as HTMLInputElement;
    expect(cellInput).not.toBeNull();
    act(() => { fireEvent.change(cellInput, { target: { value: '12' } }); });

    // Step 3: Click in the formula bar (switches editor, should preserve buffer '12')
    const formulaInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;
    act(() => { fireEvent.focus(formulaInput) });

    // Formula bar should show '12'
    expect(formulaInput.value).toBe('12');

    // Step 4: Type '3' in the formula bar (buffer should become '123')
    act(() => { fireEvent.change(formulaInput, { target: { value: '123' } }); });

    // Formula bar should show '123'
    expect(formulaInput.value).toBe('123');

    // Step 5: Press Enter to commit
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
});
