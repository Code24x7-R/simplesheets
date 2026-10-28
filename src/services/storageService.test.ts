// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  autosaveWorkbook,
  loadAutosave,
  clearAutosave,
  hasAutosave,
  snapshotPreviousSession,
  loadPreviousSession,
  clearPreviousSession,
} from './storageService';
import type { Workbook } from '../types';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const testWorkbook: Workbook = {
  id: 'test-wb',
  title: 'Test Workbook',
  sheets: [
    {
      id: 'sheet-1',
      name: 'Sheet1',
      cells: {
        '0:0': { rawValue: 'Hello' },
        '0:1': { rawValue: '42' },
      },
      defaultColWidth: 100,
      defaultRowHeight: 28,
      columnWidths: {},
      rowHeights: {},
      columnCount: 26,
      rowCount: 100,
      frozenColumns: 0,
      frozenRows: 0,
    },
  ],
  activeSheetIndex: 0,
  lastModified: 1234567890,
};

const anotherWorkbook: Workbook = {
  id: 'another-wb',
  title: 'Another Workbook',
  sheets: [
    {
      id: 'sheet-2',
      name: 'Data',
      cells: {},
      defaultColWidth: 120,
      defaultRowHeight: 30,
      columnWidths: {},
      rowHeights: {},
      columnCount: 10,
      rowCount: 50,
      frozenColumns: 1,
      frozenRows: 1,
    },
  ],
  activeSheetIndex: 0,
  lastModified: 9999999999,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function clearAllStorage(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('simplesheets:')) {
      keys.push(key);
    }
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Storage Service (auto-save)', () => {
  beforeEach(() => {
    clearAllStorage();
  });

  afterAll(() => {
    clearAllStorage();
  });

  it('saves and loads a workbook', () => {
    autosaveWorkbook(testWorkbook);
    const loaded = loadAutosave();
    expect(loaded).not.toBeNull();
    expect(loaded?.title).toBe('Test Workbook');
    expect(loaded?.sheets[0].cells['0:0']?.rawValue).toBe('Hello');
  });

  it('returns null when no auto-save exists', () => {
    expect(loadAutosave()).toBeNull();
  });

  it('hasAutosave returns false when empty', () => {
    expect(hasAutosave()).toBe(false);
  });

  it('hasAutosave returns true after saving', () => {
    autosaveWorkbook(testWorkbook);
    expect(hasAutosave()).toBe(true);
  });

  it('clearAutosave removes the saved workbook', () => {
    autosaveWorkbook(testWorkbook);
    clearAutosave();
    expect(loadAutosave()).toBeNull();
    expect(hasAutosave()).toBe(false);
  });

  it('clearAutosave is safe when nothing is saved', () => {
    expect(() => clearAutosave()).not.toThrow();
  });

  it('overwrites previous auto-save', () => {
    autosaveWorkbook(testWorkbook);
    autosaveWorkbook(anotherWorkbook);
    const loaded = loadAutosave();
    expect(loaded?.title).toBe('Another Workbook');
  });

  it('returns null for corrupt data', () => {
    localStorage.setItem('simplesheets:autosave', 'not valid json{{{');
    expect(loadAutosave()).toBeNull();
  });

  it('returns null for non-workbook data', () => {
    localStorage.setItem('simplesheets:autosave', '{"foo":"bar"}');
    expect(loadAutosave()).toBeNull();
  });

  it('preserves full workbook structure through autosave', () => {
    autosaveWorkbook(testWorkbook);
    const loaded = loadAutosave()!;
    expect(loaded.id).toBe(testWorkbook.id);
    expect(loaded.title).toBe(testWorkbook.title);
    expect(loaded.activeSheetIndex).toBe(testWorkbook.activeSheetIndex);
    expect(loaded.sheets[0].columnCount).toBe(26);
    expect(loaded.sheets[0].rowCount).toBe(100);
    expect(loaded.sheets[0].frozenColumns).toBe(0);
    expect(loaded.sheets[0].frozenRows).toBe(0);
    expect(loaded.sheets[0].defaultColWidth).toBe(100);
    expect(loaded.sheets[0].defaultRowHeight).toBe(28);
    expect(loaded.sheets[0].cells['0:0']?.rawValue).toBe('Hello');
    expect(loaded.sheets[0].cells['0:1']?.rawValue).toBe('42');
  });

  it('returns null for a workbook with an invalid first sheet', () => {
    localStorage.setItem(
      'simplesheets:autosave',
      JSON.stringify({
        id: 'x',
        title: 'T',
        sheets: [{ id: 's1', name: 'Sheet1', cells: {} }],
        activeSheetIndex: 0,
      }),
    );
    expect(loadAutosave()).toBeNull();
  });

  // ── Previous-Session Recovery ──────────────────────────────────────────

  it('snapshots and loads a previous session', () => {
    snapshotPreviousSession(testWorkbook);
    const restored = loadPreviousSession();
    expect(restored).not.toBeNull();
    expect(restored?.title).toBe('Test Workbook');
  });

  it('returns null when no previous session exists', () => {
    expect(loadPreviousSession()).toBeNull();
  });

  it('clears the previous session slot', () => {
    snapshotPreviousSession(testWorkbook);
    clearPreviousSession();
    expect(loadPreviousSession()).toBeNull();
  });

  it('returns null for corrupt previous session data', () => {
    localStorage.setItem('simplesheets:previous-session', 'not json{{{');
    expect(loadPreviousSession()).toBeNull();
  });

  it('returns null for previous session that is not a workbook', () => {
    localStorage.setItem('simplesheets:previous-session', '{"foo":"bar"}');
    expect(loadPreviousSession()).toBeNull();
  });
});
