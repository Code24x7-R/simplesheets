<!-- 2026-07-28 (Phase 18: Sort & Filter — COMPLETE ✅) -->
- [x] Sort utility: src/utils/sheetSort.ts — sortRange, sortEntireSheet, findUsedRange, formula ref adjustment
- [x] Sort tests: 21 tests covering single/multi-column, header handling, row integrity, formula adjustment, edge cases
- [x] Filter utility: src/utils/sheetFilter.ts — computeHiddenRows, createFilterState, getUniqueValues, row mapping
- [x] Filter conditions: includes, contains, equals, startsWith, endsWith, greaterThan, lessThan, isEmpty, isNotEmpty
- [x] Filter tests: 33 tests covering all condition types, multi-column AND logic, row visibility
- [x] Sort UI: Data menu with Sort A→Z / Sort Z→A, handlers wired in App.tsx with history push
- [x] Filter UI: FilterDropdown component (checkbox list + search + custom filter tabs)
- [x] Filter indicator: Blue triangle on column headers when filter active
- [x] Grid filter mode: visibleRowIndices mapping display rows → actual rows
- [x] Filter handlers: handleToggleFilter, handleApplyFilter, handleClearAllFilters in App.tsx
- [x] Keyboard shortcut: Ctrl+Shift+L toggles filter
- [x] Status bar: "X of Y rows visible" when filter active
- [x] Tests: FilterDropdown.test.tsx (12 tests), Grid filter tests (4 tests), App filter tests (3 tests)
- [x] Lint clean, build verified, 1717 tests pass

<!-- 2026-07-28 (Ctrl+Arrow keyboard navigation) -->
- [x] Ctrl+Arrow keys: jump to edge of data region (like Excel)
- [x] Ctrl+Up/Down: jump to first/last row with data in current column
- [x] Ctrl+Left/Right: jump to first/last column with data in current row
- [x] Falls back to grid edge when no data found in direction
- [x] Helper functions: findEdgeRow, findEdgeCol in Grid.tsx
- [x] Tests: 2 new tests (data jump + edge fallback)
- [x] 1719 tests pass, lint clean, build verified

<!-- 2026-07-28 (Ctrl+Arrow contiguous data navigation) -->
- [x] Modified Ctrl+Arrow to jump to last contiguous cell with value (Excel behavior)
- [x] Ctrl+Right from A1 with A1-C1 filled → jumps to C1 (last contiguous)
- [x] Ctrl+Right from C1 (gap after) → jumps to next data cell (F1)
- [x] If no data in direction → jumps to grid edge
- [x] From empty cell → jumps to next cell with data
- [x] Updated findEdgeRow and findEdgeCol functions
- [x] 1720 tests pass, lint clean, build verified

<!-- 2026-07-28 (Ctrl+Arrow scroll fix) -->
- [x] Fixed grid scroll to show cell after Ctrl+Arrow navigation
- [x] Implemented sliding window viewport behavior:
- [x] Regular arrows: navigate within viewport WITHOUT scrolling
- [x] At edge: viewport scrolls to show next viewable cell
- [x] Ctrl+Arrow: jump to target, position at edge (context in nav direction)
- [x] Uses 'auto' for arrows (minimal scroll), 'start'/'end' for Ctrl+Arrow

<!-- 2026-07-28 (Fill Handle — COMPLETE ✅) -->
- [x] Fill handle: blue square at selection bottom-right corner, appears when 3+ cells selected in a row/column
- [x] Pattern detection: arithmetic, geometric, date, day-of-week, month-of-year, quarter sequences
- [x] Drag to extend: mouse drag computes fill target, generates values, calls onCellsChange
- [x] Files: src/utils/fillSeries.ts (pattern detection + series generation), Grid.tsx (handle + drag logic), App.tsx (handleFillSeries)
- [x] Tests: 1643 total (fillSeries utility tests, Grid handle tests, App integration test)
- [x] All CI checks pass: lint clean, type-check clean, build verified

