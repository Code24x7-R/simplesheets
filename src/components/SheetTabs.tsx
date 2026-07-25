import { useState, useRef, useEffect } from 'react';
import type { Workbook } from '../types';

interface SheetTabsProps {
  workbook: Workbook;
  onSwitchSheet: (index: number) => void;
  onAddSheet: () => void;
  onRenameSheet: (index: number, newName: string) => void;
  onCopySheet: (index: number) => void;
  onDeleteSheet: (index: number) => void;
}

/**
 * Renders a horizontal tab strip for navigating between worksheets.
 * Supports switching, adding, renaming (double-click), copying, and deleting sheets.
 */
export function SheetTabs({
  workbook,
  onSwitchSheet,
  onAddSheet,
  onRenameSheet,
  onCopySheet,
  onDeleteSheet,
}: SheetTabsProps) {
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus the rename input when entering rename mode
  useEffect(() => {
    if (renamingIndex !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renamingIndex]);

  // Close the actions menu when clicking outside
  useEffect(() => {
    if (openMenuIndex === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      // Find the toggle button for the open menu and check if the click was on it
      const toggleButtons = document.querySelectorAll('[title="Sheet actions (Rename, Copy, Delete)"]');
      for (const btn of toggleButtons) {
        if (btn.contains(e.target as Node)) {
          return; // Click was on the toggle button, don't close
        }
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuIndex]);

  const handleRenameStart = (idx: number, currentName: string) => {
    setRenamingIndex(idx);
    setRenameValue(currentName);
    setOpenMenuIndex(null);
  };

  const handleRenameCommit = () => {
    if (renamingIndex !== null) {
      onRenameSheet(renamingIndex, renameValue);
      setRenamingIndex(null);
    }
  };

  const handleRenameCancel = () => {
    setRenamingIndex(null);
  };

  const handleMenuToggle = (idx: number) => {
    setOpenMenuIndex(openMenuIndex === idx ? null : idx);
  };

  return (
    <div className="flex items-end gap-0 px-2 pt-1 border-b border-gray-200 bg-gray-100 overflow-x-auto">
      {workbook.sheets.map((sheet, idx) => {
        const isActive = idx === workbook.activeSheetIndex;
        const isRenaming = renamingIndex === idx;
        const canDelete = workbook.sheets.length > 1;

        return (
          <div key={sheet.id} className="relative flex items-center group">
            {isRenaming ? (
              <input
                ref={inputRef}
                className="px-2 py-0.5 text-sm border border-blue-400 rounded outline-none bg-white min-w-[80px]"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameCommit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameCommit();
                  if (e.key === 'Escape') handleRenameCancel();
                }}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : (
              <button
                className={`px-3 py-1 text-sm rounded-t border border-b-0 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-white border-gray-300 font-medium text-gray-900 -mb-px'
                    : 'bg-gray-50 border-transparent text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                }`}
                onClick={() => onSwitchSheet(idx)}
                onDoubleClick={() => handleRenameStart(idx, sheet.name)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleMenuToggle(idx);
                }}
                title={`${sheet.name} — Double-click to rename, Right-click for actions`}
              >
                {sheet.name}
              </button>
            )}

            {/* Actions menu button */}
            {!isRenaming && (
              <button
                className={`px-1.5 py-1 text-xs rounded transition-colors flex-shrink-0 ${
                  openMenuIndex === idx
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMenuToggle(idx);
                }}
                title="Sheet actions (Rename, Copy, Delete)"
              >
                ▾
              </button>
            )}

            {/* Dropdown menu */}
            {openMenuIndex === idx && !isRenaming && (
              <div
                ref={menuRef}
                className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 min-w-[120px]"
              >
                <button
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 text-gray-700"
                  onMouseDown={() => handleRenameStart(idx, sheet.name)}
                >
                  Rename
                </button>
                <button
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 text-gray-700"
                  onMouseDown={() => {
                    onCopySheet(idx);
                    setOpenMenuIndex(null);
                  }}
                >
                  Copy
                </button>
                <button
                  className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 ${
                    canDelete ? 'text-red-600' : 'text-gray-300 cursor-not-allowed'
                  }`}
                  onMouseDown={() => {
                    if (canDelete) {
                      onDeleteSheet(idx);
                      setOpenMenuIndex(null);
                    }
                  }}
                  disabled={!canDelete}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        );
      })}
      <button
        className="px-2 py-1 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-t ml-1"
        onClick={onAddSheet}
        title="Add a new sheet"
      >
        +
      </button>
    </div>
  );
}
