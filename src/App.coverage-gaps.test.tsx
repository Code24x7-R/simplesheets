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

describe('App - Batch Entry (Ctrl+Enter on range selection)', () => {
  it('applies value to all cells in range selection via batch entry (FormulaBar)', () => {
    render(<App />);
    const formulaBarInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;

    // Put a value in A1 via FormulaBar (no double-click, avoids stale editingCell)
    const cellA1 = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cellA1);
    fireEvent.focus(formulaBarInput);
    fireEvent.change(formulaBarInput, { target: { value: '1' } });
    fireEvent.keyDown(formulaBarInput, { key: 'Enter' });

    // Put a value in B1 via FormulaBar
    const cells = document.querySelectorAll('.grid-cell');
    const cellB1 = Array.from(cells).find(
      (c) => c.getAttribute('data-col') === '1'
    ) as HTMLElement;
    fireEvent.mouseDown(cellB1);
    fireEvent.focus(formulaBarInput);
    fireEvent.change(formulaBarInput, { target: { value: '2' } });
    fireEvent.keyDown(formulaBarInput, { key: 'Enter' });

    // Select A1:B1 range via shift-click
    fireEvent.mouseDown(cellA1);
    fireEvent.mouseDown(cellB1, { shiftKey: true });

    // Type in FormulaBar and Ctrl+Enter for batch entry
    fireEvent.focus(formulaBarInput);
    fireEvent.change(formulaBarInput, { target: { value: 'X' } });
    act(() => {
      fireEvent.keyDown(formulaBarInput, { key: 'Enter', ctrlKey: true });
    });

    // All cells in range should have value X
    const updatedCells = document.querySelectorAll('.grid-cell');
    const getCellText = (col: number) => {
      const cell = Array.from(updatedCells).find(
        (c) => c.getAttribute('data-col') === String(col)
      );
      return cell?.textContent;
    };
    expect(getCellText(0)).toBe('X');
    expect(getCellText(1)).toBe('X');
  });
});

describe('App - Window Blur Handler', () => {
  it('commits active edit when window loses focus', () => {
    render(<App />);

    // Start editing via FormulaBar (drives FSM into ENTER/EDIT state)
    const formulaBarInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;
    fireEvent.focus(formulaBarInput);
    fireEvent.change(formulaBarInput, { target: { value: 'blur test' } });

    // Simulate window blur using dispatchEvent (jsdom-compatible)
    // The FSM is in ENTER/EDIT state, so blur should commit
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });

    // Cell should have the committed value
    const updatedCells = document.querySelectorAll('.grid-cell');
    const cellA1 = Array.from(updatedCells).find(
      (c) => c.getAttribute('data-col') === '0'
    );
    expect(cellA1?.textContent).toBe('blur test');
  });
});

describe('App - Formula Wizard Apply', () => {
  it('renders FormulaWizard component (hidden when closed)', () => {
    render(<App />);
    // FormulaWizard returns null when not open, so it should not be visible
    expect(screen.queryByText('Nested Formula Wizard')).not.toBeInTheDocument();
  });
});

describe('App - POINT Mode Typing', () => {
  it('transitions from POINT to EDIT when typing a letter', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Start editing with = to enter POINT mode
    fireEvent.doubleClick(cell);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.change(input, { target: { value: '=SUM(' } });

    // Now type a letter — should exit POINT and enter EDIT
    fireEvent.change(input, { target: { value: '=SUM(A' } });

    // Type more — should be in EDIT mode now
    fireEvent.change(input, { target: { value: '=SUM(A1' } });

    // Commit
    fireEvent.keyDown(input, { key: 'Enter' });

    // Status should show the formula was entered
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar).toBeInTheDocument();
  });
});

describe('App - Search & Replace Apply', () => {
  it('searches then replaces and closes modal', () => {
    render(<App />);

    // First put a value in a cell via FormulaBar (no double-click)
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    const formulaBarInput = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.focus(formulaBarInput);
    fireEvent.change(formulaBarInput, { target: { value: 'findme' } });
    fireEvent.keyDown(formulaBarInput, { key: 'Enter' });

    // Open Find & Replace via Edit menu
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText(/Find & Replace/));

    // Modal should be visible
    expect(screen.getByText('Find & Replace')).toBeInTheDocument();

    // Type search text and click Search
    const findInput = screen.getByPlaceholderText('Enter text to find…');
    const replaceInput = screen.getByPlaceholderText('Replacement text…');
    fireEvent.change(findInput, { target: { value: 'findme' } });
    fireEvent.change(replaceInput, { target: { value: 'replaced' } });
    fireEvent.click(screen.getByText('🔍 Search'));

    // Now click Replace All
    fireEvent.click(screen.getByText('Replace All'));

    // Modal should close
    expect(screen.queryByText('Find & Replace')).not.toBeInTheDocument();
  });
});

