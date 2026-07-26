# SimpleSheet — Requirements Document

**Audience:** Small‑business owners, freelancers, and office workers who need a lightweight, browser‑based spreadsheet without the complexity (or cost) of Excel/Google Sheets.

**Principle:** 80/20 rule — deliver the 20 % of features that cover 80 % of daily use cases.

---

## Editing

1. **Cell editing with type auto‑detection** — Users type into a cell and the system recognizes numbers, dates, booleans, and text automatically. *Rationale:* Eliminates manual formatting; the #1 daily friction point in small‑business sheets.

2. **Copy / paste & drag‑fill** — Standard clipboard shortcuts (Ctrl+C/V) and a fill‑handle that extends series (numbers, dates). *Rationale:* Users expect parity with desktop spreadsheets for basic data entry workflows.

3. **Undo / redo stack** — At least 50 levels of undo with toolbar buttons and Ctrl+Z/Y shortcuts. *Rationale:* Confidence to experiment; prevents data loss from accidental edits.

## Formulas

5. **Core formula engine** — Arithmetic (+, −, ×, ÷) plus SUM, AVERAGE, COUNT, MIN, MAX, IF. *Rationale:* Covers 90 % of small‑business calculations; keeps engine simple and fast.

6. **Circular reference detection** — Show `#CIRC!` error when formulas reference themselves. *Rationale:* Prevents silent miscalculations that erode trust in the tool.

## Import / Export

7. **Excel (.xlsx) import & export** — Round‑trip .xlsx files preserving values, formulas, and basic formatting. *Rationale:* Excel is the de‑facto standard; small businesses exchange files constantly.

8. **CSV / TSV import & export** — Load and save comma‑ or tab‑separated files. *Rationale:* Universal interchange format; needed for accounting software, legacy systems, and data migration.

9. **JSON import & export** — Serialize the full workbook (including merges, freezes, column widths) to/from JSON. *Rationale:* Power‑users and developers need a complete snapshot for backup or programmatic manipulation.

## UI / UX

10. **Virtualized grid with 10 k+ rows** — Smooth scrolling and rendering for large datasets. *Rationale:* Small businesses often track inventory, orders, or contacts in thousands of rows; janky scrolling kills adoption.

11. **Column/row resizing & freeze panes** — Draggable headers and frozen top‑row/left‑column. *Rationale:* Essential for navigating large sheets without losing context.

12. **PDF export with page setup** — Generate printable PDFs with orientation, margins, and scaling controls. *Rationale:* Invoices, reports, and forms must leave the browser as paper‑ready documents.

---

**Out of scope (intentionally excluded):** Pivot tables, charts, collaborative editing, macros, cloud storage integration, conditional formatting.
