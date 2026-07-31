## Progress Log

> **Convention:** All entries are tagged by track: `[FEATURE]` for new features/refactoring (planned in `PLAN.md`), `[BUGFIX]` for bug fixes (tracked in `BUGFIX.md`). Entries without a tag predate this convention.

---

### 2026-07-31 [BUGFIX] B-008 — FormulaWizard Modal Blocking POINT Mode Range Selection
- **Symptom**: The FormulaWizard modal form was blocking POINT mode range selection. The modal (centered, pointer-events-auto) captured clicks on grid cells behind it.
- **Root cause**: The overlay had pointer-events-none but the modal content had pointer-events-auto, so the modal still captured clicks in the center of the screen.
- **Initial fix**: Changed modal to pointer-events-none in POINT mode. Moved POINT mode indicator out of modal to a fixed element at top of screen (pointer-events-auto) so Cancel remains clickable.
- **Enhanced fix (streamlined UX)**: Modal now completely hides in POINT mode (only indicator visible). Modal reappears when range is accepted (Enter) or cancelled. Connected wizard POINT mode to grid selection via wizardPointMode/onWizardPointSelection props. Grid Enter key accepts selection and calls applyPointSelection. State preserved between interactions.
- **Files**: `src/components/FormulaWizard.tsx`, `src/components/Grid.tsx` (wizardPointMode + onWizardPointSelection), `src/App.tsx` (isWizardPointMode + handleWizardPointSelection), `src/components/FormulaWizard.transparency.test.tsx`, `src/components/FormulaWizard.pointmode.test.tsx`, `src/components/FormulaWizard.escape.test.tsx`, `src/components/FormulaWizard.statepreserv.test.tsx`, `src/components/Grid.interactions.test.tsx` (2 new tests)
- **Tests**: 2277 pass (was 2272), lint clean, type-check clean, build clean

### 2026-07-31 [BUGFIX] B-004 — In-Cell Editor Lacks Syntax Highlighting
- **Symptom**: Formula bar showed colored cell reference overlays while editing. The in-cell editor was a plain `<input>` with no visual formula aid — inconsistent UX.
- **Root cause**: The highlighting overlay was computed inside FormulaBar's render function and never shared with the Grid's cell editor.
- **Fix**: Extracted highlighting logic into shared `FormulaHighlightOverlay` component. FormulaBar uses it. Grid's cell editor now renders it underneath the input/textarea when editing a formula. Input/textarea gets `text-transparent` class so the colored overlay shows through.
- **Files**: `src/components/FormulaHighlightOverlay.tsx` (new), `src/components/FormulaBar.tsx`, `src/components/Grid.tsx`, `src/components/Grid.interactions.test.tsx` (3 new tests)
- **Tests**: 2272 pass (was 2269), lint clean, type-check clean, build clean

### 2026-07-31 [BUGFIX] B-007 — String Concatenation with `&` Traps Editor in POINT Mode
- **Symptom**: Typing `=A1 & " " & B1` in the formula bar failed — the `&` triggered POINT mode, and subsequent characters (`"`, ` `) were silently swallowed. The formula `=(A1) & "" "" & (B1)` worked because `)` committed the reference and exited POINT mode before the next `&`.
- **Root cause**: `&` is in `POINT_TRIGGER_CHARS`, so typing it enters POINT mode. But the POINT state handler only exits to EDIT for `[A-Za-z0-9$]` chars (cell reference chars), `)`, `:`, operators, and Enter/Tab. Characters like `"` and ` ` (space) fell through all handlers and were silently ignored — they never made it into the buffer.
- **Fix**: Added a catch-all at the end of the POINT state handler: any unhandled printable character exits POINT mode and inserts into the buffer. This matches Excel behavior where typing any non-navigation character after an operator resumes normal editing.
- **Files**: `src/hooks/useCellEditing.ts` (POINT state catch-all), `src/App.pointmode.test.tsx` (2 new tests)
- **Tests**: 2269 pass (was 2267), lint clean, type-check clean, build clean

### 2026-07-30 [BUGFIX] Save/Open/Export Menu Stub Wiring
- Fixed `handleSaveMenu` (was stub — now downloads JSON via `downloadJson(workbook)`)
- Fixed `handleLoadMenu` (was stub — now dispatches `simplesheets:open` event)
- Wired `ImportExportBridge` to handle all 4 export events (Excel/CSV/JSON/PDF)
- All 4 ExportButton components converted to `forwardRef` to accept refs from bridge
- Updated 5 test files to reflect new behavior
- **2076 tests pass**, lint clean, type-check clean, build clean

