// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * SimpleSheets Desktop — Electron main process.
 *
 * Owns the window, the `app://` protocol, IPC validation, single-instance
 * behavior, and (from later milestones) file dialogs, recovery, and the native
 * menu. Renderer code never gets direct filesystem or Node access.
 */

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  protocol,
  session,
  shell,
  type IpcMainInvokeEvent,
} from 'electron';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  APP_ORIGIN,
  DEV_ORIGIN,
  isAllowedExternalUrl,
  isTrustedOrigin,
} from '../src/platform/desktop/core/appOrigin';
import { mimeTypeForPath, resolveAppAssetPath } from '../src/platform/desktop/core/assetPath';
import {
  MAX_OPEN_BYTES,
  isSupportedOpenPath,
  isWorkbookSavePath,
  type OpenRequest,
  type OpenRequestSource,
} from '../src/platform/desktop/core/openRequest';
import { OpenRequestQueue } from '../src/platform/desktop/core/openQueue';
import { DesktopStateStore, type RecentInput } from '../src/platform/desktop/core/desktopStateStore';
import { allowWritePath, isWritePathAllowed, registerSaveHandlers } from './saveHandlers';

const DEV_URL = 'http://localhost:3000';
const APP_URL = 'app://simplesheets/index.html';
const TRUSTED_ORIGINS = [APP_ORIGIN, DEV_ORIGIN] as const;

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
].join('; ');

let mainWindow: BrowserWindow | null = null;

/**
 * Playwright attaches to the packaged app's CDP endpoint shortly after launch.
 * With `devTools: false`, a window created before that connection can be
 * invisible to the debugger. This SEC-14 test seam delays window creation; it
 * is inert unless the E2E environment variable is set on a packaged build.
 */
const E2E_STARTUP_DELAY_MS =
  app.isPackaged && process.env.SIMPLESHEETS_E2E === '1' ? 5000 : 0;

const OPEN_FILTERS: Electron.FileFilter[] = [
  { name: 'SimpleSheets documents', extensions: ['ssjson', 'json'] },
  { name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'csv', 'tsv', 'txt'] },
  {
    name: 'All supported files',
    extensions: ['ssjson', 'json', 'xlsx', 'xls', 'csv', 'tsv', 'txt'],
  },
];

let nextOpenSeq = 1;
const openQueue = new OpenRequestQueue<OpenRequest>();
let stateStore!: DesktopStateStore;
let startupHadExplicitIntent = false;
let startupRestoreAttempted = false;

// Must run before app.ready so storage and fetch work on the custom origin.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

/**
 * Pin the application identity and user-data directory before Electron creates
 * any storage. `SIMPLESHEETS_PROFILE` keeps tests away from real user data.
 */
function configureUserData(): void {
  app.setName('SimpleSheets');

  const override = process.env.SIMPLESHEETS_PROFILE;
  const dataDir = override
    ? path.resolve(override)
    : path.join(app.getPath('appData'), 'SimpleSheets');

  fs.mkdirSync(dataDir, { recursive: true });
  app.setPath('userData', dataDir);
  stateStore = new DesktopStateStore(dataDir, app.getVersion());
}

/**
 * Resolve the current edition from Electron's environment.
 *
 * @returns `development`, `portable`, or `installed`.
 */
function getEdition(): 'development' | 'installed' | 'portable' {
  if (!app.isPackaged) return 'development';
  if (process.env.PORTABLE_EXECUTABLE_DIR) return 'portable';
  return 'installed';
}

/**
 * Build the payload returned to the renderer's About/Diagnostics UI.
 *
 * @returns Version, edition, runtime versions, and the data directory.
 */
function getAppInfo(): {
  name: string;
  version: string;
  edition: 'development' | 'installed' | 'portable';
  platform: string;
  electron: string;
  chromium: string;
  node: string;
  dataDir: string;
  buildTimestamp: string;
  gitCommit: string;
} {
  return {
    name: 'SimpleSheets',
    version: app.getVersion(),
    edition: getEdition(),
    platform: process.platform,
    electron: process.versions.electron ?? '',
    chromium: process.versions.chrome ?? '',
    node: process.versions.node,
    dataDir: app.getPath('userData'),
    buildTimestamp: process.env.BUILD_TIMESTAMP ?? '',
    gitCommit: process.env.GIT_COMMIT_HASH ?? '',
  };
}

