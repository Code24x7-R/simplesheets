# Project/WBS Extension Audit Report

**Date:** 2026-01-16 (Updated: 2026-08-17)
**Scope:** Complete review of `src/extensions/project-wbs/`
**Current Test Count:** 3,577 tests across 149 suites

---

## Executive Summary

The Project/WBS extension has grown organically through 15+ phases. While functional, it had accumulated **duplications, logic errors, and workflow gaps** that needed systematic attention. This audit identified **12 issues** across 4 categories.

**Status:** ✅ All phases complete
- Phase 1 (Logic Errors): 3/3 fixed
- Phase 2 (Duplications): 3/3 fixed
- Phase 3 (Workflow Gaps): 4/4 fixed
- Phase 4 (Data Schema): 0/2 pending (low priority)

### 2026-08-17 Remediation (4 Phases)

A follow-up remediation effort addressed additional gaps identified during a full walkthrough:

- **Phase 1 (UI Wiring):** Wired `ActualsEditorModal`, `MaterialAllocationModal`, and `NotificationPanel` into `ProjectView`
- **Phase 2 (Critical Fixes):** Passed real critical path to GanttChart, fixed `onProjectChange` side-effect inside `setProject` updater, fixed `taskCount` to count deep descendants
- **Phase 3 (Dead Code Removal):** Deleted orphaned `useProject.ts` and `projectFormulas.ts`, removed duplicate `colToLetter`/`riskToRow`/`resourceToRow` definitions, removed `findTaskById`/`toggleCollapse` aliases
- **Phase 4 (Missing Workflows):** Added `NewProjectDialog` for blank project creation, wired `exportProjectToJSON`/`importProjectFromJSON` to toolbar buttons, clarified save button with transient "Saved!" confirmation

---

## Issue Categories

### A. Logic Errors (3 issues)
Issues that cause incorrect behavior or unnecessary processing.

### B. Duplications (3 issues)
Code that duplicates functionality existing elsewhere.

### C. Workflow Gaps (4 issues)
Missing features that prevent complete CRUD workflows.

### D. Data Schema Issues (2 issues)
Type definitions that don't match runtime behavior.

---

## A. Logic Errors

### A1. `syncProjectToSheet` called on EVERY state change
**Severity:** 🔴 High
**Location:** `ProjectView.tsx` lines 215-220, 405-417

**Problem:** The `handleProjectChange` wrapper calls `syncProjectToSheet` which calls `onSaveProject`. This happens for **every** state change including UI-only changes like `toggleCollapse`. This causes:
- Unnecessary workbook history entries
- Performance degradation
- Potential race conditions with rapid UI interactions

**Current Flow:**
```
toggleCollapse → handleProjectChange → syncProjectToSheet → onSaveProject → pushHistory
```

**Expected Flow:**
```
toggleCollapse → handleProjectChange (local state only, NO save)
data change → handleProjectChange → syncProjectToSheet → onSaveProject → pushHistory
```

**Fix:** Separate UI-only state updates from data mutations. Add a `persist` parameter or create separate handlers.

---

### A2. `handleProjectChange` notifies parent for UI-only changes
**Severity:** 🟡 Medium
**Location:** `ProjectView.tsx` lines 48-56

**Problem:** The `onProjectChange` callback is called for **every** state change, including UI-only changes like `toggleCollapse`. This causes the parent's `currentProject` to be updated unnecessarily.

**Fix:** Only call `onProjectChange` for data mutations, not UI state changes.

---

### A3. Template resource auto-assignment logic is flawed
**Severity:** 🟡 Medium
**Location:** `templates/handler.ts` lines 148-157

**Problem:** The condition `allTasks.some((t) => !t.responsibleResourceId)` is always true if ANY task lacks a resource, causing reassignment even when some tasks already have resources assigned. The filter `!t.isSummary && !t.isMilestone` is correct but the outer condition is redundant.

**Fix:** Simplify the condition to only check if there are tasks needing resources.

---

## B. Duplications

### B1. `projectToModel` logic duplicated
**Severity:** 🔴 High
**Location:** `ProjectView.tsx` lines 227-290 vs `sheetToProject.ts` lines 1649-1698

**Problem:** The `projectToModel` function in `ProjectView.tsx` converts a `Project` to `ProjectModel`. Similar logic exists in `createWorkbookFromTemplate` in `sheetToProject.ts`. Both should use a shared utility.

**Fix:** Extract `projectToModel` to a separate utility file and use it in both places.

---

