# PLAN — UI Overhaul & Formula Wizard

## Goal
Achieve a clean, clutter-free UI with standardized dropdown menus, formula wizard, function bar, and R1C1 reference format.

## Current State
- **1350 tests** across **55 suites**, All passing
- Lint clean (0 warnings), Type-check clean (0 errors), Build clean
- Coverage: **93.25% stmts, 83.38% branches, 94.03% funcs, 95.12% lines**
- Phases 1-10 complete: Menu system, Formula bar, Function bar, R1C1 toggle, Layout polish, Nested Formula Wizard
- Phase 11 complete: Cell Style System (Bold, Italic, Underline, Colors, Alignment)
- Phase 12 complete: Search & Replace (find/replace with case, exact match, formula scope, multi-sheet)
- Phase 13 complete: Coverage push — MenuBar 100%, FormulaWizard 100% lines, Grid 86%, FormulaBar 77% funcs, clipboardParse 100% funcs

### New UI Architecture (2026-07-25)
| Component | Description |
|-----------|-------------|
| MenuBar | File/Edit/View/Insert/Format/Help dropdown menus |
| DropdownMenu | Reusable menu with submenus, shortcuts, separators |
| ImportExportBridge | Connects menu events to import/export file buttons |
| FunctionBar | One-line common function buttons in FormulaBar |
| R1C1 Toggle | Click cell ref button to switch A1/R1C1 |
| Grid | Shows numeric column headers in R1C1 mode |
| FormulaWizard | Interactive step-by-step formula builder |
| useFormulaWizard | Wizard state machine hook |
| formulaWizardSchema | Structured function parameter definitions |
| formulaWizardCompiler | AST-to-formula compiler |
| SearchReplaceModal | Find & Replace dialog with configurable options |
| sheetSearch | Core search and replace engine |

### Coverage by file (2026-07-27)
| File | Lines | Branches | Status |
|------|-------|----------|--------|
| App.tsx | 89.57% | 70% | ⚠️ paste/edge cases |
| Grid.tsx | 86.72% | 87.94% | ⚠️ POINT mode resize |
| FormulaBar.tsx | 87.92% | 80.98% | ⚠️ hook integration |
| MenuBar.tsx | 100% | 100% | ✅ |
| FormulaWizard.tsx | 100% | 86.27% | ⚠️ branches |
| clipboardParse.ts | 100% | 93.4% | ⚠️ branches |
| formulaEngine.ts | 94.2% | 76.1% | ⚠️ branches |
| SearchReplaceModal.tsx | 100% | 78.94% | ⚠️ branches |
| useCellEditing.ts | 97.97% | 89.83% | ⚠️ branches |
| pdfExport.ts | 95.6% | 75% | ⚠️ branches |
| HistoryContext.tsx | 94.7% | 66.7% | ⚠️ branches |
| excelImport.ts | 100% | 100% | ✅ |
| excelExport.ts | 98.6% | 94.7% | ⚠️ |
| formulaParser.ts | 98.1% | 91.8% | ⚠️ |
| sheetSearch.ts | 100% | 100% | ✅ |
| DropdownMenu.tsx | 92.2% | 93.3% | ⚠️ |

## Strategy: Quick Wins First, Then Phased Complex Files

---

## Phase 1: Quick Wins (files closest to 100%)
*Each file needs 1-3 tests or istanbul ignore comments.*