/**
 * Reject IPC calls that did not come from the trusted renderer origin.
 *
 * @param event - The IPC invocation event.
 * @throws Error when the sender frame is missing or untrusted.
 */
function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url ?? '';
  if (!isTrustedOrigin(senderUrl, TRUSTED_ORIGINS)) {
    throw new Error('Rejected IPC call from an untrusted frame.');
  }
}

interface OpenFailure {
  ok: false;
  code: string;
  message: string;
}

interface OpenQueued {
  ok: true;
  seq: number;
}

/**
 * Read and validate a file before turning it into an open intent.
 *
 * @param rawPath - Path supplied by a dialog, command line, or drop.
 * @param source - Where the intent came from.
 * @returns A queued intent or a typed failure.
 */
async function readOpenRequest(
  rawPath: string,
  source: OpenRequestSource,
): Promise<OpenQueued | OpenFailure> {
  if (typeof rawPath !== 'string' || rawPath.length === 0) {
    return { ok: false, code: 'INVALID_PATH', message: 'No file path was provided.' };
  }

  const resolved = path.resolve(rawPath);
  if (!isSupportedOpenPath(resolved)) {
    return {
      ok: false,
      code: 'UNSUPPORTED',
      message: 'Only .ssjson, .json, .xlsx, .xls, .csv, .tsv, and .txt files can be opened.',
    };
  }

  try {
    const realPath = await fsp.realpath(resolved);
    const stat = await fsp.stat(realPath);
    if (!stat.isFile()) {
      return { ok: false, code: 'NOT_A_FILE', message: 'The selected path is not a file.' };
    }
    if (stat.size > MAX_OPEN_BYTES) {
      return {
        ok: false,
        code: 'TOO_LARGE',
        message: `The file is larger than the ${Math.round(MAX_OPEN_BYTES / (1024 * 1024))} MB open limit.`,
      };
    }

    const buffer = await fsp.readFile(realPath);
    const data = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;

    const request: OpenRequest = {
      seq: nextOpenSeq,
      source,
      path: realPath,
      name: path.basename(realPath),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      data,
    };
    nextOpenSeq += 1;

    if (isWorkbookSavePath(realPath)) allowWritePath(realPath);
    stateStore.setLastPath(realPath);

    // A newer explicit intent supersedes queued (not active) intents. Restore
    // and recovery loads must not clear explicit work.
    if (source !== 'recent') openQueue.clearPending();
    openQueue.enqueue(request);
    pumpOpenRequests();
    return { ok: true, seq: request.seq };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return { ok: false, code: 'MISSING', message: 'The file no longer exists.' };
    }
    if (code === 'EACCES' || code === 'EPERM') {
      return { ok: false, code: 'PERMISSION', message: 'Permission was denied while reading the file.' };
    }
    if (code === 'EBUSY') {
      return { ok: false, code: 'IN_USE', message: 'The file is being used by another program.' };
    }
    return {
      ok: false,
      code: 'READ_FAILED',
      message: error instanceof Error ? error.message : 'The file could not be read.',
    };
  }
}

/**
 * Deliver the next queued open intent when the renderer is ready and no
 * previous intent is still being processed.
 */
function pumpOpenRequests(): void {
  const next = openQueue.takeNext();
  if (!next) return;

  const window = mainWindow;
  if (!window || window.isDestroyed()) {
    openQueue.resetActive();
    return;
  }

  window.webContents.send('open:request', next);
}

/**
 * Mark an intent as handled so the next one can be delivered.
 *
 * @param seq - Sequence number acknowledged by the renderer.
 * @returns True when the sequence matched the active intent.
 */
