# Copy/Paste Gap Analysis — SimpleSheet vs `excel-copypaste.md`

**Date:** 2026-07-25
**Spec:** `excel-copypaste.md` (Excel/Google Sheets copy/paste behavior)
**Audience:** Development team

---

## Executive Summary

The data-layer copy/paste logic is **solid** — formula relative/absolute adjustment, cut semantics, row/col selection handling, and fill-series all work correctly. However, there are critical gaps in **rendering**, **visual feedback**, and **clipboard lifecycle** that prevent the feature from matching Excel/Sheets behavior.

---

## Current State Assessment

### ✅ What Works (Data Layer)

| Feature | Status | Location |
|---------|--------|----------|
| Relative formula adjustment | ✅ Works | `App.tsx` paste handler → `adjustFormulaRefs()` |
| Absolute reference preservation ($A$1) | ✅ Works | `adjustFormulaRefs()` in `formulaParser.ts` |
| Cut → paste (move) semantics | ✅ Works | `clipboard.ts` + `App.tsx` cut handler |
| Row/col selection copy/paste | ✅ Works | `selectionType` tracked through clipboard |
| Fill handle / drag series | ✅ Works | `generateFillSeries()` in `clipboard.ts` |
| Style data copied in paste | ✅ Works | `style: cell.style` in paste handler |
| Cross-sheet formula links | ❌ **Gap** | Paste only operates on `activeSheetIndex` |

### ❌ Critical Gaps (Rendering & UX)

| # | Gap | Spec Requirement | Impact |
|---|-----|------------------|--------|
| 1 | **Cell styles never rendered** | "cell colors, fonts" | Formatting is invisible even though data model supports it |
| 2 | **No clipboard visual feedback** | "surrounded by a moving dashed border" | User can't see what they copied |
| 3 | **Esc doesn't clear clipboard** | "until you press Esc" | Clipboard persists unexpectedly |
| 4 | **Typing doesn't clear clipboard** | "or start typing in a new cell" | Marching ants don't disappear when editing |
| 5 | **No cross-sheet paste** | "Pasting formulas onto another sheet… maintains live links" | Can't paste across sheets |

---

## Detailed Gap Analysis

### Gap 1: Cell Styles Never Rendered (CRITICAL)

**Spec:** *"Excel copies everything by default, including text, numbers, formulas, cell colors, fonts, borders, and data validation rules."*

**Finding:** The `CellStyle` interface (`types.ts`) defines `fontWeight`, `fontStyle`, `textDecoration`, `color`, `backgroundColor`, `textAlign`, `numberFormat`. The demo workbook (`createDemoWorkbook` in `App.tsx`) populates styles (bold headers, blue backgrounds). The paste handler faithfully copies `style: cell.style`. **But the Grid renderer never reads `cell.style` — it only applies position/size and formula-highlight overlays.**

**Evidence:** In `Grid.tsx` ~line 1091, the `cellStyle` object is built from scratch with only width/height/left. There is no merge of `cell.style` properties. The cell's `<span>` has no inline formatting.

**User-visible consequence:** All cells render as plain black text on white, regardless of stored formatting. The demo's bold/blue headers look identical to data cells. Copied formatting is pasted but remains invisible.

### Gap 2: No Clipboard Visual Feedback (Marching Ants)

**Spec:** *"The copied range stays active on the clipboard (surrounded by a moving dashed border) until you press Esc or start typing in a new cell."*

**Finding:** After Ctrl+C, there is zero visual indication of what was copied. The dashed "marching ants" border — a universal spreadsheet convention — is entirely absent.

**Evidence:** No state tracks the copied range in the UI. No rendering code draws a dashed border around copied cells.

### Gap 3: Esc Doesn't Clear Clipboard

**Spec:** *"…until you press Esc…"*

**Finding:** Esc cancels cell editing but does not clear the module-level `clipboardData` or remove any visual clipboard indicator.

**Evidence:** `handleKeyDown` Esc case only calls `setEditingCell(null)`. No call to `clearClipboard()`.

### Gap 4: Typing Doesn't Clear Clipboard

**Spec:** *"…or start typing in a new cell."*

**Finding:** When a printable key triggers cell edit, the clipboard is not cleared.

**Evidence:** `handleCellEditWithChar` sets editing state but does not call `clearClipboard()`.

### Gap 5: No Cross-Sheet Paste

**Spec:** *"Pasting formulas onto another sheet within the same workbook maintains live mathematical links back to the original source sheet…"*

**Finding:** The paste handler maps over sheets but only modifies `workbook.activeSheetIndex`. Pasting while on a different sheet than the copy source is not supported — formulas won't maintain cross-sheet references.

---

## Recommended Plan

### Phase 1: Render Cell Styles (Foundation)
*Without this, all other formatting work is invisible.*

- [ ] In `Grid.tsx` cell renderer, merge `cell.style` into `cellStyle` (backgroundColor, fontWeight, fontStyle, textDecoration, color, textAlign)
- [ ] Add number formatting support (date/number display)
- [ ] Verify demo workbook headers render bold + blue

### Phase 2: Clipboard Visual Feedback (Marching Ants) ✅ COMPLETE
- [x] Track copied range state (`clipboardRange: { startRow, startCol, endRow, endCol, isCut } | null`)
- [x] Pass from App.tsx to Grid as prop
- [x] Render dashed pulsing border around copied cells in Grid
- [x] Use CSS animation for visual feedback

### Phase 3: Clipboard Lifecycle (Esc / typing clears) ✅ COMPLETE
- [x] Esc key → call `clearClipboard()` + clear copied range state
- [x] Printable char edit → call `clearClipboard()` + clear copied range state
- [x] Any new copy/cut → replace previous clipboard range

### Phase 4: Cross-Sheet Paste
- [ ] Add `sourceSheetIndex` to `ClipboardData`
- [ ] Paste handler adjusts formula sheet references when target ≠ source
- [ ] Support cross-sheet formula syntax (e.g., `Sheet1!A1`)

### Phase 5: Testing & Documentation
- [ ] Unit tests for cell style rendering
- [ ] Integration tests for clipboard lifecycle (Esc clears, typing clears)
- [ ] Visual regression tests for marching ants
- [ ] Update `excel-copypaste.md` with SimpleSheet-specific notes
- [ ] Commit all changes

---

## Out of Scope (from `excel-copypaste.md`)

- **Borders:** Not in `CellStyle` interface; not in project `requirements.md`. Adding full border support is a separate phase.
- **Data validation rules:** Not in `requirements.md` scope.
- **Clipboard retention after typing in SAME cell:** Excel keeps clipboard if you're just navigating; we clear on edit which is correct.
