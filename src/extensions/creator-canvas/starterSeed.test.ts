// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import { createStarterCreatorCanvasModel } from './starterSeed';
import { validateCreatorCanvasModel } from './schema';

describe('createStarterCreatorCanvasModel', () => {
  it('creates a useful, valid starter canvas', () => {
    const model = createStarterCreatorCanvasModel('seed-1');

    expect(model.id).toBe('seed-1');
    expect(model.nodes).toHaveLength(3);
    expect(model.connections).toHaveLength(1);
    expect(model.tasks).toHaveLength(1);
    expect(model.collections).toHaveLength(1);
    expect(model.tags).toHaveLength(3);
    expect(validateCreatorCanvasModel(model)).toEqual({ valid: true, errors: [] });
  });

  it('supports a custom project name and domain', () => {
    const model = createStarterCreatorCanvasModel('seed-2', 'Film Board', 'film-video');
    expect(model.name).toBe('Film Board');
    expect(model.projectType).toBe('film-video');
  });
});
