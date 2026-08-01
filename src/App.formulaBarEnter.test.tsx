// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Reproduce: Formula bar click clears FSM buffer.
 *
 * Core bug: typing in grid then clicking formula bar resets buffer to sheet value.
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

describe('Formula bar click preserves buffer', () => {
  it('typing in grid then clicking formula bar then Enter commits typed value', async () => {
    const { container } = render(<App />);
    const gridContainer = container.querySelector('[tabindex="0"]') as HTMLElement;

    // Navigate to C2 one step at a time (separate act() to avoid batching)
    act(() => { fireEvent.keyDown(gridContainer, { key: 'ArrowRight' }); });
    act(() => { fireEvent.keyDown(gridContainer, { key: 'ArrowRight' }); });
    act(() => { fireEvent.keyDown(gridContainer, { key: 'ArrowDown' }); });

    // Type '1' to start editing
    act(() => { fireEvent.keyDown(gridContainer, { key: '1' }); });

    // Verify we're in ENTER mode
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('Enter');
    });

    // Type the rest using the cell input
    const cellInput = document.querySelector('input.border-blue-500') as HTMLInputElement;
    expect(cellInput).not.toBeNull();
    act(() => { fireEvent.change(cellInput, { target: { value: '123' } }); });

    // Now click in the formula bar (this should NOT reset the buffer)
    const formulaInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;
    act(() => { fireEvent.focus(formulaInput); });

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
});
