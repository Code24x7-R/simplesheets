// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { Grid } from './Grid';
import type { Sheet } from '../types';

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

function createTestSheet(overrides: Partial<Sheet> = {}): Sheet {
  return {
    id: 'test-sheet',
    name: 'Test',
    cells: {
      '0:0': { rawValue: 'A' },
      '0:1': { rawValue: 'B' },
      '1:0': { rawValue: 'C' },
      '1:1': { rawValue: 'D' },
    },
    defaultColWidth: 100,
    defaultRowHeight: 28,
    columnWidths: {},
    rowHeights: {},
    columnCount: 10,
    rowCount: 10,
    frozenColumns: 0,
    frozenRows: 0,
    ...overrides,
  };
}

describe('Grid — Drag-Move Range', () => {
  it('shows drag handle when range is selected', () => {
    const sheet = createTestSheet();
    const onMoveRange = jest.fn();
    render(<Grid sheet={sheet} onMoveRange={onMoveRange} />);

    // Select A1:B2
    const cellA1 = document.querySelector('[data-row-container="0"] [data-col="0"]') as HTMLElement;
    fireEvent.mouseDown(cellA1);
    const cellB2 = document.querySelector('[data-row-container="1"] [data-col="1"]') as HTMLElement;
    fireEvent.mouseDown(cellB2, { shiftKey: true });

    // Drag handle should be visible
    expect(screen.getByTestId('drag-handle')).toBeInTheDocument();
  });

  it('does not show drag handle for single cell selection', () => {
    const sheet = createTestSheet();
    render(<Grid sheet={sheet} onMoveRange={jest.fn()} />);

    // Click A1 only
    const cellA1 = document.querySelector('[data-row-container="0"] [data-col="0"]') as HTMLElement;
    fireEvent.mouseDown(cellA1);

    // No drag handle for single cell
    expect(screen.queryByTestId('drag-handle')).not.toBeInTheDocument();
  });

  it('does not show drag handle when onMoveRange is not provided', () => {
    const sheet = createTestSheet();
    render(<Grid sheet={sheet} />);

    // Select A1:B2
    const cellA1 = document.querySelector('[data-row-container="0"] [data-col="0"]') as HTMLElement;
    fireEvent.mouseDown(cellA1);
    const cellB2 = document.querySelector('[data-row-container="1"] [data-col="1"]') as HTMLElement;
    fireEvent.mouseDown(cellB2, { shiftKey: true });

    // No drag handle without callback
    expect(screen.queryByTestId('drag-handle')).not.toBeInTheDocument();
  });

  it('calls onMoveRange when drag handle is dragged to new location', () => {
    const sheet = createTestSheet();
    const onMoveRange = jest.fn();
    render(<Grid sheet={sheet} onMoveRange={onMoveRange} />);

    // Select A1:B2
    const cellA1 = document.querySelector('[data-row-container="0"] [data-col="0"]') as HTMLElement;
    fireEvent.mouseDown(cellA1);
    const cellB2 = document.querySelector('[data-row-container="1"] [data-col="1"]') as HTMLElement;
    fireEvent.mouseDown(cellB2, { shiftKey: true });

    // Get drag handle
    const dragHandle = screen.getByTestId('drag-handle');
    expect(dragHandle).toBeInTheDocument();

    // Simulate dragging the handle to a new location
    // A1 is at (0,0), B2 is at (1,1). Drag handle is at bottom-right of B2.
    // Drag to D4 (row 3, col 3)
    fireEvent.mouseDown(dragHandle, { clientX: 250, clientY: 70 });
    fireEvent.mouseMove(window, { clientX: 350, clientY: 112 });
    fireEvent.mouseUp(window);

    expect(onMoveRange).toHaveBeenCalled();
  });

  it('does not call onMoveRange if dropped on same location', () => {
    const sheet = createTestSheet();
    const onMoveRange = jest.fn();
    render(<Grid sheet={sheet} onMoveRange={onMoveRange} />);

    // Select A1:B2
    const cellA1 = document.querySelector('[data-row-container="0"] [data-col="0"]') as HTMLElement;
    fireEvent.mouseDown(cellA1);
    const cellB2 = document.querySelector('[data-row-container="1"] [data-col="1"]') as HTMLElement;
    fireEvent.mouseDown(cellB2, { shiftKey: true });

    const dragHandle = screen.getByTestId('drag-handle');

    // Drag but don't actually move (same position)
    fireEvent.mouseDown(dragHandle, { clientX: 250, clientY: 70 });
    fireEvent.mouseMove(window, { clientX: 251, clientY: 71 });
    fireEvent.mouseUp(window);

    // Should not call onMoveRange for negligible movement
    expect(onMoveRange).not.toHaveBeenCalled();
  });

  it('shows ghost preview during drag', () => {
    const sheet = createTestSheet();
    const onMoveRange = jest.fn();
    render(<Grid sheet={sheet} onMoveRange={onMoveRange} />);

    // Select A1:B2
    const cellA1 = document.querySelector('[data-row-container="0"] [data-col="0"]') as HTMLElement;
    fireEvent.mouseDown(cellA1);
    const cellB2 = document.querySelector('[data-row-container="1"] [data-col="1"]') as HTMLElement;
    fireEvent.mouseDown(cellB2, { shiftKey: true });

    const dragHandle = screen.getByTestId('drag-handle');

    // Start drag
    fireEvent.mouseDown(dragHandle, { clientX: 250, clientY: 70 });
    fireEvent.mouseMove(window, { clientX: 350, clientY: 112 });

    // Ghost preview should be visible
    expect(screen.getByTestId('drag-ghost')).toBeInTheDocument();

    // End drag
    fireEvent.mouseUp(window);
  });

  it('hides ghost preview after drop', () => {
    const sheet = createTestSheet();
    const onMoveRange = jest.fn();
    render(<Grid sheet={sheet} onMoveRange={onMoveRange} />);

    // Select A1:B2
    const cellA1 = document.querySelector('[data-row-container="0"] [data-col="0"]') as HTMLElement;
    fireEvent.mouseDown(cellA1);
    const cellB2 = document.querySelector('[data-row-container="1"] [data-col="1"]') as HTMLElement;
    fireEvent.mouseDown(cellB2, { shiftKey: true });

    const dragHandle = screen.getByTestId('drag-handle');

    // Start drag
    fireEvent.mouseDown(dragHandle, { clientX: 250, clientY: 70 });
    fireEvent.mouseMove(window, { clientX: 350, clientY: 112 });
    expect(screen.getByTestId('drag-ghost')).toBeInTheDocument();

    // End drag
    fireEvent.mouseUp(window);

    // Ghost should be hidden
    expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument();
  });

  it('drag handle is positioned at selection center', () => {
    const sheet = createTestSheet();
    const onMoveRange = jest.fn();
    render(<Grid sheet={sheet} onMoveRange={onMoveRange} />);

    // Select A1:B2
    const cellA1 = document.querySelector('[data-row-container="0"] [data-col="0"]') as HTMLElement;
    fireEvent.mouseDown(cellA1);
    const cellB2 = document.querySelector('[data-row-container="1"] [data-col="1"]') as HTMLElement;
    fireEvent.mouseDown(cellB2, { shiftKey: true });

    const dragHandle = screen.getByTestId('drag-handle');
    expect(dragHandle).toBeInTheDocument();
    // Handle should have position styles
    expect(dragHandle.style.position).toBe('absolute');
  });
});
