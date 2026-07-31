# BUGFIX — Bug Tracking & Resolution

This file tracks bugs in **existing** code, functions, and UI elements. New features and refactoring continue to live in `PLAN.md`. Both tracks are recorded chronologically in `PROGRESS_LOG.md`.

---

## 🔴 Open Bugs

<!-- Add new bugs here as they're discovered. Each entry should have:
     - Symptom (what the user sees)
     - Suspected file/component
     - Date discovered -->

### B-001: In-Cell Editor Lacks Multiline Support
- **Symptom**: Pressing Alt+Enter in the in-cell editor inserts `\n` into the buffer, but the user never sees it because the editor is a single-line `<input>`. Content after the newline is invisible.
- **Suspected file**: `src/components/Grid.tsx` (in-cell editor rendering)
- **Discovered**: 2026-07-28 (documented in PLAN.md Phase 19 analysis)
- **Impact**: Medium — Alt+Enter is a documented shortcut (Phase 16a) but doesn't work visually in-cell
- **Fix direction**: Switch from `<input>` to `<textarea>` when `\n` is detected in buffer or Alt+Enter is pressed (deferred to Phase 19e)

### B-002: F9 Formula Evaluation Not Implemented
- **Symptom**: Pressing F9 while editing a formula does nothing. Excel/Sheets highlights the selected sub-expression and shows the evaluated result in-place.
- **Suspected file**: `src/components/FormulaBar.tsx`, `src/components/Grid.tsx`, `src/utils/formulaEngine.ts`
- **Discovered**: 2026-07-28 (documented in PLAN.md Phase 19 analysis)
- **Impact**: Low — power-user feature, not commonly expected
- **Fix direction**: Add `evaluateSelection(buffer, selStart, selEnd)` to formulaEngine, wire F9 key in both editors (deferred to Phase 19d)

### B-003: In-Cell Editor Lacks Autocomplete
- **Symptom**: Typing `=` in the formula bar shows function autocomplete dropdown, but typing `=` in the in-cell editor does NOT show autocomplete. The FSM computes `autoComplete` state but only FormulaBar renders the dropdown.
- **Suspected file**: `src/components/Grid.tsx` (no AutoCompleteDropdown rendered)
- **Discovered**: 2026-07-28 (documented in PLAN.md Phase 19 analysis)
- **Impact**: High — autocomplete is a core editing feature; inconsistent behavior between editors
- **Fix direction**: Render AutoCompleteDropdown in Grid when `autoComplete.open` is true and session is in-cell editing

### B-004: In-Cell Editor Lacks Syntax Highlighting
- **Symptom**: Formula bar shows colored cell reference overlays and function highlighting while editing. The in-cell editor is a plain `<input>` with no visual formula aid.
- **Suspected file**: `src/components/Grid.tsx` (plain `<input>`, no `formulaDisplay` overlay)
- **Discovered**: 2026-07-28 (documented in PLAN.md Phase 19 analysis)
- **Impact**: Medium — formula bar has it, in-cell doesn't; inconsistent UX
- **Fix direction**: Extract formula highlighting overlay from FormulaBar into shared `FormulaEditor` wrapper (deferred to Phase 19c)

### B-005: storageService.ts Branch Coverage ~66% (Lowest in Project)
- **Symptom**: Defensive branches in storageService are untested, leaving potential edge cases uncovered (corrupt localStorage, quota exceeded, etc.).
- **Suspected file**: `src/utils/storageService.ts`
- **Discovered**: 2026-07-30 (from PLAN.md Phase 8 gap analysis)
- **Impact**: Low — code works but has untested error paths
- **Fix direction**: Write tests for error/edge paths, or add istanbul ignore for genuinely unreachable defensive code

---

## 🟡 Under Investigation

<!-- Bugs being actively diagnosed — root cause not yet confirmed -->

(None currently)

---

## ✅ Recently Fixed

<!-- Bugs resolved in this session or recent past. Newest first. -->

