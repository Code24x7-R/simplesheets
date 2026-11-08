// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  createIntentState,
  resolveOpenIntent,
  shouldDiscardResult,
} from './openIntentMachine';

describe('openIntentMachine', () => {
  it('starts with no intent', () => {
    expect(createIntentState()).toEqual({ seq: 0, intent: null });
  });

  it('assigns increasing tokens and newest intent wins', () => {
    let state = resolveOpenIntent(createIntentState(), { kind: 'argv', path: 'a' });
    expect(state.seq).toBe(1);
    expect(state.intent).toMatchObject({ kind: 'argv', seq: 1, path: 'a' });

    state = resolveOpenIntent(state, { kind: 'picker', path: 'b' });
    expect(state.seq).toBe(2);
    expect(state.intent).toMatchObject({ kind: 'picker', seq: 2, path: 'b' });
  });

  it('discards stale results', () => {
    expect(shouldDiscardResult(1, 2)).toBe(true);
    expect(shouldDiscardResult(2, 2)).toBe(false);
  });
});
