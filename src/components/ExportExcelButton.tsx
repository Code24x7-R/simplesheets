import { useCallback } from 'react';
import { downloadExcel } from '../services/excelExport';
import type { Workbook } from '../types';

interface ExportExcelButtonProps {
  workbook: Workbook;
}

/**
 * Button that exports the current workbook to an .xlsx file download.
 */
export function ExportExcelButton({ workbook }: ExportExcelButtonProps) {
  const handleClick = useCallback(() => {
    downloadExcel(workbook);
  }, [workbook]);

  return (
    <button className="toolbar-btn" onClick={handleClick} title="Export to Excel format">
      📤 Export Excel
    </button>
  );
}
