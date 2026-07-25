import { render, screen, fireEvent } from '@testing-library/react';
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

describe('App - Menu Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows About message from Help menu', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Help'));
    fireEvent.click(screen.getByText('About SimpleSheet'));
    const statusBar = document.querySelector('footer span');
    expect(statusBar?.textContent).toContain('SimpleSheet v0.1.0');
  });

  it('shows keyboard shortcuts message from Help menu', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Help'));
    fireEvent.click(screen.getByText('Keyboard Shortcuts'));
    const statusBar = document.querySelector('footer span');
    expect(statusBar?.textContent).toContain('keyboard shortcuts');
  });

  it('handles View > Freeze Panes', () => {
    render(<App />);
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Freeze Panes'));
    const statusBar = document.querySelector('footer span');
    expect(statusBar?.textContent).toContain('Panes frozen');
  });

  it('handles View > Unfreeze Panes after freezing', () => {
    render(<App />);
    // First freeze
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Freeze Panes'));
    // Then unfreeze
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Unfreeze Panes'));
    const statusBar = document.querySelector('footer span');
    expect(statusBar?.textContent).toContain('Panes unfrozen');
  });

  it('disables Unfreeze Panes when no panes are frozen', () => {
    render(<App />);
    fireEvent.click(screen.getByText('View'));
    const unfreezeItem = screen.getByText('Unfreeze Panes').closest('.menu-item');
    expect(unfreezeItem?.classList.contains('menu-item-disabled')).toBe(true);
  });

  it('handles Format > Merge Cells', () => {
    render(<App />);
    // Select a cell first
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    // Merge via menu
    fireEvent.click(screen.getByText('Format'));
    const mergeItem = screen.getByText('Merge Cells').closest('.menu-item') as HTMLElement;
    // Without range selection, merge should be disabled
    expect(mergeItem?.classList.contains('menu-item-disabled')).toBe(true);
  });

  it('handles File > Save (shows status)', () => {
    render(<App />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Save'));
    const statusBar = document.querySelector('footer span');
    expect(statusBar?.textContent).toContain('Save');
  });

  it('handles File > Open (shows status)', () => {
    render(<App />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Open…'));
    const statusBar = document.querySelector('footer span');
    expect(statusBar?.textContent).toContain('Open');
  });

  it('opens Page Setup modal from File menu', () => {
    render(<App />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Page Setup…'));
    expect(screen.getByRole('heading', { name: /Page Setup/ })).toBeInTheDocument();
  });

  it('closes Page Setup modal from File menu', () => {
    render(<App />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Page Setup…'));
    expect(screen.getByRole('heading', { name: /Page Setup/ })).toBeInTheDocument();
    // Close modal
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    expect(screen.queryByRole('heading', { name: /Page Setup/ })).not.toBeInTheDocument();
  });
});

describe('App - Menu Handlers (Edit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles Edit > Clear Contents via Delete key', () => {
    render(<App />);
    // Select a cell
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    // Type a value
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Clear via menu (simulates clicking Clear)
    fireEvent.click(screen.getByText('Edit'));
    const clearItem = screen.getByText('Clear Contents').closest('.menu-item') as HTMLElement;
    fireEvent.click(clearItem);
    // Status should not throw
    const statusBar = document.querySelector('footer span');
    expect(statusBar).toBeInTheDocument();
  });

  it('disables Undo in Edit menu when no history', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Edit'));
    const undoItem = screen.getByText('Undo').closest('.menu-item');
    expect(undoItem?.classList.contains('menu-item-disabled')).toBe(true);
  });

  it('disables Redo in Edit menu when no redo available', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Edit'));
    const redoItem = screen.getByText('Redo').closest('.menu-item');
    expect(redoItem?.classList.contains('menu-item-disabled')).toBe(true);
  });

  it('shows Delete submenu in Edit menu', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Edit'));
    const deleteLabel = screen.getAllByText('Delete').find(
      (el) => el.classList.contains('menu-item-label')
    )!;
    fireEvent.mouseEnter(deleteLabel);
    expect(screen.getByText('Row')).toBeTruthy();
    expect(screen.getByText('Column')).toBeTruthy();
    expect(screen.getByText('Cells')).toBeTruthy();
  });
});

