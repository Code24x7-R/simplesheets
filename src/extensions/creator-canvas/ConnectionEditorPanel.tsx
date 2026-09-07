// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import React, { useState } from 'react';
import type { CanvasConnection } from './types';
import { X, Save } from 'lucide-react';

export interface ConnectionEditorPanelProps {
  connection: CanvasConnection;
  fromNodeTitle: string;
  toNodeTitle: string;
  onSave: (connection: CanvasConnection) => void;
  onClose: () => void;
}

export const ConnectionEditorPanel: React.FC<ConnectionEditorPanelProps> = ({
  connection,
  fromNodeTitle,
  toNodeTitle,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<CanvasConnection>(() => ({
    ...connection,
    style: connection.style ? { ...connection.style } : undefined,
  }));
  const update = (updates: Partial<CanvasConnection>) => setDraft((current) => ({ ...current, ...updates }));
  const updateStyle = (updates: NonNullable<CanvasConnection['style']>) =>
    setDraft((current) => ({ ...current, style: { ...current.style, ...updates } }));

  return (
    <aside className="w-80 shrink-0 h-full bg-white border-l border-slate-200 shadow-lg flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div>
          <h3 className="font-semibold text-sm text-slate-800">Edit Connector</h3>
          <p className="text-xs text-slate-500">{fromNodeTitle} → {toNodeTitle}</p>
        </div>
        <button onClick={onClose} aria-label="Close connector editor" className="p-1 text-slate-400 hover:text-slate-700 rounded"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <label className="block text-xs font-medium text-slate-700">Relationship
          <select aria-label="Connector relationship" value={draft.relationship} onChange={(e) => update({ relationship: e.target.value as CanvasConnection['relationship'] })} className="mt-1 w-full px-2.5 py-2 text-sm border border-slate-300 rounded">
            {['sequence', 'inspiration', 'dependency', 'reference', 'custom'].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-700">Label
          <input aria-label="Connector label" value={draft.label || ''} onChange={(e) => update({ label: e.target.value || undefined })} className="mt-1 w-full px-2.5 py-2 text-sm border border-slate-300 rounded" placeholder="next step" />
        </label>
        <label className="block text-xs font-medium text-slate-700">Color
          <input aria-label="Connector color" type="color" value={draft.style?.color || '#64748b'} onChange={(e) => updateStyle({ color: e.target.value })} className="mt-1 h-9 w-full" />
        </label>
        <label className="block text-xs font-medium text-slate-700">Stroke width
          <input aria-label="Connector stroke width" type="number" min="1" max="12" value={draft.style?.strokeWidth || 2} onChange={(e) => updateStyle({ strokeWidth: Number(e.target.value) || 1 })} className="mt-1 w-full px-2.5 py-2 text-sm border border-slate-300 rounded" />
        </label>
        <label className="block text-xs font-medium text-slate-700">Line style
          <select aria-label="Connector line style" value={draft.style?.strokeDash || 'solid'} onChange={(e) => updateStyle({ strokeDash: e.target.value as NonNullable<CanvasConnection['style']>['strokeDash'] })} className="mt-1 w-full px-2.5 py-2 text-sm border border-slate-300 rounded">
            <option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={draft.style?.arrowStart ?? false} onChange={(e) => updateStyle({ arrowStart: e.target.checked })} /> Arrow at start</label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={draft.style?.arrowEnd ?? true} onChange={(e) => updateStyle({ arrowEnd: e.target.checked })} /> Arrow at end</label>
      </div>
      <div className="border-t border-slate-200 p-4"><button onClick={() => onSave(draft)} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"><Save className="w-4 h-4" /> Save Connector</button></div>
    </aside>
  );
};
