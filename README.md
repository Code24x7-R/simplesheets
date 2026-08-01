# SimpleSheet

A lightweight, browser‑based spreadsheet no bloat — just a fast, offline‑capable grid that reads and writes Excel files.

**🌐 Live demo:** [https://code24x7-r.github.io/simplesheets/](https://code24x7-r.github.io/simplesheets/)

---

## Features

- 🖊️ **Cell editing** with Excel/Sheets-style interactions (point mode, F4 ref cycling, auto-complete)
- 📊 **Formulas** — 50+ functions (SUM, AVERAGE, IF, date, math, string, logical) + arithmetic
- 📋 **Copy / paste & drag‑fill** series extension
- ↩️ **Undo / redo** — 50 levels
- ↔️ **Column & row resizing** + freeze panes
- 📥 **Import** — .xlsx, .csv, .tsv, .json
- 📤 **Export** — .xlsx, .csv, .tsv, .json, .pdf
- 🖨️ **PDF export** with page setup (orientation, margins, scaling)
- 💾 **Auto-save** to localStorage + named save slots
- 📑 **Multi-sheet workbooks** — add, rename, copy, delete sheets with cross-sheet formula references
- ⚡ **Virtualized grid** — smooth scrolling for 100 k+ rows × unlimited columns
- 🎯 **Clean menu-based UI** — File, Edit, View, Insert, Format, Help dropdown menus
- 📌 **Tool bar** — one-click access to common functions
- 🔢 **R1C1 reference format** — toggle between A1 and R1C1 notation by clicking the cell reference
- 🧙 **Formula Wizard** — interactive step-by-step formula builder with nested function support, breadcrumb navigation, and live preview
- 🔍 **Find & Replace** — search across cells with options for case sensitivity, exact match, formulas, and multi-sheet scope
- 📐 **Smart cell alignment** — numbers, dates, and times auto-right-aligned; text stays left-aligned
- 💰 **Accounting format** — left-aligned `$` symbol, right-aligned numbers, dash for zero values, decimal points align perfectly

---

## UI Overview

SimpleSheet uses a clean, menu-based interface:

```
┌──────────────────────────────────────────────────────────────────┐
│  SimpleSheet                              File  Edit  View  Help │  Menu bar
├──────────────────────────────────────────────────────────────────┤
│  [A1 ▾]  fx  [═══════════════════════════════════════]           │  Formula bar
│          SUM  AVERAGE  COUNT  MAX  MIN  IF  ...                  │  Function bar
├──────────────────────────────────────────────────────────────────┤
│  [Sheet1] [Sheet2] [+]                                           │  Sheet tabs
├──────────────────────────────────────────────────────────────────┤
│  │ A │ B │ C │ D │ E │                                           │  Grid
│  └────────────────────────────────────────────────────────────   │
│  Ready                                          100,000 × 26     │  Status bar
└──────────────────────────────────────────────────────────────────┘
```

### Menu Structure

| Menu | Actions |
|------|---------|
| **File** | New, Save, Open, Import (Excel/CSV/JSON), Export (Excel/CSV/JSON/PDF), Page Setup |
| **Edit** | Undo, Redo, Copy, Cut, Paste, Clear Contents, Find & Replace, Delete (Row/Column/Cells) |
| **View** | Freeze Panes, Unfreeze Panes |
| **Insert** | Row Above, Row Below, Column Left, Column Right |
| **Format** | Bold, Italic, Underline, Wrap Text, Alignment, Colors, Number Format, Clear Styles |
| **Help** | Keyboard Shortcuts, About |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+C` | Copy |
| `Ctrl+X` | Cut |
| `Ctrl+V` | Paste |
| `Ctrl+H` | Find & Replace |
| `Delete` | Clear cell contents |
| `F2` | Edit cell / Toggle edit mode |
| `F4` | Cycle reference absolute/relative |
| `Enter` | Commit edit |
| `Escape` | Cancel edit |

### Number Formatting

SimpleSheet supports Excel-style number formatting, accessible from the toolbar:

| Button | Format | Example |
|--------|--------|---------|
| Gen | General (no formatting) | `42.5` |
| 123 | Number (2 decimals) | `42.50` |
| $ | Currency | `$42.50` |
| Acct | Accounting | `$         42.50` (left-aligned $, right-aligned number, dash for zero) |
| % | Percentage | `42.50%` |

**Smart alignment**: Numbers, dates, and times are automatically right-aligned in cells. Text remains left-aligned. The Accounting format pins the `$` to the far-left edge and the number to the far-right edge, with decimal points aligning perfectly down the column. Zero values display as `-` for better readability.

Supported format patterns include:
- **Number**: `0`, `0.00`, `#,##0`, `#,##0.00`
- **Currency**: `$#,##0.00`
- **Accounting**: `_($* #,##0.00_);...` (Excel-compatible)
- **Percentage**: `0%`, `0.00%`
- **Date**: `mm/dd/yyyy`, `mm/dd/yy`, `yyyy-mm-dd`, `dd-mmm-yy`, `mmmm d, yyyy`
- **Time**: `hh:mm`, `hh:mm:ss`, `h:mm AM/PM`
- **Date+Time**: `mm/dd/yyyy hh:mm` (combined)
- **Text**: `@` (preserves literal string, e.g., leading zeros in ZIP codes)
- **Scientific**: `0.00E+00`

**Date & Time serial numbers**: Excel stores dates as serial numbers (day 1 = Jan 1, 1900) and times as fractional days (0.5 = noon). SimpleSheet decodes these automatically when a date/time format is applied.

**Text format (`@`)**: Forces numeric entries to be treated as literal text, preserving leading zeros (ZIP codes, ID numbers, credit card numbers) that would otherwise be stripped.

### Reference Format Toggle

Click the cell reference button (e.g., `A1`) in the formula bar to toggle between **A1** and **R1C1** notation. The preference is saved to localStorage.

### Formula Wizard

Open the interactive Formula Wizard using any of these methods:

- **fx button** — Click the **fx** button in the formula bar
- **Menu** — Insert → Formula Wizard…
- **Keyboard shortcut** — `Ctrl+Shift+F`

#### Smart Open Behavior

The wizard intelligently adapts based on the current cell's contents:

- **Cell has a formula** (e.g., `=SUM(B4:D4)`) — Wizard opens with all parameters pre-populated from the formula. Nested functions are shown as clickable elements you can drill into.
- **Cell is empty** (or has a non-formula like `=A1+B1`) — A **Function Picker** appears with a searchable list of all 50+ functions. Pick one to start building.

#### Import Example

Opening the wizard on a cell containing `=IF(A1>0, SUM(B4:D4), 0)`:

1. Wizard opens at root level showing IF parameters:
   - `Condition`: `A1>0`
   - `True_val`: `SUM(B4:D4)` (clickable — drills into nested SUM)
   - `False_val`: `0`
2. Click `SUM(B4:D4)` to navigate into the nested function:
   - Breadcrumb shows: `f(x) IF > f(x) SUM`
   - `Number1`: `B4:D4`
3. Result preview updates in real-time as you edit parameters.
4. Click **Apply to Cell** to commit the formula back to the cell.

The wizard guides you through building complex formulas step-by-step:

- **Breadcrumb navigation** — Track your position in nested functions (e.g., `f(x) ROUND > f(x) SUMIF`)
- **Parameter inputs** — Each parameter has a labeled input with type validation
- **Range picker** — Click the 🗗 icon to select ranges directly from the grid
- **Nested functions** — Add functions within functions (up to 8 levels deep)
- **Live preview** — See the compiled formula and result in real-time
- **Type validation** — Inline warnings for parameter type mismatches
- **Circular reference detection** — Warns when formula references its own cell

#### Supported Functions

The wizard supports 50+ functions organized by category:

| Category | Functions |
|----------|----------|
| Math | SUM, AVERAGE, COUNT, COUNTA, MIN, MAX, PRODUCT, ABS, ROUND, SQRT, POWER, MOD, INT |
| Conditional | SUMIF, COUNTIF, AVERAGEIF, SUMIFS, COUNTIFS |
| Logical | IF, AND, OR, NOT, IFERROR |
| Text | CONCAT, CONCATENATE, LEFT, RIGHT, MID, LEN, LOWER, UPPER, TRIM, TEXT, VALUE |
| Statistical | MEDIAN, MODE, STDEV, VAR, LARGE, SMALL |
| Date | NOW, TODAY, YEAR, MONTH, DAY, DATE, WEEKDAY |
| Info | ROW, COLUMN, ROWS, COLUMNS |
| Lookup | VLOOKUP, HLOOKUP, INDEX, MATCH, OFFSET |

#### Wizard State Machine

```
INACTIVE → WIZARD_ROOT → NESTED_STEP → POINT_SELECTION
              ↑               │
              └──── Back ─────┘
```

1. **INACTIVE** — Spreadsheet in normal SELECT/EDIT mode
2. **WIZARD_ROOT** — Top-level function parameters
3. **NESTED_STEP** — Inside a nested function parameter
4. **POINT_SELECTION** — Selecting a range on the grid for a RANGE parameter

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
| Testing | Jest |

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
```

Current test suite: **2076 tests** across 80 suites with **~96% line coverage**.

---

## Offline Release

SimpleSheet can be packaged into a self-contained `.tgz` that bundles the production build **and** all dependencies — no internet required to install or run it.

### Create the package

```bash
npm run release:offline
```

This runs three steps in sequence:

1. **`npm run build`** — TypeScript compiles and Vite produces the static `dist/` bundle.
2. **`prepack-offline`** — temporarily prepares `package.json` for packing (flips `private`, sets `bundledDependencies`, includes `node_modules`).
3. **`npm pack`** — produces `simplesheets-<version>.tgz` in the project root.

After packing, a `postpack` hook automatically restores `package.json` to its original state, so your working tree stays clean.

### Output

| Detail | Value |
|--------|-------|
| File | `simplesheets-0.1.0.tgz` |
| Compressed size | ~18 MB |
| Unpacked size | ~105 MB |
| Total files | ~8,800 (includes bundled deps) |

### Install offline

```bash
# Install from the tarball (no registry access needed)
npm install ./simplesheets-0.1.0.tgz

# Or install globally to run from anywhere
npm install -g ./simplesheets-0.1.0.tgz
```

### Serve the static build

The tarball also contains the full `dist/` folder — a static site you can host anywhere:

```bash
# Unpack the tarball
tar -xzf simplesheets-0.1.0.tgz

# Serve with any static file server
npx serve package/dist
# or
cd package/dist && python -m http.server 8080
```

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

## Desktop Installer (Tauri)

SimpleSheet can be packaged as a native Windows desktop app with an installer using [Tauri](https://v2.tauri.app/). Tauri produces a lightweight `.msi` installer — no Electron bloat, the app uses the system webview.

### Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| Rust | Tauri's backend + toolchain | [rustup.rs](https://rustup.rs/) (install `stable-msvc`) |
| Windows SDK | MSVC build tools | Included with Visual Studio Build Tools |
| Node.js ≥ 18 | Frontend build | Already required by SimpleSheet |

> **Note:** The Rust + MSVC toolchain is ~4 GB. The initial Tauri build will take several minutes; subsequent builds are incremental and much faster.

### Add Tauri to the project

```bash
# Install the Tauri CLI and dependencies
npm install -D @tauri-apps/cli@latest
npm install @tauri-apps/api@latest

# Initialize Tauri (creates src-tauri/ with default config)
npx tauri init \
  --app-name simplesheets \
  --dev-url http://localhost:5173 \
  --dist-dir ../dist \
  --before-dev-command "npm run dev" \
  --before-build-command "npm run build"
```

After init, update `src-tauri/tauri.conf.json` to match the project:

```json
{
  "productName": "SimpleSheet",
  "version": "0.1.0",
  "identifier": "com.simplesheets.app",
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "SimpleSheet",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": [],
    "externalBin": [],
    "category": "Productivity",
    "shortDescription": "Lightweight spreadsheet for small businesses",
    "longDescription": "A fast, offline-capable spreadsheet that reads and writes Excel files. No server, no account — just your data."
  }
}
```

### Generate app icons

Tauri requires icons in multiple formats. Place them in `src-tauri/icons/`:

```bash
# Using the Tauri CLI (recommended)
npx tauri icon path/to/source-image.png

