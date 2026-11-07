// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Main-process desktop persistence.
 *
 * Owns `state.json` (recents, last path, clean-exit marker) and
 * `recovery.json` (the debounced unsaved-work snapshot). Both files are written
 * atomically; corrupt files are renamed and replaced rather than blocking
 * startup. This module is Node-only and is imported exclusively by Electron
 * main.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteFile } from './atomicWrite';
import {
  clearRecents,
  createDefaultState,
  normalizeState,
  removeRecent,
  upsertRecent,
  type DesktopState,
  type RecentEntry,
  type RecentSource,
} from './desktopState';
import {
  MAX_RECOVERY_BYTES,
  normalizeRecovery,
  type RecoveryRecord,
} from './recovery';
import { parseLegacyAutosave, parseLegacyMru } from './legacyMigration';
import type { WindowBounds } from './windowBounds';

export type { RecentEntry, RecentSource } from './desktopState';

const STATE_WRITE_DELAY_MS = 250;
const RECOVERY_WRITE_DELAY_MS = 500;

export interface RecoverySummary {
  readonly timestamp: number;
  readonly displayName: string;
  readonly path: string | null;
  readonly appVersion: string;
}

export interface StartupInfo {
  readonly recents: RecentEntry[];
  readonly lastPath: string | null;
  readonly reopenLast: boolean;
  readonly recovery: RecoverySummary | null;
  readonly unclean: boolean;
  readonly hadExplicitIntent: boolean;
  readonly needsLegacyImport: boolean;
}

export interface RecoveryLoad extends RecoverySummary {
  readonly workbook: unknown;
  readonly pathExists: boolean;
  readonly mtimeMs?: number;
  readonly size?: number;
}

export interface RecentInput {
  readonly id?: string;
  readonly name: string;
  readonly size: number;
  readonly timestamp?: number;
  readonly source: RecentSource;
  readonly path?: string;
  readonly handleId?: string;
  readonly provider?: string;
  readonly cloudFileId?: string;
  readonly canReopen?: boolean;
}

export interface RecoveryInput {
  readonly workbook: unknown;
  readonly path: string | null;
  readonly displayName: string;
}

export type StoreResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly message: string };

