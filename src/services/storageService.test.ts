import {
  autosaveWorkbook,
  loadAutosave,
  clearAutosave,
  hasAutosave,
  saveWorkbook,
  loadWorkbook,
  deleteSave,
  listSaves,
  hasSave,
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

describe('Storage Service', () => {
  beforeEach(() => {
    clearAllStorage();
  });

  afterAll(() => {
    clearAllStorage();
  });

  // ── Auto-Save ───────────────────────────────────────────────────────────

  describe('autosave', () => {
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
  });

  // ── Named Saves ─────────────────────────────────────────────────────────

  describe('named saves', () => {
    it('saves and loads a named workbook', () => {
      saveWorkbook('MySave', testWorkbook);
      const loaded = loadWorkbook('MySave');
      expect(loaded).not.toBeNull();
      expect(loaded?.title).toBe('Test Workbook');
    });

    it('returns null for non-existent save', () => {
      expect(loadWorkbook('DoesNotExist')).toBeNull();
    });

    it('hasSave returns correct boolean', () => {
      expect(hasSave('MySave')).toBe(false);
      saveWorkbook('MySave', testWorkbook);
      expect(hasSave('MySave')).toBe(true);
    });

    it('trims save names', () => {
      saveWorkbook('  Trimmed  ', testWorkbook);
      expect(hasSave('Trimmed')).toBe(true);
      expect(hasSave('  Trimmed  ')).toBe(false);
    });

    it('returns false for empty save name', () => {
      expect(saveWorkbook('', testWorkbook)).toBe(false);
      expect(saveWorkbook('   ', testWorkbook)).toBe(false);
    });

    it('overwrites existing save with same name', () => {
      saveWorkbook('Slot1', testWorkbook);
      saveWorkbook('Slot1', anotherWorkbook);
      const loaded = loadWorkbook('Slot1');
      expect(loaded?.title).toBe('Another Workbook');
    });

    it('deleteSave removes the slot', () => {
      saveWorkbook('ToDelete', testWorkbook);
      expect(hasSave('ToDelete')).toBe(true);
      deleteSave('ToDelete');
      expect(hasSave('ToDelete')).toBe(false);
      expect(loadWorkbook('ToDelete')).toBeNull();
    });

    it('deleteSave is safe for non-existent name', () => {
      expect(() => deleteSave('NonExistent')).not.toThrow();
    });

    it('listSaves returns empty array when no saves', () => {
      expect(listSaves()).toEqual([]);
    });

    it('listSaves returns all named saves with metadata', () => {
      saveWorkbook('SaveA', testWorkbook);
      saveWorkbook('SaveB', anotherWorkbook);
      const saves = listSaves();
      expect(saves).toHaveLength(2);
      expect(saves.map((s) => s.name)).toContain('SaveA');
      expect(saves.map((s) => s.name)).toContain('SaveB');
      expect(saves.find((s) => s.name === 'SaveA')?.title).toBe('Test Workbook');
      expect(saves.find((s) => s.name === 'SaveA')?.sheetCount).toBe(1);
    });

    it('listSaves sorts by most recently saved first', () => {
      saveWorkbook('Old', testWorkbook);
      saveWorkbook('New', anotherWorkbook);
      const saves = listSaves();
      expect(saves[0].name).toBe('New');
      expect(saves[1].name).toBe('Old');
    });

    it('listSaves excludes corrupt slots', () => {
      saveWorkbook('Good', testWorkbook);
      localStorage.setItem('simplesheets:save:Corrupt', 'not json');
      const saves = listSaves();
      expect(saves).toHaveLength(1);
      expect(saves[0].name).toBe('Good');
    });

    it('moving a re-saved slot to end of list', () => {
      saveWorkbook('First', testWorkbook);
      saveWorkbook('Second', anotherWorkbook);
      saveWorkbook('First', testWorkbook); // re-save
      const saves = listSaves();
      // Re-saved 'First' should move to end of insertion order,
      // but listSaves sorts by savedAt (lastModified) descending.
      // Since both use the same timestamp, stable sort keeps ['Second', 'First'].
      expect(saves.map((s) => s.name)).toEqual(['Second', 'First']);
      expect(saves).toHaveLength(2); // no duplicates
    });
  });

  // ── Round-Trip ──────────────────────────────────────────────────────────

  describe('round-trip', () => {
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

    it('preserves full workbook structure through named save', () => {
      saveWorkbook('FullTest', anotherWorkbook);
      const loaded = loadWorkbook('FullTest')!;
      expect(loaded.sheets[0].frozenColumns).toBe(1);
      expect(loaded.sheets[0].frozenRows).toBe(1);
      expect(loaded.sheets[0].defaultColWidth).toBe(120);
    });
  });

  // ── Invalid Data ──────────────────────────────────────────────────────

  describe('invalid data handling', () => {
    it('loadWorkbook returns null for invalid workbook structure', () => {
      // Save a valid workbook first
      saveWorkbook('ValidSave', testWorkbook);
      // Corrupt the data so it fails validation (missing required fields)
      localStorage.setItem('simplesheets:save:ValidSave', '{"id":"x","title":"T"}');
      const result = loadWorkbook('ValidSave');
      expect(result).toBeNull();
    });
  });
});
