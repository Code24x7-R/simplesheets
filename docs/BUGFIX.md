# BUGFIX — Bug Tracking & Resolution

This file tracks bugs in **existing** code, functions, and UI elements. New features and refactoring continue to live in `PLAN.md`. Both tracks are recorded chronologically in `PROGRESS_LOG.md`.

---

## 🔴 Open Bugs

<!-- Add new bugs here as they're discovered. Each entry should have:
     - Symptom (what the user sees)
     - Suspected file/component
     - Date discovered
     - Impact (High/Medium/Low)
     - Fix direction (if known) -->


<!-- No open bugs. Add new ones as they're discovered. -->

## 🟡 Under Investigation

<!-- Bugs being actively diagnosed — root cause not yet confirmed. None currently. -->

## ✅ Recently Fixed

<!-- Bugs resolved in this session or recent past. Newest first. -->

### 2026-08-11: B-030 — FormulaWizard strips sheet reference on import ✅ VERIFIED
- **Symptom**: Opening the Nested Formula Wizard on a cell with a cross-sheet formula (e.g. `=SUM(Sheet2!C2:C11)`) displays the parameter as a bare range (`C2:C11`) without the `Sheet2!` prefix. Applying without editing writes `=SUM(C2:C11)` to the source sheet, which evaluates against the active sheet (Sheet1) instead of Sheet2 — returning 0 when Sheet1 cells contain text.
- **Root cause**: `cellRefToString()` and `rangeToString()` in `src/utils/formulaParser.ts` ignored the `sheetName` property on `CellRefNode`/`RangeNode`. The parser correctly populates `sheetName` (e.g. `"Sheet2"`), but the stringifiers dropped it. The wizard's `importFormulaToWizard` uses these helpers to convert AST args to `rawValue` strings, so the sheet ref was silently lost at import time.
- **Fix**: `cellRefToString` now prepends `sheetName!` when present. `rangeToString` emits the range-level prefix once and suppresses per-cell prefixes to avoid the redundant `Sheet2!C2:Sheet2!D11` form.
- **Files**: `src/utils/formulaParser.ts`, `src/utils/formulaParser.test.ts`, `src/utils/formulaWizardImport.test.ts`, `src/utils/formulaWizardCompiler.test.ts`, `src/App.test.tsx`
- **Tests**: +7 new tests (2827 total): cell/range stringifier with sheet name, import preserves cross-sheet range and cell ref, import→compile round-trip, end-to-end wizard open+apply preserves sheet ref.

### 2026-08-11: B-029 — FormulaWizard Apply writes to wrong sheet after cross-sheet navigation ✅ VERIFIED
- **Symptom**: With a cross-sheet formula in a cell (e.g. `=SUM(Sheet2!C2:C11)` in Sheet1!B5), opening the Nested Formula Wizard (Ctrl+Shift+F), navigating to Sheet2 during POINT mode to pick a new range, and pressing Apply writes the formula to Sheet2!B5 instead of the source Sheet1!B5. Focus also stays on Sheet2 instead of returning to the source cell.
- **Root cause**: The B-011 fix captured the target cell's row/col when the wizard opened, but NOT the source sheet index. When the user navigated to another sheet during POINT mode (which changes `workbook.activeSheetIndex`), `handleCellChange` wrote to whichever sheet was active (Sheet2) instead of the source sheet (Sheet1). No code switched the active sheet back on apply.
- **Fix**: (1) Added `wizardTargetSheetIndex` state captured in `handleFxClick` and the autocomplete `onFunctionSelect` path. (2) `handleCellChange` now accepts an optional `sheetIndex` parameter — writes to that sheet and sets `activeSheetIndex` to it in the same atomic history entry (avoids a confusing separate "Switch to…" undo step). (3) `handleWizardApply` passes the captured sheet index; `handleCloseWizard` resets both target cell and sheet index.
- **Files**: `src/App.tsx`, `src/App.test.tsx`
- **Tests**: +1 new test (2819 total): opens wizard from Sheet1 with cross-sheet formula, switches to Sheet2 mid-session, applies — verifies formula lands on Sheet1 (source), Sheet2 cell untouched, and active sheet returns to Sheet1.

