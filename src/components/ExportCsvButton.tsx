// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useCallback, forwardRef } from 'react';
import { downloadCsv, exportCsv } from '../services/csvService';
import { saveExport } from '../platform/export';
import type { Sheet } from '../types';

interface ExportCsvButtonProps {
  sheet: Sheet;
}

/**
 * Button that exports the current sheet to a CSV file download.
 */
export const ExportCsvButton = forwardRef<HTMLButtonElement, ExportCsvButtonProps>(
  function ExportCsvButton({ sheet }, ref) {
    const handleClick = useCallback(async () => {
      await saveExport({
        data: exportCsv(sheet),
        suggestedName: `${sheet.name || 'Sheet'}.csv`,
        filters: [{ name: 'CSV file', extensions: ['csv'] }],
        download: () => downloadCsv(sheet),
      });
    }, [sheet]);

    return (
      <button ref={ref} className="toolbar-btn" onClick={handleClick} title="Export to CSV format">
        📄 Export CSV
      </button>
    );
  },
);