### 2026-07-30 [BUGFIX] Ctrl+Shift+F FSM Freeze
- Grid's Ctrl+ shortcut exclusion switch missing `'f'`/`'F'` and `'l'`/`'L'`
- Fixed by adding to switch in Grid.tsx ~line 1027
- **1999 tests pass**

### 2026-07-30 [BUGFIX] Autocomplete State Duplication
- FSM now owns `autoComplete` state; FormulaBar is pure view
- Removed `formulaBarValue` duplication from App.tsx
- Fixed pre-existing POINT-mode bug
- **1543 tests pass**

### 2026-07-30 [BUGFIX] POINT Mode Multi-Parameter
- Continuation operators (comma, +, -, *, /) re-enter POINT mode
- Regular arrow = single-cell, shift+arrow = range
- **1500 tests pass**

### 2026-07-30 [BUGFIX] FormulaBar Blur Double-Commit
- Added guard in FormulaBar's `handleBlur` to skip commit when `session.state === 'SELECT'`
- **1894 tests pass**

---

### 2026-07-27 (Stage 3: Coverage Recovery — Complex Files)
- Sheet operations (add, switch, rename, copy, delete sheets)
- Insert/delete row and column handlers
- Freeze/unfreeze panes
- Clear contents
- Import/export bridge events (Excel, CSV, PDF)
- Global keyboard shortcuts (Ctrl+B/I/U/H/Shift+Z)
- Help menu (About, Keyboard Shortcuts modal)
- Format menu (bold, italic, underline, text/fill colors, alignment, number format, clear styles)
- App.tsx: 87% → 91% lines, 71% → 75% branches

**Stage 3c-3e: Grid.tsx interaction tests (+15 tests)**
- Cell editing input (Enter commit, Escape cancel, Tab, F2 toggle, paste at cursor)
- Row/column header selection and keyboard navigation
- Point mode resize handles (visual rendering)
- Point mode selection highlight (dashed border)
- Clipboard clear on typing, marching ants visual
- R1C1 reference format column headers
- Grid.tsx: 86% → 87% lines, 86% → 87% branches

**Results:** 1445 tests (+42 from Stage 3 start), 55 suites, lint clean
**Overall:** 93.21% stmts, 83.91% branches, 93.83% funcs, 94.83% lines

### 2026-07-27 (Stage 2: Coverage Recovery — Quick Wins)

**useFormulaWizard.ts: 52.38% → 90.47% branches**
- Added defensive guard tests (enterNested before open, cancelPointSelection from nested, applyPointSelection edge cases, max nesting enforcement)

**FormulaBar.tsx: 75% → 87% lines, 61% → 80% branches**
- Added expand/collapse (Ctrl+Shift+U), Ctrl+C/V/Arrow handling, Shift+Arrow in EDIT vs POINT, R1C1 display, select handler, blur handling

**useCellEditing.ts: 83.84% → 93.28% lines, 75.81% → 88.11% branches**
- Added Alt+Enter line breaks, Ctrl+Enter commit-and-stay, Ctrl+Arrow word navigation, End key, setBuffer/setCaretPos, commit with batch parameter, POINT state edge cases

**HistoryContext.tsx: 66.66% → 75% branches**
- Added istanbul ignore for genuinely unreachable defensive fallbacks

**pdfExport.ts: 75% → 100% branches**
- Added test with cell in non-header position with all formatting variants

**Results:** 1403 tests, 53 suites, lint clean

### 2026-07-27 (Stage 1: Cleanup — Remove Merge Scope + Dead Code)

**Merge scope removed entirely:**
- Removed `rowSpan`, `colSpan`, `isMergeAnchor` fields from `Cell` interface (`types.ts`)
- Removed `handleMerge`/`handleUnmerge` handlers from `App.tsx` (were stubs)
- Removed Merge/Unmerge menu items from `MenuBar.tsx`
- Removed merge-related tests from `App.test.tsx`, `App.menu.test.tsx`, `App.handlers.test.tsx`, `MenuBar.test.tsx`, `types.test.ts`
- Removed `onMerge`/`onUnmerge`/`canMerge`/`canUnmerge` props from `MenuBar`

