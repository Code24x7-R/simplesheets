# SimpleSheets Desktop: Build Specification

Build a complete Windows desktop edition of **SimpleSheets** by wrapping the existing React/Vite spreadsheet in Electron and adding native file handling. Deliver a **working, runnable, packaged application**, not a mockup, architecture document, or plan. Prioritize **data safety, a frictionless native file experience, and zero regression to the existing web app**.

SimpleSheets Desktop is the existing browser spreadsheet packaged as a normal Windows application: double-click a `.ssjson` file, edit, press Ctrl+S, and the file is written back in place. It keeps every spreadsheet feature of the web edition, adds native Open/Save/Recent/menu/recovery behavior, and stores its own state under `%APPDATA%\SimpleSheets`. It works fully offline with no accounts and no telemetry.

---

## 0. Operating Rules (read first)

1. **Start by inspecting the environment** (Windows build number, Node/npm, disk space, Electron/Chromium version, NSIS availability, Playwright Electron support, display availability). Record findings and a list of **what you cannot verify here** in `docs/desktop/DECISIONS.md`. Do not claim code-signing, SmartScreen, clean-machine install, or Windows 11 context-menu behavior without evidence.
2. **Make reasonable decisions and proceed.** Do not repeatedly ask questions. Record each non-obvious choice and its rationale in `DECISIONS.md`.
3. **Work in milestones (section 3).** Do not start the next milestone until the current milestone's exit checks pass. Commit at the end of each milestone on the `feature/electron` branch.
4. **When blocked,** record the blocker in `docs/desktop/PROGRESS.md`, mark the affected requirement *unverified-environment* or *failed*, and continue to the next milestone.
5. **Inspect actual APIs** of every dependency (installed type definitions and source) instead of guessing. Pin exact versions.
6. **No claims without evidence.** This applies to every feature, not only performance. The final report tags each requirement with an evidence level (section 3.3).
7. **Keep the existing web app green.** `npm run build`, `npm test`, `npm run lint`, and `npm run type-check` must continue to pass after every milestone. Do not change web behavior to make desktop behavior easier.
8. **Keep dependencies minimal:** Electron, electron-builder, Playwright, `concurrently`, `wait-on`, and the existing Vite/React/TypeScript stack. Justify anything else in `DECISIONS.md`. Do not add `electron-updater`, telemetry, or native modules.
9. **Use isolated test profiles and generated fixtures only.** Never touch real user files, saved documents, or `%APPDATA%` data outside `SIMPLESHEETS_PROFILE`. All tests must set `SIMPLESHEETS_PROFILE` to a temporary directory.
10. **Never publish, deploy, spend money, install the built installer, or contact external services** without explicit authorization. Building installers and portable executables is allowed; running an installer that changes registry/file associations requires approval.
11. **Do not add `/* istanbul ignore next */` or any coverage suppression** to meet coverage targets. If a module cannot be tested, exclude the file in Jest configuration and justify it in `DECISIONS.md`.

### Working files (create in M0, maintain throughout)

- `docs/desktop/DECISIONS.md`: environment audit, pinned versions, choices, rationale, limitations, and the user-data layout.
- `docs/desktop/PROGRESS.md`: milestone checklist, blockers, commands run, and evidence links.
- `docs/desktop/CAPABILITY_MATRIX.md`: what development, installed, portable, and web editions can and cannot do.
- `npm run verify`: web lint + web type-check + Jest + Electron type-check + Electron lint.
- `npm run verify:e2e`: Playwright Electron end-to-end checks with an isolated profile.
- `npm run verify:desktop`: fast desktop subset used at every milestone exit (Electron type-check, Electron lint, desktop unit tests, packaged smoke check where relevant).

### Non-goals

No macOS or Linux packaging. No auto-update and no update checks. No code signing or certificate purchase. No cloud sync, accounts, crash reporting, or telemetry. No multi-window or multi-document tabs beyond the existing sheet tabs. No encryption at rest. No native print dialog (the existing PDF export, now saved through a native dialog, is the print path). No macOS/Linux file associations or shell extensions. No thumbnail/preview handlers, no Windows 11 `IExplorerCommand` context-menu extension, and no URL protocol handler. No portable-edition file association or self-update. No new spreadsheet features, formula changes, UI redesign, or changes to the web edition's behavior. No migration of browser-origin `localStorage` from `simplesheets.mouseclick.au` (impossible across origins); the documented path is Save `.ssjson` in the browser, then Open it in the desktop app. Nothing is published anywhere without explicit authorization.

---

## 1. Product and Technology

**Stack**

- Electron `>= 34` for the Windows desktop shell. Pin an exact version at M0 and record it; the version must support `webUtils.getPathForFile` and `protocol.handle`.
- React 18 + TypeScript + Vite 5 for the existing interface. No UI rewrite.
- `electron-builder` for NSIS and portable packaging. Pin exact version.
- `@playwright/test` for Electron E2E. Pin exact version.
- Jest + React Testing Library for existing unit tests and new pure-logic tests.
- Existing dependencies for spreadsheet parsing/export (`xlsx`, `papaparse`, `jspdf`, `html2canvas`).

**Editions and platforms**

| Edition | Detection | Build target | Capabilities |
| --- | --- | --- | --- |
| Development | `!app.isPackaged` | `npm run electron:dev` | All except file association; loads Vite dev server with HMR |
| Installed | Packaged and not portable | NSIS per-user installer | Full: association, recents, recovery, single instance, native dialogs |
| Portable | Packaged and `process.env.PORTABLE_EXECUTABLE_DIR` set | Portable `.exe` | Full except file association and shell integration |
| Web | Browser, no preload bridge | Existing Vite build | Existing File System Access/download behavior only |

