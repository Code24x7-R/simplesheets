import { useCallback } from 'react';
import { DropdownMenu, type MenuItem } from './DropdownMenu';

interface MenuBarProps {
  // File menu
  onNew: () => void;
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
  onClear: () => void;
  onDeleteRow: () => void;
  onDeleteCol: () => void;
  onDeleteCells: () => void;
  // View menu
  onFreeze: () => void;
  onUnfreeze: () => void;
  hasFrozenPanes: boolean;
  // Insert menu
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onInsertColLeft: () => void;
  onInsertColRight: () => void;
  // Format menu
  onMerge: () => void;
  onUnmerge: () => void;
  canMerge: boolean;
  canUnmerge: boolean;
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
        'edit-clear': props.onClear,
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
        // Format
        'format-merge': props.onMerge,
        'format-unmerge': props.onUnmerge,
        // Help
        'help-about': props.onAbout,
        'help-shortcuts': props.onShortcuts,
      };
      actions[id]?.();
    },
    [props]
  );

  const fileItems: MenuItem[] = [
    { id: 'file-new', label: 'New', shortcut: 'Ctrl+N', icon: '📄' },
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
    { id: 'edit-clear', label: 'Clear Contents', shortcut: 'Delete', icon: '🧹' },
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
  ];

  const formatItems: MenuItem[] = [
    { id: 'format-merge', label: 'Merge Cells', icon: '⊞', disabled: !props.canMerge },
    { id: 'format-unmerge', label: 'Unmerge Cells', icon: '⊟', disabled: !props.canUnmerge },
  ];

  const helpItems: MenuItem[] = [
    { id: 'help-shortcuts', label: 'Keyboard Shortcuts', icon: '⌨️' },
    { id: 'help-about', label: 'About SimpleSheet', icon: 'ℹ️' },
  ];

  return (
    <div className="menu-bar">
      <DropdownMenu label="File" items={fileItems} onSelect={handleSelect} />
      <DropdownMenu label="Edit" items={editItems} onSelect={handleSelect} />
      <DropdownMenu label="View" items={viewItems} onSelect={handleSelect} />
      <DropdownMenu label="Insert" items={insertItems} onSelect={handleSelect} />
      <DropdownMenu label="Format" items={formatItems} onSelect={handleSelect} />
      <DropdownMenu label="Help" items={helpItems} onSelect={handleSelect} />
    </div>
  );
}
