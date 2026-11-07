// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/** Small pure helpers for strict IPC payload validation. */

/**
 * True when the object's own keys are all in the allowlist.
 *
 * @param value - Candidate object.
 * @param allowed - Permitted field names.
 * @returns False when any unknown field is present.
 */
export function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

/**
 * True for a finite number.
 *
 * @param value - Candidate value.
 * @returns True when the value is a finite number.
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
