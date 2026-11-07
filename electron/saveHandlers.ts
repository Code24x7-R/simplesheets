// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Native save dialog and atomic-write IPC.
 *
 * The main process owns save-path approval, conflict detection, native
 * prompts, retries, and the atomic temp-file rename. The renderer only sees a
 * typed result.
 */

import { app, dialog, ipcMain, type BrowserWindow } from 'electron';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteFile } from '../src/platform/desktop/core/atomicWrite';
import { hasOnlyKeys, isFiniteNumber } from '../src/platform/desktop/core/ipcValidation';
import {
  classifySaveTarget,
  type FileVersion,
} from '../src/platform/desktop/core/saveTarget';

const MAX_WRITE_BYTES = 200 * 1024 * 1024;
const WORKBOOK_SAVE_FILTERS: Electron.FileFilter[] = [
  { name: 'SimpleSheets document', extensions: ['ssjson'] },
  { name: 'JSON document', extensions: ['json'] },
];

const allowedWritePaths = new Set<string>();
let lastSaveDirectory: string | null = null;

interface SaveSuccess {
  ok: true;
  path: string;
  mtimeMs: number;
  size: number;
}

interface SaveFailure {
  ok: false;
  code: string;
  message: string;
  path?: string;
  data?: string;
  mtimeMs?: number;
  size?: number;
}

interface SaveDialogRequest {
  suggestedName: string;
  filters: Electron.FileFilter[];
}

interface WriteRequest {
  path: string;
  data: string | Uint8Array;
  expected: FileVersion | null;
}

interface SaveHandlerDeps {
  getWindow: () => BrowserWindow | null;
  assertTrustedSender: (event: Electron.IpcMainInvokeEvent) => void;
  /** Called after a successful write with the final path. */
  onSaved?: (filePath: string) => void;
}

function normalizePathKey(filePath: string): string {
  return process.platform === 'win32' ? filePath.toLowerCase() : filePath;
}

/**
 * Resolve a path to its real target, or its real parent plus basename for a
 * file that does not exist yet. This prevents symlink/path-aliasing bypasses.
 */
function pathKey(filePath: string): string {
  const resolved = path.resolve(filePath);
  try {
    return normalizePathKey(fs.realpathSync.native(resolved));
  } catch {
    try {
      const parent = fs.realpathSync.native(path.dirname(resolved));
      return normalizePathKey(path.join(parent, path.basename(resolved)));
    } catch {
      return normalizePathKey(resolved);
    }
  }
}

/** Approve a path returned by a native dialog for later writes. */
export function allowWritePath(filePath: string): void {
  allowedWritePaths.add(pathKey(filePath));
}

/** True when the renderer may write this path. */
export function isWritePathAllowed(filePath: string): boolean {
  return allowedWritePaths.has(pathKey(filePath));
}

function safeSuggestedName(value: string, fallback = 'Document'): string {
  const sanitized = path
    .basename(value)
    .replace(/[<>:"/\\|?*]/g, '_')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? '' : character))
    .join('');
  const base = sanitized.trim();
  return base.length > 0 ? base.slice(0, 120) : fallback;
}

function saveDefaultDirectory(): string {
  return lastSaveDirectory ?? app.getPath('documents');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSaveDialogRequest(value: unknown): SaveDialogRequest | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ['suggestedName', 'filters'])) return null;
  if (typeof value.suggestedName !== 'string' || value.suggestedName.length === 0) {
    return null;
  }
  if (!Array.isArray(value.filters) || value.filters.length === 0 || value.filters.length > 10) {
    return null;
  }
  const filters: Electron.FileFilter[] = [];
  for (const entry of value.filters) {
    if (!isRecord(entry) || !hasOnlyKeys(entry, ['name', 'extensions'])) return null;
    if (typeof entry.name !== 'string' || entry.name.length === 0 || entry.name.length > 80) {
      return null;
    }
    if (!Array.isArray(entry.extensions) || entry.extensions.length === 0 || entry.extensions.length > 20) {
      return null;
    }
    const extensions: string[] = [];
    for (const extension of entry.extensions) {
      if (typeof extension !== 'string' || !/^[a-z0-9]{1,15}$/i.test(extension)) return null;
      extensions.push(extension);
    }
    filters.push({ name: entry.name, extensions });
  }
  return { suggestedName: value.suggestedName, filters };
}

