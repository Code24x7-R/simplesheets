# SimpleSheets Desktop — Decisions

Environment audit, pinned versions, and durable engineering decisions for the
Electron edition. Update this file whenever a non-obvious choice is made.

---

## 1. Environment audit (M0)

Recorded: 2026-11-07 on the development machine.

| Item | Value |
| --- | --- |
| OS | Windows `10.0.26300` (Windows 11 generation) |
| Architecture | x64 |
| Node | `v23.11.0` |
| npm | `11.16.0` |
| Git | `2.54.0.windows.1` |
| Disk free | ~34 GB on `C:` |
| ImageMagick | `7.1.2-Q16-HDRI` (`magick` on PATH) |
| GitHub CLI | installed |
| Code signing | `signtool` **not found**; no certificate configured |
| Display | Interactive Windows desktop available; Electron windows render |

### Verified here

- Electron dev window loads the existing renderer.
- Packaged `--dir` build launches and loads `app://simplesheets/index.html`.
- `app://` protocol serves the renderer from ASAR; the packaged smoke script
  reports `edition: installed`.
- Playwright Electron launch works against both the dev shell and the packaged
  executable.

### Cannot verify here (manual checklist required)

- Code signing, SmartScreen reputation, and certificate-based update trust.
- Clean-machine install, upgrade-in-place, and uninstall/reinstall cycles.
- Windows 11 "Open with" presentation and default-app arbitration.
- File-association behavior after an installer upgrade.
- Behaviour on a machine without Node/Electron development tooling.

These stay `unverified-environment` until tested manually on a clean Windows VM.

---

## 2. Pinned versions (M0)

Exact versions, no ranges:

| Package | Version |
| --- | --- |
| `electron` | `45.2.3` |
| `electron-builder` | `26.18.0` |
| `@playwright/test` | `1.65.0` |
| `concurrently` | `10.0.6` |
| `wait-on` | `9.5.1` |
| `@types/node` | `24.10.1` |

The existing Vite/React/TypeScript versions are unchanged. Electron 45 supplies
Chromium 142 and Node 22. `webUtils.getPathForFile` and `protocol.handle` are
available in this line.

---

## 3. Build and packaging decisions

### Module format

The repo root is `"type": "module"`. Electron main and preload are compiled to
CommonJS so the sandboxed preload loads reliably:

- `tsconfig.electron.json` compiles `electron/**/*.ts` and
  `src/platform/desktop/core/**/*.ts` to `dist-electron/`.
- `scripts/write-electron-package.mjs` writes
  `dist-electron/package.json` with `{"type":"commonjs"}` so the emitted `.js`
  files are treated as CommonJS.
- `package.json` `"main"` points at `dist-electron/electron/main.js`.
- The preload is self-contained and imports only `electron`; it never imports
  shared runtime modules.

### Renderer build

- `vite build --mode electron` sets `base: './'`; the web build keeps `base: '/'`.
- Vite injects `__APP_VERSION__`, `__BUILD_TIMESTAMP__`, and `__GIT_COMMIT_HASH__`.
- The packaged renderer is served from `app://simplesheets` by a protocol
  handler that resolves only paths inside `dist` (ASAR-safe).
- The scheme is registered as `standard`, `secure`, `supportFetchAPI`, `stream`,
  `corsEnabled` before `app.ready`, so `localStorage` and IndexedDB have a
  stable origin across upgrades.

### Application identity and data

- Product name: `SimpleSheets`
- `appId`: `au.mouseclick.simplesheets`
- Executable: `SimpleSheets.exe`
- User data: `%APPDATA%\SimpleSheets` via `app.setPath('userData', ...)` before
  ready. `SIMPLESHEETS_PROFILE` overrides the path for tests.
- Portable edition uses the same user-data path and does not register file
  associations.

### Packaging

- `electron-builder.yml` targets NSIS (per-user, `perMachine: false`) and a
  portable executable, x64 only for the first pass.
- ASAR is enabled; no native modules; `npmRebuild: false`.
- `node_modules` is excluded from the package because main has no runtime
  dependencies and the renderer is bundled.
- No publish configuration. Builds are unsigned; SmartScreen warnings are
  expected and must be documented in the README/About UI.

### Icons

- `scripts/build-desktop-icon.mjs` renders `public/favicon.svg` with ImageMagick
  into `build/icon.ico` (16–256 px) and `build/icon.png` (512 px).
- ImageMagick is a development-time tool, not an npm dependency. Generated
  icons are committed so a clean checkout builds without it.

