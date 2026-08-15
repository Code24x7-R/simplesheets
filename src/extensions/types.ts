// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Extension Architecture — Core Types
 *
 * Defines the data model for the Extensions system, including:
 * - Extension interface contract (for building pluggable features)
 * - Project/WBS data model (tree-structured work breakdown)
 * - Risk management entities
 * - Gantt rendering configuration
 */

// ─── Extension Architecture ─────────────────────────────────────────────────

/**
 * Context passed to extensions on initialization.
 * Provides access to workbook state and extension APIs.
 */
export interface ExtensionContext {
  /** The current workbook (read-only reference). */
  getWorkbook: () => import('../types').Workbook;
  /** Read a named cell value from the active sheet. */
  getCellValue: (row: number, col: number) => string | number | null;
  /** Persist extension-specific settings. */
  saveSettings: (settings: Record<string, unknown>) => void;
  /** Load extension-specific settings. */
  loadSettings: () => Record<string, unknown>;
}

/**
 * A view that an extension can render.
 */
export interface ExtensionView {
  id: string;
  name: string;
  icon: import('react').ComponentType;
  component: import('react').ComponentType<{ data: unknown; context: ViewContext }>;
  position: 'panel' | 'overlay' | 'tab' | 'fullscreen';
}

/**
 * Context passed to extension view components.
 */
export interface ViewContext {
  onDataChange: (data: unknown) => void;
  onClose: () => void;
}

/**
 * A pre-built template that instantiates an extension's data model.
 */
export interface ExtensionTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail?: string;
  data: unknown;
}

/**
 * The contract that all extensions must implement.
 */
export interface SheetExtension {
  id: string;
  name: string;
  description: string;
  version: string;
  icon: import('react').ComponentType;
  category: 'project' | 'analysis' | 'visualization' | 'integration';

  initialize(context: ExtensionContext): void | Promise<void>;
  destroy(): void;
  getTaskModels(): TaskModelDefinition[];
  getViews(): ExtensionView[];
  getTemplates(): ExtensionTemplate[];
}

/**
 * Defines a data model that an extension provides.
 */
export interface TaskModelDefinition {
  id: string;
  name: string;
  description: string;
  fields: ModelField[];
}

export interface ModelField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select' | 'reference';
  required?: boolean;
  options?: string[];
  defaultValue?: unknown;
}

// ─── Project / WBS Data Model ───────────────────────────────────────────────

/**
 * Working calendar defines which days are working days.
 */
export interface WorkingCalendar {
  workingDays: Set<number>; // 0=Sun ... 6=Sat
  holidays: Set<string>;    // ISO date strings (YYYY-MM-DD)
  hoursPerDay: number;
}

/**
 * A resource assigned to project tasks.
 */
export interface Resource {
  id: string;
  name: string;
  role: string;
  costRate: number;
  costCurrency: string;
  availability: number; // 0-100 %
  color: string;
}

/**
 * Dependency relationship between two tasks.
 */
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface TaskDependency {
  predecessorId: string;
  type: DependencyType;
  lag: number; // working days (can be negative)
}

/**
 * Effort unit options.
 */
export type EffortUnit = 'hours' | 'storyPoints' | 'days';

/**
 * A single task in the Work Breakdown Structure.
 * Tasks form a tree via parentId/children relationships.
 */
export type TaskStatus = 'not_started' | 'waiting' | 'ready' | 'in_progress' | 'done' | 'on_hold';

export interface ApprovalGate {
  taskId: string;
  gateType: 'approval' | 'review' | 'sign_off' | 'external';
  approved: boolean;
  approvedBy: string | null;
  approvedDate: string | null;
  notes: string;
}

