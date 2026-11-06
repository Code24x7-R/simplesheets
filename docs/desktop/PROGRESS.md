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
| M1 | Open end-to-end (picker, argv, single instance, drag-drop, errors, packaged smoke) | ⏳ Next | — |
| M2 | Save/Save As, atomic writes, conflict prompts, exports | ⬜ Not started | — |
| M3 | Recents, recovery, session restore, intent state machine | ⬜ Not started | — |
| M4 | Native menu, accelerators, window state, About | ⬜ Not started | — |
| M5 | File association, NSIS + portable build | ⬜ Not started | — |
| M6 | Security hardening | ⬜ Not started | — |
| M7 | Performance, leak test, packaging polish | ⬜ Not started | — |
| M8 | Final evidence report | ⬜ Not started | — |

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
| `npm run desktop:fixtures` | 15 fixtures in `tmp/desktop-fixtures` |
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
- The combined `npm run electron:dev` script should be manually exercised
  before closing M1 (the equivalent launch is covered by Playwright).

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