- The renderer must not branch on Electron internals. It talks to a **platform adapter** (`src/platform/`) with `web` and `desktop` implementations. The UI checks the adapter's capability object.
- Keep a capability matrix in the repo and mirror the important differences in the About dialog.

---

## 2. Requirements

Every requirement is testable and has a stable ID. Evidence levels are defined in section 3.3.

### 2.1 Platform adapter and web parity

- **PLAT-01** A `PlatformAdapter` interface exists at `src/platform/types.ts` with `web` and `desktop` implementations; the adapter is selected at module load by the presence of the preload bridge, not by user-agent sniffing.
- **PLAT-02** The adapter exposes a frozen `capabilities` object with at least `nativeFileDialogs`, `fileAssociation`, `singleInstance`, `nativeMenu`, `revealInFolder`, `windowStatePersistence`, `recovery`, and `appInfo`.
- **PLAT-03** Renderer code calls only the adapter for file dialogs, exports, recents, recovery, external links, app info, and window/document state. No renderer module imports `electron`, `ipcRenderer`, or reads `window.simplesheetsDesktop` directly outside `src/platform/desktop/`.
- **PLAT-04** The web adapter preserves current behavior: File System Access when available, hidden file input/download fallback otherwise, `localStorage` recents/autosave, and `window.open` for external links.
- **PLAT-05** Existing Jest tests run unchanged in the jsdom/web environment and pass.
- **PLAT-06** The renderer bundle contains no Electron or Node built-ins; verify by grepping the build output and by a Vite build with `--mode electron`.
- **PLAT-07** Adapter methods return typed results and never leak raw exceptions across the bridge; every desktop call resolves to `{ ok: true, value }` or `{ ok: false, code, message }`.
- **PLAT-08** The capability matrix is generated or hand-maintained in `docs/desktop/CAPABILITY_MATRIX.md` and matches the adapter capabilities exactly.

### 2.2 Application shell and lifecycle

- **APP-01** The packaged app loads the renderer from `app://simplesheets/index.html`, reaches the existing spreadsheet UI, and creates a usable document.
- **APP-02** `npm run electron:dev` starts Vite and Electron together, loads the dev server, and supports HMR. The dev-only URL is `http://localhost:3000`.
- **APP-03** The custom `app://` scheme is registered as privileged (`standard`, `secure`, `supportFetchAPI`, `stream`, `corsEnabled`) before `app.ready`, and `protocol.handle` serves only files inside the packaged `dist` directory.
- **APP-04** A second launch of the app focuses the existing window instead of creating a second instance; a file passed to the second launch is opened in the existing window.
- **APP-05** Window size and position persist across restarts. Saved bounds are validated against `screen.getAllDisplays()`; off-screen or invalid bounds fall back to a centered 1280×800 window. Minimum size is 900×600. Fullscreen and maximized state are not restored as fullscreen.
- **APP-06** The window title is `SimpleSheets — Budget.ssjson` for an open file and `SimpleSheets — Untitled` for a new document; the main process owns the title and updates it through the adapter.
- **APP-07** User data lives in `%APPDATA%\SimpleSheets` by default, set via `app.setPath('userData', ...)` before `ready`. `SIMPLESHEETS_PROFILE` overrides the directory.
- **APP-08** Idle startup performs no network requests and loads no remote content; verify with a network log in E2E.
- **APP-09** The Electron build sets Vite `base` to `./` in `--mode electron`; the web build keeps its existing base. Packaged JavaScript, CSS, images, and font assets all resolve from `app://simplesheets`.
- **APP-10** The window is created hidden and shown on `ready-to-show` to avoid a white flash; the renderer sends a `renderer-ready` signal after the first usable paint.
- **APP-11** An OS shutdown or logoff attempt writes a best-effort recovery snapshot and attempts to write `cleanExit`; Windows may still terminate the process, and the next start handles that as an unclean exit.
- **APP-12** `state.json` writes are atomic and debounced. A corrupt or schema-incompatible state file is renamed with a `.corrupt` suffix and replaced; documents and recovery data are never affected.
- **APP-13** The window uses the standard Windows title bar and native window controls; no custom frameless chrome is introduced.
- **APP-14** The interface renders without clipping or overlap at Windows display scaling of 100%, 125%, and 150%, and keyboard focus remains visible in native dialogs and the existing UI.

### 2.3 Opening files

