// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import { createCreatorCanvasTemplateModel, creatorCanvasTemplates } from './templates';

describe('Creator Canvas templates', () => {
  it('publishes the five starter presets', () => {
    expect(creatorCanvasTemplates).toHaveLength(5);
    expect(creatorCanvasTemplates.every((template) => template.data)).toBe(true);
  });

  it.each([
    'film-video-shot-list',
    'moodboard',
    'novel-outline',
    'web-design',
    'marketing-campaign',
  ])('creates a valid model for %s', (templateId) => {
    const model = createCreatorCanvasTemplateModel(templateId, `test-${templateId}`);
    expect(model.id).toBe(`test-${templateId}`);
    expect(model.nodes.length).toBeGreaterThanOrEqual(2);
    expect(model.connections).toHaveLength(1);
    expect(model.connections[0].fromNodeId).toBe(model.nodes[0].id);
    expect(model.connections[0].toNodeId).toBe(model.nodes[1].id);
  });

  it('falls back to the first preset for unknown ids', () => {
    expect(createCreatorCanvasTemplateModel('unknown').name).toBe('Film / Video Shot List');
  });
});
