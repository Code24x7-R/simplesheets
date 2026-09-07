// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import React, { useState } from 'react';
import type { CanvasNode, CanvasNodePayload } from './types';
import { X, Save } from 'lucide-react';

export interface NodeEditorPanelProps {
  node: CanvasNode;
  onSave: (node: CanvasNode) => void;
  onClose: () => void;
}

const payloadTypeLabels: Record<string, string> = {
  link: 'Link',
  image: 'Image',
  video: 'Video',
  sketch: 'Sketch',
  brief: 'Brief',
  swatch: 'Swatch',
  quote: 'Quote',
  'storyboard-frame': 'Storyboard Frame',
};

export const NodeEditorPanel: React.FC<NodeEditorPanelProps> = ({ node, onSave, onClose }) => {
  const [draft, setDraft] = useState<CanvasNode>(() => ({
    ...node,
    tagIds: [...(node.tagIds || [])],
    payload: node.payload ? JSON.parse(JSON.stringify(node.payload)) as CanvasNodePayload : undefined,
  }));

  const updateDraft = (updates: Partial<CanvasNode>) => {
    setDraft((current) => ({ ...current, ...updates }));
  };

  const updatePayload = (updates: Record<string, unknown>) => {
    setDraft((current) => {
      if (!current.payload || current.payload.type === 'generic' || current.payload.type === 'task') {
        return current;
      }
      return {
        ...current,
        payload: {
          ...current.payload,
          data: { ...current.payload.data, ...updates },
        } as CanvasNodePayload,
      };
    });
  };

  const getPayloadValue = (key: string): string => {
    if (!draft.payload || draft.payload.type === 'generic' || draft.payload.type === 'task') return '';
    const value = draft.payload.data[key as keyof typeof draft.payload.data];
    return value === undefined || value === null ? '' : String(value);
  };

  const payloadType = draft.payload?.type;

  return (
    <aside className="w-80 shrink-0 h-full bg-white border-l border-slate-200 shadow-lg flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div>
          <h3 className="font-semibold text-sm text-slate-800">Edit Node</h3>
          <p className="text-xs text-slate-500">{payloadTypeLabels[payloadType || draft.type] || draft.type}</p>
        </div>
        <button onClick={onClose} aria-label="Close editor" className="p-1 text-slate-400 hover:text-slate-700 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label htmlFor="node-title" className="block text-xs font-medium text-slate-700 mb-1">Title</label>
          <input
            id="node-title"
            value={draft.title}
            onChange={(e) => updateDraft({ title: e.target.value })}
            className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
          />
        </div>

        <div>
          <label htmlFor="node-description" className="block text-xs font-medium text-slate-700 mb-1">Description</label>
          <textarea
            id="node-description"
            value={draft.description || ''}
            onChange={(e) => updateDraft({ description: e.target.value })}
            rows={5}
            className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded resize-y focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
          />
        </div>

        <div>
          <label htmlFor="node-tags" className="block text-xs font-medium text-slate-700 mb-1">Tags</label>
          <input
            id="node-tags"
            value={(draft.tagIds || []).join(', ')}
            onChange={(e) => updateDraft({ tagIds: e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })}
            placeholder="research, important"
            className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
          />
        </div>

        {payloadType === 'link' && (
          <div>
            <label htmlFor="node-url" className="block text-xs font-medium text-slate-700 mb-1">URL</label>
            <input
              id="node-url"
              type="url"
              value={getPayloadValue('url')}
              onChange={(e) => updatePayload({ url: e.target.value })}
              placeholder="https://example.com"
              className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
            />
          </div>
        )}

        {payloadType === 'image' && (
          <div>
            <label htmlFor="node-image-url" className="block text-xs font-medium text-slate-700 mb-1">Image URL</label>
            <input
              id="node-image-url"
              type="url"
              value={getPayloadValue('url')}
              onChange={(e) => updatePayload({ url: e.target.value })}
              placeholder="https://example.com/image.jpg"
              className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
            />
          </div>
        )}

        {payloadType === 'video' && (
          <div>
            <label htmlFor="node-video-url" className="block text-xs font-medium text-slate-700 mb-1">Video URL</label>
            <input
              id="node-video-url"
              type="url"
              value={getPayloadValue('url')}
              onChange={(e) => updatePayload({ url: e.target.value })}
              placeholder="https://example.com/video.mp4"
              className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
            />
          </div>
        )}

        {payloadType === 'quote' && (
          <div>
            <label htmlFor="node-author" className="block text-xs font-medium text-slate-700 mb-1">Author</label>
            <input
              id="node-author"
              value={getPayloadValue('author')}
              onChange={(e) => updatePayload({ author: e.target.value })}
              className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
        <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded">Cancel</button>
        <button
          onClick={() => onSave({ ...draft, modifiedDate: new Date().toISOString() })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded"
        >
          <Save className="w-3.5 h-3.5" />
          Save Changes
        </button>
      </div>
    </aside>
  );
};
