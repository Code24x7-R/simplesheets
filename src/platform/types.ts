// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Platform adapter contract.
 *
 * The renderer talks to this interface only. The web implementation keeps the
 * existing browser behavior; the desktop implementation forwards to the
 * preload bridge. Capabilities describe what the current edition can do.
 */

import type { OpenRequest } from './desktop/core/openRequest';

export type PlatformKind = 'web' | 'desktop';

export type AppEdition = 'web' | 'development' | 'installed' | 'portable';

export interface PlatformCapabilities {
  readonly nativeFileDialogs: boolean;
  readonly fileAssociation: boolean;
  readonly singleInstance: boolean;
  readonly nativeMenu: boolean;
  readonly revealInFolder: boolean;
  readonly windowStatePersistence: boolean;
  readonly recovery: boolean;
  readonly appInfo: boolean;
}

export interface AppInfo {
  readonly name: string;
  readonly version: string;
  readonly edition: AppEdition;
  readonly platform: string;
  readonly electron: string;
  readonly chromium: string;
  readonly node: string;
  readonly dataDir: string;
  readonly buildTimestamp: string;
  readonly gitCommit: string;
}

export type PlatformFailureCode =
  | 'NOT_SUPPORTED'
  | 'INVALID_ARGUMENT'
  | 'IPC_ERROR'
  | 'DENIED'
  | 'NO_PATH'
  | 'UNKNOWN';

export type PlatformResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: PlatformFailureCode; readonly message: string };

export interface PlatformAdapter {
  readonly kind: PlatformKind;
  readonly capabilities: PlatformCapabilities;
  getAppInfo(): Promise<PlatformResult<AppInfo>>;
  openExternal(url: string): Promise<PlatformResult<void>>;
  revealDataFolder(): Promise<PlatformResult<void>>;
  onMenuAction(callback: (action: string) => void): () => void;
  /** Show the native open dialog. The selected file arrives via onOpenRequest. */
  openFileDialog(): Promise<PlatformResult<void>>;
  /**
   * Open a dropped File through its OS path. The preload resolves the path;
   * the renderer never supplies an arbitrary filesystem path.
   */
  openDroppedFile(file: File): Promise<PlatformResult<void>>;
  /** Subscribe to open intents delivered by the desktop main process. */
  onOpenRequest(callback: (request: OpenRequest) => void): () => void;
  /** Acknowledge an open intent so the next queued intent can be delivered. */
  ackOpenRequest(seq: number): Promise<void>;
  /** Tell main the renderer is ready to receive open intents. */
  rendererReady(): Promise<void>;
}
