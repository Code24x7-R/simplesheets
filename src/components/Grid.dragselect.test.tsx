// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, fireEvent } from '@testing-library/react';
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
      '0:0': { rawValue: 'A1' },
      '0:1': { rawValue: 'B1' },
      '0:2': { rawValue: 'C1' },
      '1:0': { rawValue: 'A2' },
      '1:1': { rawValue: 'B2' },
      '1:2': { rawValue: 'C2' },
      '2:0': { rawValue: 'A3' },
      '2:1': { rawValue: 'B3' },
      '2:2': { rawValue: 'C3' },
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

/**
 * Helper: get the last element of an array (ES2022 .at(-1) equivalent).
 */
function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}

/**
 * Helper: find a grid cell element by row/col data attributes.
 */
function getCell(row: number, col: number): HTMLElement {
  return document.querySelector(
    `[data-row-container="${row}"] [data-col="${col}"]`,
  ) as HTMLElement;
}

describe('Grid — Click-and-Drag Range Selection', () => {
  it('selects a single cell on click without drag', () => {
    const sheet = createTestSheet();
    const onSelectionChange = jest.fn();
    render(<Grid sheet={sheet} onSelectionChange={onSelectionChange} />);

    fireEvent.mouseDown(getCell(0, 0));
    fireEvent.mouseUp(window);

    // Should have selected A1 (last call — first call on mount is null)
    expect(onSelectionChange).toHaveBeenCalled();
    const sel = last(onSelectionChange.mock.calls)?.[0];
    expect(sel).toBeDefined();
    expect(sel.startRow).toBe(0);
    expect(sel.startCol).toBe(0);
    expect(sel.endRow).toBe(0);
    expect(sel.endCol).toBe(0);
  });

  it('selects a range when dragging from A1 to C3', () => {
    const sheet = createTestSheet();
    const onSelectionChange = jest.fn();
    render(<Grid sheet={sheet} onSelectionChange={onSelectionChange} />);

    // Press mouse down on A1
    fireEvent.mouseDown(getCell(0, 0));

    // Drag to B2
    fireEvent.mouseEnter(getCell(1, 1));
    // Drag to C3
    fireEvent.mouseEnter(getCell(2, 2));

    // Release mouse
    fireEvent.mouseUp(window);

    // Selection should be A1:C3
    const lastCall = last(onSelectionChange.mock.calls)?.[0];
    expect(lastCall).toBeDefined();
    expect(lastCall.startRow).toBe(0);
    expect(lastCall.startCol).toBe(0);
    expect(lastCall.endRow).toBe(2);
    expect(lastCall.endCol).toBe(2);
  });

  it('selects a range when dragging upward (C3 to A1)', () => {
    const sheet = createTestSheet();
    const onSelectionChange = jest.fn();
    render(<Grid sheet={sheet} onSelectionChange={onSelectionChange} />);

    // Press mouse down on C3
    fireEvent.mouseDown(getCell(2, 2));

    // Drag to A1
    fireEvent.mouseEnter(getCell(0, 0));

    // Release mouse
    fireEvent.mouseUp(window);

    // Selection should be A1:C3 (normalized)
    const lastCall = last(onSelectionChange.mock.calls)?.[0];
    expect(lastCall.startRow).toBe(0);
    expect(lastCall.startCol).toBe(0);
    expect(lastCall.endRow).toBe(2);
    expect(lastCall.endCol).toBe(2);
  });

  it('selects a horizontal range when dragging A1 to C1', () => {
    const sheet = createTestSheet();
    const onSelectionChange = jest.fn();
    render(<Grid sheet={sheet} onSelectionChange={onSelectionChange} />);

    fireEvent.mouseDown(getCell(0, 0));
    fireEvent.mouseEnter(getCell(0, 2));
    fireEvent.mouseUp(window);

    const lastCall = last(onSelectionChange.mock.calls)?.[0];
    expect(lastCall.startRow).toBe(0);
    expect(lastCall.startCol).toBe(0);
    expect(lastCall.endRow).toBe(0);
    expect(lastCall.endCol).toBe(2);
  });

  it('selects a vertical range when dragging A1 to A3', () => {
    const sheet = createTestSheet();
    const onSelectionChange = jest.fn();
    render(<Grid sheet={sheet} onSelectionChange={onSelectionChange} />);

    fireEvent.mouseDown(getCell(0, 0));
    fireEvent.mouseEnter(getCell(2, 0));
    fireEvent.mouseUp(window);

    const lastCall = last(onSelectionChange.mock.calls)?.[0];
    expect(lastCall.startRow).toBe(0);
    expect(lastCall.startCol).toBe(0);
    expect(lastCall.endRow).toBe(2);
    expect(lastCall.endCol).toBe(0);
  });

  it('finalizes selection on mouseup even outside the grid', () => {
    const sheet = createTestSheet();
    const onSelectionChange = jest.fn();
    render(<Grid sheet={sheet} onSelectionChange={onSelectionChange} />);

    fireEvent.mouseDown(getCell(0, 0));
    fireEvent.mouseEnter(getCell(1, 1));

    // mouseup on window (not on a cell)
    fireEvent.mouseUp(window);

    // Selection should be finalized as A1:B2
    const lastCall = last(onSelectionChange.mock.calls)?.[0];
    expect(lastCall.startRow).toBe(0);
    expect(lastCall.startCol).toBe(0);
    expect(lastCall.endRow).toBe(1);
    expect(lastCall.endCol).toBe(1);
  });

  it('does not extend selection on mouseEnter after mouseUp', () => {
    const sheet = createTestSheet();
    const onSelectionChange = jest.fn();
    render(<Grid sheet={sheet} onSelectionChange={onSelectionChange} />);

    fireEvent.mouseDown(getCell(0, 0));
    fireEvent.mouseEnter(getCell(1, 1));
    fireEvent.mouseUp(window);

    const callCountAfterUp = onSelectionChange.mock.calls.length;

    // Now mouseEnter without drag should not change selection
    fireEvent.mouseEnter(getCell(2, 2));

    // No additional selection changes
    expect(onSelectionChange.mock.calls.length).toBe(callCountAfterUp);
  });

  it('applies grid-drag-selecting class during drag', () => {
    const sheet = createTestSheet();
    render(<Grid sheet={sheet} />);

    // Before drag: no class
    const gridDiv = document.querySelector('.overflow-auto') as HTMLElement;
    expect(gridDiv.classList.contains('grid-drag-selecting')).toBe(false);

    // Start drag
    fireEvent.mouseDown(getCell(0, 0));

    // During drag: class present
    expect(gridDiv.classList.contains('grid-drag-selecting')).toBe(true);

    // End drag
    fireEvent.mouseUp(window);

    // After drag: class removed
    expect(gridDiv.classList.contains('grid-drag-selecting')).toBe(false);
  });

  it('shift+click still works for range extension (no regression)', () => {
    const sheet = createTestSheet();
    const onSelectionChange = jest.fn();
    render(<Grid sheet={sheet} onSelectionChange={onSelectionChange} />);

    // Click A1
    fireEvent.mouseDown(getCell(0, 0));
    fireEvent.mouseUp(window);

    // Shift+click C3
    fireEvent.mouseDown(getCell(2, 2), { shiftKey: true });

    const lastCall = last(onSelectionChange.mock.calls)?.[0];
    expect(lastCall.startRow).toBe(0);
    expect(lastCall.startCol).toBe(0);
    expect(lastCall.endRow).toBe(2);
    expect(lastCall.endCol).toBe(2);
  });

  it('drag-select from B2 to A1 produces normalized range A1:B2', () => {
    const sheet = createTestSheet();
    const onSelectionChange = jest.fn();
    render(<Grid sheet={sheet} onSelectionChange={onSelectionChange} />);

    // Press on B2
    fireEvent.mouseDown(getCell(1, 1));
    // Drag up-left to A1
    fireEvent.mouseEnter(getCell(0, 0));
    fireEvent.mouseUp(window);

    const lastCall = last(onSelectionChange.mock.calls)?.[0];
    // start should be A1, end should be B2
    expect(lastCall.startRow).toBe(0);
    expect(lastCall.startCol).toBe(0);
    expect(lastCall.endRow).toBe(1);
    expect(lastCall.endCol).toBe(1);
    // Anchor should be B2 (where mousedown happened)
    expect(lastCall.anchorRow).toBe(1);
    expect(lastCall.anchorCol).toBe(1);
  });
});
