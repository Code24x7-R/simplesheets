import { useCallback, useRef } from 'react';
import { importJson } from '../services/jsonService';
import type { Workbook } from '../types';

interface ImportJsonButtonProps {
  onImport: (workbook: Workbook) => void;
  onError?: (message: string) => void;
}

/**
 * Button that opens a file picker for JSON files and imports them as workbooks.
 */
export function ImportJsonButton({ onImport, onError }: ImportJsonButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        const result = importJson(text);
        if (result.success && result.workbook) {
          onImport(result.workbook);
        } else {
          onError?.(result.error ?? 'Import failed');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [onImport, onError]
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />
      <button className="toolbar-btn" onClick={handleClick} title="Import a JSON workbook">
        📋 Import JSON
      </button>
    </>
  );
}
