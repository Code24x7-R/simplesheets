// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useCallback } from 'react';
import { DropdownMenu, type MenuItem } from './DropdownMenu';

interface MenuBarProps {
  // File menu
  onNew: () => void;
  onLoadDemo: () => void;
  onSave: () => void;
  onLoad: () => void;
  onImportExcel: () => void;
  onImportCsv: () => void;
  onImportJson: () => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onExportPdf: () => void;
  onPageSetup: () => void;
  // Edit menu
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onPasteSpecial: () => void;
  onClear: () => void;
  onDeleteRow: () => void;
  onDeleteCol: () => void;
  onDeleteCells: () => void;
  onSearchReplace: () => void;
  // View menu
  onFreeze: () => void;
  onUnfreeze: () => void;
  hasFrozenPanes: boolean;
  // Called after any menu action to restore focus to the grid
  onAfterMenuAction?: () => void;
  // Insert menu
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onInsertColLeft: () => void;
  onInsertColRight: () => void;
  onFormulaWizard: () => void;
  onChart: () => void;
  // Format menu
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onToggleUnderline: () => void;
  onSetTextColor: (color: string) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetTextAlign: (align: 'left' | 'center' | 'right') => void;
  onSetNumberFormat: (format: string) => void;
  onToggleWrapText: () => void;
  onClearStyles: () => void;
  onSetBorderTop: () => void;
  onSetBorderBottom: () => void;
  onSetBorderLeft: () => void;
  onSetBorderRight: () => void;
  onSetBorderAll: () => void;
  onSetBorderOutside: () => void;
  onClearBorders: () => void;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isWrapText: boolean;
  // Data
  onSortAscending: () => void;
  onSortDescending: () => void;
  onToggleFilter: () => void;
  onClearAllFilters: () => void;
  isFilterActive: boolean;
  // Help
  onAbout: () => void;
  onShortcuts: () => void;
}

/**
 * Top-level menu bar that consolidates all sheet actions into dropdown menus.
 * Replaces the scattered toolbar rows for a clean, clutter-free UI.
 */
