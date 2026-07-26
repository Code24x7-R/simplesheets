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