function parseWriteRequest(value: unknown): WriteRequest | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ['path', 'data', 'expected'])) return null;
  if (typeof value.path !== 'string' || !path.isAbsolute(value.path) || value.path.length > 32767) return null;
  if (typeof value.data !== 'string' && !(value.data instanceof Uint8Array)) return null;
  const byteLength = typeof value.data === 'string'
    ? Buffer.byteLength(value.data, 'utf8')
    : value.data.byteLength;
  if (byteLength > MAX_WRITE_BYTES) return null;

  let expected: FileVersion | null = null;
  if (value.expected !== null) {
    if (!isRecord(value.expected) || !hasOnlyKeys(value.expected, ['mtimeMs', 'size'])) return null;
    if (!isFiniteNumber(value.expected.mtimeMs) || !isFiniteNumber(value.expected.size)) {
      return null;
    }
    expected = { mtimeMs: value.expected.mtimeMs, size: value.expected.size };
  }

  return { path: path.resolve(value.path), data: value.data, expected };
}

function saveErrorCode(error: unknown): string {
  return (error as NodeJS.ErrnoException).code ?? 'WRITE_FAILED';
}

async function showSaveChoice(
  window: BrowserWindow | null,
  message: string,
  detail: string,
  buttons: string[],
  cancelId: number,
): Promise<number> {
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    title: 'SimpleSheets',
    message,
    detail,
    buttons,
    defaultId: 0,
    cancelId,
    noLink: true,
  };
  const result = window
    ? await dialog.showMessageBox(window, options)
    : await dialog.showMessageBox(options);
  return result.response;
}

async function pickSavePath(
  window: BrowserWindow | null,
  request: SaveDialogRequest,
  suggestedName?: string,
): Promise<{ ok: true; path: string } | { ok: true; path: null } | SaveFailure> {
  const safeName = safeSuggestedName(suggestedName ?? request.suggestedName, 'Document.ssjson');
  const options: Electron.SaveDialogOptions = {
    title: 'Save As',
    defaultPath: path.join(saveDefaultDirectory(), safeName),
    filters: request.filters,
    properties: ['showOverwriteConfirmation', 'createDirectory'],
  };
  const result = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return { ok: true, path: null };

  let target = path.resolve(result.filePath);
  if (!path.extname(target)) {
    const fallbackExtension = path.extname(safeName);
    if (fallbackExtension) target += fallbackExtension;
  }
  allowWritePath(target);
  return { ok: true, path: target };
}

async function attemptAtomicWrite(
  target: string,
  data: string | Uint8Array,
): Promise<{ ok: true; stat: { mtimeMs: number; size: number } } | SaveFailure> {
  const waits = [0, 50, 50];
  let lastError: unknown;
  for (const wait of waits) {
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      const stat = await atomicWriteFile(target, data);
      return { ok: true, stat };
    } catch (error) {
      lastError = error;
      if (!['EBUSY', 'EPERM'].includes(saveErrorCode(error))) break;
    }
  }
  return {
    ok: false,
    code: saveErrorCode(lastError),
    message: lastError instanceof Error ? lastError.message : 'The file could not be written.',
  };
}

async function saveAsFromRequest(
  window: BrowserWindow | null,
  request: WriteRequest,
  suggestedName: string,
  onSaved?: (filePath: string) => void,
): Promise<SaveSuccess | SaveFailure> {
  const picked = await pickSavePath(
    window,
    { suggestedName, filters: WORKBOOK_SAVE_FILTERS },
    suggestedName,
  );
  if (picked.ok && picked.path === null) {
    return { ok: false, code: 'CANCELED', message: 'Save cancelled.' };
  }
  if (!picked.ok) return picked;
  return writeWithPrompts(
    window,
    { path: picked.path, data: request.data, expected: null },
    true,
    false,
    onSaved,
  );
}

