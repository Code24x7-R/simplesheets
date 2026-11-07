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
| M3 | Recents, recovery, session restore, intent state machine | 🚧 In progress | Core schemas landed; main store/UI next |
| M4 | Native menu, accelerators, window state, About | ⬜ Not started | — |
| M5 | File association, NSIS + portable build | ⬜ Not started | — |
| M6 | Security hardening | ⬜ Not started | — |
| M7 | Performance, leak test, packaging polish | ⬜ Not started | — |
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
- The queue is FIFO; newest-wins precedence arrives with the M3 state machine.
- Recents remain browser `localStorage` until M3.

---

## M3 progress

Foundation landed:

- `desktopState.ts` — schema v1, recent-file normalization/upsert/remove/clear, 10-entry cap.
- `recovery.ts` — recovery schema, 100 MB limit constant, recovered-title helper.
- `legacyMigration.ts` — one-time legacy MRU/autosave parsing; pathless entries non-reopenable.
- `openIntentMachine.ts` — generation tokens and newest-wins intent resolution.
- Unit tests for all four modules; 209 suites / 4,615 tests passing.

Still to land: main-process `state.json`/`recovery.json` store, recents UI wiring,
recovery startup prompt/banner, last-document restore, and the restart matrix.

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
- The 10 MB save measured 4–8 s in the dev shell, above SAVE-12's 2 s budget;
  autosave/rendering optimization is M7.

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