**Dead code removed:**
- Deleted `SaveButton.tsx` + `SaveButton.test.tsx` (replaced by menu system)
- Deleted `LoadButton.tsx` + `LoadButton.test.tsx` (replaced by menu system)
- Deleted `NewSheetButton.tsx` + `NewSheetButton.test.tsx` (replaced by menu system)
- Removed dead `handleCopy`/`handleCut`/`handlePaste` functions from `Grid.tsx`
- Note: `Toolbar.tsx` was initially removed but later re-added with full border/color/formatting features (438 lines, 100% coverage)

**Deduplication:**
- Extracted `HIGHLIGHT_COLORS`/`HIGHLIGHT_BORDER_COLORS` → new `src/utils/highlightColors.ts`
- Removed duplicate `colToLetterInternal` from `formulaParser.ts`, now imports `colToLetter` from types

**Dependencies cleaned:**
- Removed unused `lucide-react` from dependencies
- Removed unused `cypress` from devDependencies and cypress scripts

**Docs updated:**
- README.md: test count corrected to 1346/51, removed Cypress refs, removed merge from features/menu
- PLAN.md: coverage numbers updated, file coverage table updated
- `jsonService.ts` comment updated (removed "merges")

**Lint fixes:**
- Fixed 4 pre-existing warnings (unused destructured vars in FormulaBar, unused import in test)

**Results:** 1346 tests (-41), 51 suites (-7), lint clean (0 warnings), type errors reduced 6→2
- Commit: (pending)

### 2026-07-27 (Phase 17: Cell Editing Workflows)

