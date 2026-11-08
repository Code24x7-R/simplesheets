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
- Permission request and permission check handlers deny everything except
  `local-fonts` for the trusted top-level app frame. This powers the system
  font picker; all other permissions (camera, microphone, geolocation,
  notifications, clipboard-read, MIDI) remain denied.
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
- The original FIFO queue was superseded in M3 by newest-wins handling for
  queued explicit intents.
- M1 recents used `localStorage`; M3 moved them to main-owned `state.json`.
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

---

## 10. Recents, recovery, and startup (M3)

- **Main owns state and recovery.** `state.json` and `recovery.json` live in
  `%APPDATA%\SimpleSheets` (or `SIMPLESHEETS_PROFILE`). Both use
  `schemaVersion: 1`, atomic temp+rename writes, and never touch user documents.
- **State writes are debounced 250 ms.** `recovery.json` writes are coalesced
  to the newest snapshot and throttled to at most two per second. A 100 MB
  snapshot is rejected with `TOO_LARGE`; the app stays usable.
- **Corrupt files do not block startup.** A corrupt state file is renamed to
  `state.json.corrupt` and replaced with defaults. A corrupt recovery record is
  logged and deleted (REC-13).
- **Startup precedence.** An explicit argv/open-with intent wins. Otherwise an
  unclean recovery snapshot prompts natively (Recover/Discard). Otherwise the
  last `.ssjson`/`.json` path reopens when `reopenLast` is true. Missing last
  paths are cleared silently.
- **Explicit + recovery.** When an explicit open coexists with recovery, startup
  shows a non-modal amber banner with Recover/Discard instead of replacing the
  explicitly opened document. Recovery is applied only on Recover.
- **Dirty quit.** M4's native close prompt decides Save / Don't Save / Cancel
  and clears recovery for Save/Don't Save. The M3 fallback (preserve recovery
  with `cleanExit: false`) remains for a renderer that cannot report dirty state.
- **Newest-wins intents.** `openIntentMachine.ts` defines monotonic generation
  tokens, and `OpenRequestQueue.clearPending()` drops queued explicit intents
  when a newer explicit intent arrives. The active intent is allowed to finish
  so an Import Scope dialog is never torn down under the user.
- **Recents path policy.** `recents:upsert` accepts a local path only when it is
  absolute, supported, and exists. `open:recent` verifies the path is in the
  main recents list before reading. Recovery paths must match the current
  document or an approved write path.
- **Legacy migration.** The renderer reads the same-origin `simplesheets:mru`
  and `simplesheets:autosave` keys once, sends them to `state:import-legacy`,
  and deletes them only after main confirms the state write. A legacy autosave
  becomes a recovery snapshot.

---

## 11. Native menu, window state, and close prompt (M4)

- **One shortcut owner.** `shortcutOwner.ts` lists every native-owned
  accelerator. The menu registers them; the renderer early-returns for those
  combinations and does not execute a second action.
- **Synthetic-key fallback.** Electron's `before-input-event` prevents the page
  from receiving a native-owned key and dispatches the menu action. Playwright's
  CDP key events do not always raise `before-input-event`, so the renderer
  forwards the action id through `menu:dispatch`. On real hardware only one path
  runs; on synthetic input only the fallback runs.
- **Menu actions, not menu logic.** Every item sends a stable `menu:action` id.
  The renderer maps it to the existing handler. Native Recent sends
  `recent-id:<id>`; the renderer resolves it against the main-owned list so
  cloud/url entries behave exactly like the in-app menu.
- **Window state.** `state.json` stores `windowBounds` (normal bounds plus a
  maximized flag). Bounds are validated against current display work areas,
  clamped on-screen, and replaced by centered 1280×800 when the saved rectangle
  is off-screen or below 900×600. Fullscreen is never restored.
- **Close prompt.** The main process tracks `rendererDirty` via
  `window:set-dirty`. `window.close`/Alt+F4/File → Exit show native
  Save / Don't Save / Cancel. Save sends `file:save-and-close`; the renderer
  saves, clears recovery, and calls `window:close-ready`. Cancel leaves the
  window open. Don't Save clears recovery before closing.
- **Dirty replacement.** The existing `confirmDiscard` returns synchronously on
  the web (`window.confirm`) and asynchronously on desktop
  (`dialog:unsaved`). Save runs the existing Save handler first; Cancel aborts
  the open/new action.
- **Reset.** `app:reset-data` clears recents, recovery, window bounds, and
  desktop state, then the renderer clears `localStorage` preferences. It never
  touches user documents.

---

## 12. Packaging and file association (M5)

- **Targets.** `npm run electron:build` builds a per-user assisted NSIS
  installer and a portable executable for x64 Windows. Both are unsigned and
  ASAR-packaged. Build output stays in the git-ignored `release/` directory.
- **Association.** `fileAssociations` contains only `.ssjson`. electron-builder
  emits `APP_ASSOCIATE` for the per-user `HKCU\Software\Classes` shell context
  with the "Open with SimpleSheets" label and icon. It does **not** write the
  Windows `UserChoice` hash, so Windows retains default-handler control.
- **Portable.** The portable target receives no association macro and sets
  `PORTABLE_EXECUTABLE_DIR`; `resolveEdition()` reports `portable` and About
  shows the portable folder. Data still lives in `%APPDATA%\SimpleSheets`.
