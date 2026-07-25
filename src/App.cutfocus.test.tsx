import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import { getClipboard, clearClipboard } from './utils/clipboard';

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

describe('App - Cut/Paste after menu click (focus loss)', () => {
  beforeEach(() => {
    clearClipboard();
  });

  it('scenario 1: select cell -> click File menu -> Ctrl+X -> click cell -> Ctrl+V -> Ctrl+Z', () => {
    render(<App />);
    const statusBar = document.querySelector('footer span');

    // Step 1: Select cell A1 (first data cell)
    const cells = document.querySelectorAll('.grid-cell');
    fireEvent.mouseDown(cells[0]);

    // Step 2: Click File menu (just opens dropdown, loses focus)
    fireEvent.click(screen.getByText('File'));

    // Step 3: Press Ctrl+X (cut)
    fireEvent.keyDown(window, { key: 'x', ctrlKey: true });
    console.log('S1 After Ctrl+X:', statusBar?.textContent, 'clipboard:', getClipboard()?.cells?.[0]?.[0]?.rawValue);

    // Step 4: Click another cell
    fireEvent.mouseDown(cells[1]);

    // Step 5: Press Ctrl+V (paste)
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    console.log('S1 After Ctrl+V:', statusBar?.textContent);

    // Step 6: Press Ctrl+Z (undo)
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    console.log('S1 After Ctrl+Z:', statusBar?.textContent);
  });

  it('scenario 2: select cell -> click Edit menu -> Ctrl+X -> click cell -> Ctrl+V -> Ctrl+Z', () => {
    render(<App />);
    const statusBar = document.querySelector('footer span');

    const cells = document.querySelectorAll('.grid-cell');
    fireEvent.mouseDown(cells[0]);

    // Click Edit menu
    fireEvent.click(screen.getByText('Edit'));

    // Ctrl+X
    fireEvent.keyDown(window, { key: 'x', ctrlKey: true });
    console.log('S2 After Ctrl+X:', statusBar?.textContent, 'clipboard:', getClipboard()?.cells?.[0]?.[0]?.rawValue);

    // Click another cell
    fireEvent.mouseDown(cells[1]);

    // Ctrl+V
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    console.log('S2 After Ctrl+V:', statusBar?.textContent);

    // Ctrl+Z
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    console.log('S2 After Ctrl+Z:', statusBar?.textContent);
  });

  it('scenario 3: select cell -> click Insert -> Row Above (resets activeCell) -> Ctrl+X', () => {
    render(<App />);
    const statusBar = document.querySelector('footer span');

    const cells = document.querySelectorAll('.grid-cell');
    fireEvent.mouseDown(cells[0]);

    // Click Insert menu -> Row Above (this triggers an action that resets activeCell)
    fireEvent.click(screen.getByText('Insert'));
    fireEvent.click(screen.getByText('Row Above'));
    console.log('S3 After Insert Row:', statusBar?.textContent);

    // Now try Ctrl+X
    fireEvent.keyDown(window, { key: 'x', ctrlKey: true });
    console.log('S3 After Ctrl+X:', statusBar?.textContent, 'clipboard:', getClipboard()?.cells?.[0]?.[0]?.rawValue);
  });

  it('scenario 4: select cell -> click File -> New (resets everything) -> Ctrl+X', () => {
    render(<App />);
    const statusBar = document.querySelector('footer span');

    const cells = document.querySelectorAll('.grid-cell');
    fireEvent.mouseDown(cells[0]);

    // Click File -> New (resets workbook)
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('New'));
    console.log('S4 After New:', statusBar?.textContent);

    // Now try Ctrl+X
    fireEvent.keyDown(window, { key: 'x', ctrlKey: true });
    console.log('S4 After Ctrl+X:', statusBar?.textContent, 'clipboard:', getClipboard()?.cells?.[0]?.[0]?.rawValue);
  });

  it('scenario 5: select cell -> click cell (no menu) -> Ctrl+X -> Ctrl+V (control)', () => {
    render(<App />);
    const statusBar = document.querySelector('footer span');

    const cells = document.querySelectorAll('.grid-cell');
    fireEvent.mouseDown(cells[0]);

    // Ctrl+X (no menu click)
    fireEvent.keyDown(window, { key: 'x', ctrlKey: true });
    console.log('S5 After Ctrl+X:', statusBar?.textContent, 'clipboard:', getClipboard()?.cells?.[0]?.[0]?.rawValue);

    // Click another cell
    fireEvent.mouseDown(cells[1]);

    // Ctrl+V
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    console.log('S5 After Ctrl+V:', statusBar?.textContent);

    // Ctrl+Z
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    console.log('S5 After Ctrl+Z:', statusBar?.textContent);
  });
});