| File | Coverage | Uncovered | Fix |
|------|----------|-----------|-----|
| `benchmark.ts` | 97.56% | L119 | `/* istanbul ignore next */` on `require.main` |
| `clipboard.ts` | 100% L / 94.44% B | L108 | Branch coverage for `computeFillHandle` |
| `jsonService.ts` | 93.54% | L62,88,102 | Test `downloadJson` + validation branches |
| `SaveButton.tsx` | 96.29% | L37 | Already covered? Re-check |
| `NewSheetButton.tsx` | 94.73% | L65 | Branch on keyDown handler |
| `LoadButton.tsx` | 90.69% | L38-39,51-52 | Error paths (load failures) |
| `ImportCsvButton.tsx` | 100% L / 85.71% B | L32 | Error branch |
| `ImportJsonButton.tsx` | 95% | L23,32 | Error branches |
| `ImportExcelButton.tsx` | 90.47% | L37 | Error branch |
| `ResizeHandle.tsx` | 94.28% | L53,60 | Branches in mouse handlers |
| `HistoryContext.tsx` | 92.3% | L78-86,150 | Undo edge case + throw |
| `useAutosave.ts` | 88.23% | L27,32 | First-render skip + debounce |
| `csvService.ts` | 89.28% | L51,61,137-138,145-146 | Error/edge paths |
| `excelExport.ts` | 84.93% | L80,93,122,142,149,153 | Formatting + type detection |
| `formulaValidation.ts` | 95% | L137-138,210 | Error branches |
| `formulaParser.ts` | 97.47% | L547-551,560 | `cellRefToString`, `rangeToString` |
| `ExportPdfButton.tsx` | 61.53% | L19-25 | Click handler + error |
| `PrintSetupModal.tsx` | 63.63% | L38-66,87 | Form interactions |
| `storageService.ts` | 89.77% | L38,47,70,159-161 | istanbul ignore error handlers |

**Subtasks:**
- [ ] 1a: Add istanbul ignore to genuinely untestable lines (storageService, benchmark)
- [ ] 1b: Add tests for error-handling paths (LoadButton, Import*, csvService)
- [ ] 1c: Add tests for UI branches (ResizeHandle, NewSheetButton, SaveButton)
- [ ] 1d: Add tests for jsonService.downloadJson + validation
- [ ] 1e: Add tests for excelExport formatting + type detection
- [ ] 1f: Add tests for formulaValidation/formulaParser edge cases
- [ ] 1g: Add tests for ExportPdfButton click + error
- [ ] 1h: Add tests for PrintSetupModal form interactions
- [ ] 1i: Add tests for HistoryContext undo edge case
- [ ] 1j: Add tests for useAutosave first-render + debounce
- [ ] 1k: Add tests for clipboard branch coverage

---

## Phase 2: FSM Hook Completion (`useCellEditing.ts`)
*Target: 100% of remaining uncovered lines.*

| Uncovered Lines | What They Do |
|-----------------|--------------|
| Various in `handleKey` | SELECT/ENTER/EDIT/POINT state transitions |
| `enterPointMode` | POINT mode entry logic |
| `findRefAtCaret` | Reference extraction for F4 cycling |

**Subtasks:**
- [ ] 2a: Test all SELECT-state branches (navigation, delete, printable, F2)
- [ ] 2b: Test all ENTER-state branches (type, backspace, escape, enter, tab, f2, arrows)
- [ ] 2c: Test all EDIT-state branches (insert, caret move, delete, f2, f4, escape, enter, arrows)
- [ ] 2d: Test all POINT-state branches (arrows, shift+arrows, f2, f4, escape, operators, enter, tab)
- [ ] 2e: Test `handleCellClick` in POINT mode
- [ ] 2f: Test `commit` with direction, `cancel`, `reset`
- [ ] 2g: Test F4 cycling via `findRefAtCaret` (range refs, multi-letter cols)

---

## Phase 3: FormulaBar.tsx (79.58% → 100%)
*Uncovered: L95-96,137,145-146,213,232,269-284,314-315,324-330,347-349,355-357,383-386,402,414,452-454,459,484-488,518,594-597*

**Subtasks:**
- [ ] 3a: Test auto-complete navigation (ArrowUp/Down, Tab, Enter, Escape)
- [ ] 3b: Test point mode in formula bar (arrow keys, enter/tab to commit, escape)
- [ ] 3c: Test formula validation error display
- [ ] 3d: Test auto-close parentheses
- [ ] 3e: Test skip-close parenthesis (typing ) when next char is ))
- [ ] 3f: Test formula display overlay rendering
- [ ] 3g: Test cursor position sync

---

## Phase 4: Grid.tsx (67.8% → 100%)
*Uncovered: L97-98,106-107,245-246,250-279,385-389,540-542,560-562,589-737,882-883*

