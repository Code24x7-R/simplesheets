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

Current test suite: **945 tests** across 35 suites with **~93% line coverage**.

---

## Project Structure

```
simplesheets/
├── src/
│   ├── components/      # React components (Grid, Toolbar, SheetTabs, editors…)
│   ├── context/         # React Context providers (History, Freeze, PrintSetup)
│   ├── hooks/           # Custom hooks (useCellEditing FSM, useAutosave)
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
