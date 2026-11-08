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
  clipboard,
  dialog,
  ipcMain,
  Menu,
  protocol,
  screen,
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
import { resolveWindowBounds } from '../src/platform/desktop/core/windowBounds';
import { resolveEdition } from '../src/platform/desktop/core/edition';
import { hasOnlyKeys } from '../src/platform/desktop/core/ipcValidation';
import { NATIVE_SHORTCUTS, nativeShortcutAction } from '../src/platform/desktop/core/shortcutOwner';
import { allowWritePath, isWritePathAllowed, registerSaveHandlers } from './saveHandlers';

const DEV_URL = 'http://localhost:3000';
const APP_URL = 'app://simplesheets/index.html';
const TRUSTED_ORIGINS = (app.isPackaged ? [APP_ORIGIN] : [APP_ORIGIN, DEV_ORIGIN]) as readonly string[];

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
let allowWindowClose = false;
let rendererDirty = false;
let closePromptOpen = false;
let menuState = { canUndo: false, canRedo: false, saveEnabled: true };

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
  return resolveEdition(app.isPackaged, process.env.PORTABLE_EXECUTABLE_DIR);
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
  portableDir: string;
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
    portableDir: process.env.PORTABLE_EXECUTABLE_DIR ?? '',
    buildTimestamp: process.env.BUILD_TIMESTAMP ?? '',
    gitCommit: process.env.GIT_COMMIT_HASH ?? '',
  };
}

type UnsavedChoice = 'save' | 'discard' | 'cancel';

/**
 * Show the native Save / Don't Save / Cancel prompt.
 *
 * @param window - Parent window, if any.
 * @param message - User-facing question.
 * @returns The chosen action.
 */
async function showUnsavedDialog(
  window: BrowserWindow | null,
  message: string,
): Promise<UnsavedChoice> {
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
    title: 'Unsaved changes',
    message,
    detail: 'Your changes will be lost if you continue without saving.',
  };
  const result = window
    ? await dialog.showMessageBox(window, options)
    : await dialog.showMessageBox(options);
  if (result.response === 0) return 'save';
  if (result.response === 1) return 'discard';
  return 'cancel';
}

/**
 * Send a menu action to the existing renderer handler.
 *
 * @param action - Stable action id.
 */
function sendMenuAction(action: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('menu:action', action);
}

/**
 * Rebuild and install the native application menu from current state.
 */
