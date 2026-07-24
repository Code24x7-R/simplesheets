import { useCallback, useState } from 'react';
import { downloadPdf } from '../services/pdfExport';
import type { Sheet } from '../types';
import { usePrintSetup } from '../context/PrintSetupContext';

interface ExportPdfButtonProps {
  sheet: Sheet;
  onError?: (message: string) => void;
}

/**
 * Button that generates and downloads a PDF of the current sheet.
 */
export function ExportPdfButton({ sheet, onError }: ExportPdfButtonProps) {
  const { setup } = usePrintSetup();
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      await downloadPdf(sheet, { setup, title: sheet.name });
    } catch (err) {
      onError?.(err instanceof Error ? err.message : /* istanbul ignore next */ 'PDF generation failed');
    } finally {
      setLoading(false);
    }
  }, [sheet, setup, onError]);

  return (
    <button
      className="toolbar-btn"
      onClick={handleClick}
      disabled={loading}
      title="Export to PDF format"
    >
      {loading ? '⏳' : '🖨️'} Export PDF
    </button>
  );
}
