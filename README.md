# SimpleSheet

A lightweight, browser-based spreadsheet — fully client-side, reads and writes Excel files.

**Live demo:** [https://simplesheets.mouseclick.au](https://simplesheets.mouseclick.au)

**For end-user documentation, see [MANUAL.md](./MANUAL.md).**

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Build | Vite 5 |
| UI | React 18 + TypeScript |
| Icons | lucide-react |
| Styling | Tailwind CSS (CDN) |
| Virtualization | `@tanstack/react-virtual` |
| Excel | SheetJS (`xlsx`) |
| CSV/TSV | PapaParse |
| PDF | html2pdf.js |
| Testing | Jest + React Testing Library |
| Linting | ESLint + react-hooks plugin |

---

## Architecture

SimpleSheet is a client-side SPA with no backend. State lives in React Context + `useReducer`, with a formula engine operating on sparse cell maps.

```
┌─────────────────────────────────────────────────────────────────┐
│                          App.tsx                                │
│   (useReducer for UI state, orchestrates all handlers)          │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│ HistoryCtx   │  FreezeCtx   │ PrintCtx     │  Local State       │
│ (undo/redo)  │ (frozen rows │ (PDF export  │  (selection,       │
│  useReducer  │  /cols)      │  config)     │   modal flags,     │
│  50 levels)  │              │              │   editing FSM)     │
├──────────────┴──────────────┴──────────────┴────────────────────┤
│                   Component Tree                                 │
│  MenuBar → Toolbar → FormulaBar → Grid (virtualized)            │
│                ↓                                                │
│  SheetTabs + Modals (Wizard, Charts, Find/Replace, etc.)       │
├─────────────────────────────────────────────────────────────────┤
│                    Formula Pipeline                              │
│  formulaParser.ts → AST → formulaEngine.ts → computed values   │
│       ↑                          ↓                              │
│  formulaAutocomplete.ts    evaluateWorkbook (multi-sheet)       │
│  formulaWizardSchema.ts    formulaWizardCompiler.ts             │
├─────────────────────────────────────────────────────────────────┤
│                   Service Layer                                  │
│  excelImport/Export │ csvService │ jsonService │ pdfExport      │
│  storageService (localStorage auto-save)                        │
└─────────────────────────────────────────────────────────────────┘
```

### State Management

No global store library (no Redux/Zustand). State is split across:

1. **React Context providers** — `HistoryContext`, `FreezeContext`, `PrintSetupContext`
2. **`useReducer` in `App.tsx`** — UI state (selection, modal flags, chart settings, filter state)
3. **Custom hooks** — encapsulate behavior (editing FSM, autosave, cell styles, reference format)

### Data Model

Sparse cell storage for performance. Cells only exist in the map if they contain data:

```ts
// Key format: "row:col" (0-based), e.g. "0:0" → A1
Sheet.cells: Record<string, Cell>

interface Cell {
  rawValue: string;             // user input ("=SUM(A1:A10)" or "42")
  computedValue?: string|number|boolean|null;  // formula result
  style?: CellStyle;            // optional formatting
}

interface Workbook {
  sheets: Sheet[];              // ordered tabs
  activeSheetIndex: number;
  lastModified: number;
}
```

### Formula Pipeline

```
Source text  →  formulaParser.ts (tokenizer + Pratt parser)  →  AST
AST          →  formulaEngine.ts (evaluator with dep graph)   →  Value
                                                    ↑
                              evaluateWorkbook (multi-sheet cache)
```

- **`formulaParser.ts`** — Recursive descent parser producing AST nodes for refs, ranges, functions, operators
- **`formulaEngine.ts`** — Tree-walking evaluator with 50+ built-in functions, cross-sheet dependency resolution
- **`formulaWizardCompiler.ts`** — Compiles wizard parameter state into formula strings
- **`formulaWizardSchema.ts`** — Function signatures and parameter metadata for the wizard UI
- **`formulaAutocomplete.ts`** — Fuzzy function search for the formula bar dropdown

### Cell Editing FSM

`useCellEditing.ts` implements a formal state machine:

```
SELECT → ENTER → EDIT → POINT
           ↑        │
           └────────┘ (Escape returns to previous state)
```

| State | Trigger | Behavior |
|-------|---------|----------|
| SELECT | Default | Cell highlighted, no editing |
| ENTER | Printable key / F2 | New value replaces content |
| EDIT | F2 / click formula bar | Modify existing content in-place |
| POINT | `=` + cell selection | Visual formula building with colored range highlights |

### Build Defines

Injected at compile time via `vite.config.ts`:

| Define | Source | Fallback |
|--------|--------|----------|
| `__BUILD_TIMESTAMP__` | `BUILD_TIMESTAMP` env var or `new Date().toISOString()` | Current time |
| `__GIT_COMMIT_HASH__` | `GITHUB_SHA` env var or `git rev-parse --short HEAD` | `"unknown"` |

Declared in `src/vite-env.d.ts`. Used by `AboutModal` for build info display.

### Code Chunking

Production build splits vendor bundles:

| Chunk | Contents |
|-------|----------|
| `vendor` | react, react-dom |
| `xlsx` | SheetJS (large, lazy-loadable) |
| `html2pdf.js` | PDF export engine |

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install & Run

```bash
npm install
npm run dev          # Vite dev server on port 3000
npm run build        # tsc + vite build → dist/
npm run preview      # Preview production build locally
```

### Quality Gates

```bash
npm test             # Jest with coverage
npm run lint         # ESLint (max-warnings 0)
npm run type-check   # tsc --noEmit
npm run build        # Full production build
```

Current targets: **≥95% line coverage**, **≥85% branch coverage**, **0 lint errors**, **0 type errors**.

---

## Project Structure

```
simplesheets/
├── src/
│   ├── App.tsx                    # Root component, useReducer orchestration
│   ├── main.tsx                   # React entry point
│   ├── types.ts                   # Core data model (Workbook, Sheet, Cell, Selection)
│   ├── vite-env.d.ts              # Build define declarations
│   │
│   ├── components/
│   │   ├── Grid.tsx               # Virtualized grid (@tanstack/react-virtual)
│   │   ├── FormulaBar.tsx         # Formula input + autocomplete
│   │   ├── FormulaWizard.tsx      # Step-by-step formula builder
│   │   ├── FunctionPicker.tsx     # Searchable function list for wizard
│   │   ├── MenuBar.tsx            # Top-level dropdown menus
│   │   ├── Toolbar.tsx            # Formatting toolbar
│   │   ├── SheetTabs.tsx          # Multi-sheet tab strip
│   │   ├── FormulaHighlightOverlay.tsx  # Color-coded ref highlights
│   │   ├── DropdownMenu.tsx       # Reusable dropdown component
│   │   ├── ResizeHandle.tsx       # Column/row drag resize (mouse + touch)
│   │   ├── ChartDialog.tsx        # Chart creation/config dialog
│   │   ├── charts/
│   │   │   ├── ChartRenderer.tsx  # Pure SVG chart rendering (6 types)
│   │   │   └── ChartOverlay.tsx   # Floating chart display with drag
│   │   ├── ImportExportBridge.tsx # Menu-to-import/export bridge
│   │   ├── ImportCsvButton.tsx / ImportExcelButton.tsx / ImportJsonButton.tsx
│   │   ├── ExportCsvButton.tsx / ExportExcelButton.tsx / ExportJsonButton.tsx / ExportPdfButton.tsx
│   │   ├── PasteModal.tsx / PasteSpecialModal.tsx
│   │   ├── SearchReplaceModal.tsx / ColumnRowSizeModal.tsx
│   │   ├── PrintSetupModal.tsx / FilenameModal.tsx
│   │   ├── ShortcutsModal.tsx / AboutModal.tsx / FilterDropdown.tsx
│   │   └── *.test.tsx              # Component tests (co-located)
│   │
│   ├── context/
│   │   ├── HistoryContext.tsx     # Undo/redo via useReducer (50 levels)
│   │   ├── FreezeContext.tsx      # Frozen panes state
│   │   └── PrintSetupContext.tsx  # PDF export config
│   │
│   ├── hooks/
│   │   ├── useCellEditing.ts      # Editing FSM (SELECT→ENTER→EDIT→POINT)
│   │   ├── useCellStyles.ts       # Cell formatting state
│   │   ├── useCellStyle.ts        # Single cell style helpers
│   │   ├── useAutosave.ts         # Debounced localStorage persistence
│   │   ├── useReferenceFormat.ts  # A1/R1C1 toggle
│   │   ├── useFormulaWizard.ts    # Wizard state management
│   │   ├── useChartSettings.ts    # Chart config persistence
│   │   └── *.test.ts              # Hook tests (co-located)
│   │
│   ├── services/
│   │   ├── excelImport.ts / excelExport.ts  # SheetJS read/write
│   │   ├── csvService.ts          # PapaParse import/export
│   │   ├── jsonService.ts         # JSON workbook serialization
│   │   ├── pdfExport.ts           # html2pdf.js wrapper
│   │   └── storageService.ts      # localStorage auto-save/load
│   │
│   └── utils/
│       ├── formulaParser.ts       # Tokenizer + Pratt parser → AST
│       ├── formulaEngine.ts       # AST evaluator, 50+ functions, dep graph
│       ├── formulaAutocomplete.ts # Function search/fuzzy match
│       ├── formulaValidation.ts   # Formula syntax validation
│       ├── formulaWizardSchema.ts # Function signatures for wizard UI
│       ├── formulaWizardCompiler.ts # Wizard state → formula string
│       ├── formulaWizardImport.ts # Parse existing formula into wizard state
│       ├── clipboard.ts           # Internal clipboard (copy/cut/paste)
│       ├── clipboardParse.ts      # Parse system clipboard (plain text + HTML)
│       ├── clipboard.styles.test.ts
│       ├── pasteSpecial.ts        # Paste modes (values, formulas, formatting, transpose)
│       ├── pasteWidths.ts         # Column width paste
│       ├── fillRange.ts / fillSeries.ts  # Drag-fill with pattern detection
│       ├── rangeMove.ts           # Range shift operations
│       ├── numberFormat.ts        # Excel-compatible number formatting
│       ├── chartData.ts           # Data extraction for charts
│       ├── sheetOperations.ts     # Insert/delete rows/columns
│       ├── sheetSort.ts           # Multi-column sort with ref adjustment
│       ├── sheetFilter.ts         # Column filtering (checkbox + custom)
│       ├── sheetSearch.ts         # Find implementation
│       ├── highlightColors.ts     # Color assignment for formula refs
│       ├── benchmark.ts           # Performance measurement utilities
│       └── *.test.ts              # Utility tests (co-located)
│
├── docs/
│   ├── PLAN.md            # Development roadmap (30+ phases)
│   ├── BUGFIX.md          # Bug tracker
│   ├── PROGRESS_LOG.md    # Change log
│   ├── requirements.md    # Functional requirements
│   └── feasibility.md     # Technical feasibility analysis
│
├── scripts/
│   ├── prepack-offline.mjs # Prepare package.json for offline pack
│   └── postpack-offline.mjs # Restore package.json after pack
│
├── .github/workflows/     # CI configuration
├── coverage/              # Jest coverage output
├── tasks.json             # Waterfall task breakdown
├── vite.config.ts         # Build config + define injection
├── jest.config.cjs        # Test configuration
├── tsconfig.json          # TypeScript config
└── tailwind.config.js     # Tailwind CSS config
```

---

## Testing

Tests are co-located with source files (`*.test.ts` / `*.test.tsx`). Uses Jest + React Testing Library with jsdom environment.

```bash
npm test                          # All tests + coverage
npx jest --testPathPattern=formulaEngine   # Single file
npx jest --watch                  # Watch mode
```

Key testing patterns:
- **Virtualizer mocks** — always include `measure: jest.fn()` when mocking `@tanstack/react-virtual`
- **Ref-based state** — handlers use refs (`selectionRef`, `sessionRef`) to avoid stale closures
- **Modal inputs** — call `e.stopPropagation()` on inputs inside modals to prevent global shortcuts
- **Edit input timing** — `editInputRef.current` is `null` on first render; null-check before invoking methods

---

## Offline Release

Produces a self-contained `.tgz` with all dependencies bundled — no internet required:

```bash
npm run release:offline
```

This runs: `npm run build` → `prepack-offline` (prepare package.json, set `bundledDependencies`) → `npm pack` → `postpack` (restore original package.json).

| Detail | Value |
|--------|-------|
| Output | `simplesheets-0.1.0.tgz` |
| Compressed | ~18 MB |
| Unpacked | ~105 MB |

Install: `npm install ./simplesheets-0.1.0.tgz` or `npm install -g ./simplesheets-0.1.0.tgz`

The tarball contains the full `dist/` — a static site servable by any HTTP server.

---

## Desktop Installer (Tauri)

Package as a native Windows app with MSI installer:

```bash
npm install -D @tauri-apps/cli @tauri-apps/api
npx tauri init
npx tauri build
```

Output: `src-tauri/target/release/bundle/msi/`, `nsis/`, and standalone `.exe`. MSI is ~5–8 MB (uses system WebView2).

SimpleSheet needs no Tauri capabilities — file I/O uses `<input type="file">` + Blob downloads, clipboard uses `navigator.clipptr`, no native dialogs.

---

## Deployment

`dist/` is a static site — deployable to:
- **GitHub Pages** — push `dist/` to `gh-pages` (set `GITHUB_PAGES=true` for subpath base)
- **Netlify/Vercel** — connect repo
- **Any static host** — upload `dist/`
- **Desktop** — see Tauri section above

---

## Contributing

- Read [AGENTS.md](./AGENTS.md) for AI-assisted development guidelines
- Follow the Feature Track or Bugfix Track workflow in `AGENTS.md`
- Run full verification before submitting: `npm test && npm run lint && npm run type-check && npm run build`

---

## License

MIT — see [LICENSE](./LICENSE).
