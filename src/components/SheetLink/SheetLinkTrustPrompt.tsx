// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * SheetLink Trust Prompt
 *
 * Modal dialog shown when a new consumer tab requests data access.
 * The user can Allow or Deny the request.
 *
 * Follows the ColumnRowSizeModal pattern (fixed inset overlay, centered card).
 */

// ─── Props ────────────────────────────────────────────────────────────────────

interface SheetLinkTrustPromptProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Unique ID of the requesting consumer tab. */
  consumerTabId: string;
  /** Origin of the consumer (for display). */
  consumerOrigin: string;
  /** The operation being requested (e.g., "getRangeValues"). */
  requestedOperation: string;
  /** The target of the request (e.g., "Sheet1!A1:D10"). */
  requestedTarget: string;
  /** Called when the user clicks "Allow". */
  onAllow: () => void;
  /** Called when the user clicks "Deny". */
  onDeny: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SheetLinkTrustPrompt({
  isOpen,
  consumerTabId,
  consumerOrigin,
  requestedOperation,
  requestedTarget,
  onAllow,
  onDeny,
}: SheetLinkTrustPromptProps) {
  if (!isOpen) return null;

  // Format the operation name for display
  const formatOperation = (op: string): string => {
    // Convert camelCase to spaced words: "getRangeValues" → "Get Range Values"
    return op
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onDeny}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-96 max-w-[90vw] p-6 space-y-4 mx-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="trust-prompt-title"
        aria-describedby="trust-prompt-desc"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl">
            🔗
          </div>
          <h2 id="trust-prompt-title" className="text-lg font-bold text-gray-900">
            Data Access Request
          </h2>
        </div>

        {/* Description */}
        <p id="trust-prompt-desc" className="text-sm text-gray-600">
          A tab on this origin wants to access your spreadsheet data.
        </p>

        {/* Request details */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Tab ID:</span>
            <span className="font-mono text-gray-700 text-xs truncate max-w-[200px]" title={consumerTabId}>
              {consumerTabId}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Origin:</span>
            <span className="font-mono text-gray-700">{consumerOrigin}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Operation:</span>
            <span className="font-medium text-gray-700">{formatOperation(requestedOperation)}</span>
          </div>
          {requestedTarget && (
            <div className="flex justify-between">
              <span className="text-gray-500">Target:</span>
              <span className="font-mono text-gray-700">{requestedTarget}</span>
            </div>
          )}
        </div>

        {/* Warning */}
        <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">
          Only allow access if you trust this tab. Denying will prevent data access.
        </p>

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <button
            className="flex-1 py-3 rounded border border-gray-200 hover:bg-gray-50 text-sm font-medium min-h-[44px] transition-colors"
            onClick={onDeny}
          >
            Deny
          </button>
          <button
            className="flex-1 py-3 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium min-h-[44px] transition-colors"
            onClick={onAllow}
            autoFocus
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
