# BUGFIX — Bug Tracking & Resolution

This file tracks bugs in **existing** code, functions, and UI elements. New features and refactoring continue to live in `PLAN.md`. Both tracks are recorded chronologically in `PROGRESS_LOG.md`.

---

## 🔴 Open Bugs

<!-- Add new bugs here as they're discovered. Each entry should have:
     - Symptom (what the user sees)
     - Suspected file/component
     - Date discovered -->

### B-002: F9 Formula Evaluation Not Implemented
- **Symptom**: Pressing F9 while editing a formula does nothing. Excel/Sheets highlights the selected sub-expression and shows the evaluated result in-place.
- **Suspected file**: `src/components/FormulaBar.tsx`, `src/components/Grid.tsx`, `src/utils/formulaEngine.ts`
- **Discovered**: 2026-07-28 (documented in PLAN.md Phase 19 analysis)
- **Impact**: Low — power-user feature, not commonly expected
- **Fix direction**: Add `evaluateSelection(buffer, selStart, selEnd)` to formulaEngine, wire F9 key in both editors (deferred to Phase 19d)

### B-004: In-Cell Editor Lacks Syntax Highlighting — ✅ FIXED (see Recently Fixed below)
- ~~Symptom~~: ~~Formula bar shows colored cell reference overlays and function highlighting while editing. The in-cell editor is a plain `<input>` with no visual formula aid.~~
- **Status**: Fixed 2026-07-31 — see B-004 entry in Recently Fixed

### B-005: storageService.ts Branch Coverage ~66% (Lowest in Project)
- **Symptom**: Defensive branches in storageService are untested, leaving potential edge cases uncovered (corrupt localStorage, quota exceeded, etc.).
- **Suspected file**: `src/utils/storageService.ts`
- **Discovered**: 2026-07-30 (from PLAN.md Phase 8 gap analysis)
- **Impact**: Low — code works but has untested error paths
- **Fix direction**: Write tests for error/edge paths, or add istanbul ignore for genuinely unreachable defensive code

---

## 🟡 Under Investigation

<!-- Bugs being actively diagnosed — root cause not yet confirmed -->

## ✅ Recently Fixed

<!-- Bugs resolved in this session or recent past. Newest first. -->

### 2026-07-31: B-009 — Typing '=' makes character invisible in cell/FormulaBar ✅ VERIFIED
- **Symptom**: When choosing a cell and typing '=' (which enables edit mode and fires autocomplete), the '=' character was not visible in the cell or FormulaBar until the formula and range was completed and committed.
- **Root cause**: The cell editor and FormulaBar applied `text-transparent` to the input whenever the buffer started with '=' (to let the `FormulaHighlightOverlay` show through). But the overlay only renders segments when there are tokens to highlight. When the buffer was just '=' (empty formula body), the overlay returned null — no segments rendered — but the input still had `text-transparent`, making the '=' invisible.
- **Fix**: (1) Extracted segment computation into a reusable `computeHighlightSegments` function in `FormulaHighlightOverlay.tsx`. (2) Grid and FormulaBar now compute `showOverlay = isEditingFormula && computeHighlightSegments(value, true) !== null` and only apply `text-transparent` when the overlay will actually render segments.
- **Files**: `src/components/FormulaHighlightOverlay.tsx` (extracted `computeHighlightSegments`), `src/components/Grid.tsx` (use `showOverlay` guard), `src/components/FormulaBar.tsx` (use `showOverlay` guard), `src/components/Grid.interactions.test.tsx` (new test), `src/components/FormulaBar.test.tsx` (2 new tests)
- **Tests**: 2281 pass (was 2278)
- **Verification**: New tests verify '=' is visible (no text-transparent) and '=A1+B2' has text-transparent (overlay renders).

