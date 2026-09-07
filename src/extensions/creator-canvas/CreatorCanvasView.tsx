// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import React, { useState } from 'react';
import type { CreatorCanvasModel, CanvasNode, CanvasNodeType } from './types';
import {
  addCanvasNode,
  removeCanvasNode,
  updateCanvasNode,
  updateCanvasSettings,
} from './canvasOps';
import { createDefaultCanvasNode } from './schema';
import { NodeEditorPanel } from './NodeEditorPanel';
import {
  Plus,
  StickyNote,
  Link as LinkIcon,
  Image as ImageIcon,
  CheckSquare,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Trash2,
  Lock,
  Unlock,
} from 'lucide-react';

export interface CreatorCanvasViewProps {
  project: CreatorCanvasModel;
  onProjectChange: (project: CreatorCanvasModel) => void;
  className?: string;
}

export const CreatorCanvasView: React.FC<CreatorCanvasViewProps> = ({
  project,
  onProjectChange,
  className = '',
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const handleAddNode = (type: CanvasNodeType) => {
    const id = `node-${Date.now()}`;
    const nextNode = createDefaultCanvasNode(id, type, {
      position: {
        x: 100 + (project.nodes.length % 5) * 40,
        y: 100 + (project.nodes.length % 5) * 40,
      },
    });
    onProjectChange(addCanvasNode(project, nextNode));
    setSelectedNodeId(id);
  };

  const handleDeleteNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onProjectChange(removeCanvasNode(project, id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const handleToggleLock = (node: CanvasNode, e: React.MouseEvent) => {
    e.stopPropagation();
    onProjectChange(updateCanvasNode(project, node.id, { locked: !node.locked }));
  };

  const handleZoom = (delta: number) => {
    const nextZoom = Math.min(Math.max(project.canvas.zoom + delta, 0.25), 3);
    onProjectChange(updateCanvasSettings(project, { zoom: nextZoom }));
  };

  const handleResetView = () => {
    onProjectChange(updateCanvasSettings(project, { zoom: 1, panX: 0, panY: 0 }));
  };

  const getNodeColor = (type: CanvasNodeType) => {
    switch (type) {
      case 'note':
        return 'bg-amber-50 border-amber-300 text-amber-950';
      case 'link':
        return 'bg-blue-50 border-blue-300 text-blue-950';
      case 'image':
        return 'bg-emerald-50 border-emerald-300 text-emerald-950';
      case 'task':
        return 'bg-purple-50 border-purple-300 text-purple-950';
      default:
        return 'bg-slate-50 border-slate-300 text-slate-900';
    }
  };

  return (
    <div className={`flex flex-col h-full w-full bg-slate-100 overflow-hidden select-none ${className}`}>
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 z-10">
        <div className="flex items-center space-x-3">
          <h2 className="font-semibold text-slate-800 text-sm">{project.name}</h2>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
            {project.projectType}
          </span>
          <span className="text-xs text-slate-400">
            {project.nodes.length} node{project.nodes.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => handleAddNode('note')}
            className="flex items-center space-x-1 text-xs px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded font-medium shadow-sm"
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span>+ Note</span>
          </button>
          <button
            onClick={() => handleAddNode('link')}
            className="flex items-center space-x-1 text-xs px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded font-medium shadow-sm"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>+ Link</span>
          </button>
          <button
            onClick={() => handleAddNode('image')}
            className="flex items-center space-x-1 text-xs px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded font-medium shadow-sm"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>+ Image</span>
          </button>
          <button
            onClick={() => handleAddNode('task')}
            className="flex items-center space-x-1 text-xs px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded font-medium shadow-sm"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>+ Task</span>
          </button>

          <div className="h-4 w-px bg-slate-200 mx-2" />

          {/* Viewport Zoom */}
          <button
            onClick={() => handleZoom(0.1)}
            title="Zoom In"
            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-500 font-mono w-10 text-center">
            {Math.round(project.canvas.zoom * 100)}%
          </span>
          <button
            onClick={() => handleZoom(-0.1)}
            title="Zoom Out"
            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            title="Reset View"
            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas Workspace Area */}
      <div className="flex flex-1 min-h-0">
      <div
        className="relative flex-1 overflow-hidden"
        style={{
          backgroundColor: project.canvas.backgroundColor,
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
          backgroundSize: `${project.canvas.gridSize * project.canvas.zoom}px ${project.canvas.gridSize * project.canvas.zoom}px`,
        }}
        onClick={() => setSelectedNodeId(null)}
      >
        {project.nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none">
            <Plus className="w-12 h-12 stroke-1 mb-2 text-slate-300" />
            <p className="text-sm">Canvas is empty. Add a note or reference above!</p>
          </div>
        ) : null}

        {/* Nodes Layer */}
        <div
          className="absolute inset-0 origin-top-left"
          style={{
            transform: `translate(${project.canvas.panX}px, ${project.canvas.panY}px) scale(${project.canvas.zoom})`,
          }}
        >
          {project.nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            return (
              <div
                key={node.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                }}
                className={`absolute rounded-lg border shadow-sm p-3 flex flex-col transition-shadow ${getNodeColor(
                  node.type
                )} ${
                  isSelected ? 'ring-2 ring-indigo-500 shadow-md' : 'hover:shadow'
                }`}
                style={{
                  left: `${node.position.x}px`,
                  top: `${node.position.y}px`,
                  width: `${node.width}px`,
                  minHeight: `${node.height}px`,
                  zIndex: node.zIndex,
                }}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between border-b border-black/10 pb-1.5 mb-2">
                  <span className="font-semibold text-xs truncate max-w-[140px]">
                    {node.title || 'Untitled'}
                  </span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => handleToggleLock(node, e)}
                      title={node.locked ? 'Unlock node' : 'Lock node'}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      {node.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={(e) => handleDeleteNode(node.id, e)}
                      title="Delete node"
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Node Content / Description */}
                <div className="text-xs text-slate-700 flex-1 whitespace-pre-wrap">
                  {node.description || (
                    <span className="text-slate-400 italic">No description...</span>
                  )}
                </div>

                {/* Node Tags */}
                {node.tagIds && node.tagIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 pt-1 border-t border-black/5">
                    {node.tagIds.map((tagId) => (
                      <span
                        key={tagId}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white/70 font-medium text-slate-600"
                      >
                        {tagId}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {selectedNodeId && project.nodes.find((node) => node.id === selectedNodeId) && (
        <NodeEditorPanel
          node={project.nodes.find((node) => node.id === selectedNodeId)!}
          onSave={(updatedNode) => {
            onProjectChange(updateCanvasNode(project, updatedNode.id, updatedNode));
            setSelectedNodeId(null);
          }}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
      </div>
    </div>
  );
};
