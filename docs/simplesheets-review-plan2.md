# SimpleSheets Code Review & Implementation Plan

This document contains a comprehensive review of the current codebase of **SimpleSheets** and presents a detailed, step-by-step plan to address identified bugs, stubs, and architectural gaps.

---

## 🔍 Code Review & Gap Analysis

After performing an in-depth review of the repository's core files, several critical bugs, stubbed implementations, and duplicated code patterns were discovered across the spreadsheet formula engine, the project management (WBS/CPM) extension, and the UI structural operations.

### 1. Structural Operations & Formula Corruption (Critical UI Bug)
*   **File**: `src/utils/sheetOperations.ts` (`adjustFormulaForStructuralChange`)
*   **The Issue**: When a user inserts or deletes rows or columns on the current sheet, the formula engine adjusts all relative coordinates in formulas on that sheet to preserve references. However, the regex `cellRefRegex` matches any letters followed by digits as a cell reference:
    ```typescript
    const cellRefRegex = /(?<![A-Za-z0-9_])(\$?)([A-Za-z]+)(\$?)(\d+)/gi;
    ```
    1.  **Cross-Sheet Prefix Corruption**: An unquoted cross-sheet reference like `=Sheet2!B5` is parsed by this regex. The prefix `Sheet2` matches as a relative cell reference (column `Sheet`, row `2`). If a row is inserted at index 0 or 1 on the current sheet, `Sheet2` gets adjusted to `Sheet3`—**corrupting the referenced sheet name**!
    2.  **Unmodified Sheet Shifting**: Even if a quoted sheet prefix is used (e.g., `='My Sheet'!B5`), the `B5` cell reference is matched and adjusted to `B6` on a current-sheet row insertion. This is incorrect because `My Sheet` was not structurally modified; only the current sheet was. Cross-sheet references should remain unchanged during local sheet structural edits.
*   **The Fix**: 
    1.  Introduce a temporary placeholder protection step for all cross-sheet sheet names (e.g., `'Sheet2'!`, `Sheet2!`) before running the reference adjustment regex (matching the fix implemented for copy-paste in `adjustFormulaRefs`).
    2.  Only adjust cell references that do *not* have a cross-sheet sheet prefix, ensuring local structural edits do not modify references targeting other sheets.

---

### 2. Critical Path Method (CPM) Successor Start Date Duration Mismatch (Critical WBS Bug)
*   **File**: `src/extensions/project-wbs/dependencies.ts` (`calculateDependencyDate`)
*   **The Issue**: The `calculateDependencyDate` function computes the start date of a successor task based on a predecessor's dates and lag. However, for Finish-to-Finish (`FF`) and Start-to-Finish (`SF`) dependency types, the calculation incorrectly uses `predecessor.duration` instead of the successor's duration:
    ```typescript
    case 'FF': // Finish-to-Finish: successor ends after predecessor ends + lag
      return addWorkingDays(projectStart, predEndOffset + dependency.lag - predecessor.duration + 1, calendar);
    ```
    *   *Mathematical Breakdown*:
        $$Successor.endDate = Predecessor.endDate + lag$$
        $$Successor.startDate = Successor.endDate - Successor.duration + 1$$
        Substituting the first into the second yields:
        $$Successor.startDate = Predecessor.endDate + lag - Successor.duration + 1$$
    *   By using `predecessor.duration` in place of the successor's duration, the engine calculates a wrong start date whenever the predecessor and successor have different durations. (Note that `calculateCPM` in the same file correctly uses `task.duration` for its forward-pass, creating a direct mathematical mismatch between CPM scheduling and date calculation!)
*   **The Fix**: Modify `calculateDependencyDate` to accept the successor task (or its duration) and use `successor.duration` in the `FF` and `SF` branches.

---

### 3. One-Way Auto-Scheduling Propagation Trap (WBS Scheduling Bug)
*   **File**: `src/extensions/project-wbs/dependencyWorkflows.ts` (`autoScheduleSuccessors`)
*   **The Issue**: The auto-scheduler only cascades date changes forward (later) because it compares expected start dates with the successor's *current* start date:
    ```typescript
    if (expectedStart > newStartDate) {
      newStartDate = expectedStart;
      needsUpdate = true;
    }
    ```
    If a predecessor is moved *earlier*, the expected start date becomes earlier. Since it is not greater than the current start date, the successor is left trapped on its later date. This introduces dead slack in the timeline and prevents schedule contraction.
*   **The Fix**: If a task has dependencies, calculate its rescheduled start date as the strict maximum of the expected start dates derived from *all* of its active predecessors. This allows the task to dynamically move earlier when all its predecessors move earlier.

---

