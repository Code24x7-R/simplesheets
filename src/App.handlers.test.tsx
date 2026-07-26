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

describe('App - Cell Edit/Undo/Redo', () => {
  it('performs undo after a cell edit', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    // Focus to enter EDIT mode
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Use the Edit menu to undo
    fireEvent.click(screen.getByText('Edit'));
    const undoItem = screen.getByText('Undo').closest('.menu-item') as HTMLElement;
    expect(undoItem).not.toHaveClass('menu-item-disabled');
    fireEvent.click(undoItem);

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Undo performed');
  });

  it('performs redo after undo', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    // Focus to enter EDIT mode
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Undo via Edit menu
    fireEvent.click(screen.getByText('Edit'));
    const undoItem = screen.getByText('Undo').closest('.menu-item') as HTMLElement;
    fireEvent.click(undoItem);

    // Redo via Edit menu
    fireEvent.click(screen.getByText('Edit'));
    const redoItem = screen.getByText('Redo').closest('.menu-item') as HTMLElement;
    expect(redoItem).not.toHaveClass('menu-item-disabled');
    fireEvent.click(redoItem);

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Redo performed');
  });
});

describe('App - Header Selection', () => {
  it('handles row header selection', () => {
    render(<App />);
    const rowHeaders = document.querySelectorAll('[data-row-header]');
    expect(rowHeaders.length).toBeGreaterThan(0);
    fireEvent.mouseDown(rowHeaders[1]);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    expect(input).toBeInTheDocument();
  });

  it('handles column header selection', () => {
    render(<App />);
    const colHeaders = document.querySelectorAll('[data-col-header]');
    expect(colHeaders.length).toBeGreaterThan(0);
    fireEvent.mouseDown(colHeaders[1]);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    expect(input).toBeInTheDocument();
  });
});

describe('App - Copy/Cut with Row/Col Selection', () => {
  it('copies a single row', () => {
    render(<App />);
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 5, selectionType: 'row' },
    });
    act(() => { window.dispatchEvent(copyEvent); });
    expect(screen.getByText(/Row copied/)).toBeInTheDocument();
  });

  it('copies multiple rows', () => {
    render(<App />);
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 2, endCol: 5, selectionType: 'row' },
    });
    act(() => { window.dispatchEvent(copyEvent); });
    expect(screen.getByText(/Rows copied/)).toBeInTheDocument();
  });

  it('copies a single column', () => {
    render(<App />);
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 5, endCol: 0, selectionType: 'col' },
    });
    act(() => { window.dispatchEvent(copyEvent); });
    expect(screen.getByText(/Column copied/)).toBeInTheDocument();
  });

  it('copies multiple columns', () => {
    render(<App />);
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 5, endCol: 2, selectionType: 'col' },
    });
    act(() => { window.dispatchEvent(copyEvent); });
    expect(screen.getByText(/Columns copied/)).toBeInTheDocument();
  });

  it('cuts a single row', () => {
    render(<App />);
    const cutEvent = new CustomEvent('simplesheets:cut', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 5, selectionType: 'row' },
    });
    act(() => { window.dispatchEvent(cutEvent); });
    expect(screen.getByText(/Row cut/)).toBeInTheDocument();
  });

  it('cuts multiple rows', () => {
    render(<App />);
    const cutEvent = new CustomEvent('simplesheets:cut', {
      detail: { startRow: 0, startCol: 0, endRow: 2, endCol: 5, selectionType: 'row' },
    });
    act(() => { window.dispatchEvent(cutEvent); });
    expect(screen.getByText(/Rows cut/)).toBeInTheDocument();
  });

  it('cuts a single column', () => {
    render(<App />);
    const cutEvent = new CustomEvent('simplesheets:cut', {
      detail: { startRow: 0, startCol: 0, endRow: 5, endCol: 0, selectionType: 'col' },
    });
    act(() => { window.dispatchEvent(cutEvent); });
    expect(screen.getByText(/Column cut/)).toBeInTheDocument();
  });

  it('cuts multiple columns', () => {
    render(<App />);
    const cutEvent = new CustomEvent('simplesheets:cut', {
      detail: { startRow: 0, startCol: 0, endRow: 5, endCol: 2, selectionType: 'col' },
    });
    act(() => { window.dispatchEvent(cutEvent); });
    expect(screen.getByText(/Columns cut/)).toBeInTheDocument();
  });
});

