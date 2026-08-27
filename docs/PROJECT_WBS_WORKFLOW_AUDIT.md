# Project/WBS Extension — Comprehensive Workflow Audit

**Date:** 2026-08-27
**Scope:** Complete walkthrough of all views, dashboards, sheets, and data flows
**Baseline:** 746 tests across 31 suites (all passing)

---

## Executive Summary

The Project/WBS extension has grown into a feature-rich project management system with 7 dashboards, 12+ modals, and full CRUD for 6 entity types. This audit identifies **18 issues** across 5 categories that represent missing workflow chains, incomplete UI, and UX improvement opportunities.

**Key Finding:** The extension has strong individual features but several workflow chains are incomplete — users can create entities but cannot always manage them end-to-end from the views. The toolbar is overcrowded, and several views lack grouping/expand-collapse patterns that would improve usability.

---

## Architecture Recap

```
Sheets (Project Plan, Risks, Resources, Materials, Actuals)
  ↓ workbookToProject()
ProjectModel (serializable rows)
  ↓ projectModelToProject()
Project (runtime: WBSTask tree, Risk[], Resource[], Material[], ProjectAccounting)
  ↓ Views read from Project
Gantt / Risk Register / Risk Matrix / Resources / Materials / Accounting / EVM
  ↓ CRUD via Modals → projectToModel() → persisted to workbook extensions
```

---

## Current View Inventory

| View | Component | Status | Key Features |
|------|-----------|--------|--------------|
| **Gantt** | `GanttChart.tsx` | ✅ Complete | Timeline, bars, milestones, dependencies, critical path, today marker, zoom |
| **WBS Tree** | `WBSTreePanel.tsx` | ✅ Complete | Hierarchical tree, expand/collapse, inline add/edit/delete |
| **Risk Register** | `RiskRegister.tsx` | ✅ Complete | Sortable/filterable table, status/category filters |
| **Risk Matrix** | `RiskMatrix.tsx` | ✅ Complete | 5×5 grid, risk bubbles, key panel |
| **Resource Heatmap** | `ResourceHeatmap.tsx` | ⚠️ Basic | Calendar view, allocation colors, but no task interaction |
| **Materials** | `MaterialDashboard.tsx` | ⚠️ Basic | Registry, classification filter, but no consumption tracking UI |
| **Accounting** | `AccountingDashboard.tsx` | ⚠️ Basic | 5 tabs, KPIs, but no task-level drill-down |
| **EVM Report** | `EvmReport.tsx` | ⚠️ Basic | Metric cards, report registry, but no trend/history |

---

## Current Modal Inventory

| Modal | Entity | Status | Notes |
|-------|--------|--------|-------|
| `TaskEditorModal` | Task | ✅ Complete | All fields, dependencies, resources |
| `RiskEditorModal` | Risk | ✅ Complete | All fields, linked task dropdown |
| `ResourceEditorModal` | Resource | ✅ Complete | All fields |
| `ResourceListModal` | Resource | ✅ Complete | Table view with inline editor |
| `MaterialEditorModal` | Material | ✅ Complete | All fields, classification-specific |
| `ActualsEditorModal` | Actual Spend | ✅ Complete | All fields |
| `MaterialAllocationModal` | Allocation/Consumption | ✅ Complete | Allocate + consume tabs |
| `ColumnMappingDialog` | Sheet Conversion | ✅ Complete | Auto-detect + manual adjust |
| `CalendarConfigModal` | Calendar | ✅ Complete | Working days, holidays, presets |
| `CapitalizationConfigModal` | Config | ✅ Complete | Threshold, depreciation, salvage |
| `NewProjectDialog` | Project | ✅ Complete | Name + dates |
| `DependencyDrawer` | Dependencies | ✅ Complete | Add/edit/remove with impact preview |
| `NotificationPanel` | Notifications | ✅ Complete | Overlay with dismiss/task-click |

---

## Issue Categories

### A. Missing Workflow Chains (6 issues)
Features where users can create entities but cannot fully manage them end-to-end.

