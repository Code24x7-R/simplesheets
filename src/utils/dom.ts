// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * DOM helpers shared by global event handlers.
 */

/**
 * Returns true when an event originated from an editable text field
 * (`<input>`, `<textarea>`, `<select>`, or a contentEditable element).
 *
 * Global window/document handlers (keyboard shortcuts, clipboard, paste)
 * must consult this before acting, otherwise they hijack input that belongs
 * to a modal field, the formula bar, or any other text editor — e.g. Ctrl+V
 * in a filename field would paste into a grid cell instead.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  // `isContentEditable` is the canonical check, but jsdom does not implement
  // it (returns undefined), so also honour the reflected attribute/property.
  return target.isContentEditable === true || target.contentEditable === 'true';
}
