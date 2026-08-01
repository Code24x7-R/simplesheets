// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Integration tests for formula autocomplete accept workflow.
 *
 * Verifies that pressing Enter to accept an autocomplete suggestion
 * correctly inserts "=SUM(" and enters POINT mode.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
        for (let i = 0; i < 5; i++) {
          items.push({ index: i, start: i * 28, size: 28, end: (i + 1) * 28 });
        }
        return items;
      },
      getTotalSize: () => 140,
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

describe('Formula autocomplete accept workflow', () => {
  it('accepting SUM autocomplete with Enter inserts "=SUM(" and enters POINT mode', async () => {
    render(<App />);
    const input = getFormulaInput();

    // Type =SUM to trigger autocomplete
    typeInFormulaBar(input, '=SUM');

    // Autocomplete dropdown should appear with SUM suggestion
    // (use getAllByText because SUM also appears in function bar and formula highlight)
    await waitFor(() => {
      const sumElements = screen.getAllByText('SUM');
      expect(sumElements.length).toBeGreaterThan(1);
    });

    // Press Enter to accept the SUM autocomplete suggestion
    fireEvent.keyDown(input, { key: 'Enter' });

    // After accepting, the formula bar should show "=SUM(" and POINT mode should be active
    await waitFor(() => {
      expect(input.value).toBe('=SUM(');
      expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
    });
  });

  it('accepting SUM autocomplete then selecting a range with arrows', async () => {
    render(<App />);
    const input = getFormulaInput();

    // Type =SUM to trigger autocomplete
    typeInFormulaBar(input, '=SUM');

    // Wait for autocomplete
    await waitFor(() => {
      const sumElements = screen.getAllByText('SUM');
      expect(sumElements.length).toBeGreaterThan(1);
    });

    // Accept with Enter
    fireEvent.keyDown(input, { key: 'Enter' });

    // Verify POINT mode
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
    });

    // Move down 2 rows and right 1 column to select B3 (single-cell pointing)
    // Without Shift, arrow moves both anchor and current together
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowRight' });

    // Still in POINT mode (wait for state to settle)
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
    });

    // Close with ) to commit the reference
    fireEvent.keyDown(input, { key: ')' });

    // Should exit POINT mode and have the reference
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).not.toBe('POINT');
      expect(input.value).toMatch(/^=SUM\([A-Z]+\d+\)$/);
    });
  });

  it('accepting SUM autocomplete then pressing ) immediately commits active cell', async () => {
    render(<App />);
    const input = getFormulaInput();

    // Type =SUM to trigger autocomplete
    typeInFormulaBar(input, '=SUM');

    // Wait for autocomplete
    await waitFor(() => {
      const sumElements = screen.getAllByText('SUM');
      expect(sumElements.length).toBeGreaterThan(1);
    });

    // Accept with Enter
    fireEvent.keyDown(input, { key: 'Enter' });

    // Verify POINT mode
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).toBe('POINT');
    });

    // Press ) immediately (no arrow navigation) - should commit active cell ref
    fireEvent.keyDown(input, { key: ')' });

    // Should exit POINT mode and have a single-cell reference
    await waitFor(() => {
      expect(screen.getByTestId('cell-mode').textContent).not.toBe('POINT');
      expect(input.value).toMatch(/^=SUM\([A-Z]+\d+\)$/);
    });
  });
});
