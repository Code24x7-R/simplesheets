# SimpleSheet

[![CI](https:///github.com/simplesheets/simplesheets/actions/workflows/ci.yml/badge.svg)](./actions/workflows/ci.yml)

A lightweight, browser‑based spreadsheet for small businesses. No server, no account, no bloat — just a fast, offline‑capable grid that reads and writes Excel files.

---

## Features

- 🖊️ **Cell editing** with Excel/Sheets-style interactions (point mode, F4 ref cycling, auto-complete)
- 📊 **Formulas** — 50+ functions (SUM, AVERAGE, IF, date, math, string, logical) + arithmetic
- 📋 **Copy / paste & drag‑fill** series extension
- ↩️ **Undo / redo** — 50 levels
- 📐 **Cell merging** for headers and layouts
- ↔️ **Column & row resizing** + freeze panes
- 📥 **Import** — .xlsx, .csv, .tsv, .json
- 📤 **Export** — .xlsx, .csv, .tsv, .json, .pdf
- 🖨️ **PDF export** with page setup (orientation, margins, scaling)
- 💾 **Auto-save** to localStorage + named save slots
- 📑 **Multi-sheet workbooks** — add, rename, copy, delete sheets with cross-sheet formula references
- ⚡ **Virtualized grid** — smooth scrolling for 100 k+ rows × unlimited columns
- 🎯 **Clean menu-based UI** — File, Edit, View, Insert, Format, Help dropdown menus
- 📌 **Function bar** — one-click access to common functions (SUM, AVERAGE, COUNT, MAX, MIN, IF, etc.)
- 🔢 **R1C1 reference format** — toggle between A1 and R1C1 notation by clicking the cell reference

---

## UI Overview

SimpleSheet uses a clean, menu-based interface:

```
┌──────────────────────────────────────────────────────────────────┐
│  SimpleSheet                                 File  Edit  View  Help│  Menu bar
├──────────────────────────────────────────────────────────────────┤
│  [A1 ▾]  fx  [═══════════════════════════════════════]          │  Formula bar
│          SUM  AVERAGE  COUNT  MAX  MIN  IF  ...                 │  Function bar
├──────────────────────────────────────────────────────────────────┤
│  [Sheet1] [Sheet2] [+]                                         │  Sheet tabs
├──────────────────────────────────────────────────────────────────┤
│  │ A │ B │ C │ D │ E │                                         │  Grid
│  └──────────────────────────────────────────────────────────── │
│  Ready                                          100,000 × 26   │  Status bar
└──────────────────────────────────────────────────────────────────┘
```

### Menu Structure

| Menu | Actions |
|------|---------|
| **File** | New, Save, Open, Import (Excel/CSV/JSON), Export (Excel/CSV/JSON/PDF), Page Setup |
| **Edit** | Undo, Redo, Copy, Cut, Paste, Clear Contents, Delete (Row/Column/Cells) |
| **View** | Freeze Panes, Unfreeze Panes |
| **Insert** | Row Above, Row Below, Column Left, Column Right |
| **Format** | Merge Cells, Unmerge Cells |
| **Help** | Keyboard Shortcuts, About |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+C` | Copy |
| `Ctrl+X` | Cut |
| `Ctrl+V` | Paste |
| `Delete` | Clear cell contents |
| `F2` | Edit cell / Toggle edit mode |
| `F4` | Cycle reference absolute/relative |
| `Enter` | Commit edit |
| `Escape` | Cancel edit |

### Reference Format Toggle

Click the cell reference button (e.g., `A1`) in the formula bar to toggle between **A1** and **R1C1** notation. The preference is saved to localStorage.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Build | Vite 5 |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS (CDN) |
| Virtualization | @tanstack/react-virtual |
| Excel | SheetJS (xlsx) |
| CSV/TSV | PapaParse |
| PDF | html2pdf.js |
| Icons | Lucide React |
| Testing | Jest + Cypress |

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install & Run

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing

```bash
# Unit tests (Jest) with coverage
npm test

# E2E tests (Cypress)
npm run cypress
```

Current test suite: **1002 tests** across 39 suites with **~93% line coverage**.

---

## Project Structure

```
simplesheets/
├── src/
│   ├── components/
│   │   ├── DropdownMenu.tsx    # Reusable dropdown menu component
│   │   ├── MenuBar.tsx          # Top-level menu bar
│   │   ├── FormulaBar.tsx       # Formula bar with function bar
│   │   ├── Grid.tsx             # Virtualized grid
│   │   ├── SheetTabs.tsx        # Multi-sheet tab strip
│   │   ├── ImportExportBridge.tsx # Menu-to-import/export bridge
│   │   └── ...                  # Import/Export/Print buttons
│   ├── context/         # React Context providers (History, Freeze, PrintSetup)
│   ├── hooks/           # Custom hooks (useCellEditing FSM, useAutosave, useReferenceFormat)
│   ├── services/        # Import/Export services (Excel, CSV, JSON, PDF)
│   ├── utils/           # Formula parser, evaluator, clipboard, benchmark
│   ├── types.ts         # Core data model (Workbook, Sheet, Cell…)
│   ├── App.tsx          # Root application component
│   └── main.tsx         # React entry point
├── docs/                # Requirements, feasibility, architecture
├── cypress/e2e/         # End‑to‑end tests
└── .github/workflows/   # CI configuration
```

---

## Deployment

The production build (`dist/`) is a static site that can be hosted anywhere:

- **Netlify:** Connect the repo → done. See `netlify.toml`.
- **Vercel:** `vercel --prod`.
- **GitHub Pages:** Push `dist/` to `gh-pages` branch.
- **Any static host:** Upload the `dist/` folder.

---

## License

MIT
