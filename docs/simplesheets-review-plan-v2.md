# SimpleSheets Code Review & Implementation Plan (Version 2)

This document contains a comprehensive, updated walkthrough and gap analysis of **SimpleSheets** following recent major feature additions (including the Project WBS Extension Normalization, Named Ranges, Conditional Formatting, Data Validation, Cloud Open/Save, and the SheetLink Broadcast Data Bridge). It details remaining critical bugs, functional stubs, code duplication, and layout/export flaws, and provides a step-by-step developer-ready implementation plan.

---

## 🔍 Section 1: Workflow Walkthrough & Gap Analysis

We have analyzed the core system workflows, incorporating recent commits and newly implemented features. Below is the breakdown of missing/broken elements, overlaps, and advanced edge cases.

### 1. Formula Pipeline & Regex Robustness (`src/utils/` & `src/components/`)
*   **Current State**: Full Pratt parser, recursive descent AST compiler, and tree-walking evaluation with 50+ Excel-compatible functions. Recently added Named Ranges support, cell highlights, and error prevention.
*   **Gap 1: Named Ranges Overlap with Cell Reference Matcher**:
    *   *The Issue*: The global regexes used to adjust formulas during copy-paste (`adjustFormulaRefs` in `formulaParser.ts`) and row/col inserts (`adjustFormulaForStructuralChange` in `sheetOperations.ts`) identify cell references using:
        `cellRefRegex = /(?<![A-Za-z0-9_])(\$?)([A-Za-z]+)(\$?)(\d+)(?![A-Za-z0-9_])/gi`
    *   *The Conflict*: This matches *any* length of alphabetical letters followed by digits. If a user defines a named range containing digits—such as `Sales2026`, `Q1_Sales`, or `Quarter4`—the adjuster treats it as a coordinate (e.g. column `Sales`, row `2026`). During copy-paste or sheet resizing, the named range name will be falsely corrupted (e.g. `Sales2026` converted to `SALES2027` or `SALET2026`).
    *   *Remediation*: Excel restricts its sheet coordinates to columns `A` through `XFD` (maximum 3 letters). By changing the pattern `([A-Za-z]+)` to `([A-Za-z]{1,3})`, we restrict matches strictly to valid coordinates, instantly protecting longer named ranges and alphanumeric variable names.
*   **Gap 2: Local Resizing Corrupts Cross-Sheet Prefixes**:
    *   *The Issue*: In `src/utils/sheetOperations.ts` (`adjustFormulaForStructuralChange`), row/col inserts and deletions run a raw regex replace over the formula string without placeholder protection. If the formula contains a cross-sheet reference like `=Sheet2!B5`, the prefix `Sheet2` matches the cell regex (column `Sheet`, row `2`). Resizing rows on the *current* sheet will corrupt the sheet name (converting `Sheet2` to `Sheet3` or `#REF!`). Furthermore, the target cell `B5` on `Sheet2` will shift to `B6`, which is incorrect since `Sheet2` was not structurally resized.
    *   *Remediation*: Replicate the placeholder protection pattern from `adjustFormulaRefs` in `adjustFormulaForStructuralChange`. Protect any cross-sheet qualifiers with temporary placeholders (e.g., `§§{idx}§§`) before adjusting local coordinates.
*   **Gap 3: Formula Function Stubs**:
    *   *The Issue*: `INDIRECT` is a dummy stub that just echoes its input. `OFFSET` and `INDEX` are simplified stubs that return flat scalar values rather than rich cell/range references. This breaks standard nested references such as `=SUM(OFFSET(A1,0,0,3,3))`. `VLOOKUP`/`HLOOKUP` approximate matches do a simple linear `<= scan` rather than executing a proper binary search on sorted columns.
    *   *Remediation*: Implement proper AST-resolution for `INDIRECT`, and return cell/range reference nodes for `OFFSET` and `INDEX` so they aggregate correctly inside wrapper functions.

