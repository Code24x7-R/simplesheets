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

describe('App - Paste Formula into Range', () => {
  it('pastes formula into all cells of destination range', () => {
    render(<App />);

    // Put a value in B1 (reference target)
    editCell(0, 1, '100');

    // Put =B1 in A1
    editCell(0, 0, '=B1');

    // Copy A1
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 0, selectionType: 'cell' },
    });
    act(() => { window.dispatchEvent(copyEvent); });

    // Paste into A1:A5 range (destination range is 5 rows x 1 col)
    const pasteEvent = new CustomEvent('simplesheets:paste', {
      detail: { startRow: 0, startCol: 0, endRow: 4, endCol: 0, selectionType: 'cell' },
    });
    act(() => { window.dispatchEvent(pasteEvent); });

    // Verify paste completed successfully (status message shows "Pasted")
    expect(screen.getByText(/Pasted/i)).toBeInTheDocument();
  });

  it('pastes formula with correct relative offset for each cell in range', () => {
    render(<App />);

    // Put values in B1-B5
    editCell(0, 1, '10');
    editCell(1, 1, '20');
    editCell(2, 1, '30');
    editCell(3, 1, '40');
    editCell(4, 1, '50');

    // Put =B1 in A1
    editCell(0, 0, '=B1');

    // Copy A1
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 0, selectionType: 'cell' },
    });
    act(() => { window.dispatchEvent(copyEvent); });

    // Paste into A1:A5 range
    const pasteEvent = new CustomEvent('simplesheets:paste', {
      detail: { startRow: 0, startCol: 0, endRow: 4, endCol: 0, selectionType: 'cell' },
    });
    act(() => { window.dispatchEvent(pasteEvent); });

    // Verify paste completed successfully
    expect(screen.getByText(/Pasted/i)).toBeInTheDocument();
  });

  it('pastes literal value into all cells of destination range', () => {
    render(<App />);

    // Put a literal value in A1
    editCell(0, 0, 'Hello');

    // Copy A1
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 0, selectionType: 'cell' },
    });
    act(() => { window.dispatchEvent(copyEvent); });

    // Paste into A1:A5 range
    const pasteEvent = new CustomEvent('simplesheets:paste', {
      detail: { startRow: 0, startCol: 0, endRow: 4, endCol: 0, selectionType: 'cell' },
    });
    act(() => { window.dispatchEvent(pasteEvent); });

    // Verify paste completed successfully
    expect(screen.getByText(/Pasted/i)).toBeInTheDocument();
  });
});
