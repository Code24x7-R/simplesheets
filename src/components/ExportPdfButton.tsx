// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useCallback, useState, forwardRef } from 'react';
import { downloadPdf, generatePdf } from '../services/pdfExport';
import { getPlatform } from '../platform';
import { saveExport } from '../platform/export';
import type { Sheet } from '../types';
import { usePrintSetup } from '../context/PrintSetupContext';

interface ExportPdfButtonProps {
  sheet: Sheet;
  onError?: (message: string) => void;
}

/**
 * Button that generates and downloads a PDF of the current sheet.
 */
export const ExportPdfButton = forwardRef<HTMLButtonElement, ExportPdfButtonProps>(
  function ExportPdfButton({ sheet, onError }, ref) {
    const { setup } = usePrintSetup();
    const [loading, setLoading] = useState(false);

    const handleClick = useCallback(async () => {
      setLoading(true);
      try {
        if (getPlatform().capabilities.nativeFileDialogs) {
          const blob = await generatePdf(sheet, { setup, title: sheet.name });
          await saveExport({
            data: blob,
            suggestedName: `${sheet.name || 'Sheet'}.pdf`,
            filters: [{ name: 'PDF document', extensions: ['pdf'] }],
            download: () => downloadPdf(sheet, { setup, title: sheet.name }),
          });
        } else {
          await downloadPdf(sheet, { setup, title: sheet.name });
        }
      } catch (err) {
        onError?.(err instanceof Error ? err.message : /* istanbul ignore next */ 'PDF generation failed');
      } finally {
        setLoading(false);
      }
    }, [sheet, setup, onError]);

    return (
      <button
        ref={ref}
        className="toolbar-btn"
        onClick={handleClick}
        disabled={loading}
        title="Export to PDF format"
      >
        {loading ? '⏳' : '🖨️'} Export PDF
      </button>
    );
  },
);
