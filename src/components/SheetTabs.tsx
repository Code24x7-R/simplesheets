// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleBtnElRef = useRef<HTMLButtonElement | null>(null);

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
      // Don't close if the click was on the toggle button (the click handler will toggle it)
      const toggleBtn = toggleBtnElRef.current;
      /* istanbul ignore next - edge case: click on toggle button */
      if (toggleBtn && toggleBtn.contains(e.target as Node)) {
        return;
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

  const handleMenuToggle = useCallback((idx: number, e?: React.MouseEvent) => {
    setOpenMenuIndex((prev) => {
      if (prev === idx) return null;
      // Capture the toggle button's bounding rect so we can position the portal
      const btn = e?.currentTarget as HTMLButtonElement | null;
      if (btn) {
        toggleBtnElRef.current = btn;
        const rect = btn.getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 4, left: rect.left });
      }
      return idx;
    });
  }, []);

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
                  handleMenuToggle(idx, e);
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
                  handleMenuToggle(idx, e);
                }}
                title="Sheet actions (Rename, Copy, Delete)"
              >
                ▾
              </button>
            )}

            {/* Dropdown menu — rendered via portal to escape overflow-x:auto clip */}
            {openMenuIndex === idx && !isRenaming &&
              createPortal(
                <div
                  ref={menuRef}
                  style={{
                    position: 'fixed',
                    top: menuPos.top,
                    left: menuPos.left,
                    zIndex: 9999,
                  }}
                  className="bg-white border border-gray-300 rounded shadow-lg min-w-[120px]"
                >
                  <button
                    className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 text-gray-700"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleRenameStart(idx, sheet.name);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 text-gray-700"
                    onMouseDown={(e) => {
                      e.preventDefault();
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
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (canDelete) {
                        onDeleteSheet(idx);
                        setOpenMenuIndex(null);
                      }
                    }}
                    disabled={!canDelete}
                  >
                    Delete
                  </button>
                </div>,
                document.body,
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