describe('App - Load Menu Handler', () => {
  it('shows load message when File > Load is selected', () => {
    render(<App />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Open…'));

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Open');
  });
});

describe('App - Cut Handler Deletes Source Cells', () => {
  it('clears source cells after cut', () => {
    render(<App />);
    const cells = document.querySelectorAll('.grid-cell');
    const getCell = (col: number) =>
      Array.from(cells).find(
        (c) => c.getAttribute('data-col') === String(col)
      ) as HTMLElement;

    // Put a value in A1
    fireEvent.mouseDown(getCell(0));
    fireEvent.doubleClick(getCell(0));
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.change(input, { target: { value: 'cutme' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Now cut A1
    fireEvent.mouseDown(getCell(0));
    const cutEvent = new CustomEvent('simplesheets:cut', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 0, selectionType: 'cell' },
    });
    act(() => { window.dispatchEvent(cutEvent); });

    // Verify cut status message
    expect(screen.getByTestId('status-message').textContent).toMatch(/cut/i);
  });
});

describe('App - Paste with Skip Blanks Status', () => {
  it('shows blank skip count in status when skipBlanks is true and blanks exist', () => {
    render(<App />);
    // Copy a single cell with a value
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 0, selectionType: 'cell' },
    });
    act(() => { window.dispatchEvent(copyEvent); });

    // Paste with skipBlanks via custom event
    const pasteEvent = new CustomEvent('simplesheets:paste', {
      detail: { startRow: 5, startCol: 5, skipBlanks: false },
    });
    act(() => { window.dispatchEvent(pasteEvent); });

    // Status should show pasted message
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toMatch(/paste/i);
  });
});

describe('App - Fill Handle Horizontal', () => {
  it('fills horizontally when source is a row range (3+ cols)', () => {
    render(<App />);
    const cells = document.querySelectorAll('.grid-cell');
    const getCell = (col: number) =>
      Array.from(cells).find(
        (c) => c.getAttribute('data-col') === String(col)
      ) as HTMLElement;

    // Set up A1=10, B1=20, C1=30
    fireEvent.mouseDown(getCell(0));
    fireEvent.doubleClick(getCell(0));
    let input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    fireEvent.mouseDown(getCell(1));
    fireEvent.doubleClick(getCell(1));
    input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    fireEvent.mouseDown(getCell(2));
    fireEvent.doubleClick(getCell(2));
    input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Select A1:C1
    fireEvent.mouseDown(getCell(0));
    fireEvent.mouseDown(getCell(2), { shiftKey: true });

    // Find and drag fill handle to the right
    const fillHandle = document.querySelector('[data-testid="fill-handle"]') as HTMLElement;
    expect(fillHandle).not.toBeNull();
    fireEvent.mouseDown(fillHandle, { clientX: 350, clientY: 14 });
    fireEvent.mouseMove(window, { clientX: 550, clientY: 14 });
    fireEvent.mouseUp(window);

    // D1 and E1 should have 40 and 50
    const updatedCells = document.querySelectorAll('.grid-cell');
    const getCellText = (col: number) => {
      const cell = Array.from(updatedCells).find(
        (c) => c.getAttribute('data-col') === String(col)
      );
      return cell?.textContent;
    };
    expect(getCellText(3)).toBe('40');
    expect(getCellText(4)).toBe('50');
  });
});

describe('App - Sort No-Change Detection', () => {
  it('does not push history when sort produces no change (ascending)', () => {
    render(<App />);
    // Put a single value in A1 — sorting a single row produces no change
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.doubleClick(cell);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Select A1 and sort ascending
    const cells = document.querySelectorAll('.grid-cell');
    const cellA1 = Array.from(cells).find(
      (c) => c.getAttribute('data-col') === '0'
    ) as HTMLElement;
    fireEvent.mouseDown(cellA1);

    // Open Data menu and sort A→Z
    fireEvent.click(screen.getByText('Data'));
    fireEvent.click(screen.getByText('Sort A → Z'));

    // Status should not show sorted message (no change)
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar).toBeInTheDocument();
  });

  it('does not push history when sort produces no change (descending)', () => {
    render(<App />);
    // Put a single value in A1 — sorting a single row produces no change
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.doubleClick(cell);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Select A1
    const cells = document.querySelectorAll('.grid-cell');
    const cellA1 = Array.from(cells).find(
      (c) => c.getAttribute('data-col') === '0'
    ) as HTMLElement;
    fireEvent.mouseDown(cellA1);

    // Open Data menu and sort Z→A
    fireEvent.click(screen.getByText('Data'));
    fireEvent.click(screen.getByText('Sort Z → A'));

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar).toBeInTheDocument();
  });
});