### B. Incomplete UI / Missing Interactions (5 issues)
Views that display data but lack expected interactions or drill-down.

### C. Toolbar & Navigation Issues (3 issues)
Overcrowded toolbar, missing view organization, no quick-actions.

### D. Grouping / Expand-Collapse / Filter Gaps (2 issues)
Views that would benefit from hierarchical grouping or collapsible sections.

### D. Data Flow Gaps (2 issues)
Missing sync between views and sheets for certain entity types.

---

## A. Missing Workflow Chains

### A1. No Edit/Delete for Materials from Dashboard
**Severity:** 🔴 High
**Location:** `MaterialDashboard.tsx`

**Problem:** The Materials dashboard displays materials but has no Edit or Delete button per row. Users can add materials via `onAddMaterial` but cannot edit or delete them from the view. The `onEditMaterial` and `onDeleteMaterial` handlers exist in `ProjectView` but are never passed to `MaterialDashboard`.

**Expected:** Each material row should have Edit and Delete buttons, matching the pattern used in Risk Register and Resource List.

**Fix:** Add `onEditMaterial` and `onDeleteMaterial` props to `MaterialDashboard` and wire per-row action buttons.

---

### A2. No Edit/Delete for Actual Spend from Accounting
**Severity:** 🔴 High
**Location:** `AccountingDashboard.tsx`, `ProjectView.tsx`

**Problem:** The Accounting dashboard's "Actuals" tab displays spend entries but has no Edit or Delete button per row. The `onEditSpend` callback opens the modal for the *task* (pre-filling a new entry for that task) but never allows editing/deleting *existing* entries directly from the table.

**Expected:** Each actual spend row should have Edit and Delete buttons that open `ActualsEditorModal` with the entry data.

**Fix:** Add per-row Edit/Delete to the Actuals tab, wired to `handleOpenActualsModal(entry)` and `handleActualsDelete(entry.id)`.

---

### A3. No Edit/Delete for Resources from Heatmap
**Severity:** 🟡 Medium
**Location:** `ResourceHeatmap.tsx`

**Problem:** The Resource Heatmap shows allocation but provides no way to edit or delete resources. Users must switch to Gantt → 👥 Resources button → Resource List Modal to manage resources.

**Expected:** Clicking a resource name in the heatmap should open `ResourceEditorModal`, or at minimum a context menu with Edit/Delete.

**Fix:** Add resource name click handler and context menu to heatmap rows.

---

### A4. No Task Status Management from Gantt/WBS
**Severity:** 🟡 Medium
**Location:** `GanttChart.tsx`, `WBSTreePanel.tsx`

**Problem:** Tasks have a `status` field (`not_started`, `waiting`, `ready`, `in_progress`, `done`, `on_hold`) but there is no UI to change it. The `dependencyWorkflows.ts` has `updateTaskStatuses()` for auto-updating based on dependencies, but manual status changes are only possible by editing the full task modal.

**Expected:** A status dropdown or cycle button on each task row in WBS and on Gantt bar hover/click.

**Fix:** Add inline status toggle to WBS tree rows and Gantt bar context menu.

---

### A5. No Change Log Entry Creation UI
**Severity:** 🟡 Medium
**Location:** `AccountingDashboard.tsx` (Change Log tab)

**Problem:** The `ChangeLogEntry` type exists and `AccountingDashboard` has a "Change Log" tab, but there is no UI to create or edit change log entries. The tab is always empty.

**Expected:** A "+ Add Change" button that opens a modal/drawer to record scope changes, dependency impacts, etc.

**Fix:** Add `ChangeLogEditorModal` and wire to the Change Log tab.

---

### A6. No Approval Gate Management UI
**Severity:** 🟢 Low
**Location:** `TaskEditorModal.tsx`

**Problem:** The `ApprovalGate` type exists in the schema with fields for gate type, approver, date, and notes. But there is no UI to add or manage approval gates for a task.

**Expected:** An "Approval Gates" section in TaskEditorModal with add/approve/reject actions.