function rebuildMenu(): void {
  const recentItems: Electron.MenuItemConstructorOptions[] = stateStore
    .getState()
    .recents
    .slice(0, 10)
    .map((entry, index) => ({
      id: `recent-${index}`,
      label: entry.name,
      click: () => sendMenuAction(
        entry.source === 'local' && entry.path
          ? `recent:${entry.path}`
          : `recent-id:${entry.id}`,
      ),
    }));
  if (recentItems.length > 0) {
    recentItems.push({ type: 'separator' });
  }
  recentItems.push({
    id: 'file-clear-recents',
    label: 'Clear Recent Files',
    click: () => sendMenuAction('file:clear-recents'),
  });

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { id: 'file-new', label: 'New', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('file:new') },
        { id: 'file-open', label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('file:open') },
        { id: 'file-recent', label: 'Recent', submenu: recentItems },
        { type: 'separator' },
        {
          id: 'file-recover',
          label: 'Recover Unsaved Changes',
          enabled: stateStore.getRecovery() !== null,
          click: () => sendMenuAction('file:recover'),
        },
        { type: 'separator' },
        {
          id: 'file-save',
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          enabled: menuState.saveEnabled,
          click: () => sendMenuAction('file:save'),
        },
        {
          id: 'file-save-as',
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          enabled: menuState.saveEnabled,
          click: () => sendMenuAction('file:save-as'),
        },
        { type: 'separator' },
        {
          id: 'file-import',
          label: 'Import',
          submenu: [
            { id: 'file-import-excel', label: 'Excel…', click: () => sendMenuAction('file:import-excel') },
            { id: 'file-import-csv', label: 'CSV…', click: () => sendMenuAction('file:import-csv') },
            { id: 'file-import-json', label: 'JSON / SimpleSheets…', click: () => sendMenuAction('file:import-json') },
          ],
        },
        {
          id: 'file-export',
          label: 'Export',
          submenu: [
            { id: 'file-export-excel', label: 'Excel…', click: () => sendMenuAction('file:export-excel') },
            { id: 'file-export-csv', label: 'CSV…', click: () => sendMenuAction('file:export-csv') },
            { id: 'file-export-json', label: 'JSON…', click: () => sendMenuAction('file:export-json') },
            { id: 'file-export-pdf', label: 'PDF…', click: () => sendMenuAction('file:export-pdf') },
          ],
        },
        { type: 'separator' },
        {
          id: 'file-share',
          label: 'Share',
          submenu: [
            { id: 'file-share-link', label: 'Copy Link', click: () => sendMenuAction('file:copy-link') },
            { id: 'file-share-file', label: 'Share File…', click: () => sendMenuAction('file:share-file') },
          ],
        },
        { type: 'separator' },
        {
          id: 'file-exit',
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => sendMenuAction('file:exit'),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          id: 'edit-undo',
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          enabled: menuState.canUndo,
          click: () => sendMenuAction('edit:undo'),
        },
        {
          id: 'edit-redo',
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          enabled: menuState.canRedo,
          click: () => sendMenuAction('edit:redo'),
        },
        { type: 'separator' },
        { id: 'edit-cut', label: 'Cut', click: () => sendMenuAction('edit:cut') },
        { id: 'edit-copy', label: 'Copy', click: () => sendMenuAction('edit:copy') },
        { id: 'edit-paste', label: 'Paste', click: () => sendMenuAction('edit:paste') },
        { id: 'edit-paste-special', label: 'Paste Special…', click: () => sendMenuAction('edit:paste-special') },
        { id: 'edit-select-all', label: 'Select All', click: () => sendMenuAction('edit:select-all') },
        { type: 'separator' },
        {
          id: 'edit-find',
          label: 'Find & Replace…',
          accelerator: 'CmdOrCtrl+H',
          click: () => sendMenuAction('edit:find'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          id: 'view-fullscreen',
          label: 'Toggle Full Screen',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
          },
        },
        ...(app.isPackaged
          ? []
          : [{ id: 'view-reload', label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() }]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        { id: 'help-manual', label: 'Manual', click: () => sendMenuAction('help:manual') },
        { id: 'help-shortcuts', label: 'Keyboard Shortcuts', click: () => sendMenuAction('help:shortcuts') },
        { id: 'help-about', label: 'About SimpleSheets', click: () => sendMenuAction('help:about') },
        { type: 'separator' },
        { id: 'help-data-folder', label: 'Open Data Folder', click: () => sendMenuAction('help:open-data-folder') },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/**
 * Reject IPC calls that did not come from the trusted renderer origin.
 *
 * @param event - The IPC invocation event.
 * @throws Error when the sender frame is missing or untrusted.
 */
function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const frame = event.senderFrame;
  // Only the top-level renderer may invoke privileged IPC. Subframes are
  // rejected even if they somehow share the trusted origin.
  if (!frame || frame.parent !== null) {
    throw new Error('Rejected IPC call from a subframe.');
  }
  if (!isTrustedOrigin(frame.url, TRUSTED_ORIGINS)) {
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

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) < 32) return true;
  }
  return false;
}

