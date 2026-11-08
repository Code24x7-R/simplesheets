// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/** Recovery-record schema shared by the main process and tests. */

export const RECOVERY_SCHEMA_VERSION = 1;
export const MAX_RECOVERY_BYTES = 100 * 1024 * 1024;

export interface RecoveryRecord {
  readonly schemaVersion: typeof RECOVERY_SCHEMA_VERSION;
  readonly timestamp: number;
  readonly appVersion: string;
  readonly path: string | null;
  readonly displayName: string;
  readonly workbook: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Validate a persisted recovery record.
 *
 * @param value - Parsed recovery.json.
 * @returns The record, or null when it is corrupt/incompatible.
 */
export function normalizeRecovery(value: unknown): RecoveryRecord | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== RECOVERY_SCHEMA_VERSION) return null;
  if (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)) return null;
  if (typeof value.appVersion !== 'string') return null;
  if (typeof value.displayName !== 'string' || value.displayName.length === 0) return null;
  if (value.path !== null && typeof value.path !== 'string') return null;
  if (!isRecord(value.workbook)) return null;
  return {
    schemaVersion: RECOVERY_SCHEMA_VERSION,
    timestamp: value.timestamp,
    appVersion: value.appVersion,
    path: value.path,
    displayName: value.displayName,
    workbook: value.workbook,
  };
}

/**
 * Build the display title for a recovered document.
 *
 * @param displayName - Original display name.
 * @returns The name with a `(Recovered)` suffix.
 */
export function recoveredTitle(displayName: string): string {
  const base = displayName.trim() || 'Untitled';
  return base.endsWith('(Recovered)') ? base : `${base} (Recovered)`;
}