function acknowledgeOpenRequest(seq: number): boolean {
  const acknowledged = openQueue.ack(seq);
  if (acknowledged) pumpOpenRequests();
  return acknowledged;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseRecentInput(value: unknown): RecentInput | null {
  if (!isRecord(value)) return null;
  if (typeof value.name !== 'string' || value.name.length === 0 || value.name.length > 260) return null;
  if (typeof value.size !== 'number' || !Number.isFinite(value.size)) return null;
  if (value.source !== 'local' && value.source !== 'cloud' && value.source !== 'url') return null;
  if (value.path !== undefined) {
    if (typeof value.path !== 'string') return null;
    if (
      value.source === 'local' &&
      (!path.isAbsolute(value.path) || !isSupportedOpenPath(value.path) || !fs.existsSync(value.path))
    ) {
      return null;
    }
  }
  if (value.handleId !== undefined && typeof value.handleId !== 'string') return null;
  if (value.provider !== undefined && typeof value.provider !== 'string') return null;
  if (value.cloudFileId !== undefined && typeof value.cloudFileId !== 'string') return null;
  if (value.canReopen !== undefined && typeof value.canReopen !== 'boolean') return null;
  return {
    id: typeof value.id === 'string' ? value.id : undefined,
    name: value.name,
    size: value.size,
    timestamp: typeof value.timestamp === 'number' ? value.timestamp : undefined,
    source: value.source,
    path: typeof value.path === 'string' ? value.path : undefined,
    handleId: typeof value.handleId === 'string' ? value.handleId : undefined,
    provider: typeof value.provider === 'string' ? value.provider : undefined,
    cloudFileId: typeof value.cloudFileId === 'string' ? value.cloudFileId : undefined,
    canReopen: typeof value.canReopen === 'boolean' ? value.canReopen : undefined,
  };
}

/** Reopen the last document when enabled and still present. */
async function restoreLastDocument(): Promise<void> {
  const state = stateStore.getState();
  if (!state.reopenLast || !state.lastPath) return;
  const lastPath = state.lastPath;
  if (!fs.existsSync(lastPath)) {
    stateStore.setLastPath(null);
    return;
  }
  const result = await readOpenRequest(lastPath, 'recent');
  if (!result.ok && result.code === 'MISSING') stateStore.setLastPath(null);
}

/** Explicit intent wins, then recovery, then the last document. */
async function restoreStartupDocument(): Promise<void> {
  if (startupRestoreAttempted) return;
  startupRestoreAttempted = true;
  if (startupHadExplicitIntent) return;
  const info = stateStore.getStartupInfo(false);
  if (info.unclean && info.recovery) return;
  await restoreLastDocument();
}

/**
 * Parse a command line for supported file paths, ignoring flags and the app path.
 *
 * @param args - Arguments after the executable.
 * @returns Existing, supported absolute paths.
 */
function collectOpenPaths(args: readonly string[]): string[] {
  const paths: string[] = [];
  for (const arg of args) {
    if (!arg || arg.startsWith('-') || arg === '.') continue;
    const resolved = path.resolve(arg);
    if (!isSupportedOpenPath(resolved)) continue;
    if (!fs.existsSync(resolved)) {
      console.warn(`[desktop] ignoring missing open path: ${resolved}`);
      continue;
    }
    paths.push(resolved);
  }
  return paths;
}

/**
 * Read and queue paths in order. Sequential reads preserve the command-line
 * order even when file sizes differ.
 *
 * @param paths - Absolute paths to queue.
 * @param source - Intent source label for the renderer.
 */
async function queueOpenPaths(
  paths: readonly string[],
  source: OpenRequestSource,
): Promise<void> {
  for (const filePath of paths) {
    const result = await readOpenRequest(filePath, source);
    if (!result.ok) {
      console.warn(`[desktop] could not queue ${filePath}: ${result.message}`);
    }
  }
}

/**
 * Queue every supported file passed on the current process command line.
 *
 * @param source - Intent source label for the renderer.
 */
function queueCommandLineOpenPaths(source: OpenRequestSource): void {
  const args = process.argv.slice(app.isPackaged ? 1 : 2);
  const paths = collectOpenPaths(args);
  if (paths.length > 0) startupHadExplicitIntent = true;
  void queueOpenPaths(paths, source);
}

/**
 * Bring the existing window to the front.
 */
function focusMainWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/**
 * Build a response for a packaged renderer asset.
 *
 * @param method - The HTTP method (GET or HEAD).
 * @param filePath - Absolute asset path.
 * @param data - File contents.
 * @returns A Response with MIME type and security headers.
 */
function buildAssetResponse(
  method: string,
  filePath: string,
  data: Buffer,
): Response {
  const headers = new Headers({
    'Content-Type': mimeTypeForPath(filePath),
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cache-Control': filePath.endsWith('.html')
      ? 'no-cache'
      : 'public, max-age=3600',
  });

  return new Response(method === 'HEAD' ? null : new Uint8Array(data), {
    status: 200,
    headers,
  });
}

/**
 * Serve the packaged renderer from `app://simplesheets`.
 *
 * @param request - The protocol request.
 * @returns The asset response, or 403/404/405 for rejected requests.
 */
async function handleAppRequest(request: Request): Promise<Response> {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return new Response('Not found', { status: 404 });
  }

  if (url.protocol !== 'app:' || url.host !== 'simplesheets') {
    return new Response('Not found', { status: 404 });
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const distDir = path.join(app.getAppPath(), 'dist');
  const filePath = resolveAppAssetPath(request.url, distDir);
  if (!filePath) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const data = await fsp.readFile(filePath);
    return buildAssetResponse(request.method, filePath, data);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'EISDIR') {
      return new Response('Internal error', { status: 500 });
    }

    // Extensionless paths fall back to the SPA entry point.
    if (path.extname(url.pathname) === '') {
      const indexPath = resolveAppAssetPath(APP_URL, distDir);
      if (indexPath) {
        try {
          const indexData = await fsp.readFile(indexPath);
          return buildAssetResponse(request.method, indexPath, indexData);
        } catch {
          // Fall through to 404.
        }
      }
    }

    return new Response('Not found', { status: 404 });
  }
}

