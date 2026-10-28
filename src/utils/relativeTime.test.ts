// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { formatRelativeTime } from './relativeTime';

describe('formatRelativeTime', () => {
  const NOW = 1_700_000_000_000;

  it('returns "just now" for very recent timestamps', () => {
    expect(formatRelativeTime(NOW, NOW)).toBe('just now');
    expect(formatRelativeTime(NOW - 9_000, NOW)).toBe('just now');
  });

  it('returns seconds for under a minute', () => {
    expect(formatRelativeTime(NOW - 10_000, NOW)).toBe('10s ago');
    expect(formatRelativeTime(NOW - 59_000, NOW)).toBe('59s ago');
  });

  it('returns minutes for under an hour', () => {
    expect(formatRelativeTime(NOW - 60_000, NOW)).toBe('1 min ago');
    expect(formatRelativeTime(NOW - 59 * 60_000, NOW)).toBe('59 min ago');
  });

  it('returns hours for under a day', () => {
    expect(formatRelativeTime(NOW - 60 * 60_000, NOW)).toBe('1 hr ago');
    expect(formatRelativeTime(NOW - 23 * 60 * 60_000, NOW)).toBe('23 hr ago');
  });

  it('returns days for a day or more', () => {
    expect(formatRelativeTime(NOW - 24 * 60 * 60_000, NOW)).toBe('1 day ago');
    expect(formatRelativeTime(NOW - 3 * 24 * 60 * 60_000, NOW)).toBe('3 days ago');
  });

  it('clamps future timestamps to "just now"', () => {
    expect(formatRelativeTime(NOW + 60_000, NOW)).toBe('just now');
  });
});
