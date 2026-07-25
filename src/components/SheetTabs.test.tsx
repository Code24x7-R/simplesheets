import { render, screen, fireEvent } from '@testing-library/react';
import { SheetTabs } from './SheetTabs';
import type { Workbook } from '../types';

function createTestWorkbook(sheetNames: string[]): Workbook {
  return {
    id: 'test-wb',
    title: 'Test',
    sheets: sheetNames.map((name, i) => ({
      id: `sheet-${i}`,
      name,
      cells: {},
      defaultColWidth: 100,
      defaultRowHeight: 28,
      columnWidths: {},
      rowHeights: {},
      columnCount: 26,
      rowCount: 1000,
      frozenColumns: 0,
      frozenRows: 0,
    })),
    activeSheetIndex: 0,
    lastModified: Date.now(),
  };
}

const mockCallbacks = {
  onSwitchSheet: jest.fn(),
  onAddSheet: jest.fn(),
  onRenameSheet: jest.fn(),
  onCopySheet: jest.fn(),
  onDeleteSheet: jest.fn(),
};

describe('SheetTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders one tab per sheet', () => {
    const wb = createTestWorkbook(['Sheet1', 'Sheet2', 'Sheet3']);
    render(<SheetTabs workbook={wb} {...mockCallbacks} />);
    expect(screen.getByText('Sheet1')).toBeTruthy();
    expect(screen.getByText('Sheet2')).toBeTruthy();
    expect(screen.getByText('Sheet3')).toBeTruthy();
  });

  it('highlights the active sheet', () => {
    const wb = createTestWorkbook(['Sheet1', 'Sheet2']);
    wb.activeSheetIndex = 1;
    render(<SheetTabs workbook={wb} {...mockCallbacks} />);
    const sheet2Tab = screen.getByText('Sheet2');
    expect(sheet2Tab.className).toContain('font-medium');
  });

  it('calls onSwitchSheet when a tab is clicked', () => {
    const wb = createTestWorkbook(['Sheet1', 'Sheet2', 'Sheet3']);
    render(<SheetTabs workbook={wb} {...mockCallbacks} />);
    fireEvent.click(screen.getByText('Sheet3'));
    expect(mockCallbacks.onSwitchSheet).toHaveBeenCalledWith(2);
  });

  it('renders an add sheet button', () => {
    const wb = createTestWorkbook(['Sheet1']);
    render(<SheetTabs workbook={wb} {...mockCallbacks} />);
    expect(screen.getByText('+')).toBeTruthy();
  });

  it('calls onAddSheet when + is clicked', () => {
    const wb = createTestWorkbook(['Sheet1']);
    render(<SheetTabs workbook={wb} {...mockCallbacks} />);
    fireEvent.click(screen.getByText('+'));
    expect(mockCallbacks.onAddSheet).toHaveBeenCalledTimes(1);
  });

  it('handles single sheet workbook', () => {
    const wb = createTestWorkbook(['Data']);
    render(<SheetTabs workbook={wb} {...mockCallbacks} />);
    expect(screen.getByText('Data')).toBeTruthy();
  });

  describe('rename', () => {
    it('enters rename mode on double-click', () => {
      const wb = createTestWorkbook(['Sheet1', 'Sheet2']);
      render(<SheetTabs workbook={wb} {...mockCallbacks} />);
      fireEvent.doubleClick(screen.getByText('Sheet1'));
      const input = screen.getByDisplayValue('Sheet1');
      expect(input).toBeTruthy();
    });

    it('calls onRenameSheet when rename is committed via Enter', () => {
      const wb = createTestWorkbook(['Sheet1', 'Sheet2']);
      render(<SheetTabs workbook={wb} {...mockCallbacks} />);
      fireEvent.doubleClick(screen.getByText('Sheet1'));
      const input = screen.getByDisplayValue('Sheet1');
      fireEvent.change(input, { target: { value: 'Renamed' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mockCallbacks.onRenameSheet).toHaveBeenCalledWith(0, 'Renamed');
    });

    it('calls onRenameSheet when rename is committed via blur', () => {
      const wb = createTestWorkbook(['Sheet1']);
      render(<SheetTabs workbook={wb} {...mockCallbacks} />);
      fireEvent.doubleClick(screen.getByText('Sheet1'));
      const input = screen.getByDisplayValue('Sheet1');
      fireEvent.change(input, { target: { value: 'Updated' } });
      fireEvent.blur(input);
      expect(mockCallbacks.onRenameSheet).toHaveBeenCalledWith(0, 'Updated');
    });

    it('cancels rename on Escape', () => {
      const wb = createTestWorkbook(['Sheet1']);
      render(<SheetTabs workbook={wb} {...mockCallbacks} />);
      fireEvent.doubleClick(screen.getByText('Sheet1'));
      const input = screen.getByDisplayValue('Sheet1');
      fireEvent.change(input, { target: { value: 'Changed' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      // Rename should be cancelled, callback not called
      expect(mockCallbacks.onRenameSheet).not.toHaveBeenCalled();
      // Tab should be back to normal
      expect(screen.getByText('Sheet1')).toBeTruthy();
    });
  });

  describe('actions menu', () => {
    it('shows actions menu when the toggle button is clicked', () => {
      const wb = createTestWorkbook(['Sheet1']);
      render(<SheetTabs workbook={wb} {...mockCallbacks} />);
      // Click the dropdown toggle button (the small triangle)
      const toggleBtn = screen.getByTitle('Sheet actions (Rename, Copy, Delete)');
      fireEvent.click(toggleBtn);
      // Menu items should be visible
      expect(screen.getByText('Rename')).toBeTruthy();
      expect(screen.getByText('Copy')).toBeTruthy();
      expect(screen.getByText('Delete')).toBeTruthy();
    });

    it('calls onCopySheet when Copy is clicked', () => {
      const wb = createTestWorkbook(['Sheet1', 'Sheet2']);
      render(<SheetTabs workbook={wb} {...mockCallbacks} />);
      fireEvent.click(screen.getAllByTitle('Sheet actions (Rename, Copy, Delete)')[0]);
      fireEvent.mouseDown(screen.getByText('Copy'));
      expect(mockCallbacks.onCopySheet).toHaveBeenCalledWith(0);
    });

    it('calls onDeleteSheet when Delete is clicked', () => {
      const wb = createTestWorkbook(['Sheet1', 'Sheet2']);
      render(<SheetTabs workbook={wb} {...mockCallbacks} />);
      fireEvent.click(screen.getAllByTitle('Sheet actions (Rename, Copy, Delete)')[0]);
      fireEvent.mouseDown(screen.getByText('Delete'));
      expect(mockCallbacks.onDeleteSheet).toHaveBeenCalledWith(0);
    });

    it('disables Delete when only one sheet exists', () => {
      const wb = createTestWorkbook(['OnlySheet']);
      render(<SheetTabs workbook={wb} {...mockCallbacks} />);
      fireEvent.click(screen.getByTitle('Sheet actions (Rename, Copy, Delete)'));
      const deleteBtn = screen.getByText('Delete');
      expect(deleteBtn).toBeDisabled();
    });

    it('enters rename mode when Rename menu item is clicked', () => {
      const wb = createTestWorkbook(['Sheet1', 'Sheet2']);
      render(<SheetTabs workbook={wb} {...mockCallbacks} />);
      fireEvent.click(screen.getAllByTitle('Sheet actions (Rename, Copy, Delete)')[0]);
      fireEvent.mouseDown(screen.getByText('Rename'));
      // Rename input should appear with current name
      expect(screen.getByDisplayValue('Sheet1')).toBeTruthy();
    });
  });
});
