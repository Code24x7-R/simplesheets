// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

// Mock the virtualizer
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { horizontal?: boolean }) => {
    if (options.horizontal) {
      return {
        getVirtualItems: () => {
          const items = [];
          for (let i = 0; i < 10; i++) {
            items.push({ index: i, start: i * 100, size: 100, end: (i + 1) * 100 });
          }
          return items;
        },
        getTotalSize: () => 1000,
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

// Helper: get all grid cells in row-major order (10 visible columns in mock)
function getAllCells(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.grid-cell'));
}

// Helper: get the cell element at (row, col) in the grid
function getCell(row: number, col: number): HTMLElement | null {
  const cells = getAllCells();
  return cells[row * 10 + col] ?? null;
}

// Helper: find the grid container (has onKeyDown handler for arrow keys)
function getGridContainer(): HTMLElement {
  // The grid container is the div with overflow-auto that holds all cells
  return document.querySelector('.overflow-auto.h-full.w-full') as HTMLElement;
}

describe('App - Marching ants alignment after copy/cut', () => {
  it('marching ants align with selection after Ctrl+C (shift+click range)', () => {
    render(<App />);
    const cells = getAllCells();

    // Select range A1:C3 via shift+click
    fireEvent.mouseDown(cells[0]); // A1
    fireEvent.mouseDown(cells[2 * 10 + 2], { shiftKey: true }); // C3

    // Press Ctrl+C (global handler on window)
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });

    // Marching ants should be on A1:C3 (the copied range)
    expect(getCell(0, 0)?.classList.contains('clipboard-range-cell')).toBe(true);
    expect(getCell(0, 2)?.classList.contains('clipboard-range-cell')).toBe(true);
    expect(getCell(2, 0)?.classList.contains('clipboard-range-cell')).toBe(true);
    expect(getCell(2, 2)?.classList.contains('clipboard-range-cell')).toBe(true);

    // Cells outside the range should NOT have marching ants
    expect(getCell(3, 3)?.classList.contains('clipboard-range-cell')).toBe(false);
    expect(getCell(0, 3)?.classList.contains('clipboard-range-cell')).toBe(false);

    // Marching ants cells must retain absolute positioning (not overridden to relative).
    // The inline style must explicitly set position:absolute so a CSS rule cannot
    // displace the marching-ants cells off-grid.
    const a1 = getCell(0, 0)!;
    expect(a1.classList.contains('absolute')).toBe(true);
    expect(a1.style.position).toBe('absolute');
    // The marching-ants class must be present on the cell element
    expect(a1.classList.contains('clipboard-range-cell')).toBe(true);
    expect(a1.classList.contains('marching-active')).toBe(true);
  });

  it('marching ants cells get inline position:absolute (CSS cascade guard)', () => {
    render(<App />);
    const cells = getAllCells();

    // Select range A1:B2 and copy
    fireEvent.mouseDown(cells[0]);
    fireEvent.mouseDown(cells[1 * 10 + 1], { shiftKey: true });
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });

    // Every marching-ants cell must have inline position:absolute
    const allCells = getAllCells();
    allCells.forEach((cell) => {
      if (cell.classList.contains('clipboard-range-cell')) {
        expect(cell.style.position).toBe('absolute');
      }
    });
  });

  it('marching ants align with selection after Ctrl+C (shift+arrow range)', () => {
    render(<App />);
    const cells = getAllCells();
    const container = getGridContainer();

    // Select A1, then shift+arrow to C3
    fireEvent.mouseDown(cells[0]); // A1
    fireEvent.keyDown(container, { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyDown(container, { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyDown(container, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(container, { key: 'ArrowRight', shiftKey: true });

    // Press Ctrl+C
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });

    // Marching ants should be on A1:C3
    expect(getCell(0, 0)?.classList.contains('clipboard-range-cell')).toBe(true);
    expect(getCell(2, 2)?.classList.contains('clipboard-range-cell')).toBe(true);
    expect(getCell(3, 3)?.classList.contains('clipboard-range-cell')).toBe(false);
  });

  it('marching ants show red dashed border for cut (Ctrl+X)', () => {
    render(<App />);
    const cells = getAllCells();

    // Select range B2:D4 via shift+click (row 1-3, col 1-3)
    fireEvent.mouseDown(cells[1 * 10 + 1]); // B2
    fireEvent.mouseDown(cells[3 * 10 + 3], { shiftKey: true }); // D4

    // Press Ctrl+X
    fireEvent.keyDown(window, { key: 'x', ctrlKey: true });

    // Marching ants should be on B2:D4
    const b2 = getCell(1, 1)!;
    const d4 = getCell(3, 3)!;
    expect(b2.classList.contains('clipboard-range-cell')).toBe(true);
    expect(d4.classList.contains('clipboard-range-cell')).toBe(true);

    // Cut ants use red color (#dc2626) — check the inline --ant-color variable
    expect(b2.style.getPropertyValue('--ant-color')).toBe('#dc2626');
    // Copy ants would use blue (#2563eb)
  });

  it('marching ants clear after paste', () => {
    render(<App />);
    const cells = getAllCells();

    // Select A1:B2 and copy
    fireEvent.mouseDown(cells[0]);
    fireEvent.mouseDown(cells[1 * 10 + 1], { shiftKey: true });
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });

    // Verify ants present
    expect(getCell(0, 0)?.classList.contains('clipboard-range-cell')).toBe(true);

    // Click destination and paste
    fireEvent.mouseDown(cells[5 * 10 + 5]); // F6
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });

    // Marching ants should be cleared after paste
    expect(getCell(0, 0)?.classList.contains('clipboard-range-cell')).toBe(false);
  });

  it('single-cell copy shows marching ants on just that cell', () => {
    render(<App />);
    const cells = getAllCells();

    // Select single cell C3 (row 2, col 2)
    fireEvent.mouseDown(cells[2 * 10 + 2]);

    // Copy
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });

    // Only C3 should have marching ants
    expect(getCell(2, 2)?.classList.contains('clipboard-range-cell')).toBe(true);
    expect(getCell(2, 1)?.classList.contains('clipboard-range-cell')).toBe(false);
    expect(getCell(1, 2)?.classList.contains('clipboard-range-cell')).toBe(false);
  });

  it('frozen-column cells in clipboard range keep sticky (not overridden to absolute)', () => {
    render(<App />);
    const cells = getAllCells();

    // Freeze panes at C3 (freezes rows 0-1 and cols 0-1)
    fireEvent.mouseDown(cells[2 * 10 + 2]); // C3
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Freeze Panes'));

    // Select a range whose top-left is a frozen-column cell in a scrollable
    // row: B3 (row 2, col 1). Col 1 is frozen, row 2 is scrollable, so this
    // cell goes through the marching-ants block and gets position:sticky from
    // the frozen-cell block. The guard must NOT override it with absolute.
    fireEvent.mouseDown(cells[2 * 10 + 1]); // B3 (frozen col, scrollable row)
    fireEvent.mouseDown(cells[3 * 10 + 3], { shiftKey: true }); // D4
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });

    // Frozen-column cell B3 must keep sticky, NOT get inline absolute
    const b3 = getCell(2, 1)!;
    expect(b3.classList.contains('clipboard-range-cell')).toBe(true);
    expect(b3.style.position).toBe('sticky');

    // Non-frozen cell in range (D4) must get inline absolute
    const d4 = getCell(3, 3)!;
    expect(d4.classList.contains('clipboard-range-cell')).toBe(true);
    expect(d4.style.position).toBe('absolute');
  });
});
