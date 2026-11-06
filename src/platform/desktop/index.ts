// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Electron platform adapter.
 *
 * Thin wrapper around the frozen preload bridge. Every call is normalized into
 * a PlatformResult so the UI never receives a raw IPC rejection.
 */

import type { DesktopBridge, DesktopBridgeResult } from '../../types/desktop';
import type {
  AppInfo,
  PlatformAdapter,
  PlatformCapabilities,
  PlatformResult,
} from '../types';

const CAPABILITIES: PlatformCapabilities = {
  // Capabilities are enabled as their milestones land:
  // file dialogs M1, recovery M3, native menu M4, association M5.
  nativeFileDialogs: false,
  fileAssociation: false,
  singleInstance: true,
  nativeMenu: false,
  revealInFolder: true,
  windowStatePersistence: false,
  recovery: false,
  appInfo: true,
};

function toFailure(message: string): PlatformResult<never> {
  return { ok: false, code: 'IPC_ERROR', message };
}

function normalizeResult(result: DesktopBridgeResult): PlatformResult<void> {
  if (!result.ok) {
    return {
      ok: false,
      code: 'IPC_ERROR',
      message: result.message ?? 'The desktop request failed.',
    };
  }
  return { ok: true, value: undefined };
}

/**
 * Create the Electron adapter around the preload bridge.
 *
 * @param bridge - The bridge object exposed by the preload script.
 * @returns The desktop platform adapter.
 */
export function createDesktopAdapter(bridge: DesktopBridge): PlatformAdapter {
  return {
    kind: 'desktop',
    capabilities: CAPABILITIES,
    async getAppInfo(): Promise<PlatformResult<AppInfo>> {
      try {
        const info = await bridge.getAppInfo();
        return {
          ok: true,
          value: {
            ...info,
            platform: info.platform || bridge.platform,
          },
        };
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'Failed to read app info.');
      }
    },
    async openExternal(url: string): Promise<PlatformResult<void>> {
      try {
        return normalizeResult(await bridge.openExternal(url));
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'Failed to open link.');
      }
    },
    async revealDataFolder(): Promise<PlatformResult<void>> {
      try {
        return normalizeResult(await bridge.revealDataFolder());
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'Failed to open the data folder.');
      }
    },
    onMenuAction(callback: (action: string) => void): () => void {
      const id = bridge.onMenuAction(callback);
      return () => bridge.offMenuAction(id);
    },
  };
}
