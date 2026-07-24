import { useCallback, useState } from 'react';
import type { Workbook } from '../types';
import { saveWorkbook } from '../services/storageService';

interface SaveButtonProps {
  workbook: Workbook;
  onSaved?: (name: string) => void;
  onError?: (message: string) => void;
}

/**
 * Button that saves the current workbook to a named localStorage slot.
 * Prompts the user for a save name.
 */
export function SaveButton({ workbook, onSaved, onError }: SaveButtonProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [name, setName] = useState('');

  const handleClick = useCallback(() => {
    setName(workbook.title);
    setShowPrompt(true);
  }, [workbook.title]);

  const handleConfirm = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      onError?.('Save name cannot be empty');
      return;
    }

    const success = saveWorkbook(trimmed, workbook);
    if (success) {
      setShowPrompt(false);
      setName('');
      onSaved?.(trimmed);
    } else {
      /* istanbul ignore next - localStorage full */
      onError?.('Failed to save (localStorage may be full)');
    }
  }, [name, workbook, onSaved, onError]);

  const handleCancel = useCallback(() => {
    setShowPrompt(false);
    setName('');
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
      <button className="toolbar-btn" onClick={handleClick} title="Save to browser storage">
        💾 Save
      </button>

      {showPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-xl p-5 w-80 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Save Workbook</h3>
            <input
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Enter save name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-3 py-1.5 text-sm rounded hover:bg-gray-100"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={handleConfirm}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
