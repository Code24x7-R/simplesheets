// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { isEditableTarget } from './dom';

describe('isEditableTarget', () => {
  it('returns true for an <input>', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
  });

  it('returns true for a <textarea>', () => {
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);
  });

  it('returns true for a <select>', () => {
    expect(isEditableTarget(document.createElement('select'))).toBe(true);
  });

  it('returns true for a contentEditable element', () => {
    const div = document.createElement('div');
    div.contentEditable = 'true';
    expect(isEditableTarget(div)).toBe(true);
  });

  it('returns false for a non-editable <div>', () => {
    expect(isEditableTarget(document.createElement('div'))).toBe(false);
  });

  it('returns false for a grid cell (role=textbox but not an input)', () => {
    const cell = document.createElement('div');
    cell.setAttribute('role', 'textbox');
    expect(isEditableTarget(cell)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isEditableTarget(null)).toBe(false);
  });

  it('returns false for a non-HTMLElement target (e.g. window/document)', () => {
    expect(isEditableTarget(window)).toBe(false);
    expect(isEditableTarget(document)).toBe(false);
  });
});
