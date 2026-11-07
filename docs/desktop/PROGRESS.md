# SimpleSheets Desktop — Progress

Resumable milestone checklist. Update after each exit gate. Blockers are listed
here and in `DECISIONS.md`.

**Branch:** `feature/electron`
**Spec:** `docs/SimpleSheets-Desktop-build-spec.md`

---

## Milestones

| # | Milestone | Status | Evidence |
| --- | --- | --- | --- |
| M0 | Environment audit, scaffold, `app://` origin, adapter skeleton, fixtures, icons, verify scripts | ✅ Complete | See below |
| M1 | Open end-to-end (picker, argv, single instance, drag-drop, errors, packaged smoke) | ✅ Complete | See below |
| M2 | Save/Save As, atomic writes, conflict prompts, exports | ✅ Complete | See below |
| M3 | Recents, recovery, session restore, intent state machine | ✅ Complete | See below |
| M4 | Native menu, accelerators, window state, About | ✅ Complete | See below |
| M5 | File association, NSIS + portable build | ⬜ Not started | — |
| M6 | Security hardening | ✅ Complete | See below |
| M7 | Performance, leak test, packaging polish | ✅ Complete | See below |
| M8 | Final evidence report | ⬜ Not started | — |

---

## M1 evidence

Checks run:

| Check | Result |
| --- | --- |
| `npm run verify` | 203 suites, 4,576 passed, 1 skipped |
| `npm run verify:e2e` | 9 tests passed |
| `npm run electron:build:dir` | unpacked packaged build produced |
| `node scripts/desktop-packaged-smoke.mjs` | packaged argv + picker open passed |

E2E coverage added:

- command-line fixture open;
- native picker open (`Ctrl+O` with a stubbed dialog);
- corrupt `.ssjson` shows a status error and leaves the UI intact;
- missing file from the picker shows an actionable error;
- two command-line intents serialize behind the Import Scope dialog, and
  cancelling the dialog releases the next intent;
- a file dropped onto the grid opens through the preload-resolved path (or the File API fallback);
- a synthetic `File` without an OS path is rejected with `NO_PATH`;
- second instance focuses the existing window and opens its file.

Known M1 limitations:

- The literal Explorer drag gesture is manual; the drop event and preload path are automated.
- The native dirty/open-close prompt arrives in M4; M2 uses the existing confirm.
- M1's FIFO queue was superseded by M3's newest-wins behavior.

---

## M7 evidence

Checks run:

| Check | Result |
| --- | --- |
| `npm run verify` | 215 suites, 4,658 passed, 1 skipped |
| `npm run verify:e2e` | 39 tests passed |
| 5,000-row CSV navigation | ~16 ms/key (budget < 100 ms average) |
| `large.ssjson` open | ~3.0 s (budget < 5 s) |
| `large.ssjson` save | ~237 ms (budget < 2 s) |
| 20 open cycles | heap growth ≤ 20% after CDP GC |
| Peak memory, large workbook | ~570 MB working set (ceiling 1.5 GB) |
| Installer / portable / unpacked | 108 MB / 99 MB / 312 MB |
| Packaged smoke | pass incl. 30 s idle network |

Root causes fixed:

- `CloudStorageModal` serialized and lz-compressed the entire workbook on every
  parent render, before its `isOpen` early return. Every cell navigation paid
  this cost (~425 ms/key on 5,000 rows; multi-second stalls on 9 MB). The share
  size is now memoized and computed only while the modal is open.
- `topologicalSort` used `order.includes()` in a loop over every cell, making
  evaluation O(n²) (~16.8 s on 150k cells). The second pass now uses the
  `visited` set, reducing large open from ~18.9 s to ~3.0 s.

E2E performance/leak coverage:

- 5,000-row CSV import under 5 s and 20 arrow-key navigation average <100 ms;
- 9 MB/50k-row open <5 s, save <2 s, memory <1.5 GB;
- twenty open cycles with CDP GC before/after heap comparison (<20%);
- cold start to a usable grid <3 s.

