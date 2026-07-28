/**
 * Test for in-cell POINT mode editing - verifies that formulas are stored
 * correctly when using POINT mode during in-cell editing.
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

describe('In-cell POINT mode formula editing', () => {
  it('single-cell reference via POINT mode in-cell', async () => {
    const { container } = render(<App />);

    // Find cell A1 and double-click to start in-cell editing
    const cells = container.querySelectorAll('.grid-cell');
    const a1Cell = cells[0];
    fireEvent.doubleClick(a1Cell);

    // Find the in-cell input
    const cellInput = container.querySelector('input.w-full.h-full') as HTMLInputElement;
    expect(cellInput).toBeTruthy();

    // Type =SUM( to trigger POINT mode
    act(() => {
      fireEvent.change(cellInput, { target: { value: '=SUM(' } });
    });

    // Wait for POINT mode
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
    });

    // Navigate to B2 (down 1, right 1 from A1)
    act(() => {
      fireEvent.keyDown(cellInput, { key: 'ArrowDown' });
      fireEvent.keyDown(cellInput, { key: 'ArrowRight' });
    });

    // Commit the reference with ) to close the function
    // This exits POINT mode but does NOT commit the cell
    act(() => {
      fireEvent.keyDown(cellInput, { key: ')' });
    });

    // Wait for POINT mode to exit
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).not.toBe('POINT');
    });

    // Check the formula bar shows the correct formula (still in EDIT mode)
    const formulaInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;
    expect(formulaInput.value).toBe('=SUM(B2)');
  });

  it('range selection via POINT mode in-cell', async () => {
    const { container } = render(<App />);

    // Find cell A1 and double-click to start in-cell editing
    const cells = container.querySelectorAll('.grid-cell');
    const a1Cell = cells[0];
    fireEvent.doubleClick(a1Cell);

    // Find the in-cell input
    const cellInput = container.querySelector('input.w-full.h-full') as HTMLInputElement;
    expect(cellInput).toBeTruthy();

    // Type =SUM( to trigger POINT mode
    act(() => {
      fireEvent.change(cellInput, { target: { value: '=SUM(' } });
    });

    // Wait for POINT mode
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
    });

    // Navigate to B2 (down 1, right 1 from A1)
    act(() => {
      fireEvent.keyDown(cellInput, { key: 'ArrowDown' });
      fireEvent.keyDown(cellInput, { key: 'ArrowRight' });
    });

    // Extend to B4 with shift+arrow (down 2 more) - this creates a range B2:B4
    act(() => {
      fireEvent.keyDown(cellInput, { key: 'ArrowDown', shiftKey: true });
      fireEvent.keyDown(cellInput, { key: 'ArrowDown', shiftKey: true });
    });

    // Commit with )
    act(() => {
      fireEvent.keyDown(cellInput, { key: ')' });
    });

    // Wait for POINT mode to exit
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).not.toBe('POINT');
    });

    // Check the formula bar shows the correct formula with range
    const formulaInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;
    expect(formulaInput.value).toBe('=SUM(B2:B4)');
  });

  it('formula committed via POINT mode evaluates correctly', async () => {
    const { container } = render(<App />);

    // Find cell A1 and double-click to start in-cell editing
    const cells = container.querySelectorAll('.grid-cell');
    const a1Cell = cells[0];
    fireEvent.doubleClick(a1Cell);

    // Find the in-cell input
    const cellInput = container.querySelector('input.w-full.h-full') as HTMLInputElement;
    expect(cellInput).toBeTruthy();

    // Type =SUM( to trigger POINT mode
    act(() => {
      fireEvent.change(cellInput, { target: { value: '=SUM(' } });
    });

    // Wait for POINT mode
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
    });

    // Navigate to B2 (down 1, right 1 from A1)
    act(() => {
      fireEvent.keyDown(cellInput, { key: 'ArrowDown' });
      fireEvent.keyDown(cellInput, { key: 'ArrowRight' });
    });

    // Commit the reference with ) to close the function
    act(() => {
      fireEvent.keyDown(cellInput, { key: ')' });
    });

    // Wait for POINT mode to exit
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).not.toBe('POINT');
    });

    // Now press Enter to commit the cell value
    act(() => {
      fireEvent.keyDown(cellInput, { key: 'Enter' });
    });

    // After Enter, selection moves to A2 (which is empty)
    // The formula bar should now show A2's value (empty)
    await waitFor(() => {
      const formulaInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;
      // A2 is empty, so formula bar shows empty
      expect(formulaInput.value).toBe('');
    });

    // Navigate back to A1 using the grid's keydown handler
    // The grid container has the keydown handler, not the cell
    const gridContainer = container.querySelector('.overflow-auto') as HTMLElement;
    act(() => {
      fireEvent.keyDown(gridContainer, { key: 'ArrowUp' });
    });

    // Check the formula bar shows A1's formula
    await waitFor(() => {
      const formulaInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;
      expect(formulaInput.value).toBe('=SUM(B2)');
    });
  });
});
