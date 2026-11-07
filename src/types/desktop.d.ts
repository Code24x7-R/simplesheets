// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Types for the preload bridge exposed as `window.simplesheetsDesktop`.
 *
 * The bridge is only present in the Electron renderer. Keep this file free of
 * runtime imports so it is safe to include in the browser build.
 */

export interface DesktopBridgeAppInfo {
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
}

export interface DesktopBridgeResult {
  ok: boolean;
  code?: string;
  message?: string;
}

export interface DesktopOpenRequest {
  seq: number;
  source: 'argv' | 'open-with' | 'second-instance' | 'picker' | 'recent' | 'drag-drop';
  path: string;
  name: string;
  size: number;
  mtimeMs: number;
  data: ArrayBuffer;
}

export interface DesktopFileFilter {
  name: string;
  extensions: string[];
}

export interface DesktopSaveDialogOptions {
  suggestedName: string;
  filters: DesktopFileFilter[];
}

export interface DesktopFileVersion {
  mtimeMs: number;
  size: number;
}

export interface DesktopWriteRequest {
  path: string;
  data: string | Uint8Array;
  expected: DesktopFileVersion | null;
}

export interface DesktopSaveResult extends DesktopBridgeResult {
  path?: string;
}

export interface DesktopWriteResult extends DesktopBridgeResult {
  path?: string;
  mtimeMs?: number;
  size?: number;
  data?: string;
}

export interface DesktopRecentEntry {
  id: string;
  name: string;
  size: number;
  timestamp: number;
  source: 'local' | 'cloud' | 'url';
  path?: string;
  handleId?: string;
  provider?: string;
  cloudFileId?: string;
  canReopen?: boolean;
}

export interface DesktopRecoverySummary {
  timestamp: number;
  displayName: string;
  path: string | null;
  appVersion: string;
}

export interface DesktopRecoveryLoad extends DesktopRecoverySummary {
  workbook: unknown;
  pathExists: boolean;
  mtimeMs?: number;
  size?: number;
}

export interface DesktopStartupInfo {
  recents: DesktopRecentEntry[];
  lastPath: string | null;
  reopenLast: boolean;
  recovery: DesktopRecoverySummary | null;
  unclean: boolean;
  hadExplicitIntent: boolean;
  needsLegacyImport: boolean;
}

export interface DesktopRecentsResult extends DesktopBridgeResult {
  value?: DesktopRecentEntry[];
}

export interface DesktopRecentResult extends DesktopBridgeResult {
  value?: DesktopRecentEntry;
}

export interface DesktopStartupResult extends DesktopBridgeResult {
  value?: DesktopStartupInfo;
}

export interface DesktopLegacyResult extends DesktopBridgeResult {
  value?: { imported: number; recovery: DesktopRecoverySummary | null };
}

export interface DesktopRecoveryPromptResult extends DesktopBridgeResult {
  action?: 'recover' | 'discard' | 'none';
  value?: DesktopRecoveryLoad;
}

export interface DesktopUnsavedResult extends DesktopBridgeResult {
  value?: 'save' | 'discard' | 'cancel';
}

export interface DesktopBridge {
  readonly isDesktop: true;
  readonly platform: string;
  getAppInfo(): Promise<DesktopBridgeAppInfo>;
  openExternal(url: string): Promise<DesktopBridgeResult>;
  revealDataFolder(): Promise<DesktopBridgeResult>;
  onMenuAction(callback: (action: string) => void): number;
  offMenuAction(id: number): void;
  pickOpenFile(): Promise<DesktopBridgeResult>;
  openDroppedFile(file: File): Promise<DesktopBridgeResult>;
  pickSaveFile(options: DesktopSaveDialogOptions): Promise<DesktopSaveResult>;
  writeFile(request: DesktopWriteRequest): Promise<DesktopWriteResult>;
  setWindowTitle(title: string): Promise<DesktopBridgeResult>;
  onOpenRequest(callback: (request: DesktopOpenRequest) => void): number;
  offOpenRequest(id: number): void;
  ackOpenRequest(seq: number): Promise<DesktopBridgeResult>;
  rendererReady(): Promise<DesktopBridgeResult>;
  openRecent(path: string): Promise<DesktopBridgeResult>;
  getStartupInfo(): Promise<DesktopStartupResult>;
  importLegacy(payload: { mru: string | null; autosave: string | null }): Promise<DesktopLegacyResult>;
  listRecents(): Promise<DesktopRecentsResult>;
  upsertRecent(entry: unknown): Promise<DesktopRecentResult>;
  removeRecent(id: string): Promise<DesktopBridgeResult>;
  clearRecents(): Promise<DesktopBridgeResult>;
  setReopenLast(reopen: boolean): Promise<DesktopBridgeResult>;
  writeRecovery(input: { workbook: unknown; path: string | null; displayName: string }): Promise<DesktopBridgeResult>;
  clearRecovery(): Promise<DesktopBridgeResult>;
  promptRecovery(): Promise<DesktopRecoveryPromptResult>;
  promptUnsavedChanges(message: string): Promise<DesktopUnsavedResult>;
  setDirty(dirty: boolean): Promise<DesktopBridgeResult>;
  requestClose(): Promise<DesktopBridgeResult>;
  closeReady(): Promise<DesktopBridgeResult>;
  closeCancel(): Promise<DesktopBridgeResult>;
  setMenuState(state: {
    canUndo: boolean;
    canRedo: boolean;
    saveEnabled: boolean;
  }): Promise<DesktopBridgeResult>;
  resetApplicationData(): Promise<DesktopBridgeResult>;
  dispatchMenuAction(action: string): Promise<DesktopBridgeResult>;
}

declare global {
  interface Window {
    simplesheetsDesktop?: DesktopBridge;
  }
}

export {};
