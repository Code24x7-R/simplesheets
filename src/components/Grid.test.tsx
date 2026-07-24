import { render, screen, fireEvent } from '@testing-library/react';
import { Grid } from './Grid';
import type { Sheet } from '../types';

// Mock the virtualizer to render all items in test environment
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { horizontal?: boolean }) => {
    if (options.horizontal) {
      // Column virtualizer — render first 5 columns
      return {
        getVirtualItems: () => {
          const items = [];
          for (let i = 0; i < 5; i++) {
            items.push({ index: i, start: i * 100, size: 100, end: (i + 1) * 100 });
          }
          return items;
        },
        getTotalSize: () => 5 * 100,
        scrollToIndex: jest.fn(),
        measure: jest.fn(),
      };
    }
    // Row virtualizer — render first 5 rows
    return {
      getVirtualItems: () => {
        const items = [];
        for (let i = 0; i < 5; i++) {
          items.push({ index: i, start: i * 28, size: 28, end: (i + 1) * 28 });
        }
        return items;
      },
      getTotalSize: () => 5 * 28,
      scrollToIndex: jest.fn(),
      measure: jest.fn(),
    };
  },
}));

function createTestSheet(overrides: Partial<Sheet> = {}): Sheet {
  return {
    id: 'test',
    name: 'Test',
    cells: {
      '0:0': { rawValue: 'A1' },
      '0:1': { rawValue: 'B1' },
      '1:0': { rawValue: '42' },
      '1:1': { rawValue: '=A2*2', computedValue: 84 },
    },
    defaultColWidth: 100,
    defaultRowHeight: 28,
    columnWidths: {},
    rowHeights: {},
    columnCount: 3,
    rowCount: 5,
    frozenColumns: 0,
    frozenRows: 0,
    ...overrides,
  };
}

