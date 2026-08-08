// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useCallback } from 'react';
import {
  FileSpreadsheet,
  FlaskConical,
  Save,
  FolderOpen,
  Download,
  Upload,
  FileUp,
  FileDown,
  FileJson,
  Printer,
  Ruler,
  Undo2,
  Redo2,
  Copy,
  Scissors,
  ClipboardPaste,
  ClipboardEdit,
  Eraser,
  Search,
  Trash2,
  FlipHorizontal2,
  FlipVertical2,
  Grid2x2,
  Snowflake,
  Flame,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  Wand2,
  BarChart3,
  Bold,
  Italic,
  Underline,
  WrapText,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  PaintBucket,
  Hash,
  CalendarDays,
  Type,
  Minus,
  ArrowUpDown,
  Filter,
  X,
  Keyboard,
  Info,
  BookOpen,
} from 'lucide-react';
import {
  BorderAll,
  BorderOutside,
  BorderTop,
  BorderBottom,
  BorderLeft,
  BorderRight,
} from './icons/BorderIcons';
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
  onColumnRowSize: () => void;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isWrapText: boolean;
  // Data
  onSortAscending: () => void;
  onSortDescending: () => void;
  onOpenSortDialog: (direction: 'asc' | 'desc') => void;
  onToggleFilter: () => void;
  onClearAllFilters: () => void;
  isFilterActive: boolean;
  // Help
  onAbout: () => void;
  onShortcuts: () => void;
  onSimpleDocs: () => void;
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
        'format-column-row-size': props.onColumnRowSize,
        // Data
        'data-sort-asc': props.onSortAscending,
        'data-sort-desc': props.onSortDescending,
        'data-sort-dialog-asc': () => props.onOpenSortDialog('asc'),
        'data-sort-dialog-desc': () => props.onOpenSortDialog('desc'),
        'data-toggle-filter': props.onToggleFilter,
        'data-clear-filter': props.onClearAllFilters,
        // Help
        'help-about': props.onAbout,
        'help-shortcuts': props.onShortcuts,
        'help-simpledocs': props.onSimpleDocs,
      };
      actions[id]?.();
      // Restore focus to grid after menu action so keyboard navigation works
      props.onAfterMenuAction?.();
    },
    [props]
  );

  const fileItems: MenuItem[] = [
    { id: 'file-new', label: 'New', shortcut: 'Ctrl+N', icon: FileSpreadsheet },
    { id: 'file-load-demo', label: 'Load Demo', icon: FlaskConical },
    { id: 'file-save', label: 'Save', shortcut: 'Ctrl+S', icon: Save },
    { id: 'file-load', label: 'Open…', shortcut: 'Ctrl+O', icon: FolderOpen },
    { id: 'sep-file-1', label: '', separator: true },
    {
      id: 'file-import',
      label: 'Import',
      icon: Download,
      submenu: [
        { id: 'file-import-excel', label: 'Excel (.xlsx)', icon: FileDown },
        { id: 'file-import-csv', label: 'CSV (.csv)', icon: FileDown },
        { id: 'file-import-json', label: 'JSON (.json)', icon: FileJson },
      ],
    },
    {
      id: 'file-export',
      label: 'Export',
      icon: Upload,
      submenu: [
        { id: 'file-export-excel', label: 'Excel (.xlsx)', icon: FileUp },
        { id: 'file-export-csv', label: 'CSV (.csv)', icon: FileUp },
        { id: 'file-export-json', label: 'JSON (.json)', icon: FileJson },
        { id: 'file-export-pdf', label: 'PDF (.pdf)', icon: Printer },
      ],
    },
    { id: 'sep-file-2', label: '', separator: true },
    { id: 'file-page-setup', label: 'Page Setup…', icon: Ruler },
  ];

  const editItems: MenuItem[] = [
    { id: 'edit-undo', label: 'Undo', shortcut: 'Ctrl+Z', icon: Undo2, disabled: !props.canUndo },
    { id: 'edit-redo', label: 'Redo', shortcut: 'Ctrl+Y', icon: Redo2, disabled: !props.canRedo },
    { id: 'sep-edit-1', label: '', separator: true },
    { id: 'edit-copy', label: 'Copy', shortcut: 'Ctrl+C', icon: Copy },
    { id: 'edit-cut', label: 'Cut', shortcut: 'Ctrl+X', icon: Scissors },
    { id: 'edit-paste', label: 'Paste', shortcut: 'Ctrl+V', icon: ClipboardPaste },
    { id: 'edit-paste-special', label: 'Paste Special…', icon: ClipboardEdit },
    { id: 'edit-clear', label: 'Clear Contents', shortcut: 'Delete', icon: Eraser },
    { id: 'edit-search-replace', label: 'Find & Replace…', shortcut: 'Ctrl+H', icon: Search },
    { id: 'sep-edit-2', label: '', separator: true },
    {
      id: 'edit-delete',
      label: 'Delete',
      icon: Trash2,
      submenu: [
        { id: 'edit-delete-row', label: 'Row', icon: FlipHorizontal2 },
        { id: 'edit-delete-col', label: 'Column', icon: FlipVertical2 },
        { id: 'edit-delete-cells', label: 'Cells', icon: Grid2x2 },
      ],
    },
  ];

  const viewItems: MenuItem[] = [
    { id: 'view-freeze', label: 'Freeze Panes', icon: Snowflake },
    { id: 'view-unfreeze', label: 'Unfreeze Panes', icon: Flame, disabled: !props.hasFrozenPanes },
  ];

  const insertItems: MenuItem[] = [
    { id: 'insert-row-above', label: 'Row Above', icon: ArrowUpToLine },
    { id: 'insert-row-below', label: 'Row Below', icon: ArrowDownToLine },
    { id: 'sep-insert-1', label: '', separator: true },
    { id: 'insert-col-left', label: 'Column Left', icon: ArrowLeftToLine },
    { id: 'insert-col-right', label: 'Column Right', icon: ArrowRightToLine },
    { id: 'sep-insert-2', label: '', separator: true },
    { id: 'insert-formula-wizard', label: 'Formula Wizard…', icon: Wand2, shortcut: 'Ctrl+Shift+F' },
    { id: 'insert-chart', label: 'Chart…', icon: BarChart3 },
  ];

  const formatItems: MenuItem[] = [
    { id: 'format-bold', label: 'Bold', shortcut: 'Ctrl+B', icon: Bold, active: props.isBold },
    { id: 'format-italic', label: 'Italic', shortcut: 'Ctrl+I', icon: Italic, active: props.isItalic },
    { id: 'format-underline', label: 'Underline', shortcut: 'Ctrl+U', icon: Underline, active: props.isUnderline },
    { id: 'format-wrap-text', label: 'Wrap Text', icon: WrapText, active: props.isWrapText },
    { id: 'sep-format-1', label: '', separator: true },
    {
      id: 'format-align',
      label: 'Alignment',
      icon: AlignLeft,
      submenu: [
        { id: 'format-align-left', label: 'Left', icon: AlignLeft },
        { id: 'format-align-center', label: 'Center', icon: AlignCenter },
        { id: 'format-align-right', label: 'Right', icon: AlignRight },
      ],
    },
    {
      id: 'format-color',
      label: 'Text Color',
      icon: Palette,
      submenu: [
        { id: 'format-color-black', label: 'Black', icon: Palette },
        { id: 'format-color-red', label: 'Red', icon: Palette },
        { id: 'format-color-blue', label: 'Blue', icon: Palette },
        { id: 'format-color-green', label: 'Green', icon: Palette },
      ],
    },
    {
      id: 'format-fill',
      label: 'Fill Color',
      icon: PaintBucket,
      submenu: [
        { id: 'format-fill-yellow', label: 'Yellow', icon: PaintBucket },
        { id: 'format-fill-red', label: 'Red', icon: PaintBucket },
        { id: 'format-fill-green', label: 'Green', icon: PaintBucket },
        { id: 'format-fill-blue', label: 'Blue', icon: PaintBucket },
      ],
    },
    {
      id: 'format-number',
      label: 'Number Format',
      icon: Hash,
      submenu: [
        { id: 'format-number-general', label: 'General', icon: Hash },
        { id: 'format-number-number', label: 'Number (0.00)', icon: Hash },
        { id: 'format-number-currency', label: 'Currency', icon: Hash },
        { id: 'format-number-percent', label: 'Percent', icon: Hash },
        { id: 'sep-number-1', label: '', separator: true },
        { id: 'format-number-date', label: 'Date (MM/DD/YYYY)', icon: CalendarDays },
        { id: 'format-number-date-short', label: 'Date (DD-MMM-YY)', icon: CalendarDays },
        { id: 'format-number-date-long', label: 'Date (MMMM D, YYYY)', icon: CalendarDays },
        { id: 'format-number-text', label: 'Text (@)', icon: Type },
      ],
    },
    { id: 'sep-format-2', label: '', separator: true },
    {
      id: 'format-border',
      label: 'Borders',
      icon: BorderAll,
      submenu: [
        { id: 'format-border-all', label: 'All Borders', icon: BorderAll },
        { id: 'format-border-outside', label: 'Outside Borders', icon: BorderOutside },
        { id: 'format-border-top', label: 'Top Border', icon: BorderTop },
        { id: 'format-border-bottom', label: 'Bottom Border', icon: BorderBottom },
        { id: 'format-border-left', label: 'Left Border', icon: BorderLeft },
        { id: 'format-border-right', label: 'Right Border', icon: BorderRight },
        { id: 'sep-border-1', label: '', separator: true },
        { id: 'format-border-clear', label: 'Clear Borders', icon: Minus },
      ],
    },
    { id: 'sep-format-3', label: '', separator: true },
    { id: 'format-clear-styles', label: 'Clear Styles', icon: Eraser },
    { id: 'sep-format-4', label: '', separator: true },
    { id: 'format-column-row-size', label: 'Column / Row Size…', icon: Ruler },
  ];

  const helpItems: MenuItem[] = [
    { id: 'help-shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
    { id: 'help-about', label: 'About SimpleSheet', icon: Info },
    { id: 'sep-help-1', label: '', separator: true },
    { id: 'help-simpledocs', label: 'SimpleDocs', icon: BookOpen },
  ];

  const dataItems: MenuItem[] = [
    { id: 'data-sort-asc', label: 'Sort A → Z', icon: ArrowUpDown },
    { id: 'data-sort-desc', label: 'Sort Z → A', icon: ArrowUpDown },
    { id: 'data-sort-dialog-asc', label: 'Sort Range (A→Z)…', icon: ArrowUpDown },
    { id: 'data-sort-dialog-desc', label: 'Sort Range (Z→A)…', icon: ArrowUpDown },
    { id: 'data-separator-2', label: '', separator: true },
    { id: 'data-toggle-filter', label: 'Toggle Filter', icon: Filter, shortcut: 'Ctrl+Shift+L', active: props.isFilterActive },
    { id: 'data-clear-filter', label: 'Clear All Filters', icon: X },
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