### 2026-08-11: B-028 — Marching ants appear at offset after copy/cut (Ctrl+C/X) ✅ VERIFIED
- **Symptom**: After selecting a range and pressing Ctrl+C/Ctrl+X, the marching-ants dashed border appears offset from the actual selection. Single cell: ants shift ~½ cell width right. Horizontal range (e.g. C2:D2): each cell offset by its own width plus a gap. Vertical range: cells shift right with no vertical gaps. The selection ref itself stays correct (paste works), but the visual ants are displaced.
- **Root cause**: `.clipboard-range-cell { position: relative; }` in `src/index.css` overrode the cell's `position: absolute` (from Tailwind's `.absolute` class). Both rules have equal specificity, and the custom rule comes later in source order, so it won. With `position: relative`, the inline `left`/`top` offsets (meant for absolute positioning) were applied relative to the cell's normal-flow position instead of the grid container — producing the width-proportional offset. The `position: relative` was a leftover from an unimplemented `::before` pseudo-element design (the actual ants use `background-image` directly on the cell).
- **Fix**: (1) Removed `position: relative` from `.clipboard-range-cell` in `src/index.css`. (2) Added defensive inline `cellStyle.position = 'absolute'` in the marching-ants block in `Grid.tsx`, guarded by `!isCellFrozen(row, col)` so frozen-column cells keep their `sticky` positioning.
- **Files**: `src/index.css`, `src/components/Grid.tsx`, `src/App.copyants.test.tsx`
- **Tests**: +7 new tests (2818 total): shift+click range, shift+arrow range, cut color, paste clears ants, single-cell, inline position:absolute guard, frozen-column keeps sticky

### 2026-08-08: B-027 — Six copy/paste gaps vs Excel spec (excel-copypaste.md review) ✅ VERIFIED
- **Symptom**: Review against `excel-copypaste.md` revealed 6 functional/UX deviations from Excel copy/paste behavior.
- **Gaps & fixes**:
  1. **Clipboard not cleared on typing** — `handleGridStartEnter` now calls `handleClearClipboard()` so typing dismisses marching ants (matches Excel: "stays active until you press Esc or start typing").
  2. **Filtered paste overwrites hidden rows** — Paste loop now checks `filterStateRef.current.hiddenRows` and skips hidden destination rows.
  3. **Values paste mode strips number formatting** — `applyPasteOptions` now preserves `cell.style.numberFormat` when mode is `values` (e.g., `$1,234.50` stays formatted).
  4. **No keyboard shortcut for Paste Special** — Added `Ctrl+Shift+V` global shortcut handler.
  5. **Marching ants were opacity pulse only** — Replaced with animated diagonal-stripe gradient (`marching-ants-travel` keyframe) applied via CSS class on clipboard-range cells.
  6. **Copy/cut status lacked cell count** — Status messages now include cell count: `"Copied 6 cell(s)"`.
- **Files**: `src/App.tsx`, `src/utils/pasteSpecial.ts`, `src/index.css`, `src/components/Grid.tsx`, `src/components/MenuBar.tsx`
- **Tests**: +7 new tests (2812 total): `pasteSpecial.test.ts` +3, `App.externalpaste.test.tsx` +2, `App.coverage-gaps.test.tsx` +2; existing tests in `App.handlers.test.tsx` and `Grid.test.tsx` updated for new status messages and class-based marching ants

### 2026-08-08: B-026 — TEXT() ignores format codes when value is a string date (e.g., from NOW()) ✅ VERIFIED
- **Symptom**: `=TEXT(G1, "ddd")`, `=TEXT(G1, "mmm")`, `=TEXT(G1, "yyyy")` return the raw ISO string from `=NOW()` instead of formatting the date. Format codes are completely ignored.
- **Root cause**: `NOW()` returns an ISO 8601 string (e.g., `"2026-08-08T12:34:56.789Z"`). The TEXT function's date-formatting branch only checked `typeof val === 'number'` (Excel serial dates). String values fell through to `toString(val)`, bypassing `formatDate()` entirely.
- **Fix**: Added a string-date branch in the TEXT case: when `val` is a non-empty string, attempt `new Date(val)`; if valid and the format contains date codes, route through `formatDate()`. This handles NOW(), TODAY(), and any cell containing an ISO date string. 6 lines added in `formulaEngine.ts`.
- **Files**: `src/utils/formulaEngine.ts`, `src/utils/formulaEngine.test.ts`
- **Tests**: +4 tests (ddd, mmm, yyyy, dd/mm/yyyy with string date values)