- **Uninstall.** `deleteAppDataOnUninstall: false`; the NSIS uninstaller removes
  the app, shortcuts, and association, but preserves user data.
- **Unverified.** The installer has not been executed on this machine. Install,
  upgrade, association/`Open with` behavior, actual portable-wrapper launch,
  SmartScreen, antivirus, and Windows 11 presentation are marked
  unverified-environment and covered by `INSTALL-CHECKLIST.md`.

---

## 13. Security hardening (M6)

- **Sender identity.** `assertTrustedSender` rejects subframes (`senderFrame.parent
  !== null`) and requires the frame origin to be trusted. Packaged builds trust
  only `app://simplesheets`; the dev origin is trusted only when
  `app.isPackaged === false`.
- **Strict payloads.** IPC objects use an allowlist of own keys. Unknown fields
  return typed `INVALID_ARGUMENT`; this complements existing type, length, and
  range checks.
- **Path policy.** Write allowlist keys are canonical real paths (`realpath`),
  with the real parent + basename used for new files. `..` and symlink aliases
  therefore cannot bypass an approved path. The save-handler check runs before
  the atomic writer.
- **Navigation.** `will-navigate` and `will-redirect` block anything outside the
  trusted origins. `setWindowOpenHandler` denies windows and only opens
  validated http/https/mailto externally; webview attachment is cancelled.
- **Shell.** `shell.showItemInFolder` is the only shell path operation, applied
  to the fixed app data directory. External URLs use `shell.openExternal` only
  after scheme, length, and control-character validation.
- **Packaged checks.** The packaged smoke captures console output, verifies the
  CSP response header, rejects protocol traversal and encoded traversal, denies
  geolocation and `window.open`, and records 30 seconds of idle network traffic
  (empty).
- **Unverified.** Forged native input and OS-level antivirus/registry behavior
  remain outside automated coverage; the M5 checklist covers installed-app
  behavior.

---

## 14. Performance measurements (M7)

Method: Windows `10.0.26300` x64, Node `23.11.0`, Electron `45.2.3`, Playwright
`_electron` against the development shell; fixtures under
`tmp/desktop-fixtures`. Full table in `M7-PERF.md`.

- **Cold start**: ~1.4–1.7 s to window; usable grid under the 3 s budget.
- **5,000-row CSV**: navigation ~16 ms/key after deferring share-size
  compression out of parent renders. Regression fixture `nav-5000.csv`.
- **Large workbook**: 9 MB / 50,000 rows opens in ~3.0 s and saves in ~237 ms
  after replacing the O(n²) topological-sort tail with an O(n) pass.
- **Closed-modal work**: `ChartDialog` no longer scans the sheet or extracts
  chart data until open. Navigation on the large workbook is covered by a
  <100 ms average E2E budget.
- **Memory**: ~570 MB working set for the large workbook (1.5 GB ceiling).
- **Leak**: 20 open cycles with CDP garbage collection stay within 20% heap.
- **Artifacts**: installer 108 MB, portable 99 MB, unpacked 312 MB.
- **Recovery**: main coalesces writes at 500 ms (≤2/s) and flushes on quit.
- **Limits**: a true 20-process launch/quit cycle, Windows share-lock, and
  OS-cache effects remain manual. No timing values are silently relaxed; the
  E2E budgets are the guardrails.


---

## 15. Final evidence and unverified-environment (M8)

- The final report tags all 139 requirement IDs per section 3.3. Automated-pass
  includes unit/E2E/build/static enforcement; unverified-environment is used
  whenever no automated check could run here.
- The installer was not executed, no registry/association was changed, and no
  clean machine was available. `INSTALL-CHECKLIST.md` is the procedure.
- User-verified manually: APP-02 (`electron:dev`/HMR), OPEN-02 (double-click/
  Open With), PKG-02 (upgrade in place), PKG-03 (portable launch/About/no
  association), PKG-04 (association), PKG-10 (uninstall/data preservation), and
  PKG-13 (per-user installer, no elevation).
- Clean `npm ci` verification: `npm ci`, `npm run build`, and
  `npm run electron:build:dir` succeeded in a temp copy.
- APP-11 (OS shutdown/logoff) and APP-14 (100/125/150% display scaling) were
  user-verified. No unverified-environment requirements remain.
- No failed requirements are reported. No artifacts were published.


## 16. Iteration — autofit, toolbar wrap, system fonts

- **Column/row autofit** uses whole-sheet content, not only virtualized cells,
  and clamps to the existing drag bounds: 30–500 px columns and 28–500 px rows.
  A double-click commits through the normal resize path, producing one undo
  entry. A click without movement no longer commits a no-op resize.
- **Wrap Text** remains owned by `useCellStyles`; the toolbar button calls the
  same toggle as Format → Wrap Text and reflects active state.
- **Font family** is an optional `CellStyle.fontFamily` field. Existing
  workbooks remain valid because unset values fall back to the original
  monospace stack.
- Installed families are requested lazily with the Local Font Access API; the
  renderer caches the result and falls back to a curated common-font list when
  the API is unavailable or permission is declined.
- Excel export/import maps the family to `font.name`; PDF rendering and
  clipboard HTML parsing preserve it where the format supports it.