**Subtasks:**
- [ ] 4a: Test point mode visual feedback (isInPointSelection)
- [ ] 4b: Test copy/cut/paste keyboard handlers (Ctrl+C/X/V)
- [ ] 4c: Test row selection + shift-click extension
- [ ] 4d: Test column selection + shift-click extension
- [ ] 4e: Test keyboard navigation (arrows, enter/f2 to edit, escape)
- [ ] 4f: Test row/col header keyboard navigation (arrows switch to cell)
- [ ] 4g: Test editing input (type, escape, enter, blur commit)
- [ ] 4h: Test highlightedRanges rendering
- [ ] 4i: Test isCellSelected for row/col/cell types

---

## Phase 5: App.tsx (60.65% → 100%)
*Uncovered: L143,220,237-246,285-308,315-317,324-333,342,355-364,368-419,425-450,454-457,462-464,470-482,489-501,508,512,521-522,527-528,535-538,544,548,615-616*

**Subtasks:**
- [ ] 5a: Test circular reference warning (line 143)
- [ ] 5b: Test copy event handler (status message for row/col/cell)
- [ ] 5c: Test cut event handler
- [ ] 5d: Test paste event handler (with offset, formula adjustment)
- [ ] 5e: Test handleCellChange
- [ ] 5f: Test handleCellSelect
- [ ] 5g: Test handleHeaderSelect (row + col)
- [ ] 5h: Test handleFormulaBarCommit
- [ ] 5i: Test handleRequestPointMode
- [ ] 5j: Test handleCellPick (delta + absolute)
- [ ] 5k: Test handleExitPointMode
- [ ] 5l: Test handleUndo/handleRedo
- [ ] 5m: Test handleColumnResize/handleRowResize
- [ ] 5n: Test handleMerge/handleUnmerge/handleFreeze/handleUnfreeze
- [ ] 5o: Test handleImport/handleNewSheet/handleImportError/handlePdfError

---

## Phase 6: pdfExport.ts (3.79% → 100%)
*Dynamic import of html2pdf.js — needs mock.*

**Subtasks:**
- [ ] 6a: Mock `html2pdf.js` dynamic import
- [ ] 6b: Test `generatePdf` with valid sheet
- [ ] 6c: Test `downloadPdf` (creates link, clicks, revokes)
- [ ] 6d: Test `buildPrintableHtml` (with/without grid, headers)
- [ ] 6e: Test `findUsedRange` (empty + non-empty)
- [ ] 6f: Test styling in HTML output (bold, italic, color, bg, align)

---

## Phase 7: formulaEngine.ts (88.63% → 100%)
*Uncovered: L93,110,120,132,147-148,178,222,244-260,425-426,499,504-513,546,566-575,648-650,803-809,825-834,855,896-902,934,979-983,1117,1126-1128*

