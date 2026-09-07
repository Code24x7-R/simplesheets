// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import React, { useState, useRef, useCallback } from 'react';
import type { CreatorCanvasModel, CanvasNode, CanvasNodeType, CanvasConnection } from './types';
import {
  addCanvasNode,
  removeCanvasNode,
  updateCanvasNode,
  updateCanvasSettings,
  addCanvasConnection,
  removeCanvasConnection,
} from './canvasOps';
import { createDefaultCanvasNode, createDefaultCanvasConnection } from './schema';
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
  Share2,
  ExternalLink,
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
  const [connectingFromNodeId, setConnectingFromNodeId] = useState<string | null>(null);

  // Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStartPosRef = useRef<{ mouseX: number; mouseY: number; nodeX: number; nodeY: number } | null>(null);

  // Pan canvas state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ mouseX: number; mouseY: number; startPanX: number; startPanY: number } | null>(null);

  const handleAddNode = (type: CanvasNodeType) => {
    const id = `node-${Date.now()}`;
    const nextNode = createDefaultCanvasNode(id, type, {
      position: {
        x: 100 + (project.nodes.length % 5) * 40 - project.canvas.panX,
        y: 100 + (project.nodes.length % 5) * 40 - project.canvas.panY,
      },
    });
    onProjectChange(addCanvasNode(project, nextNode));
    setSelectedNodeId(id);
  };

  const handleDeleteNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onProjectChange(removeCanvasNode(project, id));
    if (selectedNodeId === id) setSelectedNodeId(null);
    if (connectingFromNodeId === id) setConnectingFromNodeId(null);
  };

  const handleToggleLock = (node: CanvasNode, e: React.MouseEvent) => {
    e.stopPropagation();
    onProjectChange(updateCanvasNode(project, node.id, { locked: !node.locked }));
  };

  const handleStartConnect = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (connectingFromNodeId === nodeId) {
      setConnectingFromNodeId(null);
    } else if (connectingFromNodeId) {
      // Create connection between connectingFromNodeId and nodeId
      if (connectingFromNodeId !== nodeId) {
        const newConn: CanvasConnection = createDefaultCanvasConnection(
          `conn-${Date.now()}`,
          connectingFromNodeId,
          nodeId,
          { relationship: 'reference' }
        );
        onProjectChange(addCanvasConnection(project, newConn));
      }
      setConnectingFromNodeId(null);
    } else {
      setConnectingFromNodeId(nodeId);
    }
  };

  const handleDeleteConnection = (connId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onProjectChange(removeCanvasConnection(project, connId));
  };

  const handleZoom = (delta: number) => {
    const nextZoom = Math.min(Math.max(project.canvas.zoom + delta, 0.25), 3);
    onProjectChange(updateCanvasSettings(project, { zoom: nextZoom }));
  };

  const handleResetView = () => {
    onProjectChange(updateCanvasSettings(project, { zoom: 1, panX: 0, panY: 0 }));
  };

  // Node Drag handlers
  const handleNodeMouseDown = (node: CanvasNode, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (node.locked) return;
    setSelectedNodeId(node.id);
    if (connectingFromNodeId && connectingFromNodeId !== node.id) {
      // If in connect mode, clicking second node creates connection
      const newConn = createDefaultCanvasConnection(
        `conn-${Date.now()}`,
        connectingFromNodeId,
        node.id,
        { relationship: 'reference' }
      );
      onProjectChange(addCanvasConnection(project, newConn));
      setConnectingFromNodeId(null);
      return;
    }
    setDraggingNodeId(node.id);
    dragStartPosRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      nodeX: node.position.x,
      nodeY: node.position.y,
    };
  };

  // Canvas Pan handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setSelectedNodeId(null);
    setConnectingFromNodeId(null);
    setIsPanning(true);
    panStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startPanX: project.canvas.panX,
      startPanY: project.canvas.panY,
    };
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggingNodeId && dragStartPosRef.current) {
        const deltaX = (e.clientX - dragStartPosRef.current.mouseX) / project.canvas.zoom;
        const deltaY = (e.clientY - dragStartPosRef.current.mouseY) / project.canvas.zoom;
        let newX = dragStartPosRef.current.nodeX + deltaX;
        let newY = dragStartPosRef.current.nodeY + deltaY;

        if (project.canvas.gridSnap && project.canvas.gridSize > 0) {
          newX = Math.round(newX / project.canvas.gridSize) * project.canvas.gridSize;
          newY = Math.round(newY / project.canvas.gridSize) * project.canvas.gridSize;
        }

        onProjectChange(updateCanvasNode(project, draggingNodeId, { position: { x: newX, y: newY } }));
      } else if (isPanning && panStartRef.current) {
        const deltaX = e.clientX - panStartRef.current.mouseX;
        const deltaY = e.clientY - panStartRef.current.mouseY;
        onProjectChange(
          updateCanvasSettings(project, {
            panX: panStartRef.current.startPanX + deltaX,
            panY: panStartRef.current.startPanY + deltaY,
          })
        );
      }
    },
    [draggingNodeId, isPanning, project, onProjectChange]
  );

  const handleMouseUp = () => {
    setDraggingNodeId(null);
    dragStartPosRef.current = null;
    setIsPanning(false);
    panStartRef.current = null;
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

  // Node lookup map for connections
  const nodeMap = new Map<string, CanvasNode>();
  project.nodes.forEach((n) => nodeMap.set(n.id, n));

  return (
    <div
      className={`flex flex-col h-full w-full bg-slate-100 overflow-hidden select-none ${className}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 z-10">
        <div className="flex items-center space-x-3">
          <h2 className="font-semibold text-slate-800 text-sm">{project.name}</h2>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
            {project.projectType}
          </span>
          <span className="text-xs text-slate-400">
            {project.nodes.length} node{project.nodes.length === 1 ? '' : 's'} · {project.connections.length} link{project.connections.length === 1 ? '' : 's'}
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
      <div className="flex flex-1 min-h-0 relative">
        <div
          data-testid="canvas-workspace"
          className="relative flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
          style={{
            backgroundColor: project.canvas.backgroundColor,
            backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
            backgroundSize: `${project.canvas.gridSize * project.canvas.zoom}px ${project.canvas.gridSize * project.canvas.zoom}px`,
          }}
          onMouseDown={handleCanvasMouseDown}
        >
          {project.nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none">
              <Plus className="w-12 h-12 stroke-1 mb-2 text-slate-300" />
              <p className="text-sm">Canvas is empty. Add a note or reference above!</p>
            </div>
          ) : null}

          {/* SVG Connections Layer */}
          <svg
            className="absolute inset-0 pointer-events-none w-full h-full"
            style={{
              transform: `translate(${project.canvas.panX}px, ${project.canvas.panY}px) scale(${project.canvas.zoom})`,
              transformOrigin: '0 0',
              overflow: 'visible',
            }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
              </marker>
            </defs>
            {project.connections.map((conn) => {
              const fromNode = nodeMap.get(conn.fromNodeId);
              const toNode = nodeMap.get(conn.toNodeId);
              if (!fromNode || !toNode) return null;

              const x1 = fromNode.position.x + fromNode.width / 2;
              const y1 = fromNode.position.y + fromNode.height / 2;
              const x2 = toNode.position.x + toNode.width / 2;
              const y2 = toNode.position.y + toNode.height / 2;

              return (
                <g key={conn.id} className="pointer-events-auto group">
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={conn.style?.color || '#64748b'}
                    strokeWidth={conn.style?.strokeWidth || 2}
                    strokeDasharray={conn.style?.strokeDash === 'dashed' ? '5,5' : undefined}
                    markerEnd="url(#arrowhead)"
                    className="hover:stroke-indigo-600 transition-colors cursor-pointer"
                  />
                  {/* Midpoint Label or Delete trigger */}
                  <circle
                    cx={(x1 + x2) / 2}
                    cy={(y1 + y2) / 2}
                    r="8"
                    fill="#fff"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    className="hover:stroke-red-500 hover:fill-red-50 cursor-pointer"
                    onClick={(e) => handleDeleteConnection(conn.id, e)}
                  />
                  {conn.label && (
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 12}
                      textAnchor="middle"
                      className="text-[10px] fill-slate-600 font-sans font-medium bg-white px-1"
                    >
                      {conn.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Nodes Layer */}
          <div
            className="absolute inset-0 origin-top-left"
            style={{
              transform: `translate(${project.canvas.panX}px, ${project.canvas.panY}px) scale(${project.canvas.zoom})`,
            }}
          >
            {/* Render Collection Frames first */}
            {project.collections.map((col) => (
              <div
                key={col.id}
                className="absolute border-2 border-dashed rounded-xl pointer-events-none p-3"
                style={{
                  left: `${col.bounds.x}px`,
                  top: `${col.bounds.y}px`,
                  width: `${col.bounds.width}px`,
                  height: `${col.bounds.height}px`,
                  borderColor: col.color || '#94a3b8',
                  backgroundColor: `${col.color || '#94a3b8'}0a`,
                }}
              >
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white border shadow-sm text-slate-700">
                  {col.name}
                </span>
              </div>
            ))}

            {/* Nodes */}
            {project.nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isConnecting = connectingFromNodeId === node.id;

              return (
                <div
                  key={node.id}
                  data-testid={`canvas-node-${node.id}`}
                  onMouseDown={(e) => handleNodeMouseDown(node, e)}
                  className={`absolute rounded-lg border shadow-sm p-3 flex flex-col transition-shadow cursor-move ${getNodeColor(
                    node.type
                  )} ${
                    isSelected
                      ? 'ring-2 ring-indigo-500 shadow-md'
                      : isConnecting
                      ? 'ring-2 ring-amber-500 shadow-md'
                      : 'hover:shadow'
                  }`}
                  style={{
                    left: `${node.position.x}px`,
                    top: `${node.position.y}px`,
                    width: `${node.width}px`,
                    minHeight: `${node.height}px`,
                    zIndex: isSelected ? 10 : node.zIndex,
                  }}
                >
                  {/* Node Header */}
                  <div className="flex items-center justify-between border-b border-black/10 pb-1.5 mb-2">
                    <span className="font-semibold text-xs truncate max-w-[120px]">
                      {node.title || 'Untitled'}
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => handleStartConnect(node.id, e)}
                        title={isConnecting ? 'Cancel link' : 'Connect to another node'}
                        className={`p-0.5 rounded ${isConnecting ? 'bg-amber-200 text-amber-800' : 'text-slate-400 hover:text-indigo-600'}`}
                      >
                        <Share2 className="w-3 h-3" />
                      </button>
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

                  {/* Node Payload Preview (if Link / Image / Task) */}
                  {node.type === 'link' && node.payload?.type === 'link' && (
                    <div className="text-[11px] bg-white/60 p-1.5 rounded border border-blue-200 mb-2 flex items-center justify-between">
                      <span className="truncate max-w-[170px] text-blue-700 font-mono">
                        {node.payload.data.url || 'No URL'}
                      </span>
                      <ExternalLink className="w-3 h-3 text-blue-500 shrink-0" />
                    </div>
                  )}

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

        {/* Selected Node Inspector */}
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
