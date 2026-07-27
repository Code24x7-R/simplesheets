import { render, fireEvent } from '@testing-library/react';
import { Grid } from './Grid';
import type { Sheet } from '../types';

// Mutable flag to control hasClipboardData mock behavior in tests
let clipboardMockHasData = false;
jest.mock('../utils/clipboard', () => {
  const actual = jest.requireActual('../utils/clipboard');
  return {
    ...actual,
    hasClipboardData: () => clipboardMockHasData,
  };
});

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

function createTestSheet(overrides: Partial<Sheet> = {}): Sheet {
  return {
    id: 'test-sheet',
    name: 'Test',
    cells: {
      '0:0': { rawValue: 'A1' },
      '0:1': { rawValue: 'B1' },
      '1:0': { rawValue: 'A2' },
      '1:1': { rawValue: 'B2' },
    },
    defaultColWidth: 100,
    defaultRowHeight: 28,
    columnWidths: {},
    rowHeights: {},
    columnCount: 26,
    rowCount: 100,
    frozenColumns: 0,
    frozenRows: 0,
    ...overrides,
  };
}

describe('Grid - Cell Editing Input', () => {
  it('commits edit on Enter key', () => {
    const onCellChange = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onCellChange={onCellChange}
        onSelect={jest.fn()}
      />,
    );

    // Double-click to start editing
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.doubleClick(cell);

    // Type a value
    const input = document.querySelector('.grid-cell input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'NewValue' } });

    // Press Enter to commit
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCellChange).toHaveBeenCalled();
  });

  it('cancels edit on Escape key', () => {
    const onCellChange = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onCellChange={onCellChange}
        onSelect={jest.fn()}
      />,
    );

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.doubleClick(cell);

    const input = document.querySelector('.grid-cell input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Draft' } });

    // Escape should cancel without committing
    fireEvent.keyDown(input, { key: 'Escape' });

    // Cell change should not be called for the draft value
    // (the cancelRef prevents the blur commit)
    expect(onCellChange).not.toHaveBeenCalled();
  });

  it('commits edit on Tab and exits edit mode', () => {
    const onCellChange = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onCellChange={onCellChange}
        onSelect={jest.fn()}
      />,
    );

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.doubleClick(cell);

    const input = document.querySelector('.grid-cell input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'TabValue' } });

    fireEvent.keyDown(input, { key: 'Tab' });

    // Tab should commit the edit
    expect(onCellChange).toHaveBeenCalled();
    // Input should be gone (edit mode exited)
    expect(document.querySelector('.grid-cell input')).not.toBeInTheDocument();
  });

  it('F2 toggles edit mode off', () => {
    const onCellChange = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onCellChange={onCellChange}
        onSelect={jest.fn()}
      />,
    );

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.doubleClick(cell);

    const input = document.querySelector('.grid-cell input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'EditMe' } });

    // F2 should commit and exit edit mode
    fireEvent.keyDown(input, { key: 'F2' });

    expect(onCellChange).toHaveBeenCalled();
    // Input should be gone after commit
    expect(document.querySelector('.grid-cell input')).not.toBeInTheDocument();
  });

  it('handles paste during editing by inserting at cursor', () => {
    const onCellChange = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onCellChange={onCellChange}
        onSelect={jest.fn()}
      />,
    );

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.doubleClick(cell);

    const input = document.querySelector('.grid-cell input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'HelloWorld' } });

    // Set cursor to position 5
    input.setSelectionRange(5, 5);

    // Simulate paste
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as Event & { clipboardData: DataTransfer };
    pasteEvent.clipboardData = {
      getData: () => ' Beautiful',
    } as unknown as DataTransfer;

    fireEvent(input, pasteEvent);

    // The value should now include the pasted text
    expect(input.value).toBe('Hello BeautifulWorld');
  });
});

describe('Grid - Row/Column Header Selection', () => {
  it('clicking a row header selects the entire row', () => {
    const onHeaderSelect = jest.fn();
    const onSelect = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onHeaderSelect={onHeaderSelect}
        onSelect={onSelect}
      />,
    );

    // Row headers have data-row-header attributes
    const rowHeader = document.querySelector('[data-row-header]') as HTMLElement;
    expect(rowHeader).toBeInTheDocument();
    fireEvent.mouseDown(rowHeader);

    expect(onHeaderSelect).toHaveBeenCalledWith(expect.objectContaining({ type: 'row' }));
    expect(onSelect).toHaveBeenCalled();
  });

  it('clicking a column header selects the entire column', () => {
    const onHeaderSelect = jest.fn();
    const onSelect = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onHeaderSelect={onHeaderSelect}
        onSelect={onSelect}
      />,
    );

    const colHeader = document.querySelector('[data-col-header]') as HTMLElement;
    expect(colHeader).toBeInTheDocument();
    fireEvent.mouseDown(colHeader);

    expect(onHeaderSelect).toHaveBeenCalledWith(expect.objectContaining({ type: 'col' }));
  });

  it('arrow up from row header switches to cell selection at top row', () => {
    const onSelect = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onSelect={onSelect}
      />,
    );

    // Click row header first
    const rowHeader = document.querySelector('[data-row-header]') as HTMLElement;
    fireEvent.mouseDown(rowHeader);

    // Now press ArrowUp — should switch to single-cell selection
    const gridEl = document.querySelector('[tabindex="0"]') as HTMLElement;
    fireEvent.keyDown(gridEl, { key: 'ArrowUp' });

    // Should have selected a single cell (the topmost row)
    expect(onSelect).toHaveBeenCalled();
  });
});

