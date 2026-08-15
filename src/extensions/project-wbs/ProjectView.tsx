// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Project View — Main container for the Project/WBS extension.
 *
 * Supports two workflows:
 * 1. Template-based: Start from a pre-built project template
 * 2. Sheet-as-source: Convert the current spreadsheet into a project plan
 *
 * Views: Table (the sheet itself), WBS (tree), Gantt (timeline)
 */

import { useState, useMemo, useCallback } from 'react';
import { GanttChart } from './GanttChart';
import { RiskRegister } from './RiskRegister';
import { RiskMatrix } from './RiskMatrix';
import { WBSTreePanel } from './WBSTreePanel';
import { TaskEditorModal } from './TaskEditorModal';
import { RiskEditorModal } from './RiskEditorModal';
import { ResourceEditorModal } from './ResourceEditorModal';
import { ColumnMappingDialog } from './ColumnMappingDialog';
import { sheetToProject, projectModelToProject } from './sheetToProject';
import { addTask, removeTask, updateTask, toggleCollapse, findTaskById, getAllTasks, addResource, updateResource, removeResource } from './treeOps';
import { addRisk, updateRisk, removeRisk, getRiskSummary } from './risks';
import type { Project, ViewMode, WBSTask, Risk, Resource } from '../types';
import type { Sheet, ColumnMapping, ProjectModel } from '../../types';

interface ProjectViewProps {
  project: Project;
  activeSheet: Sheet | null;
  columnMapping: ColumnMapping | null;
  onSaveProject: (model: ProjectModel, mapping: ColumnMapping | null, sheetId: string | null) => void;
  onClose: () => void;
}