**Fix:** Add approval gate editor to TaskEditorModal.

---

## B. Incomplete UI / Missing Interactions

### B1. Resource Heatmap Has No Task Interaction
**Severity:** 🔴 High
**Location:** `ResourceHeatmap.tsx`

**Problem:** The heatmap shows resource allocation as colored cells but:
- Clicking a cell does nothing
- No tooltip showing which tasks are assigned on that date
- No way to navigate to the task from the heatmap
- No legend explaining the color intensity

**Expected:** Clicking a cell shows a tooltip/popup with task names, and clicking a task navigates to it in Gantt view.

**Fix:** Add hover tooltips with task details and click-to-navigate.

---

### B2. Materials Dashboard Missing Consumption Tracking UI
**Severity:** 🟡 Medium
**Location:** `MaterialDashboard.tsx`

**Problem:** The dashboard shows materials with classification badges but:
- No consumption progress bar (consumed vs allocated)
- No wastage indicator
- No "Record Consumption" button per row
- The `onAllocateMaterial` callback opens the allocation modal but there's no per-row consumption action

**Expected:** Each material row should show consumption progress and have a "Record Consumption" button.

**Fix:** Add consumption progress bar and per-row action buttons.

---

### B3. Accounting Dashboard Missing Task Drill-Down
**Severity:** 🟡 Medium
**Location:** `AccountingDashboard.tsx`

**Problem:** The Accounting dashboard shows per-task cost tables but:
- Clicking a task name does nothing
- No way to see the actual spend entries that make up a task's cost
- No way to navigate to the task in Gantt view

**Expected:** Task names should be clickable, navigating to the task in Gantt view. A "View Entries" button should show the spend entries for that task.

**Fix:** Add task name click handler and spend entries drill-down.

---

### B4. EVM Report Missing Trend/History View
**Severity:** 🟡 Medium
**Location:** `EvmReport.tsx`

**Problem:** The EVM report shows a single point-in-time snapshot (asOfDate) but:
- No trend chart showing CPI/SPI over time
- No way to compare multiple dates
- No export/print for the report

**Expected:** A trend line chart showing CPI/SPI/EV over the project timeline, with date range selection.

**Fix:** Add trend chart component with date range picker.

---

### B5. Risk Register Missing Bulk Actions
**Severity:** 🟢 Low
**Location:** `RiskRegister.tsx`

**Problem:** Users can only edit/delete risks one at a time. No bulk actions for:
- Closing multiple risks
- Reassigning owner
- Changing status

**Expected:** Row checkboxes with bulk action toolbar.

**Fix:** Add selection checkboxes and bulk action dropdown.

---

## C. Toolbar & Navigation Issues

### C1. Toolbar Is Overcrowded
**Severity:** 🔴 High
**Location:** `ProjectView.tsx` (toolbar section)

**Problem:** The toolbar contains 10+ buttons and controls in a single row:
- View mode toggle (7 buttons)
- Zoom controls (3 buttons)
- Calendar navigation (5 buttons)
- Add Task / Add Risk button
- Resources button
- Calendar config button
- Convert Sheet button
- Save button
- Import JSON button
- Export JSON button
- Close button

This overflows on smaller screens and creates cognitive overload.

**Expected:** Group related actions into dropdown menus or collapsible sections. Use icon-only buttons with tooltips where possible.

**Fix:** 
- Group: View mode + Zoom into a "View" menu
- Group: Calendar nav + Calendar config into a "Calendar" menu  
- Group: Import + Export + Save into a "File" menu
- Keep only: Add Task, Resources, Close as primary buttons

---

### C2. No Quick-Actions / Context Menu
**Severity:** 🟡 Medium
**Location:** `GanttChart.tsx`, `WBSTreePanel.tsx`

**Problem:** Right-clicking on a task bar or tree node does nothing. Users must use the toolbar or inline buttons for all actions.

**Expected:** Right-click context menu with: Edit, Delete, Add Child, Add Dependency, Mark Complete, Status Change.

**Fix:** Add context menu component for Gantt bars and WBS tree nodes.

