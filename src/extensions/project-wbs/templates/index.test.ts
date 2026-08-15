// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { TEMPLATES, getTemplateById, getTemplatesByCategory, getAllCategories, getExtensionTemplates } from './index';
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
import { templateToProject } from './handler';
import realestatePhotoJSON from './json/realestate-photo.json';
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

  describe('Simple WBS template', () => {
    const project = createSimpleWBS();

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
    const project = createWebsiteProject();

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
    const project = createSoftwareProject();

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
    const project = createRenovationProject();

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
    const project = createEventPlanningProject();

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
    const project = createMarketingCampaignProject();

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
    const project = createBusinessProject();

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
    const project = createProductLaunchProject();

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
    const project = createITMigrationProject();

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
    const project = createAgileProject();

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
    const project = createConstructionProject();

    it('has a valid WBS tree', () => {
      const errors = validateTree(project.wbs);
      expect(errors).toEqual([]);
    });

    it('has multiple phases', () => {
      const flat = flattenTasks(project.wbs);
      expect(flat.length).toBeGreaterThan(15);
    });
  });

  describe('Mining Consulting template', () => {
    const project = createMiningConsultingProject();

    it('has a valid WBS tree', () => {
      const errors = validateTree(project.wbs);
      expect(errors).toEqual([]);
    });

    it('has multiple phases', () => {
      const flat = flattenTasks(project.wbs);
      expect(flat.length).toBeGreaterThan(8);
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
