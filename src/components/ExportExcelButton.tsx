// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useCallback, forwardRef } from 'react';
import { downloadExcel, exportExcel } from '../services/excelExport';
import { saveExport } from '../platform/export';
import type { Workbook } from '../types';

interface ExportExcelButtonProps {
  workbook: Workbook;
}

/**
 * Button that exports the current workbook to an .xlsx file download.
 */
export const ExportExcelButton = forwardRef<HTMLButtonElement, ExportExcelButtonProps>(
  function ExportExcelButton({ workbook }, ref) {
    const handleClick = useCallback(async () => {
      await saveExport({
        data: exportExcel(workbook),
        suggestedName: `${workbook.title || 'Workbook'}.xlsx`,
        filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }],
        download: () => downloadExcel(workbook),
      });
    }, [workbook]);

    return (
      <button ref={ref} className="toolbar-btn" onClick={handleClick} title="Export to Excel format">
        📤 Export Excel
      </button>
    );
  },
);
