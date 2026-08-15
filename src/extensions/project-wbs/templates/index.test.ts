// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { TEMPLATES, getTemplateById, getTemplatesByCategory, getAllCategories, getExtensionTemplates } from './index';
import { templateToProject } from './handler';
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
import type { ProjectTemplateJSON } from './types';
import { validateTree } from '../treeOps';
import { detectDependencyCycles } from '../dependencies';
import { flattenTasks } from '../dependencies';

describe('Templates', () => {
  describe('TEMPLATES registry', () => {
    it('has at least 3 templates', () => {
      expect(TEMPLATES.length).toBeGreaterThanOrEqual(3);
    });

    it('each template has required fields', () => {
      for (const tmpl of TEMPLATES) {
        expect(tmpl.id).toBeTruthy();
        expect(tmpl.name).toBeTruthy();
        expect(tmpl.description).toBeTruthy();
        expect(tmpl.category).toBeTruthy();
        expect(typeof tmpl.create).toBe('function');
      }
    });
  });

  describe('getTemplateById', () => {
    it('finds a template by ID', () => {
      const tmpl = getTemplateById('simple-wbs');
      expect(tmpl).toBeDefined();
      expect(tmpl!.name).toBe('Simple WBS');
    });

    it('returns undefined for unknown ID', () => {
      expect(getTemplateById('unknown')).toBeUndefined();
    });
  });

  describe('getTemplatesByCategory', () => {
    it('filters by category', () => {
      const generic = getTemplatesByCategory('Generic');
      expect(generic.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getAllCategories', () => {
    it('returns unique categories', () => {
      const categories = getAllCategories();
      expect(categories.length).toBeGreaterThanOrEqual(1);
      expect(new Set(categories).size).toBe(categories.length);
    });
  });

  describe('getExtensionTemplates', () => {
    it('returns extension template format', () => {
      const extTemplates = getExtensionTemplates();
      expect(extTemplates.length).toBe(TEMPLATES.length);
      for (const tmpl of extTemplates) {
        expect(tmpl.data).toBeDefined();
      }
    });
  });

  describe('Resource auto-assignment', () => {
    it('auto-assigns resources to tasks when none are assigned', () => {
      const project = templateToProject(miningJSON as ProjectTemplateJSON);
      const allTasks = flattenTasks(project.wbs);
      const leafTasks = allTasks.filter((t) => !t.isSummary && !t.isMilestone);
      
      // All leaf tasks should have a resource assigned
      for (const task of leafTasks) {
        expect(task.responsibleResourceId).toBeTruthy();
      }
      
      // Should use existing resources
      const resourceIds = new Set(project.resources.map((r) => r.id));
      for (const task of leafTasks) {
        expect(resourceIds.has(task.responsibleResourceId!)).toBe(true);
      }
    });

    it('does not override manually assigned resources', () => {
      const template = { ...simpleJSON, tasks: [{ ...simpleJSON.tasks[0], resourceId: 'res-1' }] } as ProjectTemplateJSON;
      const project = templateToProject(template);
      expect(project.wbs[0].responsibleResourceId).toBe('res-1');
    });
  });

  describe('Simple WBS template', () => {
    const project = templateToProject(simpleJSON as ProjectTemplateJSON);

    it('has a valid WBS tree', () => {
      const errors = validateTree(project.wbs);
      expect(errors).toEqual([]);
    });

    it('has no dependency cycles', () => {
      const flat = flattenTasks(project.wbs);
      expect(detectDependencyCycles(flat)).toEqual([]);
    });

    it('has at least 4 tasks', () => {
      const flat = flattenTasks(project.wbs);
      expect(flat.length).toBeGreaterThanOrEqual(4);
    });

    it('has at least 1 risk', () => {
      expect(project.risks.length).toBeGreaterThanOrEqual(1);
    });

    it('has at least 1 resource', () => {
      expect(project.resources.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Website template', () => {
    const project = templateToProject(websiteJSON as ProjectTemplateJSON);

    it('has a valid WBS tree', () => {
      const errors = validateTree(project.wbs);
      expect(errors).toEqual([]);
    });

    it('has no dependency cycles', () => {
      const flat = flattenTasks(project.wbs);
      expect(detectDependencyCycles(flat)).toEqual([]);
    });

    it('has multiple phases', () => {
      const flat = flattenTasks(project.wbs);
      expect(flat.length).toBeGreaterThan(10);
    });

    it('has risks', () => {
      expect(project.risks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Software template', () => {
    const project = templateToProject(softwareJSON as ProjectTemplateJSON);

    it('has a valid WBS tree', () => {
      const errors = validateTree(project.wbs);
      expect(errors).toEqual([]);
    });

    it('has no dependency cycles', () => {
      const flat = flattenTasks(project.wbs);
      expect(detectDependencyCycles(flat)).toEqual([]);
    });

    it('has multiple phases', () => {
      const flat = flattenTasks(project.wbs);
      expect(flat.length).toBeGreaterThan(10);
    });

    it('has risks', () => {
      expect(project.risks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Renovation template', () => {
    const project = templateToProject(renovationJSON as ProjectTemplateJSON);

    it('has a valid WBS tree', () => {
      const errors = validateTree(project.wbs);
      expect(errors).toEqual([]);
    });

    it('has multiple phases', () => {
      const flat = flattenTasks(project.wbs);
      expect(flat.length).toBeGreaterThan(10);
    });

    it('has resources', () => {
      expect(project.resources.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Event Planning template', () => {
    const project = templateToProject(eventJSON as ProjectTemplateJSON);

    it('has a valid WBS tree', () => {
      const errors = validateTree(project.wbs);
      expect(errors).toEqual([]);
    });

    it('has multiple phases', () => {
      const flat = flattenTasks(project.wbs);
      expect(flat.length).toBeGreaterThan(10);
    });
  });

  describe('Marketing Campaign template', () => {
    const project = templateToProject(marketingJSON as ProjectTemplateJSON);

    it('has a valid WBS tree', () => {
      const errors = validateTree(project.wbs);
      expect(errors).toEqual([]);
    });

    it('has multiple phases', () => {
      const flat = flattenTasks(project.wbs);
      expect(flat.length).toBeGreaterThan(10);
    });
  });

  describe('Business Project template', () => {
    const project = templateToProject(businessJSON as ProjectTemplateJSON);

    it('has a valid WBS tree', () => {
      const errors = validateTree(project.wbs);
      expect(errors).toEqual([]);
    });

    it('has multiple phases', () => {
      const flat = flattenTasks(project.wbs);
      expect(flat.length).toBeGreaterThan(8);
    });
  });

  describe('Product Launch template', () => {
    const project = templateToProject(productJSON as ProjectTemplateJSON);

    it('has a valid WBS tree', () => {
      const errors = validateTree(project.wbs);
      expect(errors).toEqual([]);
    });

    it('has multiple phases', () => {
      const flat = flattenTasks(project.wbs);
      expect(flat.length).toBeGreaterThan(10);
    });
  });

  describe('IT Migration template', () => {
    const project = templateToProject(itMigrationJSON as ProjectTemplateJSON);

    it('has a valid WBS tree', () => {
      const errors = validateTree(project.wbs);
      expect(errors).toEqual([]);
    });

    it('has multiple phases', () => {
      const flat = flattenTasks(project.wbs);
      expect(flat.length).toBeGreaterThan(10);
    });
  });

  describe('Agile/Sprint template', () => {
    const project = templateToProject(agileJSON as ProjectTemplateJSON);

    it('has a valid WBS tree', () => {
      const errors = validateTree(project.wbs);
      expect(errors).toEqual([]);
    });

    it('has multiple phases', () => {
      const flat = flattenTasks(project.wbs);
      expect(flat.length).toBeGreaterThan(10);
    });
  });

  describe('Construction template', () => {
    const project = templateToProject(constructionJSON as ProjectTemplateJSON);

    it('has a valid WBS tree', () => {
      const errors = validateTree(project.wbs);
      expect(errors).toEqual([]);
    });

    it('has multiple phases', () => {
      const flat = flattenTasks(project.wbs);
      expect(flat.length).toBeGreaterThan(15);
    });
  });

  describe('Mining Consulting template (JSON)', () => {
    const project = templateToProject(miningJSON as ProjectTemplateJSON);

    it('has a valid WBS tree', () => {
      const errors = validateTree(project.wbs);
      expect(errors).toEqual([]);
    });

    it('has no dependency cycles', () => {
      const flat = flattenTasks(project.wbs);
      expect(detectDependencyCycles(flat)).toEqual([]);
    });

    it('has multiple phases', () => {
      const flat = flattenTasks(project.wbs);
      expect(flat.length).toBeGreaterThan(30);
    });

    it('has risks', () => {
      expect(project.risks.length).toBeGreaterThanOrEqual(8);
    });

    it('has resources', () => {
      expect(project.resources.length).toBeGreaterThanOrEqual(5);
    });

    it('has categorized risks', () => {
      const categories = new Set(project.risks.map((r) => r.category));
      expect(categories.size).toBeGreaterThanOrEqual(4);
    });

    it('has 6 phases (FEL 1-3, EPC, Commissioning, Brownfield)', () => {
      // project.wbs is an array of root tasks (top-level phases)
      expect(project.wbs.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Real Estate Photoshoot template', () => {
    const project = templateToProject(realestatePhotoJSON as ProjectTemplateJSON);

    it('has a valid WBS tree', () => {
      const errors = validateTree(project.wbs);
      expect(errors).toEqual([]);
    });

    it('has no dependency cycles', () => {
      const flat = flattenTasks(project.wbs);
      expect(detectDependencyCycles(flat)).toEqual([]);
    });

    it('has multiple phases', () => {
      const flat = flattenTasks(project.wbs);
      expect(flat.length).toBeGreaterThan(15);
    });

    it('has risks', () => {
      expect(project.risks.length).toBeGreaterThanOrEqual(5);
    });

    it('has resources', () => {
      expect(project.resources.length).toBeGreaterThanOrEqual(4);
    });

    it('has categorized risks', () => {
      const categories = new Set(project.risks.map((r) => r.category));
      expect(categories.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('JSON template registry', () => {
    it('includes realestate-photo template', () => {
      const tmpl = getTemplateById('realestate-photo');
      expect(tmpl).toBeDefined();
      expect(tmpl!.name).toBe('Real Estate Photoshoot');
    });

    it('has Real Estate category', () => {
      const categories = getAllCategories();
      expect(categories).toContain('Real Estate');
    });
  });
});
