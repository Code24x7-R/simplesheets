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

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ToolbarDropdown } from './ToolbarDropdown';
import { GanttChart } from './GanttChart';
import { RiskRegister } from './RiskRegister';
import { RiskMatrix } from './RiskMatrix';
import { WBSTreePanel } from './WBSTreePanel';
import { ResourceHeatmap } from './ResourceHeatmap';
import { CalendarConfigModal } from './CalendarConfigModal';
import { TaskEditorModal } from './TaskEditorModal';
import { RiskEditorModal } from './RiskEditorModal';
import { ResourceEditorModal } from './ResourceEditorModal';
import { ResourceListModal } from './ResourceListModal';
import { ColumnMappingDialog } from './ColumnMappingDialog';
import { AccountingDashboard } from './AccountingDashboard';
import { DependencyDrawer } from './DependencyDrawer';
import { EvmReport } from './EvmReport';
import { MaterialDashboard } from './MaterialDashboard';
import { MaterialEditorModal } from './MaterialEditorModal';
import { ActualsEditorModal } from './ActualsEditorModal';
import { ChangeLogEditorModal } from './ChangeLogEditorModal';
import { MaterialAllocationModal } from './MaterialAllocationModal';
import { NotificationPanel } from './NotificationPanel';
import { NewProjectDialog } from './NewProjectDialog';
import { CapitalizationConfigModal } from './CapitalizationConfigModal';
import type { CapitalizationConfig } from '../types';
import type { TaskNotification } from './dependencyWorkflows';
import { generateStatusNotifications } from './dependencyWorkflows';
import type { ActualSpendEntry, MaterialAllocation, MaterialConsumption, ChangeLogEntry } from '../types';
import { sheetToProject, projectModelToProject } from './sheetToProject';
import { projectToModel, createBlankProject, importProjectFromJSON } from './projectConverter';
import { addTask, removeTask, updateTask, toggleCollapsed, findTask, getAllTasks, addResource, updateResource, removeResource, syncResourceCosts, reorderTask } from './treeOps';
import { addRisk, updateRisk, removeRisk, getRiskSummary, linkRiskToTask, unlinkRiskFromTask } from './risks';
import { recomputeRollups } from './rollups';
import { autoScheduleSuccessors, updateTaskStatuses } from './dependencyWorkflows';
import { getCriticalPath } from './dependencies';
import { getEffectiveCurrency } from '../../utils/currency';
import { CountrySelector } from './CountrySelector';
import { ProjectAnalyzerPanel } from './analyzer';
import type { Project, ViewMode, WBSTask, Risk, Resource, TaskDependency } from '../types';
import type { Sheet, ColumnMapping, ProjectModel } from '../../types';

interface ProjectViewProps {
  project: Project;
  activeSheet: Sheet | null;
  columnMapping: ColumnMapping | null;
  onSaveProject: (model: ProjectModel, mapping: ColumnMapping | null, sheetId: string | null) => void;
  onProjectChange?: (project: Project) => void;
}

