import { render, screen, fireEvent } from '@testing-library/react';
import { MenuBar } from './MenuBar';

describe('MenuBar', () => {
  const defaultProps = {
    onNew: jest.fn(),
    onSave: jest.fn(),
    onLoad: jest.fn(),
    onImportExcel: jest.fn(),
    onImportCsv: jest.fn(),
    onImportJson: jest.fn(),
    onExportExcel: jest.fn(),
    onExportCsv: jest.fn(),
    onExportJson: jest.fn(),
    onExportPdf: jest.fn(),
    onPageSetup: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    canUndo: true,
    canRedo: true,
    onCopy: jest.fn(),
    onCut: jest.fn(),
    onPaste: jest.fn(),
    onClear: jest.fn(),
    onDeleteRow: jest.fn(),
    onDeleteCol: jest.fn(),
    onDeleteCells: jest.fn(),
    onFreeze: jest.fn(),
    onUnfreeze: jest.fn(),
    hasFrozenPanes: false,
    onInsertRowAbove: jest.fn(),
    onInsertRowBelow: jest.fn(),
    onInsertColLeft: jest.fn(),
    onInsertColRight: jest.fn(),
    onMerge: jest.fn(),
    onUnmerge: jest.fn(),
    canMerge: true,
    canUnmerge: true,
    onToggleBold: jest.fn(),
    onToggleItalic: jest.fn(),
    onToggleUnderline: jest.fn(),
    onSetTextColor: jest.fn(),
    onSetBackgroundColor: jest.fn(),
    onSetTextAlign: jest.fn(),
    onSetNumberFormat: jest.fn(),
    onClearStyles: jest.fn(),
    isBold: false,
    isItalic: false,
    isUnderline: false,
    onAbout: jest.fn(),
    onShortcuts: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all menu labels', () => {
    render(<MenuBar {...defaultProps} />);
    expect(screen.getByText('File')).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('View')).toBeTruthy();
    expect(screen.getByText('Insert')).toBeTruthy();
    expect(screen.getByText('Format')).toBeTruthy();
    expect(screen.getByText('Help')).toBeTruthy();
  });

  it('File menu shows New, Save, Open items', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('File'));
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByText('Open…')).toBeTruthy();
  });

  it('File menu shows Import and Export submenus', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('File'));
    expect(screen.getByText('Import')).toBeTruthy();
    expect(screen.getByText('Export')).toBeTruthy();
  });

  it('Import submenu triggers correct callbacks', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.mouseEnter(screen.getByText('Import'));
    fireEvent.click(screen.getByText('Excel (.xlsx)'));
    expect(defaultProps.onImportExcel).toHaveBeenCalled();
  });

  it('Export submenu triggers correct callbacks', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.mouseEnter(screen.getByText('Export'));
    fireEvent.click(screen.getByText('PDF (.pdf)'));
    expect(defaultProps.onExportPdf).toHaveBeenCalled();
  });

  it('Edit menu shows Undo and Redo with disabled states', () => {
    render(<MenuBar {...defaultProps} canUndo={false} canRedo={false} />);
    fireEvent.click(screen.getByText('Edit'));
    const undoItem = screen.getByText('Undo').closest('.menu-item');
    const redoItem = screen.getByText('Redo').closest('.menu-item');
    expect(undoItem?.classList.contains('menu-item-disabled')).toBe(true);
    expect(redoItem?.classList.contains('menu-item-disabled')).toBe(true);
  });

  it('Edit menu shows Copy, Cut, Paste items', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Copy')).toBeTruthy();
    expect(screen.getByText('Cut')).toBeTruthy();
    expect(screen.getByText('Paste')).toBeTruthy();
  });

  it('Edit menu shows Delete submenu', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Edit'));
    // Find the Delete submenu item by its label span (not the shortcut text)
    const deleteLabel = screen.getAllByText('Delete').find(
      (el) => el.classList.contains('menu-item-label')
    )!;
    fireEvent.mouseEnter(deleteLabel);
    expect(screen.getByText('Row')).toBeTruthy();
    expect(screen.getByText('Column')).toBeTruthy();
    expect(screen.getByText('Cells')).toBeTruthy();
  });

  it('View menu shows Freeze and Unfreeze', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('View'));
    expect(screen.getByText('Freeze Panes')).toBeTruthy();
    expect(screen.getByText('Unfreeze Panes')).toBeTruthy();
  });

  it('View menu disables Unfreeze when no frozen panes', () => {
    render(<MenuBar {...defaultProps} hasFrozenPanes={false} />);
    fireEvent.click(screen.getByText('View'));
    const unfreezeItem = screen.getByText('Unfreeze Panes').closest('.menu-item');
    expect(unfreezeItem?.classList.contains('menu-item-disabled')).toBe(true);
  });

  it('Insert menu shows row and column options', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Insert'));
    expect(screen.getByText('Row Above')).toBeTruthy();
    expect(screen.getByText('Row Below')).toBeTruthy();
    expect(screen.getByText('Column Left')).toBeTruthy();
    expect(screen.getByText('Column Right')).toBeTruthy();
  });

  it('Format menu shows Merge and Unmerge', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Format'));
    expect(screen.getByText('Merge Cells')).toBeTruthy();
    expect(screen.getByText('Unmerge Cells')).toBeTruthy();
  });

  it('Format menu disables Merge when cannot merge', () => {
    render(<MenuBar {...defaultProps} canMerge={false} canUnmerge={false} />);
    fireEvent.click(screen.getByText('Format'));
    const mergeItem = screen.getByText('Merge Cells').closest('.menu-item');
    const unmergeItem = screen.getByText('Unmerge Cells').closest('.menu-item');
    expect(mergeItem?.classList.contains('menu-item-disabled')).toBe(true);
    expect(unmergeItem?.classList.contains('menu-item-disabled')).toBe(true);
  });

  it('Format menu shows Bold, Italic, Underline items', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Format'));
    expect(screen.getByText('Bold')).toBeTruthy();
    expect(screen.getByText('Italic')).toBeTruthy();
    expect(screen.getByText('Underline')).toBeTruthy();
  });

  it('Format menu shows Alignment submenu', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Format'));
    const alignLabel = screen.getByText('Alignment');
    expect(alignLabel).toBeTruthy();
    fireEvent.mouseEnter(alignLabel);
    expect(screen.getByText('Left')).toBeTruthy();
    expect(screen.getByText('Center')).toBeTruthy();
    expect(screen.getByText('Right')).toBeTruthy();
  });

  it('Format menu shows Clear Styles', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Format'));
    expect(screen.getByText('Clear Styles')).toBeTruthy();
  });

  it('Format menu triggers bold callback', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Bold'));
    expect(defaultProps.onToggleBold).toHaveBeenCalled();
  });

  it('Format menu triggers text color callback', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Format'));
    const colorLabel = screen.getByText('Text Color');
    fireEvent.mouseEnter(colorLabel);
    fireEvent.click(screen.getByText('Red'));
    expect(defaultProps.onSetTextColor).toHaveBeenCalledWith('#FF0000');
  });

  it('Format menu triggers alignment callback', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Format'));
    const alignLabel = screen.getByText('Alignment');
    fireEvent.mouseEnter(alignLabel);
    fireEvent.click(screen.getByText('Center'));
    expect(defaultProps.onSetTextAlign).toHaveBeenCalledWith('center');
  });

  it('Format menu triggers clear styles callback', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Clear Styles'));
    expect(defaultProps.onClearStyles).toHaveBeenCalled();
  });

  it('Help menu shows About and Shortcuts', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Help'));
    expect(screen.getByText('About SimpleSheet')).toBeTruthy();
    expect(screen.getByText('Keyboard Shortcuts')).toBeTruthy();
  });
});