---

### C3. No View-State Persistence
**Severity:** 🟢 Low
**Location:** `ProjectView.tsx`

**Problem:** View mode, zoom level, and filter states are lost when switching views or closing/reopening the project.

**Expected:** Persist view preferences (view mode, zoom, filters) in project settings or localStorage.

**Fix:** Save view state to project settings or localStorage.

---

## D. Grouping / Expand-Collapse / Filter Gaps

### D1. Risk Register Lacks Grouping
**Severity:** 🟡 Medium
**Location:** `RiskRegister.tsx`

**Problem:** Risks are shown as a flat list. No way to group by:
- Category (Technical, Schedule, Cost...)
- Status (Identifying, Mitigating...)
- Level (Critical, High, Medium, Low)
- Linked Task

**Expected:** Collapsible group headers with counts, like the WBS tree pattern.

**Fix:** Add grouping selector with collapsible sections.

---

### D2. Accounting Dashboard Tabs Are Flat
**Severity:** 🟡 Medium
**Location:** `AccountingDashboard.tsx`

**Problem:** The 5 tabs (Baseline, Allocated, Estimate, Actuals, Change Log) are shown as equal-level tabs. The information hierarchy is flat — all tabs show similar table structures.

**Expected:** 
- Group cost tabs (Baseline, Allocated, Estimate) under a "Planning" section
- Group actuals tabs (Actuals, Change Log) under a "Execution" section
- Show summary KPIs at the top that persist across tabs
- Allow expand-collapse of task groups (summary tasks with children)

**Fix:** Restructure tabs into grouped sections with collapsible task groups.

---

## E. Data Flow Gaps

### E1. Risk→Task Link Not Reflected in Sheet
**Severity:** 🟡 Medium
**Location:** `sheetToProject.ts` (createRisksSheetFromModel)

**Problem:** When a risk is linked to a task (via `taskId`), this linkage is NOT written to the Risks sheet. The sheet has no "Linked Task" column. When the sheet is converted back to a project, the linkage is lost.

**Expected:** The Risks sheet should include a "Linked Task" column that stores the task name/ID, and the parser should read it back.

**Fix:** Add `taskId` column to Risks sheet layout and update `parseRiskRow`/`createRisksSheetFromModel`.

---

### E2. Material Allocation/Consumption Not Persisted to Sheet
**Severity:** 🟡 Medium
**Location:** `sheetToProject.ts`, `projectConverter.ts`

**Problem:** Material allocations and consumptions (`MaterialAllocation[]`, `MaterialConsumption[]`) are runtime-only. They are NOT included in `ProjectModel` and NOT written to any sheet. When the project is saved and reloaded, allocation/consumption data is lost.

**Expected:** Allocation and consumption data should be persisted to the Materials sheet or a separate Allocations sheet.

**Fix:** Add allocation/consumption columns to Materials sheet or create a dedicated sheet.

---

## Prioritization Matrix

| ID | Issue | Severity | Effort | Priority |
|----|-------|----------|--------|----------|
| A1 | No Edit/Delete for Materials | 🔴 High | Low | **P0** |
| A2 | No Edit/Delete for Actual Spend | 🔴 High | Low | **P0** |
| B1 | Heatmap No Task Interaction | 🔴 High | Medium | **P0** |
| C1 | Toolbar Overcrowded | 🔴 High | Medium | **P0** |
| A3 | No Edit/Delete Resources from Heatmap | 🟡 Medium | Low | **P1** |
| B2 | Materials Missing Consumption UI | 🟡 Medium | Medium | **P1** |
| B3 | Accounting Missing Task Drill-Down | 🟡 Medium | Low | **P1** |
| D1 | Risk Register Lacks Grouping | 🟡 Medium | Medium | **P1** |
| D2 | Accounting Tabs Are Flat | 🟡 Medium | Medium | **P1** |
| A4 | No Task Status Management | 🟡 Medium | Medium | **P1** |
| A5 | No Change Log Entry Creation | 🟡 Medium | Medium | **P2** |
| B4 | EVM Missing Trend View | 🟡 Medium | High | **P2** |
| C2 | No Context Menu | 🟡 Medium | Medium | **P2** |
| E1 | Risk→Task Link Not in Sheet | 🟡 Medium | Medium | **P2** |
| E2 | Allocation Not Persisted | 🟡 Medium | High | **P2** |
| A6 | No Approval Gate UI | 🟢 Low | Medium | **P3** |
| B5 | Risk Bulk Actions | 🟢 Low | Low | **P3** |
| C3 | No View-State Persistence | 🟢 Low | Low | **P3** |

