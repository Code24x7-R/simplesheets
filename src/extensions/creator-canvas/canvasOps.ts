// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import type {
  CreatorCanvasModel,
  CanvasNode,
  CanvasConnection,
  CreatorTaskRow,
  CanvasCollection,
  CanvasTag,
  CanvasSettings,
  CreatorProjectType,
  CreatorTechnique,
  CreatorProjectStatus,
} from './types';

function touchModified(): string {
  return new Date().toISOString();
}

/**
 * Immutably adds a node to the model.
 */
export function addCanvasNode(model: CreatorCanvasModel, node: CanvasNode): CreatorCanvasModel {
  return {
    ...model,
    nodes: [...model.nodes, node],
    modifiedDate: touchModified(),
  };
}

/**
 * Immutably updates an existing node.
 */
export function updateCanvasNode(
  model: CreatorCanvasModel,
  nodeId: string,
  updates: Partial<Omit<CanvasNode, 'id'>>
): CreatorCanvasModel {
  const now = touchModified();
  return {
    ...model,
    nodes: model.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates, modifiedDate: now } : n)),
    modifiedDate: now,
  };
}

/**
 * Immutably removes a node, cascading removal to connections and unlinking from tasks.
 */
export function removeCanvasNode(model: CreatorCanvasModel, nodeId: string): CreatorCanvasModel {
  return {
    ...model,
    nodes: model.nodes.filter((n) => n.id !== nodeId),
    connections: model.connections.filter((c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId),
    tasks: model.tasks.map((t) => (t.linkedNodeId === nodeId ? { ...t, linkedNodeId: undefined } : t)),
    modifiedDate: touchModified(),
  };
}

/**
 * Immutably adds a connection.
 */
export function addCanvasConnection(
  model: CreatorCanvasModel,
  connection: CanvasConnection
): CreatorCanvasModel {
  return {
    ...model,
    connections: [...model.connections, connection],
    modifiedDate: touchModified(),
  };
}

/**
 * Immutably removes a connection.
 */
export function removeCanvasConnection(
  model: CreatorCanvasModel,
  connectionId: string
): CreatorCanvasModel {
  return {
    ...model,
    connections: model.connections.filter((c) => c.id !== connectionId),
    modifiedDate: touchModified(),
  };
}

/**
 * Immutably adds a task.
 */
export function addCreatorTask(model: CreatorCanvasModel, task: CreatorTaskRow): CreatorCanvasModel {
  return {
    ...model,
    tasks: [...model.tasks, task],
    modifiedDate: touchModified(),
  };
}

/**
 * Immutably updates a task.
 */
export function updateCreatorTask(
  model: CreatorCanvasModel,
  taskId: string,
  updates: Partial<Omit<CreatorTaskRow, 'id'>>
): CreatorCanvasModel {
  const now = touchModified();
  return {
    ...model,
    tasks: model.tasks.map((t) => (t.id === taskId ? { ...t, ...updates, modifiedDate: now } : t)),
    modifiedDate: now,
  };
}

/**
 * Immutably removes a task.
 */
export function removeCreatorTask(model: CreatorCanvasModel, taskId: string): CreatorCanvasModel {
  return {
    ...model,
    tasks: model.tasks.filter((t) => t.id !== taskId),
    modifiedDate: touchModified(),
  };
}

/**
 * Immutably adds a collection frame.
 */
export function addCanvasCollection(
  model: CreatorCanvasModel,
  collection: CanvasCollection
): CreatorCanvasModel {
  return {
    ...model,
    collections: [...model.collections, collection],
    modifiedDate: touchModified(),
  };
}

/**
 * Immutably updates a collection frame.
 */
export function updateCanvasCollection(
  model: CreatorCanvasModel,
  collectionId: string,
  updates: Partial<Omit<CanvasCollection, 'id'>>
): CreatorCanvasModel {
  return {
    ...model,
    collections: model.collections.map((col) => (col.id === collectionId ? { ...col, ...updates } : col)),
    modifiedDate: touchModified(),
  };
}

/**
 * Immutably removes a collection frame and unlinks member nodes.
 */
export function removeCanvasCollection(
  model: CreatorCanvasModel,
  collectionId: string
): CreatorCanvasModel {
  return {
    ...model,
    collections: model.collections.filter((col) => col.id !== collectionId),
    nodes: model.nodes.map((n) => (n.collectionId === collectionId ? { ...n, collectionId: undefined } : n)),
    modifiedDate: touchModified(),
  };
}

/**
 * Immutably adds a tag.
 */
export function addCanvasTag(model: CreatorCanvasModel, tag: CanvasTag): CreatorCanvasModel {
  return {
    ...model,
    tags: [...model.tags, tag],
    modifiedDate: touchModified(),
  };
}

/**
 * Immutably removes a tag and unlinks it from all nodes and tasks.
 */
export function removeCanvasTag(model: CreatorCanvasModel, tagId: string): CreatorCanvasModel {
  return {
    ...model,
    tags: model.tags.filter((t) => t.id !== tagId),
    nodes: model.nodes.map((n) => ({
      ...n,
      tagIds: n.tagIds ? n.tagIds.filter((t) => t !== tagId) : [],
    })),
    tasks: model.tasks.map((task) => ({
      ...task,
      tagIds: task.tagIds ? task.tagIds.filter((t) => t !== tagId) : [],
    })),
    modifiedDate: touchModified(),
  };
}

/**
 * Immutably updates canvas viewport settings.
 */
export function updateCanvasSettings(
  model: CreatorCanvasModel,
  settings: Partial<CanvasSettings>
): CreatorCanvasModel {
  return {
    ...model,
    canvas: {
      ...model.canvas,
      ...settings,
    },
    modifiedDate: touchModified(),
  };
}

/**
 * Immutably updates top-level project metadata.
 */
export function updateProjectMeta(
  model: CreatorCanvasModel,
  meta: {
    name?: string;
    description?: string;
    projectType?: CreatorProjectType;
    techniques?: CreatorTechnique[];
    status?: CreatorProjectStatus;
    startDate?: string;
    targetDate?: string;
  }
): CreatorCanvasModel {
  return {
    ...model,
    ...meta,
    modifiedDate: touchModified(),
  };
}
