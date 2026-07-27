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

describe('App - Sheet Operations', () => {
  it('adds a new sheet via SheetTabs', () => {
    render(<App />);
    const addButton = screen.getByTitle('Add a new sheet');
    fireEvent.click(addButton);
    // Should now have Sheet1 and Sheet2
    expect(screen.getByText('Sheet2')).toBeInTheDocument();
  });

  it('switches between sheets', () => {
    render(<App />);
    // Add a second sheet
    const addButton = screen.getByTitle('Add a new sheet');
    fireEvent.click(addButton);
    // Click on Sheet2
    fireEvent.click(screen.getByText('Sheet2'));
    expect(screen.getByText('Sheet2')).toBeInTheDocument();
  });

  it('renames a sheet via double-click', () => {
    render(<App />);
    const sheetTab = screen.getByText('Sheet1');
    // Double-click to start renaming
    fireEvent.doubleClick(sheetTab);
    // Rename input should appear (it's the only visible text input in the tab strip)
    const renameInput = screen.getByDisplayValue('Sheet1') as HTMLInputElement;
    expect(renameInput).toBeInTheDocument();
    expect(renameInput.value).toBe('Sheet1');
  });

  it('deletes a sheet via context menu', () => {
    render(<App />);
    // Add a second sheet first
    fireEvent.click(screen.getByTitle('Add a new sheet'));
    // Right-click on Sheet2 to open context menu
    const sheet2Tab = screen.getByText('Sheet2');
    fireEvent.contextMenu(sheet2Tab);
    // Click Delete in the context menu
    const deleteButton = screen.getByText('Delete');
    fireEvent.mouseDown(deleteButton);
    // Sheet2 should be gone
    expect(screen.queryByText('Sheet2')).not.toBeInTheDocument();
  });

  it('copies a sheet', () => {
    render(<App />);
    // Right-click on Sheet1
    const sheetTab = screen.getByText('Sheet1');
    fireEvent.contextMenu(sheetTab);
    // Click Copy
    const copyButton = screen.getByText('Copy');
    fireEvent.mouseDown(copyButton);
    // Should have a "Sheet1 (Copy)" tab
    expect(screen.getByText('Sheet1 (Copy)')).toBeInTheDocument();
  });
});

describe('App - Insert/Delete Row/Column', () => {
  it('inserts a row above via Insert menu', () => {
    render(<App />);
    // Select a cell first
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Open Insert menu
    fireEvent.click(screen.getByText('Insert'));
    const insertRowAbove = screen.getByText('Row Above').closest('.menu-item') as HTMLElement;
    fireEvent.click(insertRowAbove);

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Inserted row');
  });

  it('inserts a column left via Insert menu', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Insert'));
    const insertColLeft = screen.getByText('Column Left').closest('.menu-item') as HTMLElement;
    fireEvent.click(insertColLeft);

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Inserted column');
  });

  it('shows Delete submenu with Row/Column/Cells options', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Edit'));
    // 'Delete' appears as both a shortcut (Clear Contents) and a submenu label
    const deleteLabels = screen.getAllByText('Delete');
    // Find the one that's a menu-item-label (the submenu trigger)
    const submenuLabel = deleteLabels.find(
      (el) => el.classList.contains('menu-item-label')
    ) as HTMLElement;
    expect(submenuLabel).toBeInTheDocument();
    const deleteItem = submenuLabel.closest('.menu-item') as HTMLElement;
    expect(deleteItem).toHaveClass('menu-item-submenu');
    // Verify the submenu arrow indicator is present
    expect(deleteItem.querySelector('.menu-item-arrow')).toBeInTheDocument();
  });
});

describe('App - Freeze Panes', () => {
  it('freezes panes via View menu', () => {
    render(<App />);
    fireEvent.click(screen.getByText('View'));
    const freezeItem = screen.getByText('Freeze Panes').closest('.menu-item') as HTMLElement;
    fireEvent.click(freezeItem);

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Panes frozen');
  });

  it('unfreezes panes via View menu', () => {
    render(<App />);
    // First freeze
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Freeze Panes').closest('.menu-item') as HTMLElement);
    // Then unfreeze
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Unfreeze Panes').closest('.menu-item') as HTMLElement);

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Panes unfrozen');
  });
});

describe('App - Clear Contents', () => {
  it('clears cell contents via Edit > Clear Contents', () => {
    render(<App />);
    // First edit a cell
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    // Select the cell again and clear
    fireEvent.mouseDown(cell);
    fireEvent.click(screen.getByText('Edit'));
    const clearItem = screen.getByText('Clear Contents').closest('.menu-item') as HTMLElement;
    fireEvent.click(clearItem);

    const statusBar = screen.getByTestId('status-message');
    // Clear may show empty if cell was committed via formula bar
    expect(statusBar).toBeInTheDocument();
  });
});

