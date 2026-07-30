# AGENTS.md — SimpleSheet Development Guide

## 1. Project Summary

**SimpleSheet** is a browser-based spreadsheet app (React + TypeScript + Vite + Tailwind). No server, no account — fast, offline-capable, reads/writes Excel files.

**Current metrics:** 1873 tests · 74 suites · all passing · lint clean · build clean  
**Coverage:** 93.94% stmts · 85.03% branches · 95.76% funcs · 95.31% lines

---

## 2. Development Workflow

This project uses an **iterative, test-driven, coverage-focused** workflow — NOT the rigid task-list waterfall described in `tasks.json` (that file is stale; see `PLAN.md` for the real roadmap).

### 2.1 How Work Actually Happens

1. **Pick a phase** from `PLAN.md` (e.g., "Phase 8: Final Verification — close coverage gaps in App.tsx")
2. **Write tests first** — add Jest tests targeting uncovered lines/branches
3. **Implement or fix** — make the code pass the new tests
4. **Verify the full suite** — `npm test && npm run lint && npm run type-check && npm run build`
5. **Update PLAN.md** — mark subtasks complete, update coverage numbers
6. **Commit** — descriptive commit message with test count and coverage delta

### 2.2 Priority Order

**Target: ≥85% branch coverage (currently 86.78%).** Attack files below 85% branches first.

| Priority | File | Branches | Approach |
|----------|------|----------|----------|
| 1 | **formulaEngine.ts** | ~78% | Many uncovered branches: math, trig, string, date, IS functions |
| 2 | **App.tsx** | ~78% | Largest file — many handler branches |
| 3 | **HistoryContext.tsx** | ~75% | Lines 140-148 are defensive (istanbul-ignored) — verify only |

> Files at ≥85% branches: useCellStyles, Grid, useCellEditing, fillSeries, sheetOperations, useFormulaWizard, csvService, clipboardParse, excelExport, sheetSort, numberFormat, formulaParser, formulaValidation, formulaWizardCompiler, formulaWizardImport, FilterDropdown, DropdownMenu, Toolbar, PasteModal, SheetTabs, FreezeContext, PrintSetupContext, MenuBar, ShortcutsModal, and all export buttons.

---

## 3. Validation Methods

| Check | Command | Pass Condition |
|-------|---------|----------------|
| **Unit tests** | `npm test` | All pass, no failures |
| **Lint** | `npm run lint` | 0 warnings, 0 errors |
| **Type-check** | `npm run type-check` | 0 TypeScript errors |
| **Build** | `npm run build` | Clean build, no errors |
| **Coverage** | `npm test` (auto-reports) | Lines ≥ 95%, Branches ≥ 85% |

> **Note:** Cypress E2E was removed in Stage 1 cleanup. The project uses Jest + React Testing Library exclusively.

### 3.1 What to Validate After Each Change

```bash
# Full verification — run after every meaningful change
npm test && npm run lint && npm run type-check && npm run build
```

---

## 4. Code Quality Standards

### 4.1 Test Coverage Targets

- **Lines:** ≥ 95% (currently 95.72%)
- **Branches:** ≥ 85% (currently 86.78%)
- **Functions:** ≥ 95% (currently 95.67%)
- **Statements:** ≥ 93% (currently 94.4%)

> **Note:** The project-wide branch coverage target is 85%. Files below 85% branches are listed in the priority table in §2.2.

### 4.2 Istanbul Ignore Comments

Use `/* istanbul ignore next */` sparingly — only for genuinely unreachable code (defensive fallbacks, `require.main` checks). Don't use it to dodge testing a branch that *can* be tested.

### 4.3 File Organization

```
src/
├── components/     # UI components (Grid, FormulaBar, MenuBar, modals...)
├── context/        # React Context providers (History, Freeze, PrintSetup)
├── hooks/          # Custom hooks (useCellEditing FSM, useAutosave, useReferenceFormat)
├── services/       # Import/Export services (Excel, CSV, JSON, PDF)
├── utils/          # Pure utilities (formulaParser, formulaEngine, clipboard, sheetSort...)
├── types.ts        # Core data model (Workbook, Sheet, Cell, CellStyle)
├── App.tsx         # Root component — orchestrates everything
└── main.tsx        # React entry point
```

---

## 5. Key Architecture Notes

### 5.1 Cell Editing FSM (`useCellEditing.ts`)

