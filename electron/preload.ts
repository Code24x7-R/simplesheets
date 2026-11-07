// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Sandboxed preload bridge.
 *
 * Exposes a small, frozen API. No ipcRenderer, Node primitives, or filesystem
 * access ever reaches renderer code.
 */

import {
  contextBridge,
  ipcRenderer,
  webUtils,
  type IpcRendererEvent,
} from 'electron';
import type {
  DesktopBridge,
  DesktopBridgeResult,
  DesktopOpenRequest,
  DesktopSaveDialogOptions,
  DesktopSaveResult,
  DesktopWriteRequest,
  DesktopWriteResult,
} from '../src/types/desktop';

let nextMenuListenerId = 1;
const menuListeners = new Map<
  number,
  (event: IpcRendererEvent, action: string) => void
>();

let nextOpenListenerId = 1;
const openListeners = new Map<
  number,
  (event: IpcRendererEvent, request: DesktopOpenRequest) => void
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

  pickOpenFile: (): Promise<DesktopBridgeResult> =>
    ipcRenderer.invoke('open:pick'),

  pickSaveFile: (options: DesktopSaveDialogOptions): Promise<DesktopSaveResult> =>
    ipcRenderer.invoke('save:pick', options),

  writeFile: (request: DesktopWriteRequest): Promise<DesktopWriteResult> =>
    ipcRenderer.invoke('save:write', request),

  setWindowTitle: (title: string): Promise<DesktopBridgeResult> =>
    ipcRenderer.invoke('window:set-title', title),

  openDroppedFile: (file: File): Promise<DesktopBridgeResult> => {
    let filePath = '';
    try {
      filePath = webUtils.getPathForFile(file);
    } catch {
      filePath = '';
    }
    if (!filePath) {
      return Promise.resolve({
        ok: false,
        code: 'NO_PATH',
        message: 'The dropped file has no filesystem path.',
      });
    }
    return ipcRenderer.invoke('open:path', filePath);
  },

  onOpenRequest: (callback: (request: DesktopOpenRequest) => void): number => {
    const id = nextOpenListenerId;
    nextOpenListenerId += 1;
    const listener = (_event: IpcRendererEvent, request: DesktopOpenRequest) =>
      callback(request);
    openListeners.set(id, listener);
    ipcRenderer.on('open:request', listener);
    return id;
  },

  offOpenRequest: (id: number): void => {
    const listener = openListeners.get(id);
    if (!listener) return;
    ipcRenderer.removeListener('open:request', listener);
    openListeners.delete(id);
  },

  ackOpenRequest: (seq: number): Promise<DesktopBridgeResult> =>
    ipcRenderer.invoke('open:ack', seq),

  rendererReady: (): Promise<DesktopBridgeResult> =>
    ipcRenderer.invoke('renderer:ready'),

  openRecent: (filePath: string): Promise<DesktopBridgeResult> =>
    ipcRenderer.invoke('open:recent', filePath),

  getStartupInfo: () => ipcRenderer.invoke('state:startup'),

  importLegacy: (payload) => ipcRenderer.invoke('state:import-legacy', payload),

  listRecents: () => ipcRenderer.invoke('recents:list'),

  upsertRecent: (entry) => ipcRenderer.invoke('recents:upsert', entry),

  removeRecent: (id) => ipcRenderer.invoke('recents:remove', id),

  clearRecents: () => ipcRenderer.invoke('recents:clear'),

  setReopenLast: (reopen) => ipcRenderer.invoke('state:set-reopen-last', reopen),

  writeRecovery: (input) => ipcRenderer.invoke('recovery:write', input),

  clearRecovery: () => ipcRenderer.invoke('recovery:clear'),

  promptRecovery: () => ipcRenderer.invoke('recovery:prompt'),

  promptUnsavedChanges: (message) => ipcRenderer.invoke('dialog:unsaved', message),

  setDirty: (dirty) => ipcRenderer.invoke('window:set-dirty', dirty),

  requestClose: () => ipcRenderer.invoke('window:close'),

  closeReady: () => ipcRenderer.invoke('window:close-ready'),

  closeCancel: () => ipcRenderer.invoke('window:close-cancel'),

  setMenuState: (state) => ipcRenderer.invoke('menu:set-state', state),

  resetApplicationData: () => ipcRenderer.invoke('app:reset-data'),

  dispatchMenuAction: (action: string): Promise<DesktopBridgeResult> =>
    ipcRenderer.invoke('menu:dispatch', action),
};

contextBridge.exposeInMainWorld(
  'simplesheetsDesktop',
  Object.freeze(bridge),
);