### 2026-07-31: Toggle formula view — Ctrl+` overwrites cell content ✅ VERIFIED
- **Symptom**: Pressing Ctrl+` (to toggle formula view) was overwriting the content of the active cell with the `` ` `` character.
- **Root cause**: The Grid's Ctrl+ shortcut exclusion switch did not include the backtick character `` ` ``. When Ctrl+` was pressed, the global handler in App.tsx toggled formula view (correct), BUT the Grid's keydown handler also fired and did not recognize `` ` `` as a Ctrl+ shortcut to exclude. The `` ` `` character fell through to the `isPrintableKey` check (ASCII 96 is in printable range 32-126), which started editing with `` ` `` as the buffer content — overwriting the existing cell value.
- **Fix**: Added `case '\`':` to the Ctrl+ exclusion switch in Grid's `handleKeyDown` handler. The grid now correctly skips Ctrl+` and lets the global listener handle it.
- **Files**: `src/components/Grid.tsx` (added backtick to Ctrl+ exclusion switch), `src/components/Grid.handlers.test.tsx` (new test)
- **Tests**: 2278 pass (was 2277)
- **Verification**: New test confirms Ctrl+` does not start editing (no input element rendered).

### 2026-07-31: B-008 — FormulaWizard Modal Blocking POINT Mode Range Selection ✅ VERIFIED
- **Symptom**: The FormulaWizard modal form was blocking POINT mode range selection. When the user clicked the range picker button to select a range on the grid, the modal (positioned in the center of the screen with `pointer-events-auto`) captured clicks on the grid cells behind it, preventing range selection.
- **Root cause**: The overlay had `pointer-events-none` (click-through) but the modal content had `pointer-events-auto`, so the modal still captured clicks in the center of the screen. The user couldn't select cells behind the modal.
- **Initial fix**: (1) Changed the modal to `pointer-events-none` in POINT mode so clicks pass through to the grid. (2) Moved the POINT mode indicator OUT of the modal and rendered it as a separate fixed element at the top of the screen (`fixed top-4 left-1/2 -translate-x-1/2 z-[60]`) with `pointer-events-auto` so the Cancel button remains clickable.
- **Enhanced fix (streamlined UX)**: (1) Modal now **completely hides** in POINT mode (not just click-through) — only the POINT mode indicator is visible at the top of the screen. (2) Modal **reappears** when the range is accepted (Enter) or cancelled (Escape/Cancel button). (3) Connected the wizard's POINT mode to the grid's selection mechanism via new `wizardPointMode` and `onWizardPointSelection` props. (4) Grid's Enter key accepts the current selection as the range and calls `applyPointSelection` which updates the parameter value and returns to WIZARD_ROOT state. (5) State is preserved between interactions — the wizard remembers which parameter is being edited.
- **Files**: `src/components/FormulaWizard.tsx` (modal hides in POINT mode + indicator), `src/components/Grid.tsx` (wizardPointMode + onWizardPointSelection props + Enter key handling), `src/App.tsx` (isWizardPointMode + handleWizardPointSelection + applyWizardPointSelection wiring), `src/components/FormulaWizard.transparency.test.tsx` (updated tests), `src/components/FormulaWizard.pointmode.test.tsx` (updated tests), `src/components/FormulaWizard.escape.test.tsx` (updated tests), `src/components/FormulaWizard.statepreserv.test.tsx` (updated tests), `src/components/Grid.interactions.test.tsx` (2 new tests)
- **Tests**: 2277 pass (was 2272)
- **Verification**: New tests verify modal is hidden in POINT mode, modal reappears after cancel, grid Enter key accepts range selection, and wizardPointMode properly connected.

### 2026-07-31: B-004 — In-Cell Editor Lacks Syntax Highlighting ✅ VERIFIED
- **Symptom**: Formula bar showed colored cell reference overlays and function highlighting while editing. The in-cell editor was a plain `<input>` with no visual formula aid — inconsistent UX.
- **Root cause**: The highlighting overlay (`formulaDisplay`) was computed inside FormulaBar's render function and never shared with the Grid's cell editor.
- **Fix**: (1) Extracted the highlighting logic into a shared `FormulaHighlightOverlay` component (`src/components/FormulaHighlightOverlay.tsx`), (2) FormulaBar now uses this shared component instead of inline useMemo, (3) Grid's cell editor (both frozen and scrollable) now renders `FormulaHighlightOverlay` underneath the input/textarea when editing a formula, (4) Input/textarea gets `text-transparent` class when editing a formula so the colored overlay shows through (matching FormulaBar behavior).
- **Files**: `src/components/FormulaHighlightOverlay.tsx` (new shared component), `src/components/FormulaBar.tsx` (uses shared component), `src/components/Grid.tsx` (overlay + text-transparent in cell editor), `src/components/Grid.interactions.test.tsx` (3 new tests)
- **Tests**: 2272 pass (was 2269)
- **Verification**: New tests verify overlay renders for formulas, doesn't render for plain values, and input gets text-transparent class.

### 2026-07-31: B-007 — String Concatenation with `&` Traps Editor in POINT Mode ✅ VERIFIED
- **Symptom**: Typing `=A1 & " " & B1` in the formula bar failed — the `&` triggered POINT mode, and subsequent characters (`"`, ` `) were silently swallowed. The formula `=(A1) & "" "" & (B1)` worked because `)` committed the reference and exited POINT mode before the next `&`.
- **Root cause**: `&` is in `POINT_TRIGGER_CHARS`, so typing it enters POINT mode. But the POINT state handler only exits to EDIT for `[A-Za-z0-9$]` chars (cell reference chars), `)`, `:`, operators, and Enter/Tab. Characters like `"` and ` ` (space) fell through all handlers and were silently ignored — they never made it into the buffer.
- **Fix**: Added a catch-all at the end of the POINT state handler: any unhandled printable character exits POINT mode and inserts into the buffer. This matches Excel behavior where typing any non-navigation character after an operator resumes normal editing.
- **Files**: `src/hooks/useCellEditing.ts` (POINT state catch-all), `src/App.pointmode.test.tsx` (2 new tests)
- **Tests**: 2269 pass (was 2267)
- **Verification**: New tests verify `=A1 & " " & B1` types correctly with spaces around `&`, and `(` after `&` enters POINT mode (correct behavior for function call).

