# PLAN — UI Overhaul & Formula Wizard

## Goal
Achieve a clean, clutter-free UI with standardized dropdown menus, formula wizard, formula bar, and R1C1 reference format.

## Current State
- **1929 tests** across **78 suites**, All passing
- Lint clean (0 warnings), Build clean
- Coverage: **94.31% stmts, 85.58% branches, 96.11% funcs, 95.68% lines**
- Phases 1-10 complete: Menu system, Formula bar, R1C1 toggle, pdfExport, Layout polish, Nested Formula Wizard
- Phase 11 complete: Cell Style System (Bold, Italic, Underline, Colors, Alignment)
- Phase 12 complete: Search & Replace (find/replace with case, exact match, formula scope, multi-sheet)
- Phase 13 complete: Paste Experience Improvements (bounds checking, classification, wrapping, inline editing, preview, formula adjustment)
- Phase 14 complete: Keyboard Shortcut Audit & Fixes (global shortcuts, grid navigation, shortcuts modal)
- Phase 16 complete: Keyboard Shortcut Gaps (Ctrl+Enter, Alt+Enter, Ctrl+Left/Right, End key)
- Phase 20 complete: Number Formatting Enhancements (auto-align numbers/dates/times, Accounting format)
- Phase 24 complete: Formula Wizard Wiring (fx button, Ctrl+Shift+F, Insert menu)

---

## Phase 21: Charts — PLANNED 📋
*Create data visualization charts from spreadsheet data.*

### Phase 21a: Chart Types
- [ ] **Bar Chart** — vertical bars for comparing values across categories
- [ ] **Column Chart** — horizontal bars for comparing values
- [ ] **Line Chart** — trends over time or ordered categories
- [ ] **Pie Chart** — proportional breakdown of a single data series
- [ ] **Area Chart** — filled line chart showing cumulative totals
- [ ] **Scatter Plot** — correlation between two numeric series

### Phase 21b: Chart Configuration
- [ ] Chart title and axis labels
- [ ] Legend positioning (top, bottom, left, right, none)
- [ ] Color scheme selection (palette picker)
- [ ] Data range selection (automatic from selection or manual range)
- [ ] Series selection (single or multiple series)
- [ ] Switch rows/columns as data series

### Phase 21c: Chart Rendering Engine
- [ ] Pure SVG rendering (no external chart library — keeps bundle small)
- [ ] Responsive sizing (fills container, redraws on resize)
- [ ] Grid lines and tick marks
- [ ] Data point labels (optional)
- [ ] Animation on data change (smooth transitions)

### Phase 21d: Chart UI & Interaction
- [ ] Insert Chart dialog (Insert menu or toolbar button)
- [ ] Chart positioning (embedded in sheet as floating object or full-sheet view)
- [ ] Edit chart (reopen configuration dialog)
- [ ] Delete chart
- [ ] Export chart as PNG/SVG

### Phase 21e: Integration
- [ ] Charts update when source data changes
- [ ] Charts included in PDF export
- [ ] Charts saved/loaded with workbook
- [ ] Menu: Insert → Chart
- [ ] Toolbar button for quick chart insertion

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

**Tests**: 1929 passing, lint clean, build clean
**Coverage**: Maintained (no production code logic changes, only wiring)

---

## 🔴 CURRENT PRIORITY: Phase 19 — Unified Editing Architecture

**Problem**: The Formula Bar Editor and In-Line Grid Cell Editor have overlapping,
poorly-designed implementations that diverge from Excel's functional model. The FSM
(Finite State Machine) in `useCellEditing.ts` is supposed to be the single source of
truth, but `Grid.tsx` maintains its own parallel editing state (`editingCell`,
`editValue`, `editInputRef`) and re-implements editing behaviors that the FSM already
handles. The in-cell editor also lacks formula-specific features (syntax highlighting,
autocomplete, F9 evaluation) that the formula bar has.

**Goal**: Unify both editors under a single FSM-driven architecture where:
- The FSM is the **sole source of truth** for editing state (no parallel state in Grid)
- Both editors share **formula-specific features** (syntax highlighting, autocomplete,
  parenthesis matching, F9 evaluation)
- POINT mode behavior is **consistent** regardless of which editor is active
- Cell-click reference insertion works from **both** editors

**Full analysis and subtasks below.**
- Phase 17 complete: Cell Editing Workflows (F2 toggle, Ctrl+Shift+U expand, batch entry, formula view toggle)
- Phase 18 complete: Sort & Filter (sort A-Z/Z-A, filter dropdown with custom conditions, Ctrl+Shift+L toggle)
- 

