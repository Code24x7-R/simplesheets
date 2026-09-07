// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import type {
  CreatorCanvasModel,
  CanvasNode,
  CanvasNodeType,
  CanvasConnection,
  CreatorTaskRow,
  CanvasCollection,
  CanvasTag,
  CanvasSettings,
  CanvasPosition,
  CanvasBounds,
  CreatorProjectType,
} from './types';

export const CREATOR_CANVAS_SCHEMA_VERSION = '1.0.0';

export const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
  zoom: 1,
  panX: 0,
  panY: 0,
  gridSnap: true,
  gridSize: 20,
  backgroundColor: '#f8fafc',
};

/**
 * Returns default dimensions for different canvas node types.
 */
export function getDefaultNodeDimensions(type: CanvasNodeType): { width: number; height: number } {
  switch (type) {
    case 'note':
      return { width: 220, height: 160 };
    case 'link':
      return { width: 240, height: 120 };
    case 'image':
      return { width: 280, height: 220 };
    case 'video':
      return { width: 320, height: 240 };
    case 'sketch':
      return { width: 300, height: 240 };
    case 'task':
      return { width: 220, height: 140 };
    case 'brief':
      return { width: 340, height: 260 };
    case 'swatch':
      return { width: 140, height: 140 };
    case 'quote':
      return { width: 260, height: 160 };
    case 'storyboard-frame':
      return { width: 300, height: 220 };
    default:
      return { width: 200, height: 150 };
  }
}

/**
 * Creates an empty CreatorCanvasModel with default settings.
 */
export function createEmptyCreatorCanvasModel(
  id = `cc-${Date.now()}`,
  name = 'Untitled Canvas',
  projectType: CreatorProjectType = 'other'
): CreatorCanvasModel {
  const now = new Date().toISOString();
  return {
    id,
    schemaVersion: CREATOR_CANVAS_SCHEMA_VERSION,
    name,
    description: '',
    projectType,
    techniques: [],
    status: 'draft',
    createdDate: now,
    modifiedDate: now,
    canvas: { ...DEFAULT_CANVAS_SETTINGS },
    nodes: [],
    connections: [],
    tasks: [],
    collections: [],
    tags: [],
    metadata: {},
  };
}

/**
 * Creates a default canvas node.
 */