Docs: `M7-PERF.md`, README desktop section, MANUAL desktop section, and the M5
install checklist (uninstall/data preservation).

---

## M6 evidence

Checks run:

| Check | Result |
| --- | --- |
| `npm run verify` | 215 suites, 4,658 passed, 1 skipped |
| `npm run verify:e2e` | 35 tests passed |
| Packaged smoke | argv/picker/save/security pass, including 30 s idle network |
| `npm run electron:build:dir` | pass |

Hardening:

- IPC callers must be the top-level renderer frame; subframes are rejected even
  with a trusted origin. Packaged builds trust only `app://simplesheets`;
  development additionally trusts `http://localhost:3000`.
- Strict unknown-field rejection for recent, recovery, menu-state, legacy-import,
  save-dialog, and write payloads. Existing type/range/length checks retained.
- Write allowlist keys now use `realpath` (or the real parent + basename for a
  new file), so symlink and `..` aliases cannot bypass the approved path.
- `will-redirect` is blocked like `will-navigate`; window-open, webview attach,
  permissions, and external schemes remain denied/validated.
- `app:reveal-data-folder` uses `shell.showItemInFolder` on the fixed app data
  folder; no `shell.openPath` path operation remains.
- Packaged CSP response header verified, CSP console checked, protocol
  traversal/encoded traversal rejected, `window.open` denied, geolocation
  denied, and 30 s idle network log empty.

E2E/negative coverage added:

- unknown write fields return `INVALID_ARGUMENT`;
- `..` traversal outside the approved path returns `NOT_ALLOWED`;
- a symlink resolving outside the approved path returns `NOT_ALLOWED`;
- `open:recent` rejects paths not in the main recents list;
- packaged permission/window-open/traversal/CSP/idle checks.

Unverified-environment: forged native input, OS-level antivirus behavior, and
actual registry association behavior are covered by code inspection and the
M5 manual checklist; no installer is run.

---

## M5 evidence

Checks run:

| Check | Result |
| --- | --- |
| `npm run electron:build` | NSIS installer + portable executable produced |
| NSIS script inspection | one `.ssjson` `APP_ASSOCIATE` |
| Portable script inspection | `PORTABLE_EXECUTABLE_DIR` set; no association |
| Icon inspection | ICO 16/24/32/48/64/128/256 + 512 PNG |
| Artifact hashes | recorded in `M5-EVIDENCE.md` |
| `npm run verify` | 214 suites, 4,653 passed, 1 skipped |
| `npm run verify:e2e` | 34 tests passed |
| Packaged `--dir` + smoke | pass |

Delivered:

- Per-user assisted NSIS installer (`oneClick: false`, `perMachine: false`,
  no elevation) and portable executable.
- `.ssjson` association and "Open with SimpleSheets" handler generated by the
  NSIS installer; no `UserChoice` write, so Windows keeps default-handler
  control.
- Portable build sets `PORTABLE_EXECUTABLE_DIR`, reports edition `portable`,
  shows the portable folder in About, and registers no association.
- Uninstall is configured to remove the app, shortcuts, and association while
  preserving `%APPDATA%\SimpleSheets`.
- Fixed identity, icons, ASAR packaging, artifact names, and no signing.
- README desktop build/install/signing section and `INSTALL-CHECKLIST.md`.

Unverified-environment (documented, no installer run): install/uninstall,
upgrade in place, actual `.ssjson` double-click/"Open with" behavior,
association removal/reinstall, real portable wrapper launch, SmartScreen,
antivirus, and Windows 11 presentation.

---

## M4 evidence

Checks run:

| Check | Result |
| --- | --- |
| `npm run verify` | 213 suites, 4,650 passed, 1 skipped |
| `npm run verify:e2e` | 34 tests passed (menu 8, open 8, recovery 7, save 10, smoke 1) |
| `npm run electron:build:dir` | unpacked packaged build produced |
| `node scripts/desktop-packaged-smoke.mjs` | packaged argv+picker/save OK |

Implemented:

