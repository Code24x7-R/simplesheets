// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import type { ExtensionTemplate } from '../types';
import type { CreatorCanvasModel, CreatorProjectType } from './types';
import { createDefaultCanvasNode, createDefaultCanvasConnection } from './schema';
import { createStarterCreatorCanvasModel } from './starterSeed';

export const CREATOR_CANVAS_TEMPLATE_IDS = {
  film: 'film-video-shot-list',
  moodboard: 'moodboard',
  novel: 'novel-outline',
  web: 'web-design',
  marketing: 'marketing-campaign',
} as const;

type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  category: string;
  projectType: CreatorProjectType;
  techniques: CreatorCanvasModel['techniques'];
  nodes: Array<Parameters<typeof createDefaultCanvasNode>[2] & { type: Parameters<typeof createDefaultCanvasNode>[1]; id: string }>;
};

const definitions: TemplateDefinition[] = [
  {
    id: CREATOR_CANVAS_TEMPLATE_IDS.film,
    name: 'Film / Video Shot List',
    description: 'Plan scenes, shots, camera notes, and production tasks.',
    category: 'production',
    projectType: 'film-video',
    techniques: ['shot-list', 'storyboarding', 'project-planning'],
    nodes: [
      { id: 'scene-one', type: 'storyboard-frame', title: 'Scene 1 · Establishing Shot', description: 'Define location, action, and camera movement.', position: { x: 70, y: 90 } },
      { id: 'production-task', type: 'task', title: 'Prepare shot list', description: 'Confirm props, cast, location, and schedule.', position: { x: 390, y: 90 } },
    ],
  },
  {
    id: CREATOR_CANVAS_TEMPLATE_IDS.moodboard,
    name: 'Moodboard',
    description: 'Collect visual direction, references, colors, and inspiration.',
    category: 'design',
    projectType: 'design-graphic',
    techniques: ['moodboarding', 'reference-collection', 'concept-mapping'],
    nodes: [
      { id: 'visual-direction', type: 'note', title: 'Visual Direction', description: 'Describe the feeling, texture, and visual language.', position: { x: 70, y: 90 } },
      { id: 'palette', type: 'swatch', title: 'Color Palette', description: 'Add a primary, accent, and neutral color.', position: { x: 390, y: 90 } },
    ],
  },
  {
    id: CREATOR_CANVAS_TEMPLATE_IDS.novel,
    name: 'Novel Outline',
    description: 'Shape a story with characters, turning points, and scenes.',
    category: 'writing',
    projectType: 'writing',
    techniques: ['creative-writing', 'character-development', 'concept-mapping'],
    nodes: [
      { id: 'story-premise', type: 'brief', title: 'Story Premise', description: 'Who wants what, and what stands in the way?', position: { x: 70, y: 90 } },
      { id: 'opening', type: 'note', title: 'Opening Act', description: 'Introduce the world, protagonist, and inciting incident.', position: { x: 390, y: 90 } },
    ],
  },
  {
    id: CREATOR_CANVAS_TEMPLATE_IDS.web,
    name: 'Web Design',
    description: 'Organize a web experience from brief through launch.',
    category: 'design',
    projectType: 'design-web',
    techniques: ['creative-brief', 'research', 'project-planning'],
    nodes: [
      { id: 'web-brief', type: 'brief', title: 'Project Brief', description: 'Audience, goals, constraints, and success measures.', position: { x: 70, y: 90 } },
      { id: 'site-map', type: 'note', title: 'Site Map', description: 'List the key pages and user journeys.', position: { x: 390, y: 90 } },
    ],
  },
  {
    id: CREATOR_CANVAS_TEMPLATE_IDS.marketing,
    name: 'Marketing Campaign',
    description: 'Plan audience, messaging, creative assets, and delivery tasks.',
    category: 'campaigns',
    projectType: 'marketing',
    techniques: ['creative-brief', 'brainstorming', 'project-planning'],
    nodes: [
      { id: 'campaign-brief', type: 'brief', title: 'Campaign Brief', description: 'Define audience, offer, message, and call to action.', position: { x: 70, y: 90 } },
      { id: 'campaign-task', type: 'task', title: 'Build content calendar', description: 'Schedule campaign assets across channels.', position: { x: 390, y: 90 } },
    ],
  },
];

export const creatorCanvasTemplates: ExtensionTemplate[] = definitions.map(({ id, name, description, category }) => ({
  id,
  name,
  description,
  category,
  data: { templateId: id },
}));

export function createCreatorCanvasTemplateModel(templateId: string, id = `canvas-${Date.now()}`): CreatorCanvasModel {
  const definition = definitions.find((item) => item.id === templateId) || definitions[0];
  const model = createStarterCreatorCanvasModel(id, definition.name, definition.projectType);
  model.description = definition.description;
  model.techniques = definition.techniques;
  model.nodes = definition.nodes.map((node, index) => createDefaultCanvasNode(node.id, node.type, {
    ...node,
    width: node.width || 260,
    height: node.height || 150,
    collectionId: 'col-intro',
    tagIds: index === 0 ? ['tag-ideas'] : ['tag-action'],
  }));
  model.connections = model.nodes.length > 1
    ? [createDefaultCanvasConnection(`conn-${definition.id}`, model.nodes[0].id, model.nodes[1].id, {
        relationship: 'sequence',
        label: 'next step',
      })]
    : [];
  model.name = definition.name;
  return model;
}