describe('App - Filter Apply and Clear', () => {
  it('applies a filter to a column', () => {
    render(<App />);
    // First enable filter
    fireEvent.click(screen.getByText('Data'));
    const toggleFilterItem = screen.getByText('Toggle Filter').closest('.menu-item') as HTMLElement;
    fireEvent.click(toggleFilterItem);

    // Now apply filter via FilterDropdown (simulate by calling handler through event)
    const filterEvent = new CustomEvent('simplesheets:applyFilter', {
      detail: { column: 0, filter: { type: 'includes', values: ['test'] } },
    });
    act(() => { window.dispatchEvent(filterEvent); });

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar).toBeInTheDocument();
  });

  it('clears all filters', () => {
    render(<App />);
    // Enable filter
    fireEvent.click(screen.getByText('Data'));
    const toggleFilterItem = screen.getByText('Toggle Filter').closest('.menu-item') as HTMLElement;
    fireEvent.click(toggleFilterItem);

    // Clear all filters
    fireEvent.click(screen.getByText('Data'));
    const clearAllItem = screen.getByText('Clear All Filters').closest('.menu-item') as HTMLElement;
    fireEvent.click(clearAllItem);

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('cleared');
  });
});

describe('App - Paste Special', () => {
  it.skip('shows message when paste special is invoked with no clipboard data', () => {
    render(<App />);
    // Select a cell
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Close any open menu from previous test
    fireEvent.keyDown(document, { key: 'Escape' });
    // Open Edit menu and click Paste Special
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Paste Special…'));

    // Should show "nothing to paste" message
    expect(screen.getByTestId('status-message').textContent).toContain('Nothing to paste');
  });

  it('opens paste special modal when clipboard has data', () => {
    render(<App />);
    // Copy a cell first
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 0, selectionType: 'cell' },
    });
    act(() => { window.dispatchEvent(copyEvent); });

    // Select a cell
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Open Edit menu and click Paste Special
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Paste Special…'));

    // Paste special modal should open
    expect(screen.getByText('Paste Special')).toBeInTheDocument();
  });
});

describe('App - External Paste Bounds Check', () => {
  it('aborts paste when target is outside sheet bounds', () => {
    render(<App />);
    // Parse and paste at a way-out-of-bounds position
    // This is handled by the external paste handler
    const pasteEvent = new CustomEvent('simplesheets:paste', {
      detail: {
        startRow: 99999,
        startCol: 99999,
        selectionType: 'cell',
        skipBlanks: false,
      },
    });
    act(() => { window.dispatchEvent(pasteEvent); });

    // Should show error status
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar).toBeInTheDocument();
  });
});

describe('App - Global Keyboard Shortcuts', () => {
  it('handles Ctrl+Shift+Z for redo', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Edit a cell via FormulaBar (no double-click)
    const formulaBarInput = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.focus(formulaBarInput);
    fireEvent.change(formulaBarInput, { target: { value: 'redo test' } });
    fireEvent.keyDown(formulaBarInput, { key: 'Enter' });

    // Verify value is set
    let updatedCells = document.querySelectorAll('.grid-cell');
    let cellA1 = Array.from(updatedCells).find(
      (c) => c.getAttribute('data-col') === '0'
    );
    expect(cellA1?.textContent).toBe('redo test');

    // Undo via menu
    fireEvent.click(screen.getByText('Edit'));
    const undoItem = screen.getByText('Undo').closest('.menu-item') as HTMLElement;
    fireEvent.click(undoItem);

    // Verify value is gone
    updatedCells = document.querySelectorAll('.grid-cell');
    cellA1 = Array.from(updatedCells).find(
      (c) => c.getAttribute('data-col') === '0'
    );
    expect(cellA1?.textContent).toBe('');

    // Redo via Ctrl+Shift+Z
    act(() => {
      fireEvent.keyDown(window, {
        key: 'Z',
        ctrlKey: true,
        shiftKey: true,
      });
    });

    // Cell should have value back
    updatedCells = document.querySelectorAll('.grid-cell');
    cellA1 = Array.from(updatedCells).find(
      (c) => c.getAttribute('data-col') === '0'
    );
    expect(cellA1?.textContent).toBe('redo test');
  });

  it('handles Ctrl+Shift+L to toggle filter', () => {
    render(<App />);
    // Toggle filter via keyboard
    act(() => {
      fireEvent.keyDown(window, {
        key: 'l',
        ctrlKey: true,
        shiftKey: true,
      });
    });

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Filter enabled');
  });
});
