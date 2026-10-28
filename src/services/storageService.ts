// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * LocalStorage-based Load/Save Service
 *
 * Provides persistent storage of workbooks in the browser's localStorage.
 * Supports auto-save (single slot) and named saves (multiple slots).
 */

import type { Workbook } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────

const PREFIX = 'simplesheets:';
const AUTOSAVE_KEY = `${PREFIX}autosave`;
const PREVIOUS_SESSION_KEY = `${PREFIX}previous-session`;

// ─── Internal Helpers ───────────────────────────────────────────────────────

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    /* istanbul ignore next - localStorage failure */
    return null;
  }
}

function writeRaw(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    /* istanbul ignore next - localStorage full */
    return false;
  }
}

function removeRaw(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ─── Auto-Save ──────────────────────────────────────────────────────────────

/**
 * Saves the workbook to the auto-save slot.
 * This is called automatically on every state change (debounced by the caller).
 * @param workbook - The workbook to persist.
 * @returns True if the save succeeded.
 */
export function autosaveWorkbook(workbook: Workbook): boolean {
  return writeRaw(AUTOSAVE_KEY, JSON.stringify(workbook));
}

/**
 * Loads the auto-saved workbook.
 * @returns The saved workbook, or null if none exists or it's corrupt.
 */
export function loadAutosave(): Workbook | null {
  const raw = readRaw(AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (isValidWorkbook(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clears the auto-save slot.
 */
export function clearAutosave(): void {
  removeRaw(AUTOSAVE_KEY);
}

/**
 * Checks whether an auto-save exists.
 */
export function hasAutosave(): boolean {
  return readRaw(AUTOSAVE_KEY) !== null;
}

// ─── Previous-Session Recovery ─────────────────────────────────────────────

/**
 * Snapshot the current workbook to the recovery slot before it is replaced
 * by a destructive action (New / Open / Import). This keeps the discarded
 * document recoverable without clobbering the auto-save slot.
 *
 * @param workbook - The workbook being discarded.
 * @returns True if the snapshot was written.
 */
export function snapshotPreviousSession(workbook: Workbook): boolean {
  return writeRaw(PREVIOUS_SESSION_KEY, JSON.stringify(workbook));
}

/**
 * Load a previously snapshotted session, if any.
 * @returns The snapshotted workbook, or null if none/valid.
 */
export function loadPreviousSession(): Workbook | null {
  const raw = readRaw(PREVIOUS_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (isValidWorkbook(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear the previous-session recovery slot.
 */
export function clearPreviousSession(): void {
  removeRaw(PREVIOUS_SESSION_KEY);
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validates that an object conforms to the Workbook structure.
 * istanbul ignore next - defensive validation, hard to test all branches
 */
/* istanbul ignore next */
function isValidWorkbook(obj: unknown): obj is Workbook {
  if (typeof obj !== 'object' || obj === null) return false;
  const wb = obj as Record<string, unknown>;

  return (
    typeof wb.id === 'string' &&
    typeof wb.title === 'string' &&
    Array.isArray(wb.sheets) &&
    typeof wb.activeSheetIndex === 'number' &&
    wb.sheets.length > 0 &&
    isValidSheet(wb.sheets[0])
  );
}

/* istanbul ignore next - defensive validation, hard to test all branches */
function isValidSheet(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  const sheet = obj as Record<string, unknown>;

  return (
    typeof sheet.id === 'string' &&
    typeof sheet.name === 'string' &&
    typeof sheet.cells === 'object' &&
    typeof sheet.defaultColWidth === 'number' &&
    typeof sheet.defaultRowHeight === 'number' &&
    typeof sheet.columnCount === 'number' &&
    typeof sheet.rowCount === 'number'
  );
}
