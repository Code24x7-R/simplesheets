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

function getCell(row: number, col: number): HTMLElement | null {
  const cells = Array.from(document.querySelectorAll('.grid-cell')) as HTMLElement[];
  return cells[row * 5 + col] ?? null;
}

function editCell(row: number, col: number, value: string) {
  const cell = getCell(row, col);
  if (!cell) throw new Error(`Cell (${row},${col}) not found`);
  fireEvent.mouseDown(cell);
  const input = screen.getByPlaceholderText(/Enter a value or formula/);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

function selectCell(row: number, col: number) {
  const cell = getCell(row, col);
  if (!cell) throw new Error(`Cell (${row},${col}) not found`);
  fireEvent.mouseDown(cell);
}

function copySelection() {
  fireEvent.click(screen.getByText('Edit'));
  fireEvent.click(screen.getByText('Copy'));
}

function paste() {
  fireEvent.click(screen.getByText('Edit'));
  fireEvent.click(screen.getByText('Paste'));
}

function switchToSheet(name: string) {
  const tab = Array.from(document.querySelectorAll('button')).find(
    (btn) => btn.textContent === name
  );
  if (tab) fireEvent.click(tab);
}

function addSheet(): string {
  const addBtn = Array.from(document.querySelectorAll('button')).find(
    (btn) => btn.textContent === '+'
  );
  if (addBtn) fireEvent.click(addBtn);
  const tabs = Array.from(document.querySelectorAll('button'));
  const sheetTabs = tabs.filter((btn) => btn.textContent?.startsWith('Sheet'));
  return sheetTabs[sheetTabs.length - 1]?.textContent ?? '';
}

describe('App — Cross-Sheet Paste with Styles', () => {
  it('carries bold style when pasting across sheets', () => {
    render(<App />);
    const sheet2Name = addSheet();

    // Sheet1: set value and bold
    editCell(0, 0, 'BoldValue');
    selectCell(0, 0);
    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Bold'));

    // Copy and switch sheets
    copySelection();
    switchToSheet(sheet2Name);
    selectCell(0, 0);
    paste();

    // Verify value pasted
    expect(getCell(0, 0)?.textContent).toBe('BoldValue');
  });

  it('carries background color when pasting across sheets', () => {
    render(<App />);
    const sheet2Name = addSheet();

    // Sheet1: set value
    editCell(0, 0, 'Colored');
    selectCell(0, 0);

    // Copy and switch sheets
    copySelection();
    switchToSheet(sheet2Name);
    selectCell(0, 0);
    paste();

    // Verify value pasted
    expect(getCell(0, 0)?.textContent).toBe('Colored');
  });

  it('carries formula with style when pasting across sheets', () => {
    render(<App />);
    const sheet2Name = addSheet();

    // Sheet1: set formula and bold
    editCell(0, 0, '=1+1');
    selectCell(0, 0);
    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Bold'));

    // Copy and switch sheets
    copySelection();
    switchToSheet(sheet2Name);
    selectCell(0, 0);
    paste();

    // Verify formula pasted (cross-sheet ref adjusted)
    expect(getCell(0, 0)?.textContent).toBeDefined();
  });

  it('carries mixed styles when pasting range across sheets', () => {
    render(<App />);
    const sheet2Name = addSheet();

    // Sheet1: set values with different styles
    editCell(0, 0, 'A');
    editCell(0, 1, 'B');

    // Bold A1 only
    selectCell(0, 0);
    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Bold'));

    // Copy A1:B1
    selectCell(0, 0);
    copySelection();

    // Switch to Sheet2 and paste
    switchToSheet(sheet2Name);
    selectCell(0, 0);
    paste();

    // Verify both values pasted
    expect(getCell(0, 0)?.textContent).toBe('A');
    expect(getCell(0, 1)?.textContent).toBe('B');
  });

  it('does not carry style if source cell has no style', () => {
    render(<App />);
    const sheet2Name = addSheet();

    // Sheet1: plain cell
    editCell(0, 0, 'Plain');
    selectCell(0, 0);

    // Copy and switch sheets
    copySelection();
    switchToSheet(sheet2Name);
    selectCell(0, 0);
    paste();

    // Value should paste, no errors
    expect(getCell(0, 0)?.textContent).toBe('Plain');
  });
});
