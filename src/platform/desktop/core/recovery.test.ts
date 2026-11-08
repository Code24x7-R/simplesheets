// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { normalizeRecovery, recoveredTitle } from './recovery';

const VALID = {
  schemaVersion: 1,
  timestamp: 100,
  appVersion: '0.1.0',
  path: 'C:/a.ssjson',
  displayName: 'Budget',
  workbook: { sheets: [] },
};

describe('recovery', () => {
  it('normalizes a valid record', () => {
    expect(normalizeRecovery(VALID)).toEqual(VALID);
  });

  it('accepts a null path', () => {
    expect(normalizeRecovery({ ...VALID, path: null })?.path).toBeNull();
  });

  it.each([
    null,
    { ...VALID, schemaVersion: 2 },
    { ...VALID, timestamp: 'now' },
    { ...VALID, displayName: '' },
    { ...VALID, path: 4 },
    { ...VALID, workbook: null },
  ])('rejects an invalid record: %p', (value) => {
    expect(normalizeRecovery(value)).toBeNull();
  });

  it('adds the recovered suffix once', () => {
    expect(recoveredTitle('Budget')).toBe('Budget (Recovered)');
    expect(recoveredTitle('Budget (Recovered)')).toBe('Budget (Recovered)');
    expect(recoveredTitle('  ')).toBe('Untitled (Recovered)');
  });
});