export function ProjectView({ project: initialProject, activeSheet, columnMapping, onSaveProject, onClose }: ProjectViewProps) {
  const [project, setProject] = useState(initialProject);
  const [viewMode, setViewMode] = useState<ViewMode>('gantt');
  const [zoom, setZoom] = useState<'day' | 'week' | 'month'>('week');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);
  const [showColumnMapping, setShowColumnMapping] = useState(false);

  // Modal states
  const [taskModal, setTaskModal] = useState<{
    open: boolean;
    task: WBSTask | null;
    parentId: string | null;
    isChild: boolean;
  }>({ open: false, task: null, parentId: null, isChild: false });

  const [riskModal, setRiskModal] = useState<{
    open: boolean;
    risk: Risk | null;
  }>({ open: false, risk: null });

  const [resourceModal, setResourceModal] = useState<{
    open: boolean;
    resource: Resource | null;
  }>({ open: false, resource: null });

  // Derived values
  const riskSummary = useMemo(() => getRiskSummary(project), [project]);
  const taskCount = project.wbs.reduce((sum, t) => sum + 1 + t.children.length, 0);
  const allTasks = useMemo(() => getAllTasks(project.wbs), [project.wbs]);

  // ─── Task CRUD ────────────────────────────────────────────────────────

  function handleAddChild(parentId: string | null) {
    setTaskModal({ open: true, task: null, parentId, isChild: parentId !== null });
  }

  function handleEditTask(taskId: string) {
    const task = findTaskById(project.wbs, taskId);
    if (task) {
      setTaskModal({ open: true, task, parentId: task.parentId, isChild: false });
    }
  }

  function handleTaskSave(task: WBSTask) {
    setProject((prev) => {
      let next: Project;
      if (taskModal.task) {
        // Edit existing
        next = { ...prev, wbs: updateTask(prev.wbs, taskModal.task.id, () => task) };
      } else {
        // Add new
        next = { ...prev, wbs: addTask(prev.wbs, taskModal.parentId, task) };
      }
      // Sync changes back to sheet
      syncProjectToSheet(next);
      return next;
    });
    setTaskModal({ open: false, task: null, parentId: null, isChild: false });
  }

  function handleDeleteTask(taskId: string) {
    const task = findTaskById(project.wbs, taskId);
    if (!task) return;

    if (task.children.length > 0) {
      if (!window.confirm(`Delete "${task.name}" and its ${task.children.length} sub-task(s)?`)) {
        return;
      }
    }

    setProject((prev) => {
      const next = { ...prev, wbs: removeTask(prev.wbs, taskId) };
      syncProjectToSheet(next);
      return next;
    });
    if (selectedTaskId === taskId) setSelectedTaskId(null);
  }

  function handleTaskDeleteFromModal() {
    if (taskModal.task) {
      handleDeleteTask(taskModal.task.id);
      setTaskModal({ open: false, task: null, parentId: null, isChild: false });
    }
  }

  function handleToggleCollapse(taskId: string) {
    setProject((prev) => ({ ...prev, wbs: toggleCollapse(prev.wbs, taskId) }));
  }

  /**
   * Sync project data back to the source sheet.
   * Converts the project model to sheet cells and calls onSaveProject.
   */
  const syncProjectToSheet = useCallback((projectState: Project) => {
    const model = projectToModel(projectState);
    onSaveProject(model, columnMapping, activeSheet?.id ?? null);
  }, [onSaveProject, columnMapping, activeSheet]);

  /**
   * Convert a runtime Project to a serializable ProjectModel.
   */
  function projectToModel(projectState: Project): ProjectModel {
    const allTasks = getAllTasks(projectState.wbs);
    return {
      id: projectState.id,
      name: projectState.name,
      description: projectState.description,
      startDate: projectState.startDate,
      endDate: projectState.endDate,
      tasks: allTasks.map((t) => ({
        id: t.id,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        duration: t.duration,
        parentId: t.parentId,
        dependencies: t.dependencies.map((d) => d.predecessorId),
        progress: t.progress,
        resourceId: t.responsibleResourceId,
        isMilestone: t.isMilestone,
        color: t.color,
        notes: t.description,
      })),
      risks: projectState.risks.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        probability: r.probability,
        impact: r.impact,
        status: r.status,
        ownerId: r.ownerId,
        mitigationPlan: r.mitigationPlan,
        notes: r.description,
      })),
      resources: projectState.resources.map((r) => ({
        id: r.id,
        name: r.name,
        role: r.role,
        costRate: r.costRate,
        costCurrency: r.costCurrency,
        availability: r.availability,
        color: r.color,
      })),
    };
  }

  // ─── Risk CRUD ────────────────────────────────────────────────────────

  function handleAddRisk() {
    setRiskModal({ open: true, risk: null });
  }

  function handleEditRisk(riskId: string) {
    const risk = project.risks.find((r) => r.id === riskId);
    if (risk) {
      setRiskModal({ open: true, risk });
    }
  }

  function handleRiskSave(risk: Risk) {
    setProject((prev) => {
      let next: Project;
      if (riskModal.risk) {
        // Edit existing - pass the full risk object as changes
        next = updateRisk(prev, riskModal.risk.id, risk);
      } else {
        // Add new
        const newRisk = { ...risk, projectId: prev.id };
        next = addRisk(prev, newRisk);
      }
      syncProjectToSheet(next);
      return next;
    });
    setRiskModal({ open: false, risk: null });
  }

  function handleRiskDelete(riskId: string) {
    setProject((prev) => {
      const next = removeRisk(prev, riskId);
      syncProjectToSheet(next);
      return next;
    });
    if (selectedRiskId === riskId) setSelectedRiskId(null);
  }

  const handleRiskClose = useCallback((riskId: string) => {
    setProject((prev) => {
      const next = {
        ...prev,
        risks: prev.risks.map((r) =>
          r.id === riskId ? { ...r, status: 'closed' as const } : r,
        ),
      };
      syncProjectToSheet(next);
      return next;
    });
  }, [syncProjectToSheet]);

  // ─── Resource CRUD ───────────────────────────────────────────────────

  function handleAddResource() {
    setResourceModal({ open: true, resource: null });
  }

  function handleResourceSave(resource: Resource) {
    setProject((prev) => {
      let next: Project;
      if (resourceModal.resource) {
        // Edit existing
        next = { ...prev, resources: updateResource(prev.resources, resourceModal.resource.id, resource) };
      } else {
        // Add new
        next = { ...prev, resources: addResource(prev.resources, resource) };
      }
      syncProjectToSheet(next);
      return next;
    });
    setResourceModal({ open: false, resource: null });
  }

  function handleResourceDelete(resourceId: string) {
    setProject((prev) => {
      const next = { ...prev, resources: removeResource(prev.resources, resourceId) };
      syncProjectToSheet(next);
      return next;
    });
    setResourceModal({ open: false, resource: null });
  }

  // ─── Sheet-to-Project Conversion ─────────────────────────────────────

  function handleConvertSheet() {
    if (activeSheet) {
      setShowColumnMapping(true);
    }
  }

  function handleColumnMappingConfirm(mapping: ColumnMapping) {
    if (!activeSheet) return;

    const model = sheetToProject(activeSheet, mapping, activeSheet.name);
    const newProject = projectModelToProject(model);

    setProject(newProject);
    setShowColumnMapping(false);
    setViewMode('gantt');

    // Save extension data to workbook
    onSaveProject(model, mapping, activeSheet.id);
  }

  function handleColumnMappingCancel() {
    setShowColumnMapping(false);
  }

  function handleSaveToSheet() {
    // Save current project state back to workbook
    const model: ProjectModel = {
      id: project.id,
      name: project.name,
      description: project.description,
      startDate: project.startDate,
      endDate: project.endDate,
      tasks: allTasks.map((t) => ({
        id: t.id,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        duration: t.duration,
        parentId: t.parentId,
        dependencies: t.dependencies.map((d) => d.predecessorId),
        progress: t.progress,
        resourceId: t.responsibleResourceId,
        isMilestone: t.isMilestone,
        color: t.color,
        notes: t.description,
      })),
      risks: project.risks.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        probability: r.probability,
        impact: r.impact,
        status: r.status,
        ownerId: r.ownerId,
        mitigationPlan: r.mitigationPlan,
        notes: r.description,
      })),
      resources: project.resources.map((r) => ({
        id: r.id,
        name: r.name,
        role: r.role,
        costRate: r.costRate,
        costCurrency: r.costCurrency,
        availability: r.availability,
        color: r.color,
      })),
    };

    onSaveProject(model, null, null);
  }

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-50" data-testid="project-view">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-800">{project.name}</h2>
          <span className="text-sm text-gray-500">
            {taskCount} tasks | {project.risks.length} risks
          </span>
          {riskSummary.byLevel.critical > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded">
              {riskSummary.byLevel.critical} critical
            </span>
          )}
          {riskSummary.byLevel.high > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 rounded">
              {riskSummary.byLevel.high} high
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded border border-gray-200 overflow-hidden">
            {(['gantt', 'risk-register', 'risk-matrix'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                className={`px-3 py-1 text-sm ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setViewMode(mode)}
              >
                {mode === 'gantt' ? 'Gantt' : mode === 'risk-register' ? 'Risk Register' : 'Risk Matrix'}
              </button>
            ))}
          </div>

          {/* Zoom controls (only for Gantt) */}
          {viewMode === 'gantt' && (
            <div className="flex rounded border border-gray-200 overflow-hidden ml-2">
              {(['day', 'week', 'month'] as const).map((z) => (
                <button
                  key={z}
                  className={`px-2 py-1 text-xs ${
                    zoom === z
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setZoom(z)}
                >
                  {z.charAt(0).toUpperCase() + z.slice(1)}
                </button>
              ))}
            </div>
          )}

          {/* Add buttons */}
          {(viewMode === 'gantt' || viewMode === 'risk-register') && (
            <button
              className="ml-2 px-3 py-1 text-sm text-white bg-green-600 rounded hover:bg-green-700"
              onClick={() => {
                if (viewMode === 'gantt') handleAddChild(null);
                else handleAddRisk();
              }}
            >
              {viewMode === 'gantt' ? '+ Add Task' : '+ Add Risk'}
            </button>
          )}

          {/* Manage Resources button */}
          {viewMode === 'gantt' && (
            <button
              className="ml-2 px-3 py-1 text-sm text-purple-600 border border-purple-300 rounded hover:bg-purple-50"
              onClick={handleAddResource}
              title="Manage project resources"
            >
              👥 Resources ({project.resources.length})
            </button>
          )}

          {/* Convert Sheet button */}
          {activeSheet && (
            <button
              className="ml-2 px-3 py-1 text-sm text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
              onClick={handleConvertSheet}
              title="Convert current sheet to project plan"
            >
              ↑ Convert Sheet
            </button>
          )}

          {/* Save to Sheet */}
          <button
            className="ml-2 px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            onClick={handleSaveToSheet}
            title="Save project data back to workbook"
          >
            ↓ Save
          </button>

          {/* Close button */}
          <button
            className="ml-4 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded hover:bg-gray-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: WBS tree (only in gantt view) */}
        {viewMode === 'gantt' && (
          <WBSTreePanel
            tasks={project.wbs}
            selectedTaskId={selectedTaskId}
            onTaskSelect={setSelectedTaskId}
            onAddChild={handleAddChild}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            onToggleCollapse={handleToggleCollapse}
          />
        )}

        {/* Main content */}
        <div className="flex-1 overflow-auto p-4">
          {viewMode === 'gantt' && (
            <GanttChart
              project={project}
              zoom={zoom}
              selectedTaskId={selectedTaskId}
              criticalPath={[]}
              onTaskSelect={setSelectedTaskId}
              onTaskDoubleClick={handleEditTask}
              onTaskToggleCollapse={handleToggleCollapse}
              showCriticalPath
              showProgress
              showRiskHeatmap={false}
              showTodayMarker
              showDependencies
            />
          )}
          {viewMode === 'risk-register' && (
            <RiskRegister
              risks={project.risks}
              selectedRiskId={selectedRiskId}
              onRiskSelect={setSelectedRiskId}
              onRiskClose={handleRiskClose}
              onRiskEdit={handleEditRisk}
              onRiskAdd={handleAddRisk}
            />
          )}
          {viewMode === 'risk-matrix' && (
            <RiskMatrix risks={project.risks} />
          )}
        </div>
      </div>

      {/* Task Editor Modal */}
      {taskModal.open && (
        <TaskEditorModal
          task={taskModal.task}
          resources={project.resources}
          allTasks={allTasks}
          isChild={taskModal.isChild}
          onClose={() => setTaskModal({ open: false, task: null, parentId: null, isChild: false })}
          onSave={handleTaskSave}
          onDelete={taskModal.task ? handleTaskDeleteFromModal : undefined}
        />
      )}

      {/* Risk Editor Modal */}
      {riskModal.open && (
        <RiskEditorModal
          risk={riskModal.risk}
          resources={project.resources}
          onClose={() => setRiskModal({ open: false, risk: null })}
          onSave={handleRiskSave}
          onDelete={riskModal.risk ? () => handleRiskDelete(riskModal.risk!.id) : undefined}
        />
      )}

      {/* Resource Editor Modal */}
      {resourceModal.open && (
        <ResourceEditorModal
          resource={resourceModal.resource}
          onClose={() => setResourceModal({ open: false, resource: null })}
          onSave={handleResourceSave}
          onDelete={resourceModal.resource ? () => handleResourceDelete(resourceModal.resource!.id) : undefined}
        />
      )}

      {/* Column Mapping Dialog */}
      {showColumnMapping && activeSheet && (
        <ColumnMappingDialog
          sheet={activeSheet}
          onConfirm={handleColumnMappingConfirm}
          onCancel={handleColumnMappingCancel}
        />
      )}
    </div>
  );
}
