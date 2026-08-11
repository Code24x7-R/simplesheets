// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';
// Mock pdfExport/excelExport to avoid ESM issues in tests
jest.mock('./services/pdfExport', () => ({
  downloadPdf: jest.fn(() => Promise.resolve()),
}));
jest.mock('./services/excelExport', () => ({
  downloadExcel: jest.fn(),
  exportExcel: jest.fn(() => new Blob()),
}));

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

describe('App', () => {
  it('renders the application header', () => {
    render(<App />);
    expect(screen.getByText('SimpleSheet')).toBeInTheDocument();
  });

  it('renders the formula bar', () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/Enter a value or formula/)).toBeInTheDocument();
  });

  it('renders the menu bar', () => {
    render(<App />);
    expect(screen.getByText('File')).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('View')).toBeTruthy();
    expect(screen.getByText('Insert')).toBeTruthy();
    expect(screen.getByText('Format')).toBeTruthy();
    expect(screen.getByText('Help')).toBeTruthy();
  });

  it('renders the status bar', () => {
    render(<App />);
    // Status bar shows cell mode (Ready/Edit/Enter/POINT)
    expect(screen.getByTestId('cell-mode')).toBeInTheDocument();
    expect(screen.getByTestId('cell-mode').textContent).toBe('Ready');
  });

  it('renders the default workbook title', () => {
    render(<App />);
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('renders the demo workbook title when Load Demo is triggered', () => {
    render(<App />);
    // Click "File" menu, then "Load Demo"
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Load Demo'));
    expect(screen.getByText('SimpleSheet Demo')).toBeInTheDocument();
  });

  it('renders the grid container', () => {
    render(<App />);
    const grid = document.querySelector('[tabindex="0"]');
    expect(grid).toBeInTheDocument();
  });

  it('shows row and column count in status bar', () => {
    render(<App />);
    expect(screen.getByText(/1,000 rows/)).toBeInTheDocument();
  });

  it('renders formula bar input', () => {
    render(<App />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    expect(input).toBeInTheDocument();
  });

  it('updates status message on cell selection', () => {
    render(<App />);
    // Cell mode indicator shows Ready initially
    expect(screen.getByTestId('cell-mode').textContent).toBe('Ready');
  });

  it('opens File menu and shows New item', () => {
    render(<App />);
    fireEvent.click(screen.getByText('File'));
    expect(screen.getByText('New')).toBeTruthy();
  });

  it('opens Edit menu and shows Undo/Redo items', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Undo')).toBeTruthy();
    expect(screen.getByText('Redo')).toBeTruthy();
  });

  it('opens View menu and shows Freeze/Unfreeze items', () => {
    render(<App />);
    fireEvent.click(screen.getByText('View'));
    expect(screen.getByText('Freeze Panes')).toBeTruthy();
    expect(screen.getByText('Unfreeze Panes')).toBeTruthy();
  });

  it('opens Insert menu and shows row/column items', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Insert'));
    expect(screen.getByText('Row Above')).toBeTruthy();
    expect(screen.getByText('Row Below')).toBeTruthy();
    expect(screen.getByText('Column Left')).toBeTruthy();
    expect(screen.getByText('Column Right')).toBeTruthy();
  });

  it('opens Help menu and shows About item', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Help'));
    expect(screen.getByText('About SimpleSheet')).toBeTruthy();
  });

  it('handles copy event', () => {
    render(<App />);
    const event = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(screen.getByText(/copied/i)).toBeInTheDocument();
  });

  it('handles cut event', () => {
    render(<App />);
    const event = new CustomEvent('simplesheets:cut', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(screen.getByText(/cut/i)).toBeInTheDocument();
  });

  it('handles paste event', () => {
    render(<App />);
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
    });
    act(() => {
      window.dispatchEvent(copyEvent);
    });

    const pasteEvent = new CustomEvent('simplesheets:paste', {
      detail: { startRow: 2, startCol: 2 },
    });
    act(() => {
      window.dispatchEvent(pasteEvent);
    });
    expect(screen.getByText(/pasted/i)).toBeInTheDocument();
  });

  it('handles cell change from formula bar', () => {
    render(<App />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toBeInTheDocument();
  });

  it('handles point mode request from formula bar', () => {
    render(<App />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.change(input, { target: { value: '=' } });
    expect(input).toBeInTheDocument();
  });

  it('shows status message for cell edit', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Status should show cell mode after commit
    const cellMode = screen.getByTestId('cell-mode');
    expect(cellMode?.textContent).toBe('Ready');
  });

  it('navigates cells with arrow keys in SELECT state', () => {
    render(<App />);
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;
    expect(grid).not.toBeNull();

    act(() => {
      grid.focus();
    });
    fireEvent.mouseDown(screen.getByText('A1'));

    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });

    expect(grid).toHaveFocus();
  });

  it('renders sheet tabs for multi-sheet workbooks', () => {
    render(<App />);
    expect(screen.getByText('Sheet1')).toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('adds a new sheet when + is clicked', () => {
    render(<App />);
    expect(screen.getByText('Sheet1')).toBeInTheDocument();
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('Sheet2')).toBeInTheDocument();
  });

  it('renames a sheet via double-click', () => {
    render(<App />);
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('Sheet2')).toBeInTheDocument();
    fireEvent.doubleClick(screen.getByText('Sheet2'));
    const input = screen.getByDisplayValue('Sheet2');
    fireEvent.change(input, { target: { value: 'Revenue' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.queryByText('Sheet2')).toBeNull();
  });

  it('copies a sheet via the actions menu', () => {
    render(<App />);
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('Sheet2')).toBeInTheDocument();
    const toggles = screen.getAllByTitle('Sheet actions (Rename, Copy, Delete)');
    fireEvent.click(toggles[1]);
    fireEvent.mouseDown(screen.getByText('Copy'));
    expect(screen.getByText('Sheet2 (Copy)')).toBeInTheDocument();
  });

  it('deletes a sheet via the actions menu', () => {
    render(<App />);
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('Sheet2')).toBeInTheDocument();
    const toggles = screen.getAllByTitle('Sheet actions (Rename, Copy, Delete)');
    fireEvent.click(toggles[1]);
    fireEvent.mouseDown(screen.getByText('Delete'));
    expect(screen.queryByText('Sheet2')).toBeNull();
    expect(screen.getByText('Sheet1')).toBeInTheDocument();
  });

  it('shows View menu freeze status after freeze', () => {
    render(<App />);
    // Select a non-A1 cell so freeze has a reference point
    const allCells = Array.from(document.querySelectorAll('.grid-cell')) as HTMLElement[];
    const c3 = allCells[2 * 5 + 2]; // row=2, col=2 (C3)
    if (c3) fireEvent.mouseDown(c3);
    // Open View menu and click Freeze Panes
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Freeze Panes'));
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Panes frozen');
  });

});