### 2026-07-31: B-006 — Grid Cell Editor Selection Replacement ✅ VERIFIED
- **Symptom**: Double-clicking a formula token (e.g., `AVERAGE` in `=AVERAGE(B6:D6)`) to select it in the Grid cell editor, then typing a replacement character (e.g., `M`), appended the character at the end (`=AVERAGE(B6:D6)M`) instead of replacing the selection (`=M(B6:D6)`). The FormulaBar worked correctly but the in-cell editor did not.
- **Root cause**: Grid's `onKeyDown` handler called `e.preventDefault()` and forwarded ALL keys to the FSM via `onRawKeyDown`. The FSM's `handleKeyDown` in EDIT state appends printable characters to the END of the buffer (`s.buffer + key`), ignoring the native selection. The FormulaBar already had selection-detection logic to let native input handle replacement, but the Grid did not.
- **Fix**: Added selection-detection logic to Grid's `onKeyDown` (matching FormulaBar behavior): (1) detect `hasSelection` via `selectionStart !== selectionEnd`, (2) collapse selection on Arrow keys without Shift before FSM processes, (3) always forward `)` to FSM (commits POINT reference), (4) for selection keys (printable/Backspace/Delete) with active selection, return early without `preventDefault` — letting native input handle replacement. The `onChange` handler syncs the result to the FSM.
- **Files**: `src/components/Grid.tsx` (onKeyDown handler in cell editor input), `src/components/Grid.interactions.test.tsx` (3 new tests)
- **Tests**: 2260 pass (was 2257)
- **Verification**: Verified in real browser (Chrome + puppeteer CDP) — double-click selection and Shift+Arrow selection both correctly replace selected text when typing.

### 2026-07-30: B-00N — Freeze Panes Not Following Excel Specification ✅ VERIFIED
- **Symptom**: Clicking View → Freeze Panes always froze exactly 1 row and 1 column regardless of which cell was selected. When scrolling right past content, frozen cells disappeared and/or stuck horizontally (not scrolling with content). Grid lost focus after enabling freeze panes. Navigation down did not keep frozen rows visible.
- **Root causes**:
  1. `handleFreeze` in App.tsx hardcoded `freeze(1, 1)` instead of computing freeze dimensions from the active cell position.
  2. The column/row virtualizer only returns items visible in the viewport — frozen columns/rows outside the viewport were not rendered at all.
  3. Frozen row cells used `position: sticky` inside absolutely-positioned row containers — the absolute positioning broke the sticky context, preventing rows from staying fixed when scrolling down.
  4. Menu actions didn't restore focus to the grid after execution.
  5. ALL frozen row cells had `position: sticky; left: ...` causing cells in non-frozen columns to stick horizontally instead of scrolling with content.
- **Fixes**:
  1. `handleFreeze` now reads the selection anchor (`gridSelection.anchorRow`/`anchorCol`) to determine freeze dimensions. Active cell A1 → no freeze; C3 → freeze 2 rows + 2 cols; D5 → freeze 4 rows + 3 cols.
  2. Grid now computes `renderColumns`/`renderRows` that always include frozen columns/rows, even when the virtualizer doesn't return them due to scroll position.
  3. Frozen rows are rendered in a dedicated sticky container (`position: sticky; top: headerHeight`) outside the absolutely-positioned row flow. Scrollable rows have a `paddingTop` offset equal to the frozen row height.
  4. MenuBar now calls `onAfterMenuAction` after each menu item click, which restores focus to the grid.
  5. Frozen row cells in non-frozen columns now use `position: absolute` (scrolls with content). Only intersection cells (frozen row + frozen column) use `position: sticky` (sticks horizontally) with z-index 25.
- **Files**: `src/App.tsx` (handleFreeze + onAfterMenuAction wiring), `src/components/Grid.tsx` (renderColumns/renderRows + frozen rows container + frozen row cell positioning), `src/components/MenuBar.tsx` (onAfterMenuAction callback), `src/App.freezePanes.test.tsx` (7 new tests), `src/Grid.freezeScroll.test.tsx` (4 scroll tests including horizontal positioning), `src/App.handlers2.test.tsx`, `src/App.menu.test.tsx`, `src/App.test.tsx`
- **Tests**: 2242 pass (was 2227)
- **Verification**: Manually debug-tested 2026-07-31 — freeze panes working correctly with proper Excel-spec behavior, horizontal/vertical scrolling, no gaps, editing/selection functional.