- **OPEN-01** `File → Open…` and `Ctrl+O` show a native Windows open dialog with filters for SimpleSheets documents (`.ssjson`, `.json`), spreadsheets (`.xlsx`, `.xls`), and delimited text (`.csv`, `.tsv`, `.txt`). Cancelling is a no-op.
- **OPEN-02** The app opens a file passed as a command-line argument on cold start, through the second-instance command line, and via Windows "Open with" / double-click for `.ssjson`.
- **OPEN-03** Dragging a file onto the window opens it without navigating the window. The preload uses `webUtils.getPathForFile(file)` to obtain the real path; when no path is available, the renderer falls back to reading the `File` contents and the document has no save path until Save As. If multiple files are dropped, the first supported file is opened and the rest are ignored with a status message.
- **OPEN-04** Opening a supported file parses it with the existing importers, uses the filename (without extension) as the workbook title, marks the document clean, updates recents, and updates the window title.
- **OPEN-05** Unsupported, corrupt, missing, locked, or permission-denied files produce an actionable native dialog or status message; the current document remains open and usable.
- **OPEN-06** Every opened path is converted to an absolute path and must exist and have a supported extension. Relative paths and command-line flags are ignored.
- **OPEN-07** Open intents follow the pinned precedence state machine in section 2.14: the newest explicit intent wins; a cancelled intent leaves the current document unchanged.
- **OPEN-08** If the current document is dirty, replacing it prompts Save / Don't Save / Cancel using the native dialog. Cancel aborts the open.
- **OPEN-09** Opening a 10 MB workbook completes within the performance budget and does not block the UI for more than 200 ms at a time; parsing work is chunked or yielded if needed.
- **OPEN-10** Opening `.xlsx`, `.xls`, `.csv`, `.tsv`, or `.txt` routes through the existing Import Scope dialog with "Replace" selected by default; it does not silently replace the workbook.
- **OPEN-11** Opening the file that is already open reloads it when clean; when dirty, it prompts first and then reloads.
- **OPEN-12** Invalid command-line arguments are logged to `docs/desktop/PROGRESS.md` during development and ignored at runtime without an error dialog.

### 2.4 Saving files

- **SAVE-01** `Ctrl+S` / `File → Save` writes the workbook to the current path in place and marks the document clean.
- **SAVE-02** When the document has no path, Save behaves as Save As.
- **SAVE-03** Save As shows a native Windows save dialog with `.ssjson` selected, a suggested filename, and the last-used directory. Cancelling leaves the document and file untouched.
- **SAVE-04** Writes are atomic: write a temporary file in the target directory, flush it, then rename over the target. On failure the original file is unchanged and the temporary file is removed.
- **SAVE-05** Read-only or permission-denied targets show a native dialog with Retry, Save As, and Cancel. Cancel keeps the document dirty.
- **SAVE-06** Locked files (another process holds them) are retried up to three times at 50 ms intervals; after that the user gets Save As and Cancel options.
- **SAVE-07** If the target file changed on disk since it was opened or last saved (mtime or size differs), Save prompts Overwrite / Save As / Reload / Cancel. Overwrite writes the in-memory document; Reload discards in-memory changes after confirmation.
- **SAVE-08** If the target file was deleted, Save prompts Recreate / Save As / Cancel.
- **SAVE-09** Repeated Save operations are stable, update the file mtime, preserve UTF-8 content, and never corrupt the file; a round-trip open→save produces a parseable workbook with identical data.
- **SAVE-10** A successful Save or Save As updates recents, the last-path state, the window title, the dirty indicator, and clears the recovery snapshot.
- **SAVE-11** The serialized format is identical to the existing `serializeWorkbook` output: UTF-8, no BOM, two-space pretty-printed JSON, trailing newline allowed.
- **SAVE-12** Saving the 10 MB fixture completes within 2 seconds on the reference machine.
- **SAVE-13** Web Save/Save As behavior is unchanged and continues to pass existing tests.
- **SAVE-14** Export commands use a native Save dialog on desktop; cancelling writes nothing and marks nothing clean.

### 2.5 Dirty state, recovery, and session restore

- **REC-01** On desktop, a debounced recovery snapshot (≤ 500 ms after the last change, maximum 2 writes per second) is written atomically to the user-data directory while the document is dirty. It never writes to the user's document, and a clean document has no recovery snapshot.
- **REC-02** The recovery record contains schema version, workbook payload, document path (if any), display name, timestamp, and the app version; it is stored as a single JSON file.
- **REC-03** After an unclean exit (crash, forced kill, power loss), the next cold start detects the recovery record and shows a native dialog titled "Recover unsaved changes?" that includes the snapshot time, with Recover and Discard actions.
- **REC-04** After a clean exit, the recovery record is deleted and the app reopens the last document path when "Reopen last document" is enabled (default on); otherwise it opens a blank workbook.
- **REC-05** Choosing Recover loads the recovered workbook, marks it dirty, titles it `Budget (Recovered)`, and keeps the original path only if that file still exists.
- **REC-06** Choosing Discard deletes the recovery record and opens the last document path or a blank workbook.
- **REC-07** An explicit open intent (command line, Open With, picker, recent, drag-drop) takes precedence over recovery restore. Recovery is preserved and offered through a non-modal status-bar banner and `File → Recover Unsaved Changes`.
- **REC-08** Recovery is never applied over a document the user explicitly opened without an explicit Recover action.
- **REC-09** Recovery is flushed on quit when possible; a failed flush shows a warning but does not block quitting.
- **REC-10** Recovery payloads larger than 100 MB are skipped with a status warning; the app remains usable.
- **REC-11** On first desktop run, legacy same-origin `localStorage` keys `simplesheets:mru` and `simplesheets:autosave` are imported once into the main-process state (MRU entries without a path are marked non-reopenable). The keys are deleted only after the state file is written successfully.
- **REC-12** Browser-origin data is not imported. The About/Help text documents the manual path: save `.ssjson` in the web edition, then open it in the desktop edition.
- **REC-13** A corrupt recovery record is ignored and deleted with a logged reason; startup continues without a crash.
- **REC-14** A successful Save or Save As deletes the recovery record; a subsequent clean exit has nothing to recover.
- **REC-15** If the last document path no longer exists on startup, the app opens a blank workbook, shows a status message, and removes the stale entry from recents.
- **REC-16** Recovery write failures (disk full, permission denied) are surfaced in the status bar without throwing, blocking editing, or losing in-memory work.

