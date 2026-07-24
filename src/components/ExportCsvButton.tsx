import { useCallback } from 'react';
import { downloadCsv } from '../services/csvService';
import type { Sheet } from '../types';

interface ExportCsvButtonProps {
  sheet: Sheet;
}

/**
 * Button that exports the current sheet to a CSV file download.
 */
export function ExportCsvButton({ sheet }: ExportCsvButtonProps) {
  const handleClick = useCallback(() => {
    downloadCsv(sheet);
  }, [sheet]);

  return (
    <button className="toolbar-btn" onClick={handleClick} title="Export to CSV format">
      📄 Export CSV
    </button>
  );
}