### 2026-07-31: B-00N — Freeze Panes Gap Above Frozen Rows + Editing Issue ✅ VERIFIED
- **Symptom**: A visual gap appeared above the frozen rows. Pasting into scrollable rows worked, but editing (clicking cells to select/edit) did not work for scrollable rows.
- **Root causes**:
  1. The frozen rows container used `position: sticky` (which occupies space in normal flow), AND the scrollable rows spacer had `paddingTop: frozenRowHeight`. This created a double-space gap.
  2. The scrollable rows were positioned with `top: virtualRow.start` (absolute position in full scroll height), but since the spacer now starts after the frozen rows container, the scrollable rows were offset by an additional `frozenRowHeight`.
- **Fixes**:
  1. Removed `paddingTop: frozenRowHeight` from the spacer — the frozen rows container already occupies that space in normal flow.
  2. Changed scrollable row positioning from `top: virtualRow.start` to `top: virtualRow.start - frozenRowHeight` to account for the frozen rows container occupying space.
- **Files**: `src/components/Grid.tsx` (spacer + scrollable row positioning), `src/Grid.freezeScroll.test.tsx` (3 new tests: gap verification, double-click edit, single-click select)
- **Tests**: 2242 pass
- **Verification**: Manually debug-tested 2026-07-31 — no gap above frozen rows, editing and selection in scrollable rows working correctly.

### 2026-07-30: B-00N — POINT Mode Multi-Parameter Continuation
- **Symptom**: After typing a comma inside a formula (e.g., `=SUM(A1,`), arrow keys would commit the formula instead of entering POINT mode for the next parameter.
- **Root cause**: Comma and other continuation operators (+, -, *, /) didn't re-enter POINT mode for multi-parameter function editing.
- **Fix**: Added continuation operator detection that re-enters POINT mode after comma. Regular arrow = single-cell point, shift+arrow = range point.
- **Files**: `src/hooks/useCellEditing.ts`, `src/components/Grid.interactions.test.tsx`
- **Tests**: 1500 pass (was 1494)

### 2026-07-30: B-00N — Autocomplete State Duplication / POINT Mode Bug
- **Symptom**: Autocomplete dropdown would not appear when editing in cell; state duplication between FSM and FormulaBar caused stale values.
- **Root cause**: `formulaBarValue` state in App.tsx duplicated FSM's `session.buffer`. FormulaBar had its own `autoComplete` state that drifted from FSM.
- **Fix**: FSM now owns `autoComplete` state; FormulaBar is pure view reading from FSM. Removed `formulaBarValue` duplication. Fixed pre-existing POINT-mode state bug.
- **Files**: `src/components/FormulaBar.tsx`, `src/App.tsx`, `src/hooks/useCellEditing.ts`
- **Tests**: 1543 pass (was 1523)

### 2026-07-29: B-00N — Ctrl+Shift+F Sticks FSM in ENTER State
- **Symptom**: Ctrl+Shift+F opened FormulaWizard, but after clicking "Apply to Cell", the cell displayed 'F', statusbar showed "Updated E4", and keyboard editing/navigation was frozen until clicking another cell.
- **Root cause**: Grid's Ctrl+ shortcut exclusion switch was missing `'f'`/`'F'` and `'l'`/`'L'`. When Ctrl+Shift+F was pressed, the Grid keydown handler fired BEFORE the window handler, saw `'F'` as a printable char, and called `onStartEnter(row, col, 'F')` — sticking the FSM in ENTER state with buffer `'F'`.
- **Fix**: Added `'f'`, `'F'`, `'l'`, `'L'` to the Ctrl+ exclusion switch in Grid.tsx.
- **Files**: `src/components/Grid.tsx`, `src/components/Grid.interactions.test.tsx`
- **Tests**: 1999 pass