### 2.6 Recent files

- **MRU-01** The main process owns the recent-files list, capped at 10 entries, keyed by normalized absolute path (case-insensitive on Windows).
- **MRU-02** Opening or saving a file upserts it at the top of the list with name, size, and timestamp.
- **MRU-03** `File → Recent` in the native menu and the existing in-app Recent UI show the same entries in the same order.
- **MRU-04** Clicking a recent entry opens it. A missing file shows Remove from list / Locate… / Keep.
- **MRU-05** Removing one entry or clearing all entries updates both the native menu and the in-app UI immediately.
- **MRU-06** Recents store paths and metadata only; no workbook contents, thumbnails, or previews.
- **MRU-07** The web edition continues to use `localStorage` recents with no behavior change.

### 2.7 Menus, shortcuts, and window actions

- **MENU-01** The native menu contains: File (New, Open, Recent, Recover Unsaved Changes, Save, Save As, Import, Export, Exit), Edit (Undo, Redo, Cut, Copy, Paste, Paste Special, Select All, Find & Replace), View (Toggle Full Screen, Reload in development only), Help (Manual, Keyboard Shortcuts, About, Open Data Folder).
- **MENU-02** Every native menu item routes through the desktop adapter as a menu action to the existing renderer handler. No menu action reimplements application logic.
- **MENU-03** Native accelerators are registered for New, Open, Save, Save As, Undo, Redo, Find & Replace, and Quit.
- **MENU-04** When `capabilities.nativeMenu` is true, the renderer global key handler ignores the same combinations so each key press triggers exactly one action. An automated test enumerates every native accelerator and asserts the renderer does not handle it in desktop mode.
- **MENU-05** The main process updates menu enabled state from renderer state: Undo/Redo disabled when unavailable, Save/Save As enabled when a document exists, Recover disabled when no recovery exists.
- **MENU-06** Closing the window (`Alt+F4`, title-bar close, File → Exit) runs the dirty-state prompt; Cancel aborts the close.
- **MENU-07** External links (Manual, SimpleDocs, project links) open in the default browser through the adapter after validating the scheme; no Electron window navigates away.
- **MENU-08** The existing in-app MenuBar remains available in both editions and continues to pass its tests.
- **MENU-09** No native menu item performs a destructive action without the existing confirmation flow.
- **MENU-10** The menu can be reopened and used after a modal dialog closes; no action is swallowed by a stale modal state.

### 2.8 Import, export, and sharing

- **IO-01** Export Excel, CSV, and JSON show a native Save dialog on desktop, write the generated file, and report success or failure in the status bar.
- **IO-02** Export PDF generates the existing PDF and writes it to a path chosen in a native Save dialog.
- **IO-03** Import from the native menu uses a native Open dialog and then the existing Import Scope dialog.
- **IO-04** Export and Save are distinct: exporting never changes the current path, title, or clean state.
- **IO-05** `Copy Link` in the desktop edition encodes the document against the public web base URL (`https://simplesheets.mouseclick.au/`), not `app://`, and copies it to the clipboard. The About/Help text warns that shared links contain the full workbook in the URL fragment.
- **IO-06** PDF export output includes the current in-memory workbook state, including unsaved changes.
- **IO-07** The web edition's download behavior is unchanged and existing export tests pass.
- **IO-08** Failed exports (permission, disk full, cancel) leave the workbook untouched and show an actionable message.
- **IO-09** The desktop app does not register a URL protocol. Shared `#doc=` links open in the default browser and are not imported into the desktop app.
- **IO-10** Cloud/account entry points ("Share to Cloud", cloud open/save options) are hidden or clearly marked unavailable in the desktop edition; desktop File → Save/Open never opens the cloud modal.
- **IO-11** `Share → Share File` in the desktop edition writes a copy through the native Save dialog; it does not trigger a silent browser download.

### 2.9 Packaging, installation, and identity

- **PKG-01** Fixed identity: product name `SimpleSheets`, `appId` `au.mouseclick.simplesheets`, executable `SimpleSheets.exe`, data directory `%APPDATA%\SimpleSheets`, version taken from `package.json` (`0.1.0` for the first build; do not bump without approval).
- **PKG-02** `npm run electron:build` produces an NSIS per-user installer and a portable executable. The installer does not require elevation, upgrades an existing installation in place, and preserves the `.ssjson` association and user data across upgrades.
- **PKG-03** The portable edition detects itself via `PORTABLE_EXECUTABLE_DIR`, exposes that in About, uses the same `%APPDATA%\SimpleSheets` data directory, and does not attempt file association or self-update.
- **PKG-04** The installed edition registers the `.ssjson` file association and "Open with" handler without forcing itself as the default handler; Windows may still ask the user. The portable edition does not register associations.
- **PKG-05** Builds are unsigned. About and README state that Windows SmartScreen or elevation prompts may appear and that no code-signing certificate is included.
- **PKG-06** No update mechanism or update dependency is included, and the app performs no network update checks.
- **PKG-07** A multi-resolution `build/icon.ico` (16–256 px) and a 512 px `build/icon.png` are generated from the existing favicon artwork; the window, taskbar, installer, and About use them.
- **PKG-08** Build artifacts are written to `release/` and ignored by git; no large binaries are committed.
- **PKG-09** ASAR packaging is enabled; the renderer loads correctly from inside the ASAR archive, including all JS, CSS, and image assets.
- **PKG-10** Uninstall removes the application, shortcuts, and the `.ssjson` association but preserves `%APPDATA%\SimpleSheets`; this is documented in the README.
- **PKG-11** The build is reproducible locally from a clean `npm ci` on this machine.
- **PKG-12** No publish/release configuration or CI release job is added without explicit approval; the existing web CI and Pages deploy are unchanged.
- **PKG-13** Running the NSIS installer on this machine (which changes registry/file associations) requires explicit approval; otherwise installation and association verification are marked *unverified-environment* with a manual checklist.