export function ProjectView({ project: initialProject, activeSheet, columnMapping, onSaveProject, onProjectChange }: ProjectViewProps) {
  const [project, setProject] = useState(initialProject);

  // ─── Sync internal state when the prop changes ─────────────────────
  // When the parent re-reads the workbook (e.g. onShowProjectView after
  // the user edits the Resources/Risks sheets), the new project object
  // is passed in as a prop.  useState only seeds the state on first
  // mount, so without this effect the internal state would stay stale.
  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  // ─── Sync to Sheet ──────────────────────────────────────────────────

  /**
   * Sync project data back to the source sheet.
   * Converts the project model to sheet cells and calls onSaveProject.
   */
  const syncProjectToSheet = useCallback((projectState: Project) => {
    const model = projectToModel(projectState);
    onSaveProject(model, columnMapping, activeSheet?.id ?? null);
  }, [onSaveProject, columnMapping, activeSheet]);

  // ─── State Update Handlers ─────────────────────────────────────────

  /**
   * For UI-only changes (no save, no parent notify).
   * Use for: collapse/expand, selection, zoom, etc.
   */
  function setProjectUI(updater: Project | ((prev: Project) => Project)) {
    setProject((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }

  /**
   * For data changes (save + parent notify).
   * Use for: add/edit/delete tasks, risks, resources, materials, etc.
   */
  const handleProjectChange = useCallback((updater: Project | ((prev: Project) => Project)) => {
    // Apply the updater to the current project to compute nextProject synchronously.
    // This avoids the stale-closure bug where nextProject was assigned inside the
    // setProject updater (which runs asynchronously) but used outside it.
    const nextProject = typeof updater === 'function' ? updater(project) : updater;
    setProject(nextProject);
    // Side effects outside the updater — React state updaters must be pure
    onProjectChange?.(nextProject);
    // Trigger save after state update
    syncProjectToSheet(nextProject);
  }, [onProjectChange, syncProjectToSheet, project]);

  const [viewMode, setViewMode] = useState<ViewMode>('gantt');
  const [zoom, setZoom] = useState<'day' | 'week' | 'month'>('week');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [showCalendarConfig, setShowCalendarConfig] = useState(false);

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

  const [resourceListOpen, setResourceListOpen] = useState(false);

  const [materialModal, setMaterialModal] = useState<{
    open: boolean;
    material: import('../types').Material | null;
  }>({ open: false, material: null });

  const [actualsModal, setActualsModal] = useState<{
    open: boolean;
    entry: ActualSpendEntry | null;
  }>({ open: false, entry: null });

  const [changeLogModalOpen, setChangeLogModalOpen] = useState(false);
  const [changeLogModalEntry, setChangeLogModalEntry] = useState<ChangeLogEntry | null>(null);

  const [allocationModal, setAllocationModal] = useState<{
    open: boolean;
    materialId: string | null;
  }>({ open: false, materialId: null });

  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [showCapitalizationConfig, setShowCapitalizationConfig] = useState(false);

  // New project dialog
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);

  // Import/Export
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save confirmation
  const [saveConfirmation, setSaveConfirmation] = useState(false);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const saveConfirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gantt chart scroll ref for calendar navigation
  const ganttContainerRef = useRef<HTMLDivElement>(null);

  // ─── View-state persistence ────────────────────────────────────────
  const viewStateKey = 'simplesheets:project-view-state';

  // Restore view state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(viewStateKey);
      if (stored) {
        const state = JSON.parse(stored);
        if (state.viewMode) setViewMode(state.viewMode);
        if (state.zoom) setZoom(state.zoom);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Persist view state to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(viewStateKey, JSON.stringify({ viewMode, zoom }));
    } catch {
      // Ignore quota errors
    }
  }, [viewMode, zoom]);

  // Derived values
  const riskSummary = useMemo(() => getRiskSummary(project), [project]);
  const taskCount = useMemo(() => getAllTasks(project.wbs).length, [project.wbs]);
  const allTasks = useMemo(() => getAllTasks(project.wbs), [project.wbs]);
  const criticalPath = useMemo(
    () => getCriticalPath(allTasks, project.calendar),
    [allTasks, project.calendar],
  );

  // ─── Notifications ─────────────────────────────────────────────────

  // Track previous task statuses to detect changes
  const prevTasksRef = useRef<WBSTask[]>(allTasks);

  useEffect(() => {
    const prevTasks = prevTasksRef.current;
    const newNotifications = generateStatusNotifications(prevTasks, allTasks, project.resources);
    if (newNotifications.length > 0) {
      setNotifications((prev) => [...prev, ...newNotifications]);
    }
    prevTasksRef.current = allTasks;
  }, [allTasks, project.resources]);

  function handleDismissNotification(index: number) {
    setNotifications((prev) => prev.filter((_, i) => i !== index));
  }

  function handleNotificationTaskClick(taskId: string) {
    setViewMode('gantt');
    setSelectedTaskId(taskId);
    // Clear notifications for this task
    setNotifications((prev) => prev.filter((n) => n.taskId !== taskId));
  }

  // ─── Task CRUD ────────────────────────────────────────────────────────

  function handleAddChild(parentId: string | null) {
    setTaskModal({ open: true, task: null, parentId, isChild: parentId !== null });
  }

  function handleEditTask(taskId: string) {
    const task = findTask(project.wbs, taskId);
    if (task) {
      setTaskModal({ open: true, task, parentId: task.parentId, isChild: false });
    }
  }

  function handleTaskSave(task: WBSTask) {
    handleProjectChange((prev) => {
      let next: Project;
      if (taskModal.task) {
        // Edit existing
        next = { ...prev, wbs: updateTask(prev.wbs, taskModal.task.id, () => task) };
      } else {
        // Add new
        next = { ...prev, wbs: addTask(prev.wbs, taskModal.parentId, task) };
      }
      // Recompute rollups for summary tasks
      next = { ...next, wbs: recomputeRollups(next.wbs, next.risks) };
      // Sync resource cost rates into task cost fields
      next = { ...next, wbs: syncResourceCosts(next.wbs, next.resources) };
      return next;
    });
    setTaskModal({ open: false, task: null, parentId: null, isChild: false });
  }

  function handleDeleteTask(taskId: string) {
    const task = findTask(project.wbs, taskId);
    if (!task) return;

    if (task.children.length > 0) {
      if (!window.confirm(`Delete "${task.name}" and its ${task.children.length} sub-task(s)?`)) {
        return;
      }
    }

    handleProjectChange((prev) => {
      const next = { ...prev, wbs: removeTask(prev.wbs, taskId) };
      // Recompute rollups for summary tasks
      const recomputed = { ...next, wbs: recomputeRollups(next.wbs, next.risks) };
      return recomputed;
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
    // UI-only change: collapse/expand does not need to persist to workbook
    setProjectUI((prev) => ({ ...prev, wbs: toggleCollapsed(prev.wbs, taskId) }));
  }

  function handleMoveTaskUp(taskId: string) {
    handleProjectChange((prev) => ({ ...prev, wbs: reorderTask(prev.wbs, taskId, 'up') }));
  }

  function handleMoveTaskDown(taskId: string) {
    handleProjectChange((prev) => ({ ...prev, wbs: reorderTask(prev.wbs, taskId, 'down') }));
  }

  // ─── Dependency Management ──────────────────────────────────────────

  const [dependencyDrawerOpen, setDependencyDrawerOpen] = useState(false);
  const [dependencyTaskId, setDependencyTaskId] = useState<string | null>(null);

  function handleOpenDependencyDrawer(taskId: string) {
    setDependencyTaskId(taskId);
    setDependencyDrawerOpen(true);
  }

  function handleCloseDependencyDrawer() {
    setDependencyDrawerOpen(false);
    setDependencyTaskId(null);
  }

  function handleSaveDependencies(taskId: string, dependencies: TaskDependency[]) {
    handleProjectChange((prev) => {
      // Update the task's dependencies in the tree
      let next = { ...prev, wbs: updateTask(prev.wbs, taskId, (t) => ({ ...t, dependencies })) };

      // Auto-schedule successors based on new dependencies
      const allTasks = getAllTasks(next.wbs);
      const rescheduled = autoScheduleSuccessors(allTasks, taskId, next.calendar);
      const rescheduleMap = new Map(rescheduled.map((t) => [t.id, t]));

      // Apply rescheduled dates back to tree
      next = {
        ...next,
        wbs: next.wbs.map((root) => applyRescheduleToTree(root, rescheduleMap)),
      };

      // Update task statuses based on new schedule
      const allTasksUpdated = getAllTasks(next.wbs);
      const statusUpdated = updateTaskStatuses(allTasksUpdated);
      const statusMap = new Map(statusUpdated.map((t) => [t.id, t]));
      next = {
        ...next,
        wbs: next.wbs.map((root) => applyStatusToTree(root, statusMap)),
      };

      // Recompute rollups for summary tasks
      next = { ...next, wbs: recomputeRollups(next.wbs, next.risks) };
      // Sync resource cost rates into task cost fields
      next = { ...next, wbs: syncResourceCosts(next.wbs, next.resources) };

      return next;
    });

    handleCloseDependencyDrawer();
  }

  // ─── Tree Helpers ────────────────────────────────────────────────

  /**
   * Apply rescheduled dates from a map to a task tree.
   */
  function applyRescheduleToTree(task: WBSTask, scheduleMap: Map<string, WBSTask>): WBSTask {
    const rescheduled = scheduleMap.get(task.id);
    const updated = rescheduled ? { ...task, startDate: rescheduled.startDate, endDate: rescheduled.endDate, duration: rescheduled.duration } : task;
    return { ...updated, children: updated.children.map((child) => applyRescheduleToTree(child, scheduleMap)) };
  }

  /**
   * Apply updated statuses from a map to a task tree.
   */
  function applyStatusToTree(task: WBSTask, statusMap: Map<string, WBSTask>): WBSTask {
    const updated = statusMap.get(task.id);
    const withStatus = updated ? { ...task, status: updated.status } : task;
    return { ...withStatus, children: withStatus.children.map((child) => applyStatusToTree(child, statusMap)) };
  }

  // ─── Gantt Calendar Navigation ─────────────────────────────────────

  /**
   * Scroll the Gantt chart to show a specific date.
   */
  function scrollGanttToDate(date: string) {
    if (!ganttContainerRef.current) return;
    const start = new Date(project.startDate + 'T00:00:00');
    const target = new Date(date + 'T00:00:00');
    const daysDiff = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const dayWidth = zoom === 'day' ? 40 : zoom === 'week' ? 14 : 4;
    const scrollX = Math.max(0, daysDiff * dayWidth - 160); // 160 = left margin
    ganttContainerRef.current.scrollTo({ left: scrollX, behavior: 'smooth' });
  }

  /**
   * Navigate Gantt view by period (prev/next month, week, etc.).
   */
  function navigateGantt(direction: 'prev' | 'next', period: 'month' | 'week') {
    if (!ganttContainerRef.current) return;
    const dayWidth = zoom === 'day' ? 40 : zoom === 'week' ? 14 : 4;
    const periodDays = period === 'month' ? 30 : 7;
    const scrollAmount = periodDays * dayWidth;
    const currentScroll = ganttContainerRef.current.scrollLeft;
    const newScroll = direction === 'prev'
      ? Math.max(0, currentScroll - scrollAmount)
      : currentScroll + scrollAmount;
    ganttContainerRef.current.scrollTo({ left: newScroll, behavior: 'smooth' });
  }

  /**
   * Jump Gantt view to today's date.
   */
  function jumpToToday() {
    const today = new Date().toISOString().slice(0, 10);
    scrollGanttToDate(today);
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
    handleProjectChange((prev) => {
      let next: Project;
      if (riskModal.risk) {
        // Edit existing - pass the full risk object as changes
        next = updateRisk(prev, riskModal.risk.id, risk);
        // Sync task.riskIds if the linked task changed
        const oldTaskId = riskModal.risk.taskId;
        const newTaskId = risk.taskId;
        if (oldTaskId !== newTaskId) {
          if (oldTaskId) next = unlinkRiskFromTask(next, risk.id);
          if (newTaskId) next = linkRiskToTask(next, risk.id, newTaskId);
        }
      } else {
        // Add new
        const newRisk = { ...risk, projectId: prev.id };
        next = addRisk(prev, newRisk);
        // Link to task if specified
        if (newRisk.taskId) {
          next = linkRiskToTask(next, newRisk.id, newRisk.taskId);
        }
      }
      return next;
    });
    setRiskModal({ open: false, risk: null });
  }

  function handleRiskDelete(riskId: string) {
    handleProjectChange((prev) => {
      const next = removeRisk(prev, riskId);
      return next;
    });
    if (selectedRiskId === riskId) setSelectedRiskId(null);
  }

  const handleRiskClose = useCallback((riskId: string) => {
    handleProjectChange((prev) => {
      const next = {
        ...prev,
        risks: prev.risks.map((r) =>
          r.id === riskId ? { ...r, status: 'closed' as const } : r,
        ),
      };
      return next;
    });
  }, [handleProjectChange]);

  // ─── Resource CRUD ───────────────────────────────────────────────────

  function handleResourceSave(resource: Resource) {
    handleProjectChange((prev) => {
      let next: Project;
      if (resourceModal.resource) {
        // Edit existing
        next = { ...prev, resources: updateResource(prev.resources, resourceModal.resource.id, resource) };
      } else {
        // Add new
        next = { ...prev, resources: addResource(prev.resources, resource) };
      }
      return next;
    });
    setResourceModal({ open: false, resource: null });
  }

  function handleResourceDelete(resourceId: string) {
    handleProjectChange((prev) => {
      const next = { ...prev, resources: removeResource(prev.resources, resourceId) };
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

    handleProjectChange(newProject);
    setShowColumnMapping(false);
    setViewMode('gantt');

    // Save extension data to workbook
    onSaveProject(model, mapping, activeSheet.id);
  }

  function handleColumnMappingCancel() {
    setShowColumnMapping(false);
  }

  // ─── Calendar Configuration ─────────────────────────────────────────

  function handleCalendarSave(calendar: import('../types').WorkingCalendar) {
    handleProjectChange((prev) => ({ ...prev, calendar }));
    setShowCalendarConfig(false);
  }

  // ─── Material CRUD ──────────────────────────────────────────────────

  function handleAddMaterial() {
    setMaterialModal({ open: true, material: null });
  }

  function handleEditMaterial(materialId: string) {
    const material = project.materials?.find((m) => m.id === materialId);
    if (material) {
      setMaterialModal({ open: true, material });
    }
  }

  function handleMaterialSave(material: import('../types').Material) {
    handleProjectChange((prev) => {
      const materials = prev.materials ?? [];
      const existingIndex = materials.findIndex((m) => m.id === material.id);
      if (existingIndex >= 0) {
        // Update existing
        const updated = [...materials];
        updated[existingIndex] = material;
        return { ...prev, materials: updated };
      }
      // Add new
      return { ...prev, materials: [...materials, material] };
    });
    setMaterialModal({ open: false, material: null });
  }

  function handleMaterialDelete(materialId: string) {
    handleProjectChange((prev) => ({
      ...prev,
      materials: (prev.materials ?? []).filter((m) => m.id !== materialId),
    }));
    setMaterialModal({ open: false, material: null });
  }

  // ─── Actuals CRUD ──────────────────────────────────────────────────

  function handleOpenActualsModal(entry: ActualSpendEntry | null) {
    setActualsModal({ open: true, entry });
  }

  function handleCloseActualsModal() {
    setActualsModal({ open: false, entry: null });
  }

  function handleActualsSave(entry: ActualSpendEntry) {
    handleProjectChange((prev) => {
      const accounting = prev.accounting ?? {
        baselineTotal: 0,
        allocatedTotal: 0,
        currentEstimateTotal: 0,
        actualSpendTotal: 0,
        etcTotal: 0,
        materialCostTotal: 0,
        taskAccounting: [],
        spendEntries: [],
        changeLog: [],
        currency: getEffectiveCurrency(),
      };
      const existingIndex = accounting.spendEntries.findIndex((e) => e.id === entry.id);
      const updatedEntries = existingIndex >= 0
        ? accounting.spendEntries.map((e) => (e.id === entry.id ? entry : e))
        : [...accounting.spendEntries, entry];
      return {
        ...prev,
        accounting: {
          ...accounting,
          spendEntries: updatedEntries,
          actualSpendTotal: updatedEntries.reduce((sum, e) => sum + e.amount, 0),
        },
      };
    });
    setActualsModal({ open: false, entry: null });
  }

  function handleActualsDelete(entryId: string) {
    handleProjectChange((prev) => {
      const accounting = prev.accounting;
      if (!accounting) return prev;
      const updatedEntries = accounting.spendEntries.filter((e) => e.id !== entryId);
      return {
        ...prev,
        accounting: {
          ...accounting,
          spendEntries: updatedEntries,
          actualSpendTotal: updatedEntries.reduce((sum, e) => sum + e.amount, 0),
        },
      };
    });
    setActualsModal({ open: false, entry: null });
  }

  // ─── Change Log ──────────────────────────────────────────────────

  function handleChangeLogSave(entry: ChangeLogEntry) {
    handleProjectChange((prev) => {
      const accounting = prev.accounting;
      if (!accounting) return prev;
      const existing = accounting.changeLog.findIndex((e) => e.id === entry.id);
      let updatedEntries: ChangeLogEntry[];
      if (existing >= 0) {
        updatedEntries = [...accounting.changeLog];
        updatedEntries[existing] = entry;
      } else {
        updatedEntries = [...accounting.changeLog, entry];
      }
      return {
        ...prev,
        accounting: {
          ...accounting,
          changeLog: updatedEntries,
        },
      };
    });
    setChangeLogModalOpen(false);
    setChangeLogModalEntry(null);
  }

  function handleChangeLogDelete(entryId: string) {
    handleProjectChange((prev) => {
      const accounting = prev.accounting;
      if (!accounting) return prev;
      const updatedEntries = accounting.changeLog.filter((e) => e.id !== entryId);
      return {
        ...prev,
        accounting: {
          ...accounting,
          changeLog: updatedEntries,
        },
      };
    });
    setChangeLogModalOpen(false);
    setChangeLogModalEntry(null);
  }

  // ─── Material Allocation ────────────────────────────────────────────

  function handleOpenAllocationModal(materialId: string | null) {
    setAllocationModal({ open: true, materialId });
  }

  function handleCloseAllocationModal() {
    setAllocationModal({ open: false, materialId: null });
  }

  function handleAllocationSave(allocation: MaterialAllocation) {
    handleProjectChange((prev) => ({
      ...prev,
      materialAllocations: [
        ...(prev.materialAllocations ?? []),
        allocation,
      ],
    }));
    setAllocationModal({ open: false, materialId: null });
  }

  function handleConsumptionSave(consumption: MaterialConsumption) {
    handleProjectChange((prev) => ({
      ...prev,
      materialConsumptions: [
        ...(prev.materialConsumptions ?? []),
        consumption,
      ],
      // Update the matching allocation's consumedQuantity so the
      // allocation table reflects what has been used.
      materialAllocations: (prev.materialAllocations ?? []).map((a) =>
        a.materialId === consumption.materialId && a.taskId === consumption.taskId
          ? { ...a, consumedQuantity: a.consumedQuantity + consumption.quantity }
          : a,
      ),
    }));
    setAllocationModal({ open: false, materialId: null });
  }

  // ─── Capitalization Config ─────────────────────────────────────────

  function handleOpenCapitalizationConfig() {
    setShowCapitalizationConfig(true);
  }

  function handleCloseCapitalizationConfig() {
    setShowCapitalizationConfig(false);
  }

  function handleCapitalizationConfigSave(config: CapitalizationConfig) {
    handleProjectChange((prev) => ({
      ...prev,
      capitalizationConfig: config,
    }));
    setShowCapitalizationConfig(false);
  }

  function handleSaveToSheet() {
    // Save current project state back to workbook (uses same sync as automatic saves)
    syncProjectToSheet(project);
    // Show transient confirmation
    setSaveConfirmation(true);
    if (saveConfirmationTimer.current) clearTimeout(saveConfirmationTimer.current);
    saveConfirmationTimer.current = setTimeout(() => setSaveConfirmation(false), 2000);
  }

  // ─── New Project ──────────────────────────────────────────────────────

  function handleOpenNewProjectDialog() {
    setShowNewProjectDialog(true);
  }

  function handleCloseNewProjectDialog() {
    setShowNewProjectDialog(false);
  }

  function handleNewProjectConfirm(name: string, startDate: string, endDate: string) {
    const newProject = createBlankProject(name, startDate, endDate);
    handleProjectChange(() => newProject);
    setShowNewProjectDialog(false);
  }

  // ─── Import ──────────────────────────────────────────────────────────

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const importedProject = importProjectFromJSON(content);
        handleProjectChange(() => importedProject);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        window.alert(`Failed to import project: ${message}`);
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-imported
    e.target.value = '';
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

          {/* New Project button */}
          <button
            className="ml-2 px-3 py-1 text-sm text-green-600 border border-green-300 rounded hover:bg-green-50"
            onClick={handleOpenNewProjectDialog}
            title="Create a new blank project"
            data-testid="new-project-btn"
          >
            + New Project
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded border border-gray-200 overflow-hidden">
            {(['gantt', 'risk-register', 'risk-matrix', 'resource-heatmap', 'materials', 'accounting', 'evm-report'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                className={`px-3 py-1 text-sm ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setViewMode(mode)}
              >
                {mode === 'gantt' ? 'Gantt' : mode === 'risk-register' ? 'Risk Register' : mode === 'risk-matrix' ? 'Risk Matrix' : mode === 'resource-heatmap' ? 'Resources' : mode === 'materials' ? 'Materials' : mode === 'accounting' ? 'Accounting' : 'EVM Report'}
              </button>
            ))}
          </div>

          {/* Country / Currency selector */}
          <CountrySelector
            onCountryChange={(_countryCode, currency) => {
              // Update project currency to match selected country
              handleProjectChange((prev) => ({
                ...prev,
                accounting: { ...prev.accounting, currency } as Project['accounting'],
                capitalizationConfig: prev.capitalizationConfig
                  ? { ...prev.capitalizationConfig, currency }
                  : prev.capitalizationConfig,
              }));
            }}
          />

          {/* Calendar + Zoom dropdown (only for Gantt) */}
          {viewMode === 'gantt' && (
            <ToolbarDropdown label="📅 Calendar">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">
                Navigation
              </div>
              <button
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 flex items-center gap-2"
                onClick={() => navigateGantt('prev', 'month')}
                data-testid="gantt-nav-prev-month"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><polygon points="6,1 2,5 6,9" /><polygon points="9,1 5,5 9,9" /></svg>
                Previous Month
              </button>
              <button
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 flex items-center gap-2"
                onClick={() => navigateGantt('prev', 'week')}
                data-testid="gantt-nav-prev-week"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><polygon points="8,1 3,5 8,9" /></svg>
                Previous Week
              </button>
              <button
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 font-medium text-blue-700"
                onClick={jumpToToday}
                data-testid="gantt-nav-today"
              >
                Jump to Today
              </button>
              <button
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 flex items-center gap-2"
                onClick={() => navigateGantt('next', 'week')}
                data-testid="gantt-nav-next-week"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><polygon points="2,1 7,5 2,9" /></svg>
                Next Week
              </button>
              <button
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 flex items-center gap-2"
                onClick={() => navigateGantt('next', 'month')}
                data-testid="gantt-nav-next-month"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><polygon points="1,1 5,5 1,9" /><polygon points="4,1 8,5 4,9" /></svg>
                Next Month
              </button>
              <div className="border-t border-gray-100 mt-1 pt-1">
                <div className="px-3 py-1 text-xs font-medium text-gray-500">
                  Zoom
                </div>
                {(['day', 'week', 'month'] as const).map((z) => (
                  <button
                    key={z}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 ${
                      zoom === z ? 'font-medium text-blue-700' : ''
                    }`}
                    onClick={() => setZoom(z)}
                  >
                    {z.charAt(0).toUpperCase() + z.slice(1)}
                    {zoom === z && <span className="ml-1">✓</span>}
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50"
                  onClick={() => setShowCalendarConfig(true)}
                >
                  ⚙️ Calendar Settings
                </button>
              </div>
            </ToolbarDropdown>
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
              onClick={() => setResourceListOpen(true)}
              title="Manage project resources"
            >
              👥 Resources ({project.resources.length})
            </button>
          )}

          {/* Project Analyzer button */}
          <button
            className="ml-2 px-3 py-1 text-sm text-indigo-600 border border-indigo-300 rounded hover:bg-indigo-50"
            onClick={() => setShowAnalyzer(true)}
            title="Analyze project health and get recommendations"
          >
            🔍 Analyze
          </button>

          {/* Project I/O dropdown */}
          <ToolbarDropdown label="Project">
            {activeSheet && (
              <button
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50"
                onClick={handleConvertSheet}
              >
                ↑ Convert Sheet to Project
              </button>
            )}
            <button
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50"
              onClick={handleSaveToSheet}
            >
              ↓ Save to Workbook
            </button>
          </ToolbarDropdown>

          {/* Save confirmation (positioned relative to File dropdown) */}
          {saveConfirmation && (
            <span
              className="text-xs text-green-600"
              data-testid="save-confirmation"
            >
              Saved!
            </span>
          )}

        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Notification Panel (overlay) */}
        <NotificationPanel
          notifications={notifications}
          onDismiss={handleDismissNotification}
          onTaskClick={handleNotificationTaskClick}
        />

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
            onOpenDependencies={handleOpenDependencyDrawer}
            onTaskStatusChange={(taskId, status) => {
              handleProjectChange((prev) => ({
                ...prev,
                wbs: updateTask(prev.wbs, taskId, (t) => ({ ...t, status })),
              }));
            }}
            onMoveTaskUp={handleMoveTaskUp}
            onMoveTaskDown={handleMoveTaskDown}
          />
        )}

        {/* Dependency Drawer (between tree and main content) */}
        {viewMode === 'gantt' && dependencyDrawerOpen && dependencyTaskId && (() => {
          const depTask = findTask(project.wbs, dependencyTaskId);
          if (!depTask) return null;
          return (
            <DependencyDrawer
              task={depTask}
              allTasks={allTasks}
              resources={project.resources}
              isOpen={dependencyDrawerOpen}
              onClose={handleCloseDependencyDrawer}
              onSaveDependencies={handleSaveDependencies}
            />
          );
        })()}

        {/* Main content */}
        <div className="flex-1 overflow-auto p-4">
          {viewMode === 'gantt' && (
            <GanttChart
              project={project}
              zoom={zoom}
              selectedTaskId={selectedTaskId}
              criticalPath={criticalPath}
              onTaskSelect={setSelectedTaskId}
              onTaskDoubleClick={handleEditTask}
              onTaskToggleCollapse={handleToggleCollapse}
              showCriticalPath
              showProgress
              showRiskHeatmap={false}
              showTodayMarker
              showDependencies
              containerRef={ganttContainerRef}
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
          {viewMode === 'resource-heatmap' && (
            <ResourceHeatmap
              project={project}
              onResourceClick={(resourceId) => {
                const resource = project.resources.find((r) => r.id === resourceId);
                if (resource) {
                  setResourceModal({ open: true, resource });
                }
              }}
            />
          )}
          {viewMode === 'accounting' && (
            <AccountingDashboard
              project={project}
              onEditSpend={(entryId) => {
                if (entryId) {
                  const entry = project.accounting?.spendEntries.find((e) => e.id === entryId);
                  if (entry) {
                    handleOpenActualsModal(entry);
                    return;
                  }
                }
                // Empty entryId = create new entry
                handleOpenActualsModal(null);
              }}
              onDeleteSpend={(entryId) => {
                handleActualsDelete(entryId);
              }}
              onTaskClick={(taskId) => {
                setViewMode('gantt');
                setSelectedTaskId(taskId);
              }}
              onEditAllocation={(taskId) => {
                // TODO: Open allocation editor modal
                console.log('Edit allocation for task:', taskId);
              }}
              onAddChange={() => {
                setChangeLogModalEntry(null);
                setChangeLogModalOpen(true);
              }}
              onEditChange={(entryId) => {
                const entry = project.accounting?.changeLog.find((e) => e.id === entryId);
                if (entry) {
                  setChangeLogModalEntry(entry);
                  setChangeLogModalOpen(true);
                }
              }}
              onDeleteChange={(entryId) => {
                handleChangeLogDelete(entryId);
              }}
              onBaselineChange={(updatedProject) => {
                handleProjectChange(() => updatedProject);
              }}
            />
          )}
          {viewMode === 'evm-report' && (
            <EvmReport project={project} />
          )}
          {viewMode === 'materials' && (
            <MaterialDashboard
              project={project}
              onAddMaterial={handleAddMaterial}
              onEditMaterial={handleEditMaterial}
              onDeleteMaterial={handleMaterialDelete}
              onAllocateMaterial={handleOpenAllocationModal}
              onRecordConsumption={(materialId) => {
                handleOpenAllocationModal(materialId);
              }}
              onConfig={handleOpenCapitalizationConfig}
            />
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
          allTasks={allTasks}
          onClose={() => setRiskModal({ open: false, risk: null })}
          onSave={handleRiskSave}
          onDelete={riskModal.risk ? () => handleRiskDelete(riskModal.risk!.id) : undefined}
        />
      )}

      {/* Resource List Modal */}
      {resourceListOpen && (
        <ResourceListModal
          resources={project.resources}
          onClose={() => setResourceListOpen(false)}
          onSave={handleResourceSave}
          onDelete={handleResourceDelete}
        />
      )}

      {/* Resource Editor Modal (for backward compatibility) */}
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

      {/* Calendar Configuration Modal */}
      {showCalendarConfig && (
        <CalendarConfigModal
          calendar={project.calendar}
          onClose={() => setShowCalendarConfig(false)}
          onSave={handleCalendarSave}
        />
      )}

      {/* Material Editor Modal */}
      {materialModal.open && (
        <MaterialEditorModal
          material={materialModal.material}
          onClose={() => setMaterialModal({ open: false, material: null })}
          onSave={handleMaterialSave}
          onDelete={materialModal.material ? () => handleMaterialDelete(materialModal.material!.id) : undefined}
        />
      )}

      {/* Actuals Editor Modal */}
      {actualsModal.open && (
        <ActualsEditorModal
          entry={actualsModal.entry}
          tasks={allTasks}
          defaultCurrency={project.accounting?.currency ?? getEffectiveCurrency()}
          onClose={handleCloseActualsModal}
          onSave={handleActualsSave}
          onDelete={actualsModal.entry ? () => handleActualsDelete(actualsModal.entry!.id) : undefined}
        />
      )}

      {/* Change Log Editor Modal */}
      {changeLogModalOpen && (
        <ChangeLogEditorModal
          entry={changeLogModalEntry}
          tasks={allTasks}
          onClose={() => {
            setChangeLogModalOpen(false);
            setChangeLogModalEntry(null);
          }}
          onSave={handleChangeLogSave}
          onDelete={changeLogModalEntry ? () => handleChangeLogDelete(changeLogModalEntry!.id) : undefined}
        />
      )}

      {/* Material Allocation Modal */}
      {allocationModal.open && allocationModal.materialId && (() => {
        const material = project.materials?.find((m) => m.id === allocationModal.materialId);
        if (!material) return null;
        return (
          <MaterialAllocationModal
            material={material}
            tasks={allTasks}
            allocations={project.materialAllocations ?? []}
            consumptions={project.materialConsumptions ?? []}
            onClose={handleCloseAllocationModal}
            onAllocate={handleAllocationSave}
            onRecordConsumption={handleConsumptionSave}
          />
        );
      })()}

      {/* Capitalization Config Modal */}
      {showCapitalizationConfig && (
        <CapitalizationConfigModal
          config={project.capitalizationConfig ?? {
            threshold: 1000,
            currency: getEffectiveCurrency(),
            defaultUsefulLifeMonths: 36,
            defaultDepreciationMethod: 'straight-line',
            defaultSalvagePercent: 10,
          }}
          onClose={handleCloseCapitalizationConfig}
          onSave={handleCapitalizationConfigSave}
        />
      )}

      {/* Project Analyzer Panel */}
      {showAnalyzer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
            <ProjectAnalyzerPanel
              project={project}
              onClose={() => setShowAnalyzer(false)}
            />
          </div>
        </div>
      )}

      {/* New Project Dialog */}
      {showNewProjectDialog && (
        <NewProjectDialog
          onClose={handleCloseNewProjectDialog}
          onConfirm={handleNewProjectConfirm}
        />
      )}

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />
    </div>
  );
}
