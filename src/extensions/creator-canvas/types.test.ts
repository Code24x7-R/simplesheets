// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import {
  DEFAULT_CANVAS_SETTINGS,
  CREATOR_CANVAS_SCHEMA_VERSION,
  createEmptyCreatorCanvasModel,
  createDefaultCanvasNode,
  createDefaultCanvasConnection,
  createDefaultCreatorTask,
  createDefaultCanvasCollection,
  createDefaultCanvasTag,
  validateCreatorCanvasModel,
  sanitizeCreatorCanvasModel,
  migrateCreatorCanvasModel,
} from './schema';
import type { CreatorCanvasModel } from './types';

describe('Creator Canvas Schema & Types', () => {
  describe('Default factories', () => {
    it('creates a valid empty model with default settings', () => {
      const model = createEmptyCreatorCanvasModel('project-1', 'My Creative Project');
      expect(model.id).toBe('project-1');
      expect(model.name).toBe('My Creative Project');
      expect(model.schemaVersion).toBe(CREATOR_CANVAS_SCHEMA_VERSION);
      expect(model.projectType).toBe('other');
      expect(model.techniques).toEqual([]);
      expect(model.status).toBe('draft');
      expect(model.nodes).toEqual([]);
      expect(model.connections).toEqual([]);
      expect(model.tasks).toEqual([]);
      expect(model.collections).toEqual([]);
      expect(model.tags).toEqual([]);
      expect(model.canvas).toEqual(DEFAULT_CANVAS_SETTINGS);
      expect(validateCreatorCanvasModel(model).valid).toBe(true);
    });

    it('creates a default canvas node with specified type and position', () => {
      const node = createDefaultCanvasNode('node-1', 'note', { position: { x: 100, y: 200 }, title: 'Note 1' });
      expect(node.id).toBe('node-1');
      expect(node.type).toBe('note');
      expect(node.position).toEqual({ x: 100, y: 200 });
      expect(node.title).toBe('Note 1');
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
      expect(node.zIndex).toBe(1);
    });

    it('creates default nodes for all supported types with correct default dimensions', () => {
      const noteNode = createDefaultCanvasNode('n1', 'note');
      const linkNode = createDefaultCanvasNode('n2', 'link');
      const imageNode = createDefaultCanvasNode('n3', 'image');
      const videoNode = createDefaultCanvasNode('n4', 'video');
      const sketchNode = createDefaultCanvasNode('n5', 'sketch');
      const taskNode = createDefaultCanvasNode('n6', 'task');

      expect(noteNode.type).toBe('note');
      expect(linkNode.type).toBe('link');
      expect(imageNode.type).toBe('image');
      expect(videoNode.type).toBe('video');
      expect(sketchNode.type).toBe('sketch');
      expect(taskNode.type).toBe('task');
    });

    it('creates a default connection between nodes', () => {
      const conn = createDefaultCanvasConnection('conn-1', 'node-1', 'node-2', {
        label: 'leads to',
        relationship: 'sequence',
      });
      expect(conn.id).toBe('conn-1');
      expect(conn.fromNodeId).toBe('node-1');
      expect(conn.toNodeId).toBe('node-2');
      expect(conn.label).toBe('leads to');
      expect(conn.relationship).toBe('sequence');
    });

    it('creates a default creator task', () => {
      const task = createDefaultCreatorTask('task-1', 'Write Script Draft', {
        status: 'in-progress',
        priority: 'high',
        linkedNodeId: 'node-1',
      });
      expect(task.id).toBe('task-1');
      expect(task.title).toBe('Write Script Draft');
      expect(task.status).toBe('in-progress');
      expect(task.priority).toBe('high');
      expect(task.linkedNodeId).toBe('node-1');
    });

    it('creates a default collection frame', () => {
      const col = createDefaultCanvasCollection('col-1', 'Moodboard', {
        color: '#6366f1',
        bounds: { x: 50, y: 50, width: 600, height: 400 },
      });
      expect(col.id).toBe('col-1');
      expect(col.name).toBe('Moodboard');
      expect(col.color).toBe('#6366f1');
      expect(col.bounds.width).toBe(600);
    });

    it('creates a default tag', () => {
      const tag = createDefaultCanvasTag('tag-1', 'Inspiration', '#ec4899');
      expect(tag.id).toBe('tag-1');
      expect(tag.name).toBe('Inspiration');
      expect(tag.color).toBe('#ec4899');
    });
  });

  describe('Validation & Sanitization', () => {
    it('validates a complete well-formed model', () => {
      const model = createEmptyCreatorCanvasModel('p1', 'Valid Project');
      const node1 = createDefaultCanvasNode('n1', 'note');
      const node2 = createDefaultCanvasNode('n2', 'link');
      const conn = createDefaultCanvasConnection('c1', 'n1', 'n2');
      const task = createDefaultCreatorTask('t1', 'Task 1', { linkedNodeId: 'n1' });
      const collection = createDefaultCanvasCollection('col1', 'Ideas');
      const tag = createDefaultCanvasTag('tag1', 'Urgent', '#ef4444');

      model.nodes.push(node1, node2);
      model.connections.push(conn);
      model.tasks.push(task);
      model.collections.push(collection);
      model.tags.push(tag);

      const result = validateCreatorCanvasModel(model);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects missing required fields in model', () => {
      const invalidModel = {
        name: 'No ID',
      } as unknown as CreatorCanvasModel;

      const result = validateCreatorCanvasModel(invalidModel);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('detects dangling connection references', () => {
      const model = createEmptyCreatorCanvasModel('p1', 'Valid Project');
      const node1 = createDefaultCanvasNode('n1', 'note');
      // Connection points to non-existent n2
      const conn = createDefaultCanvasConnection('c1', 'n1', 'n2');
      model.nodes.push(node1);
      model.connections.push(conn);

      const result = validateCreatorCanvasModel(model);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('dangling') || e.includes('n2'))).toBe(true);
    });

    it('sanitizes malformed objects by repairing defaults and dropping dangling references', () => {
      const dirtyData = {
        id: 'p-dirty',
        name: 'Dirty Project',
        nodes: [
          { id: 'n1', type: 'note', position: { x: 10, y: 20 } }, // missing title/dims
        ],
        connections: [
          { id: 'c1', fromNodeId: 'n1', toNodeId: 'nonexistent-node' }, // dangling
        ],
        tasks: [
          { id: 't1', title: 'Task 1' }, // missing status/priority
        ],
      };

      const sanitized = sanitizeCreatorCanvasModel(dirtyData);
      expect(sanitized.id).toBe('p-dirty');
      expect(sanitized.nodes[0].title).toBeDefined();
      expect(sanitized.nodes[0].width).toBeGreaterThan(0);
      expect(sanitized.connections).toHaveLength(0); // dropped dangling connection
      expect(sanitized.tasks[0].status).toBe('todo');
      expect(sanitized.tasks[0].priority).toBe('medium');
    });

    it('handles null/undefined gracefully in sanitize', () => {
      const sanitized = sanitizeCreatorCanvasModel(null);
      expect(sanitized.id).toBeDefined();
      expect(sanitized.name).toBe('Untitled Canvas');
    });
  });

  describe('Migration', () => {
    it('returns valid model unchanged if schemaVersion matches', () => {
      const model = createEmptyCreatorCanvasModel('p1', 'Current Version');
      const migrated = migrateCreatorCanvasModel(model);
      expect(migrated.schemaVersion).toBe(CREATOR_CANVAS_SCHEMA_VERSION);
      expect(migrated.id).toBe('p1');
    });

    it('upgrades legacy or unversioned payload to 1.0.0', () => {
      const legacy = {
        id: 'legacy-1',
        title: 'Old Canvas Name',
        items: [
          { id: 'item-1', kind: 'text', x: 50, y: 50, text: 'Hello' },
        ],
      };

      const migrated = migrateCreatorCanvasModel(legacy);
      expect(migrated.schemaVersion).toBe('1.0.0');
      expect(migrated.id).toBe('legacy-1');
      expect(migrated.name).toBe('Old Canvas Name');
    });
  });
});
