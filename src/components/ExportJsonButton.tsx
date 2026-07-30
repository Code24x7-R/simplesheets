import { useCallback, forwardRef } from 'react';
import { downloadJson } from '../services/jsonService';
import type { Workbook } from '../types';

interface ExportJsonButtonProps {
  workbook: Workbook;
}

/**
 * Button that exports the entire workbook to a JSON file download.
 */
export const ExportJsonButton = forwardRef<HTMLButtonElement, ExportJsonButtonProps>(
  function ExportJsonButton({ workbook }, ref) {
    const handleClick = useCallback(() => {
      downloadJson(workbook);
    }, [workbook]);

    return (
      <button ref={ref} className="toolbar-btn" onClick={handleClick} title="Export to JSON format">
        📋 Export JSON
      </button>
    );
  },
);
