// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import type { CreatorCanvasModel, CreatorProjectType } from './types';
import {
  createEmptyCreatorCanvasModel,
  createDefaultCanvasNode,
  createDefaultCanvasConnection,
  createDefaultCreatorTask,
  createDefaultCanvasCollection,
  createDefaultCanvasTag,
} from './schema';

/**
 * Creates a rich starter/seed Creator Canvas model with introductory notes,
 * a reference link, a starter task, a collection frame, tags, and a connection.
 */
export function createStarterCreatorCanvasModel(
  id = `cc-${Date.now()}`,
  name = 'Welcome to Creator Canvas',
  projectType: CreatorProjectType = 'content-creation'
): CreatorCanvasModel {
  const model = createEmptyCreatorCanvasModel(id, name, projectType);
  model.description = 'A visual project canvas for organizing ideas, references, tasks, and media.';
  model.techniques = ['note-taking', 'moodboarding', 'project-planning'];

  // Tags
  const tagWelcome = createDefaultCanvasTag('tag-welcome', 'Welcome', '#3b82f6');
  const tagIdeas = createDefaultCanvasTag('tag-ideas', 'Ideas', '#10b981');
  const tagAction = createDefaultCanvasTag('tag-action', 'Action', '#8b5cf6');
  model.tags = [tagWelcome, tagIdeas, tagAction];

  // Collection frame
  const introCollection = createDefaultCanvasCollection('col-intro', 'Getting Started', {
    bounds: { x: 40, y: 40, width: 620, height: 360 },
    color: '#e2e8f0',
    description: 'Explore the basics of Creator Canvas',
  });
  model.collections = [introCollection];

  // Nodes
  const noteNode = createDefaultCanvasNode('node-welcome', 'note', {
    title: 'Welcome to Canvas!',
    description: 'This canvas is backed directly by your spreadsheet workbook.\n\nAdd notes, links, tasks, and images to map out your creative workflow.',
    position: { x: 60, y: 80 },
    width: 260,
    height: 180,
    tagIds: ['tag-welcome', 'tag-ideas'],
    collectionId: 'col-intro',
    payload: {
      type: 'note',
      data: {
        text: 'This canvas is backed directly by your spreadsheet workbook.',
        format: 'plain',
      },
    },
  });

  const linkNode = createDefaultCanvasNode('node-docs', 'link', {
    title: 'Reference & Links',
    description: 'Pin external references, inspiration docs, and tools.',
    position: { x: 360, y: 80 },
    width: 260,
    height: 140,
    tagIds: ['tag-ideas'],
    collectionId: 'col-intro',
    payload: {
      type: 'link',
      data: {
        url: 'https://github.com/Code24x7-R/simplesheets',
        siteName: 'SimpleSheets Repository',
        description: 'Excel-compatible client-side spreadsheet application',
      },
    },
  });

  const taskNode = createDefaultCanvasNode('node-first-step', 'task', {
    title: 'Plan Next Deliverable',
    description: 'Track key milestones directly connected to your canvas.',
    position: { x: 60, y: 280 },
    width: 240,
    height: 100,
    tagIds: ['tag-action'],
    collectionId: 'col-intro',
    payload: {
      type: 'task',
      data: {
        taskId: 'task-first-step',
      },
    },
  });

  model.nodes = [noteNode, linkNode, taskNode];

  // Connection
  const introConnection = createDefaultCanvasConnection(
    'conn-welcome-to-task',
    'node-welcome',
    'node-first-step',
    {
      relationship: 'reference',
      label: 'leads to',
    }
  );
  model.connections = [introConnection];

  // Creator Task record
  const taskRow = createDefaultCreatorTask('task-first-step', 'Plan Next Deliverable', {
    description: 'Define scope, collect references, and assemble first draft on canvas',
    status: 'todo',
    priority: 'high',
    linkedNodeId: 'node-first-step',
    tagIds: ['tag-action'],
  });
  model.tasks = [taskRow];

  return model;
}