- Native File/Edit/View/Help menu with File New/Open/Recent/Recover/Save/Save As/
  Import/Export/Exit, Edit history/clipboard/select-all/find, View fullscreen
  and dev-only reload, and Help manual/shortcuts/About/data folder.
- Menu actions route through the existing renderer handlers via `menu:action`.
- Native accelerators: New, Open, Save, Save As, Undo, Redo, Find & Replace,
  Quit. `shortcutOwner.ts` is the single list; the renderer never performs a
  native-owned shortcut and forwards synthetic events that Electron's
  `before-input-event` does not intercept.
- Menu enable state: Undo/Redo from renderer history; Recover from main recovery
  presence; Save/Save As from document state. All refresh live.
- Window bounds: schema v1 `windowBounds`, validated against
  `screen.getAllDisplays()`, clamped on-screen, centered 1280×800 fallback,
  900×600 minimum, maximize flag restored without fullscreen.
- Native Save / Don't Save / Cancel prompts for close and dirty replacement.
  Close Save writes through the existing Save handler before letting the window
  close; Cancel aborts.
- Native Recent now shows the same ten main-owned entries as the in-app menu,
  including cloud/url rows (handled by the renderer); missing local entries
  offer Remove / Locate / Keep.
- About: edition, Electron/Chromium/Node, build/commit, data folder, Open Data
  Folder, Copy Diagnostics (versions only), license/notices, SmartScreen note,
  and Reset Application Data with confirmation.
- Copy Link on desktop encodes against `https://simplesheets.mouseclick.au/`.
- SimpleDocs and Help links use the validated external-link adapter.

E2E coverage added:

- menu structure and accelerators;
- native Save routes to the existing handler;
- dirty close Cancel keeps the window; Don't Save closes and clears recovery;
- dirty close Save writes the document before closing;
- dirty open Cancel leaves the document unchanged; Don't Save replaces it;
- dirty open Save writes before replacing;
- window bounds persist and restore;
- About opens from Help and shows edition data.

Known M4 limitations:

- Native menu accelerator delivery through Playwright's synthetic keyboard goes
  through the renderer forwarding path; real hardware uses `before-input-event`
  first. Both produce exactly one action.
- The Manual menu opens the public `MANUAL.md` URL; the local manual is not
  bundled into the ASAR.
- SmartScreen/code-signing remains unverified-environment by design.

---

## M3 evidence

Checks run:

| Check | Result |
| --- | --- |
| `npm run verify` | 211 suites, 4,633 passed, 1 skipped |
| `npm run verify:e2e` | 26 tests passed (open 8, save 10, recovery 7, smoke 1) |
| `src/platform/desktop/core/*` | state, recovery, migration, intent, queue unit tests pass |

Implemented:

- Main-owned `state.json` with schema v1, atomic/debounced writes, corrupt-file
  quarantine, recents, last path/directory, reopen preference, clean-exit flag.
- Main-owned `recovery.json` with schema validation, 100 MB limit, ≤2 writes/s
  throttling, atomic writes, corrupt-record deletion, and quit flush.
- Startup resolution: explicit intent wins; otherwise unclean recovery prompts
  natively; otherwise the last document reopens. Missing last paths are cleared.
- Native Recover/Discard prompt plus an in-app amber banner when an explicit
  open coexists with a recovery snapshot.
- Recovery loads as a dirty document titled `Name (Recovered)`, retaining the
  original path only while the file still exists.
- Main-owned recents wired through `useMRU`; path entries reopen via `open:recent`
  after verifying the path is in the main recents list.
- One-time legacy `simplesheets:mru` / `simplesheets:autosave` import; keys are
  deleted only after the state write succeeds.
- Newest-wins explicit open intents; stale queued (not active) intents dropped.

E2E restart matrix:

- clean exit reopens the last document;
- editing writes `recovery.json`, and a dirty close preserves it;
- unclean startup without argv auto-prompts Recover and applies the snapshot;
- Discard in the startup prompt deletes recovery and opens the last document;
- a missing last document is cleared without an open error;
- an explicit argv open wins over recovery and shows the banner;
- Recover from the banner replaces the explicit document with the snapshot;
- Discard from the banner keeps the explicit document and deletes recovery.

