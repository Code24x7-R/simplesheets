// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Browser platform adapter.
 *
 * Mirrors the current web behavior. File dialogs, recents, recovery, and
 * window state continue to use the existing services until the shared UI is
 * migrated to the adapter in a later milestone.
 */

import { isAllowedExternalUrl } from './desktop/core/appOrigin';
import type {
  AppInfo,
  PlatformAdapter,
  PlatformCapabilities,
  PlatformResult,
} from './types';

const CAPABILITIES: PlatformCapabilities = {
  nativeFileDialogs: false,
  fileAssociation: false,
  singleInstance: false,
  nativeMenu: false,
  revealInFolder: false,
  windowStatePersistence: false,
  recovery: false,
  appInfo: false,
};

function readBuildTimestamp(): string {
  return typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : '';
}

function readGitCommit(): string {
  return typeof __GIT_COMMIT_HASH__ !== 'undefined' ? __GIT_COMMIT_HASH__ : '';
}

function readVersion(): string {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
}

function failure(code: 'NOT_SUPPORTED' | 'INVALID_ARGUMENT', message: string): PlatformResult<never> {
  return { ok: false, code, message };
}

/**
 * Create the browser adapter.
 *
 * @returns The web platform adapter.
 */
export function createWebAdapter(): PlatformAdapter {
  return {
    kind: 'web',
    capabilities: CAPABILITIES,
    async getAppInfo(): Promise<PlatformResult<AppInfo>> {
      return {
        ok: true,
        value: {
          name: 'SimpleSheets',
          version: readVersion(),
          edition: 'web',
          platform: 'web',
          electron: '',
          chromium: '',
          node: '',
          dataDir: '',
          portableDir: '',
          buildTimestamp: readBuildTimestamp(),
          gitCommit: readGitCommit(),
        },
      };
    },
    async openExternal(url: string): Promise<PlatformResult<void>> {
      if (!isAllowedExternalUrl(url)) {
        return failure('INVALID_ARGUMENT', 'Only http, https, and mailto links can be opened.');
      }
      window.open(url, '_blank', 'noopener,noreferrer');
      return { ok: true, value: undefined };
    },
    async revealDataFolder(): Promise<PlatformResult<void>> {
      return failure('NOT_SUPPORTED', 'The browser edition has no application data folder.');
    },
    onMenuAction(): () => void {
      return () => undefined;
    },
    async openFileDialog(): Promise<PlatformResult<void>> {
      return failure(
        'NOT_SUPPORTED',
        'The browser edition uses the existing file picker.',
      );
    },
    async openDroppedFile(): Promise<PlatformResult<void>> {
      return failure(
        'NOT_SUPPORTED',
        'The browser edition opens dropped files with the File API.',
      );
    },
    async saveFileDialog(): Promise<PlatformResult<string | null>> {
      return failure(
        'NOT_SUPPORTED',
        'The browser edition saves with the File System Access picker.',
      );
    },
    async writeFile(): Promise<PlatformResult<never>> {
      return failure(
        'NOT_SUPPORTED',
        'The browser edition cannot write filesystem paths directly.',
      );
    },
    async setWindowTitle(): Promise<void> {
      return undefined;
    },
    onOpenRequest(): () => void {
      return () => undefined;
    },
    async ackOpenRequest(): Promise<void> {
      return undefined;
    },
    async rendererReady(): Promise<void> {
      return undefined;
    },
    async openRecent() {
      return failure('NOT_SUPPORTED', 'The browser edition reopens recent files with the file picker.');
    },
    async getStartupInfo() {
      return failure('NOT_SUPPORTED', 'The browser edition has no desktop startup state.');
    },
    async importLegacy() {
      return failure('NOT_SUPPORTED', 'The browser edition keeps its own localStorage data.');
    },
    async listRecents() {
      return failure('NOT_SUPPORTED', 'The browser edition keeps recent files in localStorage.');
    },
    async upsertRecent() {
      return failure('NOT_SUPPORTED', 'The browser edition keeps recent files in localStorage.');
    },
    async removeRecent() {
      return failure('NOT_SUPPORTED', 'The browser edition keeps recent files in localStorage.');
    },
    async clearRecents() {
      return failure('NOT_SUPPORTED', 'The browser edition keeps recent files in localStorage.');
    },
    async setReopenLast() {
      return failure('NOT_SUPPORTED', 'The browser edition has no relaunch behavior.');
    },
    async writeRecovery() {
      return failure('NOT_SUPPORTED', 'The browser edition autosaves to localStorage.');
    },
    async clearRecovery() {
      return failure('NOT_SUPPORTED', 'The browser edition autosaves to localStorage.');
    },
    async promptRecovery() {
      return failure('NOT_SUPPORTED', 'The browser edition has no recovery prompt.');
    },
    async promptUnsavedChanges() {
      return failure('NOT_SUPPORTED', 'The browser edition uses window.confirm.');
    },
    async setDirty() {
      return undefined;
    },
    async requestClose() {
      return undefined;
    },
    async closeReady() {
      return undefined;
    },
    async closeCancel() {
      return undefined;
    },
    async setMenuState() {
      return undefined;
    },
    async copyText(text: string) {
      try {
        await navigator.clipboard.writeText(text);
        return { ok: true, value: undefined };
      } catch {
        return failure('NOT_SUPPORTED', 'Clipboard write failed.');
      }
    },
    async resetApplicationData() {
      return failure('NOT_SUPPORTED', 'The browser edition has no desktop application data.');
    },
    async dispatchMenuAction() {
      return undefined;
    },
  };
}