function summary(record: RecoveryRecord): RecoverySummary {
  return {
    timestamp: record.timestamp,
    displayName: record.displayName,
    path: record.path,
    appVersion: record.appVersion,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Owns state.json and recovery.json for one user-data directory.
 */
export class DesktopStateStore {
  private state: DesktopState;
  private recovery: RecoveryRecord | null = null;
  private unclean = false;
  private stateTimer: NodeJS.Timeout | null = null;
  private recoveryTimer: NodeJS.Timeout | null = null;
  private pendingRecovery: RecoveryRecord | null = null;
  private recentCounter = 0;
  private readonly statePath: string;
  private readonly recoveryPath: string;

  /**
   * @param dataDir - Electron `userData` directory.
   * @param appVersion - Version recorded in recovery snapshots.
   */
  constructor(
    private readonly dataDir: string,
    private readonly appVersion: string,
  ) {
    this.statePath = path.join(dataDir, 'state.json');
    this.recoveryPath = path.join(dataDir, 'recovery.json');
    this.state = createDefaultState();
  }

  /** Load both files, mark this run as unclean, and persist the marker. */
  async init(): Promise<void> {
    await fsp.mkdir(this.dataDir, { recursive: true });
    this.state = await this.readState();
    const previousCleanExit = this.state.cleanExit;
    this.state = { ...this.state, cleanExit: false };
    this.recovery = await this.readRecovery();
    this.unclean = !previousCleanExit || this.recovery !== null;
    await this.writeStateNow();
  }

  /** Return the current state (read-only copy). */
  getState(): DesktopState {
    return this.state;
  }

  /** Return the loaded recovery record, if any. */
  getRecovery(): RecoveryRecord | null {
    return this.recovery;
  }

  /**
   * Build the startup payload consumed by the renderer.
   *
   * @param hadExplicitIntent - True when argv/open-with queued a document.
   */
  getStartupInfo(hadExplicitIntent: boolean): StartupInfo {
    return {
      recents: [...this.state.recents],
      lastPath: this.state.lastPath,
      reopenLast: this.state.reopenLast,
      recovery: this.recovery ? summary(this.recovery) : null,
      unclean: this.unclean,
      hadExplicitIntent,
      needsLegacyImport: !this.state.legacyImported,
    };
  }

  /**
   * Add or promote a recent entry.
   *
   * @param input - Recent metadata; id/timestamp are generated when absent.
   * @returns The persisted entry.
   */
  upsertRecent(input: RecentInput): RecentEntry {
    this.recentCounter += 1;
    const entry: RecentEntry = {
      id: input.id ?? `recent-${Date.now()}-${this.recentCounter}`,
      name: input.name,
      size: input.size,
      timestamp: input.timestamp ?? Date.now(),
      source: input.source,
      path: input.path,
      handleId: input.handleId,
      provider: input.provider,
      cloudFileId: input.cloudFileId,
      canReopen: input.canReopen,
    };
    this.state = upsertRecent(this.state, entry);
    this.scheduleStateWrite();
    return entry;
  }

  /**
   * Remove one recent entry.
   *
   * @param id - Entry id.
   */
  removeRecent(id: string): void {
    this.state = removeRecent(this.state, id);
    this.scheduleStateWrite();
  }

  /** Remove every recent entry. */
  clearRecents(): void {
    this.state = clearRecents(this.state);
    this.scheduleStateWrite();
  }

  /**
   * Remember the document most recently opened or saved.
   *
   * @param lastPath - Absolute path, or null to clear.
   */
  setLastPath(lastPath: string | null): void {
    if (this.state.lastPath === lastPath) return;
    this.state = {
      ...this.state,
      lastPath,
      lastDirectory: lastPath ? path.dirname(lastPath) : this.state.lastDirectory,
    };
    this.scheduleStateWrite();
  }

  /**
   * Update the last-used directory.
   *
   * @param lastDirectory - Absolute directory path.
   */
  setLastDirectory(lastDirectory: string): void {
    if (this.state.lastDirectory === lastDirectory) return;
    this.state = { ...this.state, lastDirectory };
    this.scheduleStateWrite();
  }

  /**
   * Persist the last window geometry.
   *
   * @param bounds - Normal bounds plus maximized flag.
   */
  setWindowBounds(bounds: WindowBounds): void {
    this.state = { ...this.state, windowBounds: bounds };
    this.scheduleStateWrite();
  }

  /**
   * Clear desktop state without touching user documents.
   */
  async resetApplicationData(): Promise<void> {
    this.state = {
      ...createDefaultState(),
      cleanExit: true,
      legacyImported: true,
    };
    await this.clearRecovery();
    await this.flushState();
  }

  /**
   * Enable/disable reopening the last document on startup.
   *
   * @param reopen - New preference.
   */
  setReopenLast(reopen: boolean): void {
    if (this.state.reopenLast === reopen) return;
    this.state = { ...this.state, reopenLast: reopen };
    this.scheduleStateWrite();
  }

  /**
   * Merge legacy localStorage MRU/autosave data once.
   *
   * @param mruRaw - Raw `simplesheets:mru` value.
   * @param autosaveRaw - Raw `simplesheets:autosave` value.
   * @returns Imported count and an optional recovery summary.
   */
  async importLegacy(
    mruRaw: string | null,
    autosaveRaw: string | null,
  ): Promise<{ imported: number; recovery: RecoverySummary | null }> {
    if (this.state.legacyImported) {
      return { imported: 0, recovery: this.recovery ? summary(this.recovery) : null };
    }

    const legacyEntries = parseLegacyMru(mruRaw);
    let imported = 0;
    for (const entry of [...legacyEntries].reverse()) {
      this.state = upsertRecent(this.state, entry);
      imported += 1;
    }

    const legacyWorkbook = parseLegacyAutosave(autosaveRaw);
    if (legacyWorkbook && isRecord(legacyWorkbook)) {
      const title = typeof legacyWorkbook.title === 'string' && legacyWorkbook.title.trim()
        ? legacyWorkbook.title.trim()
        : 'Untitled';
      const record: RecoveryRecord = {
        schemaVersion: 1,
        timestamp: Date.now(),
        appVersion: this.appVersion,
        path: null,
        displayName: title,
        workbook: legacyWorkbook,
      };
      this.recovery = record;
      this.pendingRecovery = record;
      await this.flushRecovery();
      this.unclean = true;
    }

    this.state = { ...this.state, legacyImported: true };
    await this.flushState();
    return {
      imported,
      recovery: this.recovery ? summary(this.recovery) : null,
    };
  }

  /**
   * Queue a recovery snapshot. Writes are throttled to at most two per second.
   *
   * @param input - Workbook, document path, and display name.
   * @returns Success, or TOO_LARGE for snapshots above the limit.
   */
  writeRecovery(input: RecoveryInput): StoreResult<RecoverySummary> {
    const record: RecoveryRecord = {
      schemaVersion: 1,
      timestamp: Date.now(),
      appVersion: this.appVersion,
      path: input.path,
      displayName: input.displayName.trim() || 'Untitled',
      workbook: input.workbook,
    };
    if (!normalizeRecovery(record)) {
      return { ok: false, code: 'INVALID_RECORD', message: 'The recovery snapshot is invalid.' };
    }

    let bytes: number;
    try {
      bytes = Buffer.byteLength(JSON.stringify(record), 'utf8');
    } catch {
      return { ok: false, code: 'INVALID_RECORD', message: 'The recovery snapshot cannot be serialized.' };
    }
    if (bytes > MAX_RECOVERY_BYTES) {
      return {
        ok: false,
        code: 'TOO_LARGE',
        message: `The recovery snapshot exceeds the ${Math.round(MAX_RECOVERY_BYTES / (1024 * 1024))} MB limit.`,
      };
    }

    this.recovery = record;
    this.pendingRecovery = record;
    if (!this.recoveryTimer) {
      this.recoveryTimer = setTimeout(() => {
        this.recoveryTimer = null;
        void this.flushRecovery();
      }, RECOVERY_WRITE_DELAY_MS);
      this.recoveryTimer.unref?.();
    }
    return { ok: true, value: summary(record) };
  }

  /** Delete the recovery snapshot immediately. */
  async clearRecovery(): Promise<void> {
    this.pendingRecovery = null;
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    this.recovery = null;
    await fsp.unlink(this.recoveryPath).catch(() => undefined);
  }

  /** Flush any pending recovery snapshot to disk. */
  async flushRecovery(): Promise<void> {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    const record = this.pendingRecovery;
    this.pendingRecovery = null;
    if (!record) return;
    try {
      await atomicWriteFile(this.recoveryPath, JSON.stringify(record));
    } catch (error) {
      console.error('[desktop] failed to write recovery snapshot:', error);
    }
  }

  /**
   * Read the recovery record with path freshness for the Recover dialog.
   *
   * @returns The loadable snapshot, or null when none exists.
   */
  async loadRecovery(): Promise<RecoveryLoad | null> {
    if (!this.recovery) return null;
    const record = this.recovery;
    let pathExists = false;
    let mtimeMs: number | undefined;
    let size: number | undefined;
    if (record.path) {
      try {
        const stat = await fsp.stat(record.path);
        pathExists = stat.isFile();
        if (pathExists) {
          mtimeMs = stat.mtimeMs;
          size = stat.size;
        }
      } catch {
        pathExists = false;
      }
    }
    return { ...summary(record), workbook: record.workbook, pathExists, mtimeMs, size };
  }

  /** Flush state.json immediately. */
  async flushState(): Promise<void> {
    if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = null;
    }
    await this.writeStateNow();
  }

  /**
   * Mark a shutdown. A pending recovery snapshot means the document was still
   * dirty, so the next launch must treat this as an interrupted session until
   * the close prompt lands in M4.
   */
  async markCleanExit(): Promise<void> {
    const hasRecovery = this.recovery !== null || this.pendingRecovery !== null;
    this.state = { ...this.state, cleanExit: !hasRecovery };
    await this.flushState();
    if (hasRecovery) {
      await this.flushRecovery();
      return;
    }
    await this.clearRecovery();
  }

  /** Clear timers and flush pending writes (used by tests and quit hooks). */
  async dispose(): Promise<void> {
    await this.flushState();
    await this.flushRecovery();
  }

  private scheduleStateWrite(): void {
    if (this.stateTimer) return;
    this.stateTimer = setTimeout(() => {
      this.stateTimer = null;
      void this.writeStateNow();
    }, STATE_WRITE_DELAY_MS);
    this.stateTimer.unref?.();
  }

  private async writeStateNow(): Promise<void> {
    try {
      await atomicWriteFile(this.statePath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('[desktop] failed to write state:', error);
    }
  }

  private async readState(): Promise<DesktopState> {
    try {
      const raw = await fsp.readFile(this.statePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      const normalized = normalizeState(parsed);
      if (normalized) return normalized;
      await this.renameCorrupt(this.statePath);
      return createDefaultState();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') await this.renameCorrupt(this.statePath);
      return createDefaultState();
    }
  }

  private async readRecovery(): Promise<RecoveryRecord | null> {
    try {
      const raw = await fsp.readFile(this.recoveryPath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      const normalized = normalizeRecovery(parsed);
      if (normalized) return normalized;
      console.warn('[desktop] recovery snapshot is invalid; deleting it');
      await fsp.unlink(this.recoveryPath).catch(() => undefined);
      return null;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return null;
      console.warn('[desktop] recovery snapshot could not be read; deleting it:', error);
      await fsp.unlink(this.recoveryPath).catch(() => undefined);
      return null;
    }
  }

  private async renameCorrupt(filePath: string): Promise<void> {
    const corruptPath = `${filePath}.corrupt`;
    try {
      await fsp.unlink(corruptPath).catch(() => undefined);
      await fsp.rename(filePath, corruptPath);
    } catch (error) {
      console.error(`[desktop] failed to quarantine ${filePath}:`, error);
    }
  }
}
