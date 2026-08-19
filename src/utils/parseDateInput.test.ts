// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { parseDateInput } from './formulaEngine';

describe('parseDateInput', () => {
  // ── Australian format (dd/mm/yyyy) ─────────────────────────────────
  it('parses dd/mm/yyyy with slashes', () => {
    expect(parseDateInput('15/03/2026')).toBe('2026-03-15');
  });

  it('parses dd-mm-yyyy with dashes', () => {
    expect(parseDateInput('15-03-2026')).toBe('2026-03-15');
  });

  it('parses dd.mm.yyyy with dots', () => {
    expect(parseDateInput('15.03.2026')).toBe('2026-03-15');
  });

  it('parses backslash-separated date', () => {
    const input = String.raw`15\03\2026`;
    expect(parseDateInput(input)).toBe('2026-03-15');
  });

  it('requires exactly 2 identical separators (rejects 1 separator)', () => {
    expect(parseDateInput('15/032026')).toBeNull();
  });

  it('requires exactly 2 separators (rejects 3+ parts with mixed separators)', () => {
    expect(parseDateInput('2026-03-15-')).toBeNull();
  });

  it('parses single-digit day and month', () => {
    expect(parseDateInput('1/1/2026')).toBe('2026-01-01');
  });

  // ── ISO format (yyyy-mm-dd) ────────────────────────────────────────
  it('parses yyyy-mm-dd', () => {
    expect(parseDateInput('2026-03-15')).toBe('2026-03-15');
  });

  it('parses yyyy/mm/dd', () => {
    expect(parseDateInput('2026/03/15')).toBe('2026-03-15');
  });

  // ── 2-digit year ───────────────────────────────────────────────────
  it('parses dd/mm/yy with 2-digit year (0-49 → 2000s)', () => {
    expect(parseDateInput('15/03/26')).toBe('2026-03-15');
  });

  it('parses dd/mm/yy with 2-digit year (50-99 → 1900s)', () => {
    expect(parseDateInput('15/03/99')).toBe('1999-03-15');
  });

  // ── Validation ─────────────────────────────────────────────────────
  it('rejects invalid month (>12)', () => {
    expect(parseDateInput('15/13/2026')).toBeNull();
  });

  it('rejects invalid day (>31)', () => {
    expect(parseDateInput('32/01/2026')).toBeNull();
  });

  it('rejects day exceeding month days (Feb 30)', () => {
    expect(parseDateInput('30/02/2026')).toBeNull();
  });

  it('rejects Feb 29 in non-leap year', () => {
    expect(parseDateInput('29/02/2025')).toBeNull();
  });

  it('accepts Feb 29 in leap year', () => {
    expect(parseDateInput('29/02/2024')).toBe('2024-02-29');
  });

  it('rejects mixed separators', () => {
    expect(parseDateInput('15/03-2026')).toBeNull();
  });

  it('rejects plain numbers', () => {
    expect(parseDateInput('12345')).toBeNull();
  });

  it('rejects text strings', () => {
    expect(parseDateInput('hello')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(parseDateInput('')).toBeNull();
  });

  it('handles whitespace around input', () => {
    expect(parseDateInput('  15/03/2026  ')).toBe('2026-03-15');
  });

  // ── Ambiguous cases (day ≤ 12) — Australian dd/mm/yyyy ────────────
  it('treats 01/02/2026 as dd/mm (1 Feb, not Jan 2)', () => {
    expect(parseDateInput('01/02/2026')).toBe('2026-02-01');
  });

  it('treats 12/12/2026 as dd/mm (12 Dec)', () => {
    expect(parseDateInput('12/12/2026')).toBe('2026-12-12');
  });
});
