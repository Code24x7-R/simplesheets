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
}

declare global {
  interface Window {
    simplesheetsDesktop?: DesktopBridge;
  }
}

export {};