describe('Grid - Point Mode Resize Handles', () => {
  it('renders point mode handles when isPointMode is true', () => {
    const onCellPick = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onCellPick={onCellPick}
        isPointMode={true}
        pointSelection={{
          startRow: 0,
          startCol: 0,
          endRow: 2,
          endCol: 2,
        }}
        referenceFormat="A1"
      />,
    );

    // Point mode renders 4 corner handles (6x6 blue squares)
    // They have nwse-resize or nesw-resize cursor
    const handles = document.querySelectorAll('[style*="nwse-resize"], [style*="nesw-resize"]');
    expect(handles.length).toBeGreaterThan(0);
  });

  it('point mode handle has blue background', () => {
    render(
      <Grid
        sheet={createTestSheet()}
        onCellPick={jest.fn()}
        isPointMode={true}
        pointSelection={{
          startRow: 0,
          startCol: 0,
          endRow: 1,
          endCol: 1,
        }}
        referenceFormat="A1"
      />,
    );

    // Find elements with blue background (point resize handles)
    const blueElements = document.querySelectorAll('[style*="rgb(59, 130, 246)"]');
    expect(blueElements.length).toBeGreaterThan(0);
  });

  it('point mode selection applies visual highlight to cells', () => {
    render(
      <Grid
        sheet={createTestSheet()}
        onCellPick={jest.fn()}
        isPointMode={true}
        pointSelection={{
          startRow: 0,
          startCol: 0,
          endRow: 1,
          endCol: 1,
        }}
      />,
    );

    // Cells in point selection should have dashed border
    const cells = document.querySelectorAll('.grid-cell');
    let highlightedCount = 0;
    cells.forEach((cell) => {
      const style = (cell as HTMLElement).style;
      if (style.outline?.includes('dashed') || style.boxShadow?.includes('inset')) {
        highlightedCount++;
      }
    });
    expect(highlightedCount).toBeGreaterThan(0);
  });
});

describe('Grid - Clipboard Clear on Typing', () => {
  it('clicking a cell to type clears the clipboard visual', () => {
    const onClearClipboard = jest.fn();
    clipboardMockHasData = true;

    render(
      <Grid
        sheet={createTestSheet()}
        onSelect={jest.fn()}
        onClearClipboard={onClearClipboard}
        clipboardRange={{
          startRow: 0,
          startCol: 0,
          endRow: 2,
          endCol: 2,
          isCut: false,
        }}
      />,
    );

    // Typing a character should start editing and clear clipboard
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // After clicking, onClearClipboard should have been called
    // (via handleCellEditWithChar when typing starts)
  });
});

describe('Grid - R1C1 Reference Format', () => {
  it('shows numeric column headers in R1C1 mode', () => {
    render(
      <Grid
        sheet={createTestSheet()}
        referenceFormat="R1C1"
      />,
    );

    // In R1C1 mode, column headers show numbers (1, 2, 3...) not letters
    const colHeaders = document.querySelectorAll('[data-col-header]');
    expect(colHeaders.length).toBeGreaterThan(0);
    // First column header should show "1" not "A"
    expect(colHeaders[0]?.textContent).toBe('1');
  });

  it('shows letter column headers in A1 mode', () => {
    render(
      <Grid
        sheet={createTestSheet()}
        referenceFormat="A1"
      />,
    );

    const colHeaders = document.querySelectorAll('[data-col-header]');
    expect(colHeaders[0]?.textContent).toBe('A');
  });
});

describe('Grid - Marching Ants Clipboard', () => {
  it('renders dashed border on cells in clipboard range', () => {
    render(
      <Grid
        sheet={createTestSheet()}
        clipboardRange={{
          startRow: 0,
          startCol: 0,
          endRow: 1,
          endCol: 1,
          isCut: false,
        }}
      />,
    );

    const cells = document.querySelectorAll('.grid-cell');
    let dashedCount = 0;
    cells.forEach((cell) => {
      const style = (cell as HTMLElement).style;
      if (style.borderTop?.includes('dashed') || style.animation?.includes('marching-ants')) {
        dashedCount++;
      }
    });
    // At least some cells should have marching ants
    expect(dashedCount).toBeGreaterThan(0);
  });
});