### 2. Project Management (WBS/CPM) Extension (`src/extensions/project-wbs/`)
*   **Current State**: Integrated SVG Gantt charts, risk matrices, registers, EVM analytics, and resource heatmaps. Auto-calculation of CPM critical paths and cost rollups.
*   **Gap 1: Summary Task Cost/Effort Rollup Stale Closure (Critical Bug)**:
    *   *The Issue*: In `src/extensions/project-wbs/rollups.ts` (`recomputeTaskRollup`), the function recurses to update child tasks, but when computing rollups for parent/summary nodes, it evaluates `rollUpCost(task)` and `rollUpEffort(task)` using the *original* task node (containing stale children) instead of the newly updated `updatedChildren` list. This causes parent summaries to roll up outdated child costs and hours.
    *   *Remediation*: Form a temporary task node `const tempTask = { ...task, children: updatedChildren };` and pass it into `rollUpCost(tempTask)` and `rollUpEffort(tempTask)`.
*   **Gap 2: CPM Successor Start Date Duration Mismatch (Critical Bug)**:
    *   *The Issue*: In `src/extensions/project-wbs/dependencies.ts` (`calculateDependencyDate`), the arithmetic for Finish-to-Finish (`FF`) and Start-to-Finish (`SF`) dependency types mistakenly uses `predecessor.duration` instead of the successor's duration. This schedules incorrect successor dates.
    *   *Remediation*: Pass the successor's duration into `calculateDependencyDate` and utilize it in both the `FF` and `SF` branches.
*   **Gap 3: One-Way Scheduling Cascade Trap**:
    *   *The Issue*: In `src/extensions/project-wbs/dependencyWorkflows.ts` (`autoScheduleSuccessors`), downstream date propagation is one-way: dates can shift forward (later) but never contract (move earlier) when a predecessor is finished early.
    *   *Remediation*: If a task has predecessors, calculate its start date as the strict maximum of all expected dates derived from its active predecessors. This allows schedules to compress bidirectional.
*   **Gap 4: Silent Circular Dependency Corruption**:
    *   *The Issue*: In `src/extensions/project-wbs/ProjectView.tsx` (`handleSaveDependencies`), the user can define a dependency loop (e.g. Task A depends on Task B, which depends on Task A). Topological sort fails silently and returns `null`, auto-scheduling is skipped, CPM highlights disappear, and tasks become permanently locked in `waiting` state without throwing an alert.
    *   *Remediation*: Intercept dependency saving, run `detectDependencyCycles()`, and reject saving with an alert warning of the circular loop.
*   **Gap 5: Duplication & Performance Scaling Bottlenecks**:
    *   *The Issue*: `isTaskBlocked` and `isTaskReady` are exact logical duplicates containing identical loops and Map allocations. In `updateTaskStatuses`, a nested loop constructs a full `allTasks` array and multiple `Map` structures on *every iteration*, creating an $O(N^2)$ scaling bottleneck for large projects.
    *   *Remediation*: Refactor `isTaskReady` to return `!isTaskBlocked()`. Optimize `updateTaskStatuses` by pre-building a single Task Map and reusing it throughout the status resolution loop.

### 3. PDF Export & Layout (`src/services/` & `src/components/`)
*   **Current State**: Full export functionality.
*   **Gap 1: PDF Grid Header Destroys Row/Col Edge Data (Severe Bug)**:
    *   *The Issue*: In `src/services/pdfExport.ts` (`buildPrintableHtml`), when `showHeaders` is active, the generator overwrites actual cell content in the first row (`r === minRow`) with column letters (`A`, `B`, `C`...) and in the first column (`c === minCol`) with row numbers (`1`, `2`, `3`...). This destroys the user's data on printed PDFs.
    *   *Remediation*: Restructure table generation. If `showHeaders` is enabled, insert an *additional* top row for column headers (with an empty top-left cell) and an *additional* left cell in each row for row numbers.
*   **Gap 2: Row Clipping with Multiline Text**:
    *   *The Issue*: When a user inputs multiline text via `Alt+Enter` in edit mode, the editor switches to a `textarea` correctly, but the grid's row height remains fixed, clipping the content visually.
    *   *Remediation*: Calculate required height based on line count upon committing a cell and dynamically set `sheet.rowHeights[row]`.