M3 dirty-quit behavior was superseded in M4 by the native close prompt and is
retained only as a fallback when the renderer cannot report its dirty state.

---

## M2 evidence

Checks run:

| Check | Result |
| --- | --- |
| `npm run verify` | 205 suites, 4,594 passed, 1 skipped |
| `npm run verify:e2e` | 19 tests passed |
| `npm run electron:build:dir` | packaged build produced |
| `node scripts/desktop-packaged-smoke.mjs` | packaged argv + picker + Save passed (2 runs) |

E2E coverage added:

- Save writes the current `.ssjson` in place and updates the native title;
- Save on an untitled document opens Save As;
- cancelling Save As writes nothing;
- Save As writes a new file with the filename-derived title;
- a deleted target is recreated after the native prompt;
- an external change prompts Overwrite and replaces the external bytes;
- Reload replaces the in-memory workbook with the disk version;
- a read-only target offers Save As and writes the replacement;
- Excel binary and CSV exports use the native Save dialog.

Atomic-write and save-target classification are unit-tested; packaged smoke
covers Save inside the ASAR build.

Known M2 limitations:

- The native Save/Don't Save/Cancel open/close prompt is M4.
- Last-path persistence and recovery-snapshot clearing are M3.
- An actual Windows share-lock is a manual check; read-only/permission paths
  are automated.
- The 10 MB save measured 4–8 s in the dev shell at M2; M7 fixed the
  render-path compression regression and measures ~237 ms.

---

## M0 evidence

Environment:

- Windows `10.0.26300`, Node `23.11.0`, npm `11.16.0`, Git `2.54.0`.
- ImageMagick `7.1.2` used for icon generation.
- No `signtool`, no signing certificate. See `DECISIONS.md`.

Checks run:

| Check | Result |
| --- | --- |
| `npm run lint` | pass |
| `npm run type-check` | pass |
| `npm run lint:electron` | pass |
| `npm run type-check:electron` | pass |
| `npm test` | 201 suites, 4,535 passed, 1 skipped |
| `npm run verify:e2e` | 1 smoke test passed (dev shell) |
| `npm run electron:build:dir` | unpacked packaged build produced (312 MB) |
| `node scripts/desktop-packaged-smoke.mjs` | packaged app loaded from `app://`, edition `installed` |
| `npm run electron:build` | NSIS installer 109 MB; portable 99 MB (built, not installed) |
| `npm run desktop:fixtures` | 16 fixtures in `tmp/desktop-fixtures` (15 at M0 + `small.csv`) |
| `npm run desktop:icons` | `build/icon.ico`, `build/icon.png` |

Artifacts (not committed):

- `dist-electron/` — compiled main/preload/core.
- `dist/` — renderer built with `--mode electron`.
- `release/win-unpacked/SimpleSheets.exe` — packaged smoke target.
- `release/SimpleSheets-Setup-0.1.0.exe` — NSIS installer (not installed).
- `release/SimpleSheets-Portable-0.1.0.exe` — portable build (not launched).
- `tmp/desktop-fixtures/` — generated test data.

Known limitations:

- Adapter capabilities are intentionally `false` for dialogs, recents,
  recovery, native menu, and association until their milestones.
- Installer and portable artifacts were produced for size measurement only. Installing one requires approval; association and clean-machine checks remain unverified.
- The combined `npm run electron:dev` script is covered by the Playwright dev
  shell; run it manually after dependency changes.

---

## Commands

| Purpose | Command |
| --- | --- |
| Dev shell | `npm run electron:dev` |
| Compile main/preload | `npm run electron:compile` |
| Renderer only | `npm run electron:build:renderer` |
| Unpacked package | `npm run electron:build:dir` |
| Installer + portable | `npm run electron:build` |
| Packaged smoke | `node scripts/desktop-packaged-smoke.mjs` |
| Fixtures | `npm run desktop:fixtures` |
| Icons | `npm run desktop:icons` |
| Full verification | `npm run verify` |
| E2E | `npm run verify:e2e` |