### B2. `handleSaveToSheet` duplicates `syncProjectToSheet`
**Severity:** 🔴 High
**Location:** `ProjectView.tsx` lines 504-579 vs 215-220

**Problem:** The `handleSaveToSheet` function builds a `ProjectModel` from scratch and calls `onSaveProject`. But `syncProjectToSheet` already does the same thing. The "Save" button and the automatic sync are redundant.

**Fix:** Remove `handleSaveToSheet` and rely on automatic sync. Or make the Save button trigger a "force save" that updates the workbook sheets.

---

### B3. `createWorkbookFromTemplate` duplicates `projectModelToWorkbook` logic
**Severity:** 🟡 Medium
**Location:** `sheetToProject.ts` lines 1621-1718 vs 835-860

**Problem:** `createWorkbookFromTemplate` builds a `ProjectModel` and then calls `projectModelToWorkbook`. This is correct, but the model-building logic is verbose and could be simplified by using a shared `projectToModel` utility.

**Fix:** Use the shared `projectToModel` utility.

---

## C. Workflow Gaps

### C1. No import/export of project data as JSON files
**Severity:** 🔴 High
**Problem:** Currently only templates can be imported from JSON files. Users cannot:
- Save a project to a JSON file
- Load a project from a JSON file
- Share projects between workbooks

**Fix:** Add `exportProjectToJSON` and `importProjectFromJSON` functions.

---

### C2. No blank project creation
**Severity:** 🟡 Medium
**Problem:** Users can only create projects from templates or by converting a sheet. There's no way to create a blank project and add tasks manually.

**Fix:** Add a "Blank Project" option that creates an empty project with default calendar.

---

### C3. No UI for managing actuals
**Severity:** 🔴 High
**Problem:** Actual spend entries can only be managed by editing the Actuals sheet directly. There's no modal/UI for adding/editing/deleting actuals from the Project view.

**Fix:** Add an `ActualsEditorModal` and integrate with ProjectView.

---

### C4. No UI for material allocation/consumption
**Severity:** 🟡 Medium
**Problem:** Materials can be added/edited, but there's no UI for:
- Allocating materials to tasks
- Tracking consumption
- Recording wastage

**Fix:** Add allocation/consumption tracking to MaterialDashboard.

---

## D. Data Schema Issues

### D1. `ProjectModel.materials` and `ProjectModel.actuals` are required but often empty
**Severity:** 🟡 Medium
**Location:** `types.ts` lines 175-184

**Problem:** The `ProjectModel` interface requires `materials` and `actuals` as `MaterialRow[]` and `ActualRow[]`. But many code paths treat them as optional. This causes:
- TypeScript errors when they're not provided
- Inconsistent handling across the codebase

**Fix:** Make them optional with `?` and provide default empty arrays in conversion functions.

---

### D2. Sheet ID generation uses `Math.random()` for uniqueness
**Severity:** 🟢 Low
**Location:** `sheetToProject.ts` throughout

**Problem:** Sheet IDs use `Math.random().toString(36).slice(2, 8)` which is not guaranteed unique. Could cause collisions in large workbooks.

**Fix:** Use a counter or UUID generator.

---

## Completed Fixes

### Phase 1: Logic Errors ✅
1. **A1:** ✅ Separate UI-only state from data mutations - `setProjectUI` for UI changes, `handleProjectChange` for data
2. **A2:** ✅ `onProjectChange` only called for data mutations
3. **A3:** ✅ Simplified template resource auto-assignment condition

### Phase 2: Duplications ✅
4. **B1:** ✅ Extracted `projectToModel` to `projectConverter.ts`
5. **B2:** ✅ `handleSaveToSheet` delegates to `syncProjectToSheet`
6. **B3:** ✅ `createWorkbookFromTemplate` uses shared `projectToModel`

### Phase 3: Workflow Gaps ✅
7. **C1:** ✅ Added `exportProjectToJSON` and `importProjectFromJSON`
8. **C2:** ✅ Added `createBlankProject` utility
9. **C3:** ✅ Created `ActualsEditorModal` with full CRUD
10. **C4:** ✅ Created `MaterialAllocationModal` for allocation/consumption tracking

### Phase 4: Data Schema (Pending - Low Priority)
11. **D1:** ⏳ Make `ProjectModel.materials` and `ProjectModel.actuals` optional
12. **D2:** ⏳ Use UUID for sheet IDs

---

## 2026-08-17 Remediation (Complete)

A systematic 4-phase walkthrough remediation was performed to wire missing UI, fix critical bugs, remove dead code, and add missing workflows.

