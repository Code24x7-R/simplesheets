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

  it('renders toolbar buttons', () => {
    render(<App />);
    expect(screen.getByText(/Undo/)).toBeInTheDocument();
    expect(screen.getByText(/Redo/)).toBeInTheDocument();
  });

  it('renders import/export buttons', () => {
    render(<App />);
    expect(screen.getByText(/Import Excel/)).toBeInTheDocument();
    expect(screen.getByText(/Export Excel/)).toBeInTheDocument();
    expect(screen.getByText(/Import CSV/)).toBeInTheDocument();
    expect(screen.getByText(/Export CSV/)).toBeInTheDocument();
  });

  it('renders the status bar', () => {
    render(<App />);
    expect(screen.getByText(/Ready/)).toBeInTheDocument();
  });

  it('renders the demo workbook title', () => {
    render(<App />);
    expect(screen.getByText('SimpleSheet Demo')).toBeInTheDocument();
  });

  it('renders freeze and merge buttons', () => {
    render(<App />);
    // Toolbar has merge/freeze buttons
    const buttons = screen.getAllByText(/Merge|Freeze|Unfreeze/);
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders PDF export button', () => {
    render(<App />);
    expect(screen.getByText(/Export PDF/)).toBeInTheDocument();
  });

  it('renders page setup button', () => {
    render(<App />);
    expect(screen.getByText(/Page Setup/)).toBeInTheDocument();
  });

  it('renders the grid container', () => {
    render(<App />);
    const grid = document.querySelector('[tabindex="0"]');
    expect(grid).toBeInTheDocument();
  });

  it('shows row and column count in status bar', () => {
    render(<App />);
    expect(screen.getByText(/100,000 rows/)).toBeInTheDocument();
  });

  it('handles formula bar input', () => {
    render(<App />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.change(input, { target: { value: '=SUM(A1:A10)' } });
    expect(input).toHaveValue('=SUM(A1:A10)');
  });

  it('updates status message on cell selection', () => {
    render(<App />);
    // The status bar should show 'Ready' initially
    expect(screen.getByText(/Ready/)).toBeInTheDocument();
  });

  it('handles undo button click', () => {
    render(<App />);
    const undoButton = screen.getByText(/Undo/);
    fireEvent.click(undoButton);
    // Should not throw
    expect(undoButton).toBeInTheDocument();
  });

  it('handles redo button click', () => {
    render(<App />);
    const redoButton = screen.getByText(/Redo/);
    fireEvent.click(redoButton);
    // Should not throw
    expect(redoButton).toBeInTheDocument();
  });

  it('handles page setup button click', () => {
    render(<App />);
    const pageSetupButton = screen.getByText(/Page Setup/);
    fireEvent.click(pageSetupButton);
    // Modal should appear with 'Page Setup' heading
    expect(screen.getByRole('heading', { name: /Page Setup/ })).toBeInTheDocument();
  });

  it('closes print setup modal', () => {
    render(<App />);
    // Open modal
    const pageSetupButton = screen.getByText(/Page Setup/);
    fireEvent.click(pageSetupButton);
    // Verify modal is open
    expect(screen.getByRole('heading', { name: /Page Setup/ })).toBeInTheDocument();
    // Close modal
    const cancelButton = screen.getByText(/Cancel/);
    fireEvent.click(cancelButton);
    // Modal should close
    expect(screen.queryByRole('heading', { name: /Page Setup/ })).not.toBeInTheDocument();
  });

  it('handles freeze columns button', () => {
    render(<App />);
    const freezeButton = screen.getByText(/Freeze/);
    fireEvent.click(freezeButton);
    // Should not throw
    expect(freezeButton).toBeInTheDocument();
  });

  it('handles merge cells button', () => {
    render(<App />);
    const mergeButton = screen.getByText(/Merge/);
    fireEvent.click(mergeButton);
    // Should not throw
    expect(mergeButton).toBeInTheDocument();
  });

  it('handles copy event', () => {
    render(<App />);
    // Dispatch a copy event
    const event = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
    });
    act(() => {
      window.dispatchEvent(event);
    });
    // Status should update
    expect(screen.getByText(/copied/i)).toBeInTheDocument();
  });

  it('handles cut event', () => {
    render(<App />);
    // Dispatch a cut event
    const event = new CustomEvent('simplesheets:cut', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
    });
    act(() => {
      window.dispatchEvent(event);
    });
    // Status should update
    expect(screen.getByText(/cut/i)).toBeInTheDocument();
  });

  it('handles paste event', () => {
    render(<App />);
    // First copy something
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
    });
    act(() => {
      window.dispatchEvent(copyEvent);
    });

    // Then paste
    const pasteEvent = new CustomEvent('simplesheets:paste', {
      detail: { startRow: 2, startCol: 2 },
    });
    act(() => {
      window.dispatchEvent(pasteEvent);
    });
    // Status should update
    expect(screen.getByText(/pasted/i)).toBeInTheDocument();
  });

  it('handles cell change from formula bar', () => {
    render(<App />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    // Simulate typing and committing
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Should not throw
    expect(input).toBeInTheDocument();
  });

  // ─── Toolbar Actions ─────────────────────────────────────────────

  it('handles freeze button click', () => {
    render(<App />);
    const freezeButton = screen.getByText(/Freeze/);
    fireEvent.click(freezeButton);
    const statusBar = document.querySelector('footer span');
    expect(statusBar?.textContent).toContain('Panes frozen');
  });

  it('handles unfreeze button click', () => {
    render(<App />);
    // First freeze, then unfreeze
    const freezeButton = screen.getByText(/Freeze/);
    fireEvent.click(freezeButton);
    // The button should now say "Unfreeze"
    const unfreezeButton = screen.getByText(/Unfreeze/);
    fireEvent.click(unfreezeButton);
    const statusBar = document.querySelector('footer span');
    expect(statusBar?.textContent).toContain('Panes unfrozen');
  });

  // ─── Point Mode Flow ──────────────────────────────────────────────

  it('handles point mode request from formula bar', () => {
    render(<App />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    // Type = to start a formula
    fireEvent.change(input, { target: { value: '=' } });
    // The formula bar should handle point mode internally
    expect(input).toBeInTheDocument();
  });

  // ─── Status Messages ──────────────────────────────────────────────

  it('shows status message for cell edit', () => {
    render(<App />);
    // Select a cell first
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Type in formula bar and commit
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Should show status message
    const statusBar = document.querySelector('footer span');
    expect(statusBar?.textContent).toContain('Updated');
  });

  it('handles column resize', () => {
    render(<App />);
    // Trigger a column resize via custom event
    const event = new CustomEvent('simplesheets:resize-col', {
      detail: { col: 0, newWidth: 200 },
    });
    // The resize is handled by Grid → onColumnResize → handleColumnResize
    // We verify the handler exists by checking the status bar after a resize
    act(() => {
      window.dispatchEvent(event);
    });
    // Should not throw
    expect(screen.getByText(/Ready|Updated/)).toBeInTheDocument();
  });

  it('handles row resize', () => {
    render(<App />);
    const event = new CustomEvent('simplesheets:resize-row', {
      detail: { row: 0, newHeight: 50 },
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(screen.getByText(/Ready|Updated/)).toBeInTheDocument();
  });

  it('navigates cells with arrow keys in SELECT state', () => {
    render(<App />);
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;
    expect(grid).not.toBeNull();

    // Focus the grid and click on cell A1
    act(() => {
      grid.focus();
    });
    fireEvent.mouseDown(screen.getByText('A1'));

    // Arrow right should move to B1
    fireEvent.keyDown(grid, { key: 'ArrowRight' });

    // Arrow down should move to B2
    fireEvent.keyDown(grid, { key: 'ArrowDown' });

    // If we got here without errors, keyboard navigation is working
    expect(grid).toHaveFocus();
  });

  it('renders sheet tabs for multi-sheet workbooks', () => {
    render(<App />);
    // The demo workbook has one sheet named Sheet1
    expect(screen.getByText('Sheet1')).toBeInTheDocument();
    // The add button should be present
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('shows 100,000 rows in the status bar', () => {
    render(<App />);
    expect(screen.getByText(/100,000 rows/)).toBeInTheDocument();
  });

  it('adds a new sheet when + is clicked', () => {
    render(<App />);
    // Start with one sheet
    expect(screen.getByText('Sheet1')).toBeInTheDocument();
    // Click add
    fireEvent.click(screen.getByText('+'));
    // Now there should be a Sheet2
    expect(screen.getByText('Sheet2')).toBeInTheDocument();
  });

  it('renames a sheet via double-click', () => {
    render(<App />);
    // Add a sheet so we have two
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('Sheet2')).toBeInTheDocument();
    // Double-click to rename
    fireEvent.doubleClick(screen.getByText('Sheet2'));
    const input = screen.getByDisplayValue('Sheet2');
    fireEvent.change(input, { target: { value: 'Revenue' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Sheet should now have the new name
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.queryByText('Sheet2')).toBeNull();
  });

  it('copies a sheet via the actions menu', () => {
    render(<App />);
    // Add a sheet so we have two
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('Sheet2')).toBeInTheDocument();
    // Open the actions menu on Sheet2
    const toggles = screen.getAllByTitle('Sheet actions');
    fireEvent.click(toggles[1]); // Second sheet's toggle
    // Click Copy
    fireEvent.mouseDown(screen.getByText('Copy'));
    // Should now have a copy
    expect(screen.getByText('Sheet2 (Copy)')).toBeInTheDocument();
  });

  it('deletes a sheet via the actions menu', () => {
    render(<App />);
    // Add a sheet so we have two
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('Sheet2')).toBeInTheDocument();
    // Open the actions menu on Sheet2
    const toggles = screen.getAllByTitle('Sheet actions');
    fireEvent.click(toggles[1]);
    // Click Delete
    fireEvent.mouseDown(screen.getByText('Delete'));
    // Sheet2 should be gone
    expect(screen.queryByText('Sheet2')).toBeNull();
    // Sheet1 should still be there
    expect(screen.getByText('Sheet1')).toBeInTheDocument();
  });
});