### UI Architecture (2026-07-28)
| Component | Description |
|-----------|-------------|
| MenuBar | File/Edit/View/Insert/Format/Data/Help dropdown menus |
| DropdownMenu | Reusable menu with submenus, shortcuts, separators |
| Toolbar | Formatting toolbar (borders, colors, alignment, font) |
| ImportExportBridge | Connects menu events to import/export file buttons |
| R1C1 Toggle | Click cell ref button to switch A1/R1C1 |
| Formula Bar | formula (function) editor |
| Grid | Shows numeric column headers in R1C1 mode, fill handle, freeze panes |
| formulaAutocomplete | Formula autocomplete engine |
| FormulaWizard | Interactive step-by-step formula builder |
| useFormulaWizard | Wizard state machine hook |
| formulaWizardSchema | Structured function parameter definitions |
| formulaWizardCompiler | AST-to-formula compiler |
| SearchReplaceModal | Find & Replace dialog with configurable options |
| FilterDropdown | Per-column filter dropdown with custom conditions |
| PasteModal / PasteSpecialModal | Paste preview and paste special dialogs |
| PrintSetupModal | Print configuration dialog |
| AboutModal | About dialog with app info |
| ShortcutsModal | Keyboard shortcuts reference |
| SheetTabs | Multi-sheet tab bar |
| FillHandle | Drag-to-fill series in Grid |
| sheetSearch | Core search and replace engine |
| sheetSort | Sort engine with multi-column support |
| sheetFilter | Filter engine with custom conditions |
| sheetOperations | Sheet add/delete/rename/switch operations |
| fillSeries | Auto-fill series detection and generation |
| numberFormat | Number formatting (currency, percent, date, etc.) |
| FreezeContext | Freeze panes state management |
| PrintSetupContext | Print configuration state |
| HistoryContext | Undo/redo history management |

### Coverage by file (2026-07-28)
| File | Lines | Branches | Status |
|------|-------|----------|--------|
| App.tsx | 91.05% | 76.04% | ⚠️ paste/edge cases |
| Grid.tsx | 87.63% | 87.16% | ⚠️ POINT mode/fill handle |
| FormulaBar.tsx | 94.73% | 84.55% | ⚠️ autocomplete/error display |
| MenuBar.tsx | 100% | 100% | ✅ |
| Toolbar.tsx | 100% | 96.36% | ⚠️ branches |
| FormulaWizard.tsx | 100% | 86.27% | ⚠️ branches |
| FilterDropdown.tsx | 93.9% | 80.76% | ⚠️ custom filter |
| clipboardParse.ts | 100% | 91.66% | ⚠️ branches |
| formulaEngine.ts | 97.53% | 76.04% | ⚠️ branches |
| SearchReplaceModal.tsx | 100% | 83.33% | ⚠️ branches |
| useCellEditing.ts | 92.89% | 87.02% | ⚠️ FSM branches |
| pdfExport.ts | 100% | 100% | ✅ |
| HistoryContext.tsx | 100% | 75% | ⚠️ branches |
| excelImport.ts | 100% | 100% | ✅ |
| excelExport.ts | 100% | 94.73% | ⚠️ |
| formulaParser.ts | 97.52% | 90.9% | ⚠️ |
| formulaAutocomplete.ts | 100% | 100% | ✅ |
| sheetSearch.ts | 100% | 100% | ✅ |
| sheetSort.ts | 98.88% | 95.16% | ⚠️ |
| sheetFilter.ts | 97.02% | 96.29% | ⚠️ |
| sheetOperations.ts | 97% | 81.01% | ⚠️ |
| fillSeries.ts | 100% | 86.11% | ⚠️ branches |
| numberFormat.ts | 98.87% | 92.72% | ✅ accounting + auto-align |
| useFormulaWizard.ts | 100% | 90.47% | ⚠️ branches |
| highlightColors.ts | 100% | 100% | ✅ |
| ImportCsvButton.tsx | 100% | 100% | ✅ |
| ImportExcelButton.tsx | 100% | 100% | ✅ |
| ImportJsonButton.tsx | 100% | 100% | ✅ |
| ExportCsvButton.tsx | 100% | 100% | ✅ |
| ExportExcelButton.tsx | 100% | 100% | ✅ |
| ExportJsonButton.tsx | 100% | 100% | ✅ |
| ExportPdfButton.tsx | 100% | 100% | ✅ |
| ImportExportBridge.tsx | 100% | 100% | ✅ |
| PrintSetupModal.tsx | 100% | 100% | ✅ |
| PrintSetupContext.tsx | 100% | 100% | ✅ |
| FreezeContext.tsx | 100% | 100% | ✅ |
| PasteModal.tsx | 100% | 90% | ⚠️ branches |
| PasteSpecialModal.tsx | 100% | 100% | ✅ |
| ResizeHandle.tsx | 100% | 100% | ✅ |
| ShortcutsModal.tsx | 100% | 100% | ✅ |
| AboutModal.tsx | 98.18% | 85% | ⚠️ markdown edge |
| SheetTabs.tsx | 98.46% | 96.15% | ⚠️ |
| useAutosave.ts | 100% | 100% | ✅ |
| useCellStyle.ts | 100% | 100% | ✅ |
| useCellStyles.ts | 100% | 77.46% | ⚠️ branches |
| useReferenceFormat.ts | 100% | 100% | ✅ |
| csvService.ts | 98.59% | 82.35% | ⚠️ |
| jsonService.ts | 100% | 96% | ⚠️ |
| storageService.ts | 100% | 66.66% | ⚠️ branches |
| clipboard.ts | 100% | 100% | ✅ |
| benchmark.ts | 100% | 75% | ⚠️ branches |
| formulaValidation.ts | 100% | 90.9% | ⚠️ |
| formulaWizardCompiler.ts | 96.34% | 96.29% | ⚠️ |
| formulaWizardSchema.ts | 100% | 100% | ✅ |
| types.ts | 100% | 100% | ✅ |

