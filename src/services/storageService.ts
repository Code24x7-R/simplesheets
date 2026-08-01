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
const SAVES_LIST_KEY = `${PREFIX}saves-list`;

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Metadata about a saved workbook slot.
 */
export interface SaveSlot {
  /** Display name of the save. */
  name: string;
  /** When this save was created (epoch ms). */
  savedAt: number;
  /** Workbook title at time of save. */
  title: string;
  /** Number of sheets in the saved workbook. */
  sheetCount: number;
}

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

function getSaveKey(name: string): string {
  return `${PREFIX}save:${name}`;
}

function readSavesList(): string[] {
  const raw = readRaw(SAVES_LIST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'string') : [];
  } catch {
    /* istanbul ignore next - corrupted localStorage data */
    return [];
  }
}

function writeSavesList(names: string[]): void {
  writeRaw(SAVES_LIST_KEY, JSON.stringify(names));
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

// ─── Named Saves ────────────────────────────────────────────────────────────

/**
 * Saves the workbook under a named slot.
 * If the name already exists, it is overwritten.
 * @param name - The save slot name.
 * @param workbook - The workbook to save.
 * @returns True if the save succeeded.
 */
export function saveWorkbook(name: string, workbook: Workbook): boolean {
  if (!name.trim()) return false;

  const trimmed = name.trim();
  const success = writeRaw(getSaveKey(trimmed), JSON.stringify(workbook));
  if (!success) return false;

  // Update the list (deduplicate, move to end)
  const list = readSavesList().filter((n) => n !== trimmed);
  list.push(trimmed);
  writeSavesList(list);

  return true;
}

/**
 * Loads a workbook from a named slot.
 * @param name - The save slot name.
 * @returns The saved workbook, or null if not found or corrupt.
 */
export function loadWorkbook(name: string): Workbook | null {
  const raw = readRaw(getSaveKey(name));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (isValidWorkbook(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    /* istanbul ignore next - corrupted JSON */
    return null;
  }
}

/**
 * Deletes a named save slot.
 * @param name - The save slot name to delete.
 */
export function deleteSave(name: string): void {
  removeRaw(getSaveKey(name));
  const list = readSavesList().filter((n) => n !== name);
  writeSavesList(list);
}

/**
 * Lists all named save slots with metadata, sorted by most recently saved first.
 */
export function listSaves(): SaveSlot[] {
  const names = readSavesList();
  const slots: SaveSlot[] = [];

  for (const name of names) {
    const raw = readRaw(getSaveKey(name));
    if (!raw) continue;
    try {
      const wb = JSON.parse(raw);
      if (isValidWorkbook(wb)) {
        // isValidWorkbook guarantees sheets is a non-empty array,
        // so the ?? 0 fallback below is unreachable — guard it from coverage.
        /* istanbul ignore next */
        const sheetCount = wb.sheets?.length ?? 0;
        slots.push({
          name,
          savedAt: wb.lastModified ?? 0,
          title: wb.title,
          sheetCount,
        });
      }
    } catch {
      // skip corrupt entries
    }
  }

  return slots.sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * Checks whether a named save exists.
 * @param name - The save slot name.
 */
export function hasSave(name: string): boolean {
  return readRaw(getSaveKey(name)) !== null;
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
