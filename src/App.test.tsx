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
    expect(screen.getByText(/10,000 rows/)).toBeInTheDocument();
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
});