# Or manually create the icons/ directory with:
#   32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico
```

### Build the Windows installer

```bash
# Build the MSI installer (production)
npx tauri build
```

Output:

| Artifact | Path | Notes |
|----------|------|-------|
| MSI installer | `src-tauri/target/release/bundle/msi/` | Double-click to install per-user |
| NSIS installer | `src-tauri/target/release/bundle/nsis/` | Classic installer with wizard |
| Portable exe | `src-tauri/target/release/simplesheets.exe` | Standalone executable |

The MSI is ~5–8 MB (vs ~150+ MB for Electron) because it uses the system WebView2.

### Development with Tauri

```bash
# Run the app natively with hot reload
npm run tauri dev
```

This starts the Vite dev server, then opens a native window pointing at it. All keyboard shortcuts, menus, and grid interactions work identically to the browser version.

### CI/CD (GitHub Actions)

Add a workflow to build and publish the Windows installer automatically:

```yaml
# .github/workflows/tauri-release.yml
name: Release Desktop App
on:
  push:
    tags: ['v*']

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          toolchain: stable-msvc
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: "SimpleSheet v__VERSION__"
          releaseBody: "Windows desktop installer for SimpleSheet."
          releaseDraft: true
          prerelease: false
```

Pushing a `v*` tag builds the MSI and creates a GitHub Release with the installer attached.

### Permissions

SimpleSheet needs no special Tauri capabilities — it's a pure frontend app. No filesystem, clipboard, or dialog permissions are required because:

- File I/O uses the browser's native `<input type="file">` and Blob downloads
- Clipboard uses the standard `navigator.clipboard` API
- No native dialogs needed

The default `tauri.conf.json` (with no capability permissions) is sufficient.

---

## Deployment

The production build (`dist/`) is a static site that can be hosted anywhere:

- **Netlify:** Connect the repo → done. See `netlify.toml`.
- **Vercel:** `vercel --prod`.
- **GitHub Pages:** Push `dist/` to `gh-pages` branch.
- **Any static host:** Upload the `dist/` folder.
- **Desktop:** See [Desktop Installer (Tauri)](#desktop-installer-tauri) above.

---

## License

MIT
