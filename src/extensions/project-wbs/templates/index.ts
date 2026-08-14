// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Template Registry
 *
 * Exports all project templates for use in the template picker.
 */

import type { ExtensionTemplate } from '../../types';
import { createSimpleWBS } from './simple';
import { createWebsiteProject } from './website';
import { createSoftwareProject } from './software';

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  create: () => import('../../types').Project;
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'simple-wbs',
    name: 'Simple WBS',
    description: 'A minimal customizable WBS with planning, execution, and closure phases.',
    category: 'Generic',
    create: createSimpleWBS,
  },
  {
    id: 'website',
    name: 'Website Project',
    description: 'Complete website design and development from discovery to launch.',
    category: 'Web/Dev',
    create: createWebsiteProject,
  },
  {
    id: 'software',
    name: 'Software Development',
    description: 'Full SDLC: requirements, design, development, QA, deployment.',
    category: 'Software',
    create: createSoftwareProject,
  },
];

export function getTemplateById(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: string): TemplateDefinition[] {
  return TEMPLATES.filter((t) => t.category === category);
}

export function getAllCategories(): string[] {
  return [...new Set(TEMPLATES.map((t) => t.category))];
}

export function getExtensionTemplates(): ExtensionTemplate[] {
  return TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    data: t.create(),
  }));
}