---

## 4. Security decisions

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`,
  `webviewTag: false`, `webSecurity: true`, `allowRunningInsecureContent: false`.
- The preload exposes one frozen bridge (`window.simplesheetsDesktop`) with a
  fixed method list. No generic `invoke`.
- Every IPC handler checks the sender frame against
  `app://simplesheets` (packaged) and `http://localhost:3000` (development).
- Main-process path handling is not exposed yet; file dialogs arrive in M1 with
  a path allowlist.
- Permission request and permission check handlers deny everything.
- Navigation to non-trusted origins is blocked. New windows are denied;
  `http`, `https`, and `mailto` links open in the default browser.
- Packaged CSP:

  ```
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self';
  media-src 'self' blob:; object-src 'none'; base-uri 'none';
  form-action 'none'; frame-ancestors 'none'; worker-src 'self' blob:
  ```

  `'unsafe-inline'` applies to styles only because React renders inline style
  attributes. No `'unsafe-eval'`.
- DevTools are disabled in packaged builds.

### Test seam

Playwright stubs native dialogs by evaluating in the Electron main process; M0
does not add any production test-only branches.

---

## 5. Dependency audit note

`npm audit` (production) reports pre-existing issues in `xlsx` (high/critical,
no fix available) and `jspdf` (critical, fix requires a breaking upgrade). They
are confined to local file parsing/generation; no untrusted remote content is
fetched. Revisit before public release and record the decision here. Do not run
`npm audit fix --force` blindly; it can break the existing import/export tests.

---

## 6. Known limitations at M0

- Native Open/Save dialogs, recents, recovery, file association, and the native
  menu are not wired yet. The adapter reports those capabilities as `false`
  until their milestones land.
- The in-app UI still uses the existing File System Access / download paths.
- The installer and portable artifacts were not produced yet; only the unpacked
  packaged build was produced. Running an installer requires explicit approval.
- `npm run electron:dev` was exercised through Playwright's web-server +
  Electron launch; the combined script itself should be re-run manually on a
  fresh shell before M1.

---

## 7. Measured package sizes (M0 preview build)

Measured from `npm run electron:build` on the development machine:

| Artifact | Size |
| --- | --- |
| `release/win-unpacked/` | 312 MB |
| `release/SimpleSheets-Setup-0.1.0.exe` | 109 MB |
| `release/SimpleSheets-Portable-0.1.0.exe` | 99 MB |

Reductions applied: `electronLanguages: [en-US]` (locales dropped from 49 MB to
588 KB) and `!**/*.map` (source maps excluded from the package).

The spec's original 250 MB installed-size budget was set before measuring
Electron 45. A modern Electron runtime is ~240 MB before the app is added, so
the budget is revised to **installer ≤ 150 MB and unpacked ≤ 350 MB** rather
than removing runtime DLLs that the app may need. Installer signing and
clean-machine install remain unverified.

The NSIS installer and portable executable were built for size measurement only.
They were **not installed**, because installing changes registry entries and
file associations and needs explicit approval.

---

## 8. Open pipeline (M1)

- **Main owns file reads.** Dialogs, argv, "Open with", second-instance, recent
  paths, and dropped paths all become an `OpenRequest` read by the main process
  and delivered to the renderer as an `ArrayBuffer`. The renderer parses with
  the existing importers; it never receives a path it can read directly.
- **One intent at a time.** `OpenRequestQueue` holds intents until the renderer
  sends `renderer:ready`, delivers the first, and waits for `open:ack` before
  delivering the next. Excel/CSV intents acknowledge only after the Import
  Scope dialog resolves, so a second file cannot replace the pending import.
  Reloads reset the active marker without consuming the queued intent.
  `src/platform/desktop/core/openQueue.ts` is unit-tested.
- **Ordering.** Command-line and second-instance paths are read sequentially
  before being enqueued, preserving argument order even when file sizes differ.
- **Sources.** `argv`/`open-with` on cold start, `second-instance` for an
  already-running app, `picker` from the native dialog, `recent` for MRU paths,
  and `drag-drop` for dropped files.
- **Validation.** Paths must be absolute, exist, have a supported extension,
  and stay under the 100 MB open limit. `fs.realpath` runs before the request is
  created. The dialog filters `.ssjson`, `.json`, `.xlsx`, `.xls`, `.csv`,
  `.tsv`, and `.txt`.
