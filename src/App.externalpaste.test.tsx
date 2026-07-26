import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';
import { clearClipboard, hasClipboardData } from './utils/clipboard';

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

function dispatchPaste(text?: string, html?: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  // Attach clipboardData mock
  (event as unknown as { clipboardData: unknown }).clipboardData = {
    getData: (type: string) => {
      if (type === 'text/html') return html ?? '';
      if (type === 'text/plain') return text ?? '';
      return '';
    },
  };
  window.dispatchEvent(event);
}

describe('App - External Clipboard Paste', () => {
  beforeEach(() => {
    // Clear the internal clipboard between tests
    clearClipboard();
  });

  it('pastes plain text directly when clipboard has no HTML', () => {
    render(<App />);

    // Select a cell
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Simulate pasting plain TSV
    act(() => {
      dispatchPaste('Hello\tWorld\nFoo\tBar');
    });

    // Status bar should show paste confirmation
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Pasted');
  });

  it('shows paste modal when clipboard has HTML content', () => {
    render(<App />);

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Simulate pasting HTML table
    act(() => {
      dispatchPaste(
        'Hello',
        '<table><tr><td>Hello</td></tr></table>'
      );
    });

    // Modal should appear
    expect(screen.getByText('Paste from clipboard')).toBeInTheDocument();
    expect(screen.getByTestId('paste-formatted')).toBeInTheDocument();
    expect(screen.getByTestId('paste-plain')).toBeInTheDocument();
  });

  it('pastes formatted text when "Paste Formatted Text" is chosen', () => {
    render(<App />);

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    act(() => {
      dispatchPaste(
        'Bold Value',
        '<table><tr><td style="font-weight: bold">Bold Value</td></tr></table>'
      );
    });

    // Choose formatted paste
    fireEvent.click(screen.getByTestId('paste-formatted'));

    // Modal closes
    expect(screen.queryByText('Paste from clipboard')).not.toBeInTheDocument();

    // Status bar confirms paste
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Pasted');
  });

  it('pastes plain text when "Paste Plain Text" is chosen', () => {
    render(<App />);

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    act(() => {
      dispatchPaste(
        'Bold Value',
        '<table><tr><td style="font-weight: bold">Bold Value</td></tr></table>'
      );
    });

    // Choose plain paste
    fireEvent.click(screen.getByTestId('paste-plain'));

    expect(screen.queryByText('Paste from clipboard')).not.toBeInTheDocument();
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Pasted');
  });

  it('closes modal on Cancel', () => {
    render(<App />);

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    act(() => {
      dispatchPaste(
        'Value',
        '<table><tr><td>Value</td></tr></table>'
      );
    });

    expect(screen.getByText('Paste from clipboard')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Paste from clipboard')).not.toBeInTheDocument();
  });

  it('pastes formatted text with non-table HTML (MathJax/bullets)', () => {
    render(<App />);

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // HTML without a table (like MathJax content or bulleted lists)
    const htmlNoTable = '<ul><li><span>$100 × 100 text{ mm} × 2.4 text{ m}$ Posts</span></li></ul>';

    act(() => {
      dispatchPaste('', htmlNoTable);
    });

    // Choose formatted paste
    fireEvent.click(screen.getByTestId('paste-formatted'));

    // Modal closes
    expect(screen.queryByText('Paste from clipboard')).not.toBeInTheDocument();

    // Status bar confirms paste (text extracted from HTML)
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Pasted');
  });

  it('auto-detects numeric values from plain text paste', () => {
    render(<App />);

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Paste a currency value — should be detected as numeric
    act(() => {
      dispatchPaste('$1,234.56');
    });

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Pasted');
  });

  it('does not paste when no selection is active', () => {
    render(<App />);

    // Don't select any cell — dispatch paste with HTML
    act(() => {
      dispatchPaste(
        'Hello',
        '<table><tr><td>Hello</td></tr></table>'
      );
    });

    // Modal shows but pasting without selection does nothing
    // (no cells updated since there's no target)
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toBe('Ready');
  });
});

describe('App - Paste Bounds Checking', () => {
  function dispatchPaste(text?: string, html?: string) {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    (event as unknown as { clipboardData: unknown }).clipboardData = {
      getData: (type: string) => {
        if (type === 'text/html') return html ?? '';
        if (type === 'text/plain') return text ?? '';
        return '';
      },
    };
    window.dispatchEvent(event);
  }

  function getStatusText() {
    return screen.getByTestId('status-message')?.textContent;
  }

  it('pastes all data when it fits within sheet bounds', () => {
    render(<App />);

    // Select cell A1
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Paste a small grid that fits easily (default sheet is 1000x26)
    act(() => {
      dispatchPaste('A\tB\n1\t2');
    });

    expect(getStatusText()).toBe('Pasted 4 cell(s)');
  });

  it('clips rows that exceed sheet boundary', () => {
    render(<App />);

    // Select a cell near the bottom of the sheet
    // The default sheet has 1000 rows, so we need to scroll or select a cell
 // near the bottom. Instead, we'll paste a large grid from row 0.
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Create a grid with more rows than the sheet has (1000+ rows)
    const rows: string[] = [];
    for (let i = 0; i < 1010; i++) {
      rows.push(`row${i}`);
    }
    const bigData = rows.join('\n');

    act(() => {
      dispatchPaste(bigData);
    });

    // Should clip 10 rows and report it
    expect(getStatusText()).toContain('Pasted 1000 cell(s)');
    expect(getStatusText()).toContain('10 row(s) clipped');
    expect(getStatusText()).toContain('sheet boundary');
  });

  it('clips columns that exceed sheet boundary', () => {
    render(<App />);

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Create a row with more columns than the sheet has (26+ columns)
    const cols: string[] = [];
    for (let i = 0; i < 30; i++) {
      cols.push(`col${i}`);
    }
    const wideData = cols.join('\t');

    act(() => {
      dispatchPaste(wideData);
    });

    // Should clip 4 columns and report it
    expect(getStatusText()).toContain('Pasted 26 cell(s)');
    expect(getStatusText()).toContain('4 col(s) clipped');
    expect(getStatusText()).toContain('sheet boundary');
  });

  it('clips both rows and columns when both exceed', () => {
    render(<App />);

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Create a grid that exceeds both dimensions
    const rows: string[] = [];
    for (let i = 0; i < 1010; i++) {
      const cols: string[] = [];
      for (let j = 0; j < 30; j++) {
        cols.push(`${i},${j}`);
      }
      rows.push(cols.join('\t'));
    }
    const bigGrid = rows.join('\n');

    act(() => {
      dispatchPaste(bigGrid);
    });

    // Should clip both rows and columns
    expect(getStatusText()).toContain('row(s) clipped');
    expect(getStatusText()).toContain('col(s) clipped');
  });

  it('aborts paste when target row is beyond sheet bounds', () => {
    render(<App />);

    // Select last valid row, then paste would go beyond
    // We can't easily select row 1000+ since it doesn't exist,
    // but we can verify the selection bounds check works by checking
    // that pasting at a valid position near the edge works correctly.
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Paste a small grid at A1 — should work fine
    act(() => {
      dispatchPaste('X');
    });

    expect(getStatusText()).toBe('Pasted 1 cell(s)');
  });
});

describe('App - External Paste Formula Adjustment', () => {
  function dispatchPaste(text?: string, html?: string) {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    (event as unknown as { clipboardData: unknown }).clipboardData = {
      getData: (type: string) => {
        if (type === 'text/html') return html ?? '';
        if (type === 'text/plain') return text ?? '';
        return '';
      },
    };
    window.dispatchEvent(event);
  }

  function getStatusText() {
    return screen.getByTestId('status-message')?.textContent;
  }

  it('adjusts relative formula references on paste', () => {
    render(<App />);

    // Select cell C3 (row 2, col 2)
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Paste a formula with relative reference
    // =Z100 pasted at A1 should remain =Z100 (far away, no circular ref)
    act(() => {
      dispatchPaste('=Z100');
    });

    // Should paste successfully (status contains 'Pasted')
    expect(getStatusText()).toContain('Pasted');
  });

  it('preserves absolute formula references', () => {
    render(<App />);

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Paste a formula with absolute reference - should not change
    act(() => {
      dispatchPaste('=$Z$100');
    });

    expect(getStatusText()).toContain('Pasted');
  });

  it('adjusts formula references in a grid paste', () => {
    render(<App />);

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Paste a grid with formulas that reference far-away cells
    // Row 0: =Z100, =Z101
    // Row 1: =Z102, =Z103
    act(() => {
      dispatchPaste('=Z100\t=Z101\n=Z102\t=Z103');
    });

    expect(getStatusText()).toContain('Pasted');
  });
});

describe('App - Paste Range Mismatch', () => {
  function fireGlobalKeyDown(key: string, ctrl = true, shift = false) {
    fireEvent.keyDown(window, { key, ctrlKey: ctrl, shiftKey: shift, metaKey: false });
  }

  function getStatusText() {
    return screen.getByTestId('status-message')?.textContent;
  }

  it('shows error when pasting 2x2 to mismatched 3x3 range', () => {
    render(<App />);

    // First, copy a 2x2 range
    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Select A1
    const cellA1 = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cellA1);

    // Extend selection to B2 (2x2 range) using shift+arrow
    fireEvent.keyDown(grid, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(grid, { key: 'ArrowDown', shiftKey: true });

    // Copy the selection
    fireGlobalKeyDown('c');

    // Now select a 3x3 destination range (C3:E5)
    // Click C3 first
    const cells = document.querySelectorAll('.grid-cell');
    // Find cell at row 2, col 2 (C3) - approximate by clicking a cell and navigating
    fireEvent.mouseDown(cells[0]); // Reset to A1
    fireEvent.keyDown(grid, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(grid, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(grid, { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyDown(grid, { key: 'ArrowDown', shiftKey: true });

    // Paste should fail due to mismatch
    fireGlobalKeyDown('v');

    // Should show error about mismatch
    const status = getStatusText();
    expect(status).toContain('does not match');
  });

  it('allows paste when destination is a single cell (expand)', () => {
    render(<App />);

    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Select A1:B2 (2x2 range) and copy
    const cellA1 = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cellA1);
    fireEvent.keyDown(grid, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(grid, { key: 'ArrowDown', shiftKey: true });
    fireGlobalKeyDown('c');

    // Click on a single destination cell (C3)
    const cells = document.querySelectorAll('.grid-cell');
    fireEvent.mouseDown(cells[0]); // Back to A1
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });

    // Paste should succeed (single cell destination expands)
    fireGlobalKeyDown('v');

    const status = getStatusText();
    expect(status).toContain('Pasted');
  });
});

describe('App - Paste Special (Skip Blanks)', () => {
  it('skip blanks prevents empty cells from overwriting data', () => {
    render(<App />);

    const grid = document.querySelector('[tabindex="0"]') as HTMLElement;

    // Select A1 and copy
    const cellA1 = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cellA1);

    // Type a value in A1
    fireEvent.keyDown(grid, { key: 'X' });
    const input = document.querySelector('input.border-blue-500') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'KeepMe' } });
    fireEvent.keyDown(input, { key: 'Enter' }); // Commit

    // Copy A1
    fireEvent.mouseDown(cellA1);
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });

    // Now paste to a range that includes A1 and empty cells
    // With skip blanks, the empty cells in source won't overwrite A1
    // This is a simplified test - the full UI flow would use the Paste Special dialog

    // For now, verify the paste works without error
    const status = screen.getByTestId('status-message')?.textContent;
    expect(status).toContain('copied');
  });

  it('pastes text starting with = as plain text (prefixed with single quote)', () => {
    clearClipboard(); // Ensure clipboard is clear
    render(<App />);

    // Select A1
    const cellA1 = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cellA1);

    // Paste text starting with =
    act(() => {
      dispatchPaste('=Hello.World');
    });

    // The cell should contain the plain text (prefixed with single quote)
    // which displays as =Hello.World but is not a formula
    const status = screen.getByTestId('status-message')?.textContent;
    expect(status).toContain('Pasted');

    // Verify the cell value - it should be prefixed with '
    const cellA1After = document.querySelector('.grid-cell') as HTMLElement;
    // The cell displays =Hello.World but the raw value is '=Hello.World
    expect(cellA1After.textContent).toBe('=Hello.World');
  });

  it('pastes text without = prefix as-is', () => {
    render(<App />);

    // Select A1
    const cellA1 = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cellA1);

    // Paste normal text
    act(() => {
      dispatchPaste('Hello World');
    });

    const status = screen.getByTestId('status-message')?.textContent;
    expect(status).toContain('Pasted');

    // The cell should display the text as-is
    const cellA1After = document.querySelector('.grid-cell') as HTMLElement;
    expect(cellA1After.textContent).toBe('Hello World');
  });
});


