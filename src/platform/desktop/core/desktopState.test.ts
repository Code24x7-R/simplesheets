// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  MAX_RECENT_FILES,
  clearRecents,
  createDefaultState,
  normalizeState,
  removeRecent,
  upsertRecent,
  type RecentEntry,
} from './desktopState';

function entry(id: string, path?: string, timestamp = 1): RecentEntry {
  return {
    id,
    name: `${id}.ssjson`,
    size: 10,
    timestamp,
    source: 'local',
    path,
    canReopen: Boolean(path),
  };
}

describe('desktopState', () => {
  it('creates the default state', () => {
    expect(createDefaultState()).toEqual({
      schemaVersion: 1,
      recents: [],
      lastPath: null,
      lastDirectory: null,
      reopenLast: true,
      cleanExit: true,
      legacyImported: false,
    });
  });

  it('normalizes valid state and drops invalid recents', () => {
    const state = normalizeState({
      schemaVersion: 1,
      recents: [entry('a', 'C:/a.ssjson'), { bad: true }],
      lastPath: 'C:/a.ssjson',
      lastDirectory: 'C:/',
      reopenLast: false,
      cleanExit: false,
    });
    expect(state).not.toBeNull();
    expect(state?.recents).toHaveLength(1);
    expect(state?.reopenLast).toBe(false);
    expect(state?.cleanExit).toBe(false);
  });

  it('rejects an unknown schema version', () => {
    expect(normalizeState({ schemaVersion: 2, recents: [] })).toBeNull();
    expect(normalizeState(null)).toBeNull();
  });

  it('upserts by path and caps the list', () => {
    let state = createDefaultState();
    state = upsertRecent(state, entry('a', 'C:/a.ssjson'));
    state = upsertRecent(state, entry('b', 'C:/b.ssjson'));
    state = upsertRecent(state, entry('a2', 'c:\\A.ssjson', 2));
    expect(state.recents[0].id).toBe('a2');
    expect(state.recents).toHaveLength(2);

    for (let i = 0; i < MAX_RECENT_FILES + 5; i += 1) {
      state = upsertRecent(state, entry(`n${i}`, `C:/n${i}.ssjson`, i));
    }
    expect(state.recents).toHaveLength(MAX_RECENT_FILES);
  });

  it('removes and clears recents', () => {
    let state = upsertRecent(createDefaultState(), entry('a', 'C:/a.ssjson'));
    state = upsertRecent(state, entry('b', 'C:/b.ssjson'));
    state = removeRecent(state, 'a');
    expect(state.recents.map((item) => item.id)).toEqual(['b']);
    expect(clearRecents(state).recents).toEqual([]);
  });
});
