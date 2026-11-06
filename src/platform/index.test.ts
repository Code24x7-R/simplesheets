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
});
