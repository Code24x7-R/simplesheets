// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { hasOnlyKeys, isFiniteNumber } from './ipcValidation';

describe('ipcValidation', () => {
  it('accepts allowlisted fields only', () => {
    expect(hasOnlyKeys({ a: 1, b: 2 }, ['a', 'b'])).toBe(true);
    expect(hasOnlyKeys({ a: 1, extra: 2 }, ['a'])).toBe(false);
    expect(hasOnlyKeys({}, ['a'])).toBe(true);
  });

  it('rejects non-finite numbers', () => {
    expect(isFiniteNumber(1)).toBe(true);
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isFiniteNumber('1')).toBe(false);
  });
});