### 4. Overlap & Duplicated Code: Task Status Triggers
*   **File**: `src/extensions/project-wbs/dependencyWorkflows.ts` (`isTaskBlocked` and `isTaskReady`)
*   **The Issue**: These two functions are exact logical inverses of each other, but they are implemented as separate, copy-pasted loops that build the same map and iterate over the same dependencies:
    ```typescript
    export function isTaskBlocked(task: WBSTask, allTasks: WBSTask[]): boolean { ... }
    export function isTaskReady(task: WBSTask, allTasks: WBSTask[]): boolean { ... }
    ```
*   **The Fix**: Refactor `isTaskReady` to simply return `!isTaskBlocked(task, allTasks)`, eliminating duplicate code and potential desynchronization bugs.

---

### 5. Silent Cycle-Detection Failure on Interactive Edits
*   **File**: `src/extensions/project-wbs/ProjectView.tsx` (`handleSaveDependencies`)
*   **The Issue**: When editing task dependencies via the WBS Tree or Task Editor modal, if a circular dependency is created (e.g., Task A depends on Task B, which depends on Task A), `topologicalSort` returns `null`, and `autoScheduleSuccessors` silently bails, returning the original tasks. The dependency edit is ignored without informing the user.
*   **The Fix**: Check for cycles during dependency saving and alert the user with a descriptive dialog (e.g., "Circular dependency detected between Task A and Task B!"), rejecting the invalid dependency configuration before saving.

---

### 6. Broken / Stubbed Formula Functions
*   **File**: `src/utils/formulaEngine.ts`
*   **The Issues**:
    1.  **`INDIRECT` is a Stub**: The `INDIRECT` function does not resolve actual cell references from strings; it merely returns the input string or number, breaking standard formulas like `=INDIRECT("A1")`.
    2.  **`OFFSET` and `INDEX` Return Flat Values**: In Excel, `OFFSET` and `INDEX` return a cell/range *reference*, which can be nested inside other aggregate functions like `=SUM(OFFSET(A1,0,0,3,3))`. Our current engine only returns a flat cell value, throwing errors or losing dimensional context when nested.
    3.  **Linear Approximate `VLOOKUP` / `HLOOKUP`**: Approximate lookup (`exactMatch = false`) performs a linear scan over all rows/cols and matches the *last* value `<= lookupVal`. Excel expects the column to be sorted ascending and uses a binary search pattern; if unsorted, it should fail or return unpredictable results, not act as a linear `<= accumulator`.

---

### 7. Layout & Export Edge Cases
*   **Row Clipping**: Alt+Enter inserts newlines and switches to a textarea, but after editing, the default row height is preserved, clipping the cell's contents. Row heights should dynamically expand to fit multiline content.
*   **PDF Export Virtualization Gap**: In `src/services/pdfExport.ts`, calling `html2pdf.js` on a virtualized grid will only export the visible viewport cells, rendering a blank sheet or cut-off pages for long tables.

---

# 🛠️ Step-by-Step Implementation Plan

### Goal Summary
Implement targeted bug fixes and refactors across SimpleSheets to prevent formula corruption during structural edits, correct Finish-to-Finish/Start-to-Finish CPM date arithmetic, enable bidirectional auto-scheduling, consolidate duplicated workflow checks, and resolve formula engine stubs (`INDIRECT` and `VLOOKUP`).

---

## Stage 1: Formula Adjustments & Structural Edits

### Task 1.1: Protect Cross-Sheet References in Structural Edits
*   **Subtask 1.1.1**: Open `src/utils/sheetOperations.ts`.
*   **Subtask 1.1.2**: In `adjustFormulaForStructuralChange`, add a placeholder protection step at the top of the function to extract and replace cross-sheet prefixes (like `Sheet2!` or `'My Sheet'!`) with temporary placeholders (e.g., `§§{idx}§§`), matching the pattern used in `adjustFormulaRefs` in `formulaParser.ts`.
*   **Subtask 1.1.3**: Update the `cellRefRegex` replacement loop. Only adjust cell references that do *not* have a cross-sheet placeholder, meaning they belong to the current sheet being modified.
*   **Subtask 1.1.4**: Restore the placeholders at the end of the adjustment.
*   **Subtask 1.1.5**: Write unit tests in `src/utils/sheetOperations.test.ts` to verify that inserting/deleting rows on Sheet1 adjusts local formulas but leaves cross-sheet sheet names and their targeted cell coordinates completely untouched.

---

## Stage 2: Project Management (WBS/CPM) Correctness

### Task 2.1: Correct FF & SF Dependency Date Calculations
*   **Subtask 2.1.1**: Open `src/extensions/project-wbs/dependencies.ts`.
*   **Subtask 2.1.2**: Modify the signature of `calculateDependencyDate`:
    ```typescript
    export function calculateDependencyDate(
      predecessor: WBSTask,
      dependency: TaskDependency,
      projectStart: string,
      successorDuration: number, // Added parameter
      calendar?: WorkingCalendar,
    ): string
    ```