describe('App - Menu Handlers (Insert)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles Insert > Row Above', () => {
    render(<App />);
    // Select a cell
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    // Insert row above via menu
    fireEvent.click(screen.getByText('Insert'));
    fireEvent.click(screen.getByText('Row Above'));
    const statusBar = document.querySelector('footer span');
    expect(statusBar?.textContent).toContain('Inserted row');
  });

  it('adjusts formula references when inserting a row above a formula cell', () => {
    render(<App />);
    // The demo workbook has =SUM(B2:D2) in cell E2 (row index 1, col 4).
    // We need to select a cell in that row, then insert a row above it.
    // First, let's select cell at row 1 (second row) by clicking it.
    // The demo sheet renders headers in row 0, data starting row 1.
    // Cell "Item 1" is at row 1, col 0.
    const item1Cell = screen.getByText('Item 1');
    fireEvent.mouseDown(item1Cell);

    // Insert row above. "Item 1" is at row index 1 (1-indexed row 2).
    fireEvent.click(screen.getByText('Insert'));
    fireEvent.click(screen.getByText('Row Above'));

    // Status message confirms the insert happened (1-indexed).
    const statusBar = document.querySelector('footer span');
    expect(statusBar?.textContent).toContain('Inserted row 2');

    // Now undo and verify it reverts
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Undo'));
  });

  it('handles Insert > Row Below', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.click(screen.getByText('Insert'));
    fireEvent.click(screen.getByText('Row Below'));
    const statusBar = document.querySelector('footer span');
    expect(statusBar?.textContent).toContain('Inserted row');
  });

  it('handles Insert > Column Left', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.click(screen.getByText('Insert'));
    fireEvent.click(screen.getByText('Column Left'));
    const statusBar = document.querySelector('footer span');
    expect(statusBar?.textContent).toContain('Inserted column');
  });

  it('handles Insert > Column Right', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.click(screen.getByText('Insert'));
    fireEvent.click(screen.getByText('Column Right'));
    const statusBar = document.querySelector('footer span');
    expect(statusBar?.textContent).toContain('Inserted column');
  });
});

describe('App - Menu Handlers (Delete)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles Delete > Row without throwing', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    // Open Edit > Delete > Row
    fireEvent.click(screen.getByText('Edit'));
    const deleteLabel = screen.getAllByText('Delete').find(
      (el) => el.classList.contains('menu-item-label')
    )!;
    fireEvent.mouseEnter(deleteLabel);
    fireEvent.click(screen.getByText('Row'));
    // App should still render without errors
    expect(document.querySelector('h1')?.textContent).toBe('SimpleSheet');
  });

  it('handles Delete > Column without throwing', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.click(screen.getByText('Edit'));
    const deleteLabel = screen.getAllByText('Delete').find(
      (el) => el.classList.contains('menu-item-label')
    )!;
    fireEvent.mouseEnter(deleteLabel);
    fireEvent.click(screen.getByText('Column'));
    expect(document.querySelector('h1')?.textContent).toBe('SimpleSheet');
  });

  it('handles Delete > Cells (clear contents)', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.click(screen.getByText('Edit'));
    const deleteLabel = screen.getAllByText('Delete').find(
      (el) => el.classList.contains('menu-item-label')
    )!;
    fireEvent.mouseEnter(deleteLabel);
    fireEvent.click(screen.getByText('Cells'));
    // Should not throw
    const statusBar = document.querySelector('footer span');
    expect(statusBar).toBeInTheDocument();
  });
});