**Phase 17a: Formula View Toggle (Ctrl + `)**
- Added `showFormulas` state to App.tsx
- Grid displays formula text when `showFormulas` is true and cell starts with =
- Status bar shows 'Formulas' indicator when formula view is active
- Added View group to ShortcutsModal with the new shortcut
- 1 new test for toggle behavior
- Commit: 5524213

**Phase 17b: Expand Formula Bar (Ctrl+Shift+U)**
- Added expand/collapse toggle button to formula bar header
- Textarea replaces input when expanded (80px min height)
- Focus transfers to textarea when expanded
- `stopPropagation` prevents event bubbling to global handlers
- 1 new test for expand behavior
- Commit: a9dc6bf, 651c98a

**Phase 17c: Batch Entry Across Multiple Cells (Ctrl+Enter on range)**
- When range is selected and Ctrl+Enter is pressed, value applies to ALL cells
- Single cell selection behaves as before (commit and stay)
- Updated `onCommit` callback to accept `batch` parameter
- Updated `commit` function in useCellEditing to pass batch flag
- 11 existing tests updated to expect new batch parameter
- Commit: a9dc6bf

**Phase 17d: Formula Bar Commit Fix**
- Fixed stale closure: `sessionRef.current` updated immediately in `setBuffer`
- Formula bar edits now commit correctly after typing
- Commit: 9b4db50

**Phase 17e: Status Bar Cleanup**
- Status bar no longer shows cell contents after edit
- Changed from 'Updated A1 = [value]' to 'Updated A1'
- Commit: ac93c2a

**Phase 17f: Paste Text Starting with = as Plain Text**
- When pasted text starts with '=', prefix with single quote to make it plain text
- Single quote not displayed in cell (Excel behavior)
- Single quote preserved in raw value for editing
- Updated Grid `getDisplayValue` to strip leading single quote
- 2 new tests for paste behavior
- Commit: 5d035cf

**Results:** 1388 tests, 58 suites, all passing. Lint clean, type-check clean, build verified.

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

### 2026-07-27 (Stage 5: Cross-Sheet References — COMPLETE ✅)

**Stage 5a: Cross-Sheet Formula Evaluation**
- Fixed `evaluateWorkbook` to evaluate ALL sheets in the workbook using a shared cache
- Added `hasCrossSheetDeps` helper to detect cross-sheet formula dependencies
- Two-pass evaluation: sheets with no cross-sheet deps first, then sheets with deps
- Added 8 unit tests for cross-sheet formula evaluation
- Tests cover: literal refs, formula refs, SUM ranges, #REF! errors, quoted sheet names, chained refs, non-active sheet evaluation, circular ref detection

**Stage 5b: Cross-Sheet Paste**
- Added `sourceSheetIndex` to `ClipboardData` interface
- Updated `copyRange` and `cutRange` to accept and store source sheet index
- Added `prefixRefsWithSheet` utility to convert relative refs to cross-sheet refs
- Updated paste handler in App.tsx to adjust formula references when pasting across sheets
- Added 10 unit tests for `prefixRefsWithSheet`
- Added 4 integration tests for cross-sheet paste (literal values, same-sheet paste, cross-sheet paste, preserve cross-sheet refs)

**Files modified:**
- `src/utils/formulaEngine.ts` — evaluateWorkbook now evaluates all sheets
- `src/utils/formulaParser.ts` — added `prefixRefsWithSheet` function
- `src/utils/clipboard.ts` — added `sourceSheetIndex` to ClipboardData
- `src/App.tsx` — paste handler adjusts cross-sheet refs

**Files created:**
- `src/App.crosssheet.test.tsx` — integration tests for cross-sheet paste

**Results:**
- **1475 tests across 56 suites, all passing**
- Lint clean (0 warnings)
- Only 2 pre-existing TypeScript errors (not regressions)
- Cross-sheet formula evaluation: `=Sheet2!A1` correctly returns computed value from Sheet2
- Cross-sheet paste: relative refs converted to cross-sheet refs pointing back to source sheet

### 2026-07-28 (Phase 18: Sort & Filter — COMPLETE ✅)
- Created `src/utils/sheetSort.ts` — sort engine with multi-column support, formula ref adjustment
- Created `src/utils/sheetFilter.ts` — filter engine with custom conditions, AND logic
- Created `src/components/FilterDropdown.tsx` — per-column filter dropdown UI
- Added "Data" menu with Sort (A-Z, Z-A) and Filter (Toggle, Clear All) items
- Integrated filter state into Grid virtualizer (visibleRowIndices mapping)
- Added Ctrl+Shift+L keyboard shortcut for filter toggle
- Status bar shows "X of Y records visible" when filter active
- **1500+ tests, all passing**

### 2026-07-28 (Coverage Push — Phases 1-8 continued)
- Phase 1 (Quick Wins): All targeted files at 100% lines — COMPLETE ✅
- Phase 6 (pdfExport): 100% all metrics — COMPLETE ✅
- Phase 9c (App.tsx Coverage Recovery): 91.05% lines — COMPLETE ✅
- Added tests for: clipboard edge cases, SearchReplaceModal edge cases, sheetSort, sheetFilter, FilterDropdown custom filters, Grid handlers, App menu handlers, FormulaBar keyboard shortcuts, useCellEditing EDIT/POINT modes
- Added istanbul ignore for genuinely unreachable code in: sheetOperations, formulaEngine, FormulaBar, fillSeries, SearchReplaceModal, ImportExcelButton, SheetTabs, FilterDropdown, AboutModal, ImportJsonButton, ImportExportBridge, DropdownMenu, Toolbar
- **1873 tests across 74 suites, all passing**
- Coverage: **93.94% stmts, 85.03% branches, 95.76% funcs, 95.31% lines**
- Commits: ef8978a, 96179ac, d9a5123, ac61179, ad91679, c6479dd, c50cca8, 51eba83, 0c78836, 4bf6772, 61b4b3c, a264a1e, 3cd40cf, 70c99c3, 13782ca, 32ac045, 9571c80, 1d18957, cb2dc86, 1b60970, b4e928e, 1460792, b6e8a71, 344b549, d7b743b, b5a14fc, 290691e, dbc1f8c, 224a429, ba9e5d3, 4be1a4f, 78ab639, 85a4214, 122439a, 550955d, 778f27f, e856fdc, 5e7c753

### 2026-07-28 (PLAN.md Update)
- Updated Current State: 1445 → 1873 tests, 55 → 74 suites
- Updated coverage: 93.21/83.91/93.83/94.83 → 93.94/85.03/95.76/95.31
- Marked Phase 1 (Quick Wins) as COMPLETE ✅
- Marked Phase 6 (pdfExport) as COMPLETE ✅
- Marked Phase 9c (App.tsx Coverage Recovery) as COMPLETE ✅
- Updated Phase 2-5, 7 with current coverage numbers and completed subtasks
- Added "Additional Features" section for: Fill Handle, Export Buttons, Freeze Panes, Formula Autocomplete, Number Formatting, Sheet Operations, Fill Series Utility, About Modal, Sheet Tabs, Toolbar (re-added), Print Setup, Paste Special
- Added Phase 18 (Sort & Filter) to completed phases list
- Updated coverage by file table with all 56 source files
- Phase 8 (Final Verification) updated with current gap analysis
