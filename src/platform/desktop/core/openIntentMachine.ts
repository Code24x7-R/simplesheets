// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/** Newest-wins open-intent resolver and generation tokens. */

export type IntentKind =
  | 'argv'
  | 'open-with'
  | 'second-instance'
  | 'picker'
  | 'recent'
  | 'drag-drop'
  | 'restore'
  | 'recovery';

export interface OpenIntent {
  readonly kind: IntentKind;
  readonly seq: number;
  readonly path?: string;
}

export interface IntentState {
  readonly seq: number;
  readonly intent: OpenIntent | null;
}

/** Create the initial resolver state. */
export function createIntentState(): IntentState {
  return { seq: 0, intent: null };
}

/**
 * Accept a new explicit intent. The newest intent wins; older work is stale.
 *
 * @param state - Current resolver state.
 * @param intent - Incoming intent without a sequence.
 * @returns The next state with an incremented token.
 */
export function resolveOpenIntent(
  state: IntentState,
  intent: Omit<OpenIntent, 'seq'>,
): IntentState {
  const seq = state.seq + 1;
  return { seq, intent: { ...intent, seq } };
}

/**
 * Drop an async result whose token is older than the current token.
 *
 * @param token - Token carried by the result.
 * @param currentToken - Current resolver token.
 * @returns True when the result must be discarded.
 */
export function shouldDiscardResult(token: number, currentToken: number): boolean {
  return token !== currentToken;
}
