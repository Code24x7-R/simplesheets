import { useCallback, forwardRef } from 'react';
import { downloadCsv } from '../services/csvService';
import type { Sheet } from '../types';

interface ExportCsvButtonProps {
  sheet: Sheet;
}

/**
 * Button that exports the current sheet to a CSV file download.
 */
export const ExportCsvButton = forwardRef<HTMLButtonElement, ExportCsvButtonProps>(
  function ExportCsvButton({ sheet }, ref) {
    const handleClick = useCallback(() => {
      downloadCsv(sheet);
    }, [sheet]);

    return (
      <button ref={ref} className="toolbar-btn" onClick={handleClick} title="Export to CSV format">
        📄 Export CSV
      </button>
    );
  },
);
