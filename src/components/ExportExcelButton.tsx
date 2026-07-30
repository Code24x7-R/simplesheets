import { useCallback, forwardRef } from 'react';
import { downloadExcel } from '../services/excelExport';
import type { Workbook } from '../types';

interface ExportExcelButtonProps {
  workbook: Workbook;
}

/**
 * Button that exports the current workbook to an .xlsx file download.
 */
export const ExportExcelButton = forwardRef<HTMLButtonElement, ExportExcelButtonProps>(
  function ExportExcelButton({ workbook }, ref) {
    const handleClick = useCallback(() => {
      downloadExcel(workbook);
    }, [workbook]);

    return (
      <button ref={ref} className="toolbar-btn" onClick={handleClick} title="Export to Excel format">
        📤 Export Excel
      </button>
    );
  },
);