async function writeWithPrompts(
  window: BrowserWindow | null,
  request: WriteRequest,
  force = false,
  allowSaveAs = true,
  onSaved?: (filePath: string) => void,
): Promise<SaveSuccess | SaveFailure> {
  let overwrite = force;

  // The loop retries after native prompts (Overwrite/Recreate/Retry).
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let current: FileVersion | null = null;
    try {
      const info = await fsp.stat(request.path);
      current = { mtimeMs: info.mtimeMs, size: info.size };
    } catch (error) {
      if (saveErrorCode(error) !== 'ENOENT') {
        return {
          ok: false,
          code: saveErrorCode(error),
          message: error instanceof Error ? error.message : 'The target cannot be read.',
        };
      }
      current = null;
    }

    if (!overwrite) {
      const targetState = classifySaveTarget(current, request.expected);
      if (targetState === 'conflict') {
        const choice = await showSaveChoice(
          window,
          'The file changed on disk.',
          `${path.basename(request.path)} was changed by another program. What do you want to do?`,
          ['Overwrite', 'Save As…', 'Reload', 'Cancel'],
          3,
        );
        if (choice === 0) {
          overwrite = true;
        } else if (choice === 1) {
          if (!allowSaveAs) return { ok: false, code: 'CANCELED', message: 'Save cancelled.' };
          return saveAsFromRequest(window, request, path.basename(request.path), onSaved);
        } else if (choice === 2) {
          try {
            const info = await fsp.stat(request.path);
            const data = await fsp.readFile(request.path, 'utf8');
            return {
              ok: false,
              code: 'RELOAD',
              message: 'The file was reloaded from disk.',
              path: request.path,
              data,
              mtimeMs: info.mtimeMs,
              size: info.size,
            };
          } catch (error) {
            return {
              ok: false,
              code: saveErrorCode(error),
              message: 'The file could not be reloaded.',
            };
          }
        } else {
          return { ok: false, code: 'CANCELED', message: 'Save cancelled.' };
        }
        continue;
      }

      if (targetState === 'missing') {
        const choice = await showSaveChoice(
          window,
          'The file no longer exists.',
          `${path.basename(request.path)} was deleted. Recreate it or choose a new location?`,
          ['Recreate', 'Save As…', 'Cancel'],
          2,
        );
        if (choice === 0) {
          overwrite = true;
        } else if (choice === 1) {
          if (!allowSaveAs) return { ok: false, code: 'CANCELED', message: 'Save cancelled.' };
          return saveAsFromRequest(window, request, path.basename(request.path), onSaved);
        } else {
          return { ok: false, code: 'CANCELED', message: 'Save cancelled.' };
        }
        continue;
      }
    }

    const attempt = await attemptAtomicWrite(request.path, request.data);
    if (attempt.ok) {
      allowWritePath(request.path);
      lastSaveDirectory = path.dirname(request.path);
      onSaved?.(request.path);
      return {
        ok: true,
        path: request.path,
        mtimeMs: attempt.stat.mtimeMs,
        size: attempt.stat.size,
      };
    }

    if (['EACCES', 'EPERM', 'EBUSY', 'EROFS'].includes(attempt.code)) {
      const choice = await showSaveChoice(
        window,
        'The file cannot be written.',
        'It may be read-only, in use by another program, or the folder may not allow writes.',
        ['Retry', 'Save As…', 'Cancel'],
        2,
      );
      if (choice === 0) continue;
      if (choice === 1) {
        if (!allowSaveAs) return { ok: false, code: 'CANCELED', message: 'Save cancelled.' };
        return saveAsFromRequest(window, request, path.basename(request.path), onSaved);
      }
      return { ok: false, code: 'CANCELED', message: 'Save cancelled.' };
    }

    return { ok: false, code: attempt.code, message: attempt.message };
  }
}

/**
 * Register save IPC handlers.
 *
 * @param deps - Window access and sender validation from the main process.
 */
export function registerSaveHandlers(deps: SaveHandlerDeps): void {
  const { getWindow, assertTrustedSender, onSaved } = deps;

  ipcMain.handle('save:pick', async (event, value: unknown) => {
    assertTrustedSender(event);
    const parsed = parseSaveDialogRequest(value);
    if (!parsed) {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Invalid save dialog options.' };
    }
    return pickSavePath(getWindow(), parsed);
  });

  ipcMain.handle('save:write', async (event, value: unknown) => {
    assertTrustedSender(event);
    const parsed = parseWriteRequest(value);
    if (!parsed) {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Invalid write request.' };
    }
    if (!isWritePathAllowed(parsed.path)) {
      return {
        ok: false,
        code: 'NOT_ALLOWED',
        message: 'That path was not approved by a save dialog or an open document.',
      };
    }
    if (parsed.expected && !/\.(ssjson|json)$/i.test(parsed.path)) {
      return {
        ok: false,
        code: 'INVALID_ARGUMENT',
        message: 'In-place saves must use a .ssjson or .json document.',
      };
    }
    return writeWithPrompts(getWindow(), parsed, false, true, onSaved);
  });

  ipcMain.handle('window:set-title', (event, title: unknown) => {
    assertTrustedSender(event);
    if (typeof title !== 'string' || title.length === 0 || title.length > 200) {
      return { ok: false, code: 'INVALID_ARGUMENT', message: 'Invalid window title.' };
    }
    getWindow()?.setTitle(title);
    return { ok: true };
  });
}