export interface WBSTask {
  id: string;
  name: string;
  description: string;
  level: number;            // Derived from tree depth
  parentId: string | null;
  children: WBSTask[];
  startDate: string;        // ISO date string
  endDate: string;          // ISO date string
  duration: number;         // Working days
  progress: number;         // 0-100 %
  effort: number;           // Estimated effort
  effortUnit: EffortUnit;
  cost: number;             // Allocated cost
  costCurrency: string;
  responsibleResourceId: string | null;
  dependencies: TaskDependency[];
  status?: TaskStatus;      // Current task state (optional for backward compat)
  approvalGates?: ApprovalGate[]; // Approval requirements
  float?: number;           // Total float (slack) in days
  isCritical?: boolean;     // Part of critical path
  isMilestone: boolean;
  isSummary: boolean;       // True if has children
  collapsed: boolean;       // UI state
  color: string;            // For Gantt bar
  riskIds: string[];        // Risks linked to this task
  customFields: Record<string, unknown>;
}

/**
 * A project containing WBS tasks, resources, and risks.
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string;        // ISO date string
  endDate: string;          // ISO date string
  calendar: WorkingCalendar;
  resources: Resource[];
  risks: Risk[];
  wbs: WBSTask[];           // Root-level tasks
}

// ─── Risk Management ────────────────────────────────────────────────────────

export type RiskCategory =
  | 'technical'
  | 'schedule'
  | 'cost'
  | 'resource'
  | 'external'
  | 'quality'
  | 'scope'
  | 'other';

export type RiskStatus =
  | 'identified'
  | 'assessing'
  | 'mitigating'
  | 'monitoring'
  | 'occurred'
  | 'closed';

/**
 * Risk level derived from risk score.
 */
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * A project risk with assessment and mitigation tracking.
 */
export interface Risk {
  id: string;
  projectId: string;
  taskId: string | null;    // Linked task (or project-level if null)
  title: string;
  description: string;
  category: RiskCategory;
  probability: number;      // 1-5 scale
  impact: number;           // 1-5 scale
  riskScore: number;        // probability × impact (1-25, derived)
  status: RiskStatus;
  mitigationPlan: string;
  contingencyPlan: string;
  mitigationCost: number;
  ownerId: string | null;   // Resource responsible
  identifiedDate: string;   // ISO date string
  reviewDate: string;       // ISO date string
  triggerCondition: string; // What would cause this risk to occur
  residualProbability: number; // 1-5, after mitigation
  residualImpact: number;      // 1-5, after mitigation
  residualRiskScore: number;   // derived
  customFields: Record<string, unknown>;
}

/**
 * Risk matrix cell (probability × impact grid).
 */
export interface RiskMatrixCell {
  probability: number;  // 1-5
  impact: number;       // 1-5
  riskIds: string[];    // Risks in this cell
  count: number;
  level: RiskLevel;
}

/**
 * Risk matrix (5×5 grid).
 */
export interface RiskMatrix {
  cells: RiskMatrixCell[][];
  maxScore: number;
  minScore: number;
}

/**
 * Risk summary statistics.
 */
export interface RiskSummary {
  total: number;
  byStatus: Record<RiskStatus, number>;
  byCategory: Record<RiskCategory, number>;
  byLevel: Record<RiskLevel, number>;
  totalMitigationCost: number;
  openCount: number;
}

// ─── Gantt Rendering ─────────────────────────────────────────────────────────

export type GanttZoom = 'day' | 'week' | 'month';

export type ViewMode = 'gantt' | 'wbs' | 'risk-register' | 'risk-matrix' | 'resource-heatmap';

/**
 * Gantt rendering configuration.
 */
export interface GanttConfig {
  zoom: GanttZoom;
  showCriticalPath: boolean;
  showProgress: boolean;
  showDependencies: boolean;
  showRiskHeatmap: boolean;
  showTodayMarker: boolean;
  barHeight: number;
  rowHeight: number;
  headerHeight: number;
  timelineDayWidth: number;
}

/**
 * Computed layout for a Gantt bar.
 */
export interface GanttBarLayout {
  taskId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  indent: number;
  color: string;
  progressWidth: number;
  isSummary: boolean;
  isMilestone: boolean;
  hasRisk: boolean;
  riskLevel: RiskLevel | null;
}