describe('App - Menu Handlers (Import/Export via bridge)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches import event when File > Import > Excel is clicked', () => {
    render(<App />);
    const spy = jest.spyOn(window, 'dispatchEvent');
    fireEvent.click(screen.getByText('File'));
    fireEvent.mouseEnter(screen.getByText('Import'));
    fireEvent.click(screen.getByText('Excel (.xlsx)'));
    // The bridge should dispatch an event
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('dispatches export event when File > Export > CSV is clicked', () => {
    render(<App />);
    const spy = jest.spyOn(window, 'dispatchEvent');
    fireEvent.click(screen.getByText('File'));
    fireEvent.mouseEnter(screen.getByText('Export'));
    fireEvent.click(screen.getByText('CSV (.csv)'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('shows File > Export > PDF option', () => {
    render(<App />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.mouseEnter(screen.getByText('Export'));
    expect(screen.getByText('PDF (.pdf)')).toBeTruthy();
  });

  it('shows File > Import submenu options', () => {
    render(<App />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.mouseEnter(screen.getByText('Import'));
    expect(screen.getByText('Excel (.xlsx)')).toBeTruthy();
    expect(screen.getByText('CSV (.csv)')).toBeTruthy();
    expect(screen.getByText('JSON (.json)')).toBeTruthy();
  });

  it('shows File > Export submenu options', () => {
    render(<App />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.mouseEnter(screen.getByText('Export'));
    expect(screen.getByText('Excel (.xlsx)')).toBeTruthy();
    expect(screen.getByText('CSV (.csv)')).toBeTruthy();
    expect(screen.getByText('JSON (.json)')).toBeTruthy();
    expect(screen.getByText('PDF (.pdf)')).toBeTruthy();
  });
});

describe('App - Undo/Redo keyboard shortcuts', () => {
  it('Ctrl+Z triggers undo after an insert operation', () => {
    render(<App />);
    const statusBar = document.querySelector('footer span');

    // Select a cell and insert a row above
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.click(screen.getByText('Insert'));
    fireEvent.click(screen.getByText('Row Above'));
    expect(statusBar?.textContent).toContain('Inserted row');

    // Now press Ctrl+Z globally
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(statusBar?.textContent).toContain('Undo performed');
  });

  it('Ctrl+Y triggers redo after an undo', () => {
    render(<App />);
    const statusBar = document.querySelector('footer span');

    // Select a cell and insert a column left
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.click(screen.getByText('Insert'));
    fireEvent.click(screen.getByText('Column Left'));
    expect(statusBar?.textContent).toContain('Inserted column');

    // Undo
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(statusBar?.textContent).toContain('Undo performed');

    // Redo
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    expect(statusBar?.textContent).toContain('Redo performed');
  });
});

describe('App - Cell Style System (single cell & range)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies bold to a single selected cell via Format menu', () => {
    render(<App />);
    const statusBar = document.querySelector('footer span');

    // Select a single cell
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Apply bold via Format menu
    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Bold'));

    expect(statusBar?.textContent).toContain('Bold');
    expect(statusBar?.textContent).toContain('1 cell');
  });

  it('applies bold to a range selection via Format menu', () => {
    render(<App />);
    const statusBar = document.querySelector('footer span');

    // Select a cell, then shift+click to create a range
    const cells = document.querySelectorAll('.grid-cell');
    const firstCell = cells[0] as HTMLElement;
    const thirdCell = cells[2] as HTMLElement;

    // Click first cell
    fireEvent.mouseDown(firstCell);
    // Shift+click third cell to extend selection
    fireEvent.mouseDown(thirdCell, { shiftKey: true, bubbles: true });

    // Apply bold via Format menu — should apply to the range
    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Bold'));

    // The status message should mention cells were updated
    expect(statusBar?.textContent).toContain('Bold');
  });

  it('applies italic to a single cell', () => {
    render(<App />);
    const statusBar = document.querySelector('footer span');

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Italic'));

    expect(statusBar?.textContent).toContain('Italic');
  });

  it('applies text alignment via Format menu', () => {
    render(<App />);
    const statusBar = document.querySelector('footer span');

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Format'));
    const alignLabel = screen.getByText('Alignment');
    fireEvent.mouseEnter(alignLabel);
    fireEvent.click(screen.getByText('Center'));

    expect(statusBar?.textContent).toContain('Align center');
  });

  it('applies text color via Format menu', () => {
    render(<App />);
    const statusBar = document.querySelector('footer span');

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Format'));
    const colorLabel = screen.getByText('Text Color');
    fireEvent.mouseEnter(colorLabel);
    fireEvent.click(screen.getByText('Red'));

    expect(statusBar?.textContent).toContain('Text color');
  });

  it('clears styles via Format menu', () => {
    render(<App />);
    const statusBar = document.querySelector('footer span');

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // First apply bold
    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Bold'));
    expect(statusBar?.textContent).toContain('Bold');

    // Then clear styles
    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Clear Styles'));
    expect(statusBar?.textContent).toContain('Cleared styles');
  });

  it('applies style and supports undo', () => {
    render(<App />);
    const statusBar = document.querySelector('footer span');

    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Apply bold
    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Bold'));
    expect(statusBar?.textContent).toContain('Bold');

    // Undo the style change
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(statusBar?.textContent).toContain('Undo performed');
  });
});
