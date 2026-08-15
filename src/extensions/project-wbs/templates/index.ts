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
import realestatePhotoJSON from './json/realestate-photo.json';
import miningJSON from './json/mining.json';
import renovationJSON from './json/renovation.json';
import eventJSON from './json/event.json';
import marketingJSON from './json/marketing.json';
import businessJSON from './json/business.json';
import productJSON from './json/product.json';
import itMigrationJSON from './json/it-migration.json';
import agileJSON from './json/agile.json';
import constructionJSON from './json/construction.json';

// Cast JSON imports to strongly-typed templates
const simpleTemplate = simpleJSON as ProjectTemplateJSON;
const websiteTemplate = websiteJSON as ProjectTemplateJSON;
const softwareTemplate = softwareJSON as ProjectTemplateJSON;
const realestatePhotoTemplate = realestatePhotoJSON as ProjectTemplateJSON;
const miningTemplate = miningJSON as ProjectTemplateJSON;
const renovationTemplate = renovationJSON as ProjectTemplateJSON;
const eventTemplate = eventJSON as ProjectTemplateJSON;
const marketingTemplate = marketingJSON as ProjectTemplateJSON;
const businessTemplate = businessJSON as ProjectTemplateJSON;
const productTemplate = productJSON as ProjectTemplateJSON;
const itMigrationTemplate = itMigrationJSON as ProjectTemplateJSON;
const agileTemplate = agileJSON as ProjectTemplateJSON;
const constructionTemplate = constructionJSON as ProjectTemplateJSON;

// All templates migrated to JSON format

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
  {
    id: realestatePhotoTemplate.id,
    name: realestatePhotoTemplate.name,
    description: realestatePhotoTemplate.description,
    category: realestatePhotoTemplate.category,
    create: () => templateToProject(realestatePhotoTemplate),
  },
  {
    id: miningTemplate.id,
    name: miningTemplate.name,
    description: miningTemplate.description,
    category: miningTemplate.category,
    create: () => templateToProject(miningTemplate),
  },
  {
    id: renovationTemplate.id,
    name: renovationTemplate.name,
    description: renovationTemplate.description,
    category: renovationTemplate.category,
    create: () => templateToProject(renovationTemplate),
  },
  {
    id: eventTemplate.id,
    name: eventTemplate.name,
    description: eventTemplate.description,
    category: eventTemplate.category,
    create: () => templateToProject(eventTemplate),
  },
  {
    id: marketingTemplate.id,
    name: marketingTemplate.name,
    description: marketingTemplate.description,
    category: marketingTemplate.category,
    create: () => templateToProject(marketingTemplate),
  },
  {
    id: businessTemplate.id,
    name: businessTemplate.name,
    description: businessTemplate.description,
    category: businessTemplate.category,
    create: () => templateToProject(businessTemplate),
  },
  {
    id: productTemplate.id,
    name: productTemplate.name,
    description: productTemplate.description,
    category: productTemplate.category,
    create: () => templateToProject(productTemplate),
  },
  {
    id: itMigrationTemplate.id,
    name: itMigrationTemplate.name,
    description: itMigrationTemplate.description,
    category: itMigrationTemplate.category,
    create: () => templateToProject(itMigrationTemplate),
  },
  {
    id: agileTemplate.id,
    name: agileTemplate.name,
    description: agileTemplate.description,
    category: agileTemplate.category,
    create: () => templateToProject(agileTemplate),
  },
  {
    id: constructionTemplate.id,
    name: constructionTemplate.name,
    description: constructionTemplate.description,
    category: constructionTemplate.category,
    create: () => templateToProject(constructionTemplate),
  },
];

/**
 * Template registry - all templates in JSON format
 */
export const TEMPLATES: TemplateDefinition[] = [...JSON_TEMPLATES];

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