### 4. Clipboard & Data Validation Integration (`src/utils/` & `src/components/`)
*   **Current State**: Live validation alerts on direct keyboard inputs.
*   **Gap 1: Data Validation Bypass on Paste**:
    *   *The Issue*: Direct data entry blocks invalid inputs, but pasting via Ctrl+V or Paste Special completely bypasses data validation rules, writing invalid strings/numbers to guarded cells without warning.
    *   *Remediation*: Integrate data validation evaluation during paste operations. If pasted values violate cell validation rules, mark the cells with a red validation error triangle indicator and a hover tooltip.

---

## 🛠️ Section 2: Step-by-Step Implementation Plan

### Goal Summary
Enhance SimpleSheets to protect alphanumeric named ranges during formula translation and sheet resizing, fix stale closure cost rollups in summaries, rectify successor scheduling date calculations, prevent silent cyclic dependency corruption, and correct PDF printing headers from destroying grid edge data.

---

## Stage 1: Core Formula Engine & Regex Robustness

### Task 1.1: Restrict Column Letter Matcher to 1-3 Letters
*   **Subtask 1.1.1**: Open `src/utils/formulaParser.ts`.
*   **Subtask 1.1.2**: In `adjustFormulaRefs`, find the `cellRefRegex` definition. Update it to restrict alphabetical characters to between 1 and 3 letters:
    `const cellRefRegex = /(?<![A-Za-z0-9_])(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_])/gi;`
*   **Subtask 1.1.3**: Open `src/utils/sheetOperations.ts`. Update the local `cellRefRegex` inside `adjustFormulaForStructuralChange` in the exact same manner.
*   **Subtask 1.1.4**: Write unit tests in `src/utils/adjustFormulaRefs_fix.test.ts` to assert that formula terms like `Sales2026` or `Q1_Sales` are left unmodified when offset adjusting.

### Task 1.2: Protect Cross-Sheet Prefixes in Structural Resizing
*   **Subtask 1.2.1**: Open `src/utils/sheetOperations.ts`.
*   **Subtask 1.2.2**: At the top of `adjustFormulaForStructuralChange`, implement placeholder extraction for cross-sheet prefixes (matching the pattern in `adjustFormulaRefs`):
    ```typescript
    const crossSheetPrefixRegex = /('[^']*'!|[A-Za-z_][A-Za-z0-9_]*!)/gi;
    const placeholders: string[] = [];
    let protectedFormula = formula.replace(crossSheetPrefixRegex, (match) => {
      const placeholder = `§§${placeholders.length}§§`;
      placeholders.push(match);
      return placeholder;
    });
    ```
*   **Subtask 1.2.3**: Execute the `cellRefRegex` replacement on `protectedFormula`. In the replacement callback, only adjust cell coordinates if they do not contain a placeholder prefix.
*   **Subtask 1.2.4**: Restore placeholders prior to returning the adjusted formula.
*   **Subtask 1.2.5**: Add integration tests in `src/utils/sheetOperations.test.ts` verifying that local row/column deletions and insertions do not touch cross-sheet sheet names or their targeted indices.

### Task 1.3: Implement Rich `INDIRECT`, `OFFSET`, and `INDEX` Handlers
*   **Subtask 1.3.1**: Open `src/utils/formulaEngine.ts`.
*   **Subtask 1.3.2**: In the function evaluation switch block:
    *   *`INDIRECT`*: Parse the text input string using `parseFormula` and evaluate the resulting AST cell or range reference in the current context. Return `#REF!` on syntax errors.
    *   *`OFFSET` / `INDEX`*: Adjust their return structures to return an AST cell or range node rather than a flat, scalar value.
*   **Subtask 1.3.3**: Ensure aggregate functions (SUM, AVERAGE, MIN, MAX) expand these returned AST nodes correctly during arguments processing.

---

## Stage 2: Project Management & CPM Scheduling Corrections