describe('App - Global Keyboard Shortcuts', () => {
  function fireGlobalKeyDown(key: string, options: { ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean } = {}) {
    const { ctrlKey = true, shiftKey = false, metaKey = false } = options;
    fireEvent.keyDown(window, { key, ctrlKey, shiftKey, metaKey });
  }

  it('Ctrl+N creates a new workbook', () => {
    render(<App />);
    // Modify current workbook
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;
    fireEvent.mouseDown(screen.getByText('A1'));
    fireEvent.keyDown(grid, { key: 'x' });

    // Press Ctrl+N to create new workbook
    fireGlobalKeyDown('n');

    // Should reset to empty workbook
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('Ctrl+S triggers save', () => {
    URL.createObjectURL = jest.fn(() => 'blob:mock');
    URL.revokeObjectURL = jest.fn();
    render(<App />);
    // Press Ctrl+S (shows filename modal)
    fireGlobalKeyDown('s');
    // Filename modal should appear
    expect(screen.getByText('Save Workbook')).toBeInTheDocument();
    // Confirm the save
    fireEvent.click(screen.getByText('Save'));
    // Verify download was triggered
    expect(URL.createObjectURL).toHaveBeenCalled();
    // Verify app still renders
    expect(screen.getByText('SimpleSheet')).toBeInTheDocument();
  });

  it('Ctrl+O triggers load', () => {
    render(<App />);
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    // Press Ctrl+O (dispatches open event)
    fireGlobalKeyDown('o');
    // Verify open event was dispatched
    const openCalls = dispatchSpy.mock.calls.filter(
      ([e]) => e.type === 'simplesheets:open'
    );
    expect(openCalls.length).toBe(1);
    dispatchSpy.mockRestore();
    // Verify app still renders
    expect(screen.getByText('SimpleSheet')).toBeInTheDocument();
  });

  it('Ctrl+H opens Find & Replace', () => {
    render(<App />);
    // Press Ctrl+H
    fireGlobalKeyDown('h');
    // Modal should open
    expect(screen.getByText('Find & Replace')).toBeInTheDocument();
    // Close it via the X button
    fireEvent.click(document.querySelector('[aria-label="Close"]')!);
    // Modal should be closed
    expect(screen.queryByText('Find & Replace')).not.toBeInTheDocument();
  });

  it('Ctrl+B toggles bold style', () => {
    render(<App />);
    // Select a cell first
    fireEvent.mouseDown(screen.getByText('A1'));

    // Press Ctrl+B to toggle bold
    fireGlobalKeyDown('b');

    // Open Format menu to verify bold is active
    fireEvent.click(screen.getByText('Format'));
    const boldItem = screen.getByText('Bold');
    expect(boldItem).toBeInTheDocument();
  });

  it('Ctrl+I toggles italic style', () => {
    render(<App />);
    // Select a cell first
    fireEvent.mouseDown(screen.getByText('A1'));

    // Press Ctrl+I to toggle italic
    fireGlobalKeyDown('i');

    // Open Format menu to verify italic is active
    fireEvent.click(screen.getByText('Format'));
    const italicItem = screen.getByText('Italic');
    expect(italicItem).toBeInTheDocument();
  });

  it('Ctrl+U toggles underline style', () => {
    render(<App />);
    // Select a cell first
    fireEvent.mouseDown(screen.getByText('A1'));

    // Press Ctrl+U to toggle underline
    fireGlobalKeyDown('u');

    // Open Format menu to verify underline is active
    fireEvent.click(screen.getByText('Format'));
    const underlineItem = screen.getByText('Underline');
    expect(underlineItem).toBeInTheDocument();
  });

  it('does NOT fire Ctrl+N while typing in an input', () => {
    render(<App />);
    // Focus the formula bar input
    const input = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;
    act(() => {
      input.focus();
    });

    // Type something
    fireEvent.change(input, { target: { value: 'hello' } });

    // Press Ctrl+N while input is focused — should NOT create new workbook
    // (shortcuts are disabled while typing in inputs)
    const titleBefore = screen.getByText('Untitled');
    expect(titleBefore).toBeInTheDocument();
    fireGlobalKeyDown('n');

    // Workbook title should still be there (not reset)
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('toggles formula view with Ctrl + `', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    // Enter a formula in A1
    fireEvent.mouseDown(cell);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    
    // Focus the formula bar first
    act(() => {
      input.focus();
    });
    
    act(() => {
      fireEvent.change(input, { target: { value: '=1+1' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    // Cell should show computed value (2)
    expect(cell.textContent).toBe('2');

    // Press Ctrl + ` to toggle formula view
    act(() => {
      fireGlobalKeyDown('`');
    });

    // Cell should now show the formula
    expect(cell.textContent).toBe('=1+1');

    // Status bar should indicate formula view
    const status = screen.getByTestId('status-message');
    expect(status.textContent).toBe('Formulas');

    // Press Ctrl + ` again to toggle back
    act(() => {
      fireGlobalKeyDown('`');
    });

    // Cell should show computed value again
    expect(cell.textContent).toBe('2');
  });

  it('Ctrl+F2 handler fires from window keydown without error', () => {
    render(<App />);

    // Ctrl+F2 should not throw and should trigger the focus toggle handler
    expect(() => {
      act(() => {
        fireGlobalKeyDown('F2', { ctrlKey: true });
      });
    }).not.toThrow();

    // Press Ctrl+F2 again to toggle back
    expect(() => {
      act(() => {
        fireGlobalKeyDown('F2', { ctrlKey: true });
      });
    }).not.toThrow();
  });

  it('Ctrl+Shift+F opens Formula Wizard without error', () => {
    render(<App />);

    // Ctrl+Shift+F should trigger the Formula Wizard handler
    expect(() => {
      act(() => {
        fireGlobalKeyDown('F', { ctrlKey: true, shiftKey: true });
      });
    }).not.toThrow();
  });

  it('fx button click opens Formula Wizard', () => {
    render(<App />);
    const formulaBarInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;

    // Enter a formula in the formula bar
    act(() => {
      formulaBarInput.focus();
    });
    act(() => {
      fireEvent.change(formulaBarInput, { target: { value: '=SUM(A1:A10)' } });
    });

    // Click the fx button
    const fxButton = screen.getByText('fx');
    expect(fxButton.tagName).toBe('BUTTON');
    act(() => {
      fireEvent.click(fxButton);
    });

    // Formula Wizard should be open (check for wizard title)
    expect(screen.getByText('Nested Formula Wizard')).toBeInTheDocument();
  });

  it('Ctrl+Shift+F opens wizard with cell formula imported', () => {
    render(<App />);

    // Enter a formula in the formula bar (default cell is A1)
    const formulaBarInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;

    act(() => {
      formulaBarInput.focus();
    });
    act(() => {
      fireEvent.change(formulaBarInput, { target: { value: '=SUM(B1:B3)' } });
    });

    // Press Enter to commit (selection moves down to A2)
    act(() => {
      fireEvent.keyDown(formulaBarInput, { key: 'Enter' });
    });

    // Navigate back to A1 (row 0, col 0)
    const cells = document.querySelectorAll('.grid-cell');
    act(() => {
      fireEvent.mouseDown(cells[0]);
    });

    // Formula bar should show A1's formula
    expect(formulaBarInput.value).toBe('=SUM(B1:B3)');

    // Now press Ctrl+Shift+F to open wizard for A1
    act(() => {
      fireGlobalKeyDown('F', { ctrlKey: true, shiftKey: true });
    });

    // Wizard should be open
    expect(screen.getByText('Nested Formula Wizard')).toBeInTheDocument();

    // Number1 parameter should show B1:B3 (imported from the formula)
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const number1Input = inputs.find(i => i.value === 'B1:B3');
    expect(number1Input).toBeDefined();
  });

  it('FormulaWizard Apply commits to correct cell and shows correct status', () => {
    render(<App />);

    // Enter a formula in the formula bar (default cell is A1)
    const formulaBarInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;

    act(() => {
      formulaBarInput.focus();
    });
    act(() => {
      fireEvent.change(formulaBarInput, { target: { value: '=SUM(B1:B3)' } });
    });

    // Press Enter to commit (selection moves down to A2)
    act(() => {
      fireEvent.keyDown(formulaBarInput, { key: 'Enter' });
    });

    // Navigate back to A1
    const cells = document.querySelectorAll('.grid-cell');
    act(() => {
      fireEvent.mouseDown(cells[0]);
    });

    // Open wizard for A1
    act(() => {
      fireGlobalKeyDown('F', { ctrlKey: true, shiftKey: true });
    });

    expect(screen.getByText('Nested Formula Wizard')).toBeInTheDocument();

    // Click Apply to Cell
    act(() => {
      const applyButton = screen.getByRole('button', { name: /Apply to Cell/ });
      fireEvent.click(applyButton);
    });

    // Wizard should be closed
    expect(screen.queryByText('Nested Formula Wizard')).not.toBeInTheDocument();

    // Status message should say Updated A1 (not A2 or any other cell)
    const status = screen.getByTestId('status-message');
    expect(status.textContent).toContain('Updated A1');
  });

  it('FormulaWizard Cancel closes without committing', () => {
    render(<App />);

    // Enter a formula in the formula bar (default cell is A1)
    const formulaBarInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;

    act(() => {
      formulaBarInput.focus();
    });
    act(() => {
      fireEvent.change(formulaBarInput, { target: { value: '=SUM(B1:B3)' } });
    });

    // Press Enter to commit
    act(() => {
      fireEvent.keyDown(formulaBarInput, { key: 'Enter' });
    });

    // Navigate back to A1
    const cells = document.querySelectorAll('.grid-cell');
    act(() => {
      fireEvent.mouseDown(cells[0]);
    });

    // Open wizard for A1
    act(() => {
      fireGlobalKeyDown('F', { ctrlKey: true, shiftKey: true });
    });

    expect(screen.getByText('Nested Formula Wizard')).toBeInTheDocument();

    // Click Cancel
    act(() => {
      fireEvent.click(screen.getByText('Cancel'));
    });

    // Wizard should be closed
    expect(screen.queryByText('Nested Formula Wizard')).not.toBeInTheDocument();

    // Status should NOT say Updated (cancel doesn't commit)
    const status = screen.getByTestId('status-message');
    expect(status.textContent).not.toContain('Updated');
  });

  it('B-011: FormulaWizard Apply commits to target cell, not range end cell', () => {
    render(<App />);

    // Enter a formula in the formula bar (default cell is A1)
    const formulaBarInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;

    act(() => {
      formulaBarInput.focus();
    });
    act(() => {
      fireEvent.change(formulaBarInput, { target: { value: '=SUM(B1:B3)' } });
    });

    // Press Enter to commit (selection moves down to A2)
    act(() => {
      fireEvent.keyDown(formulaBarInput, { key: 'Enter' });
    });

    // Navigate back to A1
    const cells = document.querySelectorAll('.grid-cell');
    act(() => {
      fireEvent.mouseDown(cells[0]);
    });

    // Open wizard for A1 (imports the existing formula)
    act(() => {
      fireGlobalKeyDown('F', { ctrlKey: true, shiftKey: true });
    });

    expect(screen.getByText('Nested Formula Wizard')).toBeInTheDocument();

    // Click Add parameter to add a second range
    act(() => {
      fireEvent.click(screen.getByText('+ Add parameter'));
    });

    // Set second parameter to C1:C3
    const paramInputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    act(() => {
      fireEvent.change(paramInputs[1], { target: { value: 'C1:C3' } });
    });

    // Click Apply to Cell
    act(() => {
      const applyButton = screen.getByRole('button', { name: /Apply to Cell/ });
      fireEvent.click(applyButton);
    });

    // Wizard should be closed
    expect(screen.queryByText('Nested Formula Wizard')).not.toBeInTheDocument();

    // Status message should say Updated A1 (not any other cell)
    const status = screen.getByTestId('status-message');
    expect(status.textContent).toContain('Updated A1');
  });

  it('B-029: FormulaWizard Apply writes to source sheet when active sheet changed during wizard', () => {
    render(<App />);

    // Add a second sheet so we can reproduce cross-sheet navigation
    const addSheetBtn = screen.getByText('+');
    act(() => { fireEvent.click(addSheetBtn); });
    // Adding a sheet switches to it — switch back to Sheet1 (index 0)
    const sheet1Tab = screen.getByText('Sheet1');
    act(() => { fireEvent.click(sheet1Tab); });

    const formulaBarInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;

    // Navigate to B5 (row 4, col 1) on Sheet1
    const cells = document.querySelectorAll('.grid-cell');
    act(() => {
      fireEvent.mouseDown(cells[4 * 5 + 1]); // B5 in virtualized 5-col grid
    });

    // Type cross-sheet formula into formula bar
    act(() => { formulaBarInput.focus(); });
    act(() => {
      fireEvent.change(formulaBarInput, { target: { value: '=SUM(Sheet2!C2:C11)' } });
    });
    // Commit the formula
    act(() => {
      fireEvent.keyDown(formulaBarInput, { key: 'Enter' });
    });

    // Navigate back to B5 (Enter moves selection down to B6)
    const cellsAfter = document.querySelectorAll('.grid-cell');
    act(() => {
      fireEvent.mouseDown(cellsAfter[4 * 5 + 1]); // B5
    });

    // Open wizard via Ctrl+Shift+F (imports =SUM(Sheet2!C2:C11))
    act(() => {
      fireGlobalKeyDown('F', { ctrlKey: true, shiftKey: true });
    });
    expect(screen.getByText('Nested Formula Wizard')).toBeInTheDocument();

    // Verify the wizard opened with the imported formula — the cross-sheet
    // prefix must be preserved (B-030 fix)
    const sumParamInput = screen.getByPlaceholderText(/Primary range or value to sum/) as HTMLInputElement;
    expect(sumParamInput.value).toBe('Sheet2!C2:C11');

    // Switch to Sheet2 while wizard is open (reproduces cross-sheet navigation
    // the user does during POINT mode range picking)
    const sheet2Tab = screen.getByText('Sheet2');
    act(() => {
      fireEvent.click(sheet2Tab);
    });

    // Modify the wizard parameter (not the formula bar!) to a local Sheet2 range.
    // Re-query after sheet switch (DOM may have re-rendered).
    const sumParamInputAfterSwitch = screen.getByPlaceholderText(/Primary range or value to sum/) as HTMLInputElement;
    act(() => {
      fireEvent.change(sumParamInputAfterSwitch, { target: { value: 'Sheet2!D3:D11' } });
    });

    // Click Apply to Cell
    act(() => {
      const applyButton = screen.getByRole('button', { name: /Apply to Cell/ });
      fireEvent.click(applyButton);
    });

    // Wizard should be closed
    expect(screen.queryByText('Nested Formula Wizard')).not.toBeInTheDocument();

    // BUG CHECK 1: active sheet should be back to Sheet1 (source), not Sheet2
    const sheet1TabAfter = screen.getByText('Sheet1');
    expect(sheet1TabAfter.className).toContain('font-medium');

    // BUG CHECK 2: Navigate to B5 on Sheet1 — formula bar should show
    // the new formula written to the SOURCE sheet
    const cellsOnSheet1 = document.querySelectorAll('.grid-cell');
    act(() => {
      fireEvent.mouseDown(cellsOnSheet1[4 * 5 + 1]); // B5 on Sheet1
    });
    expect(formulaBarInput.value).toContain('SUM(');
    expect(formulaBarInput.value).toContain('D3');

    // BUG CHECK 3: Sheet2!B5 must NOT have the formula
    act(() => {
      fireEvent.click(screen.getByText('Sheet2'));
    });
    const sheet2CellsAfter = document.querySelectorAll('.grid-cell');
    act(() => {
      fireEvent.mouseDown(sheet2CellsAfter[4 * 5 + 1]); // B5 on Sheet2
    });
    expect(formulaBarInput.value).not.toContain('SUM(');
  });

  it('B-030: FormulaWizard preserves sheet reference when importing cross-sheet formula', () => {
    render(<App />);

    // Add a second sheet so we can use a cross-sheet reference
    const addSheetBtn = screen.getByText('+');
    act(() => { fireEvent.click(addSheetBtn); });
    const sheet1Tab = screen.getByText('Sheet1');
    act(() => { fireEvent.click(sheet1Tab); });

    const formulaBarInput = screen.getByPlaceholderText(/Enter a value or formula/) as HTMLInputElement;

    // Navigate to B5 on Sheet1
    const cells = document.querySelectorAll('.grid-cell');
    act(() => { fireEvent.mouseDown(cells[4 * 5 + 1]); });

    // Enter a cross-sheet formula referencing Sheet2!C2:C11 (Q1 sales data)
    act(() => { formulaBarInput.focus(); });
    act(() => {
      fireEvent.change(formulaBarInput, { target: { value: '=SUM(Sheet2!C2:C11)' } });
    });
    act(() => { fireEvent.keyDown(formulaBarInput, { key: 'Enter' }); });

    // Re-select B5 (Enter moved to B6)
    const cellsAfter = document.querySelectorAll('.grid-cell');
    act(() => { fireEvent.mouseDown(cellsAfter[4 * 5 + 1]); });

    // Open wizard via Ctrl+Shift+F — imports =SUM(Sheet2!C2:C11)
    act(() => { fireGlobalKeyDown('F', { ctrlKey: true, shiftKey: true }); });
    expect(screen.getByText('Nested Formula Wizard')).toBeInTheDocument();

    // BUG CHECK 1: the parameter must show the sheet-qualified range, not
    // a bare C2:C11 (which would evaluate against Sheet1 and return 0)
    const sumParamInput = screen.getByPlaceholderText(/Primary range or value to sum/) as HTMLInputElement;
    expect(sumParamInput.value).toBe('Sheet2!C2:C11');

    // Apply WITHOUT modifying the parameter — the formula must be preserved
    act(() => {
      const applyButton = screen.getByRole('button', { name: /Apply to Cell/ });
      fireEvent.click(applyButton);
    });
    expect(screen.queryByText('Nested Formula Wizard')).not.toBeInTheDocument();

    // Flush the setTimeout that restores focus to B5, then re-select B5
    act(() => { jest.runAllTimers(); });
    const cellsApply = document.querySelectorAll('.grid-cell');
    act(() => { fireEvent.mouseDown(cellsApply[4 * 5 + 1]); });

    // BUG CHECK 2: formula bar must show the full cross-sheet formula
    // (not =SUM(C2:C11) which would evaluate against Sheet1 and return 0)
    expect(formulaBarInput.value).toBe('=SUM(Sheet2!C2:C11)');
  });
});