export function MenuBar(props: MenuBarProps) {
  const handleSelect = useCallback(
    (id: string) => {
      const actions: Record<string, () => void> = {
        // File
        'file-new': props.onNew,
        'file-load-demo': props.onLoadDemo,
        'file-save': props.onSave,
        'file-load': props.onLoad,
        'file-import-excel': props.onImportExcel,
        'file-import-csv': props.onImportCsv,
        'file-import-json': props.onImportJson,
        'file-export-excel': props.onExportExcel,
        'file-export-csv': props.onExportCsv,
        'file-export-json': props.onExportJson,
        'file-export-pdf': props.onExportPdf,
        'file-page-setup': props.onPageSetup,
        // Edit
        'edit-undo': props.onUndo,
        'edit-redo': props.onRedo,
        'edit-copy': props.onCopy,
        'edit-cut': props.onCut,
        'edit-paste': props.onPaste,
        'edit-paste-special': props.onPasteSpecial,
        'edit-clear': props.onClear,
      'edit-search-replace': props.onSearchReplace,
        'edit-delete-row': props.onDeleteRow,
        'edit-delete-col': props.onDeleteCol,
        'edit-delete-cells': props.onDeleteCells,
        // View
        'view-freeze': props.onFreeze,
        'view-unfreeze': props.onUnfreeze,
        // Insert
        'insert-row-above': props.onInsertRowAbove,
        'insert-row-below': props.onInsertRowBelow,
        'insert-col-left': props.onInsertColLeft,
        'insert-col-right': props.onInsertColRight,
        'insert-formula-wizard': props.onFormulaWizard,
        'insert-chart': props.onChart,
        // Format

        'format-bold': props.onToggleBold,
        'format-italic': props.onToggleItalic,
        'format-underline': props.onToggleUnderline,
        'format-wrap-text': props.onToggleWrapText,
        'format-align-left': () => props.onSetTextAlign('left'),
        'format-align-center': () => props.onSetTextAlign('center'),
        'format-align-right': () => props.onSetTextAlign('right'),
        'format-color-black': () => props.onSetTextColor('#000000'),
        'format-color-red': () => props.onSetTextColor('#FF0000'),
        'format-color-blue': () => props.onSetTextColor('#0000FF'),
        'format-color-green': () => props.onSetTextColor('#00FF00'),
        'format-fill-yellow': () => props.onSetBackgroundColor('#FFFF00'),
        'format-fill-red': () => props.onSetBackgroundColor('#FFCCCC'),
        'format-fill-green': () => props.onSetBackgroundColor('#CCFFCC'),
        'format-fill-blue': () => props.onSetBackgroundColor('#CCCCFF'),
        'format-number-general': () => props.onSetNumberFormat('General'),
        'format-number-number': () => props.onSetNumberFormat('0.00'),
        'format-number-currency': () => props.onSetNumberFormat('$#,##0.00'),
        'format-number-percent': () => props.onSetNumberFormat('0.00%'),
        'format-number-date': () => props.onSetNumberFormat('mm/dd/yyyy'),
        'format-number-date-short': () => props.onSetNumberFormat('dd-mmm-yy'),
        'format-number-date-long': () => props.onSetNumberFormat('mmmm d, yyyy'),
        'format-number-text': () => props.onSetNumberFormat('@'),
        'format-border-all': props.onSetBorderAll,
        'format-border-outside': props.onSetBorderOutside,
        'format-border-top': props.onSetBorderTop,
        'format-border-bottom': props.onSetBorderBottom,
        'format-border-left': props.onSetBorderLeft,
        'format-border-right': props.onSetBorderRight,
        'format-border-clear': props.onClearBorders,
        'format-clear-styles': props.onClearStyles,
        // Data
        'data-sort-asc': props.onSortAscending,
        'data-sort-desc': props.onSortDescending,
        'data-toggle-filter': props.onToggleFilter,
        'data-clear-filter': props.onClearAllFilters,
        // Help
        'help-about': props.onAbout,
        'help-shortcuts': props.onShortcuts,
      };
      actions[id]?.();
      // Restore focus to grid after menu action so keyboard navigation works
      props.onAfterMenuAction?.();
    },
    [props]
  );

  const fileItems: MenuItem[] = [
    { id: 'file-new', label: 'New', shortcut: 'Ctrl+N', icon: '📄' },
    { id: 'file-load-demo', label: 'Load Demo', icon: '🧪' },
    { id: 'file-save', label: 'Save', shortcut: 'Ctrl+S', icon: '💾' },
    { id: 'file-load', label: 'Open…', shortcut: 'Ctrl+O', icon: '📂' },
    { id: 'sep-file-1', label: '', separator: true },
    {
      id: 'file-import',
      label: 'Import',
      icon: '📥',
      submenu: [
        { id: 'file-import-excel', label: 'Excel (.xlsx)', icon: '📊' },
        { id: 'file-import-csv', label: 'CSV (.csv)', icon: '📋' },
        { id: 'file-import-json', label: 'JSON (.json)', icon: '🔧' },
      ],
    },
    {
      id: 'file-export',
      label: 'Export',
      icon: '📤',
      submenu: [
        { id: 'file-export-excel', label: 'Excel (.xlsx)', icon: '📊' },
        { id: 'file-export-csv', label: 'CSV (.csv)', icon: '📋' },
        { id: 'file-export-json', label: 'JSON (.json)', icon: '🔧' },
        { id: 'file-export-pdf', label: 'PDF (.pdf)', icon: '🖨️' },
      ],
    },
    { id: 'sep-file-2', label: '', separator: true },
    { id: 'file-page-setup', label: 'Page Setup…', icon: '📐' },
  ];

  const editItems: MenuItem[] = [
    { id: 'edit-undo', label: 'Undo', shortcut: 'Ctrl+Z', icon: '↩', disabled: !props.canUndo },
    { id: 'edit-redo', label: 'Redo', shortcut: 'Ctrl+Y', icon: '↪', disabled: !props.canRedo },
    { id: 'sep-edit-1', label: '', separator: true },
    { id: 'edit-copy', label: 'Copy', shortcut: 'Ctrl+C', icon: '📋' },
    { id: 'edit-cut', label: 'Cut', shortcut: 'Ctrl+X', icon: '✂️' },
    { id: 'edit-paste', label: 'Paste', shortcut: 'Ctrl+V', icon: '📌' },
    { id: 'edit-paste-special', label: 'Paste Special…', icon: '📋' },
    { id: 'edit-clear', label: 'Clear Contents', shortcut: 'Delete', icon: '🧹' },
    { id: 'edit-search-replace', label: 'Find & Replace…', shortcut: 'Ctrl+H', icon: '🔍' },
    { id: 'sep-edit-2', label: '', separator: true },
    {
      id: 'edit-delete',
      label: 'Delete',
      icon: '🗑️',
      submenu: [
        { id: 'edit-delete-row', label: 'Row', icon: '↔️' },
        { id: 'edit-delete-col', label: 'Column', icon: '↕️' },
        { id: 'edit-delete-cells', label: 'Cells', icon: '⊞' },
      ],
    },
  ];

  const viewItems: MenuItem[] = [
    { id: 'view-freeze', label: 'Freeze Panes', icon: '🧊' },
    { id: 'view-unfreeze', label: 'Unfreeze Panes', icon: '🔥', disabled: !props.hasFrozenPanes },
  ];

  const insertItems: MenuItem[] = [
    { id: 'insert-row-above', label: 'Row Above', icon: '⬆️' },
    { id: 'insert-row-below', label: 'Row Below', icon: '⬇️' },
    { id: 'sep-insert-1', label: '', separator: true },
    { id: 'insert-col-left', label: 'Column Left', icon: '⬅️' },
    { id: 'insert-col-right', label: 'Column Right', icon: '➡️' },
    { id: 'sep-insert-2', label: '', separator: true },
    { id: 'insert-formula-wizard', label: 'Formula Wizard…', icon: '🧙', shortcut: 'Ctrl+Shift+F' },
    { id: 'insert-chart', label: 'Chart…', icon: '📊' },
  ];

  const formatItems: MenuItem[] = [
    { id: 'format-bold', label: 'Bold', shortcut: 'Ctrl+B', icon: 'B', disabled: false },
    { id: 'format-italic', label: 'Italic', shortcut: 'Ctrl+I', icon: 'I', disabled: false },
    { id: 'format-underline', label: 'Underline', shortcut: 'Ctrl+U', icon: 'U', disabled: false },
    { id: 'format-wrap-text', label: 'Wrap Text', icon: '↵', disabled: false },
    { id: 'sep-format-1', label: '', separator: true },
    {
      id: 'format-align',
      label: 'Alignment',
      icon: '≡',
      submenu: [
        { id: 'format-align-left', label: 'Left', icon: '⫷' },
        { id: 'format-align-center', label: 'Center', icon: '⊙' },
        { id: 'format-align-right', label: 'Right', icon: '⫸' },
      ],
    },
    {
      id: 'format-color',
      label: 'Text Color',
      icon: 'A',
      submenu: [
        { id: 'format-color-black', label: 'Black', icon: '●' },
        { id: 'format-color-red', label: 'Red', icon: '●' },
        { id: 'format-color-blue', label: 'Blue', icon: '●' },
        { id: 'format-color-green', label: 'Green', icon: '●' },
      ],
    },
    {
      id: 'format-fill',
      label: 'Fill Color',
      icon: '▧',
      submenu: [
        { id: 'format-fill-yellow', label: 'Yellow', icon: '▧' },
        { id: 'format-fill-red', label: 'Red', icon: '▧' },
        { id: 'format-fill-green', label: 'Green', icon: '▧' },
        { id: 'format-fill-blue', label: 'Blue', icon: '▧' },
      ],
    },
    {
      id: 'format-number',
      label: 'Number Format',
      icon: '#',
      submenu: [
        { id: 'format-number-general', label: 'General', icon: '•' },
        { id: 'format-number-number', label: 'Number (0.00)', icon: '•' },
        { id: 'format-number-currency', label: 'Currency', icon: '•' },
        { id: 'format-number-percent', label: 'Percent', icon: '•' },
        { id: 'sep-number-1', label: '', separator: true },
        { id: 'format-number-date', label: 'Date (MM/DD/YYYY)', icon: '•' },
        { id: 'format-number-date-short', label: 'Date (DD-MMM-YY)', icon: '•' },
        { id: 'format-number-date-long', label: 'Date (MMMM D, YYYY)', icon: '•' },
        { id: 'format-number-text', label: 'Text (@)', icon: '•' },
      ],
    },
    { id: 'sep-format-2', label: '', separator: true },
    {
      id: 'format-border',
      label: 'Borders',
      icon: '⊞',
      submenu: [
        { id: 'format-border-all', label: 'All Borders', icon: '⊞' },
        { id: 'format-border-outside', label: 'Outside Borders', icon: '⊡' },
        { id: 'format-border-top', label: 'Top Border', icon: '⊤' },
        { id: 'format-border-bottom', label: 'Bottom Border', icon: '⊥' },
        { id: 'format-border-left', label: 'Left Border', icon: '⊣' },
        { id: 'format-border-right', label: 'Right Border', icon: '⊢' },
        { id: 'sep-border-1', label: '', separator: true },
        { id: 'format-border-clear', label: 'Clear Borders', icon: '⊡' },
      ],
    },
    { id: 'sep-format-3', label: '', separator: true },
    { id: 'format-clear-styles', label: 'Clear Styles', icon: '⊡' },
  ];

  const helpItems: MenuItem[] = [
    { id: 'help-shortcuts', label: 'Keyboard Shortcuts', icon: '⌨️' },
    { id: 'help-about', label: 'About SimpleSheet', icon: 'ℹ️' },
  ];

  const dataItems: MenuItem[] = [
    { id: 'data-sort-asc', label: 'Sort A → Z', icon: '↑' },
    { id: 'data-sort-desc', label: 'Sort Z → A', icon: '↓' },
    { id: 'data-separator-2', label: '-', icon: '', separator: true },
    { id: 'data-toggle-filter', label: props.isFilterActive ? 'Filter ✓' : 'Toggle Filter', icon: '🔍', shortcut: 'Ctrl+Shift+L' },
    { id: 'data-clear-filter', label: 'Clear All Filters', icon: '✕' },
  ];

  return (
    <div className="menu-bar">
      <DropdownMenu label="File" items={fileItems} onSelect={handleSelect} />
      <DropdownMenu label="Edit" items={editItems} onSelect={handleSelect} />
      <DropdownMenu label="View" items={viewItems} onSelect={handleSelect} />
      <DropdownMenu label="Insert" items={insertItems} onSelect={handleSelect} />
      <DropdownMenu label="Format" items={formatItems} onSelect={handleSelect} />
      <DropdownMenu label="Data" items={dataItems} onSelect={handleSelect} />
      <DropdownMenu label="Help" items={helpItems} onSelect={handleSelect} />
    </div>
  );
}
