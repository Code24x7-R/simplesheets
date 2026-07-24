import { useCallback, useRef } from 'react';
import { importCsv } from '../services/csvService';
import type { Workbook } from '../types';

interface ImportCsvButtonProps {
  onImport: (workbook: Workbook) => void;
  onError?: (message: string) => void;
}

/**
 * Button that opens a file picker for CSV files and imports them.
 */
export function ImportCsvButton({ onImport, onError }: ImportCsvButtonProps) {
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
        const result = importCsv(text);
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
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />
      <button className="toolbar-btn" onClick={handleClick} title="Import a CSV file">
        📄 Import CSV
      </button>
    </>
  );
}