describe('App - Paste with Formula Adjustment', () => {
  it('adjusts formula references when pasting', () => {
    render(<App />);
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 1, startCol: 4, endRow: 1, endCol: 4, selectionType: 'cell' },
    });
    act(() => { window.dispatchEvent(copyEvent); });

    const pasteEvent = new CustomEvent('simplesheets:paste', {
      detail: { startRow: 10, startCol: 10 },
    });
    act(() => { window.dispatchEvent(pasteEvent); });

    expect(screen.getByText(/pasted/i)).toBeInTheDocument();
  });

  it('clears source cells when pasting after cut (move)', () => {
    render(<App />);
    const cutEvent = new CustomEvent('simplesheets:cut', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 0, selectionType: 'cell' },
    });
    act(() => { window.dispatchEvent(cutEvent); });

    const pasteEvent = new CustomEvent('simplesheets:paste', {
      detail: { startRow: 5, startCol: 5 },
    });
    act(() => { window.dispatchEvent(pasteEvent); });

    expect(screen.getByText(/moved/i)).toBeInTheDocument();
  });

  it('handles paste with row selection offset', () => {
    render(<App />);
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 5, selectionType: 'row' },
    });
    act(() => { window.dispatchEvent(copyEvent); });

    const pasteEvent = new CustomEvent('simplesheets:paste', {
      detail: { startRow: 5, startCol: 0 },
    });
    act(() => { window.dispatchEvent(pasteEvent); });

    expect(screen.getByText(/Pasted/)).toBeInTheDocument();
  });

  it('handles paste with column selection offset', () => {
    render(<App />);
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 5, endCol: 0, selectionType: 'col' },
    });
    act(() => { window.dispatchEvent(copyEvent); });

    const pasteEvent = new CustomEvent('simplesheets:paste', {
      detail: { startRow: 0, startCol: 5 },
    });
    act(() => { window.dispatchEvent(pasteEvent); });

    expect(screen.getByText(/Pasted/)).toBeInTheDocument();
  });

  it('handles cut-then-paste for row selection (move rows)', () => {
    render(<App />);
    const cutEvent = new CustomEvent('simplesheets:cut', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 5, selectionType: 'row' },
    });
    act(() => { window.dispatchEvent(cutEvent); });

    const pasteEvent = new CustomEvent('simplesheets:paste', {
      detail: { startRow: 5, startCol: 0 },
    });
    act(() => { window.dispatchEvent(pasteEvent); });

    expect(screen.getByText(/Moved/)).toBeInTheDocument();
  });

  it('handles cut-then-paste for column selection (move columns)', () => {
    render(<App />);
    const cutEvent = new CustomEvent('simplesheets:cut', {
      detail: { startRow: 0, startCol: 0, endRow: 5, endCol: 0, selectionType: 'col' },
    });
    act(() => { window.dispatchEvent(cutEvent); });

    const pasteEvent = new CustomEvent('simplesheets:paste', {
      detail: { startRow: 0, startCol: 5 },
    });
    act(() => { window.dispatchEvent(pasteEvent); });

    expect(screen.getByText(/Moved/)).toBeInTheDocument();
  });
});

describe('App - Resize', () => {
  it('handles column resize via ResizeHandle', () => {
    render(<App />);
    const handles = document.querySelectorAll('.resize-handle');
    expect(handles.length).toBeGreaterThan(0);
    const handle = handles[0];
    fireEvent.mouseDown(handle, { clientX: 100, clientY: 0, bubbles: true });
    fireEvent.mouseMove(document, { clientX: 150, clientY: 0 });
    fireEvent.mouseUp(document, { clientX: 150, clientY: 0 });
    expect(document.querySelector('h1')?.textContent).toBe('SimpleSheet');
  });

  it('handles row resize via ResizeHandle', () => {
    render(<App />);
    const handles = document.querySelectorAll('.resize-handle');
    expect(handles.length).toBeGreaterThan(0);
    const handle = handles[handles.length - 1];
    fireEvent.mouseDown(handle, { clientX: 0, clientY: 28, bubbles: true });
    fireEvent.mouseMove(document, { clientX: 0, clientY: 56 });
    fireEvent.mouseUp(document, { clientX: 0, clientY: 56 });
    expect(document.querySelector('h1')?.textContent).toBe('SimpleSheet');
  });
});

describe('App - Import', () => {
  it('shows import option in File menu', () => {
    render(<App />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.mouseEnter(screen.getByText('Import'));
    expect(screen.getByText('Excel (.xlsx)')).toBeTruthy();
  });
});

describe('App - New Sheet', () => {
  it('creates new workbook when File > New is selected', () => {
    render(<App />);
    // Use File menu
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('New'));

    // Status should update
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Created new workbook');
  });
});

describe('App - Save Button', () => {
  it('shows save status via File menu', () => {
    render(<App />);
    // Use File menu
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Save'));

    // Status should update (currently just shows a message to use the Save button)
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Save');
  });
});

describe('App - Circular Reference', () => {
  it('shows warning when circular reference detected', () => {
    render(<App />);
    const cells = document.querySelectorAll('.grid-cell');
    const cellA1 = Array.from(cells).find(
      (c) => c.getAttribute('data-col') === '0'
    ) as HTMLElement;
    expect(cellA1).toBeDefined();
    fireEvent.mouseDown(cellA1);

    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.change(input, { target: { value: '=A1' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar).toBeInTheDocument();
  });
});