*   **Subtask 2.1.3**: Update the `FF` and `SF` cases to use `successorDuration` instead of `predecessor.duration`:
    ```typescript
    case 'FF':
      return addWorkingDays(projectStart, predEndOffset + dependency.lag - successorDuration + 1, calendar);
    case 'SF':
      return addWorkingDays(projectStart, predStartOffset + dependency.lag - successorDuration + 1, calendar);
    ```
*   **Subtask 2.1.4**: Update the call sites in `dependencyWorkflows.ts` and any tests in `dependencies.test.ts` to pass the successor's duration.
*   **Subtask 2.1.5**: Add unit tests in `dependencies.test.ts` verifying correct FF and SF calculations with differing successor and predecessor durations.

### Task 2.2: Implement Bidirectional Auto-Scheduling
*   **Subtask 2.2.1**: Open `src/extensions/project-wbs/dependencyWorkflows.ts`.
*   **Subtask 2.2.2**: In `autoScheduleSuccessors`, modify the reschedule loop. If a task has dependencies, calculate its scheduled start date as the strict maximum of the expected start dates derived from *all* its predecessors, rather than comparing against its current start date:
    ```typescript
    let newStartDate = "";
    for (const dep of updatedTask.dependencies) {
      const predecessor = taskMap.get(dep.predecessorId);
      if (!predecessor) continue;
      // Calculate expected start
      ...
      if (!newStartDate || expectedStart > newStartDate) {
        newStartDate = expectedStart;
      }
    }
    if (newStartDate && newStartDate !== updatedTask.startDate) {
      needsUpdate = true;
    }
    ```
*   **Subtask 2.2.3**: Write unit tests in `src/extensions/project-wbs/dependencyWorkflows.test.ts` verifying that moving a predecessor *earlier* successfully pulls its successor earlier (schedule contraction).

### Task 2.3: Consolidate Duplicated Blocked / Ready Checks
*   **Subtask 2.3.1**: Open `src/extensions/project-wbs/dependencyWorkflows.ts`.
*   **Subtask 2.3.2**: Refactor `isTaskReady` to call `isTaskBlocked` and invert the result:
    ```typescript
    export function isTaskReady(task: WBSTask, allTasks: WBSTask[]): boolean {
      return !isTaskBlocked(task, allTasks);
    }
    ```
*   **Subtask 2.3.3**: Run `npm test` to verify that all existing dependency state tests remain perfectly green.

### Task 2.4: Introduce Cycle-Detection Dialog in WBS Edits
*   **Subtask 2.4.1**: Open `src/extensions/project-wbs/ProjectView.tsx`.
*   **Subtask 2.4.2**: In `handleSaveDependencies`, before saving the new dependencies, run `detectDependencyCycles(allTasksUpdated)`.
*   **Subtask 2.4.3**: If cycles are detected, prevent the save operation and display a descriptive warning to the user using a modal or native `window.alert()` highlighting the cyclical task IDs.

---

## Stage 3: Formula Engine Stubs & Enhancements

### Task 3.1: Implement Functional `INDIRECT`
*   **Subtask 3.1.1**: Open `src/utils/formulaEngine.ts`.
*   **Subtask 3.1.2**: Implement the `INDIRECT` case to parse the text reference string using `parseFormula` and evaluate the resulting AST node within the current context.
*   **Subtask 3.1.3**: Add error handling for invalid reference strings, returning `#REF!`.

### Task 3.2: Align VLOOKUP / HLOOKUP with Excel Spec
*   **Subtask 3.2.1**: Open `src/utils/formulaEngine.ts`'s `VLOOKUP`/`HLOOKUP` cases.
*   **Subtask 3.2.2**: For approximate match (`exactMatch = false`), add a check verifying if the lookup column/row is sorted. If unsorted, return `#N/A` or adopt binary search behaviors matching the Excel standard, rather than allowing arbitrary matches.

---

## Stage 4: Layout & Print Setup Correctness

### Task 4.1: Auto-Expanding Row Heights
*   **Subtask 4.1.1**: Open `src/components/Grid.tsx`.
*   **Subtask 4.1.2**: Update the cell commit handler. When committing a cell that contains newlines, calculate the height based on line count and update `sheet.rowHeights[row]` dynamically.

### Task 4.2: Headless Export rendering path for PDF Exports
*   **Subtask 4.2.1**: Open `src/services/pdfExport.ts`.
*   **Subtask 4.2.2**: Before generating the PDF, temporarily render the full grid container into a hidden, non-virtualized container to ensure `html2pdf.js` captures every row and column in the workbook, avoiding truncation.
