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
import type { FileVersion } from './desktop/core/saveTarget';
import type {
  RecentEntry,
  RecentInput,
  RecoveryInput,
  RecoveryLoad,
  RecoverySummary,
  StartupInfo,
} from './desktop/core/desktopStateStore';

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
  readonly portableDir: string;
  readonly buildTimestamp: string;
  readonly gitCommit: string;
}

export type PlatformFailureCode =
  | 'NOT_SUPPORTED'
  | 'INVALID_ARGUMENT'
  | 'IPC_ERROR'
  | 'DENIED'
  | 'NO_PATH'
  | 'CANCELED'
  | 'CONFLICT'
  | 'RELOAD'
  | 'MISSING'
  | 'PERMISSION'
  | 'IN_USE'
  | 'NOT_ALLOWED'
  | 'TOO_LARGE'
  | 'UNKNOWN';

export type PlatformResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code: PlatformFailureCode;
      readonly message: string;
      /** Present when a save conflict was resolved by reloading from disk. */
      readonly reload?: ReloadedFile;
    };

export interface FileFilter {
  readonly name: string;
  readonly extensions: readonly string[];
}

export interface SaveDialogOptions {
  readonly suggestedName: string;
  readonly filters: readonly FileFilter[];
}

export interface SaveFileRequest {
  readonly path: string;
  readonly data: string | Uint8Array;
  readonly expected: FileVersion | null;
}

export interface SaveFileResult {
  readonly path: string;
  readonly mtimeMs: number;
  readonly size: number;
}

export interface ReloadedFile {
  readonly path: string;
  readonly data: string;
  readonly mtimeMs: number;
  readonly size: number;
}

export interface LegacyImportResult {
  readonly imported: number;
  readonly recovery: RecoverySummary | null;
}

export type RecoveryPromptAction = 'recover' | 'discard' | 'none';

export type UnsavedChoice = 'save' | 'discard' | 'cancel';

export interface MenuState {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly saveEnabled: boolean;
}

export interface RecoveryPromptResult {
  readonly action: RecoveryPromptAction;
  readonly recovery?: RecoveryLoad;
}

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
  /** Show the native Save As dialog. Returns null when cancelled. */
  saveFileDialog(options: SaveDialogOptions): Promise<PlatformResult<string | null>>;
  /** Write a document/export atomically. */
  writeFile(request: SaveFileRequest): Promise<PlatformResult<SaveFileResult>>;
  /** Update the native window title (desktop only). */
  setWindowTitle(title: string): Promise<void>;
  /** Subscribe to open intents delivered by the desktop main process. */
  onOpenRequest(callback: (request: OpenRequest) => void): () => void;
  /** Acknowledge an open intent so the next queued intent can be delivered. */
  ackOpenRequest(seq: number): Promise<void>;
  /** Tell main the renderer is ready to receive open intents. */
  rendererReady(): Promise<void>;
  /** Open a main-owned recent path (desktop only). */
  openRecent(path: string): Promise<PlatformResult<void>>;
  /** Read startup recents/recovery/last-document metadata. */
  getStartupInfo(): Promise<PlatformResult<StartupInfo>>;
  /** Import legacy same-origin localStorage data once. */
  importLegacy(mru: string | null, autosave: string | null): Promise<PlatformResult<LegacyImportResult>>;
  /** List main-owned recent entries. */
  listRecents(): Promise<PlatformResult<RecentEntry[]>>;
  /** Add or promote a recent entry. */
  upsertRecent(input: RecentInput): Promise<PlatformResult<RecentEntry>>;
  /** Remove one recent entry. */
  removeRecent(id: string): Promise<PlatformResult<void>>;
  /** Clear all recent entries. */
  clearRecents(): Promise<PlatformResult<void>>;
  /** Update the reopen-last-document preference. */
  setReopenLast(reopen: boolean): Promise<PlatformResult<void>>;
  /** Queue a debounced recovery snapshot. */
  writeRecovery(input: RecoveryInput): Promise<PlatformResult<void>>;
  /** Delete the recovery snapshot. */
  clearRecovery(): Promise<PlatformResult<void>>;
  /** Show the native Recover/Discard prompt. */
  promptRecovery(): Promise<PlatformResult<RecoveryPromptResult>>;
  /** Show the native Save / Don't Save / Cancel prompt. */
  promptUnsavedChanges(message: string): Promise<PlatformResult<UnsavedChoice>>;
  /** Tell main whether the current document is dirty (for window close). */
  setDirty(dirty: boolean): Promise<void>;
  /** Ask main to close the window (runs the dirty prompt). */
  requestClose(): Promise<void>;
  /** Continue a close after Save succeeded. */
  closeReady(): Promise<void>;
  /** Abort a close after Save failed or was cancelled. */
  closeCancel(): Promise<void>;
  /** Update native menu enable states. */
  setMenuState(state: MenuState): Promise<void>;
  /** Copy text to the system clipboard. */
  copyText(text: string): Promise<PlatformResult<void>>;
  /** Forward a native-owned accelerator that the main process did not catch. */
  dispatchMenuAction(action: string): Promise<void>;
  /** Clear desktop state and preferences (never user documents). */
  resetApplicationData(): Promise<PlatformResult<void>>;
}