The cell editor is a finite state machine with states: **SELECT → ENTER → EDIT → POINT**. Understanding this FSM is essential for any cell-editing work.

- **SELECT** — Navigation, delete, F2 to edit
- **ENTER** — Just started editing (typing replaces content)
- **EDIT** — Mid-edit (caret movement, text selection)
- **POINT** — Selecting a range for a formula reference

### 5.2 Formula Engine

- `formulaParser.ts` — Parses A1-style formulas into AST
- `formulaEngine.ts` — Evaluates AST, manages dependencies, detects circular refs
- 50+ functions implemented (math, logical, text, date, statistical, lookup, financial)
- Cross-sheet references supported (`=Sheet2!A1`)

### 5.3 State Management

- **No Redux/Zustand** — uses React Context + `useReducer` in App.tsx
- `HistoryContext` — Undo/redo stack (50 levels)
- `FreezeContext` — Freeze pane state
- `PrintSetupContext` — Page setup for PDF export

### 5.4 Virtualization

- `@tanstack/react-virtual` for windowed rendering
- Supports 100k+ rows × unlimited columns
- Filter mode uses `visibleRowIndices` mapping (display row → actual row)

---

## 6. Adding New Features

When adding a feature (not just fixing coverage):

1. **Create the utility/hook** in `src/utils/` or `src/hooks/`
2. **Write tests first** — cover all branches, edge cases, error paths
3. **Create the component** in `src/components/` if UI is needed
4. **Wire into App.tsx** — add handlers, state, render the component
5. **Update MenuBar** if the feature needs a menu item
6. **Update README.md** — document the feature
7. **Update PLAN.md** — add a new phase entry
8. **Verify** — full `npm test && npm run lint && npm run type-check && npm run build`

---

## 7. Coverage Improvement Strategy

### 7.1 How to Find Gaps

```bash
# Run tests with coverage report
npm test -- --coverage

# Open the HTML report
start coverage/lcov-report/index.html  # macOS: open coverage/lcov-report/index.html
```

### 7.2 Branch Coverage Tips

- Look for `if` statements without `else` coverage
- Look for ternary operators where only one branch is hit
- Look for `switch` statements where some `case`s are never reached
- Look for early returns that are never triggered
- Look for error-handling paths (`catch` blocks, error callbacks)

### 7.3 Files Below 85% Branch Coverage (attack these first)

| File | Branches | Lines | Priority |
|------|----------|-------|----------|
| formulaEngine.ts | ~78% | ~98% | 🔴 Many testable branches (math, trig, string, date, IS functions) |
| App.tsx | ~78% | ~93% | 🔴 Largest file — many handler branches |
| HistoryContext.tsx | ~75% | 100% | 🟡 Mostly istanbul-ignored defensive code |

> Files **at or above 85%** branches: benchmark, useCellStyles, fillSeries, useCellEditing, sheetOperations, Grid, useFormulaWizard, SearchReplaceModal, csvService, FilterDropdown, clipboardParse, excelExport, sheetSort, numberFormat, formulaParser, formulaValidation, formulaWizardCompiler, formulaWizardImport, DropdownMenu, Toolbar, PasteModal, SheetTabs, FreezeContext, PrintSetupContext, MenuBar, ShortcutsModal, and all export buttons.

---

## 8. Common Pitfalls

1. **Forgetting `measure()` on virtualizer** — mocks in tests need `measure: jest.fn()`
2. **Stale closure in callbacks** — use refs (`selectionRef`, `sessionRef`) for current values
3. **`handleFormulaRawKeyDown` doesn't use the result** — known issue; sync state explicitly
4. **POINT mode state corruption** — arrow keys during navigation must preserve POINT state
5. **`editInputRef` timing** — input ref is null until first render; guard with `if (ref?.current)`
6. **Ignoring `stopPropagation`** — modal inputs must stop propagation to prevent global shortcut firing

---

## 9. Useful References

- `PLAN.md` — Master roadmap with all phases, subtasks, and coverage-by-file table
- `PROGRESS_LOG.md` — Chronological development history
- `SCRATCHPAD.md` — Running checklist of completed items
- `MEMORY.md` — Long-term decisions and lessons learned
- `excel-dataentry.md` — Excel editing behavior specification
- `excel_web_editor_shortcuts-v4.json` — Keyboard shortcut reference
