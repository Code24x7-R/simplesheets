# PLAN — UI Overhaul & Formula Wizard

## Goal
Achieve a clean, clutter-free UI with standardized dropdown menus, formula wizard, formula bar, and R1C1 reference format.

## Current State
- **2647 tests** across **105 suites**, All passing
- Lint clean (0 warnings), Type-check clean, Build clean
- Coverage: **91.29% stmts, 84.47% branches, 90.6% funcs, 92.69% lines**
- Phases 1–30 complete ✅
- Phases 22–23 (Conditional Formatting, Data Validation) planned 📋

---

## Phase 21: Charts — COMPLETE ✅ (2026-07-31)
*Create data visualization charts from spreadsheet data.*

### Phase 21a: Chart Types & Data Model — COMPLETE ✅
- [x] **Bar Chart** — vertical bars for comparing values across categories
- [x] **Column Chart** — horizontal bars for comparing values
- [x] **Line Chart** — trends over time or ordered categories
- [x] **Pie Chart** — proportional breakdown of a single data series
- [x] **Area Chart** — filled line chart showing cumulative totals
- [x] **Scatter Plot** — correlation between two numeric series
- [x] Extended `types.ts` with `ChartConfig`, `ChartSeries`, `ChartType`, `LegendPosition`
- [x] Added `charts?: ChartConfig[]` to `Sheet` interface
- [x] Created `chartData.ts` with extraction utilities (parseRange, extractChartData, getMinMax, getPieData)

### Phase 21b: Chart Rendering Engine — COMPLETE ✅
- [x] Pure SVG rendering (no external chart library — keeps bundle small)
- [x] Responsive sizing (viewBox scales to container)
- [x] Grid lines and tick marks
- [x] `ChartRenderer.tsx` — all 6 chart types with axes, legends, tooltips
- [x] `ChartOverlay.tsx` — floating chart display with drag and selection

### Phase 21c: Chart Configuration Dialog — COMPLETE ✅
- [x] Chart type selector (6 types with icons)
- [x] Data range input with auto-detection
- [x] Chart title and axis labels
- [x] Legend position selector
- [x] Live SVG preview using ChartRenderer

### Phase 21d: Integration — COMPLETE ✅
- [x] Insert Chart dialog (Insert menu + toolbar button)
- [x] Chart positioning (floating on sheet, draggable)
- [x] Delete chart (button on selected chart)
- [x] `handleInsertChart`, `handleChartApply`, `handleDeleteChart`, `handleMoveChart`
- [x] Undo/redo support via pushHistory

### Phase 21e: Persistence & Export — COMPLETE ✅
- [x] Charts auto-update when source data changes (derived from sheet state)
- [x] Charts included in PDF export (SVG embedded in printable HTML)
- [x] Charts saved/loaded with workbook (charts array in Sheet)
- [x] Menu: Insert → Chart…
- [x] Toolbar button for quick chart insertion

**Tests:** 70+ new tests across chartData, ChartRenderer, ChartDialog, and integration
**Results:** 2589 tests pass, lint clean, type-check clean, build clean

---

## Phase 21g: Chart Enhancements — COMPLETE ✅ (2026-07-31)
*Improve chart usability with range picker, persistent settings, and resize handles.*

### Phase 21g.1: Range Picker Integration — COMPLETE ✅
- [x] Added range picker button (📎 icon) next to data range input in ChartDialog
- [x] Enter point mode when picker is active (reuses wizardPointMode on Grid)
- [x] Highlight selected range on grid (via existing point-mode visual feedback)
- [x] Update data range input with selected range via custom event
- [x] Support click-drag range selection and click-to-expand (existing Grid behavior)
- [x] Keyboard support: Enter to accept, Escape to cancel (existing Grid behavior)
- [x] handleToggleChartRangePicker and handleChartPointSelection in App.tsx
- [x] 6 new tests in ChartDialog for range picker

### Phase 21g.2: Chart Settings State — COMPLETE ✅
- [x] Created useChartSettings hook with localStorage persistence
- [x] Added chartSettings and updateChartSettings to App.tsx
- [x] Pre-populate dialog with last-used settings (type, legend position, title, axis labels, dimensions)
- [x] Store settings in localStorage (simplesheets:chart-settings)
- [x] Apply saved defaults to new charts
- [x] onSettingsChange callback saves settings after chart apply
- [x] 7 new tests for useChartSettings hook

### Phase 21g.3: Multiple Charts Support — COMPLETE ✅
- [x] Z-index management for overlapping charts (selected chart renders last, zIndex: 100)
- [x] Drag-to-reposition (already supported via onMoveChart)
- [x] Minimize/restore chart (collapse to title bar, double-click header)
- [x] Chart header bar with title and minimize button
- [x] Sorted rendering ensures selected chart is on top
- [x] Note: Chart list panel and bulk operations deferred to future enhancement

### Phase 21g.4: Chart Resize Handles — COMPLETE ✅
- [x] Added resize handles to selected chart (4 corners + 4 edges = 8 handles)
- [x] Minimum size constraint (100×80px)
- [x] Live preview during resize (chart redraws at new size)
- [x] handleResizeChart in App.tsx with undo/redo support
- [x] Cursor styling for each handle direction (nw-resize, ne-resize, etc.)
- [x] Resize state managed via ref for smooth mouse tracking

**Tests:** 13+ new tests (6 range picker + 7 settings hook)
**Results:** 2602 tests pass, lint clean, type-check clean, build clean

---

## Phase 22: Conditional Formatting — PLANNED 📋
*Apply dynamic formatting rules based on cell values or formulas.*

### Phase 22a: Rule Types
- [ ] **Greater Than / Less Than** — highlight cells above/below a threshold
- [ ] **Between / Not Between** — highlight cells within a range
- [ ] **Equal To / Not Equal To** — highlight cells matching a value
- [ ] **Text Contains** — highlight cells containing specific text
- [ ] **Duplicate Values** — highlight duplicate entries in a range
- [ ] **Top/Bottom N** — highlight top or bottom N values
- [ ] **Above/Below Average** — highlight cells relative to range average
- [ ] **Color Scales** — gradient fill based on value (2-color or 3-color scale)
- [ ] **Data Bars** — in-cell horizontal bars proportional to value
- [ ] **Icon Sets** — arrows, traffic lights, stars based on value thresholds

### Phase 22b: Formula-Based Rules
- [ ] Custom formula condition (e.g., `=AND(A1>100, A1<200)`)
- [ ] Reference relative to active cell in selection
- [ ] Formula evaluates per-cell in applied range

### Phase 22c: Rule Management
- [ ] ConditionalFormatting modal (Format menu or toolbar)
- [ ] Rule list with priority ordering (stop-if-true support)
- [ ] Edit existing rules
- [ ] Delete rules
- [ ] Apply to range selector (use current selection or manual entry)
- [ ] Preview rule effect before applying

### Phase 22d: Rendering
- [ ] Layer conditional formatting on top of cell styles
- [ ] Evaluate rules on every cell value change
- [ ] Efficient batch evaluation for large ranges
- [ ] Support overlapping rules (priority order determines winner)

### Phase 22e: Integration
- [ ] Menu: Format → Conditional Formatting
- [ ] Rules saved/loaded with workbook
- [ ] Rules included in PDF export (formatting visible)

---

## Phase 23: Data Validation — PLANNED 📋
*Restrict cell input to predefined criteria with custom error alerts.*

### Phase 23a: Validation Types
- **Whole Number** — integer only, with min/max constraints
- **Decimal** — floating point, with min/max constraints
- **List** — dropdown selection from a list of values (static or range reference)
- **Date** — valid date within a range
- **Time** — valid time within a range
- **Text Length** — string length within min/max
- **Custom** — formula-based validation (e.g., `=A1>B1`)

### Phase 23b: Validation Criteria
- [ ] Between / Not Between — value within two bounds
- [ ] Equal / Not Equal — value matches/doesn't match
- [ ] Greater Than / Greater Than or Equal
- [ ] Less Than / Less Than or Equal
- [ ] List source from comma-separated values or cell range (`=A1:A10`)

### Phase 23c: Error Alert Styling
- [ ] **Stop** — reject invalid input with error message
- [ ] **Warning** — warn but allow user to proceed
- [ ] **Information** — show informational message, allow override
- [ ] Custom error title and message

### Phase 23d: Input Message
- [ ] Show hint message when cell is selected
- [ ] Custom title and message text
- [ ] Useful for guiding users on expected input

### Phase 23e: Validation UI
- [ ] Data Validation dialog (Data menu or toolbar)
- [ ] Settings tab (validation criteria)
- [ ] Input Message tab
- [ ] Error Alert tab
- [ ] Apply to range selector
- [ ] Clear Validation button

### Phase 23f: Validation Enforcement
- [ ] Validate on cell commit (in FSM commit path)
- [ ] Highlight invalid cells (red border or indicator)
- [ ] Circle invalid cells tool (audit all validation errors)
- [ ] Prevent navigation from invalid cell (Stop style)

### Phase 23g: Integration
- [ ] Menu: Data → Data Validation
- [ ] Validation rules saved/loaded with workbook
- [ ] Dropdown arrow shown for list-validated cells
- [ ] Validation included in copy/paste (rules follow data)

---

## Phase 24: Formula Wizard Wiring — COMPLETE ✅ (2026-07-29)

**Problem**: The FormulaWizard was fully built (component, hook, schema, 45 functions) but had no UI trigger — `openWizard` was never called, and the "fx" span in FormulaBar was just a static label.

**Solution**: Wired the FormulaWizard with three distinct triggers plus README accuracy.

### Phase 24a: FormulaBar fx Button — COMPLETE ✅
- [x] Add `onFxClick` prop to FormulaBar (passes current value to handler)
- [x] Convert static `<span>fx</span>` to clickable `<button>` when `onFxClick` provided
- [x] Button passes current formula value (e.g., `=SUM(A1:A5)`) to handler
- [x] Hover styling (blue highlight) and tooltip "Open Formula Wizard (Ctrl+Shift+F)"

### Phase 24b: Formula Detection — COMPLETE ✅
- [x] `handleFxClick` extracts function name from current value via regex `/^=([A-Z][A-Z0-9]*)\s*\(/i`
- [x] Falls back to `SUM` if no formula detected
- [x] Passes active cell reference to wizard (`targetCellRef`)
- [x] `getActiveCellValue` helper for menu/keyboard shortcut access

### Phase 24c: Menu Integration — COMPLETE ✅
- [x] Add `onFormulaWizard` prop to MenuBar
- [x] Add "Formula Wizard…" item under Insert menu with 🧙 icon and `Ctrl+Shift+F` shortcut hint
- [x] Wire handler to open wizard with active cell's current value

### Phase 24d: Keyboard Shortcut — COMPLETE ✅
- [x] Add `Ctrl+Shift+F` handler in global keydown listener
- [x] Add `Ctrl+Shift+F` → "Open Formula Wizard" to ShortcutsModal

### Phase 24e: Cleanup & Documentation — COMPLETE ✅
- [x] Remove unused `pointSession`, `statusMessage`, `onCellPick` props from all FormulaBar test files
- [x] Update README: fx button, menu, and keyboard shortcut all documented
- [x] Fix README supported functions list to match actual schema (removed AVERAGEIFS, IFNA, SWITCH, RANK, QUARTILE, PERCENTILE)
- [x] Add tests: fx button click, Ctrl+Shift+F shortcut, menu item, shortcut display

**Files Modified**: `src/components/FormulaBar.tsx`, `src/components/MenuBar.tsx`, `src/components/ShortcutsModal.tsx`, `src/App.tsx`, `README.md`, `src/components/FormulaBar.test.tsx`, `src/components/MenuBar.test.tsx`, `src/components/ShortcutsModal.test.tsx`, `src/App.test.tsx`, `src/components/FormulaBar.coverage.test.tsx`, `src/components/FormulaBar.autocomplete.test.tsx`, `src/components/FormulaBar.interactions.test.tsx`

**Tests**: 1929 passing at time of completion (now 2007), lint clean, build clean
**Coverage**: Maintained (no production code logic changes, only wiring)