### 2.10 About and diagnostics

- **ABT-01** About shows the app version, build timestamp, git commit (reusing the existing Vite defines), and edition (development/installed/portable).
- **ABT-02** About shows Electron, Chromium, and Node versions.
- **ABT-03** About has an "Open Data Folder" action that opens `%APPDATA%\SimpleSheets` (or the profile override) in Explorer.
- **ABT-04** About has a "Copy Diagnostics" action that copies versions, edition, build info, and data paths to the clipboard; it never includes workbook contents, file names, or recent paths.
- **ABT-05** License and third-party notices are reachable from About.
- **ABT-06** There are no "Check for updates" controls anywhere in the UI.
- **ABT-07** About offers "Reset Application Data…" with a confirmation. It clears recents, recovery, window state, and desktop preferences; it never modifies or deletes user documents.

### 2.11 Security and privacy

- **SEC-01** `BrowserWindow` uses `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `nodeIntegrationInWorker: false`, `webviewTag: false`, and `webSecurity: true`.
- **SEC-02** The preload exposes a frozen `window.simplesheetsDesktop` API through `contextBridge`; `ipcRenderer`, `require`, `process`, and Node primitives are not exposed.
- **SEC-03** Every `ipcMain` handler verifies the sender frame URL matches the trusted app origin (`app://simplesheets` or the development `http://localhost:3000` URL) and rejects requests from any other frame.
- **SEC-04** Every IPC payload is schema-validated (types, string lengths, known fields) and unknown channels or fields are rejected. Errors are returned as typed failures, not stack traces.
- **SEC-05** Renderer-supplied write paths are restricted to an allowlist: the current document path and paths returned by native dialogs in this session. All paths are resolved to absolute paths before comparison.
- **SEC-06** Renderer read requests are restricted to paths returned by native dialogs, command-line/association intents, the current document, and recent entries. Arbitrary filesystem reads are rejected.
- **SEC-07** The packaged app serves a strict Content-Security-Policy header: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. `'unsafe-inline'` is allowed for styles only and justified in `DECISIONS.md`. No `'unsafe-eval'`.
- **SEC-08** Navigation to any non-app origin is blocked. `setWindowOpenHandler` denies all new windows. External `http`, `https`, and `mailto` URLs are opened through `shell.openExternal` only after a user action and scheme validation.
- **SEC-09** `setPermissionRequestHandler` and `setPermissionCheckHandler` deny all permission requests except `local-fonts` for the trusted top-level application frame (used only by the system-font picker). The app needs no camera, microphone, geolocation, notifications, clipboard-read, or MIDI permissions.
- **SEC-10** The `app://` protocol handler rejects path traversal, encoded traversal, null bytes, and paths outside `dist`; it serves only known MIME types.
- **SEC-11** Developer tools are disabled and `reload` menu items are absent in packaged builds.
- **SEC-12** No telemetry, analytics, crash reporting, or idle network traffic. Verify with an E2E network log over a 30-second idle window.
- **SEC-13** Workbook contents never leave the device. Recents and recovery are stored unencrypted in the user-data directory; About states this plainly.
- **SEC-14** Playwright E2E stubs native dialogs by evaluating code in the main process. If that is not possible, a test-only environment seam may be used only when `SIMPLESHEETS_E2E=1`; it must not bypass path validation and is documented in `DECISIONS.md`.
- **SEC-15** `shell.showItemInFolder` is the only shell path operation; no `shell.openPath` on user-supplied paths.
- **SEC-16** `window.open` calls in renderer code are routed through the adapter in desktop mode (including the SimpleDocs link), while the web edition keeps `window.open`.
- **SEC-17** Every existing import and export format (`.ssjson`, `.xlsx`, `.csv`, `.tsv`, PDF) works under the strict CSP without `'unsafe-eval'`. If a library requires eval, use its CSP-compatible mode or replace that code path; do not weaken the policy.
- **SEC-18** Path policy resolves real paths (`fs.realpath`) before allowlist comparison and refuses writes through symbolic links that resolve outside the selected directory.

### 2.12 Performance and resource management

- **PERF-01** Cold start from process launch to a usable grid is under 3 seconds on the reference machine.
- **PERF-02** Opening the 10 MB / 50,000-row fixture takes under 5 seconds and keeps the UI responsive (no single blocking task over 200 ms).
- **PERF-03** Saving the 10 MB fixture takes under 2 seconds.
- **PERF-04** Twenty open/close cycles show no more than 20% heap growth after garbage collection, and no growth in listener counts.
- **PERF-05** Recovery writes are debounced and never exceed 2 writes per second; no recovery write blocks the UI for more than 50 ms.
- **PERF-06** IPC listeners, object URLs, timers, and streams created by desktop code are removed on document close and window close.
- **PERF-07** The installer and portable artifacts are measured and reported; the starting budgets are **150 MB compressed** and **350 MB unpacked** (revised after measuring Electron 45 on Windows; see `DECISIONS.md`).
- **PERF-08** Peak memory for the 10 MB workbook is measured and reported; the starting ceiling is 1.5 GB total across processes.
- **PERF-09** All measurements record machine specification, Electron/Chromium version, fixture path, and method in `DECISIONS.md`.

