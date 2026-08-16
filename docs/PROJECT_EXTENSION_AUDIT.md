# Project/WBS Extension Audit Report

**Date:** 2026-01-16
**Scope:** Complete review of `src/extensions/project-wbs/`
**Current Test Count:** 3,531 tests across 148 suites

---

## Executive Summary

The Project/WBS extension has grown organically through 15+ phases. While functional, it has accumulated **duplications, logic errors, and workflow gaps** that need systematic attention. This audit identifies **12 issues** across 4 categories.

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

## Prioritized Fix Plan

### Phase 1: Fix Logic Errors (Week 1)
1. **A1:** Separate UI-only state from data mutations in `handleProjectChange`
2. **A2:** Only call `onProjectChange` for data mutations
3. **A3:** Fix template resource auto-assignment logic

### Phase 2: Eliminate Duplications (Week 1-2)
4. **B1:** Extract `projectToModel` to shared utility
5. **B2:** Remove `handleSaveToSheet` duplication (or clarify its purpose)
6. **B3:** Use shared utility in `createWorkbookFromTemplate`

### Phase 3: Close Workflow Gaps (Week 2-3)
7. **C1:** Add import/export project data as JSON files
8. **C2:** Add blank project creation
9. **C3:** Add UI for managing actuals
10. **C4:** Add UI for material allocation/consumption

### Phase 4: Fix Data Schema (Week 3)
11. **D1:** Make `ProjectModel.materials` and `ProjectModel.actuals` optional
12. **D2:** Use UUID for sheet IDs

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

- **Phase 1:** Medium risk - changing state management could affect many tests
- **Phase 2:** Low risk - refactoring to shared utilities
- **Phase 3:** Low risk - adding new features
- **Phase 4:** Low risk - type changes with proper defaults