/**
 * Deny every permission request and check. The app needs no device access.
 */
function setupPermissions(): void {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
}

/**
 * Register IPC handlers. Every handler validates its sender first.
 */
function setupIpc(): void {
  ipcMain.handle('app:get-info', (event) => {
    assertTrustedSender(event);
    return getAppInfo();
  });

  ipcMain.handle('app:open-external', async (event, url: unknown) => {
    assertTrustedSender(event);
    if (typeof url !== 'string' || !isAllowedExternalUrl(url)) {
      return {
        ok: false,
        code: 'INVALID_ARGUMENT',
        message: 'Only http, https, and mailto links can be opened.',
      };
    }
    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle('app:reveal-data-folder', async (event) => {
    assertTrustedSender(event);
    const errorMessage = await shell.openPath(app.getPath('userData'));
    if (errorMessage) {
      return { ok: false, code: 'OPEN_FAILED', message: errorMessage };
    }
    return { ok: true };
  });

  ipcMain.handle('app:ping', (event) => {
    assertTrustedSender(event);
    return 'pong';
  });

  ipcMain.handle('open:pick', async (event) => {
    assertTrustedSender(event);
    const options: Electron.OpenDialogOptions = {
      title: 'Open',
      properties: ['openFile'],
      filters: OPEN_FILTERS,
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: true };
    }
    return readOpenRequest(result.filePaths[0], 'picker');
  });

  // Called only by the preload's openDroppedFile helper, which resolves the
  // path from a real File. The renderer cannot supply a path directly.
  ipcMain.handle('open:path', async (event, rawPath: unknown) => {
    assertTrustedSender(event);
    if (typeof rawPath !== 'string' || !path.isAbsolute(rawPath)) {
      return { ok: false, code: 'INVALID_PATH', message: 'A valid absolute file path is required.' };
    }
    return readOpenRequest(rawPath, 'drag-drop');
  });

  ipcMain.handle('open:recent', async (event, rawPath: unknown) => {
    assertTrustedSender(event);
    if (typeof rawPath !== 'string' || !path.isAbsolute(rawPath)) {
      return { ok: false, code: 'INVALID_PATH', message: 'A valid recent file path is required.' };
    }
    const key = process.platform === 'win32'
      ? path.resolve(rawPath).toLowerCase()
      : path.resolve(rawPath);
    const known = stateStore.getState().recents.some((entry) =>
      entry.path !== undefined && (
        process.platform === 'win32'
          ? path.resolve(entry.path).toLowerCase() === key
          : path.resolve(entry.path) === key
      ),
    );
    if (!known) {
      return { ok: false, code: 'NOT_ALLOWED', message: 'That path is not in the recent-file list.' };
    }
    return readOpenRequest(rawPath, 'recent');
  });

  ipcMain.handle('open:ack', (event, seq: unknown) => {
    assertTrustedSender(event);
    if (typeof seq !== 'number' || !Number.isInteger(seq)) {
      return { ok: false, code: 'INVALID_SEQ', message: 'A numeric sequence is required.' };
    }
    const acknowledged = acknowledgeOpenRequest(seq);
    return acknowledged
      ? { ok: true }
      : { ok: false, code: 'UNKNOWN_SEQ', message: 'No open request is waiting for that sequence.' };
  });

  ipcMain.handle('renderer:ready', (event) => {
    assertTrustedSender(event);
    openQueue.setReady(true);
    pumpOpenRequests();
    void restoreStartupDocument();
    return { ok: true };
  });

  ipcMain.handle('state:startup', (event) => {
    assertTrustedSender(event);
    return { ok: true, value: stateStore.getStartupInfo(startupHadExplicitIntent) };
  });

  ipcMain.handle('state:import-legacy', async (event, value: unknown) => {
    assertTrustedSender(event);
    if (!isRecord(value)) {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Invalid legacy import payload.' };
    }
    const mru = typeof value.mru === 'string' ? value.mru : null;
    const autosave = typeof value.autosave === 'string' ? value.autosave : null;
    return { ok: true, value: await stateStore.importLegacy(mru, autosave) };
  });

  ipcMain.handle('recents:list', (event) => {
    assertTrustedSender(event);
    return { ok: true, value: [...stateStore.getState().recents] };
  });

  ipcMain.handle('recents:upsert', (event, value: unknown) => {
    assertTrustedSender(event);
    const parsed = parseRecentInput(value);
    if (!parsed) {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Invalid recent-file entry.' };
    }
    return { ok: true, value: stateStore.upsertRecent(parsed) };
  });

  ipcMain.handle('recents:remove', (event, id: unknown) => {
    assertTrustedSender(event);
    if (typeof id !== 'string' || id.length === 0) {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'A recent-file id is required.' };
    }
    stateStore.removeRecent(id);
    return { ok: true };
  });

  ipcMain.handle('recents:clear', (event) => {
    assertTrustedSender(event);
    stateStore.clearRecents();
    return { ok: true };
  });

  ipcMain.handle('state:set-reopen-last', (event, value: unknown) => {
    assertTrustedSender(event);
    if (typeof value !== 'boolean') {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Expected a boolean preference.' };
    }
    stateStore.setReopenLast(value);
    return { ok: true };
  });

  ipcMain.handle('recovery:write', (event, value: unknown) => {
    assertTrustedSender(event);
    if (!isRecord(value)) {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Invalid recovery payload.' };
    }
    if (value.path !== null && typeof value.path !== 'string') {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Invalid recovery path.' };
    }
    if (typeof value.displayName !== 'string' || value.displayName.length > 260) {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Invalid recovery display name.' };
    }
    if (typeof value.path === 'string') {
      const key = process.platform === 'win32' ? path.resolve(value.path).toLowerCase() : path.resolve(value.path);
      const lastPath = stateStore.getState().lastPath;
      const lastKey = lastPath
        ? (process.platform === 'win32' ? path.resolve(lastPath).toLowerCase() : path.resolve(lastPath))
        : null;
      if (!path.isAbsolute(value.path) || (key !== lastKey && !isWritePathAllowed(value.path))) {
        return { ok: false, code: 'NOT_ALLOWED', message: 'That recovery path is not the current document.' };
      }
    }
    return stateStore.writeRecovery({
      workbook: value.workbook,
      path: value.path,
      displayName: value.displayName,
    });
  });

  ipcMain.handle('recovery:clear', async (event) => {
    assertTrustedSender(event);
    await stateStore.clearRecovery();
    return { ok: true };
  });

  ipcMain.handle('recovery:prompt', async (event) => {
    assertTrustedSender(event);
    const load = await stateStore.loadRecovery();
    if (!load) return { ok: true, action: 'none' };
    const options: Electron.MessageBoxOptions = {
      type: 'question',
      buttons: ['Recover', 'Discard'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      title: 'Recover unsaved changes?',
      message: `SimpleSheets found unsaved changes from ${new Date(load.timestamp).toLocaleString()}.`,
      detail: `Document: ${load.displayName}${load.path ? ` — ${load.path}` : ''}`,
    };
    const result = mainWindow
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options);
    if (result.response === 0) {
      if (load.pathExists && load.path && isWorkbookSavePath(load.path)) allowWritePath(load.path);
      await stateStore.clearRecovery();
      return { ok: true, action: 'recover', value: load };
    }
    await stateStore.clearRecovery();
    await restoreLastDocument();
    return { ok: true, action: 'discard' };
  });

  registerSaveHandlers({
    getWindow: () => mainWindow,
    assertTrustedSender,
    onSaved: (filePath) => {
      if (isWorkbookSavePath(filePath)) stateStore.setLastPath(filePath);
    },
  });
}

