// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useEffect, useRef, useCallback } from 'react';
import { ImportExcelButton } from './ImportExcelButton';
import { ImportCsvButton } from './ImportCsvButton';
import { ImportJsonButton } from './ImportJsonButton';
import { ExportExcelButton } from './ExportExcelButton';
import { ExportCsvButton } from './ExportCsvButton';
import { ExportJsonButton } from './ExportJsonButton';
import { ExportPdfButton } from './ExportPdfButton';
import { importJson } from '../services/jsonService';
import type { Workbook, Sheet } from '../types';

interface ImportExportBridgeProps {
  workbook: Workbook;
  sheet: Sheet;
  onImport: (wb: Workbook, filename?: string) => void;
  onError: (msg: string) => void;
}

/**
 * Bridge component that listens for menu events and triggers the hidden
 * import/export components.  The menu dispatches CustomEvents; this
 * component forwards them to the appropriate hidden file input.
 */
export function ImportExportBridge({ workbook, sheet, onImport, onError }: ImportExportBridgeProps) {
  const excelRef = useRef<HTMLButtonElement>(null);
  const csvRef = useRef<HTMLButtonElement>(null);
  const jsonRef = useRef<HTMLButtonElement>(null);
  const openInputRef = useRef<HTMLInputElement>(null);
  const exportExcelRef = useRef<HTMLButtonElement>(null);
  const exportCsvRef = useRef<HTMLButtonElement>(null);
  const exportJsonRef = useRef<HTMLButtonElement>(null);
  const exportPdfRef = useRef<HTMLButtonElement>(null);

  // ─── Open (file picker for .json workbook) ────────────────────────────
  const handleOpenClick = useCallback(() => {
    openInputRef.current?.click();
  }, []);

  const handleOpenFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        const result = importJson(text);
        if (result.success && result.workbook) {
          onImport(result.workbook, file.name);
        } else {
          onError(result.error ?? 'Open failed');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [onImport, onError],
  );

  useEffect(() => {
    const handleImportExcel = () => excelRef.current?.click();
    const handleImportCsv = () => csvRef.current?.click();
    const handleImportJson = () => jsonRef.current?.click();
    const handleExportExcel = () => exportExcelRef.current?.click();
    const handleExportCsv = () => { try { exportCsvRef.current?.click(); } catch { /* istanbul ignore next - ref optional chaining never throws */ } }
    const handleExportJson = () => exportJsonRef.current?.click();
    const handleExportPdf = () => exportPdfRef.current?.click();

    window.addEventListener('simplesheets:import-excel', handleImportExcel);
    window.addEventListener('simplesheets:import-csv', handleImportCsv);
    window.addEventListener('simplesheets:import-json', handleImportJson);
    window.addEventListener('simplesheets:open', handleOpenClick);
    window.addEventListener('simplesheets:export-excel', handleExportExcel);
    window.addEventListener('simplesheets:export-csv', handleExportCsv);
    window.addEventListener('simplesheets:export-json', handleExportJson);
    window.addEventListener('simplesheets:export-pdf', handleExportPdf);

    return () => {
      window.removeEventListener('simplesheets:import-excel', handleImportExcel);
      window.removeEventListener('simplesheets:import-csv', handleImportCsv);
      window.removeEventListener('simplesheets:import-json', handleImportJson);
      window.removeEventListener('simplesheets:open', handleOpenClick);
      window.removeEventListener('simplesheets:export-excel', handleExportExcel);
      window.removeEventListener('simplesheets:export-csv', handleExportCsv);
      window.removeEventListener('simplesheets:export-json', handleExportJson);
      window.removeEventListener('simplesheets:export-pdf', handleExportPdf);
    };
  }, [handleOpenClick]);

  return (
    <div className="hidden">
      <ImportExcelButton ref={excelRef} onImport={onImport} onError={onError} />
      <ImportCsvButton ref={csvRef} onImport={onImport} onError={onError} />
      <ImportJsonButton ref={jsonRef} onImport={onImport} onError={onError} />
      <input
        ref={openInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleOpenFileChange}
      />
      <ExportExcelButton ref={exportExcelRef} workbook={workbook} />
      <ExportCsvButton ref={exportCsvRef} sheet={sheet} />
      <ExportJsonButton ref={exportJsonRef} workbook={workbook} />
      <ExportPdfButton ref={exportPdfRef} sheet={sheet} onError={onError} />
    </div>
  );
}
