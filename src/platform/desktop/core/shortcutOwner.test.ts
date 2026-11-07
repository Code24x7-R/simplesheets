// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { NATIVE_SHORTCUTS, isNativeShortcutEvent, nativeShortcutAction } from './shortcutOwner';

describe('shortcutOwner', () => {
  it('enumerates every native accelerator', () => {
    expect(NATIVE_SHORTCUTS.map((shortcut) => shortcut.id)).toEqual([
      'file:new',
      'file:open',
      'file:save',
      'file:save-as',
      'edit:undo',
      'edit:redo',
      'edit:find',
      'file:exit',
    ]);
  });

  it.each(NATIVE_SHORTCUTS)('owns %s', (shortcut) => {
    expect(
      isNativeShortcutEvent({
        key: shortcut.key,
        ctrlKey: true,
        metaKey: false,
        shiftKey: shortcut.shift,
      }),
    ).toBe(true);
    expect(
      isNativeShortcutEvent({
        key: shortcut.key,
        ctrlKey: false,
        metaKey: true,
        shiftKey: shortcut.shift,
      }),
    ).toBe(true);
  });

  it('maps an accelerator to its menu action', () => {
    expect(
      nativeShortcutAction({ key: 'S', ctrlKey: true, metaKey: false, shiftKey: true }),
    ).toBe('file:save-as');
    expect(
      nativeShortcutAction({ key: 's', ctrlKey: true, metaKey: false, shiftKey: false }),
    ).toBe('file:save');
    expect(nativeShortcutAction({ key: 'b', ctrlKey: true, metaKey: false, shiftKey: false })).toBeNull();
  });

  it('does not claim non-native shortcuts', () => {
    const base = { ctrlKey: true, metaKey: false, shiftKey: false };
    expect(isNativeShortcutEvent({ ...base, key: 'b' })).toBe(false);
    expect(isNativeShortcutEvent({ ...base, key: '`' })).toBe(false);
    expect(isNativeShortcutEvent({ ...base, key: 'f', shiftKey: true })).toBe(false);
    expect(isNativeShortcutEvent({ ...base, key: 's', shiftKey: true })).toBe(true);
    expect(isNativeShortcutEvent({ ...base, key: 's', altKey: true })).toBe(false);
    expect(isNativeShortcutEvent({ ...base, key: 's', ctrlKey: false })).toBe(false);
  });
});
