// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * WBS Tree Panel
 *
 * Left sidebar showing the work breakdown structure as an interactive tree.
 * Supports:
 * - Expand/collapse nodes
 * - Add sibling/child tasks
 * - Edit selected task
 * - Delete task
 * - Drag indicators (visual only for now)
 * - Inline selection sync with Gantt chart
 */

import { useState, useMemo, useCallback } from 'react';
import type { WBSTask } from '../types';
import { findParent } from './treeOps';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';

const STATUS_CYCLE: Record<string, WBSTask['status']> = {
  not_started: 'in_progress',
  in_progress: 'done',
  done: 'done',
  waiting: 'in_progress',
  ready: 'in_progress',
  on_hold: 'in_progress',
};

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  done: 'Done',
  waiting: 'Waiting',
  ready: 'Ready',
  on_hold: 'On Hold',
};

interface WBSTreePanelProps {
  tasks: WBSTask[];
  selectedTaskId: string | null;
  onTaskSelect: (taskId: string) => void;
  onAddChild: (parentId: string | null) => void;
  onEditTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleCollapse: (taskId: string) => void;
  onOpenDependencies?: (taskId: string) => void;
  onTaskStatusChange?: (taskId: string, status: WBSTask['status']) => void;
  onMoveTaskUp?: (taskId: string) => void;
  onMoveTaskDown?: (taskId: string) => void;
}

/**
 * Flatten tree into display rows with depth info for indentation.
 */
function flattenTasks(
  tasks: WBSTask[],
  depth: number = 0,
  collapsedSet: Set<string>,
): { task: WBSTask; depth: number; hasChildren: boolean; isCollapsed: boolean }[] {
  const rows: { task: WBSTask; depth: number; hasChildren: boolean; isCollapsed: boolean }[] = [];
  for (const task of tasks) {
    const hasChildren = task.children.length > 0;
    const isCollapsed = collapsedSet.has(task.id);
    rows.push({ task, depth, hasChildren, isCollapsed });
    if (hasChildren && !isCollapsed) {
      rows.push(...flattenTasks(task.children, depth + 1, collapsedSet));
    }
  }
  return rows;
}

