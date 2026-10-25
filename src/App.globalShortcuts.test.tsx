// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Regression tests for global window-level handlers hijacking input that
 * belongs to text fields (modals, formula bar). See docs/BUGFIX.md B-035.
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';
import { clearClipboard } from './utils/clipboard';

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { horizontal?: boolean }) => {
    if (options.horizontal) {
      return {
        getVirtualItems: () => [0, 1, 2, 3, 4].map((i) => ({ index: i, start: i * 100, size: 100, end: (i + 1) * 100 })),
        getTotalSize: () => 500,
        scrollToIndex: jest.fn(),
        measure: jest.fn(),
      };
    }
    return {
      getVirtualItems: () => Array.from({ length: 20 }, (_, i) => ({ index: i, start: i * 28, size: 28, end: (i + 1) * 28 })),
      getTotalSize: () => 560,
      scrollToIndex: jest.fn(),
      measure: jest.fn(),
    };
  },
}));

function openSearchReplace() {
  fireEvent.click(screen.getByText('Edit'));
  fireEvent.click(screen.getByText('Find & Replace…'));
  return document.getElementById('sr-find') as HTMLInputElement;
}

function cellA1Text(): string {
  return (document.querySelector('[data-col="0"]') as HTMLElement)?.textContent ?? '';
}

describe('Global shortcuts must not fire while typing in a modal field', () => {
  it('Ctrl+Z in a modal field does not undo the workbook', () => {
    render(<App />);
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Commit a value so there is something to undo.
    act(() => { fireEvent.keyDown(grid, { key: 'X' }); });
    act(() => { fireEvent.keyDown(grid, { key: 'Enter' }); });
    expect(cellA1Text()).toBe('X');

    const findInput = openSearchReplace();
    findInput.focus();
    fireEvent.change(findInput, { target: { value: 'hello' } });

    act(() => { fireEvent.keyDown(findInput, { key: 'z', ctrlKey: true }); });

    // The app must NOT have performed an undo.
    expect(screen.queryByTestId('status-message')?.textContent).not.toBe('Undo performed');
    expect(cellA1Text()).toBe('X');
  });

  it('Ctrl+Shift+V in a modal field does not open Paste Special', () => {
    render(<App />);
    const findInput = openSearchReplace();
    findInput.focus();
    fireEvent.change(findInput, { target: { value: 'hello' } });

    act(() => { fireEvent.keyDown(findInput, { key: 'v', ctrlKey: true, shiftKey: true }); });

    expect(screen.queryByRole('heading', { name: 'Paste Special' })).not.toBeInTheDocument();
  });

  it('pasting into a modal field does not write into a grid cell', () => {
    clearClipboard();
    render(<App />);
    const findInput = openSearchReplace();
    findInput.focus();

    act(() => {
      fireEvent.paste(findInput, {
        clipboardData: { getData: (t: string) => (t === 'text/plain' ? 'HIJACKED' : '') },
      });
    });

    expect(cellA1Text()).not.toBe('HIJACKED');
  });
});