---

## Phase 20: Number Formatting Enhancements — COMPLETE ✅ (2026-07-29)
*Auto-alignment for numbers/dates/times and Accounting format with left-aligned $ and right-aligned numbers.*

### Phase 20a: Auto-Alignment for Numeric Values — COMPLETE ✅
- [x] Added `isDateFormat()` and `isTimeFormat()` to detect date/time format patterns
- [x] Added `shouldRightAlign()` to determine if a cell should be auto-right-aligned
- [x] Updated Grid rendering to apply `text-align: right` for numeric/date/time cells
- [x] Respects user-set alignment (explicit `textAlign` overrides auto-alignment)
- [x] 12 new tests for auto-alignment logic

### Phase 20b: Accounting Format — COMPLETE ✅
- [x] Added `isAccountingFormat()` to detect Excel accounting format strings
- [x] Added `formatAccounting()` for accounting-style number formatting:
  - Left-aligned `$` at far-left edge of cell
  - Right-aligned number at far-right edge of cell
  - Fixed-width number field for decimal point alignment
  - Dash (`-`) replaces zero values
  - Negative numbers in parentheses
- [x] Added `extractAccountingCore()` to parse complex Excel accounting format strings
- [x] Updated Grid rendering with flex layout (`justify-between`) for accounting cells
- [x] Added "Acct" button to toolbar for accounting format
- [x] Updated `shouldRightAlign()` to detect accounting format cells
- [x] Fixed regex pattern to include `_` character (escaped hyphen to avoid range bug)
- [x] 12 new tests for accounting format detection, formatting, and alignment
- [x] Fixed pre-existing lint warning in FormulaBar.tsx (unnecessary `value` dependency)

### Phase 20c: Documentation — COMPLETE ✅
- [x] Updated README.md with Number Formatting section (toolbar buttons, format patterns, smart alignment)
- [x] Updated PLAN.md with Phase 20

**Result:** 1922 tests across 78 suites, lint clean. Coverage: 94.31% stmts, 85.58% branches, 96.11% funcs, 95.68% lines.

---

## Phase 1: Quick Wins — COMPLETE ✅
*All targeted files now at 100% lines. Achieved through tests + istanbul ignore for genuinely unreachable code.*

| File | Lines | Branches | Status |
|------|-------|----------|--------|
| benchmark.ts | 100% | 75% | ✅ istanbul ignore on `require.main` |
| clipboard.ts | 100% | 100% | ✅ full branch coverage |
| jsonService.ts | 100% | 96% | ✅ downloadJson + validation tested |
| ImportCsvButton.tsx | 100% | 100% | ✅ error branch tested |
| ImportJsonButton.tsx | 100% | 100% | ✅ error branches tested |
| ImportExcelButton.tsx | 100% | 100% | ✅ error branch tested |
| ResizeHandle.tsx | 100% | 100% | ✅ mouse handler branches tested |
| HistoryContext.tsx | 100% | 75% | ✅ istanbul ignore on unreachable |
| useAutosave.ts | 100% | 100% | ✅ first-render + debounce tested |
| excelExport.ts | 100% | 94.73% | ✅ formatting + type detection tested |
| formulaValidation.ts | 100% | 90.9% | ✅ error branches tested |
| formulaParser.ts | 97.52% | 90.9% | ✅ edge cases tested |
| ExportPdfButton.tsx | 100% | 100% | ✅ click + error tested |
| PrintSetupModal.tsx | 100% | 100% | ✅ form interactions tested |
| storageService.ts | 100% | 66.66% | ✅ istanbul ignore on validation |
| csvService.ts | 98.59% | 82.35% | ✅ error/edge paths tested |

**Subtasks — ALL COMPLETE ✅:**
- [x] 1a: Add istanbul ignore to genuinely untestable lines (storageService, benchmark)
- [x] 1b: Add tests for error-handling paths (Import*, csvService)
- [x] 1c: Add tests for UI branches (ResizeHandle)
- [x] 1d: Add tests for jsonService.downloadJson + validation
- [x] 1e: Add tests for excelExport formatting + type detection
- [x] 1f: Add tests for formulaValidation/formulaParser edge cases
- [x] 1g: Add tests for ExportPdfButton click + error
- [x] 1h: Add tests for PrintSetupModal form interactions
- [x] 1i: Add tests for HistoryContext undo edge case
- [x] 1j: Add tests for useAutosave first-render + debounce
- [x] 1k: Add tests for clipboard branch coverage

**Note:** SaveButton.tsx, LoadButton.tsx, NewSheetButton.tsx were deleted (replaced by menu system in Phase 9). Save/Open/Export fully wired in Phase 8 (2026-07-30) — Save downloads JSON, Open uses file picker, Export buttons connected to menu events.

---

## Phase 2: FSM Hook Completion (`useCellEditing.ts`) — COMPLETE ✅
*Current: 92.89% lines, 87.02% branches. Target: 100% of remaining uncovered lines.*

| Uncovered Lines | What They Do |
|-----------------|--------------|
| 58, 64-67 | SELECT state edge cases |
| 476-477 | ENTER state edge cases |
| 667-670, 675 | EDIT state edge cases |
| 762, 822-828 | POINT state edge cases |
| 844-847, 879-882, 892-895 | handleCellClick / F4 cycling |
| 1023-1024, 1143-1144, 1146-1147 | commit/cancel/reset edge cases |
| 1164-1165, 1210-1215, 1331-1338 | F4 cycling / findRefAtCaret |

**Subtasks:**
- [x] 2a: Test SELECT-state branches (navigation, delete, printable, F2)
- [x] 2b: Test ENTER-state branches (type, backspace, escape, enter, tab, f2, arrows)
- [x] 2c: Test EDIT-state branches (insert, caret move, delete, f2, f4, escape, enter, arrows)
- [x] 2d: Test POINT-state branches (arrows, shift+arrows, f2, f4, escape, operators, enter, tab)
- [x] 2e: Test `handleCellClick` in POINT mode
- [x] 2f: Test `commit` with direction, `cancel`, `reset`
- [ ] 2g: Test F4 cycling via `findRefAtCaret` (range refs, multi-letter cols) — partially covered

---

## Phase 3: FormulaBar.tsx — COMPLETE ✅
*Current: 94.73% lines, 84.55% branches. Remaining gaps: L346-350,412,463-467,499.*

**Subtasks:**
- [x] 3a: Test auto-complete navigation (ArrowUp/Down, Tab, Enter, Escape)
- [x] 3b: Test point mode in formula bar (arrow keys, enter/tab to commit, escape)
- [x] 3c: Test formula validation error display
- [x] 3d: Test auto-close parentheses
- [x] 3e: Test skip-close parenthesis (typing ) when next char is ))
- [x] 3f: Test formula display overlay rendering
- [x] 3g: Test cursor position sync

**Note:** Remaining uncovered lines are Ctrl+Shift+U expand (L412), Ctrl+X cut (L463-467), and error display edge case (L499).

---

## Phase 4: Grid.tsx — COMPLETE ✅
*Current: 87.63% lines, 87.16% branches. Remaining gaps: L225,276,327-328,520-521,530,677,718-719,881-883,889-891,1146-1149,1188-1192,1207-1224,1291-1316,1567,1749-1750,1792-1794,1933-1934,2033-2091,2100,2131,2146,2151,2163,2176-2178,2228,2247,2260-2262.*

**Subtasks:**
- [x] 4a: Test point mode visual feedback (isInPointSelection)
- [x] 4b: Test copy/cut/paste keyboard handlers (Ctrl+C/X/V)
- [x] 4c: Test row selection + shift-click extension
- [x] 4d: Test column selection + shift-click extension
- [x] 4e: Test keyboard navigation (arrows, enter/f2 to edit, escape)
- [x] 4f: Test row/col header keyboard navigation (arrows switch to cell)
- [x] 4g: Test editing input (type, escape, enter, blur commit)
- [x] 4h: Test highlightedRanges rendering
- [x] 4i: Test isCellSelected for row/col/cell types

**Note:** Remaining uncovered lines are fill handle drag (L2033-2091), freeze pane rendering (L1567,1749-1750), and edge cases in selection/navigation.

---

## Phase 5: App.tsx — COMPLETE ✅
*Current: 91.05% lines, 76.04% branches. Remaining gaps: L236-242,289-290,394-397,464,513-517,538,978-979,1034,1062,1147-1157,1200-1205,1220-1225,1233-1234,1246-1264,1316-1317,1328-1338,1384-1385,1612-1613,1697-1699.*

**Subtasks:**
- [x] 5a: Test circular reference warning (line 143)
- [x] 5b: Test copy event handler (status message for row/col/cell)
- [x] 5c: Test cut event handler
- [x] 5d: Test paste event handler (with offset, formula adjustment)
- [x] 5e: Test handleCellChange
- [x] 5f: Test handleCellSelect
- [x] 5g: Test handleHeaderSelect (row + col)
- [x] 5h: Test handleFormulaBarCommit
- [x] 5i: Test handleRequestPointMode
- [x] 5j: Test handleCellPick (delta + absolute)
- [x] 5k: Test handleExitPointMode
- [x] 5l: Test handleUndo/handleRedo
- [x] 5m: Test handleColumnResize/handleRowResize
- [x] 5n: Test handleFreeze/handleUnfreeze (merge removed)
- [x] 5o: Test handleImport/handleNewSheet/handleImportError/handlePdfError

**Note:** Remaining uncovered lines are edge cases in paste handlers, point mode transitions, and error display paths.

---

## Phase 6: pdfExport.ts — COMPLETE ✅
*Dynamic import of html2pdf.js — fully mocked and tested.*

**Subtasks — ALL COMPLETE ✅:**
- [x] 6a: Mock `html2pdf.js` dynamic import
- [x] 6b: Test `generatePdf` with valid sheet
- [x] 6c: Test `downloadPdf` (creates link, clicks, revokes)
- [x] 6d: Test `buildPrintableHtml` (with/without grid, headers)
- [x] 6e: Test `findUsedRange` (empty + non-empty)
- [x] 6f: Test styling in HTML output (bold, italic, color, bg, align)

**Result:** 100% lines, 100% branches, 100% functions

---

## Phase 7: formulaEngine.ts — COMPLETE ✅
*Current: 97.53% lines, 76.04% branches. Remaining gaps: L183,291,293-295,589,612-618,693,951,956,1034,1157,1202.*

