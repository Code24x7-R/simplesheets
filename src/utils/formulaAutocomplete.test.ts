// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { searchFunctions, getFunctionInfo, getAllFunctionNames, getFunctionCount } from './formulaAutocomplete';

describe('searchFunctions', () => {
  it('returns all functions for empty query', () => {
    const results = searchFunctions('');
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns limited results', () => {
    const results = searchFunctions('', 5);
    expect(results.length).toBe(5);
  });

  it('finds exact prefix match', () => {
    const results = searchFunctions('SUM');
    expect(results[0].name).toBe('SUM');
  });

  it('finds partial prefix matches', () => {
    const results = searchFunctions('SU');
    expect(results.some((f) => f.name === 'SUM')).toBe(true);
    expect(results.some((f) => f.name === 'SUMIF')).toBe(true);
    expect(results.some((f) => f.name === 'SUMIFS')).toBe(true);
  });

  it('finds substring matches', () => {
    const results = searchFunctions('ERAGE');
    expect(results.some((f) => f.name === 'AVERAGE')).toBe(true);
  });

  it('finds description matches', () => {
    const results = searchFunctions('square');
    expect(results.some((f) => f.name === 'SQRT')).toBe(true);
  });

  it('returns empty array for no matches', () => {
    const results = searchFunctions('XYZNONEXISTENT');
    expect(results).toHaveLength(0);
  });

  it('is case insensitive', () => {
    const results = searchFunctions('sum');
    expect(results.some((f) => f.name === 'SUM')).toBe(true);
  });

  it('prioritizes prefix matches over substring', () => {
    const results = searchFunctions('S');
    // SUM should come before SEARCH since SUM is a prefix match
    const sumIdx = results.findIndex((f) => f.name === 'SUM');
    const searchIdx = results.findIndex((f) => f.name === 'SEARCH');
    if (sumIdx >= 0 && searchIdx >= 0) {
      expect(sumIdx).toBeLessThan(searchIdx);
    }
  });

  it('returns functions with complete info', () => {
    const results = searchFunctions('SUM');
    const sum = results.find((f) => f.name === 'SUM');
    expect(sum).toBeDefined();
    expect(sum?.description).toBeTruthy();
    expect(sum?.signature).toBeTruthy();
    expect(sum?.category).toBeTruthy();
  });
});

describe('getFunctionInfo', () => {
  it('returns info for valid function', () => {
    const info = getFunctionInfo('SUM');
    expect(info).not.toBeNull();
    expect(info?.name).toBe('SUM');
  });

  it('is case insensitive', () => {
    const info = getFunctionInfo('sum');
    expect(info).not.toBeNull();
    expect(info?.name).toBe('SUM');
  });

  it('returns null for unknown function', () => {
    const info = getFunctionInfo('NONEXISTENT');
    expect(info).toBeNull();
  });

  it('returns correct signature', () => {
    const info = getFunctionInfo('IF');
    expect(info?.signature).toContain('condition');
  });
});

describe('getAllFunctionNames', () => {
  it('returns an array of strings', () => {
    const names = getAllFunctionNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
    expect(typeof names[0]).toBe('string');
  });

  it('includes common functions', () => {
    const names = getAllFunctionNames();
    expect(names).toContain('SUM');
    expect(names).toContain('AVERAGE');
    expect(names).toContain('IF');
    expect(names).toContain('VLOOKUP');
  });
});

describe('getFunctionCount', () => {
  it('returns a positive number', () => {
    expect(getFunctionCount()).toBeGreaterThan(0);
  });

  it('matches the length of all names', () => {
    expect(getFunctionCount()).toBe(getAllFunctionNames().length);
  });
});