export function WBSTreePanel({
  tasks,
  selectedTaskId,
  onTaskSelect,
  onAddChild,
  onEditTask,
  onDeleteTask,
  onToggleCollapse,
  onOpenDependencies,
  onTaskStatusChange,
  onMoveTaskUp,
  onMoveTaskDown,
}: WBSTreePanelProps) {
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    taskId: string;
  } | null>(null);

  const rows = useMemo(
    () => flattenTasks(tasks, 0, collapsedSet),
    [tasks, collapsedSet],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, taskId });
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const contextMenuItems = useMemo((): ContextMenuItem[] => {
    if (!contextMenu) return [];
    const task = rows.find((r) => r.task.id === contextMenu.taskId)?.task;
    if (!task) return [];

    const items: ContextMenuItem[] = [];

    if (onEditTask) {
      items.push({
        label: 'Edit',
        icon: '✏️',
        onClick: () => onEditTask(task.id),
      });
    }

    items.push({
      label: 'Add Child',
      icon: '➕',
      onClick: () => onAddChild(task.id),
    });

    if (onOpenDependencies) {
      items.push({
        label: 'Dependencies',
        icon: '🔗',
        onClick: () => onOpenDependencies(task.id),
      });
    }

    if (onTaskStatusChange) {
      const currentStatus = task.status ?? 'not_started';
      const nextStatus = STATUS_CYCLE[currentStatus] ?? 'in_progress';
      if (nextStatus !== currentStatus) {
        items.push({
          label: `Mark ${STATUS_LABELS[nextStatus] ?? nextStatus}`,
          icon: '✓',
          onClick: () => onTaskStatusChange(task.id, nextStatus),
        });
      }
    }

    if (onDeleteTask) {
      items.push({
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        onClick: () => onDeleteTask(task.id),
      });
    }

    return items;
  }, [contextMenu, rows, onEditTask, onAddChild, onOpenDependencies, onTaskStatusChange, onDeleteTask]);

  function toggleCollapse(taskId: string) {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
    onToggleCollapse(taskId);
  }

  function getStatusColor(task: WBSTask): string {
    if (task.isMilestone) return 'bg-purple-500';
    if (task.isSummary) return 'bg-gray-600';
    if (task.progress >= 100) return 'bg-green-500';
    if (task.progress > 0) return 'bg-blue-500';
    return 'bg-gray-400';
  }

  return (
    <div className="w-72 border-r border-gray-200 bg-white flex flex-col h-full" data-testid="wbs-tree-panel">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Work Breakdown Structure</span>
        <button
          className="text-xs text-blue-600 hover:underline"
          onClick={() => onAddChild(null)}
          title="Add root task"
        >
          + Add Task
        </button>
      </div>

      {/* Column Headers */}
      <div className="px-3 py-1.5 border-b border-gray-100 text-xs text-gray-500 flex justify-between">
        <span className="flex-1">Task Name</span>
        <span className="w-12 text-right">%</span>
      </div>

      {/* Tree Rows */}
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-gray-400">
            No tasks yet. Click "Add Task" to create your first WBS item.
          </div>
        )}
        {rows.map(({ task, depth, hasChildren, isCollapsed }) => {
          const isSelected = task.id === selectedTaskId;

          // Find sibling position to determine if move up/down is possible
          const parent = findParent(tasks, task.id);
          const siblings = parent ? parent.children : tasks;
          const siblingIndex = siblings.findIndex((t) => t.id === task.id);
          const canMoveUp = siblingIndex > 0;
          const canMoveDown = siblingIndex >= 0 && siblingIndex < siblings.length - 1;
          return (
            <div
              key={task.id}
              className={`group flex items-center px-3 py-1.5 cursor-pointer border-b border-gray-50 ${
                isSelected ? 'bg-blue-50 border-l-2 border-l-blue-600' : 'hover:bg-gray-50'
              }`}
              onClick={() => onTaskSelect(task.id)}
              onContextMenu={(e) => handleContextMenu(e, task.id)}
            >
              {/* Indentation + Expand/Collapse */}
              <div className="flex items-center" style={{ paddingLeft: `${depth * 16}px` }}>
                {hasChildren ? (
                  <button
                    className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-700 mr-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(task.id);
                    }}
                  >
                    {isCollapsed ? '▶' : '▼'}
                  </button>
                ) : (
                  <span className="w-4 mr-1" />
                )}
              </div>

              {/* Status Dot — clickable to cycle status */}
              {onTaskStatusChange ? (
                <button
                  className={`w-3 h-3 rounded-full mr-2 flex-shrink-0 cursor-pointer ring-0 hover:ring-2 hover:ring-blue-300 transition-all ${getStatusColor(task)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextStatus = STATUS_CYCLE[task.status ?? 'not_started'] ?? 'in_progress';
                    onTaskStatusChange(task.id, nextStatus);
                  }}
                  title={`Status: ${STATUS_LABELS[task.status ?? 'not_started'] ?? task.status} — click to change`}
                />
              ) : (
                <span
                  className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${getStatusColor(task)}`}
                  title={`Status: ${STATUS_LABELS[task.status ?? 'not_started'] ?? task.status}`}
                />
              )}

              {/* Task Name */}
              <span
                className={`flex-1 text-sm truncate ${task.isSummary ? 'font-semibold' : ''}`}
                title={task.name}
              >
                {task.name}
              </span>

              {/* Progress */}
              {!task.isSummary && (
                <span className="w-12 text-right text-xs text-gray-500">
                  {task.progress}%
                </span>
              )}

              {/* Action Buttons (visible on hover/selection) */}
              <div
                className={`flex items-center gap-0.5 ml-2 ${
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                {onMoveTaskUp && (
                  <button
                    className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-blue-600 text-xs rounded hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move task up"
                    disabled={!canMoveUp}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveTaskUp(task.id);
                    }}
                  >
                    ▲
                  </button>
                )}
                {onMoveTaskDown && (
                  <button
                    className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-blue-600 text-xs rounded hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move task down"
                    disabled={!canMoveDown}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveTaskDown(task.id);
                    }}
                  >
                    ▼
                  </button>
                )}
                <button
                  className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-blue-600 text-xs rounded hover:bg-blue-50"
                  title="Add child task"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddChild(task.id);
                  }}
                >
                  +
                </button>
                <button
                  className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-purple-600 text-xs rounded hover:bg-purple-50"
                  title="Manage dependencies"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDependencies?.(task.id);
                  }}
                >
                  🔗
                </button>
                <button
                  className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-blue-600 text-xs rounded hover:bg-blue-50"
                  title="Edit task"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTask(task.id);
                  }}
                >
                  ✎
                </button>
                <button
                  className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-red-600 text-xs rounded hover:bg-red-50"
                  title="Delete task"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTask(task.id);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Stats */}
      <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        {tasks.reduce((sum, t) => sum + 1 + t.children.length, 0)} tasks total
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