- **Imports vs document opens.** `.xlsx`, `.xls`, `.csv`, `.tsv`, and `.txt`
  route through the existing Import Scope dialog. `.ssjson`/`.json` replace the
  workbook directly, matching the web Open behavior.
- **Drag-and-drop.** The renderer passes the dropped `File` to
  `openDroppedFile`; the preload calls `webUtils.getPathForFile` and sends only
  that resolved path to main. The renderer never supplies an arbitrary path, so
  a synthetic `File` yields `NO_PATH` and falls back to the existing File API.
  E2E covers a real file input feeding a drop event and the synthetic-file
  rejection.
- **Testing.** Playwright stubs `dialog.showOpenDialog` by evaluating code in
  the Electron main process. E2E covers argv, picker, corrupt file, missing
  file, unsupported extension, drag-drop IPC, and second-instance focus/open.
  The packaged smoke validates argv and picker inside the ASAR build.
- **SEC-14 packaged test seam.** Packaged builds disable DevTools (SEC-11).
  Electron 45 then sometimes creates the first window target before
  Playwright's CDP connection is established, which makes the window
  undiscoverable. When `SIMPLESHEETS_E2E=1` is set on a packaged build, window
  creation is delayed by five seconds so the debugger must attach first. The
  seam does not bypass path validation or IPC checks and is inert in normal
  runs; the packaged smoke is the only consumer.

### M1 known limitations

- Dirty opens use the existing confirm prompt; the native Save / Don't Save /
  Cancel prompt and close prompt arrive in M4 with the native menu.
- The queue is FIFO; the "newest explicit intent wins" lifecycle precedence
  arrives with the M3 intent state machine.
- Recent files still use the existing `localStorage`/File System Access path;
  native path reopening is deferred to the main-owned recents in M3.
- A dropped file without an OS path opens through the File API and has no save
  path until Save As.

---

## 9. Save pipeline (M2)

- **Main owns writes.** The renderer never writes a path directly. `save:write`
  validates the path against the paths approved by the current document or a
  native Save dialog, then performs the write. A renderer path that was not
  approved returns `NOT_ALLOWED`.
- **Atomic writes.** `atomicWriteFile` writes a sibling temp file, fsyncs it,
  preserves the target mode, renames over the target, and fsyncs the directory
  on POSIX. A failure removes the temp file and leaves the original intact.
- **Conflict detection.** The open request carries `mtimeMs` and `size`; the
  renderer stores that version and sends it with Save. Main compares it to the
  on-disk `stat` immediately before writing. A changed or missing file shows a
  native prompt; no write happens until the user chooses.
- **Native prompts.** Conflict: Overwrite / Save As… / Reload / Cancel.
  Missing: Recreate / Save As… / Cancel. Read-only, permission-denied, and
  locked targets: Retry / Save As… / Cancel, with three 50 ms retries for
  `EBUSY`/`EPERM` before the prompt. Reload returns the current disk text so the
  renderer can replace the in-memory workbook without another IPC round trip.
- **Save As.** The native dialog suggests the sanitized title plus `.ssjson`,
  starts in the last save directory, and appends the suggested extension when
  the user omits one. Save As rewrites the serialized title to match the chosen
  filename. A conflict-driven Save As performs one follow-up write so the file
  title matches the new path.
- **Imported formats are not overwritten in place.** Only `.ssjson`/`.json`
  opens become the current save path. Excel/CSV imports require Save As, which
  prevents writing JSON over an `.xlsx` or `.csv` file.
- **Title.** The renderer sends the document title and dirty marker to main
  over `window:set-title`; the native title updates without changing browser
  tab behavior.
- **Exports.** `saveExport` uses the native Save dialog on desktop and the
  existing download path on the web. The File menu and the toolbar export
  buttons share this helper.
- **Stale closures.** Save callbacks read the workbook through a ref so a
  fast `Ctrl+S` immediately after an open cannot serialize the previous
  workbook.

### M2 known limitations

- The native Save / Don't Save / Cancel prompt on open/close is M4
  (OPEN-08/MENU-06); M2 keeps the existing confirm prompt for replacement.
- Last-path state and recovery-snapshot clearing are M3; recents still use the
  existing `localStorage` MRU.
- Locked-file behavior is unit/E2E covered for read-only/permission paths;
  an actual Windows share-lock remains a manual check.
- The 10 MB save measured 4–8 s in the dev shell, above SAVE-12's 2 s budget.
  The main costs are serialization/autosave/render; M7 pins the optimization and
  measurement so the budget is not silently relaxed.
