# IO Workflow UX Audit & Plan

**Scope:** New / Open / Save / Import / Export / Share / Recent, plus the storage paths behind them.
**Status:** ✅ All batches complete (2026-10-28) — Batch A (T1–T4), Batch B (T5–T7), Batch C (T8–T10), Batch D (T11), Batch E (T12). Full suite: 4478 passing / 198 suites; lint, type-check, build clean.
**Benchmarks:** Excel (desktop + web), Google Sheets, LibreOffice Calc, Numbers.

---

## 1. Executive summary

The File menu exposes five file-ish concepts (New, Load Demo, Import, Export, Save/Open, Recent)
implemented by **five independent pipelines**:

| Pipeline | Entry point | Implementation |
| --- | --- | --- |
| Import (Excel/CSV/JSON) | `MenuBar` → `window.dispatchEvent('simplesheets:import-*')` → `ImportExportBridge` → `Import*Button` (`FileReader` + service) | replaces the workbook |
| Export (Excel/CSV/JSON/PDF) | `App` handler → `FilenameModal` → `download*` service | downloads a file |
| Save | `Ctrl+S` / `File → Save…` → `CloudStorageModal` (`mode='save'`) → `webShare.downloadDocument` | downloads `.ssjson` |
| Open | `Ctrl+O` / `File → Open…` → `CloudStorageModal` (`mode='open'`) → `fileIO.readWorkbookFile` | replaces the workbook |
| Recent | `useMRU` (localStorage) → `MenuBar` | dispatches the picker again (does not reopen) |

Because Save/Open were folded into the **cloud** modal ("Menu simplification complete"), the
user-visible labels no longer describe the behaviour, and three pairs of features do the same thing
through different code:

- `Import → JSON` ≡ `Open → Open from File` (both replace the whole workbook)
- `Export → JSON` ≡ `Save → Save to File` (same payload, different extension: `.json` vs `.ssjson`)
- `Share File` / `Save to File` / `Export → JSON` are three downloads with three filename UIs

Three flows are also **functionally broken**, which likely explains most of the "counter-intuitive"
reports:

1. **Shared links never open.** `encodeDocToUrl` is used by Copy Link; `decodeDocFromUrl` exists and
   is unit-tested but is *never called* by the app. A recipient sees their own autosave instead.
2. **`.ssjson` cannot be opened.** The File-open picker (`ImportExportBridge`) and `ImportJsonButton`
   both use `accept=".json"`, so the only file format the app *writes* is not selectable in the only
   two pickers that read it.
3. **Recent files don't reopen.** Local entries re-dispatch a *new* file picker; cloud entries just
   reopen the cloud modal. Nothing about the actual file is remembered.

---

## 2. Detailed findings

### 2.1 Semantics / labels (counter-intuitive)

