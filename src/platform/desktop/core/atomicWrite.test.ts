// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * @jest-environment node
 */
import { mkdtemp, readFile, readdir, rm, writeFile, chmod, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { atomicWriteFile } from './atomicWrite';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-atomic-'));
});

afterEach(async () => {
  await chmod(dir, 0o700).catch(() => undefined);
  await rm(dir, { recursive: true, force: true });
});

describe('atomicWriteFile', () => {
  it('creates a file and returns its version', async () => {
    const target = path.join(dir, 'doc.ssjson');
    const result = await atomicWriteFile(target, '{"title":"one"}');
    expect(await readFile(target, 'utf8')).toBe('{"title":"one"}');
    const info = await stat(target);
    expect(result.size).toBe(info.size);
    expect(result.mtimeMs).toBe(info.mtimeMs);
    expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('replaces an existing file and leaves no temp file', async () => {
    const target = path.join(dir, 'doc.ssjson');
    await writeFile(target, 'old', 'utf8');
    await atomicWriteFile(target, 'new');
    expect(await readFile(target, 'utf8')).toBe('new');
    expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('writes binary data', async () => {
    const target = path.join(dir, 'doc.bin');
    await atomicWriteFile(target, new Uint8Array([1, 2, 3]));
    expect([...await readFile(target)]).toEqual([1, 2, 3]);
  });

  it('leaves the original intact and removes the temp file on failure', async () => {
    const target = path.join(dir, 'target');
    await writeFile(target, 'original', 'utf8');
    // Renaming a file over a non-empty directory fails after the temp write.
    const directoryTarget = path.join(dir, 'folder');
    await import('node:fs/promises').then((fs) => fs.mkdir(directoryTarget));
    await writeFile(path.join(directoryTarget, 'keep'), 'x', 'utf8');

    await expect(atomicWriteFile(directoryTarget, 'replacement')).rejects.toBeDefined();
    expect(await readFile(target, 'utf8')).toBe('original');
    expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });
});
