// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import { render, screen, fireEvent } from '@testing-library/react';
import { CreatorCanvasView } from './CreatorCanvasView';
import { createEmptyCreatorCanvasModel, createDefaultCanvasNode } from './schema';

describe('CreatorCanvasView Component', () => {
  it('renders blank canvas header, toolbar, and empty state', () => {
    const model = createEmptyCreatorCanvasModel('p1', 'My Concept Canvas');
    const onProjectChange = jest.fn();

    render(<CreatorCanvasView project={model} onProjectChange={onProjectChange} />);

    expect(screen.getByText('My Concept Canvas')).toBeInTheDocument();
    expect(screen.getByText(/0 nodes/i)).toBeInTheDocument();
    expect(screen.getByText('Canvas is empty. Add a note or reference above!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Note/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Link/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Image/i })).toBeInTheDocument();
  });

  it('adds a new note when clicking + Note button', () => {
    const model = createEmptyCreatorCanvasModel('p1', 'My Concept Canvas');
    const onProjectChange = jest.fn();

    render(<CreatorCanvasView project={model} onProjectChange={onProjectChange} />);

    const addNoteBtn = screen.getByRole('button', { name: /\+ Note/i });
    fireEvent.click(addNoteBtn);

    expect(onProjectChange).toHaveBeenCalledTimes(1);
    const updatedModel = onProjectChange.mock.calls[0][0];
    expect(updatedModel.nodes).toHaveLength(1);
    expect(updatedModel.nodes[0].type).toBe('note');
  });

  it('renders canvas nodes when present', () => {
    const model = createEmptyCreatorCanvasModel('p1', 'Story Boarding');
    const node1 = createDefaultCanvasNode('n1', 'note', { title: 'First Script Idea', description: 'Action scene at dusk' });
    const node2 = createDefaultCanvasNode('n2', 'link', { title: 'Mood Reference' });
    model.nodes = [node1, node2];

    const onProjectChange = jest.fn();
    render(<CreatorCanvasView project={model} onProjectChange={onProjectChange} />);

    expect(screen.getByText('First Script Idea')).toBeInTheDocument();
    expect(screen.getByText('Action scene at dusk')).toBeInTheDocument();
    expect(screen.getByText('Mood Reference')).toBeInTheDocument();
    expect(screen.getByText(/2 nodes/i)).toBeInTheDocument();
  });

  it('allows deleting a node', () => {
    const model = createEmptyCreatorCanvasModel('p1', 'Story Boarding');
    const node1 = createDefaultCanvasNode('n1', 'note', { title: 'Discardable Idea' });
    model.nodes = [node1];

    const onProjectChange = jest.fn();
    render(<CreatorCanvasView project={model} onProjectChange={onProjectChange} />);

    const deleteBtn = screen.getByTitle('Delete node');
    fireEvent.click(deleteBtn);

    expect(onProjectChange).toHaveBeenCalledTimes(1);
    const updated = onProjectChange.mock.calls[0][0];
    expect(updated.nodes).toHaveLength(0);
  });

  it('handles zoom controls', () => {
    const model = createEmptyCreatorCanvasModel('p1', 'Zoom Test');
    const onProjectChange = jest.fn();

    render(<CreatorCanvasView project={model} onProjectChange={onProjectChange} />);

    const zoomInBtn = screen.getByTitle('Zoom In');
    fireEvent.click(zoomInBtn);

    expect(onProjectChange).toHaveBeenCalledTimes(1);
    expect(onProjectChange.mock.calls[0][0].canvas.zoom).toBeGreaterThan(1);
  });
});