### Task 2.1: Fix CPM Date Propagation Duration Mismatch
*   **Subtask 2.1.1**: Open `src/extensions/project-wbs/dependencies.ts`.
*   **Subtask 2.1.2**: Update `calculateDependencyDate` to accept `successorDuration` as an argument:
    ```typescript
    export function calculateDependencyDate(
      predecessor: WBSTask,
      dependency: TaskDependency,
      projectStart: string,
      successorDuration: number, // Added successor duration
      calendar: WorkingCalendar = createDefaultCalendar(),
    ): string
    ```
*   **Subtask 2.1.3**: Update the `FF` and `SF` cases to subtract `successorDuration` instead of `predecessor.duration`:
    ```typescript
    case 'FF':
      return addWorkingDays(projectStart, predEndOffset + dependency.lag - successorDuration + 1, calendar);
    case 'SF':
      return addWorkingDays(projectStart, predStartOffset + dependency.lag - successorDuration + 1, calendar);
    ```
*   **Subtask 2.1.4**: Open `src/extensions/project-wbs/dependencyWorkflows.ts`. Locate call sites in `autoScheduleSuccessors` and supply the successor's duration (`updatedTask.duration`).
*   **Subtask 2.1.5**: Add unit tests in `dependencies.test.ts` to assert correct scheduling for tasks of varying durations using `FF` and `SF`.

### Task 2.2: Implement Bidirectional Schedule Contraction
*   **Subtask 2.2.1**: Open `src/extensions/project-wbs/dependencyWorkflows.ts`.
*   **Subtask 2.2.2**: Refactor `autoScheduleSuccessors` date resolution logic. If a task has dependencies, compute its new start date as the strict maximum of all expected dates derived from its active predecessors:
    ```typescript
    let maxExpectedStart = '';
    let hasPredecessors = false;
    for (const dep of updatedTask.dependencies) {
      const predecessor = taskMap.get(dep.predecessorId);
      if (!predecessor) continue;
      hasPredecessors = true;
      let expectedStart: string;
      switch (dep.type) {
        case 'FS':
          expectedStart = addWorkingDays(predecessor.endDate, dep.lag + 1, calendar);
          break;
        case 'SS':
          expectedStart = addWorkingDays(predecessor.startDate, dep.lag, calendar);
          break;
        case 'FF':
          expectedStart = addWorkingDays(predecessor.endDate, dep.lag - updatedTask.duration + 1, calendar);
          break;
        case 'SF':
          expectedStart = addWorkingDays(predecessor.startDate, dep.lag - updatedTask.duration + 1, calendar);
          break;
        default:
          expectedStart = updatedTask.startDate;
      }
      if (!maxExpectedStart || expectedStart > maxExpectedStart) {
        maxExpectedStart = expectedStart;
      }
    }
    if (hasPredecessors && maxExpectedStart !== updatedTask.startDate) {
      updatedTask.startDate = maxExpectedStart;
      updatedTask.endDate = addWorkingDays(maxExpectedStart, updatedTask.duration - 1, calendar);
      taskMap.set(task.id, updatedTask);
    }
    ```

### Task 2.3: Correct Summary Task Cost/Effort Rollup Closure
*   **Subtask 2.3.1**: Open `src/extensions/project-wbs/rollups.ts`.
*   **Subtask 2.3.2**: In `recomputeTaskRollup`, calculate `updatedChildren` first, then assemble a temporary updated task object:
    `const tempTask = { ...task, children: updatedChildren };`
*   **Subtask 2.3.3**: Pass `tempTask` into the cost and effort roll-up calculations:
    ```typescript
    cost: rollUpCost(tempTask),
    effort: rollUpEffort(tempTask),
    ```
*   **Subtask 2.3.4**: Add a unit test in `rollups.test.ts` checking that modifying nested grandchild task costs correctly bubbles all the way up to root summary tasks.

