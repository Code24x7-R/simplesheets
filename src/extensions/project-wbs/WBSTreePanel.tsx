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

import { useState, useMemo } from 'react';
import type { WBSTask } from '../types';

interface WBSTreePanelProps {
  tasks: WBSTask[];
  selectedTaskId: string | null;
  onTaskSelect: (taskId: string) => void;
  onAddChild: (parentId: string | null) => void;
  onEditTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleCollapse: (taskId: string) => void;
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
}: WBSTreePanelProps) {
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());

  const rows = useMemo(
    () => flattenTasks(tasks, 0, collapsedSet),
    [tasks, collapsedSet],
  );

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
          return (
            <div
              key={task.id}
              className={`group flex items-center px-3 py-1.5 cursor-pointer border-b border-gray-50 ${
                isSelected ? 'bg-blue-50 border-l-2 border-l-blue-600' : 'hover:bg-gray-50'
              }`}
              onClick={() => onTaskSelect(task.id)}
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

              {/* Status Dot */}
              <span className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${getStatusColor(task)}`} />

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
    </div>
  );
}
