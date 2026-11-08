// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useCallback, forwardRef } from 'react';
import { downloadJson, exportJson } from '../services/jsonService';
import { saveExport } from '../platform/export';
import type { Workbook } from '../types';

interface ExportJsonButtonProps {
  workbook: Workbook;
}

/**
 * Button that exports the entire workbook to a JSON file download.
 */
export const ExportJsonButton = forwardRef<HTMLButtonElement, ExportJsonButtonProps>(
  function ExportJsonButton({ workbook }, ref) {
    const handleClick = useCallback(async () => {
      await saveExport({
        data: exportJson(workbook),
        suggestedName: `${workbook.title || 'Workbook'}.json`,
        filters: [{ name: 'JSON document', extensions: ['json'] }],
        download: () => downloadJson(workbook),
      });
    }, [workbook]);

    return (
      <button ref={ref} className="toolbar-btn" onClick={handleClick} title="Export to JSON format">
        📋 Export JSON
      </button>
    );
  },
);