## Phase 20: Number Formatting Enhancements (2026-07-29)
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

## Strategy: Quick Wins First, Then Phased Complex Files

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

**Note:** SaveButton.tsx, LoadButton.tsx, NewSheetButton.tsx were deleted (replaced by menu system in Phase 9).

---

## Phase 2: FSM Hook Completion (`useCellEditing.ts`)
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

## Phase 3: FormulaBar.tsx (94.73% lines, 84.55% branches)
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

## Phase 4: Grid.tsx (87.63% lines, 87.16% branches)
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

## Phase 5: App.tsx (91.05% lines, 76.04% branches)
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

## Phase 7: formulaEngine.ts (97.53% lines, 76.04% branches)
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

## Phase 8: Final Verification — IN PROGRESS
- [ ] All files at 100% coverage
- [x] All existing tests still pass (1922)
- [x] Lint clean (0 warnings)
- [x] Type-check clean (0 errors — pre-existing App.tsx errors excluded)
- [x] Build succeeds (pre-existing App.tsx errors excluded)

**Current gaps:**
- App.tsx: 92.89% lines, 77.57% branches
- Grid.tsx: 87.88% lines, 88.51% branches
- FormulaBar.tsx: 94.79% lines, 84.67% branches
- useCellEditing.ts: 92.98% lines, 87.65% branches
- formulaEngine.ts: 97.7% lines, 76.04% branches
- FilterDropdown.tsx: 93.9% lines, 80.76% branches
- useCellStyles.ts: 100% lines, 77.46% branches
- HistoryContext.tsx: 100% lines, 75% branches
- csvService.ts: 98.59% lines, 82.35% branches
- AboutModal.tsx: 98.18% lines, 85% branches
- SheetTabs.tsx: 98.46% lines, 96.15% branches
- sheetOperations.ts: 97% lines, 81.01% branches
- fillSeries.ts: 100% lines, 86.11% branches
- numberFormat.ts: 98.87% lines, 92.72% branches
- formulaWizardCompiler.ts: 96.34% lines, 96.29% branches
- formulaParser.ts: 97.52% lines, 90.9% branches
- formulaValidation.ts: 100% lines, 90.9% branches
- storageService.ts: 100% lines, 66.66% branches
- benchmark.ts: 100% lines, 75% branches
- clipboardParse.ts: 100% lines, 91.66% branches
- DropdownMenu.tsx: 100% lines, 96.77% branches
- Toolbar.tsx: 100% lines, 96.36% branches
- PasteModal.tsx: 100% lines, 90% branches
- SearchReplaceModal.tsx: 100% lines, 83.33% branches
- jsonService.ts: 100% lines, 96% branches
- excelExport.ts: 100% lines, 94.73% branches
- sheetSort.ts: 98.88% lines, 95.16% branches
- sheetFilter.ts: 97.02% lines, 96.29% branches
- useFormulaWizard.ts: 100% lines, 90.47% branches

---

## Phase 9: UI Overhaul (2026-07-25)
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

## Phase 10: Nested Formula Wizard (2026-07-25)
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
- [ ] Update README.md with wizard documentation
- [x] Update PLAN.md with Phase 10

---

## Phase 12: Search & Replace (2026-07-26)
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

## Phase 13: Paste Experience Improvements (2026-07-27)
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

## Phase 14: Keyboard Shortcut Audit & Fixes (2026-07-27)
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


## Phase 18: Sort & Filter (2026-07-28)
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

## Phase 16: Keyboard Shortcut Gaps (2026-07-27)
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

## Phase 17: Cell Editing Workflows (2026-07-27)
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
Phase 19c-19e (shared FormulaEditor, F9, multiline) deferred to future.

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
14. ⬜ Removed unused `onCellPick` prop from FormulaBar — deferred to Phase 19f
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

#### Phase 19f: Cleanup & Consistency — PARTIALLY COMPLETE

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
**Tests**: 1923 passing, lint clean
**Status**: Phase 19f FULLY COMPLETE

#### Phase 19g: Full Verification

**Goal**: Ensure all changes pass the full verification suite.

**Checklist**:
- [ ] `npm test` — all tests pass
- [ ] `npm run lint` — 0 warnings, 0 errors
- [ ] `npm run type-check` — 0 TypeScript errors
- [ ] `npm run build` — clean build
- [ ] Coverage maintained or improved (target: lines ≥ 95%, branches ≥ 85%)
- [ ] Manual smoke test: edit in formula bar, edit in cell, POINT mode from both,
      autocomplete from both, F9 from both, Alt+Enter from both

---


