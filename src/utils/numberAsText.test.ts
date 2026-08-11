// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { isNumberStoredAsText } from './numberAsText';
import type { Cell } from '../types';

function cell(rawValue: string, style?: Cell['style']): Cell {
  return { rawValue, style };
}

describe('isNumberStoredAsText', () => {
  it('returns false for empty/undefined cells', () => {
    expect(isNumberStoredAsText(undefined)).toBe(false);
    expect(isNumberStoredAsText(cell(''))).toBe(false);
  });

  it('returns false for formulas', () => {
    expect(isNumberStoredAsText(cell('=A1+A2'))).toBe(false);
    expect(isNumberStoredAsText(cell('=SUM(A1:A3)'))).toBe(false);
  });

  it('detects leading apostrophe with numeric value', () => {
    expect(isNumberStoredAsText(cell("'123"))).toBe(true);
    expect(isNumberStoredAsText(cell("'3.14"))).toBe(true);
    expect(isNumberStoredAsText(cell("'-5"))).toBe(true);
  });

  it('returns false for leading apostrophe with non-numeric text', () => {
    expect(isNumberStoredAsText(cell("'hello"))).toBe(false);
    expect(isNumberStoredAsText(cell("'"))).toBe(false);
  });

  it('detects numeric value with text format (@)', () => {
    expect(isNumberStoredAsText(cell('123', { numberFormat: '@' }))).toBe(true);
    expect(isNumberStoredAsText(cell('3.14', { numberFormat: '@' }))).toBe(true);
  });

  it('returns false for non-numeric value with text format', () => {
    expect(isNumberStoredAsText(cell('hello', { numberFormat: '@' }))).toBe(false);
  });

  it('returns false for plain numeric string without text marker', () => {
    // Plain "123" is treated as a number by the engine, not stored as text
    expect(isNumberStoredAsText(cell('123'))).toBe(false);
  });

  it('returns false for number format (not text format)', () => {
    expect(isNumberStoredAsText(cell('123', { numberFormat: '0.00' }))).toBe(false);
  });
});
