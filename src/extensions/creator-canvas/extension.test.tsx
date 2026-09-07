// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import { creatorCanvasExtension, registerCreatorCanvasExtension } from './extension';

describe('creatorCanvasExtension', () => {
  it('exposes the standard extension contract', () => {
    expect(creatorCanvasExtension.id).toBe('creator-canvas');
    expect(creatorCanvasExtension.getViews()[0].position).toBe('tab');
    expect(creatorCanvasExtension.getTaskModels()[0].id).toBe('creator-task');
    expect(creatorCanvasExtension.getTemplates()).toHaveLength(5);
    expect(creatorCanvasExtension.getTemplates().map((template) => template.id)).toEqual([
      'film-video-shot-list',
      'moodboard',
      'novel-outline',
      'web-design',
      'marketing-campaign',
    ]);
  });

  it('registers only when absent', () => {
    const register = jest.fn();
    registerCreatorCanvasExtension({ has: () => false, register });
    expect(register).toHaveBeenCalledWith(creatorCanvasExtension);

    const skipped = jest.fn();
    registerCreatorCanvasExtension({ has: () => true, register: skipped });
    expect(skipped).not.toHaveBeenCalled();
  });
});
