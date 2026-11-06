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

  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[desktop] renderer failed to load (${code} ${description}): ${url}`);
  });

  if (app.isPackaged) {
    void window.loadURL(APP_URL);
  } else {
    void window.loadURL(DEV_URL);
  }
}

configureUserData();

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
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

  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('au.mouseclick.simplesheets');
    }

    Menu.setApplicationMenu(null);
    protocol.handle('app', handleAppRequest);
    setupPermissions();
    setupIpc();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }).catch((error: unknown) => {
    console.error('[desktop] failed to start:', error);
    app.quit();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
