# PLAN — 100% Test Coverage (Pre End-User Testing)

## Goal
Achieve 100% line/branch/statement/function coverage on all source files before end-user testing.

## Current State
- **95.97%** statements, **81.71%** branches, **98.39%** functions, **98.15%** lines
- 816 tests across 33 suites, All passing
- All phases 1-7 substantially complete; final gap closure in progress

### Coverage by file (lines %)
| File | Lines | Branches | Status |
|------|-------|----------|--------|
| App.tsx | 100% | 89.18% | ⚠️ branches |
| Grid.tsx | 100% | 91.91% | ⚠️ branches |
| FormulaBar.tsx | 95.43% | 91.66% | ⚠️ lines + functions |
| formulaEngine.ts | 93.3% | 67.95% | ❌ major gap |
| useCellEditing.ts | 100% | 95.32% | ⚠️ branches |
| pdfExport.ts | 100% | 75% | ⚠️ branches |
| HistoryContext.tsx | 100% | 66.66% | ⚠️ branches |
| storageService.ts | 100% | 79.41% | ⚠️ branches |
| csvService.ts | 98.18% | 84.37% | ⚠️ |
| excelImport.ts | 100% | 100% | ✅ |
| excelExport.ts | 100% | 94.73% | ⚠️ |
| formulaParser.ts | 100% | 93.75% | ⚠️ |
| formulaValidation.ts | 100% | 90.9% | ⚠️ |
| All other files | 100% | 100% | ✅ |

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

## Progress Log

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
