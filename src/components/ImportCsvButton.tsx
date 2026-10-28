// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useCallback, useRef, forwardRef } from 'react';
import { importCsv, detectDelimiter } from '../services/csvService';
import type { IncomingImport } from '../utils/importScope';

interface ImportCsvButtonProps {
  onImport: (payload: IncomingImport) => void;
  onError?: (message: string) => void;
}

/**
 * Button that opens a file picker for CSV files and imports them.
 */
export const ImportCsvButton = forwardRef<HTMLButtonElement, ImportCsvButtonProps>(
  function ImportCsvButton({ onImport, onError }, ref) {
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
        const detected = detectDelimiter(text);
        const result = importCsv(text, { delimiter: detected });
        if (result.success && result.workbook) {
          onImport({ workbook: result.workbook, fileName: file.name, kind: 'csv', rawText: text, detectedDelimiter: detected });
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
      <button ref={ref} className="toolbar-btn" onClick={handleClick} title="Import a CSV file">
        📄 Import CSV
      </button>
    </>
  );
})