### Phase 1: UI Wiring ✅
1. **ActualsEditorModal** — Wired into `ProjectView` with state, handlers, and render; `onEditSpend` in `AccountingDashboard` now opens the modal pre-filled with task data
2. **MaterialAllocationModal** — Wired into `ProjectView`; "Allocate" button on `MaterialDashboard` rows opens the modal; handles both allocation and consumption recording
3. **NotificationPanel** — Wired into `ProjectView`; `generateStatusNotifications` detects task status changes and surfaces notifications; panel renders as overlay with dismiss/task-click actions

### Phase 2: Critical Fixes ✅
4. **GanttChart critical path** — Changed `criticalPath={[]}` (hardcoded empty) to `criticalPath={criticalPath}` using real `getCriticalPath(allTasks, project.calendar)` via `useMemo`
5. **`onProjectChange` anti-pattern** — Moved `onProjectChange?.(nextProject)` outside the `setProject` updater function (React state updaters must be pure)
6. **`taskCount` accuracy** — Changed from `project.wbs.reduce((sum, t) => sum + 1 + t.children.length, 0)` (shallow) to `getAllTasks(project.wbs).length` (deep descendants)

### Phase 3: Dead Code Removal & Deduplication ✅
7. **Deleted orphans** — Removed `useProject.ts` (+ test) and `projectFormulas.ts` (+ test) — never imported by any production code
8. **Removed unused functions** — Deleted `instantiateTemplateDependencies`, `getBlockedTasksWithReasons`, `getNextActionableTasks` from `dependencyWorkflows.ts` (tests only, no production callers)
9. **Deduplicated functions** — `colToLetter` (local → import), `riskToRow`/`resourceToRow` (consolidated to `projectConverter.ts`), `findTaskById`/`toggleCollapse` aliases (removed, callers use canonical names)

### Phase 4: Missing Workflows ✅
10. **New Project dialog** — Added `NewProjectDialog` with name + start/end date inputs; "+ New Project" button in toolbar; calls `createBlankProject`
11. **Import/Export JSON** — Added "Import JSON" / "Export JSON" toolbar buttons; export uses `exportProjectToJSON` + Blob download; import uses file input + `importProjectFromJSON` with error handling
12. **Clarified save** — Improved save button tooltip ("auto-saves on change, click to force-sync"); added transient "Saved!" confirmation (2s timeout)

---

## New Files Added

| File | Purpose | Tests |
|------|---------|-------|
| `src/extensions/project-wbs/projectConverter.ts` | Shared Project ↔ Model conversion | 41 |
| `src/extensions/project-wbs/ActualsEditorModal.tsx` | CRUD for actual spend entries | 14 |
| `src/extensions/project-wbs/MaterialAllocationModal.tsx` | Track material allocation/consumption | 12 |
| `src/extensions/project-wbs/NewProjectDialog.tsx` | Blank project creation dialog | 3 |

## Files Removed

| File | Reason |
|------|--------|
| `src/extensions/project-wbs/useProject.ts` | Orphaned React hook — never imported by any component |
| `src/extensions/project-wbs/useProject.test.ts` | Tests for orphaned hook |
| `src/extensions/project-wbs/projectFormulas.ts` | Formula engine — never imported by any component |
| `src/extensions/project-wbs/projectFormulas.test.ts` | Tests for unused formula engine |

## Deduplicated

| Before | After |
|--------|-------|
| `colToLetter` defined locally in `ColumnMappingDialog.tsx` | Now imports from `../../types` (canonical) |
| `riskToRow`/`resourceToRow` in both `projectConverter.ts` and `sheetToProject.ts` | Bodies in `projectConverter.ts`; `sheetToProject.ts` re-exports |
| `findTaskById` alias in `treeOps.ts` | Removed; callers use `findTask` |
| `toggleCollapse` alias in `treeOps.ts` | Removed; callers use `toggleCollapsed` |
| `TaskDependency` import in `dependencyWorkflows.ts` | Removed (only used by deleted `instantiateTemplateDependencies`) |

---

## Verification Strategy

For each fix:
1. Write failing tests first
2. Implement the fix
3. Run full verification: `npm test && npm run lint && npm run type-check && npm run build`
4. Update coverage stats in `docs/PLAN.md`
5. Log in `docs/PROGRESS_LOG.md`

---

## Risk Assessment

- **Phase 1:** Medium risk - changing state management could affect many tests ✅ Mitigated
- **Phase 2:** Low risk - refactoring to shared utilities ✅ Complete
- **Phase 3:** Low risk - adding new features ✅ Complete
- **Phase 4:** Low risk - type changes with proper defaults ⏳ Pending
