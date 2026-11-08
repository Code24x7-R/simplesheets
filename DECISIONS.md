# DECISIONS.md — SimpleSheets iteration log

## Stack

- React 18 + TypeScript + Vite 5, Tailwind CSS.
- Electron 45 desktop edition (`feature/electron`, merged to `main`).
- Jest + React Testing Library for unit tests; Playwright Electron E2E.
- SheetJS for `.xlsx`, PapaParse for CSV, jsPDF/html2canvas for PDF.

## Commands

| Purpose | Command |
| --- | --- |
| Full verification | `npm run verify` |
| Electron E2E | `npm run verify:e2e` |
| Dev app | `npm run dev` |
| Dev desktop | `npm run electron:dev` |
| Build desktop | `npm run electron:build` |

Run E2E with an isolated `SIMPLESHEETS_PROFILE`; never point it at real user data.

## Known environment limitations

- E2E runs on Windows with a real Electron renderer.
- System-font enumeration depends on the Local Font Access API and OS font
  access; the fallback list keeps the picker usable when unavailable.

## Iteration SS-01 — Double-click column/row auto-fit

- **Acceptance:** double-clicking a column or row resize margin fits the
  whole sheet's content; bounds are 30–500 px for columns and 28–500 px for
  rows; a click without movement does not create a history entry.
- **Decision:** autofit uses the same `onColumnResize`/`onRowResize` commit path
  as dragging, so it is one undo step. It measures displayed values (including
  formatted numbers and formula results), not raw formula text.

## Iteration SS-02 — Toolbar Wrap Text

- **Acceptance:** the toolbar exposes the same Wrap Text toggle as the Format
  menu, with active state derived from the selected cell.
- **Decision:** reuse `toggleWrapTextStyle`; do not add a second style path.

## Iteration SS-03 — System font families

- **Acceptance:** the toolbar font picker lists installed families when the
  Local Font Access API is available, falls back to a curated list otherwise,
  and applies the chosen family to selected cells. The family persists in
  `.ssjson` and flows to PDF/Excel/clipboard where supported.
- **Decision:** `CellStyle.fontFamily` is optional; unset means the original
  monospace grid stack. Desktop grants only `local-fonts` to the trusted
  top-level frame; every other permission remains denied.


## Iteration SS-04 — Find field seed

- **Acceptance:** opening Find & Replace from the active sheet prefills Find
  with that cell's raw contents; editing the active cell and reopening uses the
  new value; user edits inside the open dialog are not overwritten.
- **Decision:** the App passes `initialQuery` from `getActiveCellValue()`, and
  the modal applies it only when transitioning from closed to open.
