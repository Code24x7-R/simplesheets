// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import { render, screen, fireEvent } from '@testing-library/react';
import { NodeEditorPanel } from './NodeEditorPanel';
import { createDefaultCanvasNode } from './schema';
import type { CanvasNode } from './types';

describe('NodeEditorPanel Component', () => {
  const baseNode: CanvasNode = createDefaultCanvasNode('n-test-1', 'note', {
    title: 'Character Backstory',
    description: 'Protagonist grew up in a floating colony.',
    tagIds: ['story', 'character'],
  });

  it('renders node details accurately in inputs', () => {
    const onSave = jest.fn();
    const onClose = jest.fn();

    render(<NodeEditorPanel node={baseNode} onSave={onSave} onClose={onClose} />);

    expect(screen.getByDisplayValue('Character Backstory')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Protagonist grew up in a floating colony.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('story, character')).toBeInTheDocument();
  });

  it('calls onSave with updated node values when Save is clicked', () => {
    const onSave = jest.fn();
    const onClose = jest.fn();

    render(<NodeEditorPanel node={baseNode} onSave={onSave} onClose={onClose} />);

    const titleInput = screen.getByLabelText(/Title/i);
    fireEvent.change(titleInput, { target: { value: 'Updated Character Profile' } });

    const descInput = screen.getByLabelText(/Description/i);
    fireEvent.change(descInput, { target: { value: 'New backstory notes.' } });

    const tagsInput = screen.getByLabelText(/Tags/i);
    fireEvent.change(tagsInput, { target: { value: 'hero, protagonist' } });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledTimes(1);
    const updated = onSave.mock.calls[0][0];
    expect(updated.title).toBe('Updated Character Profile');
    expect(updated.description).toBe('New backstory notes.');
    expect(updated.tagIds).toEqual(['hero', 'protagonist']);
  });

  it('renders link-specific payload fields for link node type', () => {
    const linkNode: CanvasNode = createDefaultCanvasNode('n-link-1', 'link', {
      title: 'Soundtrack Inspiration',
      payload: {
        type: 'link',
        data: { url: 'https://spotify.com/playlist/123', siteName: 'Spotify' },
      },
    });

    const onSave = jest.fn();
    const onClose = jest.fn();

    render(<NodeEditorPanel node={linkNode} onSave={onSave} onClose={onClose} />);

    expect(screen.getByLabelText(/URL/i)).toHaveValue('https://spotify.com/playlist/123');

    const urlInput = screen.getByLabelText(/URL/i);
    fireEvent.change(urlInput, { target: { value: 'https://youtube.com/watch?v=abc' } });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledTimes(1);
    const updated = onSave.mock.calls[0][0];
    expect(updated.payload?.type).toBe('link');
    if (updated.payload?.type === 'link') {
      expect(updated.payload.data.url).toBe('https://youtube.com/watch?v=abc');
    }
  });

  it('calls onClose when Cancel is clicked', () => {
    const onSave = jest.fn();
    const onClose = jest.fn();

    render(<NodeEditorPanel node={baseNode} onSave={onSave} onClose={onClose} />);

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