### 2026-07-31: B-003 — In-Cell Editor Lacks Autocomplete ✅ VERIFIED
- **Symptom**: Typing `=` in the formula bar showed function autocomplete dropdown, but typing `=` in the in-cell editor did NOT show autocomplete. The FSM computed `autoComplete` state but only FormulaBar rendered the dropdown.
- **Root cause**: The `AutoCompleteDropdown` component was defined inside `FormulaBar.tsx` and only rendered there. The Grid had no access to autoComplete state or the dropdown component.
- **Fix**: (1) Exported `AutoCompleteDropdown` from FormulaBar.tsx, (2) Added autoComplete props to Grid (state + callbacks), (3) Grid now renders `AutoCompleteDropdown` when `autoComplete.open` is true and cell is being edited, (4) Passed autoComplete props from App.tsx to Grid.
- **Files**: `src/components/Grid.tsx` (autoComplete props + dropdown rendering), `src/components/FormulaBar.tsx` (exported AutoCompleteDropdown), `src/App.tsx` (pass autoComplete props), `src/components/Grid.interactions.test.tsx` (2 new tests)
- **Tests**: 2265 pass (was 2263)

### 2026-07-31: B-001 — In-Cell Editor Lacks Multiline Support ✅ VERIFIED
- **Symptom**: Pressing Alt+Enter in the in-cell editor inserted `\n` into the buffer, but the user never saw it because the editor was a single-line `<input>`. Content after the newline was invisible.
- **Root cause**: The FSM correctly handled Alt+Enter by inserting `\n` at the caret position, but the Grid rendered a single-line `<input>` element which cannot display newlines.
- **Fix**: Grid now conditionally renders a `<textarea>` when the buffer contains `\n`. The `<textarea>` auto-sizes based on line count (up to 5 visible rows). Alt+Enter in `<input>` forwards to FSM (which inserts `\n`), triggering the switch to `<textarea>`. Enter in `<textarea>` (without modifiers) commits and exits edit mode (forwarded to FSM). All other keys are forwarded to the FSM as before.
- **Files**: `src/components/Grid.tsx` (conditional `<input>`/`<textarea>` rendering + Alt+Enter handling in both cell editors), `src/components/Grid.interactions.test.tsx` (3 new tests)
- **Tests**: 2263 pass (was 2260)
- **Verification**: All new tests pass — textarea renders on newline, Alt+Enter inserts newline, Enter in textarea doesn't preventDefault.

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
