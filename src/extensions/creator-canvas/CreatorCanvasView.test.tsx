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

  it('drags an unlocked node and snaps its position to the grid', () => {
    const model = createEmptyCreatorCanvasModel('p1', 'Drag Test');
    const node = createDefaultCanvasNode('drag-node', 'note', {
      position: { x: 100, y: 100 },
    });
    model.nodes = [node];
    const onProjectChange = jest.fn();

    render(<CreatorCanvasView project={model} onProjectChange={onProjectChange} />);
    const nodeElement = screen.getByTestId('canvas-node-drag-node');

    fireEvent.mouseDown(nodeElement, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(screen.getByTestId('canvas-workspace'), { clientX: 133, clientY: 147 });
    fireEvent.mouseUp(screen.getByTestId('canvas-workspace'));

    const updates = onProjectChange.mock.calls.map(([next]) => next);
    expect(updates[updates.length - 1].nodes[0].position).toEqual({ x: 140, y: 140 });
  });

  it('does not drag a locked node', () => {
    const model = createEmptyCreatorCanvasModel('p1', 'Locked Test');
    model.nodes = [createDefaultCanvasNode('locked-node', 'note', {
      position: { x: 100, y: 100 },
      locked: true,
    })];
    const onProjectChange = jest.fn();

    render(<CreatorCanvasView project={model} onProjectChange={onProjectChange} />);
    const nodeElement = screen.getByTestId('canvas-node-locked-node');
    fireEvent.mouseDown(nodeElement, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(screen.getByTestId('canvas-workspace'), { clientX: 200, clientY: 200 });

    expect(onProjectChange).not.toHaveBeenCalled();
  });

  it('creates and renders a connection between two nodes', () => {
    const model = createEmptyCreatorCanvasModel('p1', 'Connection Test');
    model.nodes = [
      createDefaultCanvasNode('from-node', 'note', { title: 'From' }),
      createDefaultCanvasNode('to-node', 'task', { title: 'To', position: { x: 400, y: 100 } }),
    ];
    const onProjectChange = jest.fn();

    render(<CreatorCanvasView project={model} onProjectChange={onProjectChange} />);
    fireEvent.click(screen.getAllByTitle('Connect to another node')[0]);
    fireEvent.mouseDown(screen.getByTestId('canvas-node-to-node'), { button: 0, clientX: 400, clientY: 100 });

    expect(onProjectChange).toHaveBeenCalledTimes(1);
    const updated = onProjectChange.mock.calls[0][0];
    expect(updated.connections).toHaveLength(1);
    expect(updated.connections[0].fromNodeId).toBe('from-node');
    expect(updated.connections[0].toNodeId).toBe('to-node');

    // A connection is represented by an SVG line and midpoint delete control.
    expect(document.querySelector('svg line')).toBeInTheDocument();
    expect(document.querySelector('svg circle')).toBeInTheDocument();
  });

  it('pans the workspace when dragging its empty background', () => {
    const model = createEmptyCreatorCanvasModel('p1', 'Pan Test');
    const onProjectChange = jest.fn();

    render(<CreatorCanvasView project={model} onProjectChange={onProjectChange} />);
    const workspace = screen.getByTestId('canvas-workspace');
    fireEvent.mouseDown(workspace, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(workspace, { clientX: 45, clientY: 55 });

    const updated = onProjectChange.mock.calls[onProjectChange.mock.calls.length - 1][0];
    expect(updated.canvas.panX).toBe(35);
    expect(updated.canvas.panY).toBe(45);
  });
});
