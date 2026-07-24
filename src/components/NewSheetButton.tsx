import { useCallback, useState } from 'react';
import type { Workbook } from '../types';

interface NewSheetButtonProps {
  onNewSheet: (workbook: Workbook) => void;
}

/**
 * Generates a unique ID without crypto.randomUUID (which is unavailable in jsdom).
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Creates a blank workbook with a single empty sheet.
 */
function createBlankWorkbook(): Workbook {
  return {
    id: generateId(),
    title: 'Untitled',
    activeSheetIndex: 0,
    lastModified: Date.now(),
    sheets: [
      {
        id: generateId(),
        name: 'Sheet1',
        cells: {},
        defaultColWidth: 100,
        defaultRowHeight: 28,
        columnWidths: {},
        rowHeights: {},
        columnCount: 26,
        rowCount: 100,
        frozenColumns: 0,
        frozenRows: 0,
      },
    ],
  };
}

/**
 * Button that creates a new blank workbook.
 * Shows a confirmation dialog since it replaces the current workbook.
 */
export function NewSheetButton({ onNewSheet }: NewSheetButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClick = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const handleConfirm = useCallback(() => {
    const wb = createBlankWorkbook();
    setShowConfirm(false);
    onNewSheet(wb);
  }, [onNewSheet]);

  const handleCancel = useCallback(() => {
    setShowConfirm(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleConfirm();
      if (e.key === 'Escape') handleCancel();
    },
    [handleConfirm, handleCancel]
  );

  return (
    <>
      <button className="toolbar-btn" onClick={handleClick} title="Create a new blank workbook">
        📄 New
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-xl p-5 w-80 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">New Workbook</h3>
            <p className="text-sm text-gray-600 mb-4">
              Create a blank workbook? Any unsaved changes will be lost.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1.5 text-sm rounded hover:bg-gray-100"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={handleConfirm}
                onKeyDown={handleKeyDown}
                autoFocus
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
