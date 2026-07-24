import { useCallback } from 'react';
import { downloadJson } from '../services/jsonService';
import type { Workbook } from '../types';

interface ExportJsonButtonProps {
  workbook: Workbook;
}

/**
 * Button that exports the entire workbook to a JSON file download.
 */
export function ExportJsonButton({ workbook }: ExportJsonButtonProps) {
  const handleClick = useCallback(() => {
    downloadJson(workbook);
  }, [workbook]);

  return (
    <button className="toolbar-btn" onClick={handleClick} title="Export to JSON format">
      📋 Export JSON
    </button>
  );
}