### Task 2.4: Consolidate Blocked/Ready Queries & Optimize Status Loop
*   **Subtask 2.4.1**: Open `src/extensions/project-wbs/dependencyWorkflows.ts`.
*   **Subtask 2.4.2**: Refactor `isTaskReady` to simply call `isTaskBlocked`:
    ```typescript
    export function isTaskReady(task: WBSTask, allTasks: WBSTask[]): boolean {
      return !isTaskBlocked(task, allTasks);
    }
    ```
*   **Subtask 2.4.3**: Optimize `updateTaskStatuses` to eliminate the $O(N^2)$ allocations:
    ```typescript
    export function updateTaskStatuses(tasks: WBSTask[]): WBSTask[] {
      const taskMap = new Map(tasks.map((t) => [t.id, { ...t }]));
      const allTasks = Array.from(taskMap.values()); // Allocate once
      
      for (const task of allTasks) {
        if (['done', 'in_progress', 'on_hold'].includes(task.status)) continue;
        
        if (isTaskBlocked(task, allTasks)) {
          if (task.status !== 'waiting') {
            task.status = 'waiting';
            taskMap.set(task.id, task);
          }
        } else {
          if (task.status === 'not_started' || task.status === 'waiting') {
            task.status = 'ready';
            taskMap.set(task.id, task);
          }
        }
      }
      return Array.from(taskMap.values());
    }
    ```

### Task 2.5: Block Circular Dependencies Interactive Edits
*   **Subtask 2.5.1**: Open `src/extensions/project-wbs/ProjectView.tsx`.
*   **Subtask 2.5.2**: In `handleSaveDependencies`, run `detectDependencyCycles(allTasksUpdated)` on the proposed changes.
*   **Subtask 2.5.3**: If the returned array of circular task IDs is non-empty, display a native `window.alert()` with the names of the tasks in the loop and prevent the state save.

---

## Stage 3: PDF Export Header & Layout Enhancements

### Task 3.1: Fix PDF Export Grid Header Overwriting
*   **Subtask 3.1.1**: Open `src/services/pdfExport.ts`.
*   **Subtask 3.1.2**: Locate the double loop in `buildPrintableHtml` and completely remove the branches that overwrite cells with headers:
    `if (showHeaders && r === minRow) { ... } else if (showHeaders && c === minCol) { ... }`
*   **Subtask 3.1.3**: Restructure the table rendering. If `showHeaders` is `true`:
    1.  Append an initial row `<tr>` to the table. Draw an empty corner `<td>`, then iterate from `minCol` to `maxCol` appending column letters (`A`, `B`, `C`...) to the header row.
    2.  For each data row `r` from `minRow` to `maxRow`, append a leading `<td>` containing the row number (`r + 1`) before appending actual cells.
*   **Subtask 3.1.4**: Run PDF export tests to ensure data cells are correctly preserved.

### Task 3.2: Auto-Expanding Row Heights for Multiline Text
*   **Subtask 3.2.1**: Open `src/components/Grid.tsx`.
*   **Subtask 3.2.2**: In the editing commit handler, if the cell contains newline characters (`\n`), compute the height required based on lines count and update `sheet.rowHeights[row]` state dynamically to match the content height.

---

## Stage 4: Clipboard & Data Validation Integration

### Task 4.1: Flag Invalid Pasted Data
*   **Subtask 4.1.1**: Open `src/utils/pasteSpecial.ts` or paste handlers in `src/App.tsx`.
*   **Subtask 4.1.2**: In the paste loop, run the destination cell value through the data validation engine (`validateCell(val, rule)`).
*   **Subtask 4.1.3**: If a pasted value is invalid, attach a validation error style or indicator flag to the cell to alert the user visually on the grid, rather than letting it bypass checks.

---

## Stage 5: Verification & Quality Gates

### Task 5.1: Run Full Test Suite & Linting
*   **Subtask 5.1.1**: Execute `npm test` to run all Jest tests.
*   **Subtask 5.1.2**: Run `npm run lint` and `npm run type-check` to verify no syntactic or compiler issues.
*   **Subtask 5.1.3**: Run `npm run build` to confirm a successful static site build.
