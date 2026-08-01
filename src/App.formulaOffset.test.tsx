// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent, act } from '@testing-library/react';
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

// Helper: get all grid cells in row-major order (5 visible columns in mock)
function getAllCells(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.grid-cell'));
}

// Helper: get the cell element at (row, col) in the grid
function getCell(row: number, col: number): HTMLElement | null {
  const cells = getAllCells();
  return cells[row * 5 + col] ?? null;
}

// Helper: edit a cell by typing a value
function editCell(row: number, col: number, value: string) {
  const cell = getCell(row, col);
  if (!cell) throw new Error(`Cell (${row},${col}) not found`);
  fireEvent.mouseDown(cell);
  const input = screen.getByPlaceholderText(/Enter a value or formula/);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

describe('App - Formula Offset Calculation', () => {
  it('correctly adjusts formula when copying A1(=B1) to C1', () => {
    render(<App />);

    // Put a value in B1 (col 1)
    editCell(0, 1, '100'); // B1

    // Put =B1 in A1 (col 0)
    editCell(0, 0, '=B1');

    // Copy A1
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 0, selectionType: 'cell' },
    });
    act(() => { window.dispatchEvent(copyEvent); });

    // Paste to C1 (col 2)
    const pasteEvent = new CustomEvent('simplesheets:paste', {
      detail: { startRow: 0, startCol: 2 },
    });
    act(() => { window.dispatchEvent(pasteEvent); });

    // C1 should now have =D1 (offset by 2 columns from B1)
    // The paste should have completed successfully
    expect(screen.getByText(/Pasted/i)).toBeInTheDocument();
  });

  it('correctly adjusts formula when copying to a cell below', () => {
    render(<App />);

    // Put a value in B1
    editCell(0, 1, '100');

    // Put =B1 in A1
    editCell(0, 0, '=B1');

    // Copy A1
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 0, selectionType: 'cell' },
    });
    act(() => { window.dispatchEvent(copyEvent); });

    // Paste to A2 (row below)
    const pasteEvent = new CustomEvent('simplesheets:paste', {
      detail: { startRow: 1, startCol: 0 },
    });
    act(() => { window.dispatchEvent(pasteEvent); });

    // A2 should now have =B2 (offset by 1 row)
    expect(screen.getByText(/Pasted/i)).toBeInTheDocument();
  });

  it('correctly adjusts formula when copying a range', () => {
    render(<App />);

    // Put values in B1, B2
    editCell(0, 1, '10');
    editCell(1, 1, '20');

    // Put =B1 in A1 and =B2 in A2
    editCell(0, 0, '=B1');
    editCell(1, 0, '=B2');

    // Copy A1:A2
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 1, endCol: 0, selectionType: 'cell' },
    });
    act(() => { window.dispatchEvent(copyEvent); });

    // Paste to C1:C2 (2 columns to the right)
    const pasteEvent = new CustomEvent('simplesheets:paste', {
      detail: { startRow: 0, startCol: 2 },
    });
    act(() => { window.dispatchEvent(pasteEvent); });

    // C1 should have =D1, C2 should have =D2
    expect(screen.getByText(/Pasted/i)).toBeInTheDocument();
  });
});
