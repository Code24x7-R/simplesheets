import { useEffect, useRef } from 'react';
import { ImportExcelButton } from './ImportExcelButton';
import { ImportCsvButton } from './ImportCsvButton';
import { ImportJsonButton } from './ImportJsonButton';
import { ExportExcelButton } from './ExportExcelButton';
import { ExportCsvButton } from './ExportCsvButton';
import { ExportJsonButton } from './ExportJsonButton';
import { ExportPdfButton } from './ExportPdfButton';
import type { Workbook, Sheet } from '../types';

interface ImportExportBridgeProps {
  workbook: Workbook;
  sheet: Sheet;
  onImport: (wb: Workbook) => void;
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

  useEffect(() => {
    const handleImportExcel = () => excelRef.current?.click();
    const handleImportCsv = () => csvRef.current?.click();
    const handleImportJson = () => jsonRef.current?.click();

    window.addEventListener('simplesheets:import-excel', handleImportExcel);
    window.addEventListener('simplesheets:import-csv', handleImportCsv);
    window.addEventListener('simplesheets:import-json', handleImportJson);

    return () => {
      window.removeEventListener('simplesheets:import-excel', handleImportExcel);
      window.removeEventListener('simplesheets:import-csv', handleImportCsv);
      window.removeEventListener('simplesheets:import-json', handleImportJson);
    };
  }, []);

  return (
    <div className="hidden">
      <ImportExcelButton ref={excelRef} onImport={onImport} onError={onError} />
      <ImportCsvButton ref={csvRef} onImport={onImport} onError={onError} />
      <ImportJsonButton ref={jsonRef} onImport={onImport} onError={onError} />
      <ExportExcelButton workbook={workbook} />
      <ExportCsvButton sheet={sheet} />
      <ExportJsonButton workbook={workbook} />
      <ExportPdfButton sheet={sheet} onError={onError} />
    </div>
  );
}
