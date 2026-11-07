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
    onOpenRequest(): () => void {
      return () => undefined;
    },
    async ackOpenRequest(): Promise<void> {
      return undefined;
    },
    async rendererReady(): Promise<void> {
      return undefined;
    },
  };
}
