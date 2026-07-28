import { useCallback, useRef, useState, forwardRef } from 'react';
import { importExcelFile } from '../services/excelImport';
import type { Workbook } from '../types';

interface ImportExcelButtonProps {
  /** Callback when a workbook is successfully imported. */
  onImport: (workbook: Workbook) => void;
  /** Callback for error messages. */
  onError?: (message: string) => void;
}

/**
 * Button that opens a file picker for .xlsx files and imports them.
 */
export const ImportExcelButton = forwardRef<HTMLButtonElement, ImportExcelButtonProps>(
  function ImportExcelButton({ onImport, onError }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      /* istanbul ignore next - edge case: no file selected */
      if (!file) return;

      setLoading(true);
      try {
        const result = await importExcelFile(file);
        if (result.success && result.workbook) {
          onImport(result.workbook);
        } else {
          onError?.(result.error ?? 'Import failed');
        }
      } catch (err) {
        /* istanbul ignore next - edge case: non-Error exception */
        onError?.(err instanceof Error ? err.message : 'Import error');
      } finally {
        setLoading(false);
        // Reset input so the same file can be re-selected
        e.target.value = '';
      }
    },
    [onImport, onError]
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        ref={ref}
        className="toolbar-btn"
        onClick={handleClick}
        disabled={loading}
        title="Import an Excel file"
      >
        {loading ? '⏳' : '📥'} Import Excel
      </button>
    </>
  );
})
