// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Integration tests for Wrap Text row-height auto-fit.
 * The row height snaps to the wrapped content height, which depends on the
 * column width.
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';

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

function rowHeight(row: number): number {
  const el = document.querySelector(`[data-row-container="${row}"]`) as HTMLElement | null;
  return el ? parseFloat(el.style.height) : 0;
}

function grid(): HTMLElement {
  return document.querySelector('[tabindex="0"]') as HTMLElement;
}

function typeIntoActiveCell(text: string) {
  act(() => { fireEvent.keyDown(grid(), { key: 'H' }); });
  const input = document.querySelector('input.border-blue-500') as HTMLInputElement;
  fireEvent.change(input, { target: { value: text } });
  act(() => { fireEvent.keyDown(input, { key: 'Enter' }); });
}

function toggleWrap() {
  fireEvent.click(screen.getByText('Format'));
  fireEvent.click(screen.getByText('Wrap Text'));
}

/** Commit long content into A1, then move back to A1 so it is the active cell. */
function seedWrappedRow(): void {
  typeIntoActiveCell('x'.repeat(200));
  act(() => { fireEvent.keyDown(grid(), { key: 'ArrowUp' }); });
}

describe('Wrap Text row-height auto-fit', () => {
  it('grows the row height when wrap is enabled on a cell with long content', () => {
    render(<App />);
    seedWrappedRow();
    expect(rowHeight(0)).toBe(28); // not wrapped yet

    toggleWrap();
    expect(rowHeight(0)).toBeGreaterThan(28);
  });

  it('reverts the row height when wrap is disabled', () => {
    render(<App />);
    seedWrappedRow();
    toggleWrap();
    expect(rowHeight(0)).toBeGreaterThan(28);

    toggleWrap();
    expect(rowHeight(0)).toBe(28);
  });

  it('shrinks the row height when the wrapped content is shortened', () => {
    render(<App />);
    seedWrappedRow();
    toggleWrap();
    expect(rowHeight(0)).toBeGreaterThan(28);

    // Replace the content with a short value (A1 is still active).
    act(() => { fireEvent.keyDown(grid(), { key: 'F2' }); });
    const input = document.querySelector('input.border-blue-500') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hi' } });
    act(() => { fireEvent.keyDown(input, { key: 'Enter' }); });

    expect(rowHeight(0)).toBe(28);
  });

  it('recomputes the row height when the column width changes', () => {
    render(<App />);
    seedWrappedRow();
    toggleWrap();
    const narrow = rowHeight(0);
    expect(narrow).toBeGreaterThan(28);

    // Widen column A via Format → Column / Row Size.
    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Column / Row Size…'));
    const sizeInput = document.getElementById('size-input') as HTMLInputElement;
    fireEvent.change(sizeInput, { target: { value: '400' } });
    // NumericInput commits on blur.
    fireEvent.blur(sizeInput);
    fireEvent.click(screen.getByText('Apply'));

    // A wider column fits more characters per line → shorter row.
    expect(rowHeight(0)).toBeLessThan(narrow);
  });

  it('does not auto-fit a non-wrapped cell', () => {
    render(<App />);
    typeIntoActiveCell('x'.repeat(200));
    expect(rowHeight(0)).toBe(28);
  });
});
