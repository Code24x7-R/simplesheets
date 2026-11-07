// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { classifySaveTarget } from './saveTarget';

const V1 = { mtimeMs: 1000, size: 10 };

describe('classifySaveTarget', () => {
  it('writes a new file with no expected version', () => {
    expect(classifySaveTarget(null, null)).toBe('write');
  });

  it('writes when the on-disk version matches', () => {
    expect(classifySaveTarget({ ...V1 }, { ...V1 })).toBe('write');
  });

  it('reports a conflict when mtime changed', () => {
    expect(classifySaveTarget({ mtimeMs: 2000, size: 10 }, V1)).toBe('conflict');
  });

  it('reports a conflict when size changed', () => {
    expect(classifySaveTarget({ mtimeMs: 1000, size: 11 }, V1)).toBe('conflict');
  });

  it('reports a missing file when a known version disappeared', () => {
    expect(classifySaveTarget(null, V1)).toBe('missing');
  });

  it('writes over an existing file for Save As', () => {
    expect(classifySaveTarget({ ...V1 }, null)).toBe('write');
  });
});