| # | Finding | Industry norm |
| --- | --- | --- |
| S1 | `Ctrl+S` / **File → Save…** opens a dialog titled **"Save to Cloud"**; the primary actions are Copy Link / Share File / Save to File. Save takes a second click. | Ctrl+S writes the document; "Save As" asks for a name; sharing is a separate **Share** menu. |
| S2 | **File → Open…** opens the *cloud* modal; opening a local file needs a second click. Menu order is `… Save… , Open…`. | Open precedes Save; Ctrl+O is a file picker. |
| S3 | **Import** replaces the entire workbook (CSV import builds a brand-new 1-sheet workbook named "Imported"). No insert/new-sheet option, no confirmation. | Excel: Data → From Text/CSV inserts at the active cell. Sheets: File → Import asks *Replace / Create new / Insert new sheet(s)*. |
| S4 | **Import → JSON** and **Open** are the same operation under two names, with different side effects (Import JSON does **not** record the MRU; Open does). | One canonical "Open". |
| S5 | **Export → JSON** (`.json`) vs **Save to File** (`.ssjson`) — identical payload, two extensions, two filename prompts (`FilenameModal` vs the modal's inline field). | One native format, one "Save a copy". |
| S6 | **Load Demo** sits between New and Import and is destructive with no confirmation. | Template galleries are non-destructive. |
| S7 | Export scope is not communicated: Excel = all sheets, CSV/PDF = active sheet. Labels look identical. | Labels/tooltips state scope ("current sheet"). |
| S8 | Default filename source is inconsistent: Excel/JSON/Save use `workbook.title`; CSV/PDF use `sheet.name`. | Single rule (title, sheet suffix only for sheet-scoped exports). |

### 2.2 Broken / blocked flows

| # | Symptom | Cause | Impact |
| --- | --- | --- | --- |
| B1 | Recipient of a **Copy Link** URL sees their own last workbook. | `decodeDocFromUrl()` never wired into app startup or `hashchange`. | 🔴 High |
| B2 | "Reopen budget.ssjson" → picker shows no `.ssjson` files. | `ImportExportBridge` open input and `ImportJsonButton` use `accept=".json"`. | 🔴 High |
| B3 | MRU entry click does not reopen the document. | No file handle retention; local entries re-trigger a picker, cloud entries reopen the modal. | 🟡 Medium |
| B4 | New / Load Demo / Open / Import destroy the current workbook with no prompt; the 500 ms autosave then overwrites the recovery slot. | No dirty-state model, no confirm; `handleNewSheet` calls `resetHistory`. | 🔴 High (data loss) |
| B5 | MRU shows `budget.ssjson.ssjson` if the user types the extension. | `handleSaveFile` unconditionally appends `.ssjson`. | 🟢 Low |
| B6 | "Advanced: cloud accounts" errors out for all three providers. | `handleConnect` throws a stub error. | 🟡 Medium (dead-end UI) |
| B7 | MANUAL claims "CSV/TSV auto-detects tab delimiter". | `ImportCsvButton` calls `importCsv(text)` with no options → delimiter fixed to `','`; `importTsv()` unused. | 🟡 Medium (docs wrong) |
| B8 | `onRemoveRecent` is plumbed into `MenuBar` but never rendered. | Dead prop. | 🟢 Low |
| B9 | `storageService.saveWorkbook/loadWorkbook/listSaves/deleteSave/hasSave/hasAutosave/clearAutosave` are never called. | Unfinished named-save feature. | 🟢 Low (dead code) |

### 2.3 Missing standard affordances

- No **drag & drop** of `.xlsx/.csv/.ssjson` onto the grid.
- No **dirty indicator** ("Saved 2 min ago" / "Unsaved changes") — autosave makes state invisible.
- No **session restore prompt** when an autosave exists from a prior visit.
- No **import options** (header row, delimiter, scope).
- Recent list is flat at the bottom of the File menu, up to 10 rows, pushing Page Setup out of view.

### 2.4 Architecture debt behind the UX

- Menu action → `CustomEvent` → hidden `Import*Button`/`Export*Button` → `FileReader` is a three-hop
  detour with duplicated read/parse code and two different MRU-recording paths.
- Two native serializers: `jsonService.downloadJson` (`.json`) and `webShare.downloadDocument`
  (`.ssjson`).
- File handling (picker, accept list, MRU, naming) is scattered across `App`, `MenuBar`, the bridge
  and the modal instead of one service.
- `handleImport` / `handleImportError` are `istanbul ignore next` — pipeline refactors need new tests
  rather than relying on existing ones.

---

## 3. Resolved design

### 3.1 Decisions (confirmed 2026-10-28)

| # | Decision |
| --- | --- |
| D1 | **Save = immediate download.** No file-write handle, no second click. Ctrl+S downloads `.ssjson` straight away (default name = `workbook.title`), status message confirms. `Save As…` = the filename prompt path for name/scope. |
| D2 | **`.ssjson` is the single native format.** Accepted by every open/import picker; `.json` remains an accepted alias on open/import for backward compatibility, but the app only ever *writes* `.ssjson`. `Export → JSON` is removed (superseded by Save / Save As). |
| D3 | **Import gets a 3-way scope dialog:** Replace workbook / Add as new sheet(s) / Insert at active cell. Shown after parsing, only for import entry points (not for Open). CSV/TSV add header-row toggle + delimiter detection. |
| D4 | **Cloud provider stubs stay, but become an invitation:** first click shows a "Connect (setup required)" panel with what OAuth configuration is needed, a "don't show again" option, and a pointer to the zero-config options. No fake loading states, no inline error banner. |
| D5 | **Recents store `FileSystemFileHandle`s in IndexedDB** (Chromium). Clicking a recent re-opens directly (permission re-prompt as needed). Browsers without the API and handle-less save entries fall back to a picker and are labelled "select file". |
| D6 | **Lowest-risk sequencing** — pure/isolated modules first, structural menu churn last, browser-API work last. See §4. |
| D7 | **Shared links (`#doc=`) open as read-only snapshots**, the fragment is stripped from the address bar after load, and the status bar offers "Save a copy…" to take ownership. |

### 3.2 Target File menu

```
File
├── New                      Ctrl+N   (confirm if dirty)
├── Open…                    Ctrl+O   → local picker (.ssjson .json .xlsx .csv)
├── Recent ▸                          (per-item remove; handles reopen directly)
├── ─────────
├── Save                     Ctrl+S   (immediate .ssjson download)
├── Save As…                 Ctrl+Shift+S (filename prompt)
├── ─────────
├── Import ▸                          → Excel / CSV / JSON  (with scope dialog)
├── Export ▸                          → Excel (all sheets) / CSV (current sheet) / PDF (current sheet)
├── Share ▸                           → Copy Link / Share File
├── ─────────
└── Page Setup…                       Prints to PDF
```

Rules: **Open** replaces the document, **Import** brings data in, **Save** writes the native
format, **Share** is separate. "Load Demo" moves under `Help → Load Demo Workbook` (destructive
template action, not a file action).

### 3.3 Single file-IO service

`src/services/fileIO.ts` becomes the only place that:

- defines accept lists once (`NATIVE_FILE_TYPES`, `ALL_IMPORT_TYPES`),
- reads a `File` by extension and routes to the right parser (Excel → CSV → JSON),
- opens via `showOpenFilePicker` when available (capturing the handle), else `<input type=file>`,
- normalizes file names/extensions for MRU + status messages,
- maps errors to user-facing status messages.

`ImportExportBridge` and the hidden `Import*Button`/`Export*Button` components collapse into
`useFileIO()` + direct service calls; the `CustomEvent` indirection is removed.

### 3.4 State & safety

- Add `isDirty`, `lastSavedAt`, `currentFileName`, `isReadOnly` to the workbook view state.
- Destructive actions (New, Load Demo, Open, Import→Replace) confirm when dirty.
- Autosave recovery slot is keyed per document; New/Open no longer silently destroy the previous
  session — offer "Restore last session" when a newer recovery slot exists.
- Status bar: `Saved · budget.ssjson · 2 min ago` / `Unsaved changes` / `Shared snapshot (read-only)`.

### 3.5 Technical notes for the FS Access work (D5)

- TypeScript's `lib.dom` does **not** declare `showOpenFilePicker` or
  `FileSystemFileHandle.queryPermission/requestPermission` (only `createWritable` exists).
  Add a local ambient shim (`src/types/fileSystemAccess.d.ts`) rather than a new dependency.
- Handles are structured-cloneable → store in IndexedDB (new `src/services/handleStore.ts`).
  Wrap every IndexedDB call (private mode / quota / Safari) and degrade to handle-less entries.
- Permission must be (re)requested inside a user gesture; a click on a recent may therefore show a
  browser prompt or fail with "re-select".

---

## 4. Low-risk sequencing (task cards)

Ordering rule: **pure/isolated → small state changes → new isolated modules → structural menu churn
→ browser API**. Each card is independently shippable and verified with
`npm test && npm run lint && npm run type-check && npm run build`.

### Batch A — Pure & local (lowest risk, no behaviour surprises)

> **Status (2026-10-28): T1–T4 complete ✅** — verified with full suite (4393 pass), lint, type-check, build.

**T1 · Unify file types & accept lists** (`B2`, `D2`)
- New `src/utils/fileTypes.ts`: `NATIVE_EXT`, `ACCEPT_NATIVE = '.ssjson,.json,application/json'`,
  `ACCEPT_IMPORT`, `ACCEPT_ALL`, `normalizeFileName(name)` (strips duplicate/known extensions).
- Use in `ImportExportBridge`, `ImportJsonButton`, `ImportExcelButton`, `ImportCsvButton`,
  `CloudStorageModal`, `webShare.downloadDocument`, `jsonService.downloadJson`.
- Tests: accept attributes, name normalization (`.ssjson.ssjson`, `.json` alias, empty).
- Risk: **Low**. ~6 files, no state.

**T2 · MRU v2 schema + extension sanitizing** (`B5`, `D5` precursor)
- `MRUEntry` gains optional `handleId` + `canReopen`; existing v1 entries migrate (drop unknown
  fields) in `loadMRU`.
- `handleSaveFile` uses `normalizeFileName` (no more `.ssjson.ssjson`).
- Tests: migration, dedupe of `.ssjson`/`.json` names, name normalization on save.
- Risk: **Low**. Pure data + one handler.

**T3 · One read path, MRU on every open** (`S4`)
- Delete the duplicate `FileReader` in `ImportExportBridge`; route through `readWorkbookFile`.
- Every open/import records MRU (fixes `Import → JSON` never recording).
- Tests: JSON import records MRU, parse error surfaces as `Import error: …`, `.ssjson` opens.
- Risk: **Low/Med** (touches App handler wiring, well covered by new tests).

**T4 · Remove dead storage API** (`B9`)
- Delete `saveWorkbook/loadWorkbook/listSaves/deleteSave/hasSave/hasAutosave/clearAutosave` +
  their tests, or keep `clearAutosave` if §3.4 uses it. Coverage must not regress.
- Risk: **Low**. Deletion only.

### Batch B — Small, isolated state/UI changes

> **Status (2026-10-28): T5–T7 complete ✅** — verified with full suite (4414 pass), lint, type-check, build.

**T5 · Dirty state + destructive-action confirm** (`B4`)
- `isDirty` set by `pushHistory`, cleared by Save/Open/New; `window.confirm` guard (matching the
  existing confirm style in `App.tsx`) for New / Load Demo / Open / Import→Replace.
- Recovery slot keyed per document; "Restore last session?" on startup.
- Tests: confirm/cancel branches for each entry point, autosave slot isolation.
- Risk: **Med** (App-level; several existing tests must accept the confirm).

**T6 · Status-bar saved state + read-only flag** (`§3.4`, `D7` precursor)
- `Saved · <name> · <relative time>` / `Unsaved changes` / `Shared snapshot (read-only)`.
- Tests: relative-time formatting (pure helper), read-only disables editing entry points.
- Risk: **Low/Med**.

**T7 · Cloud provider invite screen** (`D4`, `B6`)
- Replace `handleConnect` throw with a setup panel: checklist of what OAuth config is required,
  "Don't show again" (localStorage), link back to zero-config options.
- Remove unused `busy`/`loadingFiles`/`saving` scaffolding and `_setLoadingFiles`/`_setSaving` voids.
- Tests: panel content, don't-show-again persistence, no error banner.
- Risk: **Low** (self-contained component).

### Batch C — New isolated modules

**T8 · Shared-link open (read-only)** (`B1`, `D7`)
> **Status (2026-10-28): complete ✅** — verified with full suite (4420 pass), lint, type-check, build.
- Call `decodeDocFromUrl` on mount + `hashchange`; `resetHistory(decoded)`, set `isReadOnly`,
  `history.replaceState` to strip `#doc=`, record MRU (`source:'url'`).
- Fix the `handleOpenRecent` `source:'url'` branch (currently `location.href` = no-op reload).
- Tests: decode on mount, invalid fragment ignored, fragment stripped, read-only enforcement,
  MRU url entry reopens without navigation.
- Risk: **Med** (app startup path; no existing coverage).

**T9 · Import scope dialog + CSV/TSV options** (`S3`, `B7`, `D3`)
> **Status (2026-10-28): complete ✅** — verified with full suite (4453 pass), lint, type-check, build.
- New `ImportScopeDialog`: Replace / Add as new sheet(s) / Insert at active cell.
- `csvService.detectDelimiter()` (`, ; \t |`) + `hasHeader` option; wire `importTsv`; multi-sheet
  Excel → "Add as new sheet(s)".
- App apply-paths for all three scopes, each a single `pushHistory`.
- Tests: delimiter detection, header toggle, all three scopes (unit + App integration).
- Risk: **Med**. New component + reducers, but additive.

**T10 · Drag & drop onto grid** (`§3.5`)
> **Status (2026-10-28): complete ✅** — verified with full suite (4453 pass), lint, type-check, build.
- Drop zone routes through the T9 pipeline; unsupported type → status error.
- Tests: drop xlsx/csv/ssjson, unsupported type, multiple files.
- Risk: **Low/Med** (depends on T9).

### Batch D — Structural churn (one pass, after behaviour exists)

**T11 · Menu restructure + label/copy pass + docs** (`S1`, `S2`, `S5`, `S6`, `S7`, `S8`, `B8`, `D1`)
> **Status (2026-10-28): complete ✅** — verified with full suite (4457 pass), lint, type-check, build.
- Implement §3.2 menu; `Save` = immediate download; `Save As…` = filename prompt; `Share ▸`;
  `Recent ▸` with per-item remove (uses the dead `onRemoveRecent`); Load Demo moves to Help;
  export labels state scope; unified default filenames.
- Rewrite `CloudStorageModal` copy/framing as Share sheet (no "Save to Cloud" title on Save).
- Update `MANUAL.md`, `README.md`, `docs/PLAN.md`; rewrite menu tests
  (`App.menu`, `App.handlers3/4`, `App.coverage-gaps`, `MenuBar.test`).
- Risk: **Med/High churn** (test + doc rewrites), low technical risk — hence last of the UI work.

### Batch E — Browser API (highest risk)

**T12 · File handles + IndexedDB recents** (`B3`, `D5`)
> **Status (2026-10-28): complete ✅** — verified with full suite (4478 pass), lint, type-check, build.
- Ambient type shim, `handleStore.ts` (IndexedDB), `showOpenFilePicker` capture on Open,
  permission re-request on recent click, fallback labelling for handle-less entries.
- Tests: handle granted/denied, IndexedDB unavailable, fallback picker, recents hydration.
- Risk: **High** (browser API + async permission + storage failure modes).

---

## 5. Verification & coverage

- Per card: `npx jest <touched suites>` during work; full
  `npm test && npm run lint && npm run type-check && npm run build` before completion.
- New pure modules (`fileTypes`, `handleStore`, `detectDelimiter`, relative-time helper) are
  cheap branch-coverage wins; `App.tsx` handler work removes two existing `istanbul ignore next`
  exclusions (T3/T5), which must be replaced by real tests.
- Docs to keep in sync: `MANUAL.md` (shortcuts + Import/Export + Auto-Save), `README.md`,
  `docs/PLAN.md`, `docs/BUGFIX.md` (log B1–B9 when Batch A/B starts),
  `docs/PROGRESS_LOG.md` (`[BUGFIX]` / `[FEATURE]` prefixes per AGENTS.md).

---

## 6. Open items (non-blocking, assume defaults)

1. Recent entries created by **Save** have no handle → labelled "select file to reopen" (only
   **Open** can capture a handle). Acceptable? *(assumed yes)*
2. Should `Save As…` also write an MRU entry with `canReopen: false`? *(assumed yes)*
3. Remove `Export → JSON` outright, or keep it as "Export → Backup (.ssjson)" pointing at the same
   download as Save? *(assumed remove — Save covers it)*
4. Ctrl+N keeps browser-default behaviour inside text inputs (already the case) — no change.
