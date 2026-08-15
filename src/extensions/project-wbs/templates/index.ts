// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Template Registry
 *
 * Exports all project templates for use in the template picker.
 * Supports both JSON data files and TypeScript code templates.
 */

import type { ExtensionTemplate } from '../../types';
import type { TemplateDefinition } from './types';
import { templateToProject } from './handler';
import type { ProjectTemplateJSON } from './types';
import simpleJSON from './json/simple.json';
import websiteJSON from './json/website.json';
import softwareJSON from './json/software.json';

// Cast JSON imports to strongly-typed templates
const simpleTemplate = simpleJSON as ProjectTemplateJSON;
const websiteTemplate = websiteJSON as ProjectTemplateJSON;
const softwareTemplate = softwareJSON as ProjectTemplateJSON;

// Import existing TypeScript templates (can be migrated to JSON over time)
import { createSimpleWBS } from './simple';
import { createWebsiteProject } from './website';
import { createSoftwareProject } from './software';
import { createRenovationProject } from './renovation';
import { createEventPlanningProject } from './event';
import { createMarketingCampaignProject } from './marketing';
import { createBusinessProject } from './business';
import { createProductLaunchProject } from './product';
import { createITMigrationProject } from './it-migration';
import { createAgileProject } from './agile';
import { createConstructionProject } from './construction';
import { createMiningConsultingProject } from './mining';

/**
 * JSON-based templates (data-driven, easily maintainable)
 */
const JSON_TEMPLATES: TemplateDefinition[] = [
  {
    id: simpleTemplate.id,
    name: simpleTemplate.name,
    description: simpleTemplate.description,
    category: simpleTemplate.category,
    create: () => templateToProject(simpleTemplate),
  },
  {
    id: websiteTemplate.id,
    name: websiteTemplate.name,
    description: websiteTemplate.description,
    category: websiteTemplate.category,
    create: () => templateToProject(websiteTemplate),
  },
  {
    id: softwareTemplate.id,
    name: softwareTemplate.name,
    description: softwareTemplate.description,
    category: softwareTemplate.category,
    create: () => templateToProject(softwareTemplate),
  },
];

/**
 * TypeScript-based templates (code-driven, for complex logic)
 */
const CODE_TEMPLATES: TemplateDefinition[] = [
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
  {
    id: 'renovation',
    name: 'Home Renovation',
    description: 'Complete home renovation from planning through finishing.',
    category: 'Construction',
    create: createRenovationProject,
  },
  {
    id: 'event',
    name: 'Event Planning',
    description: 'Complete event planning from venue selection to day-of execution.',
    category: 'Events',
    create: createEventPlanningProject,
  },
  {
    id: 'marketing',
    name: 'Marketing Campaign',
    description: 'End-to-end marketing campaign from research to analysis.',
    category: 'Marketing',
    create: createMarketingCampaignProject,
  },
  {
    id: 'business',
    name: 'Business Project',
    description: 'Generic business project from feasibility to review.',
    category: 'Business',
    create: createBusinessProject,
  },
  {
    id: 'product',
    name: 'Product Launch',
    description: 'Full product launch from development through post-launch.',
    category: 'Business',
    create: createProductLaunchProject,
  },
  {
    id: 'it-migration',
    name: 'IT Migration',
    description: 'IT infrastructure migration from audit through cutover.',
    category: 'IT',
    create: createITMigrationProject,
  },
  {
    id: 'agile',
    name: 'Agile/Sprint Planning',
    description: 'Agile project with backlog, sprints, review, and retro.',
    category: 'Software',
    create: createAgileProject,
  },
  {
    id: 'construction',
    name: 'Construction Project',
    description: 'Full construction project from pre-construction through finishing.',
    category: 'Construction',
    create: createConstructionProject,
  },
  {
    id: 'mining',
    name: 'Mining Consulting',
    description: 'Mining consulting from scoping through presentation.',
    category: 'Mining',
    create: createMiningConsultingProject,
  },
];

/**
 * Combined template registry (JSON templates first, then code templates)
 */
export const TEMPLATES: TemplateDefinition[] = [...JSON_TEMPLATES, ...CODE_TEMPLATES];

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
