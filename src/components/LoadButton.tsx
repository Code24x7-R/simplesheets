import { useCallback, useState } from 'react';
import { listSaves, loadWorkbook, deleteSave, hasAutosave, loadAutosave } from '../services/storageService';
import type { SaveSlot } from '../services/storageService';
import type { Workbook } from '../types';

interface LoadButtonProps {
  onImport: (workbook: Workbook) => void;
  onError?: (message: string) => void;
}

/**
 * Button that opens a dialog listing saved workbooks from localStorage.
 * Users can load or delete named saves, or restore the auto-save.
 */
export function LoadButton({ onImport, onError }: LoadButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [saves, setSaves] = useState<SaveSlot[]>([]);
  const [autosaveExists, setAutosaveExists] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refreshSaves = useCallback(() => {
    setSaves(listSaves());
    setAutosaveExists(hasAutosave());
  }, []);

  const handleOpen = useCallback(() => {
    refreshSaves();
    setShowDialog(true);
  }, [refreshSaves]);

  const handleLoad = useCallback(
    (name: string) => {
      const wb = loadWorkbook(name);
      if (wb) {
        onImport(wb);
        setShowDialog(false);
      } else {
        /* istanbul ignore next - unreachable: listSaves() skips corrupt entries */
        onError?.(`Failed to load "${name}"`);
        /* istanbul ignore next - unreachable: listSaves() skips corrupt entries */
        refreshSaves();
      }
    },
    [onImport, onError, refreshSaves]
  );

  const handleLoadAutosave = useCallback(() => {
    const wb = loadAutosave();
    if (wb) {
      onImport(wb);
      setShowDialog(false);
    } else {
      onError?.('Failed to load auto-save');
      refreshSaves();
    }
  }, [onImport, onError, refreshSaves]);

  const handleDelete = useCallback(
    (name: string) => {
      deleteSave(name);
      if (confirmDelete === name) {
        setConfirmDelete(null);
        refreshSaves();
      } else {
        setConfirmDelete(name);
      }
    },
    [confirmDelete, refreshSaves]
  );

  const handleClose = useCallback(() => {
    setShowDialog(false);
    setConfirmDelete(null);
  }, []);

  const formatDate = (epochMs: number): string => {
    if (!epochMs) return 'Unknown';
    return new Date(epochMs).toLocaleString();
  };

  return (
    <>
      <button className="toolbar-btn" onClick={handleOpen} title="Load from browser storage">
        📂 Load
      </button>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-xl p-5 w-96 max-h-[80vh] flex flex-col border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Load Workbook</h3>

            <div className="flex-1 overflow-y-auto space-y-2 min-h-[100px]">
              {/* Auto-save entry */}
              {autosaveExists && (
                <div className="flex items-center justify-between p-2 rounded border border-blue-200 bg-blue-50">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-blue-800 truncate">
                      Auto-save
                    </div>
                    <div className="text-xs text-blue-600">Last session</div>
                  </div>
                  <button
                    className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 ml-2"
                    onClick={handleLoadAutosave}
                  >
                    Restore
                  </button>
                </div>
              )}

              {/* Named saves */}
              {saves.length === 0 && !autosaveExists && (
                <div className="text-sm text-gray-400 text-center py-8">
                  No saved workbooks found
                </div>
              )}

              {saves.map((slot) => (
                <div
                  key={slot.name}
                  className="flex items-center justify-between p-2 rounded border border-gray-200 hover:border-gray-300"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {slot.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {slot.title} · {slot.sheetCount} sheet{slot.sheetCount !== 1 ? 's' : ''} · {formatDate(slot.savedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                      onClick={() => handleLoad(slot.name)}
                    >
                      Load
                    </button>
                    <button
                      className={`px-2 py-1 text-xs rounded ${
                        confirmDelete === slot.name
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      onClick={() => handleDelete(slot.name)}
                      title={confirmDelete === slot.name ? 'Click again to confirm' : 'Delete save'}
                    >
                      {confirmDelete === slot.name ? 'Confirm' : '✕'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-4 pt-3 border-t border-gray-100">
              <button
                className="px-3 py-1.5 text-sm rounded hover:bg-gray-100"
                onClick={handleClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
