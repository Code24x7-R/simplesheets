// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { getPlatform } from './index';
import type { DesktopBridge, DesktopBridgeAppInfo } from '../types/desktop';

const APP_INFO: DesktopBridgeAppInfo = {
  name: 'SimpleSheets',
  version: '0.1.0',
  edition: 'development',
  platform: 'win32',
  electron: '45.2.3',
  chromium: '142.0.0.0',
  node: '22.0.0',
  dataDir: 'C:/tmp/simplesheets',
  buildTimestamp: '2026-01-01T00:00:00.000Z',
  gitCommit: 'abc1234',
};

function makeBridge(overrides: Partial<DesktopBridge> = {}): DesktopBridge {
  return {
    isDesktop: true,
    platform: 'win32',
    getAppInfo: async () => APP_INFO,
    openExternal: async () => ({ ok: true }),
    revealDataFolder: async () => ({ ok: true }),
    onMenuAction: () => 1,
    offMenuAction: () => undefined,
    pickOpenFile: async () => ({ ok: true }),
    openDroppedFile: async () => ({ ok: true }),
    pickSaveFile: async () => ({ ok: true }),
    writeFile: async () => ({ ok: true, path: 'C:/tmp/a.ssjson', mtimeMs: 1, size: 2 }),
    setWindowTitle: async () => ({ ok: true }),
    onOpenRequest: () => 2,
    offOpenRequest: () => undefined,
    ackOpenRequest: async () => ({ ok: true }),
    rendererReady: async () => ({ ok: true }),
    openRecent: async () => ({ ok: true }),
    getStartupInfo: async () => ({
      ok: true,
      value: {
        recents: [],
        lastPath: null,
        reopenLast: true,
        recovery: null,
        unclean: false,
        hadExplicitIntent: false,
        needsLegacyImport: false,
      },
    }),
    importLegacy: async () => ({ ok: true, value: { imported: 0, recovery: null } }),
    listRecents: async () => ({ ok: true, value: [] }),
    upsertRecent: async () => ({
      ok: true,
      value: { id: 'r1', name: 'a.ssjson', size: 1, timestamp: 1, source: 'local' },
    }),
    removeRecent: async () => ({ ok: true }),
    clearRecents: async () => ({ ok: true }),
    setReopenLast: async () => ({ ok: true }),
    writeRecovery: async () => ({ ok: true }),
    clearRecovery: async () => ({ ok: true }),
    promptRecovery: async () => ({ ok: true, action: 'none' }),
    ...overrides,
  };
}

afterEach(() => {
  delete window.simplesheetsDesktop;
});

describe('getPlatform', () => {
  it('returns the web adapter when no preload bridge exists', () => {
    const platform = getPlatform();
    expect(platform.kind).toBe('web');
    expect(platform.capabilities.nativeFileDialogs).toBe(false);
    expect(platform.capabilities.singleInstance).toBe(false);
  });

  it('returns the desktop adapter when the bridge exists', () => {
    window.simplesheetsDesktop = makeBridge();
    const platform = getPlatform();
    expect(platform.kind).toBe('desktop');
    expect(platform.capabilities.singleInstance).toBe(true);
    expect(platform.capabilities.appInfo).toBe(true);
  });
});

