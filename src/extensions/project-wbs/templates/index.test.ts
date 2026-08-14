// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { TEMPLATES, getTemplateById, getTemplatesByCategory, getAllCategories, getExtensionTemplates } from './index';
import { createSimpleWBS } from './simple';
import { createWebsiteProject } from './website';
import { createSoftwareProject } from './software';
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
});