function parseRecentInput(value: unknown): RecentInput | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, ['id', 'name', 'size', 'timestamp', 'source', 'path', 'handleId', 'provider', 'cloudFileId', 'canReopen'])) {
    return null;
  }
  if (typeof value.name !== 'string' || value.name.length === 0 || value.name.length > 260) return null;
  if (typeof value.size !== 'number' || !Number.isFinite(value.size)) return null;
  if (value.source !== 'local' && value.source !== 'cloud' && value.source !== 'url') return null;
  if (value.path !== undefined) {
    if (typeof value.path !== 'string' || value.path.length > 32767) return null;
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
    const key = process.platform === 'win32' ? lastPath.toLowerCase() : lastPath;
    const stale = stateStore.getState().recents.find((entry) => {
      if (!entry.path) return false;
      const entryKey = process.platform === 'win32' ? entry.path.toLowerCase() : entry.path;
      return entryKey === key;
    });
    if (stale) {
      stateStore.removeRecent(stale.id);
      rebuildMenu();
    }
    stateStore.setLastPath(null);
    sendMenuAction('status:last-document-missing');
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
    if (
      typeof url !== 'string' ||
      url.length > 2048 ||
      hasControlCharacters(url) ||
      !isAllowedExternalUrl(url)
    ) {
      return {
        ok: false,
        code: 'INVALID_ARGUMENT',
        message: 'Only http, https, and mailto links can be opened.',
      };
    }
    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle('app:reveal-data-folder', (event) => {
    assertTrustedSender(event);
    shell.showItemInFolder(app.getPath('userData'));
    return { ok: true };
  });

  ipcMain.handle('app:ping', (event) => {
    assertTrustedSender(event);
    return 'pong';
  });

  ipcMain.handle('app:copy-text', (event, text: unknown) => {
    assertTrustedSender(event);
    if (typeof text !== 'string' || text.length === 0 || text.length > 1_000_000) {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Invalid clipboard text.' };
    }
    clipboard.writeText(text);
    return { ok: true };
  });

  ipcMain.handle('app:reset-data', async (event) => {
    assertTrustedSender(event);
    await stateStore.resetApplicationData();
    rebuildMenu();
    return { ok: true };
  });

  ipcMain.handle('dialog:unsaved', async (event, message: unknown) => {
    assertTrustedSender(event);
    if (typeof message !== 'string' || message.length === 0 || message.length > 500) {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Invalid prompt text.' };
    }
    const choice = await showUnsavedDialog(mainWindow, message);
    return { ok: true, value: choice };
  });

  ipcMain.handle('window:set-dirty', (event, dirty: unknown) => {
    assertTrustedSender(event);
    if (typeof dirty !== 'boolean') {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Expected a boolean dirty flag.' };
    }
    rendererDirty = dirty;
    return { ok: true };
  });

  ipcMain.handle('window:close', (event) => {
    assertTrustedSender(event);
    mainWindow?.close();
    return { ok: true };
  });

  ipcMain.handle('window:close-ready', (event) => {
    assertTrustedSender(event);
    allowWindowClose = true;
    closePromptOpen = false;
    mainWindow?.close();
    return { ok: true };
  });

  ipcMain.handle('window:close-cancel', (event) => {
    assertTrustedSender(event);
    closePromptOpen = false;
    return { ok: true };
  });

  ipcMain.handle('menu:dispatch', (event, action: unknown) => {
    assertTrustedSender(event);
    if (typeof action !== 'string' || !NATIVE_SHORTCUTS.some((shortcut) => shortcut.id === action)) {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Unknown native menu action.' };
    }
    sendMenuAction(action);
    return { ok: true };
  });

  ipcMain.handle('menu:set-state', (event, value: unknown) => {
    assertTrustedSender(event);
    if (!isRecord(value) || !hasOnlyKeys(value, ['canUndo', 'canRedo', 'saveEnabled'])) {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Invalid menu state.' };
    }
    if (typeof value.canUndo !== 'boolean' || typeof value.canRedo !== 'boolean' || typeof value.saveEnabled !== 'boolean') {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Invalid menu state.' };
    }
    menuState = {
      canUndo: value.canUndo,
      canRedo: value.canRedo,
      saveEnabled: value.saveEnabled,
    };
    rebuildMenu();
    return { ok: true };
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
    const entry = stateStore.getState().recents.find((item) =>
      item.path !== undefined && (
        process.platform === 'win32'
          ? path.resolve(item.path).toLowerCase() === key
          : path.resolve(item.path) === key
      ),
    );
    if (!entry) {
      return { ok: false, code: 'NOT_ALLOWED', message: 'That path is not in the recent-file list.' };
    }

    const opened = await readOpenRequest(rawPath, 'recent');
    if (opened.ok || opened.code !== 'MISSING') return opened;

    const options: Electron.MessageBoxOptions = {
      type: 'warning',
      buttons: ['Remove from list', 'Locate…', 'Keep'],
      defaultId: 2,
      cancelId: 2,
      noLink: true,
      title: 'Recent file is missing',
      message: `${entry.name} no longer exists at its saved location.`,
      detail: rawPath,
    };
    const choice = mainWindow
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options);
    if (choice.response === 0) {
      stateStore.removeRecent(entry.id);
      rebuildMenu();
      return { ok: false, code: 'REMOVED', message: `Removed "${entry.name}" from recent files.` };
    }
    if (choice.response === 1) {
      const picked = await dialog.showOpenDialog({
        title: 'Locate recent file',
        properties: ['openFile'],
        filters: OPEN_FILTERS,
      });
      if (!picked.canceled && picked.filePaths.length > 0) {
        return readOpenRequest(picked.filePaths[0], 'picker');
      }
    }
    return { ok: false, code: 'MISSING', message: 'The file no longer exists.' };
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
    if (!isRecord(value) || !hasOnlyKeys(value, ['mru', 'autosave'])) {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Invalid legacy import payload.' };
    }
    if (value.mru !== null && value.mru !== undefined && typeof value.mru !== 'string') {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Invalid legacy MRU payload.' };
    }
    if (value.autosave !== null && value.autosave !== undefined && typeof value.autosave !== 'string') {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Invalid legacy autosave payload.' };
    }
    if ((typeof value.mru === 'string' && value.mru.length > 5_000_000) ||
        (typeof value.autosave === 'string' && value.autosave.length > 50_000_000)) {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Legacy data is too large.' };
    }
    const mru = typeof value.mru === 'string' ? value.mru : null;
    const autosave = typeof value.autosave === 'string' ? value.autosave : null;
    const imported = await stateStore.importLegacy(mru, autosave);
    rebuildMenu();
    return { ok: true, value: imported };
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
    const entry = stateStore.upsertRecent(parsed);
    rebuildMenu();
    return { ok: true, value: entry };
  });

  ipcMain.handle('recents:remove', (event, id: unknown) => {
    assertTrustedSender(event);
    if (typeof id !== 'string' || id.length === 0) {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'A recent-file id is required.' };
    }
    stateStore.removeRecent(id);
    rebuildMenu();
    return { ok: true };
  });

  ipcMain.handle('recents:clear', (event) => {
    assertTrustedSender(event);
    stateStore.clearRecents();
    rebuildMenu();
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
    if (!isRecord(value) || !hasOnlyKeys(value, ['workbook', 'path', 'displayName'])) {
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
    const written = stateStore.writeRecovery({
      workbook: value.workbook,
      path: value.path,
      displayName: value.displayName,
    });
    rebuildMenu();
    return written;
  });

  ipcMain.handle('recovery:clear', async (event) => {
    assertTrustedSender(event);
    await stateStore.clearRecovery();
    rebuildMenu();
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
  const primary = screen.getPrimaryDisplay().workArea;
  const displays = screen.getAllDisplays().map((display) => display.workArea);
  const geometry = resolveWindowBounds(stateStore.getState().windowBounds, displays, primary);

  const window = new BrowserWindow({
    x: geometry.bounds.x,
    y: geometry.bounds.y,
    width: geometry.bounds.width,
    height: geometry.bounds.height,
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

  window.once('ready-to-show', () => {
    window.show();
    if (geometry.maximized) window.maximize();
  });

  window.on('close', (event) => {
    if (allowWindowClose) {
      stateStore.setWindowBounds({
        ...window.getNormalBounds(),
        maximized: window.isMaximized(),
      });
      // A clean close after Save/Don't Save must not leave a dirty-run marker.
      if (stateStore.getRecovery() === null) void stateStore.markCleanExit();
      return;
    }
    event.preventDefault();
    if (closePromptOpen) return;
    if (!rendererDirty) {
      allowWindowClose = true;
      window.close();
      return;
    }
    closePromptOpen = true;
    void showUnsavedDialog(window, 'Save changes before closing?').then(async (choice) => {
      if (choice === 'save') {
        window.webContents.send('menu:action', 'file:save-and-close');
        return;
      }
      closePromptOpen = false;
      if (choice === 'discard') {
        await stateStore.clearRecovery();
        allowWindowClose = true;
        stateStore.setWindowBounds({
          ...window.getNormalBounds(),
          maximized: window.isMaximized(),
        });
        window.close();
      }
    });
  });

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
      allowWindowClose = false;
      closePromptOpen = false;
    }
    void stateStore.flushState();
  });

  // A reload or navigation starts a new renderer; wait for its ready signal
  // before re-delivering the active intent.
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const action = nativeShortcutAction({
      key: input.key,
      ctrlKey: input.control,
      metaKey: input.meta,
      shiftKey: input.shift,
      altKey: input.alt,
    });
    if (action) {
      event.preventDefault();
      sendMenuAction(action);
    }
  });

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
    const blockUntrustedNavigation = (event: Electron.Event, url: string): void => {
      if (!isTrustedOrigin(url, TRUSTED_ORIGINS)) event.preventDefault();
    };
    contents.on('will-navigate', blockUntrustedNavigation);
    contents.on('will-redirect', (event, url) => {
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
    protocol.handle('app', handleAppRequest);
    setupPermissions();
    setupIpc();
    startWindow();
    rebuildMenu();

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
