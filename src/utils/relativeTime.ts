// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Human-readable relative time formatting for the status bar.
 */

/**
 * Format a timestamp as a short relative label (e.g. "just now", "2 min ago").
 *
 * @param timestamp - Epoch milliseconds to format.
 * @param now - Current time (injectable for deterministic tests).
 * @returns A short relative label.
 */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diffMs = Math.max(0, now - timestamp);
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}
