// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { MenuBar } from './MenuBar';

describe('App Extensions Integration', () => {
  const defaultProps = {
    onNew: jest.fn(),
    onLoadDemo: jest.fn(),
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
    onSaveToCloud: jest.fn(),
    onOpenFromCloud: jest.fn(),
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
    onFormulaWizard: jest.fn(),
    onChart: jest.fn(),
    onToggleBold: jest.fn(),
    onToggleItalic: jest.fn(),
    onToggleUnderline: jest.fn(),
    onSetTextColor: jest.fn(),
    onSetBackgroundColor: jest.fn(),
    onSetTextAlign: jest.fn(),
    onSetNumberFormat: jest.fn(),
    onToggleWrapText: jest.fn(),
    onClearStyles: jest.fn(),
    onSetBorderTop: jest.fn(),
    onSetBorderBottom: jest.fn(),
    onSetBorderLeft: jest.fn(),
    onSetBorderRight: jest.fn(),
    onSetBorderAll: jest.fn(),
    onSetBorderOutside: jest.fn(),
    onClearBorders: jest.fn(),
    onColumnRowSize: jest.fn(),
    onSortAscending: jest.fn(),
    onSortDescending: jest.fn(),
    onOpenSortDialog: jest.fn(),
    onToggleFilter: jest.fn(),
    onClearAllFilters: jest.fn(),
    isFilterActive: false,
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isWrapText: false,
    onAbout: jest.fn(),
    onShortcuts: jest.fn(),
    onSimpleDocs: jest.fn(),
    onSearchReplace: jest.fn(),
    onPasteSpecial: jest.fn(),
    onProjectNew: jest.fn(),
    onProjectNewSheet: jest.fn(),
    recentFiles: [],
    onOpenRecent: jest.fn(),
    onRemoveRecent: jest.fn(),
    onClearRecent: jest.fn(),
  };

  it('renders Extensions menu in MenuBar', () => {
    render(<MenuBar {...defaultProps} />);
    expect(screen.getByText('Extensions')).toBeInTheDocument();
  });

  it('Project / WBS submenu lists templates', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Extensions'));
    fireEvent.click(screen.getByText('Project / WBS'));
    expect(screen.getByText('Simple WBS')).toBeInTheDocument();
    expect(screen.getByText('Website Project')).toBeInTheDocument();
    expect(screen.getByText('Software Development')).toBeInTheDocument();
  });

  it('clicking a template calls onProjectNew with correct ID', () => {
    const onProjectNew = jest.fn();
    render(<MenuBar {...defaultProps} onProjectNew={onProjectNew} />);
    fireEvent.click(screen.getByText('Extensions'));
    fireEvent.click(screen.getByText('Project / WBS'));
    fireEvent.click(screen.getByText('Website Project'));
    expect(onProjectNew).toHaveBeenCalledWith('website');
  });

  it('clicking Software Development template calls onProjectNew with software ID', () => {
    const onProjectNew = jest.fn();
    render(<MenuBar {...defaultProps} onProjectNew={onProjectNew} />);
    fireEvent.click(screen.getByText('Extensions'));
    fireEvent.click(screen.getByText('Project / WBS'));
    fireEvent.click(screen.getByText('Software Development'));
    expect(onProjectNew).toHaveBeenCalledWith('software');
  });

  it('Extensions menu shows New Project Sheet option', () => {
    const onProjectNewSheet = jest.fn();
    render(<MenuBar {...defaultProps} onProjectNewSheet={onProjectNewSheet} />);
    fireEvent.click(screen.getByText('Extensions'));
    fireEvent.click(screen.getByText('Project / WBS'));
    expect(screen.getByText('New Project Sheet')).toBeInTheDocument();
  });

  it('clicking New Project Sheet calls onProjectNewSheet', () => {
    const onProjectNewSheet = jest.fn();
    render(<MenuBar {...defaultProps} onProjectNewSheet={onProjectNewSheet} />);
    fireEvent.click(screen.getByText('Extensions'));
    fireEvent.click(screen.getByText('Project / WBS'));
    fireEvent.click(screen.getByText('New Project Sheet'));
    expect(onProjectNewSheet).toHaveBeenCalledTimes(1);
  });
});
