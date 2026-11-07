// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Electron platform adapter.
 *
 * Thin wrapper around the frozen preload bridge. Every call is normalized into
 * a PlatformResult so the UI never receives a raw IPC rejection.
 */

import type {
  DesktopBridge,
  DesktopBridgeResult,
  DesktopSaveDialogOptions,
  DesktopWriteRequest,
  DesktopWriteResult,
} from '../../types/desktop';
import type {
  AppInfo,
  PlatformAdapter,
  PlatformCapabilities,
  PlatformFailureCode,
  MenuState,
  PlatformResult,
  RecoveryPromptResult,
  UnsavedChoice,
  ReloadedFile,
  SaveFileResult,
} from '../types';
import type {
  RecentEntry,
  RecentInput,
  RecoveryInput,
  RecoverySummary,
  StartupInfo,
} from './core/desktopStateStore';

const CAPABILITIES: PlatformCapabilities = {
  // Capabilities are enabled as their milestones land:
  // recovery M3, native menu M4, association M5.
  nativeFileDialogs: true,
  fileAssociation: true,
  singleInstance: true,
  nativeMenu: true,
  revealInFolder: true,
  windowStatePersistence: true,
  recovery: true,
  appInfo: true,
};

const FAILURE_CODES = new Set<PlatformFailureCode>([
  'NOT_SUPPORTED',
  'INVALID_ARGUMENT',
  'IPC_ERROR',
  'DENIED',
  'NO_PATH',
  'CANCELED',
  'CONFLICT',
  'RELOAD',
  'MISSING',
  'PERMISSION',
  'IN_USE',
  'NOT_ALLOWED',
  'TOO_LARGE',
  'UNKNOWN',
]);

function normalizeFailureCode(code: string | undefined): PlatformFailureCode {
  return code && FAILURE_CODES.has(code as PlatformFailureCode)
    ? (code as PlatformFailureCode)
    : 'IPC_ERROR';
}

function toFailure(message: string): PlatformResult<never> {
  return { ok: false, code: 'IPC_ERROR', message };
}

function normalizeResult(result: DesktopBridgeResult): PlatformResult<void> {
  if (!result.ok) {
    return {
      ok: false,
      code: normalizeFailureCode(result.code),
      message: result.message ?? 'The desktop request failed.',
    };
  }
  return { ok: true, value: undefined };
}