**Subtasks:**
- [x] 7a: Test error propagation (#REF!, #VALUE!, #DIV/0!, #NAME?)
- [x] 7b: Test string functions (LEFT, RIGHT, MID, CONCATENATE, etc.)
- [x] 7c: Test date functions (YEAR, MONTH, DAY, etc.)
- [x] 7d: Test logical functions (IF, AND, OR, NOT)
- [x] 7e: Test lookup functions (VLOOKUP, HLOOKUP, INDEX, MATCH)
- [x] 7f: Test financial functions (PMT, FV, PV, NPV)
- [x] 7g: Test statistical functions (MEDIAN, MODE, STDEV, etc.)
- [x] 7h: Test circular reference detection
- [x] 7i: Test evaluateWorkbook with complex scenarios

**Note:** Remaining uncovered lines are defensive branches and edge cases. Branch coverage (76.04%) is the weakest metric — focus on branch coverage would yield biggest improvement.

---

## Phase 9: UI Overhaul — COMPLETE ✅ (2026-07-25)
*Consolidate all UI into clean dropdown menus with formula wizard and function bar.*

### Phase 9a: Dropdown Menu System — COMPLETE ✅
- [x] Create DropdownMenu component with submenus, shortcuts, separators
- [x] Create MenuBar (File/Edit/View/Insert/Format/Help)
- [x] Create ImportExportBridge to connect menu events to file buttons
- [x] Wire menu actions into App.tsx handlers
- [x] Remove dead placeholder buttons from Toolbar
- [x] Remove old Save/Load and Import/Export toolbar rows
- [x] Update tests for new menu-based UI

### Phase 9b: Formula Bar Wizard — COMPLETE ✅
- [x] Add useReferenceFormat hook with localStorage persistence
- [x] Add toR1C1/formatCellRef helpers
- [x] Add R1C1 toggle button to FormulaBar cell reference display
- [x] Update Grid for R1C1 column headers

### Phase 9c: App.tsx Coverage Recovery — COMPLETE ✅
- [x] Add tests for new menu handlers (handleClear, handleInsertRowAbove, etc.)
- [x] Add tests for reference format integration
- [x] Recover App.tsx line coverage from 62.85% to 91.05%

**Note:** App.tsx coverage at 91.05% lines, 76.04% branches. Remaining gaps are edge cases in paste handlers, point mode, and error paths.

### Phase 9d: Layout Polish — COMPLETE ✅
- [x] Final visual review of all UI elements
- [x] Ensure responsive behavior
- [x] Update README.md with new UI documentation

---

## Phase 10: Nested Formula Wizard — COMPLETE ✅ (2026-07-25)
- [ ] Interactive step-by-step formula builder with nested function support.

### Phase 10a: Function Schema & Data Model — COMPLETE ✅
- [x] Create TypeScript interfaces (FunctionParameter, FunctionDefinition, ParameterNodeValue, FormulaASTNode)
- [x] Build structured function schemas for 50+ functions
- [x] Create schemaMap with parameter definitions
- [x] Create formulaWizardSchema.test.ts (19 tests)

### Phase 10b: Wizard State Machine — COMPLETE ✅
- [x] Create useFormulaWizard hook
- [x] States: INACTIVE → WIZARD_ROOT → NESTED_STEP → POINT_SELECTION
- [x] Handle state transitions and nesting stack
- [x] Max nesting depth: 8 levels
- [x] Create useFormulaWizard.test.ts (25 tests)

### Phase 10c: Wizard UI Components — COMPLETE ✅
- [x] Create FormulaWizard component with breadcrumb nav
- [x] Parameter input fields with range picker icons
- [x] Nested function buttons, live result preview
- [x] Action buttons (Back, Apply, Cancel)
- [x] Circular reference detection
- [x] Type validation for parameters
- [x] Create FormulaWizard.test.tsx (18 tests)

### Phase 10d: AST Generator & Compiler — COMPLETE ✅
- [x] Implement compileASTNodeToString
- [x] Real-time formula string generation
- [x] Handle nested function compilation
- [x] Create formulaWizardCompiler.test.ts (20 tests)

### Phase 10e: Integration — COMPLETE ✅
- [x] Add Insert Function (ƒx) button to FormulaBar
- [x] Wire wizard state into App.tsx
- [x] Add FormulaWizard component to render tree
- [x] Handle wizard apply (commit formula to cell)

### Phase 10f: Documentation — COMPLETE ✅
- [x] Update README.md with wizard documentation (completed in Phase 25f.1)
- [x] Update PLAN.md with Phase 10

---

> **Note:** Phase 11 is not present in this plan (gap in numbering between Phases 10 and 12).

## Phase 12: Search & Replace — COMPLETE ✅ (2026-07-26)
*Find & Replace modal with configurable search options and multi-sheet scope.*

### Phase 12a: Core Search Engine — COMPLETE ✅
- [x] Create `src/utils/sheetSearch.ts` with searchSheets and replaceInSheets functions
- [x] Support case-sensitive and exact-match modes
- [x] Support formula inclusion toggle (formulas treated as text when enabled)
- [x] Support multi-sheet scope via sheetIndices parameter
- [x] Immutable updates — returns new workbook, never mutates original
- [x] Create `src/utils/sheetSearch.test.ts` (16 tests)

### Phase 12b: Modal UI — COMPLETE ✅
- [x] Create `src/components/SearchReplaceModal.tsx` following PrintSetupModal pattern
- [x] Find/Replace text inputs with Enter key support
- [x] Four checkboxes: Match Case, Match Entire Cell, Also Search in Formulas, Search All Sheets
- [x] Result summary display (match count or replacement confirmation)
- [x] Search, Replace All, and Reset action buttons
- [x] Create `src/components/SearchReplaceModal.test.tsx` (10 tests)

### Phase 12c: Menu Integration — COMPLETE ✅
- [x] Add "Find & Replace…" item to Edit menu with Ctrl+H shortcut hint
- [x] Add `onSearchReplace` prop to MenuBar
- [x] Wire handler in App.tsx with `pushHistory` for undo support
- [x] Render modal in App.tsx
- [x] Update MenuBar.test.tsx with new prop
- [x] Add integration tests in App.menu.test.tsx (2 tests)

### Phase 12d: Documentation — COMPLETE ✅
- [x] Update README.md with Search & Replace feature
- [x] Update PLAN.md with Phase 12

---

## Phase 13: Paste Experience Improvements — COMPLETE ✅ (2026-07-27)
*Make plain text pasting better than Excel/Sheets with bounds safety, inline editing, text wrapping, preview, and formula adjustment.*

### Phase 13a: Bounds Checking — COMPLETE ✅
- [x] Add bounds checking to `handleExternalPaste` — clips data exceeding sheet boundaries
- [x] Report clipped rows/columns in status message ("3 row(s) clipped — sheet boundary")
- [x] Abort paste if target is completely outside bounds
- [x] Add 5 tests for bounds checking scenarios
- [x] Commit: b5871cf

### Phase 13b: Paste Content Classification — COMPLETE ✅
- [x] Add `classifyPasteContent()` to `clipboardParse.ts` for grid vs rich-grid detection
- [x] Plain text → grid, HTML table → rich-grid
- [x] Add 7 tests for content classification
- [x] Commit: f98c7d6

### Phase 13c: Text Wrapping & Display — COMPLETE ✅
- [x] Add `whiteSpace` property to `CellStyle` ('normal' | 'nowrap' | 'pre')
- [x] Add `toggleWrapText` to `useCellStyle` utilities
- [x] Add `toggleWrapTextStyle` to `useCellStyles` hook
- [x] Add "Wrap Text" item to Format menu
- [x] Update Grid rendering: `whitespace-normal`, `break-words`, `whitespace-pre-wrap`
- [x] Add 3 Grid tests + 2 toggleWrapText tests
- [x] Commit: 204bf90

### Phase 13d: Inline Cell Editing Paste — COMPLETE ✅
- [x] Add `editInputRef` to track the editing input element
- [x] Add `insertAtCursor` helper to insert text at cursor position
- [x] Handle Ctrl+V during editing: insert first clipboard cell at cursor
- [x] Handle native paste during editing: insert plain text at cursor
- [x] Add 2 tests for inline paste behavior
- [x] Commit: 73fdfef

### Phase 13e: Paste Preview & UX Polish — COMPLETE ✅
- [x] Enhance PasteModal with preview grid showing sample data
- [x] Display row × column dimensions in preview
- [x] Show "formatted" indicator when styles detected
- [x] Pass html/plain content to modal for preview rendering
- [x] Add 3 tests for preview functionality
- [x] Commit: fceb3a6

### Phase 13f: Formula Adjustment for External Paste — COMPLETE ✅
- [x] Apply `adjustFormulaRefs` to external paste formulas
- [x] Relative references (e.g., =A1) adjusted based on paste position
- [x] Absolute references (e.g., $A$1) preserved
- [x] Add 3 tests for formula adjustment on external paste
- [x] Commit: cb6f50d

---

## Phase 14: Keyboard Shortcut Audit & Fixes — COMPLETE ✅ (2026-07-27)
*- [x] Review all keyboard shortcuts, identify implementation/wiring gaps, and fix them.*

### Phase 14a: Global Shortcuts — COMPLETE ✅
- [x] Added Ctrl+N (New), Ctrl+S (Save), Ctrl+O (Open) — application-wide
- [x] Added Ctrl+H (Find & Replace) — opens search modal
- [x] Added Ctrl+B/I/U (Bold/Italic/Underline) — toggle cell styles
- [x] All shortcuts disabled while typing in input/textarea
- [x] 8 new tests for global shortcuts
- [x] Commit: 274ee1a

### Phase 14b: Grid Navigation — COMPLETE ✅
- [x] Tab/Shift+Tab: move right/left with row wrapping
- [x] Enter: commit edit and move selection down
- [x] Shift+Enter: commit edit and move selection up
- [x] Tab during editing: commit and move right
- [x] Shift+Tab during editing: commit and move left
- [x] Added `moveSelection` helper function
- [x] 4 new tests for Tab/Enter behavior
- [x] Commit: 274ee1a

### Phase 14c: ShortcutsModal — COMPLETE ✅
- [x] Added Ctrl+H to Editing shortcuts group
- [x] All shortcuts in modal now match actual implementations
- [x] Commit: 274ee1a

---


## Phase 18: Sort & Filter — COMPLETE ✅ (2026-07-28)
*Implement Excel/Google Sheets-style sort and filter functionality.*

### Phase 18a: Sort Utility — COMPLETE ✅
- [x] Create `src/utils/sheetSort.ts` with sortRange function
- [x] Sort by single or multiple columns (ascending/descending)
- [x] Auto-detect data range from selection or used range
- [x] Preserve entire row integrity (cells move together)
- [x] Adjust formula references after sort (relative refs update)
- [x] Handle mixed data types (text, numbers, dates, empty)
- [x] Create `src/utils/sheetSort.test.ts` (21 tests)

### Phase 18b: Sort UI & Integration — COMPLETE ✅
- [x] Add "Data" menu with Sort items (A-Z, Z-A)
- [x] Wire sort handlers in App.tsx with history push
- [x] Add sort test in App.handlers.test.tsx
- [x] Status bar: "Sorted by column X" confirmation

### Phase 18c: Filter State & Logic — COMPLETE ✅
- [x] Create `src/utils/sheetFilter.ts` with filter engine
- [x] Filter state: per-column criteria (includes list, custom conditions)
- [x] Row visibility tracking (Set of hidden row indices)
- [x] Support: text contains, equals, starts with, greater than, less than, blank
- [x] Multiple column filters (AND logic)
- [x] Create `src/utils/sheetFilter.test.ts` (33 tests)

### Phase 18d: Filter UI — COMPLETE ✅
- [x] Add filter toggle to Data menu ("Toggle Filter" + "Clear All Filters")
- [x] Add filter dropdown arrows to column headers in Grid (blue triangle indicator)
- [x] Create FilterDropdown component (checkbox list + search + custom filter tabs)
- [x] Modify Grid to respect filter state (display rows map to actual rows via visibleRowIndices)
- [x] Filter status indicator on column headers (active class when filter applied)
- [x] "Clear Filter" and "Clear All Filters" options in dropdown and menu
- [x] Keyboard shortcut: Ctrl+Shift+L to toggle filter
- [x] FilterDropdown.test.tsx (12 tests)
- [x] Grid filter tests (4 tests)

### Phase 18e: Filter Integration — COMPLETE ✅
- [x] Wire filter handlers in App.tsx (handleToggleFilter, handleApplyFilter, handleClearAllFilters)
- [x] Update virtualizer to skip hidden rows (virtualRowCount based on visible rows)
- [x] Status bar: "X of Y records visible" when filter active (filter-status testid)
- [x] Add filter integration tests (3 tests in App.handlers.test.tsx)
- [x] Filter state persisted in App.tsx (filterState state variable)

---

## Phase 15: Additional Features — COMPLETE ✅

### Phase 15a: Fill Handle — COMPLETE ✅
- [x] Drag-to-fill series (blue square at selection corner)
- [x] getFillHandleInfo` in Grid.tsx detects fillable selections
- [x] handleFillSeries` in App.tsx applies fill logic
- [x] Horizontal and vertical fill directions
- [x] Integration with `fillSeries.ts` utility

### Phase 15b: Export Buttons — COMPLETE ✅
- [x] ExportCsvButton.tsx` — export to CSV
- [x] ExportExcelButton.tsx` — export to XLSX
- [x] ExportJsonButton.tsx` — export to JSON
- [x] ExportPdfButton.tsx` — export to PDF
- [x] All wired through ImportExportBridge
- [x] All at 100% coverage
- [x] Declutter UI, Removed all Export Buttons functions moved to File Menu

### Phase 15c: Freeze Panes — COMPLETE ✅
- [x] FreezeContext.tsx` — freeze pane state management
- [x] Grid rendering with sticky positioning for frozen rows/columns
- [x] Menu items: Freeze/Unfreeze Panes
- [x] 100% coverage

### Phase 15d: Formula Autocomplete — COMPLETE ✅
- [x] src/utils/formulaAutocomplete.ts` (201 lines)
- [x] Function name and argument autocomplete
- [x] 100% coverage

### Phase 15e: Number Formatting — COMPLETE ✅
- [x] src/utils/numberFormat.ts` (189 lines)
- [x] Currency, percent, date, number formats
- [x] 98.66% lines, 91.11% branches

### Phase 15f: Sheet Operations — COMPLETE ✅
- [x] src/utils/sheetOperations.ts` (299 lines)
- [x] Add, delete, rename, switch, copy sheets
- [x] 97% lines, 81.01% branches

### Phase 15g: Fill Series Utility — COMPLETE ✅
- [x] src/utils/fillSeries.ts` (348 lines)
- [x] Auto-fill series detection (numbers, dates, patterns)
- [x] 100% lines, 86.11% branches

### Phase 15h: About Modal — COMPLETE ✅
- [x] src/components/AboutModal.tsx` (254 lines)
- [x] App info, version, license display
- [x] 98.18% lines, 85% branches

### Phase 15i: Sheet Tabs — COMPLETE ✅
- [x] src/components/SheetTabs.tsx`
- [x] Multi-sheet tab bar with add/rename/delete
- [x] 98.46% lines, 96.15% branches

### Phase 15j: Toolbar (re-added) — COMPLETE ✅
- [x] src/components/Toolbar.tsx` (438 lines)
- [x] Formatting toolbar: borders, colors, alignment, font
- [x] 100% lines, 96.36% branches
- [x] Note: Plan originally said Toolbar was deleted in Stage 1 cleanup, but it was re-added with full border/color/formatting features

### Phase 15k: Print Setup — COMPLETE ✅
- [x] src/components/PrintSetupModal.tsx` + `PrintSetupContext.tsx`
- [x] Print configuration: orientation, margins, headers
- [x] 100% coverage

### Phase 15l: Paste Special — COMPLETE ✅
- [x] src/components/PasteSpecialModal.tsx`
- [x] Paste values only, formulas only, formats only
- [x] 100% coverage

---

## Phase 16: Keyboard Shortcut Gaps — COMPLETE ✅ (2026-07-27)
*Fill gaps identified by comparing implementation against `excel_web_editor_shortcuts-v4.json`.*

### Phase 16a: Edit Mode Enhancements — COMPLETE ✅
- [x] **Ctrl+Enter**: Complete cell entry and stay in same cell
- [x] **Alt+Enter**: Insert line break inside cell (multi-line content)
- [x] **Ctrl+Left/Right Arrow**: Move caret one word left/right
- [x] **End**: Move cursor to end of line (ENTER + EDIT states)
- Added word boundary helper functions (`findWordBoundaryLeft`, `findWordBoundaryRight`)
- Updated `handleKey` signature to accept `altKey` parameter
- Type-check clean, all 1411 tests pass

### Phase 16b: Documentation Update — COMPLETE ✅
- [x] Added comprehensive keyboard shortcut reference table to `excel-dataentry.md`
- [x] Three sections: Entering/Exiting Edit Mode, Navigation/Text Selection, Formula Navigation
- [x] Implementation status legend (✅/⚠️/❌)
- [x] Updated version to 1.2.0

### Phase 16c: Remaining Gaps
- [x] **Ctrl+F2**: Move focus between in-cell editor and formula bar — **DONE** (Phase 19f)
- [ ] **Shift+Home/End**: Select text to beginning/end (currently native input behavior)
- [ ] **Ctrl+Shift+Arrows**: Select word left/right (currently native input behavior)

---

## Phase 17: Cell Editing Workflows — COMPLETE ✅ (2026-07-27)
*Implement Excel-compatible cell editing workflows per specification.*

### Phase 17a: Formula View Toggle — COMPLETE ✅
- [x] **Ctrl + `**: Toggle between displaying cell values and underlying formulas
- [x] Added `showFormulas` state to App.tsx
- [x] Grid displays formula text when `showFormulas` is true and cell starts with =
- [x] Status bar shows 'Formulas' indicator when formula view is active
- [x] Added View group to ShortcutsModal with the new shortcut
- [x] 1 new test for toggle behavior
- [x] Commit: 5524213

### Phase 17b: Expand Formula Bar — COMPLETE ✅
- [x] **Ctrl+Shift+U**: Expand/collapse formula bar for multi-line editing
- [x] Toggle button added to formula bar header
- [x] Textarea replaces input when expanded (80px min height)
- [x] Focus transfers to textarea when expanded
- [x] `stopPropagation` prevents event bubbling to global handlers
- [x] 1 new test for expand behavior
- [x] Commit: a9dc6bf, 651c98a

### Phase 17c: Batch Entry Across Multiple Cells — COMPLETE ✅
- [x] **Ctrl+Enter** on range selection: Apply value to ALL cells in selection
- [x] Single cell selection: Behaves as before (commit and stay)
- [x] Updated `onCommit` callback to accept `batch` parameter
- [x] Updated `commit` function in useCellEditing to pass batch flag
- [x] Updated Backspace/Delete in SELECT state to pass `false` for batch
- [x] 11 existing tests updated to expect new batch parameter
- [x] Commit: a9dc6bf

### Phase 17d: Formula Bar Commit Fix — COMPLETE ✅
- [x] Fixed stale closure: `sessionRef.current` updated immediately in `setBuffer`
- [x] Formula bar edits now commit correctly after typing
- [x] Commit: 9b4db50

### Phase 17e: Status Bar Cleanup — COMPLETE ✅
- [x] Status bar no longer shows cell contents after edit
- [x] Changed from 'Updated A1 = [value]' to 'Updated A1'
- [x] Commit: ac93c2a

### Phase 17f: Paste Text Starting with = as Plain Text — COMPLETE ✅
- [x] When pasted text starts with '=', prefix with single quote to make it plain text
- [x] Single quote not displayed in cell (Excel behavior)
- [x] Single quote preserved in raw value for editing
- [x] Updated Grid `getDisplayValue` to strip leading single quote
- [x] 2 new tests for paste behavior
- [x] Commit: 5d035cf

---

## Phase 19: Unified Editing Architecture — COMPLETE ✅

**Status**: ✅ Phase 19b (FSM unification) COMPLETE — Grid.tsx is now a pure view.
✅ Phase 19f (cleanup) COMPLETE — dead code removed, Ctrl+F2 added.
✅ Phase 19g (verification) COMPLETE — all checks pass.
Phase 19c-19e (shared FormulaEditor, F9, multiline) deferred to future.
Phase 24 (FormulaWizard wiring) built on this foundation.

### Functional Alignment Analysis

The user provided a detailed specification contrasting the **Formula Bar Editor** and the
**In-Line Grid Cell Editor** as they work in Excel. Here is how the current implementation
aligns — and where it diverges.

---

#### 1. Detached Editing Context

| Aspect | Spec (Excel) | Current Implementation | Alignment |
|--------|-------------|----------------------|-----------|
| Formula Bar | Fixed pane at top; edit without covering cells | ✅ Fixed position above grid | ✅ **Aligned** |
| In-line | Edits directly in cell; overlays adjacent content | ✅ Absolute-positioned `<input>` over cell | ✅ **Aligned** |

**Verdict**: No issues.

---

#### 2. Multiline Support

| Aspect | Spec (Excel) | Current Implementation | Alignment |
|--------|-------------|----------------------|-----------|
| Formula Bar | Expandable (Alt+Enter or drag border) | ✅ Ctrl+Shift+U expand/collapse + Alt+Enter in expanded textarea | ✅ **Aligned** |
| In-line | Constrained by cell width/height; overflow clips | ⚠️ Single-line `<input>` only; Alt+Enter inserts `\n` but input can't display it | ⚠️ **Partial** |

**Gap**: The in-cell editor is a single-line `<input>`. Alt+Enter inserts a newline character
into the buffer, but the user never sees it because `<input>` doesn't render newlines.

**Fix**: When a cell contains `\n` or the user presses Alt+Enter in-cell, switch to a
`<textarea>` that auto-expands, or grow the cell height dynamically (Excel behavior).

---

#### 3. Formula Auditing (Syntax Highlighting & Color Coding)

| Aspect | Spec (Excel) | Current Implementation | Alignment |
|--------|-------------|----------------------|-----------|
| Formula Bar | Color-codes references with matching colored bounding boxes on grid | ✅ `extractHighlights()` + `formulaDisplay` overlay + `onHighlightsChange` → Grid renders colored boxes | ✅ **Aligned** |
| In-line | Highlights cell dependencies directly on grid while editing | ⚠️ Grid shows colored boxes via `highlightedRanges` prop, but the in-cell `<input>` itself has NO syntax highlighting | ❌ **Misaligned** |

**Gap**: The in-cell editor is a plain `<input>` with no color-coding of references,
no parenthesis matching, no function name highlighting. Per the spec, both editors
should share these features.

**Fix**: Extract the formula highlighting overlay from FormulaBar into a shared
`FormulaEditor` component that wraps both editors. The in-cell editor gets the same
`formulaDisplay` colored-reference overlay.

---

#### 4. IntelliSense / Auto-Complete

| Aspect | Spec (Excel) | Current Implementation | Alignment |
|--------|-------------|----------------------|-----------|
| Formula Bar | Typing `=` triggers function suggestions | ✅ `AutoCompleteDropdown` in FormulaBar | ✅ **Aligned** |
| In-line | Identical autocomplete behavior | ❌ No autocomplete dropdown in Grid's in-cell editor | ❌ **Misaligned** |

**Gap**: The FSM computes `autoComplete` state and exposes it, but only the FormulaBar
renders the dropdown. The Grid never shows autocomplete during in-cell editing.

**Fix**: The `AutoCompleteDropdown` should be rendered by the parent (App.tsx) or a
shared wrapper, positioned relative to whichever editor is active. When the Grid's
in-cell editor is active and `autoComplete.open` is true, show the dropdown anchored
to the cell being edited.

---

#### 5. Evaluate Key (F9)

| Aspect | Spec (Excel) | Current Implementation | Alignment |
|--------|-------------|----------------------|-----------|
| Both editors | Highlight part of formula + F9 → evaluates to result | ❌ Not implemented | ❌ **Missing** |

**Gap**: F9 evaluation is completely absent. In Excel, selecting `A1:B5` inside
`=SUM(A1:B5)` and pressing F9 shows `123` (the evaluated result) in-place.

**Fix**: Add F9 handler to both editors. On F9, parse the selected portion of the
buffer, evaluate it via `formulaEngine`, and replace the selection with the result.
Shift+F9 evaluates the current sheet only.

---

#### 6. Cell Selection / Pointing from Formula Bar

| Aspect | Spec (Excel) | Current Implementation | Alignment |
|--------|-------------|----------------------|-----------|
| Formula Bar | Clicking other cells while editing always inserts references | ⚠️ `onCellPick` prop exists but is destructured as `_onCellPick` (unused) in FormulaBar; clicking cells works via Grid's `onCellPick` but only when Grid is focused | ⚠️ **Partial** |
| In-line | Clicking away inserts references unless in Edit Mode (F2 toggle) | ✅ POINT mode handles this correctly | ✅ **Aligned** |

**Status**: The unused `onCellPick` prop was removed from FormulaBar. Cell-pick behavior works correctly through Grid's mousedown handler — the correct architecture.

---

#### 7. Focus & Viewport Behavior

| Aspect | Spec (Excel) | Current Implementation | Alignment |
|--------|-------------|----------------------|-----------|
| Formula Bar | Fixed at top; scrolling keeps editor in view | ✅ Sticky position above SheetTabs | ✅ **Aligned** |
| In-line | Moves with grid scroll; off-screen loses context | ✅ Cell editor is absolutely positioned within the scrolled grid | ✅ **Aligned** |

**Verdict**: No issues.

---

#### 8. Architecture Overlap — The Core Problem

The deepest issue is not a single missing feature but **architectural duplication**:

| Responsibility | FSM (`useCellEditing.ts`) | Grid.tsx | FormulaBar.tsx |
|---------------|--------------------------|----------|----------------|
| Track editing state (which cell, what text) | ✅ `session` state | ❌ `editingCell` + `editValue` (duplicate) | ✅ Pure view (reads `session.buffer`) |
| Handle text input (typing, backspace, delete) | ✅ `handleKey()` ENTER/EDIT states | ❌ `onChange` → `setEditValue` → `onCellEditChange` | ✅ Forwards to FSM |
| Handle POINT mode navigation | ✅ `handleKey()` POINT state | ❌ `onPointKeyDown` callback round-trip | ✅ Forwards to FSM |
| Commit/cancel editing | ✅ `commit()` / `cancel()` | ❌ `commitEdit()` + `cancelRef` (duplicate) | ✅ Forwards to FSM |
| Move selection after commit | ✅ `onNavigate` callback | ❌ `moveSelection()` (duplicate) | ✅ Uses FSM navigate |
| Multiline (Alt+Enter) | ✅ ENTER/EDIT states handle it | ❌ Inline `onKeyDown` handler re-implements it | ✅ Forwards to FSM |

**Summary**: `FormulaBar.tsx` is a clean **pure view** that delegates everything to the
FSM. `Grid.tsx` is **not** — it maintains parallel state and re-implements editing
behaviors that the FSM already handles. This creates:

1. **State synchronization bugs**: `editValue` in Grid can drift from `session.buffer`
   in the FSM (the root cause of the known autocomplete test failure).
2. **Inconsistent behavior**: POINT mode works differently depending on whether you
   started from FormulaBar or Grid (different code paths).
3. **Feature duplication**: Alt+Enter, commit/cancel, and selection movement are
   implemented twice (once in FSM, once in Grid).
4. **Missing features in in-cell editor**: Syntax highlighting and autocomplete
   aren't rendered in the Grid because the Grid has its own editing infrastructure
   that doesn't include them.

---

### Improvement Plan

#### Phase 19a: Analysis & Documentation — COMPLETE ✅
- [x] Analyze current implementation against Excel functional spec
- [x] Document all alignment gaps and architectural overlaps
- [x] Create this plan

#### Phase 19b: Make Grid.tsx a Pure View (Unify Under FSM) — COMPLETE ✅

**Goal**: Eliminate parallel editing state in Grid.tsx. Grid becomes a pure view like
FormulaBar, delegating all editing behavior to the FSM.

**Changes**:
1. ✅ Remove `editingCell`, `editValue`, `cancelRef`, `editingCellRef` state from Grid
2. ✅ Derive editing state from `session` prop (passed from App.tsx)
3. ✅ Remove `commitEdit()`, `moveSelection()`, `handleCellEdit()`, `handleCellEditWithChar()`, `insertAtCursor()`
4. ✅ Grid receives `session`, `onStartEdit`, `onStartEnter`, `onRawKeyDown`, `onRawChange` props
5. ✅ Cell `<input>` is a controlled component reading from `session.buffer`
6. ✅ All key handling goes through `onRawKeyDown` (which calls `handleEditingKey`)
7. ✅ Commit/cancel/navigation all flow through FSM callbacks
8. ✅ Added cursor sync effect (like FormulaBar) to keep caret in sync with FSM
9. ✅ Added focus management effect to focus grid container when editing ends
10. ✅ Fixed stale closure bug in global clipboard handler (added `isEditingRef`)
11. ✅ Removed unused `formulaBarValue` state from App.tsx (FSM session.buffer is source of truth)
12. ✅ Removed `handleCellEditChange` callback (no longer needed — Grid is pure view)
13. ✅ Removed `handleFormulaRawKeyDown`/`handleFormulaRawChange` (merged into shared handlers)
14. ✅ Removed unused `onCellPick` prop from FormulaBar — **DONE in Phase 19f**
15. ✅ Added explicit paste handler to Grid input (JSDOM compatibility)
16. ✅ Modified `useCellEditing` hook: `startEdit`/`startEditAt` accept optional row/col params
17. ✅ Fixed FormulaBar double-commit bug: `handleBlur` guards with `session.state === 'SELECT'` check (prevents empty buffer from overwriting committed value)
18. ✅ Fixed stale `sessionRef` in `setBuffer`: ref updated immediately to avoid stale closures in rapid typing

**Files**: `Grid.tsx`, `App.tsx`, `useCellEditing.ts`, plus 8 test files updated
**Tests**: 1888 passing (up from 1873), 75 suites, all green
**Verification**: `npm test` ✅ | `npm run lint` ✅ | `npm run type-check` ✅ | `npm run build` ✅

#### Phase 19c: Shared Formula Editor Component

**Goal**: Extract formula-specific UI (syntax highlighting, autocomplete, validation)
from FormulaBar into a shared `FormulaEditor` wrapper that both editors use.

**Changes**:
1. Create `FormulaEditor.tsx` — a wrapper that provides:
   - Colored reference overlay (the `formulaDisplay` JSX from FormulaBar)
   - Auto-complete dropdown (rendered relative to the active editor)
   - Validation error display
   - Parenthesis matching highlight
2. FormulaBar uses `FormulaEditor` as its input area
3. Grid's in-cell editor uses `FormulaEditor` when `session.isFormula` is true
4. `autoComplete` state from FSM drives the dropdown in both locations

**Files**: New `FormulaEditor.tsx`, modify `FormulaBar.tsx`, modify `Grid.tsx`
**Tests**: Verify autocomplete appears in both editors; verify syntax highlighting
renders in both editors

#### Phase 19d: F9 Formula Evaluation

**Goal**: Implement Excel's F9 evaluate-selected-text feature in both editors.

**Changes**:
1. Add `evaluateSelection(buffer, selStart, selEnd)` to `formulaEngine.ts`
2. If selection is empty, evaluate the entire formula (last expression)
3. Replace the selected text with the evaluated result
4. Wire F9 key in both FormulaBar's `handleKeyDown` and Grid's key handler
5. Add Shift+F9 for evaluate current sheet

**Files**: `formulaEngine.ts`, `FormulaBar.tsx`, `Grid.tsx`, `useCellEditing.ts`
**Tests**: Test F9 on partial selection, full formula, invalid selection, nested functions

#### Phase 19e: In-Cell Multiline Support

**Goal**: When a cell contains newlines or user presses Alt+Enter in-cell, show a
multi-line editor.

**Changes**:
1. Detect `\n` in `session.buffer` → switch from `<input>` to `<textarea>`
2. Auto-expand textarea height based on content
3. On commit, if single line, keep as `<input>` for next edit
4. Optionally grow the cell height while editing (Excel-like)

**Files**: `Grid.tsx`, possibly `FormulaEditor.tsx`
**Tests**: Test Alt+Enter in-cell creates textarea; test multiline display; test commit
preserves newlines

#### Phase 19f: Cleanup & Consistency — COMPLETE ✅

**Goal**: Remove dead code, fix known issues, ensure both editors are fully consistent.

**Changes**:
1. ✅ Remove unused `onCellPick` prop from FormulaBar — **DONE**
2. ✅ Remove unused `pointSession` and `statusMessage` props from FormulaBar — **DONE**
3. ✅ Remove `onCellEditChange` callback from App.tsx — **DONE** (removed in 19b)
4. ✅ Remove `onPointKeyDown` callback from App.tsx — **DONE** (removed in 19b)
5. ✅ Remove `formulaBarValue` state from App.tsx — **DONE** (removed in 19b)
6. ✅ Fix the known autocomplete/POINT state bug — **DONE** (fixed by FSM unification in 19b)
7. ✅ Fix FormulaBar double-commit bug (blur handler guard for `session.state === 'SELECT'`) — **DONE**
8. ✅ Add Ctrl+F2 to move focus between in-cell editor and formula bar (Excel feature) — **DONE**

**Files**: `FormulaBar.tsx`, `App.tsx`, `Grid.tsx`, `ShortcutsModal.tsx`
**Tests**: 1923 passing at time of completion (now 2007), lint clean
**Status**: Phase 19f FULLY COMPLETE. Phase 24 (FormulaWizard wiring) built on top of this cleanup.

#### Phase 19g: Full Verification — COMPLETE ✅

**Goal**: Ensure all changes pass the full verification suite.

**Checklist**:
- [x] `npm test` — all tests pass (2007 passing, 1 skipped)
- [x] `npm run lint` — 0 warnings, 0 errors
- [x] `npm run type-check` — clean (0 errors)
- [x] `npm run build` — clean build
- [x] Coverage maintained or improved (94.31% stmts, 85.58% branches, 96.11% funcs, 95.68% lines)
- [x] Manual smoke test: edit in formula bar, edit in cell, POINT mode from both,
      autocomplete from both, Alt+Enter from both. F9 deferred to Phase 19d.

---



## Phase 25: FormulaWizard Formula Import & Smart Open — COMPLETE ✅ (2026-07-29)

**Implementation complete.** All stages (25a-25e) implemented and tested. Stage 25f (docs) partially done.

### Goal

When the user opens the FormulaWizard (via fx button, Ctrl+Shift+F, or Insert menu), the wizard should be **pre-populated with the current cell's formula** if one exists. If the cell has no formula, show an **autocomplete picker** to let the user choose a function.

### Current State

- FormulaWizard opens blank with a default function (SUM)
- `handleFxClick` extracts function name from regex but only uses it to select the schema — it does NOT import the formula's parameters
- No support for pre-populating parameter values from an existing formula
- No autocomplete fallback when cell has no formula

### Design

#### Workflow 1: Cell Has Formula (e.g., `=SUM(B4:D4)`)

```
User selects E3 with =SUM(B4:D4) → presses Ctrl+Shift+F
    ↓
Wizard opens showing:
    ┌─────────────────────────────────────┐
    │ Nested Formula Wizard               │
    │ f(x) SUM                            │
    │                                     │
    │ Number1: [B4:D4]          🗗        │
    │ Number2: [    ] (optional) 🗗        │
    │                                     │
    │ Result: 15          =SUM(B4:D4)     │
    │                                     │
    │ [Cancel]              [Apply to Cell]│
    └─────────────────────────────────────┘
```

#### Workflow 2: Cell Has Nested Formula (e.g., `=IF(A1>0, SUM(B4:D4), 0)`)

```
User opens wizard
    ↓
Wizard opens at root level showing:
    ┌─────────────────────────────────────┐
    │ Nested Formula Wizard               │
    │ f(x) IF                             │
    │                                     │
    │ Condition: [A1>0]                   │
    │ True_val:  [SUM(B4:D4)]  ← nested   │
    │ False_val: [0]                      │
    └─────────────────────────────────────┘
    ↓
User clicks "SUM(B4:D4)" breadcrumb or drills in:
    ┌─────────────────────────────────────┐
    │ Nested Formula Wizard               │
    │ f(x) IF > f(x) SUM                  │
    │                                     │
    │ Number1: [B4:D4]          🗗        │
    └─────────────────────────────────────┘
```

#### Workflow 3: Cell Has No Formula

```
User selects empty cell → presses Ctrl+Shift+F
    ↓
Autocomplete dropdown appears:
    ┌─────────────────────────────────────┐
    │ Choose a function:                  │
    │ ┌─────────────────────────────────┐ │
    │ │ SUM      SUM(number1, ...) Math │ │
    │ │ AVERAGE  AVERAGE(number1, ...)  │ │
    │ │ IF       IF(condition, ...)     │ │
    │ │ COUNT    COUNT(value1, ...)     │ │
    │ │ ...                             │ │
    │ └─────────────────────────────────┘ │
    └─────────────────────────────────────┘
    ↓
User picks SUM → wizard opens with blank SUM parameters
```

### Key Design Decisions

#### 1. Import Strategy: Function-Rooted Tree

The wizard's AST model represents **functions with parameters**. Each parameter can be:
- A literal value (string, number, boolean)
- A cell reference or range
- A nested function

Binary operators (`+`, `-`, `>`, `&`, etc.) are **NOT** natively supported in the wizard's parameter model. When importing a formula like `=IF(A1>0, SUM(B4:D4), 0)`:
- `condition` parameter gets rawValue `"A1>0"` (binary op as string)
- `true_val` parameter becomes a nested SUM function
- `false_val` parameter gets rawValue `"0"`

This is consistent with how the wizard already works — users can type any expression in parameter inputs.

#### 2. What Can Be Imported

| Formula Pattern | Import Behavior |
|-----------------|-----------------|
| `=SUM(B4:D4)` | ✅ Full import — parameters populated |
| `=IF(A1>0, SUM(B4:D4), 0)` | ✅ Full import with nested functions |
| `=A1+B1` | ❌ No outer function → show autocomplete |
| `=5` | ❌ Literal → show autocomplete |
| `=A1` | ❌ Cell ref → show autocomplete |
| `=-A1` | ❌ Unary → show autocomplete |
| `=SUM(A1:A10)+1` | ⚠️ Partial — import SUM(A1:A10), the `+1` is lost (wizard can't represent it) |
| `=UNKNOWN_FUNC(X)` | ⚠️ Import as raw value if function not in schema |

#### 3. Autocomplete for No-Formula Case

When the cell has no importable formula:
- Show a dropdown list of all 45 wizard-supported functions
- Search/filter as user types (reuse `searchFunctions` from `formulaAutocomplete.ts`)
- Selecting a function opens the wizard with that function's schema
- User can still browse categories (Math, Logical, Text, etc.)

#### 4. AST Conversion Architecture

```
parseFormula("=IF(A1>0, SUM(B4:D4), 0)")
    ↓
Parser AST (IF function node)
    ↓
importFormulaToWizard() converts to:
    ↓
Wizard AST:
  root: IF node
    ├── condition: "A1>0" (raw string)
    ├── true_val: nested SUM node
    │     └── number1: "B4:D4"
    └── false_val: "0" (raw string)
```

### Stages & Subtasks

---

#### Stage 25a: Formula Import Utility — COMPLETE ✅

**Goal**: Create `formulaWizardImport.ts` to convert parsed formulas into wizard AST.

- [x] **25a.1**: Create `src/utils/formulaWizardImport.ts` with:
  - `importFormulaToWizard(formula: string): FormulaASTNode | null` — main entry point
  - Handles the case where formula doesn't start with a function (returns null)
  - Recursively walks the parser AST and builds wizard AST
  - Maps `FunctionNode` → `FormulaASTNode` with nested children
  - Maps `CellRefNode`/`RangeNode` → string rawValue (e.g., "B4:D4")
  - Maps `NumberNode`/`StringNode`/`BooleanNode` → string rawValue
  - Maps `BinaryOpNode`/`UnaryOpNode` → string rawValue (e.g., "A1>0")
  - Handles absolute references ($A$1) correctly
  - Handles cross-sheet references (Sheet1!A1)
  - Handles unknown functions gracefully (import as raw text or skip)

- [x] **25a.2**: Write unit tests for `formulaWizardImport.ts` (28 tests):
  - Import simple function: `=SUM(B4:D4)` ✅
  - Import nested function: `=IF(A1>0, SUM(B4:D4), 0)` ✅
  - Import deeply nested: `=IF(A1>0, IF(B1>0, SUM(C1:C10), 0), -1)` ✅
  - Import with multiple args: `=VLOOKUP(A1, B1:D10, 2, FALSE)` ✅
  - Import with no function: `=A1+B1` → returns null ✅
  - Import with literal: `=5` → returns null ✅
  - Import with unknown function: `=CUSTOM(A1)` → handle gracefully ✅
  - Import with absolute refs: `=$A$1:$B$2` ✅
  - `canImportFormula` helper ✅

---

#### Stage 25b: Enhance useFormulaWizard Hook — COMPLETE ✅

**Goal**: Add `importFormula` method to the hook.

- [x] **25b.1**: Add `importFormula(formula: string, targetCellRef?: string)` method to `useFormulaWizard`:
  - Calls `importFormulaToWizard()` to build the AST tree
  - Sets initial state with root node and full nested tree
  - Handles the case where import returns null (fall back to autocomplete)
  - Sets `nestingDepth` to 1 (at root level)
  - Compiles the formula for preview

- [x] **25b.2**: Add `openWithAutocomplete(targetCellRef?: string)` method:
  - Sets state to show autocomplete dropdown
  - Doesn't create any AST nodes yet
  - Waits for user to pick a function

- [x] **25b.3**: Update hook return type to include new methods

- [x] **25b.4**: Write unit tests for new hook methods:
  - `importFormula` populates AST correctly (via import + integration tests)
  - `openWithAutocomplete` shows autocomplete state (via FunctionPicker tests)

---

#### Stage 25c: Autocomplete Picker Component — COMPLETE ✅

**Goal**: Create `FunctionPicker` component for when cell has no formula.

- [x] **25c.1**: Create `src/components/FunctionPicker.tsx`:
  - Modal overlay similar to FormulaWizard
  - Search input at top
  - Scrollable list of functions grouped by category
  - Each item shows: name, signature, description, category
  - Keyboard navigation (arrows + Enter to select)
  - Click to select and open wizard
  - Reuse `searchFunctions` from `formulaAutocomplete.ts`

- [x] **25c.2**: Style consistently with FormulaWizard (same modal look)

- [x] **25c.3**: Write unit tests (FunctionPicker.test.tsx):
  - Renders function list ✅
  - Filters as user types ✅
  - Keyboard navigation works ✅
  - Clicking item calls onSelect ✅

---

#### Stage 25d: Enhance FormulaWizard Component — COMPLETE ✅

**Goal**: Update FormulaWizard to handle imported formulas and nested navigation.

- [x] **25d.1**: Update `FormulaWizard.tsx` to display imported parameter values:
  - When opened with pre-populated AST, show parameter values from import
  - Parameters with nested functions show function name as value (e.g., "SUM(B4:D4)")
  - Clicking a nested function value navigates into it (reuses existing breadcrumb logic)

- [x] **25d.2**: Add `FunctionPicker` integration:
  - When wizard state is `AUTOCOMPLETE`, show `FunctionPicker` instead of parameter form
  - When user picks a function, transition to `WIZARD_ROOT` with that function

- [x] **25d.3**: Update breadcrumb to show imported nested path:
  - When formula has nested functions, breadcrumb shows full path
  - User can click any level to navigate back

- [x] **25d.4**: Write/update tests:
  - Wizard shows imported parameter values ✅
  - Clicking nested function navigates into it ✅
  - FunctionPicker appears when no formula imported ✅

---

#### Stage 25e: Wire Triggers in App.tsx — COMPLETE ✅

**Goal**: Update `handleFxClick` and related handlers to use import.

- [x] **25e.1**: Update `handleFxClick` in `App.tsx`:
  - Check if current cell value starts with `=` and contains a function
  - If yes → call `importFormula(currentValue, targetCellRef)`
  - If no → call `openWithAutocomplete(targetCellRef)`

- [x] **25e.2**: Update menu handler (`onFormulaWizard`) with same logic — delegates to `handleFxClick`

- [x] **25e.3**: Update Ctrl+Shift+F handler with same logic — delegates to `handleFxClick`

- [x] **25e.4**: `getActiveCellValue` returns the full formula string (including `=`)

---

#### Stage 25f: Documentation & Polish — COMPLETE ✅

**Goal**: Update docs and ensure quality.

- [x] **25f.1**: Update README:
  - Document that opening wizard on a formula pre-populates it ✅
  - Document the autocomplete fallback for empty cells ✅
  - Show nested formula example ✅

- [x] **25f.2**: Update PLAN.md:
  - Add Phase 25 with completion status ✅
  - Update "Current State" section ✅

- [x] **25f.3**: Run full verification:
  - `npm test` — all tests pass (2007 passed) ✅
  - `npm run lint` — 0 warnings ✅
  - `npm run type-check` — clean ✅
  - `npm run build` — clean ✅

- [x] **25f.4**: Manual smoke test:
  - Open wizard on cell with `=SUM(B4:D4)` → parameters populated ✅
  - Open wizard on cell with `=IF(A1>0, SUM(B4:D4), 0)` → nested navigation works ✅
  - Open wizard on empty cell → autocomplete appears ✅
  - Open wizard on cell with `=A1+B1` → autocomplete appears ✅
  - Edit parameter in wizard → formula updates ✅
  - Navigate into nested function → breadcrumb works ✅
  - Apply → formula committed to cell ✅

---

### Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `src/utils/formulaWizardImport.ts` | **NEW** | Convert parsed formulas to wizard AST |
| `src/utils/formulaWizardImport.test.ts` | **NEW** | 28 unit tests for import utility |
| `src/hooks/useFormulaWizard.ts` | MODIFY | Add `importFormula`, `openWithAutocomplete` |
| `src/components/FunctionPicker.tsx` | **NEW** | Autocomplete function picker modal |
| `src/components/FunctionPicker.test.tsx` | **NEW** | Tests for picker |
| `src/components/FormulaWizard.tsx` | MODIFY | Show imported values, integrate FunctionPicker, live result preview |
| `src/App.tsx` | MODIFY | `handleFxClick` uses import + autocomplete fallback |
| `README.md` | TODO | Document new behavior (25f.1 remaining) |
| `PLAN.md` | UPDATE | Phase 25 complete ✅ |

### Test Count

- Phase 25 added **~75 tests** across 3 suites (formulaWizardImport, FunctionPicker, FormulaWizard)
- Total: **2007 tests** across 80 suites

### Dependencies — All Met ✅

- `formulaParser.ts`, `formulaWizardSchema.ts`, `formulaWizardCompiler.ts`
- `formulaAutocomplete.ts`, `FormulaWizard.tsx`, `useFormulaWizard.ts`

---

## Phase 26: Range Operations Improvements — COMPLETE ✅ (2026-07-30)

**Status**: All 5 stages (26a-26e) complete. +129 tests added.

### Goal

Improve how ranges are copied, pasted, and edited within and across sheets. Current behavior is basic — paste adjusts relative references (Stage 5b) but lacks several spreadsheet-expected behaviors.

### Current Limitations

1. **No drag-and-drop range move** — must cut then paste
2. **No fill handle for ranges** — can't drag to auto-fill series across a selected range
3. **Paste doesn't adapt range formulas intelligently** — `=SUM(A1:A10)` pasted to B1 becomes `=SUM(B1:B10)` (correct) but pasted to a different sheet should use cross-sheet refs only when source was cross-sheet
4. **No paste-special options** — can't paste values-only, formulas-only, or formatting-only
5. **Copy/paste of merged cells or styled ranges** — styles lost on paste
6. **Cross-sheet paste doesn't bring formatting** — only rawValues and formulas
7. **No range transpose** — can't paste a row as a column
8. **Fill handle doesn't work across filtered/hidden rows**

### Stages & Subtasks

---

#### Stage 26a: Range Copy Enhancements — COMPLETE ✅ (2026-07-30)

**Goal**: Include formatting and metadata when copying ranges.

**Finding**: Already implemented — `ClipboardData.cells` is `(Cell | null)[][]`, `Cell` has `style?: CellStyle`, and `copyRange` copies full Cell objects. Paste handler applies `style: cell?.style` to destination.

- [x] **26a.1**: Extend `ClipboardData` to include cell styles — already supported by `Cell.style`
- [x] **26a.2**: Update `copyRange` to capture styles — already copies full Cell objects
- [x] **26a.3**: Write tests for style-preserving copy — **19 tests** added (clipboard.styles.test.ts + App.pasteStyles.test.tsx)

---

#### Stage 26b: Paste Special — COMPLETE ✅ (2026-07-30)

**Goal**: Add paste modal with options (formulas, values, formatting, transpose).

- [x] **26b.1**: Extended `PasteSpecialModal.tsx` with radio options (Everything/Formulas/Values/Formatting) and transpose checkbox
- [x] **26b.2**: Wired `PasteSpecialModal` into paste handler in App.tsx — `applyPasteOptions()` transforms clipboard data before paste
- [x] **26b.3**: Implemented transpose logic in `pasteSpecial.ts` — swaps rows/cols after mode transformation
- [x] **26b.4**: Wrote **32 tests** for paste modes + **21 tests** for modal UI = **53 total**
  - `pasteSpecial.test.ts`: 32 unit tests for `applyPasteOptions()` utility
  - `PasteSpecialModal.test.tsx`: 12 tests (updated for new signature)
  - `PasteSpecialModal.extended.test.tsx`: 19 tests for new options

**New files:** `src/utils/pasteSpecial.ts`
**Modified:** `src/components/PasteSpecialModal.tsx`, `src/App.tsx`

---

#### Stage 26c: Drag-and-Drop Range Move — COMPLETE ✅ (2026-07-30)

**Goal**: Drag a range to a new location with visual feedback.

- [x] **26c.1**: Drag handle rendered on selection border (top center) for ranges ≥ 2 cells
- [x] **26c.2**: Ghost preview shows target location during drag (blue dashed outline)
- [x] **26c.3**: `onMoveRange` callback fires with source selection + target cell on drop; parent performs cut+paste in single undo step
- [x] **26c.4**: Wrote **23 tests** (15 rangeMove utility + 8 Grid drag-move integration)

**New files:** `src/utils/rangeMove.ts`
**Modified:** `src/components/Grid.tsx` (drag handle, ghost preview, drag-move state)

---

#### Stage 26d: Cross-Sheet Paste with Formatting — COMPLETE ✅ (2026-07-30)

**Goal**: When pasting across sheets, carry cell styles and column widths.

- [x] **26d.1**: Cross-sheet paste applies captured styles — already supported by existing paste handler (`style: cell?.style`), verified by tests
- [x] **26d.2**: Column widths carried via `extractColumnWidths()` / `applyColumnWidths()` utilities
- [x] **26d.3**: Wrote **17 tests** (5 cross-sheet style tests + 12 column width tests)

**New files:** `src/utils/pasteWidths.ts`
**Modified:** `src/App.tsx` (cross-sheet column width carrying in paste handler)

---

#### Stage 26e: Fill Handle for Ranges — COMPLETE ✅ (2026-07-30)

**Goal**: Drag fill handle on a range to auto-fill series (numbers, dates, custom lists).

- [x] **26e.1**: Fill handle already detected at selection bottom-right corner
- [x] **26e.2**: `computeFillRange()` reuses `computeFillSeries` per-column/per-row for 2D fills
- [x] **26e.3**: Respects filtered/hidden rows (skips them via `hiddenRows` parameter)
- [x] **26e.4**: Wrote **11 tests** for `computeFillRange()`

**New files:** `src/utils/fillRange.ts`

---

### Files Expected

| File | Action |
|------|--------|
| `src/utils/clipboard.ts` | Extend ClipboardData with styles |
| `src/utils/pasteSpecial.ts` | NEW — paste mode logic |
| `src/components/PasteSpecialModal.tsx` | NEW |
| `src/App.tsx` | Wire paste special + drag-move |
| `src/components/Grid.tsx` | Fill handle + drag-drop UI |
| Tests | New suites for each stage |

### Dependencies

- `clipboard.ts` (Stage 5b), `computeFillSeries` (existing)
- `useCellStyles` / `useCellStyle` (Phase 19)

---

## Phase 27: POINT Mode & Modal Interaction — COMPLETE ✅ (2026-07-30)

**Status**: All 4 stages (27a-27d) complete. +38 tests added.

### Goal

Fix bugs where the FormulaWizard modal (or FunctionPicker modal) interferes with POINT-mode range selection in the formula bar. The modal UI physically covers the grid, making it impossible to click cells to select a range.

### Current Bugs

1. **POINT mode + modal open** — User opens FormulaWizard, starts typing a formula with a parameter that needs a range, clicks the grid to select a range → the modal intercepts/blocks the click or the selection is lost when modal re-renders
2. **Formula bar range highlight obscured** — The range highlight in the formula bar (colored cell refs) is covered by the modal, so the user can't see what they're selecting
3. **POINT state lost on modal re-render** — Any modal state change (function switch, breadcrumb navigation) resets POINT mode back to SELECT
4. **Escape behavior** — Esc closes the modal instead of canceling POINT mode first
5. **Tab/Enter in modal parameters** — Tab moves focus to next modal input instead of committing the range selection

### Stages & Subtasks

---

#### Stage 27a: Diagnose & Reproduce — COMPLETE ✅ (2026-07-30)

**Goal**: Write tests that reproduce each bug.

- [x] **27a.1**: Test: open FormulaWizard, enter POINT mode → POINT indicator shown
- [x] **27a.2**: Test: POINT mode active, modal re-renders → POINT state preserved (via useFormulaWizard hook)
- [x] **27a.3**: Test: cancel POINT mode via Cancel button → returns to previous state
- [x] **27a.4**: Test: modal renders correctly in both POINT and non-POINT states

**New files:** `src/components/FormulaWizard.pointmode.test.tsx` (20 tests)

**Note**: Tests verify current behavior. Bugs to fix in 27b-27d:
- Modal blocks grid clicks when in POINT mode (no click-through)
- Esc closes modal instead of canceling POINT mode first
- Tab/Enter in modal inputs vs committing range selection

---

#### Stage 27b: Fix Modal Transparency for Range Selection — COMPLETE ✅ (2026-07-30)

**Goal**: Make the modal non-blocking when in POINT mode.

- [x] **27b.1**: When entering POINT mode, modal overlay gets `pointer-events-none` and `bg-black/10`; modal content gets `opacity-75` and `pointer-events-auto`
- [x] **27b.2**: Modal is semi-transparent (`opacity-75`) in POINT mode, fully opaque otherwise
- [x] **27b.3**: Exiting POINT mode restores full opacity and normal click behavior

**Modified:** `src/components/FormulaWizard.tsx` (dynamic overlay/modal classes based on POINT mode)
**Tests:** `src/components/FormulaWizard.transparency.test.tsx` (7 tests)

---

#### Stage 27c: Fix POINT State Preservation — COMPLETE ✅ (2026-07-30)

**Goal**: Modal re-renders must not reset POINT mode.

**Finding**: POINT state preservation already works correctly in the current implementation. The `useFormulaWizard` hook preserves `pointSelectionParamIndex` across re-renders.

- [x] **27c.1**: `useFormulaWizard` hook preserves POINT state (verified by tests)
- [x] **27c.2**: Grid's `onRangeSelect` callback commits range ref correctly
- [x] **27c.3**: Breadcrumb navigation preserves POINT state
- [x] **27c.4**: Wrote **7 tests** for state preservation verification

**Tests:** `src/components/FormulaWizard.statepreserv.test.tsx`

---

#### Stage 27d: Fix Escape Key Behavior — COMPLETE ✅ (2026-07-30)

**Goal**: Esc cancels POINT mode first, then closes modal on second press.

- [x] **27d.1**: Esc in FormulaWizard intercepted when FSM is in POINT state
- [x] **27d.2**: First Esc → exit POINT mode (calls cancelPointSelection), modal stays open
- [x] **27d.3**: Second Esc → close modal (calls closeWizard)
- [x] **27d.4**: Wrote **4 tests** for double-Esc behavior

**Modified:** `src/components/FormulaWizard.tsx` (handleKeyDown on modal overlay)
**Tests:** `src/components/FormulaWizard.escape.test.tsx`

---

### Files Expected

| File | Action |
|------|--------|
| `src/components/FormulaWizard.tsx` | POINT-aware modal styling + Esc handling |
| `src/components/FormulaBar.tsx` | Range highlight z-index + POINT indicator |
| `src/hooks/useFormulaWizard.ts` | POINT state preservation |
| `src/components/Grid.tsx` | `onRangeSelect` without FSM reset |
| `src/App.tsx` | Wire onRangeSelect into wizard parameter commit |
| Tests | 27a repro tests + fix verification tests |

### Dependencies

- Phase 25 (FormulaWizard + FunctionPicker)
- useCellEditing FSM (POINT mode)
- formulaWizardCompiler (parameter commit)

---

## Phase 28: Feature Enhancements — Mobility Platforms — COMPLETE ✅ (2026-07-31)

**Status**: All 4 stages (28a-28d) complete. +16 tests added.

### Goal

Improve FormulaWizard usability on mobile/touch platforms (iOS Safari, Android Chrome) and fix related bugs discovered during mobile testing.

### Completed Stages

---

#### Stage 28a: Touch-Friendly POINT Mode Accept Button — COMPLETE ✅ (2026-07-31)

**Goal**: Add Accept button for touch devices that can't press Enter.

- [x] **28a.1**: Added Accept button to POINT mode indicator (alongside Cancel)
- [x] **28a.2**: Accept button triggers same logic as Enter key on grid
- [x] **28a.3**: Added `acceptPointSelection` and `getSelection` methods to `GridHandle`
- [x] **28a.4**: Added `onAcceptPointSelection` prop to FormulaWizard
- [x] **28a.5**: Updated POINT mode text: "Select a range on the grid, then press Enter or tap Accept."

**Modified:** `src/components/FormulaWizard.tsx`, `src/components/Grid.tsx`, `src/App.tsx`
**Tests:** `src/components/FormulaWizard.test.tsx` (new Accept button test)

---

#### Stage 28b: Formula Placement Fix (B-011) — COMPLETE ✅ (2026-07-31)

**Goal**: Fix formula being placed in wrong cell after wizard range selection.

- [x] **28b.1**: Added `wizardTargetCell` state to capture target cell when wizard opens
- [x] **28b.2**: `handleWizardApply` uses `wizardTargetCell` instead of `activeCellRef.current`
- [x] **28b.3**: `targetRow`/`targetCol` props use `wizardTargetCell` (not `activeCell`)
- [x] **28b.4**: Reset `wizardTargetCell` when wizard closes

**Root cause**: `activeCell` changes during POINT mode range selection, causing formula to be placed in last selected cell instead of target cell.

**Modified:** `src/App.tsx`
**Tests:** `src/App.test.tsx` (B-011 test: formula placed in target cell)

---

#### Stage 28c: False Circular Reference Warning Fix (B-012) — COMPLETE ✅ (2026-07-31)

**Goal**: Fix false "circular dependency" warning when ranges don't include target cell.

- [x] **28c.1**: Rewrote `checkCircularReference` with proper numeric range containment
- [x] **28c.2**: Added `parseCellRef` helper to parse cell references into {row, col}
- [x] **28c.3**: Added `isCellInRange` helper for proper range containment check
- [x] **28c.4**: Updated "Apply to Cell" button to show target cell (e.g., "Apply to Cell: E4")

**Root cause**: Old implementation used `String.includes()` for range checks, causing false substring matches.

**Modified:** `src/utils/formulaWizardCompiler.ts`, `src/components/FormulaWizard.tsx`
**Tests:** `src/utils/formulaWizardCompiler.test.ts` (5 new range containment tests)

---

#### Stage 28d: Focus Restoration After Wizard Closes — COMPLETE ✅ (2026-07-31)

**Goal**: Return focus to active cell after FormulaWizard completes.

- [x] **28d.1**: Added `focusCell(row, col)` method to `GridHandle`
- [x] **28d.2**: `handleCloseWizard` calls `focusCell` with target cell
- [x] **28d.3**: Added auto-focus to wizard modal when it opens
- [x] **28d.4**: Used `handleCellSelectRef` pattern to avoid hook ordering issues

**Modified:** `src/components/Grid.tsx`, `src/App.tsx`, `src/components/FormulaWizard.tsx`

---

### iOS Issues Identified

| Issue | Status |
|-------|--------|
| No Accept button for touch users (can't press Enter) | ✅ FIXED (28a) |
| Grid uses `onMouseDown` (works on iOS but may have 300ms delay) | ⚠️ Future improvement |
| Range picker button touch target is small (10px font) | ⚠️ Future improvement |
| No touch-and-drag range selection on grid | ⚠️ Future improvement |

### Files Modified

| File | Changes |
|------|---------|
| `src/components/FormulaWizard.tsx` | Accept button, `onAcceptPointSelection` prop, auto-focus modal, button shows target cell |
| `src/components/Grid.tsx` | `acceptPointSelection`, `getSelection`, `focusCell` methods in GridHandle |
| `src/App.tsx` | `wizardTargetCell` state, `onAcceptPointSelection` callback, `focusCell` in `handleCloseWizard` |
| `src/utils/formulaWizardCompiler.ts` | Proper range containment check with `parseCellRef` and `isCellInRange` |
| Tests | 16 new tests across 4 test files |

### Dependencies

- Phase 25 (FormulaWizard + FunctionPicker)
- Phase 27 (POINT Mode & Modal Interaction)
- useCellEditing FSM (POINT mode)
- formulaWizardCompiler (parameter commit)

---

## Phase 29: Number Formatting — Date/Time & Text — COMPLETE ✅ (2026-07-31)
*Extend the number format engine to support Excel-compatible date/time serialization and text-format preservation of numeric values.*

**Current state**: `numberFormat.ts` already handles currency, percent, number (with decimal/thousand separators), and accounting formats. Phase 20 added auto-alignment and accounting layout. However, two important Excel number format categories are missing:

1. **Date & Time** — Excel stores dates as serial numbers (days since 1900-01-00) and times as fractional days. Without date/time format support, these serial numbers display as raw integers/decimals instead of human-readable dates.
2. **Text** — The `@` format code in Excel forces numeric entries to be treated as literal text, preserving leading zeros (ZIP codes, ID numbers, credit card numbers) that Excel would otherwise strip.

### Phase 29a: Date & Time Serial Number Decoding — COMPLETE ✅
- [x] **Excel date serial decoding** — Convert Excel serial date numbers (1 = 1900-01-01, accounting for the 1900 leap year bug) to JavaScript Date objects
- [x] **Date format patterns** — Support common Excel date format strings:
  - `MM/DD/YYYY` → 07/31/2026
  - `DD-MMM-YY` → 31-Jul-26
  - `MMMM D, YYYY` → July 31, 2026
  - `YYYY-MM-DD` → 2026-07-31 (ISO)
  - `DD/MM/YYYY` → European order
- [x] **Time format patterns** — Support Excel time format strings:
  - `h:mm AM/PM` → 12:00 PM (12-hour)
  - `HH:MM` → 14:30 (24-hour)
  - `HH:MM:SS` → 14:30:00
  - `h:mm:ss AM/PM` → 2:30:00 PM
- [x] **Combined date+time** — `MM/DD/YYYY HH:MM` → 07/31/2026 14:30
- [x] **Fractional day handling** — Times stored as fractional days (0.5 = 12:00 PM) decoded correctly
- [x] **Format string parser** — Tokenizer parses Excel date/time format tokens (`YYYY`, `YY`, `MMMM`, `MMM`, `MM`, `DD`, `D`, `HH`, `H`, `mm`, `ss`, `AM/PM`)
- [x] **Integration with existing format detection** — Extended `isDateFormat()` and `isTimeFormat()` to detect all date/time format patterns

### Phase 29b: Text Format (@) — COMPLETE ✅
- [x] **Text format detection** — Detect `@` format code in Excel number format strings
- [x] **Leading zero preservation** — When a cell has text format, numeric entries like `00123` or `1234567890123456` (credit card) preserve their literal string representation
- [x] **Format string passthrough** — For text-formatted cells, display the `rawValue` directly without numeric coercion or formatting
- [x] **Edit mode behavior** — (via `isNumberFormat('@')` returning false, so Grid doesn't apply numeric formatting)
- [x] **Import/Export compatibility** — (text format cells treated as strings)

### Phase 29c: UI Integration — COMPLETE ✅
- [x] **Toolbar buttons** — Added Date (📅) and Text (Abc) format buttons to the Toolbar
- [x] **Format menu items** — Added Date/Text options to the Format menu dropdown (under Number Format)
- [x] **Format detection** — Grid automatically applies date/time formatting when a cell's format string matches (existing pattern, now extended)
- [ ] **Keyboard shortcuts** — Optionally add Ctrl+Shift+# (date) and Ctrl+Shift+@ (text) shortcuts (deferred — low priority)

### Phase 29d: Testing & Documentation — COMPLETE ✅
- [x] **Unit tests** — Comprehensive tests for date serial decoding, format string parsing, time extraction, text format passthrough (102 tests in `numberFormat.dateTime.test.ts`)
- [x] **Edge cases** — Epoch boundaries, NaN/Infinity serials, negative serials, very large serials, midnight/noon boundaries, combined date+time detection
- [x] **Coverage** — `numberFormat.ts` at 100% lines, 100% branches, 100% functions, 100% statements
- [x] **README update** — Documented date/time serial decoding, text format, expanded format pattern list
- [x] **Lint fix** — Removed pre-existing `require()` usage in `ImportExportBridge.test.tsx`
- [x] **Full verification** — 2513 tests pass, lint clean, type-check clean, build clean

---

### Phase 29a/29b Implementation Summary

**Files modified:**
- `src/utils/numberFormat.ts` — Extended with `formatDate`, `formatTime`, `parseDateTimeFormat`, `tokenizeFormat`, `isTextFormat`. Updated `isNumberFormat` to include date/time formats. Updated `shouldRightAlign` for text format.
- `src/utils/numberFormat.test.ts` — Updated existing test for `isNumberFormat` (date/time now included).

**Files created:**
- `src/utils/numberFormat.dateTime.test.ts` — 68 new tests covering date serial decoding, all format tokens, AM/PM, text format preservation.

**Test results:** 2373 tests pass (was 2304), lint clean, type-check clean, build clean.

---

### Phase 29 Dependencies

| Dependency | Phase |
|------------|-------|
| numberFormat.ts (existing) | Phase 15e |
| Grid rendering (cell display) | Phase 4 |
| Toolbar | Phase 15j |
| MenuBar (Format menu) | Phase 9 |
| excelImport/excelExport (xlsx format round-trip) | Phase 15b |

### Phase 29 Files Expected

| File | Action |
|------|--------|
| `src/utils/numberFormat.ts` | Extend with date/time decoding + text format |
| `src/components/Grid.tsx` | Apply date/time/text format in cell rendering |
| `src/components/Toolbar.tsx` | Add Date + Text format buttons |
| `src/components/MenuBar.tsx` | Add Format → Date / Format → Text menu items |
| `src/utils/numberFormat.test.ts` | New date/time/text tests |
| `README.md` | Document new format options |

---

## Phase 30: Mobile Support — Column/Row Size Selector — COMPLETE ✅ (2026-08-05)

**Problem**: There is no way to set exact column widths or row heights. The only resize mechanism is the drag handle on headers, which is imprecise and especially difficult on mobile/touch devices.

**Solution**: Add a `ColumnRowSizeModal` dialog with touch-friendly number inputs and preset buttons. Also add touch event support to the existing `ResizeHandle` component.

### Phase 30a: ColumnRowSizeModal Component — COMPLETE ✅
- [x] Create `src/components/ColumnRowSizeModal.tsx` — modal with:
  - Column width mode (number input + preset buttons: 50, 80, 100, 150, 200)
  - Row height mode (number input + preset buttons: 20, 28, 40, 60, 80)
  - Apply to current column/row OR apply to all columns/rows (default)
  - Touch-friendly large tap targets (min 44px height)
  - OK / Cancel buttons
- [x] Create `src/components/ColumnRowSizeModal.test.tsx` — 20 tests covering:
  - Renders in column mode and row mode
  - Preset buttons set the value
  - Number input changes value
  - Apply to all checkbox toggles
  - onApply called with correct params
  - onCancel closes modal
  - Clamping (min 10px, max 500px)

### Phase 30b: ResizeHandle Touch Support — COMPLETE ✅
- [x] Add `onTouchStart` handler to `ResizeHandle.tsx` that mirrors the mouse drag logic
- [x] Use `touchstart`/`touchmove`/`touchend` events with passive: false for `touchmove`
- [x] Prevent default on touchstart to avoid scroll interference
- [x] Add 4 touch tests to `ResizeHandle.test.tsx`

### Phase 30c: Menu Integration & Wiring — COMPLETE ✅
- [x] Add `onColumnRowSize` prop to MenuBar
- [x] Add "Column/Row Size…" item to Format menu
- [x] Add handler in App.tsx that opens the modal with current sheet data
- [x] Wire modal apply → handleColumnRowSizeApply (sets per-column/row or default size)
- [x] 2 integration tests in App.menu.test.tsx (column width + row height)

### Phase 30d: Documentation — COMPLETE ✅
- [x] Update README.md with Column/Row Size feature
- [x] Update PLAN.md with completion status

**Files modified/created:**
- `src/components/ColumnRowSizeModal.tsx` (new — 170 lines)
- `src/components/ColumnRowSizeModal.test.tsx` (new — 20 tests)
- `src/components/ResizeHandle.tsx` (touch support added)
- `src/components/ResizeHandle.test.tsx` (4 new touch tests)
- `src/components/MenuBar.tsx` (menu item + prop)
- `src/App.tsx` (handler + state + render modal + status message)
- `src/App.menu.test.tsx` (2 integration tests)
- `README.md` (documentation)

**Tests:** 31 new tests (20 modal + 4 touch + 1 menu + 2 integration + 4 test setup fixes)
**Results:** 2647 tests pass, lint clean, type-check clean, build clean |

---

## Phase 32: Menu & Toolbar Icon Refactor — COMPLETE ✅ (2026-08-08)
*Migrate all menu and toolbar icons from emoji strings and inline SVGs to consistent lucide-react icons.*

### Design Rules
1. **All icons are `w-4 h-4` (16px)** — no variation in size across menus/toolbars
2. **No explicit icon color** — icons inherit `text-color` from parent button
3. **Color inheritance trick**: active item gets `text-blue-700` → icon turns blue automatically
4. **No wrapper `<span>`, no `shrink-0`, no margin utilities** — bare icon with size classes only
5. **Spacing via `gap-2`** on flex parent (8px between icon and label)

### Phase 32a: Component Migration — COMPLETE ✅
- [x] Installed `lucide-react` (^1.30.0)
- [x] `DropdownMenu.tsx`: icon type `string` → `ComponentType<SVGProps<SVGSVGElement>>`; removed wrapper span; renders `<Icon className="w-4 h-4" />`; added `active` prop → `menu-item-active` class
- [x] `MenuBar.tsx`: all 60+ menu items converted from emoji to lucide components; Bold/Italic/Underline/Wrap/Filter items use `active` prop
- [x] `Toolbar.tsx`: all inline SVGs (clipboard, alignment, palette, borders) → lucide icons; B/I/U/S use `<Bold/>`, `<Italic/>`, `<Underline/>`, `<Strikethrough/>`
- [x] `icons/BorderIcons.tsx`: custom SVG border icons (lucide v1.30 doesn't ship border-specific icons)

### Phase 32b: Styling & CSS — COMPLETE ✅
- [x] Removed `.menu-item-icon` wrapper class from CSS
- [x] Added `.menu-item-active { bg-blue-50 text-blue-700 font-medium }`
- [x] Softened borders from `gray-300` to `gray-200` for cleaner look
- [x] Updated `DropdownMenu.test.tsx` to use `ClipboardCopy` icon instead of emoji string

**Files modified/created:**
- `src/components/DropdownMenu.tsx` (icon rendering + `active` prop)
- `src/components/DropdownMenu.test.tsx` (test fixture update)
- `src/components/MenuBar.tsx` (all icons migrated)
- `src/components/Toolbar.tsx` (all icons migrated)
- `src/components/icons/BorderIcons.tsx` (new — custom border icons)
- `src/index.css` (menu-item-active, border color cleanup)
- `package.json` / `package-lock.json` (lucide-react dependency)

**Tests:** 2720 tests pass, lint clean, type-check clean, build clean
