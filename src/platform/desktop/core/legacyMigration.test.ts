// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { parseLegacyAutosave, parseLegacyMru } from './legacyMigration';

describe('parseLegacyMru', () => {
  it('imports entries, marks pathless entries non-reopenable, and sorts', () => {
    const raw = JSON.stringify([
      { id: 'a', name: 'A', size: 1, timestamp: 10, source: 'local', path: 'C:/a.ssjson' },
      { id: 'b', name: 'B', size: 1, timestamp: 20, source: 'cloud', provider: 'gdrive' },
      { id: 'bad' },
    ]);
    const entries = parseLegacyMru(raw);
    expect(entries.map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(entries[0].canReopen).toBe(false);
    expect(entries[1].canReopen).toBe(true);
  });

  it('returns an empty list for missing or corrupt payloads', () => {
    expect(parseLegacyMru(null)).toEqual([]);
    expect(parseLegacyMru('{')).toEqual([]);
    expect(parseLegacyMru('{}')).toEqual([]);
  });
});

describe('parseLegacyAutosave', () => {
  it('returns a workbook-shaped object', () => {
    expect(parseLegacyAutosave('{"sheets":[]}')).toEqual({ sheets: [] });
  });

  it('rejects missing or corrupt payloads', () => {
    expect(parseLegacyAutosave(null)).toBeNull();
    expect(parseLegacyAutosave('{')).toBeNull();
    expect(parseLegacyAutosave('{"title":"x"}')).toBeNull();
  });
});