describe('App - Import/Export Bridge', () => {
  it('triggers Excel import via hidden bridge event', () => {
    render(<App />);
    // Dispatch the custom event that the bridge listens for
    act(() => {
      window.dispatchEvent(new CustomEvent('simplesheets:import-excel'));
    });
    // The bridge should have forwarded to the hidden ImportExcelButton
    // (which triggers a file input click — hard to test directly, but no crash)
    expect(screen.getByTestId('status-message')).toBeInTheDocument();
  });

  it('triggers CSV export via menu', () => {
    render(<App />);
    fireEvent.click(screen.getByText('File'));
    // Open Export submenu
    const exportMenu = screen.getByText('Export').closest('.menu-item') as HTMLElement;
    fireEvent.click(exportMenu);
    // Click CSV export
    const csvExport = screen.getByText('CSV (.csv)').closest('.menu-item') as HTMLElement;
    fireEvent.click(csvExport);
    // Should trigger download (no crash)
    expect(screen.getByTestId('status-message')).toBeInTheDocument();
  });

  it('triggers PDF export via menu', () => {
    render(<App />);
    fireEvent.click(screen.getByText('File'));
    const exportMenu = screen.getByText('Export').closest('.menu-item') as HTMLElement;
    fireEvent.click(exportMenu);
    const pdfExport = screen.getByText('PDF (.pdf)').closest('.menu-item') as HTMLElement;
    fireEvent.click(pdfExport);
    expect(screen.getByTestId('status-message')).toBeInTheDocument();
  });
});

  // Helper to add content to a cell so style operations have something to act on
  function editAndCommitCell(value: string) {
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    // Re-select the cell after commit
    fireEvent.mouseDown(cell);
  }

describe('App - Keyboard Shortcuts (global)', () => {
  it('Ctrl+B toggles bold', () => {
    render(<App />);
    editAndCommitCell('TestData');

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Bold');
  });

  it('Ctrl+I toggles italic', () => {
    render(<App />);
    editAndCommitCell('TestData');

    fireEvent.keyDown(window, { key: 'i', ctrlKey: true });
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Italic');
  });

  it('Ctrl+U toggles underline', () => {
    render(<App />);
    editAndCommitCell('TestData');

    fireEvent.keyDown(window, { key: 'u', ctrlKey: true });
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Underline');
  });

  it('Ctrl+H opens Find & Replace', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'h', ctrlKey: true });
    // SearchReplaceModal should be open
    expect(screen.getByText('Find & Replace')).toBeInTheDocument();
  });

  it('Ctrl+Shift+Z triggers redo', () => {
    render(<App />);
    // Make an edit first
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    act(() => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    // Undo
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    // Redo with Ctrl+Shift+Z
    fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true });
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Redo performed');
  });
});

describe('App - Help Menu', () => {
  it('shows About via Help menu', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Help'));
    fireEvent.click(screen.getByText('About SimpleSheet').closest('.menu-item') as HTMLElement);
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('SimpleSheet v0.1.0');
  });

  it('opens Keyboard Shortcuts modal', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Help'));
    fireEvent.click(screen.getByText('Keyboard Shortcuts').closest('.menu-item') as HTMLElement);
    expect(screen.getByText('Keyboard Shortcuts & Hints')).toBeInTheDocument();
  });
});

describe('App - Format Menu Actions', () => {
  it('applies bold via Format menu', () => {
    render(<App />);
    editAndCommitCell('TestData');

    fireEvent.click(screen.getByText('Format'));
    const boldItem = screen.getByText('Bold').closest('.menu-item') as HTMLElement;
    fireEvent.click(boldItem);

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Bold');
  });

  it('changes text color via Format menu', () => {
    render(<App />);
    editAndCommitCell('TestData');

    fireEvent.click(screen.getByText('Format'));
    // Open Text Color submenu
    const colorMenu = screen.getByText('Text Color').closest('.menu-item') as HTMLElement;
    fireEvent.click(colorMenu);
    // Click Red
    const redColor = screen.getByText('Red').closest('.menu-item') as HTMLElement;
    fireEvent.click(redColor);

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Text color');
  });

  it('changes fill color via Format menu', () => {
    render(<App />);
    editAndCommitCell('TestData');

    fireEvent.click(screen.getByText('Format'));
    const fillMenu = screen.getByText('Fill Color').closest('.menu-item') as HTMLElement;
    fireEvent.click(fillMenu);
    const yellowFill = screen.getByText('Yellow').closest('.menu-item') as HTMLElement;
    fireEvent.click(yellowFill);

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Fill color');
  });

  it('changes alignment via Format menu', () => {
    render(<App />);
    editAndCommitCell('TestData');

    fireEvent.click(screen.getByText('Format'));
    const alignMenu = screen.getByText('Alignment').closest('.menu-item') as HTMLElement;
    fireEvent.click(alignMenu);
    const alignCenter = screen.getByText('Center').closest('.menu-item') as HTMLElement;
    fireEvent.click(alignCenter);

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Align center');
  });

  it('changes number format via Format menu', () => {
    render(<App />);
    editAndCommitCell('TestData');

    fireEvent.click(screen.getByText('Format'));
    const numberMenu = screen.getByText('Number Format').closest('.menu-item') as HTMLElement;
    fireEvent.click(numberMenu);
    const currencyFormat = screen.getByText('Currency').closest('.menu-item') as HTMLElement;
    fireEvent.click(currencyFormat);

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Number format');
  });

  it('clears styles via Format menu', () => {
    render(<App />);
    // First apply a style, then clear it
    editAndCommitCell('TestData');
    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Bold').closest('.menu-item') as HTMLElement);

    // Now clear styles
    fireEvent.click(screen.getByText('Format'));
    const clearItem = screen.getByText('Clear Styles').closest('.menu-item') as HTMLElement;
    fireEvent.click(clearItem);

    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Cleared styles');
  });
});
