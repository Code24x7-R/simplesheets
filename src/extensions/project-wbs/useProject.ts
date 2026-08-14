// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Project State Hook
 *
 * Manages the full project state including:
 * - WBS tree operations
 * - Risk CRUD
 * - View mode and UI state
 * - Derived values (critical path, risk matrix)
 */

import { useState, useCallback, useMemo } from 'react';
import type { Project, WBSTask, Risk, ViewMode, GanttZoom } from '../types';
import {
  addTask as addTaskToTree,
  removeTask as removeTaskFromTree,
  moveTask as moveTaskInTree,
  toggleCollapsed as toggleCollapsedInTree,
  findTask,
} from './treeOps';
import { addRisk, updateRisk, closeRisk, removeRisk, linkRiskToTask, unlinkRiskFromTask } from './risks';
import { recomputeRollups } from './rollups';
import { getCriticalPath, flattenTasks } from './dependencies';
import { getRiskMatrix } from './risks';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProjectState {
  project: Project;
  selectedTaskId: string | null;
  viewMode: ViewMode;
  zoom: GanttZoom;
}

export interface UseProjectResult {
  // State
  project: Project;
  selectedTaskId: string | null;
  viewMode: ViewMode;
  zoom: GanttZoom;

  // Derived
  flatTasks: WBSTask[];
  criticalPath: string[];
  riskMatrix: ReturnType<typeof getRiskMatrix>;

  // Task operations
  addTask: (parentId: string | null, task: WBSTask) => void;
  updateTask: (taskId: string, changes: Partial<WBSTask>) => void;
  removeTask: (taskId: string) => void;
  moveTask: (taskId: string, newParentId: string | null, index: number) => void;
  toggleCollapsed: (taskId: string) => void;
  selectTask: (taskId: string | null) => void;

  // Risk operations
  addRisk: (risk: Risk) => void;
  updateRisk: (riskId: string, changes: Partial<Risk>) => void;
  closeRisk: (riskId: string) => void;
  removeRisk: (riskId: string) => void;
  linkRiskToTask: (riskId: string, taskId: string) => void;
  unlinkRiskFromTask: (riskId: string) => void;

  // View operations
  setViewMode: (mode: ViewMode) => void;
  setZoom: (zoom: GanttZoom) => void;

  // Utility
  getTask: (taskId: string) => WBSTask | null;
  recomputeAll: () => void;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useProject(initialProject: Project): UseProjectResult {
  const [project, setProject] = useState<Project>(initialProject);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('gantt');
  const [zoom, setZoom] = useState<GanttZoom>('week');

  // ─── Task operations ──────────────────────────────────────────────────

  const addTask = useCallback((parentId: string | null, task: WBSTask) => {
    setProject((prev) => ({
      ...prev,
      wbs: addTaskToTree(prev.wbs, parentId, task),
    }));
  }, []);

  const updateTask = useCallback((taskId: string, changes: Partial<WBSTask>) => {
    setProject((prev) => {
      const updateInTree = (tasks: WBSTask[]): WBSTask[] =>
        tasks.map((t) => {
          if (t.id === taskId) return { ...t, ...changes };
          if (t.children.length > 0) {
            return { ...t, children: updateInTree(t.children) };
          }
          return t;
        });
      return { ...prev, wbs: updateInTree(prev.wbs) };
    });
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setProject((prev) => ({
      ...prev,
      wbs: removeTaskFromTree(prev.wbs, taskId),
    }));
    setSelectedTaskId((prev) => (prev === taskId ? null : prev));
  }, []);

  const moveTask = useCallback((taskId: string, newParentId: string | null, index: number) => {
    setProject((prev) => ({
      ...prev,
      wbs: moveTaskInTree(prev.wbs, taskId, newParentId, index),
    }));
  }, []);

  const toggleCollapsed = useCallback((taskId: string) => {
    setProject((prev) => ({
      ...prev,
      wbs: toggleCollapsedInTree(prev.wbs, taskId),
    }));
  }, []);

  const selectTask = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
  }, []);

  // ─── Risk operations ──────────────────────────────────────────────────

  const addRiskToProject = useCallback((risk: Risk) => {
    setProject((prev) => addRisk(prev, risk));
  }, []);

  const updateRiskInProject = useCallback((riskId: string, changes: Partial<Risk>) => {
    setProject((prev) => updateRisk(prev, riskId, changes));
  }, []);

  const closeRiskInProject = useCallback((riskId: string) => {
    setProject((prev) => closeRisk(prev, riskId));
  }, []);

  const removeRiskFromProject = useCallback((riskId: string) => {
    setProject((prev) => removeRisk(prev, riskId));
  }, []);

  const linkRisk = useCallback((riskId: string, taskId: string) => {
    setProject((prev) => linkRiskToTask(prev, riskId, taskId));
  }, []);

  const unlinkRisk = useCallback((riskId: string) => {
    setProject((prev) => unlinkRiskFromTask(prev, riskId));
  }, []);

  // ─── Utility ──────────────────────────────────────────────────────────

  const getTask = useCallback((taskId: string): WBSTask | null => {
    return findTask(project.wbs, taskId);
  }, [project.wbs]);

  const recomputeAll = useCallback(() => {
    setProject((prev) => ({
      ...prev,
      wbs: recomputeRollups(prev.wbs, prev.risks),
    }));
  }, []);

  // ─── Derived values ───────────────────────────────────────────────────

  const flatTasks = useMemo(() => flattenTasks(project.wbs), [project.wbs]);

  const criticalPath = useMemo(
    () => getCriticalPath(flatTasks, project.calendar),
    [flatTasks, project.calendar],
  );

  const riskMatrix = useMemo(
    () => getRiskMatrix(project.risks),
    [project.risks],
  );

  return {
    // State
    project,
    selectedTaskId,
    viewMode,
    zoom,

    // Derived
    flatTasks,
    criticalPath,
    riskMatrix,

    // Task operations
    addTask,
    updateTask,
    removeTask,
    moveTask,
    toggleCollapsed,
    selectTask,

    // Risk operations
    addRisk: addRiskToProject,
    updateRisk: updateRiskInProject,
    closeRisk: closeRiskInProject,
    removeRisk: removeRiskFromProject,
    linkRiskToTask: linkRisk,
    unlinkRiskFromTask: unlinkRisk,

    // View operations
    setViewMode,
    setZoom,

    // Utility
    getTask,
    recomputeAll,
  };
}