### 2026-07-29: B-00N — FormulaBar Double-Commit on Blur
- **Symptom**: Pressing Enter or Tab in FormulaBar committed the value, but the subsequent blur event would fire `handleBlur` again with an empty buffer, overwriting the committed value.
- **Root cause**: `handleBlur` in FormulaBar unconditionally committed the buffer without checking if the FSM had already transitioned to SELECT state.
- **Fix**: Added guard in FormulaBar's `handleBlur` to skip commit when `session.state === 'SELECT'` (meaning Enter/Tab already committed).
- **Files**: `src/components/FormulaBar.tsx`, `src/components/Grid.tsx`
- **Tests**: 1894 pass

### 2026-07-30: B-00N — Export Menu Events Not Handled
- **Symptom**: File → Export → Excel/CSV/JSON/PDF did nothing. Save/Load menu items showed "Use the Save/Open button" but no such buttons existed.
- **Root cause**: `handleSaveMenu` and `handleLoadMenu` were stubs with placeholder messages. Export menu dispatched `simplesheets:export-*` events but `ImportExportBridge` only listened for `import-*` events.
- **Fix**: `handleSaveMenu` now calls `downloadJson(workbook)`. `handleLoadMenu` dispatches `simplesheets:open` event. `ImportExportBridge` now has refs + event listeners for all 4 export buttons. All 4 export button components converted to `forwardRef`.
- **Files**: `ImportExportBridge.tsx`, `ExportExcelButton.tsx`, `ExportCsvButton.tsx`, `ExportJsonButton.tsx`, `ExportPdfButton.tsx`, `App.tsx`, `README.md`, 5 test files
- **Tests**: 2076 pass

### 2026-07-29: B-00N — Save/Open/Export Menu Stubs
- **Symptom**: File → Save showed "Use the Save button in the toolbar to save" — but no Save button existed. Export submenu items did nothing.
- **Root cause**: Menu handlers were placeholder stubs from early UI development, never wired to actual functionality.
- **Fix**: Save → downloads JSON, Open → file picker via event, Export buttons wired through ImportExportBridge with forwardRef.
- **Files**: `App.tsx`, `ImportExportBridge.tsx`, all 4 ExportButton components
- **Tests**: 2076 pass

### 2026-07-27: B-00N — Paste Into Range / Formula Offset
- **Symptom**: Pasting multiple cells into a range only pasted the first cell. Formula references weren't adjusted correctly based on paste position.
- **Root cause**: Paste handler iterated over destination range without tiling support. Source row/col wasn't stored in clipboard data.
- **Fix**: Added tiling support for paste-into-range. Stored `sourceRow`/`sourceCol` in clipboard for correct offset calculation.
- **Files**: `src/utils/clipboard.ts`, `src/App.tsx`
- **Tests**: 1494 pass

### 2026-07-27: B-00N — Formula Autocomplete In Cell Not Triggered
- **Symptom**: Typing `=` in a cell didn't show autocomplete dropdown.
- **Root cause**: `handleKeyDown` called `e.preventDefault()` which suppressed native `onChange`, so the old onChange-based autocomplete trigger never fired.
- **Fix**: Replaced onChange-based trigger with useEffect that watches value/cursorPos/session.state. Added `findFunctionToken` guard so autocomplete doesn't open when cursor is after '(', ',', '+', or digits.
- **Files**: `src/components/FormulaBar.tsx`, `src/components/Grid.tsx`
- **Tests**: 1523 pass

### 2026-07-27: B-00N — Ctrl+X/C/V Global Clipboard Handling
- **Symptom**: Copy/Cut/Paste didn't work when focus was in formula bar or a modal.
- **Root cause**: Clipboard handlers were attached to the Grid div, not the window. Focus in other elements meant the Grid div didn't receive the events.
- **Fix**: Moved clipboard handlers to window-level listeners. Fixed temporal dead zone bug with selectionRef assignment order.
- **Files**: `src/App.tsx`, `src/components/Grid.tsx`
- **Tests**: 1131 pass

---

## 📋 Bug Lifecycle

```
Discover → Log in Open Bugs → Write failing test → Diagnose → Fix → Verify → Move to Recently Fixed → Append to PROGRESS_LOG
```

Each bug gets an ID (B-XXX) when logged. Fixed bugs are moved to "Recently Fixed" with full diagnostic details for future reference.
