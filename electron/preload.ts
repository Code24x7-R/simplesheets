// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Sandboxed preload bridge.
 *
 * Exposes a small, frozen API. No ipcRenderer, Node primitives, or filesystem
 * access ever reaches renderer code.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { DesktopBridge, DesktopBridgeResult } from '../src/types/desktop';

let nextMenuListenerId = 1;
const menuListeners = new Map<
  number,
  (event: IpcRendererEvent, action: string) => void
>();

const bridge: DesktopBridge = {
  isDesktop: true,
  platform: process.platform,

  getAppInfo: () => ipcRenderer.invoke('app:get-info'),

  openExternal: (url: string): Promise<DesktopBridgeResult> =>
    ipcRenderer.invoke('app:open-external', url),

  revealDataFolder: (): Promise<DesktopBridgeResult> =>
    ipcRenderer.invoke('app:reveal-data-folder'),

  onMenuAction: (callback: (action: string) => void): number => {
    const id = nextMenuListenerId;
    nextMenuListenerId += 1;
    const listener = (_event: IpcRendererEvent, action: string) => callback(action);
    menuListeners.set(id, listener);
    ipcRenderer.on('menu:action', listener);
    return id;
  },

  offMenuAction: (id: number): void => {
    const listener = menuListeners.get(id);
    if (!listener) return;
    ipcRenderer.removeListener('menu:action', listener);
    menuListeners.delete(id);
  },
};

contextBridge.exposeInMainWorld(
  'simplesheetsDesktop',
  Object.freeze(bridge),
);
