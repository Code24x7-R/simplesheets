# SimpleSheet User Manual

> **Version:** 0.1.0 — Last updated: August 2026

## Table of Contents

1. [Getting Started](#getting-started)
2. [UI Layout](#ui-layout)
3. [Interacting with Cells](#interacting-with-cells)
4. [Cell Reference Types](#cell-reference-types)
5. [In-Cell Editing](#in-cell-editing)
6. [The Formula Bar](#the-formula-bar)
7. [Constructing Formulas](#constructing-formulas)
8. [Working with Ranges](#working-with-ranges)
9. [Keyboard Shortcuts](#keyboard-shortcuts)
10. [Charts](#charts)
11. [Sorting & Filtering](#sorting--filtering)
12. [Multi-Sheet Workbooks](#multi-sheet-workbooks)
13. [Find & Replace](#find--replace)
14. [Formatting](#formatting)
15. [Import & Export](#import--export)
16. [Freeze Panes](#freeze-panes)
17. [Column & Row Sizing](#column--row-sizing)
18. [Paste Special](#paste-special)
19. [Fill Handle](#fill-handle)
20. [Formula Wizard](#formula-wizard)
21. [Formula Autocomplete](#formula-autocomplete)
22. [Planned Features](#planned-features)

---

## Getting Started

SimpleSheet is a browser-based spreadsheet application that works entirely in your browser — no server, no account, no installation required. It reads and writes Excel files (.xlsx), CSV, JSON, and exports to PDF.

### Quick Start

1. **Open** SimpleSheet in any modern browser (Chrome, Firefox, Edge, Safari).
2. **Start typing** — click a cell and enter a value or formula.
3. **Begin formulas with `=`** — e.g., `=SUM(A1:A10)`.
4. **Save** your work via File → Save (downloads a JSON file) or Export → Excel (.xlsx).

### Load Demo Data

To explore features with sample data: **File → Load Demo**. This populates the sheet with numbers, text, and formulas you can experiment with.

---

## UI Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  SimpleSheet                          File  Edit  View  Insert   │  ← Menu bar
│                                           Format  Data  Help     │
├──────────────────────────────────────────────────────────────────┤
│  [A1 ▾]  fx  [═══════════════════════════════════════]  [≡]      │  ← Formula bar
├──────────────────────────────────────────────────────────────────┤
│  B  I  U  S  │ ⟫ ┃ ↔ │  ▾ ▤ ▦ │  General ▾ │ ↩ ↪  │  ⊞  ⊡    │  ← Toolbar
├──────────────────────────────────────────────────────────────────┤
│  [Sheet1] [Sheet2] [+]                                           │  ← Sheet tabs
├────┬─────┬─────┬─────┬─────┬─────┬───────────────────────────────┤
│    │  A  │  B  │  C  │  D  │  E  │                               │
├────┼─────┼─────┼─────┼─────┼─────┤                               │
│  1 │     │     │     │     │     │                               │  ← Grid
│  2 │     │     │     │     │     │                               │
│  3 │     │     │     │     │     │                               │
├────┴─────┴─────┴─────┴─────┴─────┴───────────────────────────────┤
│  Ready                                        100,000 × 26       │  ← Status bar
└──────────────────────────────────────────────────────────────────┘
```

### UI Elements

| Element | Description |
|---------|-------------|
| **Menu bar** | File, Edit, View, Insert, Format, Data, Help dropdown menus |
| **Formula bar** | Shows the active cell reference, fx button, and formula input |
| **Toolbar** | Quick-access formatting: bold, italic, underline, strikethrough, alignment, colors, borders, number format, undo/redo |
| **Sheet tabs** | Multi-sheet navigation — click to switch, double-click to rename, `+` to add |
| **Grid** | Virtualized cell grid — supports 100,000+ rows × unlimited columns |
| **Status bar** | Shows current status message and sheet dimensions |

---

## Interacting with Cells

### Selecting Cells

| Action | Result |
|--------|--------|
| **Click** | Select a single cell |
| **Click + drag** | Select a range of cells |
| **Shift + click** | Extend selection to clicked cell |
| **Click column header** | Select entire column (A, B, C…) |
| **Click row header** | Select entire row (1, 2, 3…) |
| **Ctrl + A** | Select all cells (or all text when editing) |

### Entering Data

| Data Type | Example | Notes |
|-----------|---------|-------|
| **Number** | `42`, `-3.14`, `1000` | Automatically right-aligned |
| **Text** | `Hello`, `Item #123` | Automatically left-aligned |
| **Date** | `08/05/2026` | Formatted when date format applied |
| **Formula** | `=A1+B1`, `=SUM(A1:A10)` | Always starts with `=` |
| **Boolean** | `TRUE`, `FALSE` | Logical values |

### Point Mode (Visual Formula Building)

When you type `=` followed by a function name and start selecting cells, you enter **POINT mode** — the interactive formula builder:

1. Click cell `A1` — the reference `A1` appears in your formula
2. Type `+` — the mode stays active
3. Click cell `B1` — the formula becomes `=A1+B1`
4. Press `Enter` to commit

In POINT mode, the grid highlights each referenced range with a **colored bounding box** — each reference gets a distinct color so you can see which cells feed into your formula.

**POINT mode shortcuts:**

| Key | Action |
|-----|--------|
| `Enter` | Commit formula |
| `Escape` | Cancel editing, restore original value |
| `Tab` | Commit and move right |
| `Shift + Tab` | Commit and move left |
| `Arrow keys` | Navigate and extend the current reference |
| `F4` | Cycle reference absolute/relative |
| `Backspace` | Delete last character/reference |

---

## Cell Reference Types

SimpleSheet supports two reference notations and four reference styles.

### A1 Notation (Default)

Columns are letters, rows are numbers:

| Reference | Meaning |
|-----------|---------|
| `A1` | Column A, Row 1 (relative) |
| `$A$1` | Column A, Row 1 (absolute — won't shift on copy/paste) |
| `$A1` | Column A absolute, Row 1 relative |
| `A$1` | Column A relative, Row 1 absolute |
| `B10:ZZ100` | Range from B10 to ZZ100 |
| `Sheet2!A1` | Cell A1 on Sheet2 (cross-sheet) |
| `'My Sheet'!A1` | Cell A1 on sheet named "My Sheet" (use quotes for names with spaces) |

### R1C1 Notation

Toggle by clicking the **cell reference button** (e.g., `A1`) in the formula bar:

| Reference | Meaning |
|-----------|---------|
| `R1C1` | Row 1, Column 1 (same as A1) |
| `R[1]C[1]` | Relative offset: 1 row down, 1 column right from current cell |
| `R1C[2]` | Absolute row 1, relative column offset +2 |

### When to Use Absolute References (`$`)

| Scenario | Use |
|----------|-----|
| Tax rate in a fixed cell | `=$B$1 * A2` — B1 stays locked when copied down |
| Lookup table range | `=VLOOKUP(A1, $D$1:$F$100, 3, FALSE)` |
| Header row reference | `=SUM(A$1:A$10)` — row won't shift |

Press **F4** while editing a formula to cycle through reference styles: `$A$1` → `A$1` → `$A1` → `A1`

---

## In-Cell Editing

SimpleSheet uses a finite state machine (FSM) for cell editing with four states:

### Editing States

```
SELECT → ENTER → EDIT → POINT
           ↑        │
           └────────┘ (Escape returns to previous state)
```

| State | Trigger | Behavior |
|-------|---------|----------|
| **SELECT** | Default state | Cell is highlighted but not being edited |
| **ENTER** | Press a printable key or `F2` | New value replaces existing content |
| **EDIT** | Press `F2` or click formula bar | Cursor placed in existing content for modification |
| **POINT** | Type `=` and select cells | Visual formula building with colored highlights |

### Editing Actions

| Action | Result |
|--------|--------|
| **Double-click cell** | Enter EDIT mode at click position |
| **Click cell + type** | Enter ENTER mode (replaces content) |
| **F2** | Toggle between EDIT and SELECT |
| **Enter** | Commit value, move selection down |
| **Shift + Enter** | Commit value, move selection up |
| **Escape** | Cancel edit, restore original value |
| **Backspace / Delete** | Clear cell contents (in SELECT state) |
| **Tab** | Commit and move right |
| **Shift + Tab** | Commit and move left |
| **Alt + Enter** | Insert line break within cell (multiline) |
| **Ctrl + Enter** | Commit value, stay in same cell |
| **Ctrl + Shift + U** | Expand/collapse formula bar for multiline editing |

### Batch Entry

Press **Ctrl + Enter** when a **range** is selected to fill ALL selected cells with the same value or formula.

### Formula View

Press **Ctrl + `` ` ``** (backtick) to toggle between displaying cell **values** and **formulas**. The status bar shows "Formulas" when formula view is active.

---

## The Formula Bar

The formula bar sits below the toolbar and displays the content of the active cell for editing.

```
[A1 ▾]  fx  [═══════════════════════════════════════]  [≡]
  ↑       ↑                  ↑                        ↑
  │       │                  │                        └ Expand/collapse (Ctrl+Shift+U)
  │       │                  └ Formula input buffer
  │       └ Open Formula Wizard (Ctrl+Shift+F)
  └ Active cell reference (click to toggle A1/R1C1)
```

### Formula Bar Elements

| Element | Description |
|---------|-------------|
| **Cell reference** | Shows active cell (e.g., `A1`). Click to toggle A1/R1C1 notation |
| **fx button** | Opens the Formula Wizard pre-populated with the current formula |
| **Input field** | Type or edit the cell's value/formula. Supports autocomplete |
| **Expand toggle** | Resizes the input to a multiline textarea (Ctrl+Shift+U) |

### Formula Bar Editing

| Key | Action |
|-----|--------|
| **Type** | Enter text/numbers/formula |
| **Arrow keys** | Move caret within buffer |
| **Ctrl + Left/Right** | Move caret one word left/right |
| **End** | Move caret to end of line |
| **Enter** | Commit and move down |
| **Escape** | Cancel and restore original |
| **Ctrl + F2** | Toggle focus between formula bar and grid |

### Formula Highlighting

When editing a formula in the formula bar, referenced cells and ranges are:
- **Color-coded** — each reference gets a distinct color
- **Highlighted on the grid** — matching colored boxes appear over the referenced cells
- **Cross-sheet refs** — shown with the sheet name (e.g., `Sheet2!A1`) and can be clicked to navigate to that sheet

---

## Constructing Formulas

All formulas begin with `=` followed by expressions, function calls, or operators.

### Arithmetic Operators

| Operator | Example | Result |
|----------|---------|--------|
| `+` | `=A1 + B1` | Addition |
| `-` | `=A1 - B1` | Subtraction |
| `*` | `=A1 * B1` | Multiplication |
| `/` | `=A1 / B1` | Division |
| `^` | `=A1 ^ 2` | Exponentiation |
| `%` | `=50%` | Percentage (0.5) |
| `&` | `=A1 & B1` | Text concatenation |

### Comparison Operators

| Operator | Example | Result |
|----------|---------|--------|
| `=` | `=A1 = B1` | TRUE if equal |
| `<>` | `=A1 <> B1` | TRUE if not equal |
| `>` | `=A1 > B1` | TRUE if greater |
| `<` | `=A1 < B1` | TRUE if less |
| `>=` | `=A1 >= B1` | TRUE if greater or equal |
| `<=` | `=A1 <= B1` | TRUE if less or equal |

### Formula Examples

```
=A1 + B1 * 2                    ← Arithmetic with precedence
=SUM(A1:A10) / COUNT(A1:A10)    ← Nested functions
=IF(A1 > 100, "High", "Low")    ← Conditional with text
=CONCAT("Total: ", TEXT(A1, "$#,##0.00"))  ← Text + number formatting
=VLOOKUP(A1, D1:F100, 3, FALSE) ← Lookup function
=Sheet2!A1 + Sheet3!B1          ← Cross-sheet calculation
```

### Error Values

| Error | Meaning |
|-------|---------|
| `#DIV/0!` | Division by zero |
| `#VALUE!` | Wrong data type in formula |
| `#REF!` | Invalid cell reference |
| `#NAME?` | Unrecognized function name |
| `#N/A` | Value not available (lookup failed) |
| `#CIRCULAR!` | Formula references its own cell |

---

## Working with Ranges

A range is a rectangular block of cells referenced by its top-left and bottom-right corners.

### Range Syntax

| Pattern | Meaning |
|---------|---------|
| `A1:B10` | Cells from A1 through B10 (2 columns × 10 rows) |
| `A:A` | Entire column A (not directly usable in formulas, but works in SUM etc.) |
| `1:1` | Entire row 1 |
| `A1:Z100` | Large rectangular block |

### Selecting Ranges for Formulas

**Method 1 — Type directly:**
1. Type `=SUM(` in the formula bar or cell
2. Type `A1:A10` 
3. Close with `)` and press Enter

**Method 2 — Point and click (POINT mode):**
1. Type `=SUM(` 
2. Click cell A1, then drag to A10 — the range appears in your formula
3. Press Enter

**Method 3 — Range picker (Formula Wizard):**
1. Open Formula Wizard with `Ctrl+Shift+F`
2. Click the **🗗** icon next to a range parameter
3. Click or drag on the grid to select the range
4. Press Enter to accept

### Cross-Sheet Ranges

Reference cells on other sheets:

```
=SUM(Sheet2!A1:A10)           ← Range on Sheet2
='Q1 Data'!B1:B20              ← Sheet name with spaces needs quotes
=AVERAGE(Sheet1:Sheet3!A1)     ← 3D reference across multiple sheets
```

When you paste formulas that reference other sheets, the **sheet prefix is preserved** but the cell references are adjusted relative to the paste position.

---

## Keyboard Shortcuts

### Navigation

| Shortcut | Action |
|----------|--------|
| `Arrow Keys` | Move cell selection by one cell |
| `Shift + Arrow` | Extend selection range |
| `Home` | Jump to start of current row |
| `Ctrl + Home` | Jump to cell A1 |
| `Ctrl + End` | Jump to last cell with data |
| `Page Up / Down` | Scroll by one screen |
| `Tab` | Move right (commits any edit) |
| `Shift + Tab` | Move left (commits any edit) |

### Editing

| Shortcut | Action |
|----------|--------|
| `F2` | Enter/EXIT edit mode for current cell |
| `Ctrl + F2` | Toggle focus between formula bar and grid |
| `Enter` | Commit value, move selection down |
| `Shift + Enter` | Commit value, move selection up |
| `Ctrl + Enter` | Commit value, stay in same cell (or fill entire selection) |
| `Escape` | Cancel edit, restore original value |
| `Backspace / Delete` | Clear cell contents |
| `F4` | Cycle reference style ($A$1 → A$1 → $A1 → A1) |
| `Alt + Enter` | Insert line break within cell |
| `Ctrl + Shift + U` | Expand/collapse formula bar |

### Clipboard

| Shortcut | Action |
|----------|--------|
| `Ctrl + C` | Copy selection |
| `Ctrl + X` | Cut selection |
| `Ctrl + V` | Paste to selection |
| `Ctrl + Alt + V` | Paste Special (values, formulas, formatting) |
| `Escape` | Clear marching-ants clipboard selection |

### History

| Shortcut | Action |
|----------|--------|
| `Ctrl + Z` | Undo last action |
| `Ctrl + Y` | Redo last undo |
| `Ctrl + Shift + Z` | Redo (alternate) |

### Formatting

| Shortcut | Action |
|----------|--------|
| `Ctrl + B` | Toggle bold |
| `Ctrl + I` | Toggle italic |
| `Ctrl + U` | Toggle underline |

### File

| Shortcut | Action |
|----------|--------|
| `Ctrl + N` | New workbook |
| `Ctrl + S` | Save workbook (downloads JSON) |
| `Ctrl + O` | Open workbook (file picker) |
| `Ctrl + H` | Find & Replace |
| `Ctrl + Shift + F` | Open Formula Wizard |

### View

| Shortcut | Action |
|----------|--------|
| `Ctrl + `` ` `` | Toggle formula view (show formulas vs values) |
| `Ctrl + Shift + L` | Toggle filter |

---

## Charts

Charts visualize your spreadsheet data as SVG graphics that float on the sheet.

### Creating a Chart

1. **Select** the data range you want to visualize (including headers/labels)
2. Open **Insert → Chart…** or click the chart icon in the toolbar
3. Choose a **chart type** and configure options:
   - **Title** — Chart heading
   - **Data range** — The cells containing your data (auto-detected from selection)
   - **X-axis label** — Horizontal axis description
   - **Y-axis label** — Vertical axis description
   - **Legend position** — Top, bottom, left, right, or none
4. Click **"Insert Chart"** to place it on the sheet

### Chart Types

| Type | Icon | Use Case |
|------|------|----------|
| **Bar** | 📊 | Compare values across categories (horizontal bars) |
| **Column** | 📶 | Compare values across categories (vertical bars) |
| **Line** | 📈 | Show trends over time or ordered categories |
| **Pie** | 🥧 | Show proportional breakdown of a single series |
| **Area** | 📉 | Show cumulative totals (filled line chart) |
| **Scatter** | ⚬ | Show correlation between two numeric series |

### Editing Charts

| Action | How |
|--------|-----|
| **Move** | Drag the chart by its header bar |
| **Resize** | Drag any of the 8 corner/edge handles (when selected) |
| **Minimize** | Click the minimize button in the header — collapses to title bar |
| **Restore** | Double-click the minimized header bar |
| **Delete** | Select the chart and press Delete, or click the delete button |

### Chart Features

- **Live preview** — See chart update as you change settings
- **Range picker** — Click 📎 in the data range field to select from grid
- **Auto-update** — Charts refresh when source data changes
- **Persistent settings** — Last-used chart settings are remembered
- **Multiple charts** — Place many charts on the same sheet
- **PDF export** — Charts are included when exporting to PDF
- **Persistence** — Charts save/load with the workbook

---

## Sorting & Filtering

### Sorting

| Action | How |
|--------|-----|
| **Sort A → Z** | Data → Sort A → Z (or toolbar) |
| **Sort Z → A** | Data → Sort Z → A (or toolbar) |

Sorting automatically:
- Detects the data range from your current selection
- Preserves row integrity (entire rows move together)
- Adjusts formula references after sorting
- Handles mixed data types (numbers, text, dates, blanks)

### Filtering

| Action | How |
|--------|-----|
| **Toggle filter** | Data → Toggle Filter (or `Ctrl + Shift + L`) |
| **Filter a column** | Click the filter dropdown arrow on the column header |
| **Clear one filter** | Open filter dropdown → Clear Filter |
| **Clear all filters** | Data → Clear All Filters |

### Filter Options

The filter dropdown for each column provides:

- **Checkbox list** — Select/deselect individual values to show/hide
- **Search box** — Filter the value list as you type
- **Custom filter tabs:**
  - **Contains** — Cell text contains a substring
  - **Not Contains** — Cell text doesn't contain a substring
  - **Equals** — Cell value equals specified value
  - **Not Equals** — Cell value doesn't equal specified value
  - **Starts With** — Cell text starts with specified text
  - **Ends With** — Cell text ends with specified text
  - **Greater Than** — Numeric value exceeds threshold
  - **Less Than** — Numeric value below threshold
  - **Blank** — Show only empty cells

Multiple column filters combine with **AND logic** — a row is visible only if it passes ALL active filters.

### Filter Status

When filters are active, the status bar shows: **"X of Y records visible"**

---

## Multi-Sheet Workbooks

SimpleSheet supports workbooks with multiple sheets, similar to Excel tabs.

### Sheet Management

| Action | How |
|--------|-----|
| **Add sheet** | Click `+` tab, or Data menu |
| **Switch sheet** | Click the sheet tab |
| **Rename sheet** | Double-click the sheet tab, type new name, press Enter |
| **Copy sheet** | Right-click sheet tab → Copy Sheet |
| **Delete sheet** | Right-click sheet tab → Delete Sheet |

### Cross-Sheet References

Reference cells on other sheets in formulas:

```
=SUM(Sheet2!A1:A10)          ← Sum range on Sheet2
=Sheet3!B5 * 1.1              ← Multiply Sheet3 value by 1.1
=AVERAGE('Q1 Data'!C1:C20)    ← Sheet name with spaces needs quotes
```

Cross-sheet references are:
- **Auto-computed** — Values update when the source sheet changes
- **Navigable** — Click a cross-sheet ref in the formula bar to jump to that sheet
- **Highlighted** — Shown with the sheet name in formula highlights

### Cross-Sheet Paste

When you paste formulas that reference other sheets:
- The **sheet prefix is preserved** (`Sheet2!` stays as `Sheet2!`)
- The **cell references are adjusted** relative to the paste position
- Example: Copying `=Sheet2!A1` one cell right becomes `=Sheet2!B1`

---

## Find & Replace

Open the Find & Replace dialog with **Edit → Find & Replace…** or **Ctrl + H**.

### Search Options

| Option | Description |
|--------|-------------|
| **Find** | Text to search for |
| **Replace with** | Replacement text |
| **Match Case** | Distinguish uppercase/lowercase |
| **Match Entire Cell** | Only find cells where the entire content matches |
| **Also Search in Formulas** | Search inside formula text (not just displayed values) |
| **Search All Sheets** | Search across all sheets in the workbook |

### Usage

1. Enter the text to **Find**
2. (Optional) Enter **Replace with** text
3. Configure search options with the checkboxes
4. Click **Search** to find matches (shows match count)
5. Click **Replace All** to replace all matches at once
6. Click **Reset** to clear all fields

---

## Formatting

### Text Formatting

| Format | How | Shortcut |
|--------|-----|----------|
| **Bold** | Toolbar B, Format → Bold | `Ctrl + B` |
| **Italic** | Toolbar I, Format → Italic | `Ctrl + I` |
| **Underline** | Toolbar U, Format → Underline | `Ctrl + U` |
| **Strikethrough** | Toolbar S | — |
| **Wrap Text** | Format → Wrap Text | — |

### Alignment

| Alignment | How |
|-----------|-----|
| **Left** | Toolbar, Format → Alignment → Left |
| **Center** | Toolbar, Format → Alignment → Center |
| **Right** | Toolbar, Format → Alignment → Right |

> **Smart Alignment:** Numbers, dates, and times are automatically right-aligned. Text stays left-aligned. User-set alignment always overrides auto-alignment.

### Colors

| Color | How |
|-------|-----|
| **Text color** | Toolbar color picker, Format → Text Color |
| **Fill color** | Toolbar fill picker, Format → Fill Color |
| **Border color** | Toolbar border color picker |

### Number Formats

| Button | Format | Example | Pattern |
|--------|--------|---------|---------|
| **Gen** | General (no formatting) | `42.5` | — |
| **123** | Number (2 decimals) | `42.50` | `0.00` |
| **$** | Currency | `$42.50` | `$#,##0.00` |
| **Acct** | Accounting | `$        42.50` | Excel-compatible |
| **%** | Percentage | `42.50%` | `0.00%` |
| **Date** | Date formats | `08/05/2026` | `mm/dd/yyyy`, `dd-mmm-yy`, `mmmm d, yyyy` |
| **Text** | Text format | `00123` (preserves leading zeros) | `@` |

**Additional format patterns:**

| Pattern | Example | Use Case |
|---------|---------|----------|
| `0` | `43` | Integer |
| `0.000` | `42.500` | 3 decimal places |
| `#,##0` | `1,234` | Thousands separator |
| `#,##0.00` | `1,234.56` | Number with commas |
| `0%` | `43%` | Integer percentage |
| `0.00E+00` | `4.25E+01` | Scientific notation |
| `hh:mm` | `14:30` | Time |
| `hh:mm:ss` | `14:30:00` | Time with seconds |
| `h:mm AM/PM` | `2:30 PM` | 12-hour time |
| `mm/dd/yyyy hh:mm` | `08/05/2026 14:30` | Date + time combined |

> **Date/Time serial numbers:** Excel stores dates as serial numbers (day 1 = Jan 1, 1900) and times as fractional days (0.5 = noon). SimpleSheet decodes these automatically.

> **Text format (`@`):** Forces numeric entries to be treated as literal text, preserving leading zeros (ZIP codes, ID numbers, credit card numbers).

### Accounting Format

The Accounting format provides:
- **Left-aligned `$`** at the far-left edge of the cell
- **Right-aligned number** at the far-right edge
- **Decimal point alignment** — numbers align perfectly down the column
- **Dash (`-`)** for zero values
- **Parentheses** for negative numbers

### Borders

Access borders via the toolbar border dropdown or Format → Borders:

| Border | Description |
|--------|-------------|
| **All Borders** | Borders on all four sides of each cell |
| **Outside Borders** | Border around the outer edge of the selection |
| **Top/Bottom/Left/Right** | Single edge border |
| **Thick Outside** | Heavy border around the selection |
| **Double Bottom** | Double-line bottom border |
| **Top and Bottom** | Top and bottom borders only |
| **Inside Borders** | Borders between cells in the selection |
| **Clear Borders** | Remove all borders |

### Clear Styles

**Format → Clear Styles** removes all formatting (font, color, alignment, borders, number format) from the selected cells.

---

## Import & Export

### Import Formats

| Format | Extension | How |
|--------|-----------|-----|
| **Excel** | `.xlsx`, `.xls` | File → Import → Excel |
| **CSV** | `.csv` | File → Import → CSV |
| **TSV** | `.tsv` | File → Import → CSV (auto-detects tab delimiter) |
| **JSON** | `.json` | File → Import → JSON |

### Export Formats

| Format | Extension | How |
|--------|-----------|-----|
| **Excel** | `.xlsx` | File → Export → Excel |
| **CSV** | `.csv` | File → Export → CSV |
| **TSV** | `.tsv` | File → Export → CSV (select TSV) |
| **JSON** | `.json` | File → Export → JSON |
| **PDF** | `.pdf` | File → Export → PDF |

### PDF Export Options

Open **File → Page Setup…** to configure PDF export:

| Setting | Options |
|---------|---------|
| **Orientation** | Portrait, Landscape |
| **Paper Size** | A4, Letter, Legal |
| **Scaling** | Fit to Page, Actual Size, Fit to Width |
| **Margins** | Top, Bottom, Left, Right (in mm) |

### Auto-Save

SimpleSheet automatically saves your workbook to **localStorage** every time you make a change (debounced). If you accidentally close the browser, your work is preserved. Use **File → Save** to download a JSON backup file.

---

## Freeze Panes

Freeze rows and/or columns to keep headers visible while scrolling through data.

| Action | How |
|--------|-----|
| **Freeze** | View → Freeze Panes |
| **Unfreeze** | View → Unfreeze Panes |

**Behavior:** SimpleSheet freezes all rows above and all columns to the left of the **active cell**. For example, if cell C3 is selected:
- Rows 1–2 are frozen (stay visible when scrolling down)
- Columns A–B are frozen (stay visible when scrolling right)

The frozen area is visually distinct (light blue background) and stays in place while the unfrozen area scrolls normally.

---

## Column & Row Sizing

### Drag Resize

Hover over the **right edge** of a column header or **bottom edge** of a row header. The cursor changes to a resize indicator. Drag to resize.

> **Touch support:** On mobile/touch devices, the resize handle responds to touch-drag gestures.

### Exact Size Dialog

For precise measurements, use the **Column / Row Size** dialog:

1. Open **Format → Column / Row Size…**
2. Choose **Column** or **Row** mode
3. Select a preset value or enter a custom size:
   - **Column presets:** 50, 80, 100, 150, 200 pixels
   - **Row presets:** 20, 28, 40, 60, 80 pixels
   - **Custom range:** 10–500 pixels
4. Choose scope:
   - Resize only the current column/row
   - Set as default for all columns/rows
5. Click **Apply**

### Set Default Size

To change the default width/height for ALL columns or rows:
1. Open the dialog
2. Check **"Set as default for all columns"** (or rows)
3. Enter the desired size
4. Click **Apply**

All columns/rows without an explicit override will use the new default.

---

## Paste Special

Access via **Edit → Paste Special…** or **Ctrl + Alt + V**.

The Paste Special dialog lets you control exactly what gets pasted:

| Paste Mode | What It Pastes |
|------------|----------------|
| **Everything** | Values, formulas, and formatting (default) |
| **Values Only** | Computed values — formulas are replaced with their results |
| **Formulas Only** | Formula text without formatting |
| **Formatting Only** | Cell styles (font, color, borders, alignment) without data |

| Option | Description |
|--------|-------------|
| **Transpose** | Swap rows and columns (A1→B1, B1→A1, etc.) |
| **Skip Blanks** | Don't overwrite destination cells when source cell is empty |

### When to Use Paste Special

| Scenario | Mode |
|----------|------|
| Copy formula results (break link to source) | Values Only |
| Apply a formula template to a new range | Formulas Only |
| Copy formatting to unformatted cells | Formatting Only |
| Transpose a table (rows ↔ columns) | Transpose checkbox |
| Update values without touching formulas | Skip Blanks |

---

## Fill Handle

The fill handle is the small blue square at the **bottom-right corner** of a selection.

### How to Use

1. Select one or more cells
2. Hover over the bottom-right corner until the cursor becomes a **+**
3. Drag in any direction to fill

### Fill Behaviors

| Source | Drag Result |
|--------|-------------|
| Single number `1` | Incrementing series: `1, 2, 3, 4…` |
| `Jan`, `Monday` | Calendar series: `Feb, Mar, Apr…` |
| `1, 3` | Pattern continuation: `5, 7, 9…` |
| Formula `=A1+1` | Formula copied with adjusted references |
| `Item 1` | Pattern detection: `Item 2, Item 3…` |

---

## Formula Wizard

The Formula Wizard provides an interactive step-by-step interface for building formulas, especially useful for complex nested functions.

### Opening the Wizard

| Method | Action |
|--------|--------|
| **fx button** | Click the **fx** button in the formula bar |
| **Menu** | Insert → Formula Wizard… |
| **Keyboard** | `Ctrl + Shift + F` |

### Smart Open Behavior

The wizard adapts based on the current cell:

| Cell Content | Wizard Behavior |
|--------------|-----------------|
| Has formula (e.g., `=SUM(B4:D4)`) | Opens with parameters pre-populated from the formula |
| Has nested formula (e.g., `=IF(A1>0, SUM(B4:D4), 0)`) | Shows nested structure — click any function to drill in |
| Empty or non-function | Shows **Function Picker** — searchable list of all 50+ functions |

### Wizard Interface

```
┌─────────────────────────────────────┐
│  Nested Formula Wizard         ✕    │
│  f(x) IF > f(x) SUM                 │  ← Breadcrumb navigation
│                                     │
│  Number1: [B4:D4          ] 🗗       │  ← Parameter input + range picker
│  Number2: [    ] (optional) 🗗       │
│                                     │
│  Result: 15                         │  ← Live computed result
│  Formula: =SUM(B4:D4)               │  ← Compiled formula preview
│                                     │
│  [← Back]  [Cancel]  [Apply to Cell]│
└─────────────────────────────────────┘
```

### Wizard Navigation

| Element | Action |
|---------|--------|
| **Breadcrumb** | Shows current nesting level (e.g., `f(x) IF > f(x) SUM`). Click to navigate back |
| **Parameter inputs** | Enter values, references, or ranges. Each has a label and type validation |
| **🗗 range picker** | Click to select ranges directly from the grid (enters POINT mode) |
| **Nested function buttons** | Click a function name in a parameter to drill into it |
| **Result preview** | Shows the computed result in real-time as you edit |
| **Formula preview** | Shows the compiled formula string |

### Wizard Workflow Example

**Building `=IF(A1>0, SUM(B4:D4), 0)`:**

1. Open wizard on an empty cell → Function Picker appears
2. Search "IF" → select it → wizard shows IF parameters
3. In the **Condition** field, type `A1>0`
4. In the **True_val** field, click the nested function button → select SUM
5. Wizard drills into SUM — breadcrumb shows `f(x) IF > f(x) SUM`
6. Click 🗗 next to **Number1** → select range B4:D4 on grid → press Enter
7. Result preview shows the sum value
8. Click **← Back** to return to IF level
9. In **False_val**, type `0`
10. Click **Apply to Cell** to commit

### Wizard State Machine

```
INACTIVE → WIZARD_ROOT → NESTED_STEP → POINT_SELECTION
              ↑               │
              └──── Back ─────┘
```

### Supported Functions (50+)

| Category | Functions |
|----------|-----------|
| **Math** | SUM, AVERAGE, COUNT, COUNTA, COUNTBLANK, MIN, MAX, PRODUCT, ABS, ROUND, ROUNDUP, ROUNDDOWN, SQRT, POWER, MOD, INT, FLOOR, CEILING, EXP, LN, LOG, LOG10, PI, RAND, RANDBETWEEN, SIGN, TRUNC |
| **Trigonometry** | SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, DEGREES, RADIANS |
| **Logic** | IF, AND, OR, NOT, XOR, IFERROR, IFNA, SWITCH, ISBLANK, ISERROR, ISNUMBER, ISTEXT |
| **Text** | CONCAT, CONCATENATE, LEFT, RIGHT, MID, LEN, LOWER, UPPER, PROPER, TRIM, TEXT, VALUE, REPT, REPLACE, SUBSTITUTE, FIND, SEARCH |
| **Statistical** | MEDIAN, MODE, STDEV, VAR, LARGE, SMALL, RANK, QUARTILE, PERCENTILE |
| **Conditional** | SUMIF, COUNTIF, AVERAGEIF, SUMIFS, COUNTIFS, AVERAGEIFS |
| **Date** | NOW, TODAY, YEAR, MONTH, DAY, HOUR, MINUTE, SECOND, DATE, DATEDIF, EDATE, EOMONTH, WEEKDAY, NETWORKDAYS |
| **Info** | ROW, COLUMN, ROWS, COLUMNS |
| **Lookup** | VLOOKUP, HLOOKUP, INDEX, MATCH, OFFSET, INDIRECT |

---

## Formula Autocomplete

As you type a function name in the formula bar, an **autocomplete dropdown** appears with matching functions.

### How It Works

1. Type `=S` → dropdown shows SUM, SQRT, SIN, SIGN, SMALL, SEARCH, SUBSTITUTE, SWITCH…
2. Continue typing to narrow results: `=SU` → SUM, SUMIF, SUMIFS
3. Select a function from the dropdown

### Autocomplete Controls

| Key | Action |
|-----|--------|
| **Type characters** | Narrow the function list |
| **Arrow Down** | Move selection down in dropdown |
| **Arrow Up** | Move selection up in dropdown |
| **Tab** | Accept the highlighted function |
| **Enter** | Accept the highlighted function |
| **Escape** | Dismiss the dropdown |

### What the Dropdown Shows

Each entry shows:
- **Function name** (e.g., `SUM`)
- **Signature** (e.g., `SUM(number1, [number2], ...)`)
- **Description** (e.g., "Adds all numbers in a range")
- **Category** (e.g., Math)

---

## Planned Features

The following features are planned for future releases (Phase 22–23 in the development roadmap):

### Phase 22: Conditional Formatting 📋

Apply dynamic formatting rules based on cell values:

| Rule Type | Description |
|-----------|-------------|
| **Greater Than / Less Than** | Highlight cells above/below a threshold |
| **Between / Not Between** | Highlight cells within a range |
| **Equal To / Not Equal To** | Highlight cells matching a value |
| **Text Contains** | Highlight cells containing specific text |
| **Duplicate Values** | Highlight duplicate entries |
| **Top/Bottom N** | Highlight top or bottom N values |
| **Above/Below Average** | Highlight cells relative to range average |
| **Color Scales** | Gradient fill based on value (2-color or 3-color) |
| **Data Bars** | In-cell horizontal bars proportional to value |
| **Icon Sets** | Arrows, traffic lights, stars based on thresholds |

**Planned access:** Format → Conditional Formatting

### Phase 23: Data Validation 📋

Restrict cell input to predefined criteria with custom error alerts:

| Validation Type | Description |
|-----------------|-------------|
| **Whole Number** | Integer only, with min/max constraints |
| **Decimal** | Floating point, with min/max constraints |
| **List** | Dropdown selection from static values or range reference |
| **Date** | Valid date within a range |
| **Time** | Valid time within a range |
| **Text Length** | String length within min/max |
| **Custom** | Formula-based validation |

**Error Alert Styles:**
- **Stop** — Reject invalid input
- **Warning** — Warn but allow override
- **Information** — Show message, allow input

**Planned access:** Data → Data Validation

---

## Quick Reference Card

### Essential Tasks

| Task | How |
|------|-----|
| Start a formula | Type `=` in a cell |
| Sum a range | `=SUM(A1:A10)` |
| Average a range | `=AVERAGE(B1:B20)` |
| Count numbers | `=COUNT(A1:A100)` |
| Find maximum | `=MAX(C1:C50))` |
| Conditional value | `=IF(A1>100, "High", "Low")` |
| Lock a reference | Use `$A$1` (press F4 to cycle) |
| Reference another sheet | `=Sheet2!A1` |
| Copy formula down | Use fill handle (drag bottom-right corner) |
| Undo a mistake | `Ctrl + Z` |
| Find and replace | `Ctrl + H` |
| Save workbook | `Ctrl + S` |
| Export to Excel | File → Export → Excel |
| Freeze headers | Select cell below headers → View → Freeze Panes |
| Create chart | Select data → Insert → Chart… |
| Sort data | Data → Sort A→Z or Z→A |
| Filter data | `Ctrl + Shift + L` or Data → Toggle Filter |
| Format as currency | Toolbar `$` or Format → Number Format → Currency |
| Set exact column width | Format → Column / Row Size… |

---

## Tips & Hints

1. **Click column/row headers** to select entire columns/rows
2. **Shift + click** to extend the selection range
3. **Start a formula with `=`** (e.g., `=SUM(A1:A10)`)
4. **Use `$` for absolute references** (e.g., `$A$1` won't shift on paste)
5. **Freeze panes** via View menu to keep headers visible while scrolling
6. **Resize columns/rows** by dragging header borders or use Format → Column / Row Size…
7. **Escape** clears the marching-ants clipboard selection
8. **Type `=SUM(` then click cells or drag** to build ranges visually
9. **Ctrl + F2** moves focus between formula bar and grid
10. **Ctrl + `` ` ``** toggles between showing values and formulas
11. **Double-click a sheet tab** to rename it
12. **Right-click a sheet tab** for copy/delete options
13. **Formula Wizard** (`Ctrl+Shift+F`) guides you through complex formulas
14. **Function autocomplete** appears as you type — press Tab to accept
15. **Paste Special** (`Ctrl+Alt+V`) lets you paste only values, formulas, or formatting
16. **Charts auto-update** when source data changes — no manual refresh needed
17. **Accounting format** (`Acct` button) aligns `$` left, numbers right, dashes for zero
18. **Text format** (`@`) preserves leading zeros in ZIP codes and ID numbers
19. **Cross-sheet references** are clickable in the formula bar to navigate between sheets
20. **Auto-save** keeps your work in localStorage — but download backups with Ctrl + S

---

*SimpleSheet — A lightweight, browser-based spreadsheet. No server, no account, no bloat.*
