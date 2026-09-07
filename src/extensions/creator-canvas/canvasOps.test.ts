// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import {
  addCanvasNode,
  updateCanvasNode,
  removeCanvasNode,
  addCanvasConnection,
  removeCanvasConnection,
  updateCanvasConnection,
  addCreatorTask,
  updateCreatorTask,
  removeCreatorTask,
  addCanvasCollection,
  updateCanvasCollection,
  removeCanvasCollection,
  addCanvasTag,
  removeCanvasTag,
  updateCanvasSettings,
  updateProjectMeta,
} from './canvasOps';
import {
  createEmptyCreatorCanvasModel,
  createDefaultCanvasNode,
  createDefaultCanvasConnection,
  createDefaultCreatorTask,
  createDefaultCanvasCollection,
  createDefaultCanvasTag,
} from './schema';

describe('Creator Canvas Operations (canvasOps)', () => {
  let initialModel = createEmptyCreatorCanvasModel('proj-1', 'Test Project');

  beforeEach(() => {
    initialModel = createEmptyCreatorCanvasModel('proj-1', 'Test Project');
  });

  describe('Node operations', () => {
    it('adds a node immutably', () => {
      const node = createDefaultCanvasNode('n1', 'note', { title: 'First Note' });
      const next = addCanvasNode(initialModel, node);

      expect(next).not.toBe(initialModel);
      expect(next.nodes).toHaveLength(1);
      expect(next.nodes[0].title).toBe('First Note');
      expect(initialModel.nodes).toHaveLength(0);
    });

    it('updates a node immutably', () => {
      const node = createDefaultCanvasNode('n1', 'note', { title: 'Initial Title' });
      const m1 = addCanvasNode(initialModel, node);
      const next = updateCanvasNode(m1, 'n1', { title: 'Updated Title', position: { x: 50, y: 80 } });

      expect(next).not.toBe(m1);
      expect(next.nodes[0].title).toBe('Updated Title');
      expect(next.nodes[0].position).toEqual({ x: 50, y: 80 });
      expect(m1.nodes[0].title).toBe('Initial Title');
    });

    it('removes a node and cascades removal to connections and task links', () => {
      const n1 = createDefaultCanvasNode('n1', 'note');
      const n2 = createDefaultCanvasNode('n2', 'link');
      const conn = createDefaultCanvasConnection('c1', 'n1', 'n2');
      const task = createDefaultCreatorTask('t1', 'Task linked to n1', { linkedNodeId: 'n1' });

      let model = addCanvasNode(initialModel, n1);
      model = addCanvasNode(model, n2);
      model = addCanvasConnection(model, conn);
      model = addCreatorTask(model, task);

      const next = removeCanvasNode(model, 'n1');

      expect(next.nodes).toHaveLength(1);
      expect(next.nodes[0].id).toBe('n2');
      // Cascaded connection cleanup
      expect(next.connections).toHaveLength(0);
      // Unlinked task
      expect(next.tasks[0].linkedNodeId).toBeUndefined();
    });
  });

  describe('Connection operations', () => {
    it('adds and removes connections', () => {
      const n1 = createDefaultCanvasNode('n1', 'note');
      const n2 = createDefaultCanvasNode('n2', 'note');
      const conn = createDefaultCanvasConnection('c1', 'n1', 'n2');

      let model = addCanvasNode(initialModel, n1);
      model = addCanvasNode(model, n2);
      model = addCanvasConnection(model, conn);

      expect(model.connections).toHaveLength(1);
      expect(model.connections[0].id).toBe('c1');

      const next = removeCanvasConnection(model, 'c1');
      expect(next.connections).toHaveLength(0);
    });

    it('updates connection attributes immutably', () => {
      const n1 = createDefaultCanvasNode('n1', 'note');
      const n2 = createDefaultCanvasNode('n2', 'note');
      const conn = createDefaultCanvasConnection('c1', 'n1', 'n2', { relationship: 'sequence' });

      let model = addCanvasNode(initialModel, n1);
      model = addCanvasNode(model, n2);
      model = addCanvasConnection(model, conn);

      const next = updateCanvasConnection(model, 'c1', {
        relationship: 'dependency',
        label: 'blocks',
        style: { color: '#ef4444', strokeWidth: 3, strokeDash: 'dashed', arrowStart: true, arrowEnd: false },
      });

      expect(next.connections[0].relationship).toBe('dependency');
      expect(next.connections[0].label).toBe('blocks');
      expect(next.connections[0].style?.strokeDash).toBe('dashed');
      expect(next.connections[0].style?.arrowStart).toBe(true);
    });
  });

  describe('Task operations', () => {
    it('adds, updates, and removes creator tasks', () => {
      const task = createDefaultCreatorTask('t1', 'Initial Task', { priority: 'low' });
      const m1 = addCreatorTask(initialModel, task);
      expect(m1.tasks).toHaveLength(1);

      const m2 = updateCreatorTask(m1, 't1', { priority: 'urgent', status: 'in-progress' });
      expect(m2.tasks[0].priority).toBe('urgent');
      expect(m2.tasks[0].status).toBe('in-progress');

      const m3 = removeCreatorTask(m2, 't1');
      expect(m3.tasks).toHaveLength(0);
    });
  });

  describe('Collection operations', () => {
    it('adds, updates, and removes collections, unlinking nodes on remove', () => {
      const col = createDefaultCanvasCollection('col1', 'Moodboard');
      const node = createDefaultCanvasNode('n1', 'image', { collectionId: 'col1' });

      let model = addCanvasCollection(initialModel, col);
      model = addCanvasNode(model, node);

      expect(model.collections).toHaveLength(1);
      expect(model.nodes[0].collectionId).toBe('col1');

      model = updateCanvasCollection(model, 'col1', { name: 'Updated Moodboard' });
      expect(model.collections[0].name).toBe('Updated Moodboard');

      const next = removeCanvasCollection(model, 'col1');
      expect(next.collections).toHaveLength(0);
      expect(next.nodes[0].collectionId).toBeUndefined();
    });
  });

  describe('Tag operations', () => {
    it('adds and removes tags, unlinking from nodes on remove', () => {
      const tag = createDefaultCanvasTag('tag1', 'Inspiration', '#ff0000');
      const node = createDefaultCanvasNode('n1', 'note', { tagIds: ['tag1', 'other'] });

      let model = addCanvasTag(initialModel, tag);
      model = addCanvasNode(model, node);

      expect(model.tags).toHaveLength(1);
      expect(model.nodes[0].tagIds).toContain('tag1');

      const next = removeCanvasTag(model, 'tag1');
      expect(next.tags).toHaveLength(0);
      expect(next.nodes[0].tagIds).toEqual(['other']);
    });
  });

  describe('Settings & Meta operations', () => {
    it('updates canvas viewport settings', () => {
      const next = updateCanvasSettings(initialModel, { zoom: 1.5, panX: 120 });
      expect(next.canvas.zoom).toBe(1.5);
      expect(next.canvas.panX).toBe(120);
      expect(next.canvas.gridSnap).toBe(initialModel.canvas.gridSnap);
    });

    it('updates project metadata', () => {
      const next = updateProjectMeta(initialModel, {
        name: 'Renamed Project',
        projectType: 'film-video',
        status: 'in-progress',
      });
      expect(next.name).toBe('Renamed Project');
      expect(next.projectType).toBe('film-video');
      expect(next.status).toBe('in-progress');
    });
  });
});
