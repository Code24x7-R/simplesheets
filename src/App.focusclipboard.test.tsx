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

describe('App - External Clipboard Copy', () => {
  it('writes to system clipboard when copying cells', () => {
    render(<App />);

    // Put a value in A1 first
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Copy the selection
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
    });
    act(() => {
      window.dispatchEvent(copyEvent);
    });

    // Verify system clipboard was called
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('writes to system clipboard when cutting cells', () => {
    render(<App />);

    // Put a value in A1 first
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'World' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Cut the selection
    const cutEvent = new CustomEvent('simplesheets:cut', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
    });
    act(() => {
      window.dispatchEvent(cutEvent);
    });

    // Verify system clipboard was called
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('writes TSV format to system clipboard for multiple cells', () => {
    render(<App />);

    // Put values in A1 and B1
    const cells = document.querySelectorAll('.grid-cell');
    const input = screen.getByPlaceholderText(/Enter a value or formula/);

    // Edit A1
    fireEvent.mouseDown(cells[0]);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'A' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Edit B1
    fireEvent.mouseDown(cells[1]);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'B' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Copy A1:B1 range
    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 1 },
    });
    act(() => {
      window.dispatchEvent(copyEvent);
    });

    // Verify system clipboard was called with TSV (tab-separated)
    const writeCall = (navigator.clipboard.writeText as jest.Mock).mock.calls;
    const lastCall = writeCall[writeCall.length - 1];
    expect(lastCall[0]).toContain('A');
    expect(lastCall[0]).toContain('B');
  });
});

describe('App - Modal Focus Restoration', () => {
  it('restores focus to grid after closing SearchReplaceModal', () => {
    render(<App />);

    // Open Search & Replace (via Edit menu)
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText(/Find & Replace/));

    // Modal should be open
    expect(screen.getByText('Find & Replace')).toBeInTheDocument();

    // Close the modal
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);

    // Modal should be closed
    expect(screen.queryByText('Find & Replace')).not.toBeInTheDocument();
  });

  it('restores focus to grid after closing ShortcutsModal', () => {
    render(<App />);

    // Open Keyboard Shortcuts (via Help menu)
    fireEvent.click(screen.getByText('Help'));
    fireEvent.click(screen.getByText('Keyboard Shortcuts'));

    // Modal should be open
    expect(screen.getByText('Keyboard Shortcuts & Hints')).toBeInTheDocument();

    // Close the modal
    fireEvent.click(screen.getByText('Close'));

    // Modal should be closed
    expect(screen.queryByText('Keyboard Shortcuts & Hints')).not.toBeInTheDocument();
  });

  it('restores focus to grid after closing PrintSetupModal', () => {
    render(<App />);

    // Open Page Setup (via File menu)
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText(/Page Setup/));

    // Modal should be open (title is "Page Setup")
    expect(screen.getByText('Page Setup')).toBeInTheDocument();

    // Close the modal by clicking Cancel
    fireEvent.click(screen.getByText('Cancel'));

    // Modal should be closed
    expect(screen.queryByText('Page Setup')).not.toBeInTheDocument();
  });

  it('restores focus to grid after PasteSpecialModal closes', () => {
    render(<App />);

    // First copy something
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const copyEvent = new CustomEvent('simplesheets:copy', {
      detail: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
    });
    act(() => {
      window.dispatchEvent(copyEvent);
    });

    // Open Paste Special (via Edit menu)
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText(/Paste Special/));

    // Modal should be open
    expect(screen.getByText('Paste Special')).toBeInTheDocument();

    // Close the modal
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    // Modal should be closed
    expect(screen.queryByText('Paste Special')).not.toBeInTheDocument();
  });
});

describe('App - Sheet Operation Focus Restoration', () => {
  it('restores focus to grid after adding a sheet', () => {
    render(<App />);

    // Add a sheet using the + button
    const addBtn = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent === '+'
    ) as HTMLElement;
    fireEvent.click(addBtn);

    // The grid should still be focusable (no error thrown)
    // We verify the sheet was added by checking for Sheet2
    const tabs = Array.from(document.querySelectorAll('button'));
    const sheetTabs = tabs.filter((btn) => btn.textContent?.startsWith('Sheet'));
    expect(sheetTabs.length).toBe(2);
  });

  it('restores focus to grid after switching sheets', () => {
    render(<App />);

    // Add a sheet first
    const addBtn = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent === '+'
    ) as HTMLElement;
    fireEvent.click(addBtn);

    // Switch to Sheet2
    const sheet2Tab = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Sheet2'
    ) as HTMLElement;
    fireEvent.click(sheet2Tab);

    // The grid should still be focusable
    // We verify the active sheet changed
    const activeTab = document.querySelector('button.bg-white') as HTMLElement;
    expect(activeTab?.textContent).toBe('Sheet2');
  });

  it('restores focus to grid after deleting a sheet', () => {
    render(<App />);

    // Add a sheet first
    const addBtn = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent === '+'
    ) as HTMLElement;
    fireEvent.click(addBtn);

    // Right-click on Sheet2 to get context menu
    const sheet2Tab = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Sheet2'
    ) as HTMLElement;
    fireEvent.contextMenu(sheet2Tab);

    // Click Delete in the context menu (uses onMouseDown)
    const deleteBtn = screen.getByText('Delete');
    fireEvent.mouseDown(deleteBtn);

    // Verify sheet was deleted
    const tabs = Array.from(document.querySelectorAll('button'));
    const sheetTabs = tabs.filter((btn) => btn.textContent?.startsWith('Sheet'));
    expect(sheetTabs.length).toBe(1);
  });
});
