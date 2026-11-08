// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { resolveEdition } from './edition';

describe('resolveEdition', () => {
  it('reports development for unpackaged runs', () => {
    expect(resolveEdition(false, undefined)).toBe('development');
    expect(resolveEdition(false, 'C:/portable')).toBe('development');
  });

  it('reports portable when the portable env is set', () => {
    expect(resolveEdition(true, 'C:/portable')).toBe('portable');
  });

  it('reports installed for packaged non-portable runs', () => {
    expect(resolveEdition(true, undefined)).toBe('installed');
    expect(resolveEdition(true, '')).toBe('installed');
  });
});