### 2.13 Pinned decisions for risk areas

**A. File lifecycle and precedence**

- **Approach:** A pure intent resolver in `src/platform/desktop/core/openIntentMachine.ts` with ordered intents and generation tokens. Main process owns document state (`path`, `mtimeMs`, `size`); renderer owns workbook and dirty state. Every load carries a monotonically increasing token; stale async results are discarded.
- **Unit-test first:** `resolveOpenIntent(state, intent)` and `shouldDiscardResult(token, currentToken)` with tests for cold start, argv, second instance, picker, recent, drag-drop, recovery, cancel, and interleaved intents.
- **Failure mode prevented:** an old file load completing after a newer open, recovery overwriting an explicitly opened file, and a cancelled open replacing the document.

**B. Native ↔ renderer bridge**

- **Approach:** Narrow, typed IPC contract in `src/platform/desktop/contract.ts`; schema validation in `electron/ipc/validate.ts`; sender-origin check on every handler; path allowlist in `electron/ipc/pathPolicy.ts`. The preload exposes one frozen object and no generic `invoke`.
- **Unit-test first:** `validatePayload`, `isTrustedSender`, `resolveAllowedPath`, and the read/write policy tables.
- **Failure mode prevented:** arbitrary file read/write from a compromised renderer, and IPC calls from injected iframes or external content.

**C. Packaged-build correctness**

- **Approach:** The renderer is built with `ELECTRON_BUILD=1` and `base: './'`, served from `app://simplesheets` by a protocol handler that reads from the ASAR. M1 includes an `electron-builder --dir` packaged smoke test, not just dev mode.
- **Unit-test first:** `resolveAssetPath(url)` for `/`, `/index.html`, `/assets/...`, encoded traversal, and unknown extensions.
- **Failure mode prevented:** blank window or missing assets in the installer while dev works.

**D. Atomic save and conflict handling**

- **Approach:** Pure `planSave(targetStat, lastKnownStat, currentPath)` returns `{ action: 'write' | 'prompt-overwrite' | 'prompt-recreate' | 'prompt-save-as' | 'error', code }`. The main process executes temp+rename with retry and cleanup.
- **Unit-test first:** `planSave` and `atomicWrite` (with an injected filesystem).
- **Failure mode prevented:** truncated documents on disk, lost work on a failed write, and silent overwrites of externally modified files.

**E. Shortcut duplication**

