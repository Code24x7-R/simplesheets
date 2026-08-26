// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  loadMRU,
  addMRUEntry,
  removeMRUEntry,
  clearMRU,
  recordFileOpened,
  recordFileSaved,
  getMostRecent,
  type MRUEntry,
} from './mru';

describe('mru', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadMRU', () => {
    it('returns an empty array when no MRU exists', () => {
      expect(loadMRU()).toEqual([]);
    });

    it('loads and sorts entries most-recent-first', () => {
      addMRUEntry({ name: 'Old.ssjson', size: 100, source: 'local', timestamp: 1000 });
      addMRUEntry({ name: 'New.ssjson', size: 200, source: 'local', timestamp: 3000 });
      addMRUEntry({ name: 'Mid.ssjson', size: 150, source: 'local', timestamp: 2000 });

      const entries = loadMRU();
      expect(entries.map((e) => e.name)).toEqual(['New.ssjson', 'Mid.ssjson', 'Old.ssjson']);
    });

    it('filters out invalid entries from corrupted storage', () => {
      localStorage.setItem('simplesheets:mru', JSON.stringify([
        { id: 'valid', name: 'Good.ssjson', size: 100, timestamp: 1000, source: 'local' },
        { id: 'invalid', name: 'Bad', size: 'not-a-number', timestamp: 1000, source: 'local' },
        { broken: true },
      ]));

      const entries = loadMRU();
      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('Good.ssjson');
    });

    it('returns empty array for non-array JSON', () => {
      localStorage.setItem('simplesheets:mru', JSON.stringify({ not: 'an array' }));
      expect(loadMRU()).toEqual([]);
    });

    it('returns empty array for unparseable JSON', () => {
      localStorage.setItem('simplesheets:mru', '%%%not-json%%%');
      expect(loadMRU()).toEqual([]);
    });
  });

  describe('addMRUEntry', () => {
    it('adds a new entry with auto-generated id and timestamp', () => {
      const before = Date.now();
      const entries = addMRUEntry({ name: 'Budget.ssjson', size: 1024, source: 'local' });

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('Budget.ssjson');
      expect(entries[0].size).toBe(1024);
      expect(entries[0].source).toBe('local');
      expect(entries[0].id).toMatch(/^mru-/);
      expect(entries[0].timestamp).toBeGreaterThanOrEqual(before);
    });

    it('accepts explicit id and timestamp', () => {
      const entries = addMRUEntry({
        id: 'custom-id',
        name: 'Budget.ssjson',
        size: 100,
        source: 'local',
        timestamp: 5000,
      });
      expect(entries[0].id).toBe('custom-id');
      expect(entries[0].timestamp).toBe(5000);
    });

    it('prepends new entries to the front', () => {
      addMRUEntry({ name: 'First.ssjson', size: 100, source: 'local', timestamp: 1000 });
      const entries = addMRUEntry({ name: 'Second.ssjson', size: 200, source: 'local', timestamp: 2000 });

      expect(entries[0].name).toBe('Second.ssjson');
      expect(entries[1].name).toBe('First.ssjson');
    });

    it('deduplicates entries with the same name AND source (refreshes timestamp)', () => {
      addMRUEntry({ name: 'Budget.ssjson', size: 100, source: 'local', timestamp: 1000 });
      addMRUEntry({ name: 'Budget.ssjson', size: 200, source: 'local', timestamp: 5000 });

      const entries = loadMRU();
      expect(entries).toHaveLength(1);
      expect(entries[0].timestamp).toBe(5000);
      expect(entries[0].size).toBe(200);
    });

    it('does NOT deduplicate entries with different sources', () => {
      addMRUEntry({ name: 'Budget.ssjson', size: 100, source: 'local', timestamp: 1000 });
      addMRUEntry({ name: 'Budget.ssjson', size: 200, source: 'cloud', timestamp: 2000 });

      const entries = loadMRU();
      expect(entries).toHaveLength(2);
    });

    it('caps the list at MAX_ENTRIES (10)', () => {
      for (let i = 0; i < 15; i++) {
        addMRUEntry({ name: `File${i}.ssjson`, size: i, source: 'local', timestamp: i * 1000 });
      }
      const entries = loadMRU();
      expect(entries).toHaveLength(10);
      // Most recent (i=14) should be first
      expect(entries[0].name).toBe('File14.ssjson');
      // Oldest that survived (i=5) should be last
      expect(entries[9].name).toBe('File5.ssjson');
    });

    it('stores cloud provider metadata', () => {
      const entries = addMRUEntry({
        name: 'CloudBudget.ssjson',
        size: 0,
        source: 'cloud',
        provider: 'google',
        cloudFileId: 'drive-123',
        path: '/documents/CloudBudget.ssjson',
      });

      expect(entries[0].provider).toBe('google');
      expect(entries[0].cloudFileId).toBe('drive-123');
      expect(entries[0].path).toBe('/documents/CloudBudget.ssjson');
    });

    it('stores url source metadata', () => {
      const entries = addMRUEntry({
        name: 'SharedDoc',
        size: 0,
        source: 'url',
        path: 'https://simplesheets.app#doc=abc123',
      });

      expect(entries[0].source).toBe('url');
      expect(entries[0].path).toBe('https://simplesheets.app#doc=abc123');
    });
  });

  describe('removeMRUEntry', () => {
    it('removes an entry by id', () => {
      addMRUEntry({ id: 'keep', name: 'Keep.ssjson', size: 100, source: 'local', timestamp: 1000 });
      addMRUEntry({ id: 'remove', name: 'Remove.ssjson', size: 200, source: 'local', timestamp: 2000 });

      const entries = removeMRUEntry('remove');
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('keep');
    });

    it('is a no-op for non-existent id', () => {
      addMRUEntry({ id: 'only', name: 'Only.ssjson', size: 100, source: 'local', timestamp: 1000 });
      const entries = removeMRUEntry('nonexistent');
      expect(entries).toHaveLength(1);
    });
  });

  describe('clearMRU', () => {
    it('removes all entries', () => {
      addMRUEntry({ name: 'A.ssjson', size: 100, source: 'local', timestamp: 1000 });
      addMRUEntry({ name: 'B.ssjson', size: 200, source: 'local', timestamp: 2000 });

      clearMRU();
      expect(loadMRU()).toEqual([]);
    });

    it('is a no-op when list is already empty', () => {
      clearMRU();
      expect(loadMRU()).toEqual([]);
    });
  });

  describe('recordFileOpened', () => {
    it('records a local file open', () => {
      const entries = recordFileOpened('Imported.ssjson', 2048, 'local');
      expect(entries[0].name).toBe('Imported.ssjson');
      expect(entries[0].size).toBe(2048);
      expect(entries[0].source).toBe('local');
    });

    it('records a cloud file open with provider', () => {
      const entries = recordFileOpened('CloudDoc.ssjson', 0, 'cloud', {
        provider: 'onedrive',
        cloudFileId: 'ms-graph-456',
      });
      expect(entries[0].source).toBe('cloud');
      expect(entries[0].provider).toBe('onedrive');
      expect(entries[0].cloudFileId).toBe('ms-graph-456');
    });

    it('records a URL-opened document', () => {
      const entries = recordFileOpened('Shared', 0, 'url', {
        path: 'https://simplesheets.app#doc=xyz',
      });
      expect(entries[0].source).toBe('url');
    });
  });

  describe('recordFileSaved', () => {
    it('records a local file save', () => {
      const entries = recordFileSaved('Exported.ssjson', 4096, 'local');
      expect(entries[0].name).toBe('Exported.ssjson');
      expect(entries[0].size).toBe(4096);
      expect(entries[0].source).toBe('local');
    });

    it('records a cloud file save with provider', () => {
      const entries = recordFileSaved('CloudSave.ssjson', 0, 'cloud', {
        provider: 's3',
        cloudFileId: 's3-key-789',
        path: 'documents/CloudSave.ssjson',
      });
      expect(entries[0].source).toBe('cloud');
      expect(entries[0].provider).toBe('s3');
      expect(entries[0].cloudFileId).toBe('s3-key-789');
    });
  });

  describe('getMostRecent', () => {
    it('returns null when list is empty', () => {
      expect(getMostRecent()).toBeNull();
    });

    it('returns the most recent entry', () => {
      addMRUEntry({ name: 'Old.ssjson', size: 100, source: 'local', timestamp: 1000 });
      addMRUEntry({ name: 'New.ssjson', size: 200, source: 'local', timestamp: 5000 });
      addMRUEntry({ name: 'Mid.ssjson', size: 150, source: 'local', timestamp: 3000 });

      const recent = getMostRecent();
      expect(recent?.name).toBe('New.ssjson');
    });
  });

  describe('persistence', () => {
    it('persists across separate load calls (simulating page reload)', () => {
      addMRUEntry({ name: 'Persist.ssjson', size: 500, source: 'local', timestamp: 1000 });

      // Simulate a fresh load by reading directly from localStorage
      const raw = localStorage.getItem('simplesheets:mru');
      expect(raw).toBeTruthy();

      const parsed = JSON.parse(raw!) as MRUEntry[];
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('Persist.ssjson');
    });
  });
});
