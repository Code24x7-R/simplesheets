// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import { Palette } from 'lucide-react';
import { CreatorCanvasView } from './CreatorCanvasView';
import { createEmptyCreatorCanvasModel } from './schema';
import type { CreatorCanvasModel } from './types';
import type { ExtensionContext, ExtensionView, SheetExtension, TaskModelDefinition } from '../types';

const EXTENSION_ID = 'creator-canvas' as const;

function isCreatorCanvasModel(value: unknown): value is CreatorCanvasModel {
  return Boolean(value && typeof value === 'object' && 'schemaVersion' in value && 'nodes' in value);
}

function CreatorCanvasExtensionView({ data, context }: { data: unknown; context: { onDataChange: (data: unknown) => void; onClose: () => void } }) {
  const model = isCreatorCanvasModel(data) ? data : createEmptyCreatorCanvasModel();
  return <CreatorCanvasView project={model} onProjectChange={context.onDataChange} />;
}

const views: ExtensionView[] = [
  {
    id: 'creator-canvas-view',
    name: 'Creator Canvas',
    icon: Palette,
    component: CreatorCanvasExtensionView,
    position: 'tab',
  },
];

const taskModels: TaskModelDefinition[] = [
  {
    id: 'creator-task',
    name: 'Creator Task',
    description: 'A task linked to a Creator Canvas node or collection.',
    fields: [
      { id: 'title', name: 'Title', type: 'string', required: true },
      { id: 'status', name: 'Status', type: 'select', options: ['backlog', 'todo', 'in_progress', 'blocked', 'done'] },
      { id: 'dueDate', name: 'Due date', type: 'date' },
      { id: 'assignee', name: 'Assignee', type: 'string' },
    ],
  },
];

export const creatorCanvasExtension: SheetExtension = {
  id: EXTENSION_ID,
  name: 'Creator Canvas',
  description: 'Visual project organization backed by normalized workbook sheets.',
  version: '1.0.0',
  icon: Palette,
  category: 'visualization',
  initialize(_context: ExtensionContext): void {
    // Canvas data is loaded by the workbook integration in App.tsx.
  },
  destroy(): void {
    // No global resources are held by the extension.
  },
  getTaskModels: () => taskModels,
  getViews: () => views,
  getTemplates: () => [],
};

export function registerCreatorCanvasExtension(registry: { has: (id: string) => boolean; register: (extension: SheetExtension) => void }): void {
  if (!registry.has(EXTENSION_ID)) registry.register(creatorCanvasExtension);
}

export { EXTENSION_ID as CREATOR_CANVAS_EXTENSION_ID };