describe('Grid Component', () => {
  it('renders without crashing', () => {
    const { container } = render(<Grid sheet={createTestSheet()} />);
    expect(container.querySelector('[tabindex="0"]')).toBeInTheDocument();
  });

  it('displays cell values', () => {
    render(<Grid sheet={createTestSheet()} />);
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('shows computed values for formulas', () => {
    render(<Grid sheet={createTestSheet()} />);
    expect(screen.getByText('84')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<Grid sheet={createTestSheet()} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('renders row numbers', () => {
    render(<Grid sheet={createTestSheet()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('calls onSelect when a cell is clicked', () => {
    const onSelect = jest.fn();
    render(<Grid sheet={createTestSheet()} onSelect={onSelect} />);

    // mousedown triggers selection
    fireEvent.mouseDown(screen.getByText('A1'));
    expect(onSelect).toHaveBeenCalledWith(0, 0);
  });

  it('calls onCellChange when editing is committed', () => {
    const onCellChange = jest.fn();
    render(<Grid sheet={createTestSheet()} onCellChange={onCellChange} />);

    // Double-click to edit
    const cell = screen.getByText('A1').closest('.grid-cell') as HTMLElement;
    fireEvent.dblClick(cell);

    // Find the editing input (has blue border class)
    const input = document.querySelector('input.border-blue-500') as HTMLInputElement;
    expect(input).not.toBeNull();

    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCellChange).toHaveBeenCalledWith(0, 0, 'Hello');
  });

  it('cancels editing on Escape without saving', () => {
    const onCellChange = jest.fn();
    render(<Grid sheet={createTestSheet()} onCellChange={onCellChange} />);

    const cell = screen.getByText('A1').closest('.grid-cell') as HTMLElement;
    fireEvent.dblClick(cell);

    const input = document.querySelector('input.border-blue-500') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onCellChange).not.toHaveBeenCalled();
  });

  it('commits edit on blur', () => {
    const onCellChange = jest.fn();
    render(<Grid sheet={createTestSheet()} onCellChange={onCellChange} />);

    const cell = screen.getByText('A1').closest('.grid-cell') as HTMLElement;
    fireEvent.dblClick(cell);

    const input = document.querySelector('input.border-blue-500') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: 'Blurred' } });
    fireEvent.blur(input);

    expect(onCellChange).toHaveBeenCalledWith(0, 0, 'Blurred');
  });

  it('displays empty cells correctly', () => {
    render(<Grid sheet={createTestSheet()} />);
    // Cell C3 (2:2) is empty — just verify grid renders
    const grid = document.querySelector('[tabindex="0"]');
    expect(grid).toBeInTheDocument();
  });

  // ─── Row / Column Header Selection ────────────────────────────────────

  it('selects an entire row when clicking a row header', () => {
    const onHeaderSelect = jest.fn();
    const onSelect = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onHeaderSelect={onHeaderSelect}
        onSelect={onSelect}
      />
    );

    // Row headers display row numbers (1-indexed). Row 3 = index 2.
    const rowHeader = screen.getByText('3').closest('.grid-cell-header') as HTMLElement;
    expect(rowHeader).not.toBeNull();
    fireEvent.mouseDown(rowHeader);

    expect(onHeaderSelect).toHaveBeenCalledWith({ type: 'row', index: 2 });
    expect(onSelect).toHaveBeenCalledWith(2, 0);
  });

  it('selects an entire column when clicking a column header', () => {
    const onHeaderSelect = jest.fn();
    const onSelect = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onHeaderSelect={onHeaderSelect}
        onSelect={onSelect}
      />
    );

    // Column headers show letters. Column B = index 1.
    const colHeader = screen.getByText('B').closest('.grid-cell-header') as HTMLElement;
    expect(colHeader).not.toBeNull();
    fireEvent.mouseDown(colHeader);

    expect(onHeaderSelect).toHaveBeenCalledWith({ type: 'col', index: 1 });
    expect(onSelect).toHaveBeenCalledWith(0, 1);
  });

  it('highlights selected row header with blue background', () => {
    render(<Grid sheet={createTestSheet()} />);

    // Click row header for row 1 (index 0)
    const rowHeader = screen.getByText('1').closest('.grid-cell-header') as HTMLElement;
    fireEvent.mouseDown(rowHeader);

    // The selected header should have the blue-600 class
    expect(rowHeader.classList.contains('bg-blue-600')).toBe(true);
    expect(rowHeader.classList.contains('text-white')).toBe(true);
  });

  it('highlights selected column header with blue background', () => {
    render(<Grid sheet={createTestSheet()} />);

    // Click column header A (index 0)
    const colHeader = screen.getByText('A').closest('.grid-cell-header') as HTMLElement;
    fireEvent.mouseDown(colHeader);

    expect(colHeader.classList.contains('bg-blue-600')).toBe(true);
    expect(colHeader.classList.contains('text-white')).toBe(true);
  });

  it('extends row selection with shift-click on another row header', () => {
    const onHeaderSelect = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onHeaderSelect={onHeaderSelect}
      />
    );

    // Click row 1 (index 0)
    const row1 = screen.getByText('1').closest('.grid-cell-header') as HTMLElement;
    fireEvent.mouseDown(row1);

    // Shift-click row 4 (index 3)
    const row4 = screen.getByText('4').closest('.grid-cell-header') as HTMLElement;
    fireEvent.mouseDown(row4, { shiftKey: true });

    // Both headers should be highlighted
    expect(row1.classList.contains('bg-blue-600')).toBe(true);
    expect(row4.classList.contains('bg-blue-600')).toBe(true);
  });

  it('extends column selection with shift-click on another column header', () => {
    const onHeaderSelect = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onHeaderSelect={onHeaderSelect}
      />
    );

    // Click column A (index 0)
    const colA = screen.getByText('A').closest('.grid-cell-header') as HTMLElement;
    fireEvent.mouseDown(colA);

    // Shift-click column C (index 2)
    const colC = screen.getByText('C').closest('.grid-cell-header') as HTMLElement;
    fireEvent.mouseDown(colC, { shiftKey: true });

    // Both headers should be highlighted
    expect(colA.classList.contains('bg-blue-600')).toBe(true);
    expect(colC.classList.contains('bg-blue-600')).toBe(true);
  });

  // ─── Copy / Cut with Row/Col Selection ─────────────────────────────────

  it('dispatches copy event with selectionType "row" when a row is selected', () => {
    render(<Grid sheet={createTestSheet()} />);

    // Select row 1 (index 0) by clicking its header
    const rowHeader = screen.getByText('1').closest('.grid-cell-header') as HTMLElement;
    fireEvent.mouseDown(rowHeader);

    // Spy on the copy event
    const handler = jest.fn();
    window.addEventListener('simplesheets:copy', handler);

    // Trigger Ctrl+C
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;
    fireEvent.keyDown(grid, { key: 'c', ctrlKey: true });

    expect(handler).toHaveBeenCalled();
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail.selectionType).toBe('row');
    expect(event.detail.startCol).toBe(0);

    window.removeEventListener('simplesheets:copy', handler);
  });

  it('dispatches copy event with selectionType "col" when a column is selected', () => {
    render(<Grid sheet={createTestSheet()} />);

    // Select column A (index 0) by clicking its header
    const colHeader = screen.getByText('A').closest('.grid-cell-header') as HTMLElement;
    fireEvent.mouseDown(colHeader);

    const handler = jest.fn();
    window.addEventListener('simplesheets:copy', handler);

    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;
    fireEvent.keyDown(grid, { key: 'c', ctrlKey: true });

    expect(handler).toHaveBeenCalled();
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail.selectionType).toBe('col');
    expect(event.detail.startRow).toBe(0);

    window.removeEventListener('simplesheets:copy', handler);
  });

  // ─── Column / Row Resize ────────────────────────────────────────────

  it('renders resize handles (hidden by default) when resize callbacks are provided', () => {
    render(
      <Grid
        sheet={createTestSheet()}
        onColumnResize={jest.fn()}
        onRowResize={jest.fn()}
      />
    );

    const handles = document.querySelectorAll('.resize-handle');
    expect(handles.length).toBeGreaterThanOrEqual(6); // 3 col + 3 row headers
    // All handles should be hidden by default
    handles.forEach((handle) => {
      expect(handle.classList.contains('opacity-0')).toBe(true);
    });
  });

  it('shows resize handle on column header hover', () => {
    render(
      <Grid
        sheet={createTestSheet()}
        onColumnResize={jest.fn()}
      />
    );

    const colHeaderB = screen.getByText('B').closest('.grid-cell-header') as HTMLElement;
    const handle = colHeaderB.querySelector('.resize-handle') as HTMLElement;

    expect(handle.classList.contains('opacity-0')).toBe(true);

    fireEvent.mouseEnter(colHeaderB);
    expect(handle.classList.contains('opacity-100')).toBe(true);

    fireEvent.mouseLeave(colHeaderB);
    expect(handle.classList.contains('opacity-0')).toBe(true);
  });

  it('shows resize handle on row header hover', () => {
    render(
      <Grid
        sheet={createTestSheet()}
        onRowResize={jest.fn()}
      />
    );

    const rowHeader2 = screen.getByText('2').closest('.grid-cell-header') as HTMLElement;
    const handle = rowHeader2.querySelector('.resize-handle') as HTMLElement;

    expect(handle.classList.contains('opacity-0')).toBe(true);

    fireEvent.mouseEnter(rowHeader2);
    expect(handle.classList.contains('opacity-100')).toBe(true);

    fireEvent.mouseLeave(rowHeader2);
    expect(handle.classList.contains('opacity-0')).toBe(true);
  });

  it('calls onColumnResize once on drag commit (not during drag)', () => {
    const onColumnResize = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onColumnResize={onColumnResize}
      />
    );

    const colHeaderB = screen.getByText('B').closest('.grid-cell-header') as HTMLElement;
    const handle = colHeaderB.querySelector('.resize-handle') as HTMLElement;

    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 130 });
    fireEvent.mouseMove(document, { clientX: 150 });
    fireEvent.mouseUp(document, { clientX: 150 });

    // Parent callback fires exactly once — on commit
    expect(onColumnResize).toHaveBeenCalledTimes(1);
    expect(onColumnResize).toHaveBeenCalledWith(1, 150);
  });

  it('updates column header width in the DOM during drag (live preview)', () => {
    render(
      <Grid
        sheet={createTestSheet()}
        onColumnResize={jest.fn()}
      />
    );

    const colHeaderB = screen.getByText('B').closest('.grid-cell-header') as HTMLElement;
    const handle = colHeaderB.querySelector('.resize-handle') as HTMLElement;

    // Initial width is 100 (defaultColWidth)
    expect(colHeaderB.style.width).toBe('100px');

    // Start drag and move — DOM should update immediately (no re-render needed)
    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 160 });

    // Width should be 160 (100 + 60 delta) — updated via direct DOM manipulation
    expect(colHeaderB.style.width).toBe('160px');

    // Move again
    fireEvent.mouseMove(document, { clientX: 200 });
    expect(colHeaderB.style.width).toBe('200px');

    // Commit
    fireEvent.mouseUp(document, { clientX: 200 });
    expect(colHeaderB.style.width).toBe('200px');
  });

  it('keeps adjacent column position stable during multi-step drag (no drift)', () => {
    render(
      <Grid
        sheet={createTestSheet()}
        onColumnResize={jest.fn()}
      />
    );

    const colHeaderA = screen.getByText('A').closest('.grid-cell-header') as HTMLElement;
    const colHeaderB = screen.getByText('B').closest('.grid-cell-header') as HTMLElement;
    const colHeaderC = screen.getByText('C').closest('.grid-cell-header') as HTMLElement;
    const handleB = colHeaderB.querySelector('.resize-handle') as HTMLElement;

    // Record original positions of adjacent columns
    const origLeftA = parseFloat(colHeaderA.style.left);
    const origLeftC = parseFloat(colHeaderC.style.left);

    // Drag column B wider in multiple steps
    fireEvent.mouseDown(handleB, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 130 });
    fireEvent.mouseMove(document, { clientX: 160 });
    fireEvent.mouseMove(document, { clientX: 200 });
    fireEvent.mouseUp(document, { clientX: 200 });

    // Column A (before B) should not move at all
    expect(parseFloat(colHeaderA.style.left)).toBe(origLeftA);
    // Column C (after B) should shift by exactly the total delta (100px), not more
    expect(parseFloat(colHeaderC.style.left)).toBe(origLeftC + 100);
  });

  it('keeps adjacent row position stable during multi-step drag (no drift)', () => {
    render(
      <Grid
        sheet={createTestSheet()}
        onRowResize={jest.fn()}
      />
    );

    const rowHeader1 = screen.getByText('1').closest('.grid-cell-header') as HTMLElement;
    const rowHeader2 = screen.getByText('2').closest('.grid-cell-header') as HTMLElement;
    const rowHeader3 = screen.getByText('3').closest('.grid-cell-header') as HTMLElement;
    const handle2 = rowHeader2.querySelector('.resize-handle') as HTMLElement;

    // rowHeader3 is inside the row-2 container, so check the container's top
    const rowContainer3 = rowHeader3.closest('[data-row-container]') as HTMLElement;
    const origTop1 = parseFloat((rowHeader1.closest('[data-row-container]') as HTMLElement).style.top);
    const origTop3 = parseFloat(rowContainer3.style.top);

    // Drag row 2 taller in multiple steps
    fireEvent.mouseDown(handle2, { clientY: 50 });
    fireEvent.mouseMove(document, { clientY: 70 });
    fireEvent.mouseMove(document, { clientY: 90 });
    fireEvent.mouseUp(document, { clientY: 90 });

    // Row 1 (before row 2) should not move
    expect(parseFloat((rowHeader1.closest('[data-row-container]') as HTMLElement).style.top)).toBe(origTop1);
    // Row 3 (after row 2) should shift by exactly the total delta (40px)
    expect(parseFloat(rowContainer3.style.top)).toBe(origTop3 + 40);
  });

  it('updates row header height in the DOM during drag (live preview)', () => {
    render(
      <Grid
        sheet={createTestSheet()}
        onRowResize={jest.fn()}
      />
    );

    const rowHeader2 = screen.getByText('2').closest('.grid-cell-header') as HTMLElement;
    const handle = rowHeader2.querySelector('.resize-handle') as HTMLElement;

    // Initial height is 28 (defaultRowHeight)
    expect(rowHeader2.style.height).toBe('28px');

    fireEvent.mouseDown(handle, { clientY: 50 });
    fireEvent.mouseMove(document, { clientY: 80 });

    // Height should be 58 (28 + 30 delta)
    expect(rowHeader2.style.height).toBe('58px');

    fireEvent.mouseUp(document, { clientY: 80 });
    expect(rowHeader2.style.height).toBe('58px');
  });

  it('calls onRowResize once on drag commit (not during drag)', () => {
    const onRowResize = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onRowResize={onRowResize}
      />
    );

    const rowHeader2 = screen.getByText('2').closest('.grid-cell-header') as HTMLElement;
    const handle = rowHeader2.querySelector('.resize-handle') as HTMLElement;

    fireEvent.mouseDown(handle, { clientY: 50 });
    fireEvent.mouseMove(document, { clientY: 70 });
    fireEvent.mouseMove(document, { clientY: 80 });
    fireEvent.mouseUp(document, { clientY: 80 });

    expect(onRowResize).toHaveBeenCalledTimes(1);
    expect(onRowResize).toHaveBeenCalledWith(1, 58);
  });

  it('keeps handle visible during column drag (even without hover)', () => {
    const onColumnResize = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onColumnResize={onColumnResize}
      />
    );

    const colHeaderA = screen.getByText('A').closest('.grid-cell-header') as HTMLElement;
    const handle = colHeaderA.querySelector('.resize-handle') as HTMLElement;

    // Hidden initially
    expect(handle.classList.contains('opacity-0')).toBe(true);

    // Start drag — handle should become visible
    fireEvent.mouseDown(handle, { clientX: 0 });
    expect(handle.classList.contains('opacity-100')).toBe(true);

    fireEvent.mouseUp(document, { clientX: 50 });

    // After release — handle should be hidden again
    expect(handle.classList.contains('opacity-0')).toBe(true);
  });

  it('does not trigger column header click when dragging resize handle', () => {
    const onHeaderSelect = jest.fn();
    const onColumnResize = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onHeaderSelect={onHeaderSelect}
        onColumnResize={onColumnResize}
      />
    );

    const colHeaderA = screen.getByText('A').closest('.grid-cell-header') as HTMLElement;
    const handle = colHeaderA.querySelector('.resize-handle') as HTMLElement;

    fireEvent.mouseDown(handle, { clientX: 0 });
    fireEvent.mouseMove(document, { clientX: 50 });
    fireEvent.mouseUp(document, { clientX: 50 });

    expect(onHeaderSelect).not.toHaveBeenCalled();
    expect(onColumnResize).toHaveBeenCalledWith(0, 150);
  });

  it('does not trigger row header click when dragging resize handle', () => {
    const onHeaderSelect = jest.fn();
    const onRowResize = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        onHeaderSelect={onHeaderSelect}
        onRowResize={onRowResize}
      />
    );

    const rowHeader1 = screen.getByText('1').closest('.grid-cell-header') as HTMLElement;
    const handle = rowHeader1.querySelector('.resize-handle') as HTMLElement;

    fireEvent.mouseDown(handle, { clientY: 0 });
    fireEvent.mouseMove(document, { clientY: 40 });
    fireEvent.mouseUp(document, { clientY: 40 });

    expect(onHeaderSelect).not.toHaveBeenCalled();
    expect(onRowResize).toHaveBeenCalledWith(0, 68);
  });

  // ─── Point Mode ────────────────────────────────────────────────────

  it('calls onCellPick when clicking in point mode', () => {
    const onCellPick = jest.fn();
    render(
      <Grid
        sheet={createTestSheet()}
        isPointMode={true}
        onCellPick={onCellPick}
      />
    );

    // Click cell B1 (0:1)
    fireEvent.mouseDown(screen.getByText('B1'));
    expect(onCellPick).toHaveBeenCalledWith(0, 1, false);
  });

  // ─── Copy / Cut / Paste Keyboard ──────────────────────────────────

  it('dispatches cut event with selectionType "cell" for cell selection', () => {
    render(<Grid sheet={createTestSheet()} />);

    // Select cell A1
    fireEvent.mouseDown(screen.getByText('A1'));

    const handler = jest.fn();
    window.addEventListener('simplesheets:cut', handler);

    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;
    fireEvent.keyDown(grid, { key: 'x', ctrlKey: true });

    expect(handler).toHaveBeenCalled();
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail.selectionType).toBe('cell');

    window.removeEventListener('simplesheets:cut', handler);
  });

  it('dispatches paste event', () => {
    render(<Grid sheet={createTestSheet()} />);

    // Select cell A1
    fireEvent.mouseDown(screen.getByText('A1'));

    const handler = jest.fn();
    window.addEventListener('simplesheets:paste', handler);

    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;
    fireEvent.keyDown(grid, { key: 'v', ctrlKey: true });

    expect(handler).toHaveBeenCalled();

    window.removeEventListener('simplesheets:paste', handler);
  });

  // ─── Keyboard Navigation ─────────────────────────────────────────

  it('navigates cells with arrow keys', () => {
    const onSelect = jest.fn();
    render(<Grid sheet={createTestSheet()} onSelect={onSelect} />);

    // Select cell A1
    fireEvent.mouseDown(screen.getByText('A1'));
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Arrow right
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenCalledWith(0, 1);

    // Arrow down
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith(1, 1);
  });

  it('navigates cells with arrow keys when selectedCell prop is set', () => {
    const onSelect = jest.fn();
    // Simulate App.tsx: selectedCell is passed as a prop (not just internal click)
    // Use a 10x10 sheet so we have room to navigate in all directions
    render(<Grid sheet={createTestSheet({ rowCount: 10, columnCount: 10 })} onSelect={onSelect} selectedCell={{ row: 5, col: 5 }} />);
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Arrow right from F6 → G6
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenCalledWith(5, 6);

    // Arrow down from G6 → G7
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith(6, 6);

    // Arrow left from G7 → F7
    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenCalledWith(6, 5);

    // Arrow up from F7 → F6
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    expect(onSelect).toHaveBeenCalledWith(5, 5);
  });

  it('clamps arrow key navigation at grid boundaries', () => {
    const onSelect = jest.fn();
    // Start at top-left corner (A1)
    render(<Grid sheet={createTestSheet()} onSelect={onSelect} selectedCell={{ row: 0, col: 0 }} />);
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Arrow up should stay at row 0
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    expect(onSelect).toHaveBeenCalledWith(0, 0);

    // Arrow left should stay at col 0
    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenCalledWith(0, 0);
  });

  it('shift+arrow expands selection range', () => {
    const onSelect = jest.fn();
    render(<Grid sheet={createTestSheet({ rowCount: 10, columnCount: 10 })} onSelect={onSelect} selectedCell={{ row: 5, col: 5 }} />);
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Shift+ArrowRight should expand selection from anchor (5,5) to (5,6)
    fireEvent.keyDown(grid, { key: 'ArrowRight', shiftKey: true });
    expect(onSelect).toHaveBeenCalledWith(5, 6);

    // Shift+ArrowDown should expand selection from anchor (5,5) to (6,6)
    fireEvent.keyDown(grid, { key: 'ArrowDown', shiftKey: true });
    expect(onSelect).toHaveBeenCalledWith(6, 6);
  });

  it('Home key moves to first column', () => {
    const onSelect = jest.fn();
    render(<Grid sheet={createTestSheet({ rowCount: 10, columnCount: 10 })} onSelect={onSelect} selectedCell={{ row: 5, col: 5 }} />);
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Home should move to column 0 of current row
    fireEvent.keyDown(grid, { key: 'Home' });
    expect(onSelect).toHaveBeenCalledWith(5, 0);
  });

  it('Ctrl+Home key moves to top-left corner', () => {
    const onSelect = jest.fn();
    render(<Grid sheet={createTestSheet({ rowCount: 10, columnCount: 10 })} onSelect={onSelect} selectedCell={{ row: 5, col: 5 }} />);
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Ctrl+Home should move to (0, 0)
    fireEvent.keyDown(grid, { key: 'Home', ctrlKey: true });
    expect(onSelect).toHaveBeenCalledWith(0, 0);
  });

  it('Delete key clears cell contents', () => {
    const onSelect = jest.fn();
    const onCellChange = jest.fn();
    render(
      <Grid
        sheet={createTestSheet({ rowCount: 10, columnCount: 10 })}
        onSelect={onSelect}
        onCellChange={onCellChange}
        selectedCell={{ row: 5, col: 5 }}
      />
    );
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Delete should clear the cell
    fireEvent.keyDown(grid, { key: 'Delete' });
    expect(onCellChange).toHaveBeenCalledWith(5, 5, '');
  });

  it('Backspace key clears cell contents', () => {
    const onSelect = jest.fn();
    const onCellChange = jest.fn();
    render(
      <Grid
        sheet={createTestSheet({ rowCount: 10, columnCount: 10 })}
        onSelect={onSelect}
        onCellChange={onCellChange}
        selectedCell={{ row: 5, col: 5 }}
      />
    );
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Backspace should clear the cell
    fireEvent.keyDown(grid, { key: 'Backspace' });
    expect(onCellChange).toHaveBeenCalledWith(5, 5, '');
  });

  // ─── Bulk Operations (Range / Row / Column) ────────────────────────

  it('Delete key clears all cells in a range selection', () => {
    const onCellsChange = jest.fn();
    render(
      <Grid
        sheet={createTestSheet({ rowCount: 10, columnCount: 10 })}
        onCellsChange={onCellsChange}
        selectedCell={{ row: 0, col: 0 }}
      />
    );
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Create a 2x2 selection by shift+clicking
    // First, set up a selection by navigating with shift+arrow
    fireEvent.keyDown(grid, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(grid, { key: 'ArrowDown', shiftKey: true });

    // Now press Delete to clear all cells in the selection
    fireEvent.keyDown(grid, { key: 'Delete' });

    // Should call onCellsChange with all 4 cells in the 2x2 range
    expect(onCellsChange).toHaveBeenCalled();
    const changes = onCellsChange.mock.calls[0][0];
    expect(changes.length).toBe(4);
    // All changes should have empty value
    expect(changes.every((c: { value: string }) => c.value === '')).toBe(true);
  });

  it('Backspace key clears all cells in a range selection', () => {
    const onCellsChange = jest.fn();
    render(
      <Grid
        sheet={createTestSheet({ rowCount: 10, columnCount: 10 })}
        onCellsChange={onCellsChange}
        selectedCell={{ row: 0, col: 0 }}
      />
    );
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Create a 2x2 selection
    fireEvent.keyDown(grid, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(grid, { key: 'ArrowDown', shiftKey: true });

    // Backspace to clear
    fireEvent.keyDown(grid, { key: 'Backspace' });

    expect(onCellsChange).toHaveBeenCalled();
    const changes = onCellsChange.mock.calls[0][0];
    expect(changes.length).toBe(4);
  });

  it('Delete key clears all cells in a row selection', () => {
    const onCellsChange = jest.fn();
    render(
      <Grid
        sheet={createTestSheet({ rowCount: 10, columnCount: 10 })}
        onCellsChange={onCellsChange}
      />
    );
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Select row 0 by clicking the row header
    const rowHeader = screen.getByText('1').closest('.grid-cell-header') as HTMLElement;
    fireEvent.mouseDown(rowHeader);

    // Delete to clear the entire row
    fireEvent.keyDown(grid, { key: 'Delete' });

    expect(onCellsChange).toHaveBeenCalled();
    const changes = onCellsChange.mock.calls[0][0];
    // Should clear all columns in the row (10 columns based on columnCount)
    expect(changes.length).toBe(10);
    expect(changes[0].row).toBe(0);
  });

  it('Delete key clears all cells in a column selection', () => {
    const onCellsChange = jest.fn();
    render(
      <Grid
        sheet={createTestSheet({ rowCount: 10, columnCount: 10 })}
        onCellsChange={onCellsChange}
      />
    );
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Select column A by clicking the column header
    const colHeader = screen.getByText('A').closest('.grid-cell-header') as HTMLElement;
    fireEvent.mouseDown(colHeader);

    // Delete to clear the entire column
    fireEvent.keyDown(grid, { key: 'Delete' });

    expect(onCellsChange).toHaveBeenCalled();
    const changes = onCellsChange.mock.calls[0][0];
    // Should clear all rows in the column (10 rows based on rowCount)
    expect(changes.length).toBe(10);
    expect(changes[0].col).toBe(0);
  });

  it('returns focus to grid after pressing Enter to commit edit', () => {
    const onCellChange = jest.fn();
    // Use cell (2, 2) which is visible in the 5x5 virtualizer mock
    render(
      <Grid
        sheet={createTestSheet({ rowCount: 10, columnCount: 10 })}
        onCellChange={onCellChange}
        selectedCell={{ row: 2, col: 2 }}
      />
    );
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Start editing
    fireEvent.keyDown(grid, { key: 'Enter' });

    // Find the input and type something
    const input = document.querySelector('input.border-blue-500') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: 'test' } });

    // Press Enter to commit
    fireEvent.keyDown(input, { key: 'Enter' });

    // Grid should have focus back
    expect(grid).toHaveFocus();
  });

  it('edits cell on Enter key', () => {
    const onCellChange = jest.fn();
    render(<Grid sheet={createTestSheet()} onCellChange={onCellChange} />);

    // Select cell A1
    fireEvent.mouseDown(screen.getByText('A1'));
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Press Enter to edit
    fireEvent.keyDown(grid, { key: 'Enter' });

    // Should show editing input
    const input = document.querySelector('input.border-blue-500') as HTMLInputElement;
    expect(input).not.toBeNull();
  });

  it('edits cell on F2 key', () => {
    render(<Grid sheet={createTestSheet()} />);

    fireEvent.mouseDown(screen.getByText('A1'));
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    fireEvent.keyDown(grid, { key: 'F2' });

    const input = document.querySelector('input.border-blue-500') as HTMLInputElement;
    expect(input).not.toBeNull();
  });

  it('cancels editing on Escape', () => {
    const onCellChange = jest.fn();
    render(<Grid sheet={createTestSheet()} onCellChange={onCellChange} />);

    // Edit cell A1
    fireEvent.mouseDown(screen.getByText('A1'));
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;
    fireEvent.keyDown(grid, { key: 'Enter' });

    // Escape to cancel
    const input = document.querySelector('input.border-blue-500') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Escape' });

    // Input should be gone
    expect(document.querySelector('input.border-blue-500')).toBeNull();
  });

  // ─── Excel-like Direct Entry Editing ─────────────────────────────

  it('starts editing when typing a letter character', () => {
    const onCellChange = jest.fn();
    render(<Grid sheet={createTestSheet()} onCellChange={onCellChange} selectedCell={{ row: 0, col: 0 }} />);
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Type a letter — should start editing immediately
    fireEvent.keyDown(grid, { key: 'a' });

    const input = document.querySelector('input.border-blue-500') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('a');
  });

  it('starts editing when typing a number character', () => {
    const onCellChange = jest.fn();
    render(<Grid sheet={createTestSheet()} onCellChange={onCellChange} selectedCell={{ row: 1, col: 0 }} />);
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Type a number — should start editing immediately
    fireEvent.keyDown(grid, { key: '5' });

    const input = document.querySelector('input.border-blue-500') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('5');
  });

  it('starts editing when typing punctuation', () => {
    const onCellChange = jest.fn();
    render(<Grid sheet={createTestSheet()} onCellChange={onCellChange} selectedCell={{ row: 0, col: 0 }} />);
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Type punctuation — should start editing immediately
    fireEvent.keyDown(grid, { key: '!' });

    const input = document.querySelector('input.border-blue-500') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('!');
  });

  it('exits editing mode when pressing F2 during edit', () => {
    const onCellChange = jest.fn();
    render(<Grid sheet={createTestSheet()} onCellChange={onCellChange} selectedCell={{ row: 0, col: 0 }} />);
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Start editing by typing
    fireEvent.keyDown(grid, { key: 'a' });
    const input = document.querySelector('input.border-blue-500') as HTMLInputElement;
    expect(input).not.toBeNull();

    // Type more characters
    fireEvent.change(input, { target: { value: 'abc' } });

    // Press F2 to exit editing
    fireEvent.keyDown(input, { key: 'F2' });

    // Input should be gone (editing exited)
    expect(document.querySelector('input.border-blue-500')).toBeNull();
    // Cell should be committed
    expect(onCellChange).toHaveBeenCalledWith(0, 0, 'abc');
  });

  it('exits editing mode when pressing Enter during edit', () => {
    const onCellChange = jest.fn();
    render(<Grid sheet={createTestSheet()} onCellChange={onCellChange} selectedCell={{ row: 0, col: 0 }} />);
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Start editing by typing
    fireEvent.keyDown(grid, { key: 'x' });
    const input = document.querySelector('input.border-blue-500') as HTMLInputElement;
    expect(input).not.toBeNull();

    // Type more characters
    fireEvent.change(input, { target: { value: 'xyz' } });

    // Press Enter to commit and exit
    fireEvent.keyDown(input, { key: 'Enter' });

    // Input should be gone
    expect(document.querySelector('input.border-blue-500')).toBeNull();
    // Cell should be committed
    expect(onCellChange).toHaveBeenCalledWith(0, 0, 'xyz');
    // Grid should have focus back
    expect(grid).toHaveFocus();
  });

  it('replaces cell content when typing a character', () => {
    const onCellChange = jest.fn();
    // Cell A1 has content 'A1'
    render(<Grid sheet={createTestSheet()} onCellChange={onCellChange} selectedCell={{ row: 0, col: 0 }} />);
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Type a character — should replace content, not append
    fireEvent.keyDown(grid, { key: 'N' });

    const input = document.querySelector('input.border-blue-500') as HTMLInputElement;
    expect(input).not.toBeNull();
    // Value should be just the typed character, not the original 'A1' + 'N'
    expect(input.value).toBe('N');
  });

  // ─── Row / Column Header Keyboard Navigation ─────────────────────

  it('switches from row selection to cell selection on arrow left/right', () => {
    const onSelect = jest.fn();
    render(<Grid sheet={createTestSheet()} onSelect={onSelect} />);

    // Select row 1
    const rowHeader = screen.getByText('1').closest('.grid-cell-header') as HTMLElement;
    fireEvent.mouseDown(rowHeader);

    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;
    fireEvent.keyDown(grid, { key: 'ArrowRight' });

    // Should switch to cell selection at (0, lastCol)
    expect(onSelect).toHaveBeenCalledWith(0, 2); // columnCount=3, so lastCol=2
  });

  it('switches from column selection to cell selection on arrow up/down', () => {
    const onSelect = jest.fn();
    render(<Grid sheet={createTestSheet()} onSelect={onSelect} />);

    // Select column A
    const colHeader = screen.getByText('A').closest('.grid-cell-header') as HTMLElement;
    fireEvent.mouseDown(colHeader);

    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;
    fireEvent.keyDown(grid, { key: 'ArrowDown' });

    // Should switch to cell selection at (lastRow, 0)
    expect(onSelect).toHaveBeenCalledWith(4, 0); // rowCount=5, so lastRow=4
  });

  // ─── Keyboard Shortcuts ────────────────────────────────────────

  it('does not handle undo/redo keys (parent handles them)', () => {
    const { container } = render(<Grid sheet={createTestSheet()} />);
    const grid = container.querySelector('[tabindex="0"]') as HTMLElement;

    // Press Ctrl+Z - should not throw (parent handles undo)
    fireEvent.keyDown(grid, { key: 'z', ctrlKey: true });
    // Press Ctrl+Y - should not throw (parent handles redo)
    fireEvent.keyDown(grid, { key: 'y', ctrlKey: true });

    // Should not throw and grid still renders
    expect(grid).toBeInTheDocument();
  });

  // ─── Highlighted Ranges ─────────────────────────────────────────

  it('renders highlighted ranges from formula references', () => {
    render(
      <Grid
        sheet={createTestSheet()}
        highlightedRanges={[
          { startRow: 0, startCol: 0, endRow: 0, endCol: 0, colorIndex: 0 },
        ]}
      />
    );

    // Cell A1 should have highlight styling
    const cellA1 = screen.getByText('A1').closest('.grid-cell') as HTMLElement;
    expect(cellA1.style.backgroundColor).toContain('59, 130, 246');
  });
});