**Subtasks:**
- [ ] 7a: Test error propagation (#REF!, #VALUE!, #DIV/0!, #NAME?)
- [ ] 7b: Test string functions (LEFT, RIGHT, MID, CONCATENATE, etc.)
- [ ] 7c: Test date functions (YEAR, MONTH, DAY, etc.)
- [ ] 7d: Test logical functions (IF, AND, OR, NOT)
- [ ] 7e: Test lookup functions (VLOOKUP, HLOOKUP, INDEX, MATCH)
- [ ] 7f: Test financial functions (PMT, FV, PV, NPV)
- [ ] 7g: Test statistical functions (MEDIAN, MODE, STDEV, etc.)
- [ ] 7h: Test circular reference detection
- [ ] 7i: Test evaluateWorkbook with complex scenarios

---

## Phase 8: Final Verification
- [ ] All files at 100% coverage
- [ ] All existing tests still pass (654+)
- [ ] Lint clean (0 warnings)
- [ ] Type-check clean (0 errors)
- [ ] Build succeeds

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

### Phase 9b: Formula Bar Wizard & Function Bar — COMPLETE ✅
- [x] Add useReferenceFormat hook with localStorage persistence
- [x] Add toR1C1/formatCellRef helpers
- [x] Add function bar with common functions (SUM, AVERAGE, COUNT, MAX, MIN, IF, SUMIF, COUNTIF, VLOOKUP, ROUND)
- [x] Add R1C1 toggle button to FormulaBar cell reference display
- [x] Update Grid for R1C1 column headers
- [x] Update FormulaBar tests for function bar

### Phase 9c: App.tsx Coverage Recovery — TODO
- [ ] Add tests for new menu handlers (handleClear, handleInsertRowAbove, etc.)
- [ ] Add tests for reference format integration
- [ ] Recover App.tsx line coverage from 62.85% to >90%

### Phase 9d: Layout Polish — COMPLETE ✅
- [x] Final visual review of all UI elements
- [x] Ensure responsive behavior
- [x] Update README.md with new UI documentation

---

## Phase 10: Nested Formula Wizard (2026-07-25)
*Interactive step-by-step formula builder with nested function support.*

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
- [x] Update README.md with wizard documentation
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

## Phase 14: Keyboard Shortcut Audit & Fixes (2026-07-27)
*Review all keyboard shortcuts, identify implementation/wiring gaps, and fix them.*

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

## Progress Log

### 2026-07-27 (Paste Improvements — Phases 1-6)

**Phase 1: Bounds Checking**
- Added bounds checking to `handleExternalPaste` — clips data exceeding sheet boundaries
- Reports clipped rows/columns in status message
- 5 new tests for bounds checking scenarios
- Commit: b5871cf

**Phase 2: Smart Paste Classification**
- Added `classifyPasteContent()` to distinguish grid vs rich-grid content
- Simplified: all plain text → grid (Excel-compatible default)
- HTML tables → rich-grid (with formatting)
- 7 new tests for content classification
- Commit: f98c7d6

**Phase 3: Text Wrapping & Display**
- Added `whiteSpace` property to CellStyle ('normal' | 'nowrap' | 'pre')
- Added `toggleWrapText` to useCellStyle utilities
- Added `toggleWrapTextStyle` to useCellStyles hook
- Added Wrap Text menu item to Format menu
- Updated Grid rendering to support wrapped text (whitespace-normal, break-words)
- 3 Grid tests + 2 toggleWrapText tests for wrap text rendering
- Commit: 204bf90

**Phase 4: Inline Cell Editing Paste**
- Added `editInputRef` to track the editing input element
- Added `insertAtCursor` helper to insert text at cursor position
- Handle Ctrl+V during editing: insert first clipboard cell at cursor
- Handle native paste during editing: insert plain text at cursor
- 2 new tests for inline paste behavior
- Commit: 73fdfef

**Phase 5: Paste Preview & UX Polish**
- Enhanced PasteModal with preview grid showing sample data
- Display row × column dimensions in preview
- Show "formatted" indicator when styles detected
- 3 new tests for preview functionality
- Commit: fceb3a6

**Phase 6: Formula Adjustment for External Paste**
- Applied `adjustFormulaRefs` to external paste formulas
- Relative references (e.g., =A1) adjusted based on paste position
- Absolute references (e.g., $A$1) preserved
- 3 new tests for formula adjustment on external paste
- Commit: cb6f50d

**Results:** 1377 tests, all passing. Lint clean, type-check clean, build verified.

### 2026-07-27 (Coverage Push — MenuBar, FormulaWizard, Grid, FormulaBar, clipboardParse, SearchReplaceModal)
- Fixed virtualizer.measure() cache bug causing gaps after column/row resize
- MenuBar: 32 tests, 100% line/function coverage (added color/fill/number format action tests)
- FormulaWizard: 21 tests, 100% line/function coverage (added nested fn picker, no-params, breadcrumb nav)
- Grid: 89 tests (+11), added context-menu actions, row/col header keyboard nav, click-outside close
- FormulaBar: +6 tests, function bar buttons, autocomplete Tab accept, Escape close
- clipboardParse: 35 tests (+17), 100% lines/functions, added CSS/Excel format parsing tests
- SearchReplaceModal: +3 tests (empty query, Enter key Find/Replace)
- Fixed 6 App test mocks missing measure() method
- **1350 tests, 55 suites, all passing**
- Coverage: 93.25% stmts, 83.38% branches, 94.03% funcs, 95.12% lines
- Commits: e9b343f, bc83a7d, 16428ef

### 2026-07-26 (Phase 12: Search & Replace — COMPLETE ✅)
- Created `src/utils/sheetSearch.ts` — core search/replace engine with support for case sensitivity, exact match, formula inclusion, and multi-sheet scope
- Created `src/components/SearchReplaceModal.tsx` — modal UI with find/replace inputs, four checkboxes (Match Case, Match Entire Cell, Also Search in Formulas, Search All Sheets), result summary, and Search/Replace All/Reset buttons
- Integrated into Edit menu as "Find & Replace…" with `Ctrl+H` shortcut hint
- Wired through App.tsx with `pushHistory` for undo support
- Added 26 new tests (16 for sheetSearch utility, 10 for SearchReplaceModal component)
- Added 2 integration tests in App.menu.test.tsx for menu wiring
- **1260 tests, 51 suites, all passing**
- Commit: (pending)

### 2026-07-25 (Phase 11: Cell Style System — COMPLETE ✅)
- Adding style application system: Bold, Italic, Underline, Text Color, Fill Color, Alignment
- Creating useCellStyle hook for style state tracking and application
- Adding style menu items to Format menu
- Wiring style handlers in App.tsx with history push
- Writing tests for style functions
- **1136 tests, 45 suites, all passing**
- Commit: (pending)

### 2026-07-25 (Cut/Paste Keyboard Fix)
- Fixed Ctrl+X/C/V global clipboard handling — moved from Grid div focus to window-level listeners
- Fixed temporal dead zone bug with selectionRef assignment order
- Fixed stale closure issue in clipboard handlers using selectionRef
- **1131 tests, build verified**

### 2026-07-25 (Phase 10: Nested Formula Wizard)
- Created formulaWizardSchema.ts with structured parameter definitions for 50+ functions
- Created useFormulaWizard.ts hook with state machine (INACTIVE → ROOT → NESTED → POINT)
- Created FormulaWizard.tsx component with breadcrumb navigation and parameter inputs
- Created formulaWizardCompiler.ts with AST-to-formula compilation
- Added Insert Function (ƒx) button to FormulaBar
- Integrated wizard into App.tsx with full state management
- Added type validation and circular reference detection
- Added nested function support (up to 8 levels deep)
- **1083 tests, 43 suites, all passing**
- Commit: (pending)

### 2026-07-25 (UI Overhaul - Phases 9a-9b)
- Created DropdownMenu component with nested submenu support
- Created MenuBar consolidating all actions into File/Edit/View/Insert/Format/Help menus
- Created ImportExportBridge to connect menu events to hidden import/export buttons
- Added useReferenceFormat hook for A1/R1C1 toggle with localStorage persistence
- Added function bar to FormulaBar with 10 common functions
- Updated Grid to show numeric column headers in R1C1 mode
- Removed dead placeholder buttons and old toolbar rows
- Updated App.test.tsx and App.handlers.test.tsx for menu-based UI
- Fixed all FormulaBar tests to handle function bar buttons
- **976 tests, 38 suites, all passing**
- **Phase 9a (Menu System): COMPLETE ✅**
- **Phase 9b (Formula Bar + Function Bar + R1C1): COMPLETE ✅**
- **Phase 9c (App.tsx Coverage Recovery): TODO**
- **Phase 9d (Layout Polish): TODO**
- Commit: `5825a55` (Phase 1-9a), `4cc9d67` (Phase 2-3, 9b)

### 2026-07-25 (Phase 9c-9d: Coverage & Polish)
- Added App.menu.test.tsx with 26 tests for all new menu handlers
- App.tsx line coverage recovered: 62.85% → 93.39%
- Updated README.md with UI overview, menu structure, keyboard shortcuts
- Updated README.md with reference format toggle documentation
- Updated project structure in README.md
- **1002 tests, 39 suites, all passing**
- **Phase 9c (App.tsx Coverage Recovery): COMPLETE ✅**
- **Phase 9d (Layout Polish): COMPLETE ✅**
- **All UI Overhaul phases complete!**
- Commit: `6d2f633` (Phase 9c)

### 2026-07-24 (continued)
- All phases 1-8 substantially advanced from initial 654 tests
- Phase 1 quick wins: ALL files at 100% lines
- Phase 2 FSM: 100% lines, 95.32% branches
- Phase 3 FormulaBar: 95.43% lines, 80.64% functions
- Phase 4 Grid.tsx: 100% lines, 91.91% branches
- Phase 5 App.tsx: 100% lines, 89.18% branches
- Phase 6 pdfExport: 100% lines, 75% branches
- Phase 7 formulaEngine: 93.3% lines, 67.95% branches (STILL BEHIND)
- Phase 8 excelImport: 100% lines + branches
- Coverage: **95.97% stmts, 81.71% branch, 98.39% func, 98.15% lines**
- **816 tests across 33 suites, all passing**
- Remaining gaps: formulaEngine.ts (93% lines, 68% branches) is the biggest blocker
- Strategy: Push formulaEngine to 100% with targeted tests for uncovered branches

### 2026-07-24 (session start)
- Updated PLAN.md with current coverage data
- Committed all pending changes
- Now tackling formulaEngine.ts remaining gaps: VLOOKUP stub, HLOOKUP, INDEX with col, MATCH types, financial functions (PMT/FV/PV/NPV not implemented), error propagation paths, circular reference evalStack path

### 2026-07-24 (continued)
- Added 59 new tests for formulaEngine.ts covering:
  - Time functions (HOUR, MINUTE, SECOND)
  - TEXT percent format
  - NOT with no args
  - Financial functions (PMT, FV, PV, NPV → #NAME?)
  - HLOOKUP (not implemented → #NAME?)
  - INDEX with column argument
  - MATCH with different match types
  - Circular reference runtime detection (evalStack)
  - Nested error propagation
  - ROW/COLUMN/ROWS/COLUMNS functions
  - NOW function
  - SUMIF/COUNTIF/AVERAGEIF edge cases
  - WEEKDAY edge cases
  - MEDIAN/MODE empty range
  - LARGE/SMALL edge cases
  - IF edge cases
  - SWITCH edge cases
  - IS functions edge cases
  - SUBSTITUTE edge cases
  - COUNTIF criterion edge cases
  - FLOOR/CEILING with non-numeric
  - Numeric comparison branch in compareValues
  - AutoDetectType date detection
- Fixed bugs found during testing:
  - ROWS/COLUMNS implementation was using cell values instead of range dimensions
  - matchesCriterion regex didn't handle `<>` as distinct operator
- Added istanbul ignore comments to genuinely unreachable default cases
- Fixed lint errors in ExportButtons.test.tsx (require() → import)
- **Coverage: 97.04% stmts, 84.85% branches, 98.41% funcs, 99.06% lines**
- **875 tests across 33 suites, all passing**
- formulaEngine.ts: 97.55% lines (up from 93.3%)
- Remaining gaps: defensive branches in compareValues, IF, NOT, XOR, SUMIF, WEEKDAY, matchesCriterion, topologicalSort

### 2026-07-24 (Excel-like direct entry editing)
- Implemented Excel-like cell editing UX in Grid component:
  - Typing any printable character (A-Z, a-z, 0-9, punctuation) on a selected cell immediately starts editing
  - The typed character replaces the cell content (Excel behavior)
  - Enter key commits the edit and exits editing mode, returning focus to the grid
  - F2 key also exits editing mode (toggle behavior like Excel)
  - Escape cancels editing and restores original value
- Added `isPrintableKey` helper to detect editable characters
- Added `handleCellEditWithChar` for starting edit with initial character
- Added 6 new tests for direct entry editing behavior
- **883 tests across 33 suites, all passing**
- Build, lint (0 errors), and type-check all pass

### 2026-07-24 (Bulk operations for ranges/rows/columns)
- Implemented bulk operations for range, row, and column selections:
  - **Delete/Backspace** now clears all cells in the selection (not just active cell)
  - Works for single cells, ranges (shift+arrow), full rows, and full columns
  - Uses new `onCellsChange` callback for efficient bulk updates
- Added `handleCellsChange` in App.tsx:
  - Handles bulk cell updates in a single history push
  - Properly deletes cells with empty values
  - Preserves cell styles for non-empty updates
- Added 4 new tests for bulk delete operations
- **887 tests across 33 suites, all passing**
- Build, lint (0 errors), and type-check all pass