describe('web adapter', () => {
  it('reports version and build info', async () => {
    const result = await getPlatform().getAppInfo();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.edition).toBe('web');
    expect(result.value.version).toBe('0.0.0');
  });

  it('opens only safe external URLs', async () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    const platform = getPlatform();

    const allowed = await platform.openExternal('https://simplesheets.mouseclick.au/');
    expect(allowed.ok).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);

    const rejected = await platform.openExternal('javascript:alert(1)');
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.code).toBe('INVALID_ARGUMENT');
    expect(open).toHaveBeenCalledTimes(1);

    open.mockRestore();
  });

  it('has no data folder', async () => {
    const result = await getPlatform().revealDataFolder();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOT_SUPPORTED');
  });

  it('onMenuAction is a no-op unsubscribe', () => {
    const unsubscribe = getPlatform().onMenuAction(() => undefined);
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });

  it('reports native open and dropped-file support as unavailable', async () => {
    const platform = getPlatform();
    const dialogResult = await platform.openFileDialog();
    const dropResult = await platform.openDroppedFile(new File(['x'], 'a.ssjson'));
    expect(dialogResult.ok).toBe(false);
    expect(dropResult.ok).toBe(false);
    if (!dropResult.ok) expect(dropResult.code).toBe('NOT_SUPPORTED');
  });

  it('open notifications and ready calls are no-ops', async () => {
    const platform = getPlatform();
    const unsubscribe = platform.onOpenRequest(() => undefined);
    await expect(platform.ackOpenRequest(1)).resolves.toBeUndefined();
    await expect(platform.rendererReady()).resolves.toBeUndefined();
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe('desktop adapter', () => {
  it('normalizes app info', async () => {
    window.simplesheetsDesktop = makeBridge();
    const result = await getPlatform().getAppInfo();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.platform).toBe('win32');
    expect(result.value.electron).toBe('45.2.3');
  });

  it('turns a bridge rejection into a typed failure', async () => {
    window.simplesheetsDesktop = makeBridge({
      getAppInfo: async () => {
        throw new Error('ipc unavailable');
      },
    });
    const result = await getPlatform().getAppInfo();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('IPC_ERROR');
      expect(result.message).toBe('ipc unavailable');
    }
  });

  it('passes through external-link failures', async () => {
    window.simplesheetsDesktop = makeBridge({
      openExternal: async () => ({ ok: false, message: 'denied' }),
    });
    const result = await getPlatform().openExternal('https://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('denied');
  });

  it('reports data-folder open failures', async () => {
    window.simplesheetsDesktop = makeBridge({
      revealDataFolder: async () => ({ ok: false, message: 'no folder' }),
    });
    const result = await getPlatform().revealDataFolder();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('no folder');
  });

  it('subscribes and unsubscribes menu actions', () => {
    const off = jest.fn();
    window.simplesheetsDesktop = makeBridge({ offMenuAction: off });
    const unsubscribe = getPlatform().onMenuAction(() => undefined);
    unsubscribe();
    expect(off).toHaveBeenCalledWith(1);
  });

  it('opens the native dialog through the bridge', async () => {
    const pickOpenFile = jest.fn(async () => ({ ok: true }));
    window.simplesheetsDesktop = makeBridge({ pickOpenFile });
    const result = await getPlatform().openFileDialog();
    expect(result.ok).toBe(true);
    expect(pickOpenFile).toHaveBeenCalledTimes(1);
  });

  it('opens a dropped file through the bridge', async () => {
    const openDroppedFile = jest.fn(async () => ({ ok: false, message: 'missing' }));
    window.simplesheetsDesktop = makeBridge({ openDroppedFile });
    const file = new File(['x'], 'a.ssjson');
    const result = await getPlatform().openDroppedFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('missing');
    expect(openDroppedFile).toHaveBeenCalledWith(file);
  });

  it('preserves the NO_PATH failure so drops can fall back', async () => {
    window.simplesheetsDesktop = makeBridge({
      openDroppedFile: async () => ({
        ok: false,
        code: 'NO_PATH',
        message: 'no path',
      }),
    });
    const result = await getPlatform().openDroppedFile(new File(['x'], 'a.ssjson'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NO_PATH');
  });

  it('subscribes to dropped open intents', () => {
    const offOpenRequest = jest.fn();
    window.simplesheetsDesktop = makeBridge({ offOpenRequest });
    const platform = getPlatform();
    const unsubscribe = platform.onOpenRequest(() => undefined);
    unsubscribe();
    expect(offOpenRequest).toHaveBeenCalledWith(2);
  });

  it('opens the native save dialog and returns its path', async () => {
    const pickSaveFile = jest.fn(async () => ({ ok: true, path: 'C:/tmp/a.ssjson' }));
    window.simplesheetsDesktop = makeBridge({ pickSaveFile });
    const result = await getPlatform().saveFileDialog({
      suggestedName: 'a.ssjson',
      filters: [{ name: 'SimpleSheets', extensions: ['ssjson'] }],
    });
    expect(result).toEqual({ ok: true, value: 'C:/tmp/a.ssjson' });
    expect(pickSaveFile).toHaveBeenCalledWith({
      suggestedName: 'a.ssjson',
      filters: [{ name: 'SimpleSheets', extensions: ['ssjson'] }],
    });
  });

  it('returns null when the native save dialog is cancelled', async () => {
    window.simplesheetsDesktop = makeBridge({ pickSaveFile: async () => ({ ok: true }) });
    const result = await getPlatform().saveFileDialog({ suggestedName: 'a.ssjson', filters: [] });
    expect(result).toEqual({ ok: true, value: null });
  });

  it('writes a file and preserves failure codes', async () => {
    window.simplesheetsDesktop = makeBridge({
      writeFile: async () => ({ ok: false, code: 'CONFLICT', message: 'changed' }),
    });
    const result = await getPlatform().writeFile({
      path: 'C:/tmp/a.ssjson',
      data: '{}',
      expected: { mtimeMs: 1, size: 2 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('CONFLICT');
      expect(result.message).toBe('changed');
    }
  });

  it('exposes reload data on a RELOAD result', async () => {
    window.simplesheetsDesktop = makeBridge({
      writeFile: async () => ({
        ok: false,
        code: 'RELOAD',
        message: 'reloaded',
        path: 'C:/tmp/a.ssjson',
        data: '{"title":"disk"}',
        mtimeMs: 5,
        size: 6,
      }),
    });
    const result = await getPlatform().writeFile({
      path: 'C:/tmp/a.ssjson',
      data: '{}',
      expected: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('RELOAD');
      expect(result.reload).toEqual({
        path: 'C:/tmp/a.ssjson',
        data: '{"title":"disk"}',
        mtimeMs: 5,
        size: 6,
      });
    }
  });

  it('rejects a write result without a version', async () => {
    window.simplesheetsDesktop = makeBridge({
      writeFile: async () => ({ ok: true, path: 'C:/tmp/a.ssjson' }),
    });
    const result = await getPlatform().writeFile({
      path: 'C:/tmp/a.ssjson',
      data: '{}',
      expected: null,
    });
    expect(result.ok).toBe(false);
  });

  it('updates and swallows title failures', async () => {
    const setWindowTitle = jest.fn(async () => ({ ok: true }));
    window.simplesheetsDesktop = makeBridge({ setWindowTitle });
    await expect(getPlatform().setWindowTitle('a — SimpleSheets')).resolves.toBeUndefined();
    expect(setWindowTitle).toHaveBeenCalledWith('a — SimpleSheets');

    window.simplesheetsDesktop = makeBridge({
      setWindowTitle: async () => {
        throw new Error('title failed');
      },
    });
    await expect(getPlatform().setWindowTitle('a')).resolves.toBeUndefined();
  });

  it('swallows acknowledgement and ready failures', async () => {
    window.simplesheetsDesktop = makeBridge({
      ackOpenRequest: async () => {
        throw new Error('ack failed');
      },
      rendererReady: async () => {
        throw new Error('ready failed');
      },
    });
    const platform = getPlatform();
    await expect(platform.ackOpenRequest(1)).resolves.toBeUndefined();
    await expect(platform.rendererReady()).resolves.toBeUndefined();
  });

  it('reads startup state, recents, and opens a recent path', async () => {
    const openRecent = jest.fn(async () => ({ ok: true }));
    window.simplesheetsDesktop = makeBridge({
      openRecent,
      listRecents: async () => ({
        ok: true,
        value: [
          { id: 'r1', name: 'a.ssjson', size: 1, timestamp: 2, source: 'local', path: 'C:/a.ssjson' },
        ],
      }),
    });
    const platform = getPlatform();
    const startup = await platform.getStartupInfo();
    expect(startup.ok).toBe(true);
    const recents = await platform.listRecents();
    expect(recents.ok).toBe(true);
    if (recents.ok) expect(recents.value[0].name).toBe('a.ssjson');
    await platform.openRecent('C:/a.ssjson');
    expect(openRecent).toHaveBeenCalledWith('C:/a.ssjson');
  });

  it('normalizes missing startup and recents values', async () => {
    window.simplesheetsDesktop = makeBridge({
      getStartupInfo: async () => ({ ok: true }),
      listRecents: async () => ({ ok: false, code: 'DENIED', message: 'no recents' }),
    });
    const platform = getPlatform();
    const startup = await platform.getStartupInfo();
    expect(startup.ok).toBe(false);
    const recents = await platform.listRecents();
    expect(recents.ok).toBe(false);
    if (!recents.ok) expect(recents.code).toBe('DENIED');
  });

  it('records recents and reports recovery outcomes', async () => {
    const upsertRecent = jest.fn(async () => ({
      ok: true,
      value: { id: 'r2', name: 'b.ssjson', size: 3, timestamp: 4, source: 'local' as const },
    }));
    window.simplesheetsDesktop = makeBridge({
      upsertRecent,
      promptRecovery: async () => ({
        ok: true,
        action: 'recover',
        value: {
          timestamp: 1,
          displayName: 'B',
          path: null,
          appVersion: '0.1.0',
          workbook: { sheets: [] },
          pathExists: false,
        },
      }),
    });
    const platform = getPlatform();
    const added = await platform.upsertRecent({ name: 'b.ssjson', size: 3, source: 'local' });
    expect(added.ok).toBe(true);
    expect(upsertRecent).toHaveBeenCalled();
    const prompt = await platform.promptRecovery();
    expect(prompt.ok).toBe(true);
    if (prompt.ok) expect(prompt.value.action).toBe('recover');
  });

  it('imports legacy state and surfaces recovery write failures', async () => {
    window.simplesheetsDesktop = makeBridge({
      importLegacy: async () => ({
        ok: true,
        value: {
          imported: 2,
          recovery: {
            timestamp: 1,
            displayName: 'Legacy',
            path: null,
            appVersion: '0.1.0',
          },
        },
      }),
      writeRecovery: async () => ({ ok: false, code: 'TOO_LARGE', message: 'too large' }),
    });
    const platform = getPlatform();
    const imported = await platform.importLegacy('[]', null);
    expect(imported.ok).toBe(true);
    if (imported.ok) expect(imported.value.imported).toBe(2);
    const written = await platform.writeRecovery({
      workbook: { sheets: [] },
      path: null,
      displayName: 'A',
    });
    expect(written.ok).toBe(false);
    if (!written.ok) expect(written.code).toBe('TOO_LARGE');
  });
});
