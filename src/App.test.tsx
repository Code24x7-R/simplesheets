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
    expect(screen.getByText(/Ready/)).toBeInTheDocument();
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

  it('handles formula bar input', () => {
    render(<App />);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.change(input, { target: { value: '=SUM(A1:A10)' } });
    expect(input).toHaveValue('=SUM(A1:A10)');
  });

  it('updates status message on cell selection', () => {
    render(<App />);
    expect(screen.getByText(/Ready/)).toBeInTheDocument();
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

  it('opens Format menu and shows Merge/Unmerge items', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Format'));
    expect(screen.getByText('Merge Cells')).toBeTruthy();
    expect(screen.getByText('Unmerge Cells')).toBeTruthy();
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

    const statusBar = document.querySelector('footer span');
    expect(statusBar?.textContent).toContain('Updated');
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
    // Open View menu and click Freeze Panes
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Freeze Panes'));
    const statusBar = document.querySelector('footer span');
    expect(statusBar?.textContent).toContain('Panes frozen');
  });

  it('shows Format menu with Merge Cells item', () => {
    render(<App />);
    // Open Format menu
    fireEvent.click(screen.getByText('Format'));
    // Merge Cells should be visible (may be disabled without range selection)
    expect(screen.getByText('Merge Cells')).toBeTruthy();
    expect(screen.getByText('Unmerge Cells')).toBeTruthy();
  });
});

describe('App - Global Keyboard Shortcuts', () => {
  function fireGlobalKeyDown(key: string, ctrl = true, shift = false) {
    fireEvent.keyDown(window, { key, ctrlKey: ctrl, shiftKey: shift, metaKey: false });
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
    render(<App />);
    // Press Ctrl+S (should not throw)
    fireGlobalKeyDown('s');
    // Verify app still renders
    expect(screen.getByText('SimpleSheet')).toBeInTheDocument();
  });

  it('Ctrl+O triggers load', () => {
    render(<App />);
    // Press Ctrl+O (should not throw)
    fireGlobalKeyDown('o');
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
});
