import { useEffect, useRef, useMemo } from 'react';
import { parseHtmlTable } from '../utils/clipboardParse';

interface PasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPasteFormatted: () => void;
  onPastePlainText: () => void;
  /** Raw HTML content to preview */
  html?: string | null;
  /** Raw plain text content to preview */
  plain?: string | null;
}

/**
 * Modal that appears when pasting from an external source that provides
 * formatted (HTML) data. Lets the user choose between preserving styles
 * or pasting as plain text.
 */
export function PasteModal({
  isOpen,
  onClose,
  onPasteFormatted,
  onPastePlainText,
  html,
  plain,
}: PasteModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Compute preview data from HTML or plain text
  const preview = useMemo(() => {
    if (html) {
      const parsed = parseHtmlTable(html);
      return {
        rowCount: parsed.rowCount,
        colCount: parsed.colCount,
        sample: parsed.values.slice(0, 3).map((row) => row.slice(0, 3)),
        hasStyles: parsed.styles.some((row) => row.some((s) => s !== null)),
      };
    }
    if (plain) {
      const lines = plain.split(/\r?\n/).filter((l) => l.trim() !== '');
      const sample = lines.slice(0, 3).map((line) => {
        if (line.includes('\t')) return line.split('\t').slice(0, 3);
        if (line.includes(',')) return line.split(',').slice(0, 3);
        return [line];
      });
      const colCount = Math.max(...sample.map((r) => r.length), 1);
      return {
        rowCount: lines.length,
        colCount,
        sample,
        hasStyles: false,
      };
    }
    return null;
  }, [html, plain]);

  // Focus the modal when it opens, close on Escape
  useEffect(() => {
    if (!isOpen) return;
    modalRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Paste options"
        className="bg-white rounded-lg shadow-xl border border-gray-300 p-5 w-80 outline-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 className="text-base font-semibold text-gray-800 mb-1">Paste from clipboard</h2>

        {/* Preview section */}
        {preview && (
          <div className="mb-3 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-gray-600 font-medium">Preview</span>
              <span className="text-gray-400">
                {preview.rowCount} row{preview.rowCount !== 1 ? 's' : ''} × {preview.colCount} col{preview.colCount !== 1 ? 's' : ''}
                {preview.hasStyles && ' • formatted'}
              </span>
            </div>
            <div className="font-mono text-gray-700 leading-tight overflow-hidden max-h-16">
              {preview.sample.map((row, i) => (
                <div key={i} className="truncate">
                  {row.map((cell, j) => (
                    <span key={j} className="mr-2">
                      {cell || '∅'}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm text-gray-500 mb-3">
          The clipboard contains formatted content. How would you like to paste it?
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            onClick={onPasteFormatted}
            data-testid="paste-formatted"
          >
            Paste Formatted Text
          </button>
          <button
            type="button"
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded transition-colors"
            onClick={onPastePlainText}
            data-testid="paste-plain"
          >
            Paste Plain Text
          </button>
          <button
            type="button"
            className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