<!-- 2026-07-28 (Border Styles + Toolbar — COMPLETE ✅) -->
- [x] Border styles: added borderTop/Bottom/Left/Right to CellStyle type (CSS string format)
- [x] Border utilities: makeBorder helper, BORDER_PRESETS, BORDER_COLORS in useCellStyle.ts
- [x] Border setters in useCellStyles: setBorderTop/Bottom/Left/Right/All/Outside, clearBorders, borderColor/borderStyle state
- [x] Grid.tsx renders border styles on cells (follows same pattern as fontWeight/color)
- [x] Toolbar.tsx: beautiful toolbar with border presets dropdown, formatting buttons (B/I/U/S), text/fill/border color pickers, alignment, number format, undo/redo, copy/cut/paste
- [x] Toolbar uses SVG icons for professional appearance
- [x] MenuBar Format menu: added Borders submenu (All, Outside, Top, Bottom, Left, Right, Clear)
- [x] App.tsx: wired Toolbar between FormulaBar and SheetTabs
- [x] CSS: added toolbar, color-picker-popover, border-dropdown, border-icon styles
- [x] Tests: 1604 total (border utilities, border setters, toolbar component, grid border rendering)
- [x] All CI checks pass: lint clean, type-check clean, build verified

<!-- 2026-07-27 (Cell Editing + Autocomplete Integration — COMPLETE ✅) -->
- [x] Autocomplete trigger: replaced broken onChange-based trigger with useEffect that watches value/cursorPos/session.state. handleKeyDown calls e.preventDefault() which suppressed native onChange, so the old trigger never fired.
- [x] findFunctionToken guard: added alpha-char check so autocomplete doesn't open when cursor is after '(', ',', '+', or digits.
- [x] POINT mode close: autocomplete now closes when entering POINT mode (not just SELECT).
- [x] Fixed POINT mode test failures: tests now use shift+arrow for range selection (regular arrow = single-cell pointing). Updated tests to use cell-mode test ID instead of queryByText('POINT') (which failed due to multiple POINT elements).
- [x] Integration: accepting autocomplete inserts SUM( (opening paren only) and enters POINT mode. enterPointMode accepts optional caretPos param to avoid stale sessionRef issue.
- [x] **Critical fix: typing in cell now drives the FSM.** Grid's handleCellEditWithChar now calls onCellEditChange, and App's handleCellEditChange now updates FSM state (startEnter, setBuffer, enterPointMode). Previously the FSM stayed in SELECT state when typing in cells.
- [x] Added prevEditValueRef to detect typed character in POINT mode and exit to EDIT mode.
- [x] Added 9 new tests including cell editing workflow (typing = enters POINT, typing letter exits to EDIT).
- [x] 1523 tests pass, lint clean, type-check clean, build verified.

<!-- 2026-07-27 (Focus & Clipboard Fixes — COMPLETE ✅) -->
- [x] Modal focus restoration: all modals now restore focus to grid on close
- [x] Sheet operation focus restoration: switch/add/rename/copy/delete/new/undo/redo all restore focus
- [x] External clipboard copy: copy/cut now writes TSV to system clipboard
- [x] Fixed last 2 TS errors: FormulaBar test onChange→onRawChange, handleChange union type
- [x] Paste into range bug fixed: iterates over destination range with tiling support
- [x] Formula offset bug fixed: stores sourceRow/sourceCol in clipboard for correct offset
- [x] Formula autocomplete in cell: typing '=' in cell now shows autocomplete dropdown
- [x] 1494 tests, 60 suites, lint clean, **0 TypeScript errors**
<!-- 2026-07-27 (Stage 5: Cross-Sheet References — COMPLETE ✅) -->
- [x] Cross-sheet formula evaluation: evaluateWorkbook now evaluates all sheets with shared cache
- [x] Cross-sheet paste: sourceSheetIndex tracked, prefixRefsWithSheet converts refs
- [x] 1475 tests across 56 suites, lint clean, only 2 pre-existing TS errors
<!-- 2026-07-27 -->
- [ ] Fixed: Plain text starting with = no longer activates POINT mode (looksLikeFormula helper)
- [ ] Fixed: Formula parser handles dots in named references (e.g., Hello.World)
- [ ] Fixed: Selection collapse on Arrow keys without Shift in formula bar
- [ ] 1397 tests pass, lint clean, type-check clean
<!-- 2026-07-27 (continued) -->
- [ ] Fixed: Paste text starting with = as plain text (prefix with single quote)
- [ ] Fixed: Grid displays cells with leading single quote without showing the quote
- [ ] Reverted looksLikeFormula change - content starting with = IS a formula
- [ ] 1387 tests pass, lint clean, type-check clean
