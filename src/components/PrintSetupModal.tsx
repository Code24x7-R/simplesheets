// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { usePrintSetup, type PageOrientation, type PageSize, type PrintScaling } from '../context/PrintSetupContext';
import { NumericInput } from './NumericInput';

interface PrintSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal for configuring page setup (orientation, size, margins, scaling).
 */
export function PrintSetupModal({ isOpen, onClose }: PrintSetupModalProps) {
  const { setup, updateSetup, updateMargins } = usePrintSetup();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-96 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Page Setup</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ✕
          </button>
        </div>

        {/* Orientation */}
        <div>
          <label className="block text-sm font-medium mb-1">Orientation</label>
          <div className="flex gap-2">
            {(['portrait', 'landscape'] as PageOrientation[]).map((o) => (
              <button
                key={o}
                className={`flex-1 py-2 rounded border text-sm capitalize ${
                  setup.orientation === o
                    ? 'bg-blue-100 border-blue-500 text-blue-700'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => updateSetup({ orientation: o })}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* Page Size */}
        <div>
          <label className="block text-sm font-medium mb-1">Paper Size</label>
          <select
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
            value={setup.pageSize}
            onChange={(e) => updateSetup({ pageSize: e.target.value as PageSize })}
          >
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
            <option value="Legal">Legal</option>
          </select>
        </div>

        {/* Scaling */}
        <div>
          <label className="block text-sm font-medium mb-1">Scaling</label>
          <select
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
            value={setup.scaling}
            onChange={(e) => updateSetup({ scaling: e.target.value as PrintScaling })}
          >
            <option value="fit-to-page">Fit to Page</option>
            <option value="actual-size">Actual Size</option>
            <option value="fit-to-width">Fit to Width</option>
          </select>
        </div>

        {/* Margins */}
        <div>
          <label className="block text-sm font-medium mb-1">Margins (mm)</label>
          <div className="grid grid-cols-2 gap-2">
            {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
              <div key={side} className="flex items-center gap-1">
                <label className="text-xs text-gray-500 w-12 capitalize">{side}</label>
                <NumericInput
                  min={0}
                  max={50}
                  className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm w-16"
                  value={setup.margins[side]}
                  onChange={(v) => updateMargins({ [side]: Math.round(v) })}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button className="px-4 py-2 rounded border border-gray-200 hover:bg-gray-50 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm" onClick={onClose}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