### 2026-08-08: B-025 — Sorting with active filter leaves stale hiddenRows indices ✅ VERIFIED
- **Symptom**: After applying a sort while a filter is active, wrong rows are hidden/shown. Rows that should be visible appear hidden and vice versa.
- **Root cause**: The filter state stores `hiddenRows` as a `Set<number>` of row indices. `sortRange` physically reorders cell data to new row positions, but `applySort` in `App.tsx` never updated `filterState.hiddenRows`. The stale indices pointed to different data after sorting.
- **Fix**: After sorting, if a filter is active, recompute the filter state against the sorted sheet using `createFilterState(sortedSheet, headerRow, filters)`. This recalculates which row indices should be hidden based on the new positions while preserving the user's filter criteria.
- **Files**: `src/App.tsx` (`applySort` recomputes filter), `src/utils/sheetSort.test.ts` (2 new integration tests)
- **Tests**: 2720 pass (was 2718), lint clean, type-check clean, build clean

### 2026-08-07: B-024 — Cross-sheet cache pollution: same-sheet cell refs read stale values from earlier sheets ✅ VERIFIED
- **Symptom**: On Sheet4, `=A2*2` in B2 returns 44 instead of 4, B3 returns 48, etc. — only rows 9+ are correct. Column A values are all 2, so every B cell should be 4. The wrong values matched `Sheet1!A2` (22) * 2 = 44, indicating Sheet1's computed values were leaking into Sheet4's evaluation.
- **Root cause**: In `evaluateCell` (`src/utils/formulaEngine.ts`), the shared evaluation cache keyed same-sheet cell references by bare `"row:col"` (e.g. `"1:0"` for A2) without a sheet-index prefix. The cache is shared across all sheets in `evaluateWorkbook`. When Sheet1 evaluated A2=22 and cached `"1:0" -> 22`, Sheet4's later evaluation of `=A2*2` found the stale entry and used 22 instead of reading Sheet4's own A2 (which is 2). Rows without a prior-sheet counterpart (A9+) fell through to the correct sheet data, explaining why only B2:B8 were wrong.
- **Fix**: Changed the cache key to always include the sheet index: `` `${targetIndex}:${key}` ``. This scopes every cache entry by sheet, eliminating cross-sheet collisions.
- **Files**: `src/utils/formulaEngine.ts` (cache key fix in `evaluateCell`), `src/utils/formulaEngine.test.ts` (regression test with 4-sheet workbook)
- **Note**: The fix also makes evalStack keys uniform (always sheet-index-prefixed). Previously same-sheet refs used bare `"row:col"` while cross-sheet refs used `"sheetIndex:row:col"`. The `evalStack` is shared across sheets via sub-context spread, so uniform keys make cross-sheet circular detection marginally more robust (though existing tests already passed due to the shared stack).
- **Tests**: 2718 pass (2 new regression tests), lint clean, type-check clean, build clean