export function createDefaultCanvasNode(
  id: string,
  type: CanvasNodeType,
  overrides: Partial<CanvasNode> = {}
): CanvasNode {
  const now = new Date().toISOString();
  const dims = getDefaultNodeDimensions(type);

  return {
    id,
    type,
    title: overrides.title ?? `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
    description: overrides.description ?? '',
    position: overrides.position ?? { x: 100, y: 100 },
    width: overrides.width ?? dims.width,
    height: overrides.height ?? dims.height,
    zIndex: overrides.zIndex ?? 1,
    rotation: overrides.rotation ?? 0,
    locked: overrides.locked ?? false,
    collapsed: overrides.collapsed ?? false,
    tagIds: overrides.tagIds ?? [],
    collectionId: overrides.collectionId,
    style: overrides.style ?? {},
    payload: overrides.payload,
    createdDate: overrides.createdDate ?? now,
    modifiedDate: overrides.modifiedDate ?? now,
  };
}

/**
 * Creates a default canvas connection.
 */
export function createDefaultCanvasConnection(
  id: string,
  fromNodeId: string,
  toNodeId: string,
  overrides: Partial<CanvasConnection> = {}
): CanvasConnection {
  return {
    id,
    fromNodeId,
    toNodeId,
    relationship: overrides.relationship ?? 'sequence',
    label: overrides.label,
    style: overrides.style ?? { strokeDash: 'solid', arrowEnd: true },
  };
}

/**
 * Creates a default creator task.
 */
export function createDefaultCreatorTask(
  id: string,
  title: string,
  overrides: Partial<CreatorTaskRow> = {}
): CreatorTaskRow {
  const now = new Date().toISOString();
  return {
    id,
    title,
    description: overrides.description ?? '',
    status: overrides.status ?? 'todo',
    priority: overrides.priority ?? 'medium',
    dueDate: overrides.dueDate,
    startDate: overrides.startDate,
    assignee: overrides.assignee,
    estimatedHours: overrides.estimatedHours,
    actualHours: overrides.actualHours,
    cost: overrides.cost,
    linkedNodeId: overrides.linkedNodeId,
    tagIds: overrides.tagIds ?? [],
    createdDate: overrides.createdDate ?? now,
    modifiedDate: overrides.modifiedDate ?? now,
  };
}

/**
 * Creates a default canvas collection frame.
 */
export function createDefaultCanvasCollection(
  id: string,
  name: string,
  overrides: Partial<CanvasCollection> = {}
): CanvasCollection {
  const defaultBounds: CanvasBounds = { x: 50, y: 50, width: 500, height: 400 };
  return {
    id,
    name,
    description: overrides.description ?? '',
    category: overrides.category ?? 'custom',
    bounds: overrides.bounds ?? defaultBounds,
    color: overrides.color ?? '#64748b',
    locked: overrides.locked ?? false,
    collapsed: overrides.collapsed ?? false,
  };
}

/**
 * Creates a default canvas tag.
 */
export function createDefaultCanvasTag(
  id: string,
  name: string,
  color = '#3b82f6'
): CanvasTag {
  return {
    id,
    name,
    color,
  };
}

/**
 * Result of validating a CreatorCanvasModel.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a CreatorCanvasModel for referential integrity and schema adherence.
 */
export function validateCreatorCanvasModel(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Model is not an object'] };
  }

  const model = data as Partial<CreatorCanvasModel>;

  if (!model.id || typeof model.id !== 'string') {
    errors.push('Missing or invalid model id');
  }
  if (!model.name || typeof model.name !== 'string') {
    errors.push('Missing or invalid model name');
  }

  const nodeIds = new Set<string>();
  if (Array.isArray(model.nodes)) {
    for (const node of model.nodes) {
      if (!node.id) {
        errors.push('Canvas node missing id');
      } else {
        nodeIds.add(node.id);
      }
    }
  }

  if (Array.isArray(model.connections)) {
    for (const conn of model.connections) {
      if (!conn.id) {
        errors.push('Canvas connection missing id');
      }
      if (!nodeIds.has(conn.fromNodeId)) {
        errors.push(`Canvas connection ${conn.id || ''} has dangling fromNodeId: ${conn.fromNodeId}`);
      }
      if (!nodeIds.has(conn.toNodeId)) {
        errors.push(`Canvas connection ${conn.id || ''} has dangling toNodeId: ${conn.toNodeId}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes input into a clean, valid CreatorCanvasModel, discarding dangling references.
 */
export function sanitizeCreatorCanvasModel(data: unknown): CreatorCanvasModel {
  if (!data || typeof data !== 'object') {
    return createEmptyCreatorCanvasModel();
  }

  const raw = data as Record<string, unknown>;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : `cc-${Date.now()}`;
  const name = typeof raw.name === 'string' && raw.name ? raw.name : 'Untitled Canvas';
  const projectType = (typeof raw.projectType === 'string' ? raw.projectType : 'other') as CreatorProjectType;

  const model = createEmptyCreatorCanvasModel(id, name, projectType);

  if (typeof raw.description === 'string') model.description = raw.description;
  if (Array.isArray(raw.techniques)) {
    model.techniques = raw.techniques.filter((t): t is CreatorCanvasModel['techniques'][number] => typeof t === 'string');
  }
  if (typeof raw.status === 'string') model.status = raw.status as CreatorCanvasModel['status'];
  if (typeof raw.startDate === 'string') model.startDate = raw.startDate;
  if (typeof raw.targetDate === 'string') model.targetDate = raw.targetDate;
  if (typeof raw.createdDate === 'string') model.createdDate = raw.createdDate;
  if (typeof raw.modifiedDate === 'string') model.modifiedDate = raw.modifiedDate;

  // Canvas settings
  if (raw.canvas && typeof raw.canvas === 'object') {
    const rawC = raw.canvas as Record<string, unknown>;
    model.canvas = {
      zoom: typeof rawC.zoom === 'number' ? rawC.zoom : DEFAULT_CANVAS_SETTINGS.zoom,
      panX: typeof rawC.panX === 'number' ? rawC.panX : DEFAULT_CANVAS_SETTINGS.panX,
      panY: typeof rawC.panY === 'number' ? rawC.panY : DEFAULT_CANVAS_SETTINGS.panY,
      gridSnap: typeof rawC.gridSnap === 'boolean' ? rawC.gridSnap : DEFAULT_CANVAS_SETTINGS.gridSnap,
      gridSize: typeof rawC.gridSize === 'number' ? rawC.gridSize : DEFAULT_CANVAS_SETTINGS.gridSize,
      backgroundColor: typeof rawC.backgroundColor === 'string' ? rawC.backgroundColor : DEFAULT_CANVAS_SETTINGS.backgroundColor,
    };
  }

  // Nodes
  const validNodeIds = new Set<string>();
  if (Array.isArray(raw.nodes)) {
    for (const rawNode of raw.nodes) {
      if (rawNode && typeof rawNode === 'object') {
        const n = rawNode as Record<string, unknown>;
        const nodeId = typeof n.id === 'string' && n.id ? n.id : `node-${Math.random().toString(36).slice(2, 9)}`;
        const type = (typeof n.type === 'string' ? n.type : 'note') as CanvasNodeType;
        const pos: CanvasPosition = {
          x: typeof (n.position as Record<string, unknown>)?.x === 'number' ? (n.position as CanvasPosition).x : 100,
          y: typeof (n.position as Record<string, unknown>)?.y === 'number' ? (n.position as CanvasPosition).y : 100,
        };
        const node = createDefaultCanvasNode(nodeId, type, {
          title: typeof n.title === 'string' ? n.title : undefined,
          description: typeof n.description === 'string' ? n.description : undefined,
          position: pos,
          width: typeof n.width === 'number' ? n.width : undefined,
          height: typeof n.height === 'number' ? n.height : undefined,
          zIndex: typeof n.zIndex === 'number' ? n.zIndex : 1,
          rotation: typeof n.rotation === 'number' ? n.rotation : 0,
          locked: Boolean(n.locked),
          collapsed: Boolean(n.collapsed),
          tagIds: Array.isArray(n.tagIds) ? n.tagIds.filter((t) => typeof t === 'string') : [],
          collectionId: typeof n.collectionId === 'string' ? n.collectionId : undefined,
        });
        model.nodes.push(node);
        validNodeIds.add(nodeId);
      }
    }
  }

  // Connections (drop dangling)
  if (Array.isArray(raw.connections)) {
    for (const rawConn of raw.connections) {
      if (rawConn && typeof rawConn === 'object') {
        const c = rawConn as Record<string, unknown>;
        const fromId = String(c.fromNodeId || '');
        const toId = String(c.toNodeId || '');
        if (validNodeIds.has(fromId) && validNodeIds.has(toId)) {
          const connId = typeof c.id === 'string' && c.id ? c.id : `conn-${Math.random().toString(36).slice(2, 9)}`;
          model.connections.push(
            createDefaultCanvasConnection(connId, fromId, toId, {
              relationship: c.relationship as CanvasConnection['relationship'],
              label: typeof c.label === 'string' ? c.label : undefined,
            })
          );
        }
      }
    }
  }

  // Tasks
  if (Array.isArray(raw.tasks)) {
    for (const rawTask of raw.tasks) {
      if (rawTask && typeof rawTask === 'object') {
        const t = rawTask as Record<string, unknown>;
        const taskId = typeof t.id === 'string' && t.id ? t.id : `task-${Math.random().toString(36).slice(2, 9)}`;
        const title = typeof t.title === 'string' && t.title ? t.title : 'Untitled Task';
        model.tasks.push(
          createDefaultCreatorTask(taskId, title, {
            description: typeof t.description === 'string' ? t.description : undefined,
            status: typeof t.status === 'string' ? (t.status as CreatorTaskRow['status']) : 'todo',
            priority: typeof t.priority === 'string' ? (t.priority as CreatorTaskRow['priority']) : 'medium',
            dueDate: typeof t.dueDate === 'string' ? t.dueDate : undefined,
            startDate: typeof t.startDate === 'string' ? t.startDate : undefined,
            assignee: typeof t.assignee === 'string' ? t.assignee : undefined,
            estimatedHours: typeof t.estimatedHours === 'number' ? t.estimatedHours : undefined,
            actualHours: typeof t.actualHours === 'number' ? t.actualHours : undefined,
            cost: typeof t.cost === 'number' ? t.cost : undefined,
            linkedNodeId: typeof t.linkedNodeId === 'string' && validNodeIds.has(t.linkedNodeId) ? t.linkedNodeId : undefined,
          })
        );
      }
    }
  }

  // Collections
  if (Array.isArray(raw.collections)) {
    for (const rawCol of raw.collections) {
      if (rawCol && typeof rawCol === 'object') {
        const col = rawCol as Record<string, unknown>;
        const colId = typeof col.id === 'string' && col.id ? col.id : `col-${Math.random().toString(36).slice(2, 9)}`;
        const colName = typeof col.name === 'string' && col.name ? col.name : 'Untitled Frame';
        model.collections.push(
          createDefaultCanvasCollection(colId, colName, {
            description: typeof col.description === 'string' ? col.description : undefined,
            category: typeof col.category === 'string' ? (col.category as CanvasCollection['category']) : 'custom',
            bounds: col.bounds as CanvasBounds,
            color: typeof col.color === 'string' ? col.color : undefined,
          })
        );
      }
    }
  }

  // Tags
  if (Array.isArray(raw.tags)) {
    for (const rawTag of raw.tags) {
      if (rawTag && typeof rawTag === 'object') {
        const tag = rawTag as Record<string, unknown>;
        const tagId = typeof tag.id === 'string' && tag.id ? tag.id : `tag-${Math.random().toString(36).slice(2, 9)}`;
        const tagName = typeof tag.name === 'string' && tag.name ? tag.name : 'Tag';
        const color = typeof tag.color === 'string' ? tag.color : '#3b82f6';
        model.tags.push(createDefaultCanvasTag(tagId, tagName, color));
      }
    }
  }

  return model;
}

/**
 * Migrates legacy payloads to schema version 1.0.0.
 */
export function migrateCreatorCanvasModel(data: unknown): CreatorCanvasModel {
  if (!data || typeof data !== 'object') {
    return createEmptyCreatorCanvasModel();
  }

  const raw = data as Record<string, unknown>;
  const sanitized = sanitizeCreatorCanvasModel(data);

  // If there was legacy title field
  if (typeof raw.title === 'string' && !raw.name) {
    sanitized.name = raw.title;
  }

  sanitized.schemaVersion = CREATOR_CANVAS_SCHEMA_VERSION;
  return sanitized;
}