/**
 * Create the single application window.
 */
function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#ffffff',
    title: 'SimpleSheets',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webviewTag: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
      spellcheck: true,
    },
  });

  mainWindow = window;
  window.removeMenu();

  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });

  // A reload or navigation starts a new renderer; wait for its ready signal
  // before re-delivering the active intent.
  window.webContents.on('did-start-loading', () => {
    openQueue.setReady(false);
    openQueue.resetActive();
  });

  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[desktop] renderer failed to load (${code} ${description}): ${url}`);
  });

  if (app.isPackaged) {
    void window.loadURL(APP_URL).catch((error) => {
      console.error('[desktop] failed to load', error);
    });
  } else {
    void window.loadURL(DEV_URL);
  }
}

/**
 * Create the first window and queue any command-line file. The E2E delay is
 * applied only to packaged builds under the SEC-14 test seam.
 */
function startWindow(): void {
  const launch = (): void => {
    createWindow();
    queueCommandLineOpenPaths(app.isPackaged ? 'open-with' : 'argv');
  };

  if (E2E_STARTUP_DELAY_MS > 0) {
    setTimeout(launch, E2E_STARTUP_DELAY_MS);
  } else {
    launch();
  }
}

configureUserData();

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    if (!app.isPackaged) console.log('[desktop] second-instance argv:', commandLine);
    focusMainWindow();
    void queueOpenPaths(collectOpenPaths(commandLine.slice(1)), 'second-instance');
  });

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, url) => {
      if (!isTrustedOrigin(url, TRUSTED_ORIGINS)) event.preventDefault();
    });

    contents.setWindowOpenHandler(({ url }) => {
      if (isAllowedExternalUrl(url)) {
        void shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    contents.on('will-attach-webview', (event) => {
      event.preventDefault();
    });
  });

  app.whenReady().then(async () => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('au.mouseclick.simplesheets');
    }

    await stateStore.init();
    Menu.setApplicationMenu(null);
    protocol.handle('app', handleAppRequest);
    setupPermissions();
    setupIpc();
    startWindow();

    app.on('activate', () => {
      // Do not re-queue command-line paths when reopening on macOS.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }).catch((error: unknown) => {
    console.error('[desktop] failed to start:', error);
    app.quit();
  });

  let quitting = false;
  app.on('before-quit', (event) => {
    if (quitting) return;
    quitting = true;
    event.preventDefault();
    void stateStore.markCleanExit().finally(() => app.quit());
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
