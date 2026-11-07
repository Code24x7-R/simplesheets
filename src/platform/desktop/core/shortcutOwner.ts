// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Single source of truth for shortcuts owned by the native desktop menu.
 *
 * The renderer must not also handle these combinations when
 * `capabilities.nativeMenu` is true.
 */

export interface ShortcutEventLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey?: boolean;
}

export interface NativeShortcut {
  readonly id: string;
  readonly key: string;
  readonly shift: boolean;
}

export const NATIVE_SHORTCUTS: readonly NativeShortcut[] = [
  { id: 'file:new', key: 'n', shift: false },
  { id: 'file:open', key: 'o', shift: false },
  { id: 'file:save', key: 's', shift: false },
  { id: 'file:save-as', key: 's', shift: true },
  { id: 'edit:undo', key: 'z', shift: false },
  { id: 'edit:redo', key: 'y', shift: false },
  { id: 'edit:find', key: 'h', shift: false },
  { id: 'file:exit', key: 'q', shift: false },
];

/**
 * True when the renderer must leave this event to the native menu.
 *
 * @param event - Keyboard event or a minimal test double.
 * @returns True for one of the native-owned accelerator combinations.
 */
export function nativeShortcutAction(event: ShortcutEventLike): string | null {
  if (event.altKey) return null;
  if (!event.ctrlKey && !event.metaKey) return null;
  const key = event.key.toLowerCase();
  return (
    NATIVE_SHORTCUTS.find(
      (shortcut) => shortcut.key === key && shortcut.shift === event.shiftKey,
    )?.id ?? null
  );
}

/**
 * True when the renderer must leave this event to the native menu.
 *
 * @param event - Keyboard event or a minimal test double.
 * @returns True for one of the native-owned accelerator combinations.
 */
export function isNativeShortcutEvent(event: ShortcutEventLike): boolean {
  return nativeShortcutAction(event) !== null;
}
