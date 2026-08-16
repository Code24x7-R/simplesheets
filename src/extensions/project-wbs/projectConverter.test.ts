// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { exportProjectToJSON, importProjectFromJSON, validateProjectJSON, projectToModel } from './projectConverter';
import { templateToProject } from './templates/handler';
import simpleJSON from './templates/json/simple.json';
import type { ProjectTemplateJSON } from './templates/types';
import type { Project } from '../types';

const createTestProject = (): Project => templateToProject(simpleJSON as ProjectTemplateJSON);

describe('projectConverter import/export', () => {
  describe('exportProjectToJSON', () => {
    it('exports project to valid JSON string', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('includes format identifier', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const parsed = JSON.parse(json);
      expect(parsed.format).toBe('simplesheets-project');
    });

    it('includes version', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe('1.0.0');
    });

    it('includes export timestamp', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const parsed = JSON.parse(json);
      expect(parsed.exportedAt).toBeDefined();
      expect(new Date(parsed.exportedAt).getTime()).not.toBeNaN();
    });

    it('includes project data', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const parsed = JSON.parse(json);
      expect(parsed.project).toBeDefined();
      expect(parsed.project.id).toBe(project.id);
      expect(parsed.project.name).toBe(project.name);
    });

    it('includes all tasks', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const parsed = JSON.parse(json);
      expect(parsed.project.tasks.length).toBeGreaterThan(0);
    });

    it('includes risks', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const parsed = JSON.parse(json);
      expect(parsed.project.risks.length).toBe(project.risks.length);
    });

    it('includes resources', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const parsed = JSON.parse(json);
      expect(parsed.project.resources.length).toBe(project.resources.length);
    });

    it('includes materials', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const parsed = JSON.parse(json);
      expect(parsed.project.materials.length).toBe(project.materials?.length ?? 0);
    });
  });

  describe('importProjectFromJSON', () => {
    it('imports project from valid JSON', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const imported = importProjectFromJSON(json);
      expect(imported.id).toBe(project.id);
      expect(imported.name).toBe(project.name);
    });

    it('preserves task data', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const imported = importProjectFromJSON(json);
      expect(imported.wbs.length).toBe(project.wbs.length);
    });

    it('preserves risk data', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const imported = importProjectFromJSON(json);
      expect(imported.risks.length).toBe(project.risks.length);
    });

    it('preserves resource data', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const imported = importProjectFromJSON(json);
      expect(imported.resources.length).toBe(project.resources.length);
    });

    it('preserves material data', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const imported = importProjectFromJSON(json);
      expect(imported.materials?.length).toBe(project.materials?.length);
    });

    it('throws on invalid JSON syntax', () => {
      expect(() => importProjectFromJSON('not valid json')).toThrow('Invalid JSON syntax');
    });

    it('throws on wrong format identifier', () => {
      const invalidJSON = JSON.stringify({ format: 'unknown', project: {} });
      expect(() => importProjectFromJSON(invalidJSON)).toThrow('Invalid project file format');
    });

    it('throws on missing project data', () => {
      const invalidJSON = JSON.stringify({ format: 'simplesheets-project', version: '1.0.0' });
      expect(() => importProjectFromJSON(invalidJSON)).toThrow('Invalid project data');
    });

    it('throws on null input', () => {
      const invalidJSON = JSON.stringify(null);
      expect(() => importProjectFromJSON(invalidJSON)).toThrow();
    });

    it('throws on non-object input', () => {
      const invalidJSON = JSON.stringify('string');
      expect(() => importProjectFromJSON(invalidJSON)).toThrow('Project data must be an object');
    });
  });

  describe('validateProjectJSON', () => {
    it('returns true for valid project JSON', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      expect(validateProjectJSON(json)).toBe(true);
    });

    it('throws for invalid JSON', () => {
      expect(() => validateProjectJSON('invalid')).toThrow();
    });

    it('throws for wrong format', () => {
      const invalidJSON = JSON.stringify({ format: 'wrong' });
      expect(() => validateProjectJSON(invalidJSON)).toThrow();
    });
  });

  describe('round-trip export/import', () => {
    it('preserves project name', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const imported = importProjectFromJSON(json);
      expect(imported.name).toBe(project.name);
    });

    it('preserves project description', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const imported = importProjectFromJSON(json);
      expect(imported.description).toBe(project.description);
    });

    it('preserves project dates', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const imported = importProjectFromJSON(json);
      expect(imported.startDate).toBe(project.startDate);
      expect(imported.endDate).toBe(project.endDate);
    });

    it('preserves task count', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const imported = importProjectFromJSON(json);
      const projectTaskCount = projectToModel(project).tasks.length;
      const importedTaskCount = projectToModel(imported).tasks.length;
      expect(importedTaskCount).toBe(projectTaskCount);
    });

    it('preserves risk count', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const imported = importProjectFromJSON(json);
      expect(imported.risks.length).toBe(project.risks.length);
    });

    it('preserves resource count', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const imported = importProjectFromJSON(json);
      expect(imported.resources.length).toBe(project.resources.length);
    });

    it('preserves material count', () => {
      const project = createTestProject();
      const json = exportProjectToJSON(project);
      const imported = importProjectFromJSON(json);
      expect(imported.materials?.length).toBe(project.materials?.length);
    });
  });
});