---

## Recommended Implementation Plan

### Phase 1: Critical Workflow Completion (P0)
**Goal:** Complete the most critical missing workflows that block basic CRUD operations.

1. **A1:** Add Edit/Delete buttons to MaterialDashboard rows
2. **A2:** Add Edit/Delete buttons to Accounting Actuals tab rows
3. **B1:** Add task interaction (tooltips + click-to-navigate) to ResourceHeatmap
4. **C1:** Restructure toolbar into grouped menus

**Estimated:** 8-12 hours
**Tests:** +20 tests

### Phase 2: Interaction Improvements (P1)
**Goal:** Add missing interactions and improve information hierarchy.

5. **A3:** Add resource edit/delete from heatmap
6. **B2:** Add consumption tracking UI to Materials dashboard
7. **B3:** Add task drill-down to Accounting dashboard
8. **D1:** Add grouping to Risk Register
9. **D2:** Restructure Accounting tabs into grouped sections
10. **A4:** Add inline task status management

**Estimated:** 12-16 hours
**Tests:** +30 tests

### Phase 3: Advanced Features (P2)
**Goal:** Add advanced features and complete data flows.

11. **A5:** Add Change Log entry creation UI
12. **B4:** Add EVM trend chart
13. **C2:** Add context menu for Gantt/WBS
14. **E1:** Add Risk→Task link column to Risks sheet
15. **E2:** Persist allocations to sheet

**Estimated:** 16-20 hours
**Tests:** +25 tests

### Phase 4: Polish (P3)
**Goal:** Nice-to-have improvements.

16. **A6:** Add Approval Gate UI
17. **B5:** Add Risk bulk actions
18. **C3:** Add view-state persistence

**Estimated:** 6-8 hours
**Tests:** +10 tests

---

## Verification Strategy

For each fix:
1. Write failing tests first (TDD)
2. Implement the fix
3. Run targeted jest suite
4. Run full verification: `npm test && npm run lint && npm run type-check && npm run build`
5. Update coverage stats in `docs/PLAN.md`
6. Log in `docs/PROGRESS_LOG.md`

---

## Appendix: Entity CRUD Matrix (Current vs Target)

| Entity | Create | Read | Update | Delete | Sheet Edit | Status |
|--------|--------|------|--------|--------|------------|--------|
| **Task** | ✅ Modal | ✅ Gantt/Tree | ✅ Modal | ✅ Button | ✅ Cells | Complete |
| **Risk** | ✅ Modal | ✅ Register | ✅ Modal | ✅ Button | ✅ Cells | Complete |
| **Resource** | ✅ Modal | ✅ Heatmap/List | ✅ Modal | ✅ Button | ✅ Cells | Complete |
| **Material** | ✅ Modal | ✅ Dashboard | ❌ Missing | ❌ Missing | ✅ Cells | **Incomplete** |
| **Actual Spend** | ✅ Modal | ✅ Accounting | ❌ Missing | ❌ Missing | ✅ Cells | **Incomplete** |
| **Change Log** | ❌ Missing | ✅ Tab (empty) | ❌ Missing | ❌ Missing | ❌ Missing | **Missing** |
| **Allocation** | ✅ Modal | ✅ Materials | ❌ Missing | ❌ Missing | ❌ Missing | **Incomplete** |
| **Dependency** | ✅ Drawer | ✅ Gantt | ✅ Drawer | ✅ Drawer | ✅ Cells | Complete |