- **Approach:** One owner per shortcut. Native menu owns New/Open/Save/Save As/Undo/Redo/Find/Quit on desktop; the renderer global handler returns early for those combinations when `capabilities.nativeMenu` is true. The list lives in `src/platform/desktop/core/shortcutOwner.ts` and is the single source of truth.
- **Unit-test first:** `isNativeShortcut(event)` with every accelerator and negative cases (Ctrl+Shift+F, Ctrl+Shift+V, Ctrl+`).
- **Failure mode prevented:** Ctrl+S saving twice or Save As triggering an extra prompt.

### 2.14 Persistence map and open/restore state machine

| Data | Location | Written by | Reason |
| --- | --- | --- | --- |
| Recents (path, name, size, timestamp) | `%APPDATA%\SimpleSheets\state.json` | Main, atomic | Must survive renderer storage failure; paths are a main-process concern |
| Window bounds, last path, last directory, flags | `%APPDATA%\SimpleSheets\state.json` | Main, atomic | Needed before the renderer exists |
| Recovery snapshot + metadata | `%APPDATA%\SimpleSheets\recovery.json` | Main, atomic, debounced | Crash protection independent of the renderer |
| Preferences (reference format, chart settings, print setup) | Existing `localStorage` under `app://simplesheets` | Renderer | Existing behavior; stable origin keeps them across upgrades |
| Web MRU/autosave | Browser `localStorage` | Web edition only | Unchanged web behavior |
| Document contents | User-chosen `.ssjson` path | Main, atomic | The user's file is the source of truth |

`state.json` and `recovery.json` include `schemaVersion: 1`. Unknown newer versions are ignored with a logged warning. Corrupt files are renamed with a `.corrupt` suffix plus the epoch-millisecond timestamp and replaced; the app still starts.

**Startup state machine**

States: `BOOT → RECOVERY_DECISION? → LOADING → READY`.

Intents carry `{ kind, seq, path? }` where `kind` is `argv`, `open-with`, `second-instance`, `picker`, `recent`, `drag-drop`, or `restore`.

1. On cold start, set `cleanExit = false` and read `state.json` and `recovery.json`.
2. If an explicit intent exists (argv/open-with) and its path is valid, load it; do not prompt for recovery. If recovery exists, show the non-modal "Unsaved changes from previous session — Recover" banner.
3. Else, if recovery exists and the previous exit was unclean, ask Recover / Discard. Recover loads the snapshot as dirty; Discard deletes it.
4. Else, open `lastPath` if it exists and "Reopen last document" is enabled; otherwise open a blank workbook.
5. Any new explicit intent increments `seq`; results with an older token are discarded.
6. A dirty document replacement always goes through Save / Don't Save / Cancel. Cancel drops the intent and keeps the current document.
7. On clean quit, write `cleanExit = true`, flush recovery, and delete the recovery record.

**Recovery vs autosave:** recovery is a crash safety net, not a save. It never marks the document clean and never writes to the user's file. The web edition's `localStorage` autosave remains unchanged.

### 2.15 Save, export, and undo semantics

- **Save:** write current path atomically; if no path, Save As.
- **Save As:** native dialog, then atomic write, update path/title/recents, mark clean.
- **Export (Excel/CSV/JSON/PDF):** native dialog, write a new file, do not change document path, title, or clean state.
- **Save a Copy:** not added; Save As covers the workflow. Recorded as a non-goal.
- **Undo/redo:** unchanged. Saving does not clear history; undo after save makes the document dirty. Opening a new document resets history as today.
- **Dirty state:** reference-inequality against the last clean/open/save snapshot, as today, reported to main over IPC for the close prompt.
- **Close/quit:** native Save / Don't Save / Cancel prompt on every path, including `Alt+F4`, `File → Exit`, OS shutdown best-effort, and any future update restart (none today).
- **Failure:** a failed save leaves the document dirty and the original file intact.

### 2.16 Updates and network activity

- No auto-update, no update checks, no crash reporting, no telemetry.
- The only network activity is user-initiated: opening an external link in the default browser and loading the local Vite dev server in development.
- The packaged app makes zero network requests; E2E asserts this over an idle window.
- A future updater would require a separate specification and explicit approval.

### 2.17 Security and privacy design

- Trusted content only: the renderer origin is `app://simplesheets` (packaged) or the loopback Vite URL (development). No remote content, iframes, or `webview`.
- The preload is the only bridge. It exposes a fixed set of functions, each mapping to one validated IPC channel.
- The main process owns all filesystem access, path policy, recents, recovery, window state, and the native menu.
- The read/write path allowlist is maintained per session. Dialog-returned paths enter the allowlist; no renderer string alone can add a path.
- File contents crossing IPC are `Uint8Array` payloads with a 100 MB per-message ceiling; larger files are rejected with an actionable message (documented limit; fixtures stay below it).
- Recovery and recents are unencrypted and disclosed. No workbook data is included in diagnostics.
- External links require a user gesture and an allowed scheme. `Copy Link` is explicit user action and warns that the URL contains document data.

### 2.18 Performance and resource design

- Recovery writes are coalesced main-side: the renderer sends the latest snapshot at most once per 500 ms; the main process keeps only the newest pending write.
- File reads happen in the main process; parsing stays in the renderer with the existing pipeline. If a parse exceeds 200 ms, yield between sheets or rows.
- No polling loops. Window state is written on close, not on every move.
- The 20-cycle leak test opens, edits, saves to a temp file, closes, and reopens while recording `webContents.getProcessMemoryInfo()` and heap snapshots.
- All measurements are recorded with method and machine details.

---

## 3. Build Process

### 3.1 Milestones and exit gates

| # | Milestone | Exit gate (all must pass, then commit) |
| --- | --- | --- |
| M0 | Environment audit, Electron scaffold, `app://` origin, adapter skeleton, working files, fixtures, icon, verify scripts | Dev window loads the existing app; `npm run verify` passes; `DECISIONS.md` lists unverifiable items |
| M1 | Open end-to-end: native dialog, argv, single instance, drag-drop path, error states; packaged `--dir` smoke test | Fixture opens via picker and argv in dev **and** packaged; corrupt/missing files handled; exactly one load per intent |
| M2 | Save/Save As, atomic writes, conflict prompts, dirty/close prompts, exports via native dialog | Round-trip stable; read-only/locked/external-change fixtures behave; original intact on simulated failure |
| M3 | Recents, recovery, session restore, intent state machine, legacy `localStorage` migration | Restart matrix passes: clean/unclean exit, Recover/Discard, explicit-beats-recovery, missing recent |
| M4 | Native menu, accelerator ownership, window state, About/diagnostics, Copy Link fix | One action per accelerator; menu enable states correct; window bounds restore safely |
| M5 | File association, Windows integration, NSIS installer + portable build (build only) | Artifacts produced; association config inspected; install/run marked unverified unless approved |
| M6 | Security hardening: CSP, IPC validation, path policy, navigation/permission blocking | Negative tests for traversal/forged sender/window-open pass; packaged console has zero CSP violations; idle network is empty |
| M7 | Performance, leak test, packaging polish, uninstall behavior, README/MANUAL updates | Budgets measured; 20-cycle leak test passes; install/uninstall manual checklist produced |
| M8 | Final evidence report and manual test checklist | Every requirement ID tagged per section 3.3; report delivered |

**Requirement ownership by milestone**

| Area | Primary milestones |
| --- | --- |
| PLAT | M0, M1, M4 |
| APP | M0, M1, M4, M6 |
| OPEN | M1, M3, M6 |
| SAVE | M2, M6 |
| REC | M3 |
| MRU | M3, M4 |
| MENU | M4 |
| IO | M2, M4 |
| PKG | M0, M5, M7 |
| ABT | M4, M7 |
| SEC | M0, M1, M6 |
| PERF | M2, M7 |

### 3.2 Environment fallbacks

The build runs on Windows, so Electron, NSIS, and portable builds can be produced and exercised locally. The following are still expected to be **unverified-environment**: code signing and SmartScreen reputation, clean-machine install and upgrade, Windows 11 "Open with" presentation, and association behavior inside uninstall/reinstall cycles. Provide a manual checklist for each. If the renderer environment cannot launch Electron (no interactive desktop), run unit tests and packaged smoke checks headlessly where possible and mark all window-dependent requirements unverified.

### 3.3 Evidence levels (final report)

Tag **every** requirement ID in this specification with exactly one of:

- **automated-pass**: an automated test covers it and passes.
- **manual-pass**: verified by a documented manual procedure.
- **unverified-environment**: could not be verified here; manual checklist provided.
- **failed**: tested and not working; cause and next step noted.

The final report is a table with columns: ID, evidence level, test/procedure reference, notes.

---

## 4. Validation, Testing, and Performance

### 4.1 Fixtures (generated by script, dev-only, never shipped)

- Small workbook: 100 rows × 10 columns, formulas, styles, named ranges.
- 10 MB workbook: 50,000 rows × 20 columns, mixed types and formulas.
- Workbook with extensions: project-WBS data and Creator Canvas payload.
- Workbook with a non-ASCII title and non-Latin cell text.
- Corrupt `.ssjson` (truncated JSON).
- Empty file and wrong-extension file.
- Read-only file and a file locked by an open handle.
- `.xlsx` (5,000 rows) and `.csv` (20 MB) for import paths.
- Recovery record with and without a valid path, plus a corrupt recovery record.
- Legacy `localStorage` MRU and autosave payloads for migration tests.

Fixtures are created by `scripts/generate-desktop-fixtures.mjs` into `tmp/desktop-fixtures/` and are gitignored.

### 4.2 Tooling

- Jest for pure desktop logic in `src/platform/desktop/core/`: intent machine, save planner, atomic-write planner, path policy, shortcut ownership, state schema, asset path resolver, migration. Do not add coverage-ignore comments; exclude `electron/` (thin I/O layer) from coverage in `jest.config.cjs` and justify it in `DECISIONS.md`. New pure modules must meet ≥ 95% line and ≥ 85% branch coverage.
- Playwright `_electron` for E2E, using `SIMPLESHEETS_PROFILE` pointing at a temp directory. Stub native dialogs from the main process via `electronApp.evaluate`; do not add production test branches unless unavoidable.
- A packaged smoke script (`scripts/desktop-smoke.mjs`) that launches the packaged app with a fixture path and asserts the window title and a rendered grid marker.
- No real user data; no network-dependent tests.

### 4.3 Behaviors to verify

- Cold start, dev start, packaged start, portable detection.
- Open via picker, argv, second instance, association, drag-drop; cancel; corrupt/missing/wrong extension.
- Save in place, Save As, cancel, read-only, locked, externally modified, deleted target; repeated saves; round-trip equality.
- Dirty prompt on open, close, quit, and `Alt+F4`; Cancel aborts.
- Recovery after simulated unclean exit; Recover and Discard; explicit-open precedence; recovery over 100 MB; corrupt recovery.
- Clean-exit reopen of last path; missing last path; "Reopen last document" off.
- Recents add/upsert/remove/clear; missing recent options; native and in-app parity.
- Native menu actions and enable states; accelerator single-fire; external link handling.
- Exports via native dialogs, cancel, disk error; Copy Link base URL.
- Window bounds restoration on one display and with a removed display.
- CSP violations zero; navigation and window-open blocked; permission requests denied; idle network empty.
- 20 open/close cycles, 10 MB open/save, cold start timings.
- About content, Open Data Folder, Copy Diagnostics (no workbook data).
- Web regression: `npm run build`, existing Jest suite, Pages build assumptions.

### 4.4 Performance budgets and harness

Reference machine: this Windows machine (record exact CPU/RAM in `DECISIONS.md`). Starting budgets, adjustable only with justification:

| Metric | Budget | Method |
| --- | --- | --- |
| Cold start to usable grid | < 3 s | Main-process `performance.now()` from launch to renderer `ready` IPC; 10 runs, median |
| Open 10 MB / 50k rows | < 5 s | IPC timestamp before read to renderer `document-loaded` |
| Save 10 MB | < 2 s | IPC timestamp to write completion |
| Recovery write | ≤ 2/s, < 50 ms each | Main-process write log |
| Heap growth over 20 cycles | < 20% after GC | `getProcessMemoryInfo` + heap snapshots; launch E2E with `--js-flags=--expose-gc` and force GC before each sample |
| Installed size | Installer ≤ 150 MB; unpacked ≤ 350 MB | Measure `release/win-unpacked` and installer |
| Peak memory (10 MB workbook) | ≤ 1.5 GB | Sum of process working sets after open and scroll |
| Idle network requests | 0 over 30 s | Playwright/CDP network log |

---

## 5. Final Deliverables

1. Working source with `npm run electron:dev`, `npm run verify`, `npm run verify:e2e`, `npm run electron:build`, and `npm run electron:build:dir`.
2. NSIS installer and portable executable in `release/` (or an explicit *unverified-environment* note if the environment cannot build them).
3. `docs/desktop/DECISIONS.md`, `docs/desktop/PROGRESS.md`, `docs/desktop/CAPABILITY_MATRIX.md`.
4. Updated `README.md` and `MANUAL.md` sections covering the desktop edition, data locations, SmartScreen, uninstall behavior, and the web→desktop document path.
5. A final evidence report tagging every requirement ID per section 3.3, with performance measurements and a manual-test checklist for anything unverified.
6. Nothing published, installed for system-wide use, or released without explicit authorization.