### 2026-08-01: B-023 — In-cell editor initial cursor position not right-most ✅ VERIFIED
- **Symptom**: (1) When double-clicking a cell to edit it, the cursor appeared at the beginning of the text instead of at the end. (2) When editing a long formula like `=SUM(Sheet1!B2:Sheet1!B21)+A3+SUM(F14:F22)`, the caret was placed at the end but the input wasn't scrolled to show it — the user only saw the beginning of the formula.
- **Root cause**: (1) The cursor sync effect (`useEffect`) had a guard `document.activeElement !== input` that prevented syncing when the input wasn't focused yet. When the input first mounted with `autoFocus`, the effect could run before the browser had established focus. (2) The Grid cell editor lacked the scroll-to-caret logic that FormulaBar has.
- **Fix**: (1) Extracted cursor sync into a `syncCursorPosition` callback. (2) Added `onFocus={syncCursorPosition}` to both the input and textarea editor elements (frozen and non-frozen variants). (3) Added scroll-to-caret logic using canvas text measurement (matching FormulaBar's approach) so the input scrolls horizontally to keep the caret visible. (4) Updated test helper `useTestEditingSession` to match real `startEdit` behavior (loads cell value, sets caret to end).
- **Files**: `src/components/Grid.tsx` (syncCursorPosition + onFocus + scroll), `src/components/Grid.interactions.test.tsx` (test helper fix + 2 new tests)
- **Tests**: 2417 pass (was 2415), lint clean, type-check clean, build clean

### 2026-08-01: B-022 — Formula editing view missing `=` and `!` characters ✅ VERIFIED
- **Symptom**: When editing formulas containing cross-sheet references (e.g., `=SUM(Sheet1!B2:Sheet1!B21)`), the `!` character and leading `=` sign were invisible in the formula bar and cell editor. Only cell references and operators like `+`, `-` were visible.
- **Root cause**: The `FormulaHighlightOverlay` component uses `text-transparent` to hide the real input text and renders colored segments instead. The tokenizer regex (`computeHighlightSegments`) didn't match the `!` separator or cross-sheet range syntax (`Sheet1!A2:Sheet1!B21`). Additionally, the leading `=` was stripped (`value.slice(1)`) and never rendered as a segment. Unmatched characters were simply not rendered — making them invisible.
- **Fix**: (1) Rewrote the tokenizer regex to handle cross-sheet refs (Sheet1!A1), quoted sheet names ('My Sheet'!A1), cross-sheet ranges with prefix on both ends (Sheet1!A1:Sheet1!B5), and added fallback logic to render any unmatched characters as plain text. Cell refs are now matched before plain names to prevent partial matches (A1 → A + 1). (2) Prepend the leading `=` as a plain segment so it remains visible even with `text-transparent` applied.
- **Files**: `src/components/FormulaHighlightOverlay.tsx` (rewrote `computeHighlightSegments`), `src/components/FormulaBar.highlight.test.tsx` (7 new tests), `src/components/FormulaBar.test.tsx` (updated), `src/components/Grid.interactions.test.tsx` (updated)
- **Tests**: 2415 pass (was 2408), lint clean, type-check clean, build clean

### 2026-08-01: B-021 — Cross-sheet reference click-to-navigate ✅ VERIFIED
- **Symptom**: When editing a formula with cross-sheet references (e.g., `=SUM(Sheet1!B2:Sheet1!B21)` in Sheet2), clicking on the reference in the formula bar did nothing — the user had to manually switch to Sheet1 to view/edit the referenced cells.
- **Root cause**: The highlight system (`walkAstForHighlights`) ignored `sheetName` entirely and had no cursor-position tracking for cross-sheet refs.
- **Fix**: (1) Added `pos`/`endPos` tracking to AST nodes in the parser. (2) Created `findCrossSheetRefAtCursor()` to detect when the cursor is on a cross-sheet ref. (3) FormulaBar emits `onCrossSheetRefChange` when cursor lands on a cross-sheet ref. (4) App shows a tip ("Go to sheet" / cancel) and navigates to the source sheet on click, highlighting the target range. (5) Clicking the formula bar again returns to the original sheet.
- **Files**: `src/utils/formulaParser.ts` (pos/endPos tracking), `src/components/FormulaBar.tsx` (findCrossSheetRefAtCursor + cursor detection), `src/App.tsx` (navigation handlers + tip UI), `src/components/FormulaBar.highlight.test.tsx` (7 new tests)
- **Tests**: 2408 pass (was 2401), lint clean, type-check clean, build clean

### 2026-08-01: B-020 — Cross-sheet range highlight shows on wrong sheet ✅ VERIFIED
- **Symptom**: When editing a formula with cross-sheet references (e.g., `=SUM(Sheet1!B2:Sheet1!B21)`), the range highlight overlay showed cells on the CURRENT sheet instead of the source sheet — misleading visual feedback.
- **Root cause**: `walkAstForHighlights` extracted ranges from the AST but ignored the `sheetName` property. All ranges (same-sheet and cross-sheet) were highlighted on the current sheet.
- **Fix**: Added a guard in `walkAstForHighlights`: if a cell/range node has a `sheetName`, it is skipped. Only same-sheet references produce highlights. The `Sheet1!` prefix in the formula bar already communicates which sheet is referenced.
- **Files**: `src/components/FormulaBar.tsx` (`walkAstForHighlights` + exported `extractHighlights` for testing), `src/components/FormulaBar.highlight.test.tsx` (8 new tests)
- **Tests**: 2401 pass (was 2393), lint clean, type-check clean, build clean

### 2026-08-01: B-019 — Cross-sheet ranges produce #VALUE! after paste ✅ VERIFIED
- **Symptom**: After pasting formulas across sheets, range formulas like `=SUM(Sheet1!B2:Sheet1!B21)` show `#VALUE!` instead of the computed sum. The cross-sheet prefix appears correctly on both sides of the range colon, but the formula fails to evaluate.
- **Root cause**: `prefixRefsWithSheet` correctly produces `Sheet1!B2:Sheet1!B21` (prefix on both sides of the range colon). However, the parser's range handling after the COLON token only accepts a `CELL` token — it encounters `SHEET_NAME` and throws `FormulaError`. The catch block in `evaluateWorkbook` converts this to `#VALUE!`. The parser handled `Sheet1!A1:B5` (prefix on left only) but not `Sheet1!A1:Sheet1!B5` (prefix on both sides).
- **Fix**: Added a `parseRangeEnd` helper method to the parser that handles both `CELL` and `SHEET_NAME ! CELL` tokens after the range colon. Both the `SHEET_NAME` and `CELL` range cases now use this helper, correctly propagating the sheet name from the end ref when present.
- **Files**: `src/utils/formulaParser.ts` (`parseRangeEnd` helper + updated range parsing), `src/utils/formulaParser.test.ts` (3 new tests), `src/utils/formulaEngine.test.ts` (1 new test)
- **Tests**: 2393 pass (was 2389), lint clean, type-check clean, build clean

### 2026-08-01: B-018 — Same-sheet paste corrupts existing cross-sheet references ✅ VERIFIED
- **Symptom**: Pasting formulas within the same sheet with an offset corrupted any existing cross-sheet references (e.g., `=Sheet1!A1`). The sheet name "Sheet1" was matched by `adjustFormulaRefs`'s regex as column="Sheet" row="1", producing garbage like `=SHEEU1!B22` instead of `=Sheet1!B22`.
- **Root cause**: `adjustFormulaRefs` uses regex `/([A-Za-z]+)(\d+)/` to find cell references. When a formula already contains a cross-sheet prefix (from a prior cross-sheet paste), the prefix "Sheet1" matches as if it were a column+row reference. The column letters "Sheet" get converted to a huge column number, incremented, and converted back to gibberish.
- **Fix**: Added a protection step at the top of `adjustFormulaRefs`: cross-sheet prefixes (`Sheet1!`, `'My Sheet'!`, etc.) are replaced with placeholders before the offset regex runs, then restored afterward. The cell reference AFTER the prefix is still correctly adjusted (matching Excel behavior where `=Sheet1!A1` copied +1 col becomes `=Sheet1!B1`).
- **Files**: `src/utils/formulaParser.ts` (`adjustFormulaRefs` — added cross-sheet prefix protection), `src/utils/adjustFormulaRefs_fix.test.ts` (12 new tests)
- **Tests**: 2390 pass (was 2378), lint clean, type-check clean, build clean

### 2026-08-01: B-017 — Sort/Undo destroys selection, blocking re-sort ✅ VERIFIED
- **Symptom**: After sorting a selected range and pressing Ctrl+Z, the user could not sort again without first deselecting and reselecting the range. The sort silently no-op'd because `selection` was null after undo.
- **Root cause**: `handleUndo` called `setActiveCell(null)`, which triggered a `useEffect` that cleared `gridSelection` to null. The sort handlers check `if (!selection) return;` and silently bailed. Additionally, `gridSelection` was not stored in undo history.
- **Fix**: (1) Added optional `gridSelection` to `HistoryEntry` in types.ts. (2) Updated `HistoryContext` PUSH reducer to store gridSelection, and undo/redo to return it. (3) Added `gridSelectionRef` in App.tsx to track current selection. (4) Updated all 21 `pushHistory` calls to pass `gridSelectionRef.current`. (5) Updated `handleUndo`/`handleRedo` to restore `gridSelection` AND `activeCell` (from selection anchor) from history.
- **Files**: `src/types.ts` (HistoryEntry.gridSelection), `src/context/HistoryContext.tsx` (store/restore gridSelection), `src/App.tsx` (gridSelectionRef + undo/redo restore selection + activeCell)
- **Tests**: 2304 pass (was 2302), lint clean, type-check clean, build clean

### 2026-08-01: B-016 — Sort/Undo breaks filter state ✅ VERIFIED
- **Symptom**: After sorting data and then undoing, the filter state was not restored. The `filterState` in App.tsx was independent of the undo/redo history, so sort + undo left stale or missing filter state.
- **Root cause**: `pushHistory` did not include `filterState`; `undo`/`redo` only restored the workbook.
- **Fix**: (1) Added optional `filterState` to `HistoryEntry` in types.ts. (2) Updated `HistoryContext` to accept and store `filterState` in history entries, and return it from `undo()`/`redo()`. (3) Added `filterStateRef` in App.tsx to always capture the current filter state. (4) Updated all 21 `pushHistory` calls to pass `filterStateRef.current`. (5) Updated `handleUndo`/`handleRedo` to restore `filterState` from the history entry.
- **Files**: `src/types.ts` (HistoryEntry.filterState), `src/context/HistoryContext.tsx` (undo/redo return filterState), `src/App.tsx` (filterStateRef + all pushHistory calls + undo/redo restore)
- **Tests**: 2302 pass, lint clean, type-check clean, build clean

### 2026-08-01: B-015 — Custom filter display not restored on reopen ✅ VERIFIED
- **Symptom**: After applying a custom filter (contains, equals, greaterThan, etc.) and reopening the filter dropdown, the UI reset to the "Filter by values" tab with empty custom filter fields. The previously applied custom filter was lost.
- **Root cause**: `FilterDropdown` initialized `selectedValues` from `currentFilter` for `includes` conditions but did not initialize `showCustomFilter`, `customFilterType`, or `customFilterValue` for custom conditions.
- **Fix**: Added `getInitialCustomCondition()` helper that extracts the custom condition from `currentFilter`. The `showCustomFilter`, `customFilterType`, and `customFilterValue` states now initialize from the existing filter, and the UI auto-switches to the "Custom filter" tab when a custom condition is present.
- **Files**: `src/components/FilterDropdown.tsx` (initialize custom filter state from currentFilter), `src/components/FilterDropdown.test.tsx` (4 new tests)
- **Tests**: 2302 pass (was 2298), lint clean, type-check clean, build clean

### 2026-08-01: B-005 — storageService.ts Branch Coverage 66% → 100% ✅ VERIFIED
- **Symptom**: `storageService.ts` had ~66% branch coverage (lowest in project). Four branches were untested: non-array saves-list data, localStorage write failure, orphaned save entries, and missing workbook fields.
- **Root cause**: No tests exercised these defensive error paths.
- **Fix**: Added 5 new tests: (1) non-array saves-list returns empty array, (2) `Storage.prototype.setItem` throwing → `saveWorkbook` returns false, (3) orphaned entry (name in list but no data key) is skipped, (4) missing `lastModified` uses `?? 0` fallback, (5) missing `sheets` at top level is skipped gracefully. Added `/* istanbul ignore next */` to the `wb.sheets?.length ?? 0` fallback — unreachable because `isValidWorkbook` guarantees sheets is a non-empty array.
- **Files**: `src/services/storageService.ts` (istanbul ignore on unreachable branch), `src/services/storageService.test.ts` (5 new tests)
- **Tests**: 2298 pass (was 2293)
- **Coverage**: storageService.ts: 100% stmts / 100% branches / 100% funcs / 100% lines

### 2026-07-31: B-012 - False circular reference warning in FormulaWizard ✅ VERIFIED
- **Symptom**: Building `=SUM(D4:D9, F4:F6)` in E4 showed "selected range includes target cell and may cause circular dependency" warning after picking D4:D8 and F4:F6. These ranges don't include E4, so the warning was incorrect.
- **Root cause**: (1) `targetRow` and `targetCol` props were derived from `activeCell`, which changes during POINT mode range selection. (2) `checkCircularReference` used `String.includes()` for range checks, causing false substring matches.
- **Fix**: (1) `targetRow`/`targetCol` now use `wizardTargetCell` state (captured when wizard opens). (2) Rewrote `checkCircularReference` to use proper numeric range containment with `parseCellRef` and `isCellInRange` helpers. (3) "Apply to Cell" button now shows target cell (e.g., "Apply to Cell: E4").
- **Files**: `src/App.tsx` (use wizardTargetCell for targetRow/targetCol), `src/utils/formulaWizardCompiler.ts` (proper range containment check), `src/components/FormulaWizard.tsx` (button shows target cell), `src/utils/formulaWizardCompiler.test.ts` (5 new tests)
- **Tests**: 2292 pass (was 2287)
- **Verification**: New tests verify ranges that don't contain target return false, ranges that do contain target return true.

### 2026-07-31: B-011 - Formula placed in wrong cell after wizard range selection ✅ VERIFIED
- **Symptom**: Building `=SUM(D5:D11, F5:F10)` in E5 resulted in the formula being placed in F10 (the last cell of the selected range) instead of E5. This overwrote the contents of F10 and created a circular reference.
- **Root cause**: `handleWizardApply` used `activeCellRef.current` to determine where to place the formula. During wizard POINT mode, clicking cells to select a range changes the `activeCell`. So when the formula was applied, it was placed in the last cell of the selected range instead of the original target cell.
- **Fix**: (1) Added `wizardTargetCellRef` that captures the target cell when the wizard opens (in `handleFxClick` and `onFunctionSelect`). (2) `handleWizardApply` now uses `wizardTargetCellRef.current` instead of `activeCellRef.current`. (3) Added auto-focus to wizard modal when it opens (so grid keyboard focus moves to wizard).
- **Files**: `src/App.tsx` (capture target cell, use it in apply), `src/components/FormulaWizard.tsx` (auto-focus modal), `src/App.test.tsx` (new test)
- **Tests**: 2287 pass (was 2286)
- **Verification**: New test verifies formula is placed in target cell (A1), not in any range end cell.

### 2026-07-31: B-010 - FormulaWizard variadic parameters (Number3, Number4...) ✅ VERIFIED
- **Symptom**: When a formula with more than 2 arguments was imported (e.g., `=SUM(A1:A3, D3:D7, F1:F5)`), the FormulaWizard only rendered inputs for the first 2 parameters (Number1, Number2). The third parameter (F1:F5) was stored internally but invisible to the user. The compiled formula also dropped the extra parameters, producing `=SUM(A1:A3, D3:D7)` instead of `=SUM(A1:A3, D3:D7, F1:F5)`.
- **Root cause**: Two issues: (1) The compiler (`compileASTNodeToString`) only iterated over `schema.parameters` and ignored extra variadic parameters stored with IDs like `number2_1`, `number2_2`, etc. (2) The wizard component only rendered inputs for `schema.parameters`, not for the extra variadic parameters stored in the active node's `parameterValues`.
- **Fix**: (1) Compiler now detects extra variadic parameters (IDs matching `{lastParamId}_{n}`) and compiles them in order after the schema parameters. (2) Wizard component now computes `allParameters` (schema + extra variadic) and renders them all. (3) Added "+ Add parameter" button for variadic functions to allow adding more parameters interactively. (4) Parameter naming convention: `number2_1` → "Number3", `number2_2` → "Number4", etc.
- **Files**: `src/utils/formulaWizardCompiler.ts` (compile extra variadic params), `src/components/FormulaWizard.tsx` (render extra params, add button), `src/utils/formulaWizardCompiler.test.ts` (new test), `src/components/FormulaWizard.test.tsx` (3 new tests)
- **Tests**: 2286 pass (was 2281)
- **Verification**: New tests verify compiler includes extra params, wizard renders them, Add parameter button works, non-variadic functions don't show the button.

### 2026-07-31: B-009 - Toggle formula view — Ctrl+` overwrites cell content ✅ VERIFIED
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