function normalizeWriteResult(result: DesktopWriteResult): PlatformResult<SaveFileResult> {
  if (!result.ok) {
    let reload: ReloadedFile | undefined;
    if (
      result.code === 'RELOAD' &&
      typeof result.path === 'string' &&
      typeof result.data === 'string' &&
      typeof result.mtimeMs === 'number' &&
      typeof result.size === 'number'
    ) {
      reload = {
        path: result.path,
        data: result.data,
        mtimeMs: result.mtimeMs,
        size: result.size,
      };
    }
    return {
      ok: false,
      code: normalizeFailureCode(result.code),
      message: result.message ?? 'The file could not be written.',
      reload,
    };
  }
  if (
    typeof result.path !== 'string' ||
    typeof result.mtimeMs !== 'number' ||
    typeof result.size !== 'number'
  ) {
    return toFailure('The desktop writer returned an invalid result.');
  }
  return {
    ok: true,
    value: {
      path: result.path,
      mtimeMs: result.mtimeMs,
      size: result.size,
    },
  };
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
    async openFileDialog(): Promise<PlatformResult<void>> {
      try {
        return normalizeResult(await bridge.pickOpenFile());
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'Failed to open the file dialog.');
      }
    },
    async openDroppedFile(file: File): Promise<PlatformResult<void>> {
      try {
        return normalizeResult(await bridge.openDroppedFile(file));
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'Failed to open the dropped file.');
      }
    },
    async saveFileDialog(options): Promise<PlatformResult<string | null>> {
      const request: DesktopSaveDialogOptions = {
        suggestedName: options.suggestedName,
        filters: options.filters.map((filter) => ({
          name: filter.name,
          extensions: [...filter.extensions],
        })),
      };
      try {
        const result = await bridge.pickSaveFile(request);
        if (!result.ok) {
          return {
            ok: false,
            code: normalizeFailureCode(result.code),
            message: result.message ?? 'The save dialog failed.',
          };
        }
        return { ok: true, value: result.path ?? null };
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'Failed to open the save dialog.');
      }
    },
    async writeFile(request): Promise<PlatformResult<SaveFileResult>> {
      const desktopRequest: DesktopWriteRequest = {
        path: request.path,
        data: request.data,
        expected: request.expected ? { ...request.expected } : null,
      };
      try {
        return normalizeWriteResult(await bridge.writeFile(desktopRequest));
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'Failed to write the file.');
      }
    },
    async setWindowTitle(title: string): Promise<void> {
      try {
        await bridge.setWindowTitle(title);
      } catch {
        // A title update must never break saving or editing.
      }
    },
    onOpenRequest(callback): () => void {
      const id = bridge.onOpenRequest(callback);
      return () => bridge.offOpenRequest(id);
    },
    async ackOpenRequest(seq: number): Promise<void> {
      try {
        await bridge.ackOpenRequest(seq);
      } catch {
        // A dropped acknowledgement must not break the renderer.
      }
    },
    async rendererReady(): Promise<void> {
      try {
        await bridge.rendererReady();
      } catch {
        // The first open intent will retry the ready handshake.
      }
    },
    async openRecent(filePath: string): Promise<PlatformResult<void>> {
      try {
        return normalizeResult(await bridge.openRecent(filePath));
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'The recent file could not be opened.');
      }
    },
    async getStartupInfo(): Promise<PlatformResult<StartupInfo>> {
      try {
        const result = await bridge.getStartupInfo();
        if (!result.ok || !result.value) {
          return {
            ok: false,
            code: normalizeFailureCode(result.code),
            message: result.message ?? 'Startup state is unavailable.',
          };
        }
        return { ok: true, value: result.value as StartupInfo };
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'Failed to read startup state.');
      }
    },
    async importLegacy(mru, autosave): Promise<PlatformResult<{ imported: number; recovery: RecoverySummary | null }>> {
      try {
        const result = await bridge.importLegacy({ mru, autosave });
        if (!result.ok || !result.value) {
          return {
            ok: false,
            code: normalizeFailureCode(result.code),
            message: result.message ?? 'Legacy data could not be imported.',
          };
        }
        return { ok: true, value: result.value };
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'Legacy data could not be imported.');
      }
    },
    async listRecents(): Promise<PlatformResult<RecentEntry[]>> {
      try {
        const result = await bridge.listRecents();
        if (!result.ok || !result.value) {
          return {
            ok: false,
            code: normalizeFailureCode(result.code),
            message: result.message ?? 'Recent files are unavailable.',
          };
        }
        return { ok: true, value: result.value as RecentEntry[] };
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'Recent files are unavailable.');
      }
    },
    async upsertRecent(input: RecentInput): Promise<PlatformResult<RecentEntry>> {
      try {
        const result = await bridge.upsertRecent(input);
        if (!result.ok || !result.value) {
          return {
            ok: false,
            code: normalizeFailureCode(result.code),
            message: result.message ?? 'The recent file could not be recorded.',
          };
        }
        return { ok: true, value: result.value as RecentEntry };
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'The recent file could not be recorded.');
      }
    },
    async removeRecent(id: string): Promise<PlatformResult<void>> {
      try {
        return normalizeResult(await bridge.removeRecent(id));
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'The recent file could not be removed.');
      }
    },
    async clearRecents(): Promise<PlatformResult<void>> {
      try {
        return normalizeResult(await bridge.clearRecents());
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'Recent files could not be cleared.');
      }
    },
    async setReopenLast(reopen: boolean): Promise<PlatformResult<void>> {
      try {
        return normalizeResult(await bridge.setReopenLast(reopen));
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'The preference could not be saved.');
      }
    },
    async writeRecovery(input: RecoveryInput): Promise<PlatformResult<void>> {
      try {
        return normalizeResult(await bridge.writeRecovery(input));
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'The recovery snapshot could not be saved.');
      }
    },
    async clearRecovery(): Promise<PlatformResult<void>> {
      try {
        return normalizeResult(await bridge.clearRecovery());
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'The recovery snapshot could not be cleared.');
      }
    },
    async promptUnsavedChanges(message: string): Promise<PlatformResult<UnsavedChoice>> {
      try {
        const result = await bridge.promptUnsavedChanges(message);
        if (!result.ok || !result.value) {
          return {
            ok: false,
            code: normalizeFailureCode(result.code),
            message: result.message ?? 'The prompt failed.',
          };
        }
        return { ok: true, value: result.value };
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'The prompt failed.');
      }
    },
    async setDirty(dirty: boolean): Promise<void> {
      try {
        await bridge.setDirty(dirty);
      } catch {
        // A dirty-state marker must not break editing.
      }
    },
    async requestClose(): Promise<void> {
      try {
        await bridge.requestClose();
      } catch {
        // The OS close button remains available.
      }
    },
    async closeReady(): Promise<void> {
      try {
        await bridge.closeReady();
      } catch {
        // The window may already be gone.
      }
    },
    async closeCancel(): Promise<void> {
      try {
        await bridge.closeCancel();
      } catch {
        // The window may already be gone.
      }
    },
    async setMenuState(state: MenuState): Promise<void> {
      try {
        await bridge.setMenuState(state);
      } catch {
        // Menu enable-state sync is best-effort.
      }
    },
    async dispatchMenuAction(action: string): Promise<void> {
      try {
        await bridge.dispatchMenuAction(action);
      } catch {
        // The native accelerator remains the primary path.
      }
    },
    async resetApplicationData(): Promise<PlatformResult<void>> {
      try {
        return normalizeResult(await bridge.resetApplicationData());
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'Application data could not be reset.');
      }
    },
    async promptRecovery(): Promise<PlatformResult<RecoveryPromptResult>> {
      try {
        const result = await bridge.promptRecovery();
        if (!result.ok || !result.action) {
          return {
            ok: false,
            code: normalizeFailureCode(result.code),
            message: result.message ?? 'The recovery prompt failed.',
          };
        }
        return {
          ok: true,
          value: {
            action: result.action,
            recovery: result.value as RecoveryPromptResult['recovery'],
          },
        };
      } catch (error) {
        return toFailure(error instanceof Error ? error.message : 'The recovery prompt failed.');
      }
    },
  };
}
