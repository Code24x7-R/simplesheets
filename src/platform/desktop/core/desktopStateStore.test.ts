// @jest-environment node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DesktopStateStore } from './desktopStateStore';

async function tempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'simplesheets-state-'));
}

describe('DesktopStateStore', () => {
  let dir: string;
  let store: DesktopStateStore;

  beforeEach(async () => {
    dir = await tempDir();
    store = new DesktopStateStore(dir, '0.1.0');
    await store.init();
  });

  afterEach(async () => {
    await store.dispose();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('starts default state and marks the run unclean until clean exit', async () => {
    const info = store.getStartupInfo(false);
    expect(info.recents).toEqual([]);
    expect(info.unclean).toBe(false);
    expect(info.needsLegacyImport).toBe(true);

    await store.markCleanExit();
    const raw = JSON.parse(await fs.readFile(path.join(dir, 'state.json'), 'utf8'));
    expect(raw.cleanExit).toBe(true);
  });

  it('keeps recovery when quitting with unsaved work', async () => {
    store.writeRecovery({ workbook: { sheets: [] }, path: null, displayName: 'Dirty' });
    await store.flushRecovery();
    await store.markCleanExit();
    const raw = JSON.parse(await fs.readFile(path.join(dir, 'state.json'), 'utf8'));
    expect(raw.cleanExit).toBe(false);
    await expect(fs.stat(path.join(dir, 'recovery.json'))).resolves.toBeTruthy();
  });

  it('persists recents, last path, and the reopen preference', async () => {
    store.upsertRecent({
      name: 'Budget.ssjson',
      size: 120,
      source: 'local',
      path: 'C:/docs/Budget.ssjson',
      canReopen: true,
    });
    store.setLastPath('C:/docs/Budget.ssjson');
    store.setReopenLast(false);
    await store.flushState();

    const reopened = new DesktopStateStore(dir, '0.1.0');
    await reopened.init();
    const state = reopened.getState();
    expect(state.recents[0].name).toBe('Budget.ssjson');
    expect(state.lastPath).toBe('C:/docs/Budget.ssjson');
    expect(state.lastDirectory).toBe('C:/docs');
    expect(state.reopenLast).toBe(false);
    await reopened.dispose();
  });

  it('removes and clears recents', async () => {
    const entry = store.upsertRecent({ name: 'A.ssjson', size: 1, source: 'local' });
    store.upsertRecent({ name: 'B.ssjson', size: 1, source: 'local' });
    store.removeRecent(entry.id);
    expect(store.getState().recents.map((item) => item.name)).toEqual(['B.ssjson']);
    store.clearRecents();
    expect(store.getState().recents).toEqual([]);
  });

  it('writes, loads, and clears a recovery snapshot', async () => {
    const result = store.writeRecovery({
      workbook: { sheets: [{ name: 'Sheet1', cells: {} }] },
      path: 'C:/docs/Budget.ssjson',
      displayName: 'Budget',
    });
    expect(result.ok).toBe(true);
    await store.flushRecovery();

    const loaded = await store.loadRecovery();
    expect(loaded?.displayName).toBe('Budget');
    expect(loaded?.workbook).toEqual({ sheets: [{ name: 'Sheet1', cells: {} }] });
    expect(loaded?.pathExists).toBe(false);

    await store.clearRecovery();
    expect(await store.loadRecovery()).toBeNull();
    await expect(fs.stat(path.join(dir, 'recovery.json'))).rejects.toThrow();
  });

  it('rejects a recovery payload above the configured limit', async () => {
    const limited = new DesktopStateStore(dir, '0.1.0', 1024);
    await limited.init();
    const result = limited.writeRecovery({
      workbook: { sheets: [], padding: 'x'.repeat(4096) },
      path: null,
      displayName: 'Too big',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('TOO_LARGE');
    await limited.dispose();
  });

  it('rejects an unserializable recovery payload', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const result = store.writeRecovery({
      workbook: circular,
      path: null,
      displayName: 'Bad',
    });
    expect(result.ok).toBe(false);
  });

  it('quarantines corrupt state and recovery files', async () => {
    await fs.writeFile(path.join(dir, 'state.json'), '{not json');
    await fs.writeFile(path.join(dir, 'recovery.json'), '{not json');

    const reopened = new DesktopStateStore(dir, '0.1.0');
    await reopened.init();
    expect(reopened.getState().recents).toEqual([]);
    expect(reopened.getRecovery()).toBeNull();
    await expect(fs.stat(path.join(dir, 'state.json.corrupt'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dir, 'recovery.json'))).rejects.toThrow();
    await reopened.dispose();
  });

  it('resets desktop state without touching user documents', async () => {
    store.upsertRecent({ name: 'A.ssjson', size: 1, source: 'local' });
    store.setWindowBounds({ x: 1, y: 2, width: 900, height: 600 });
    store.writeRecovery({ workbook: { sheets: [] }, path: null, displayName: 'Dirty' });
    await store.flushRecovery();
    await store.resetApplicationData();
    expect(store.getState().recents).toEqual([]);
    expect(store.getState().windowBounds).toBeNull();
    expect(await store.loadRecovery()).toBeNull();
  });

  it('imports legacy MRU and autosave once', async () => {
    const result = await store.importLegacy(
      JSON.stringify([
        {
          id: 'legacy',
          name: 'Legacy.ssjson',
          size: 10,
          timestamp: 5,
          source: 'local',
          path: 'C:/docs/Legacy.ssjson',
        },
      ]),
      JSON.stringify({ title: 'Recovered Budget', sheets: [] }),
    );

    expect(result.imported).toBe(1);
    expect(result.recovery?.displayName).toBe('Recovered Budget');
    expect(store.getState().recents[0].name).toBe('Legacy.ssjson');
    expect(store.getStartupInfo(false).needsLegacyImport).toBe(false);

    const second = await store.importLegacy(null, null);
    expect(second.imported).toBe(0);
  });
});
