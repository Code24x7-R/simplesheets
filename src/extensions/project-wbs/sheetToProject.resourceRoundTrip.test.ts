// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect } from '@jest/globals';
import { projectModelToWorkbook, workbookToProject } from './sheetToProject';
import type { ProjectModel } from '../../types';

describe('Resource round-trip through sheet conversion', () => {
  it('preserves resource assignment when converting to workbook and back', () => {
    const model: ProjectModel = {
      id: 'proj-1',
      name: 'Test Project',
      description: 'Test',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      tasks: [
        {
          id: 'task-1',
          name: 'Design Phase',
          startDate: '2025-01-01',
          endDate: '2025-01-10',
          duration: 10,
          parentId: null,
          dependencies: [],
          progress: 0,
          resourceId: 'res-1', // References resource by ID
          isMilestone: false,
          color: '#3B82F6',
          notes: '',
        },
        {
          id: 'task-2',
          name: 'Build Phase',
          startDate: '2025-01-11',
          endDate: '2025-01-20',
          duration: 10,
          parentId: null,
          dependencies: [],
          progress: 0,
          resourceId: 'res-2',
          isMilestone: false,
          color: '#10B981',
          notes: '',
        },
      ],
      risks: [],
      resources: [
        { id: 'res-1', name: 'John Doe', role: 'Designer', costRate: 100, costCurrency: 'USD', availability: 100, color: '#3B82F6' },
        { id: 'res-2', name: 'Jane Smith', role: 'Developer', costRate: 120, costCurrency: 'USD', availability: 100, color: '#10B981' },
      ],
      materials: [],
      actuals: [],
    };

    // Convert to workbook
    const workbook = projectModelToWorkbook(model);

    // Re-parse the workbook
    const reparsed = workbookToProject(workbook, 'Project Plan');

    // Tasks should still reference the correct resources by name
    const designTask = reparsed.tasks.find((t) => t.name === 'Design Phase');
    const buildTask = reparsed.tasks.find((t) => t.name === 'Build Phase');

    expect(designTask).toBeDefined();
    expect(buildTask).toBeDefined();

    // The resourceId should be resolved to a valid resource (by name matching)
    const johnResource = reparsed.resources.find((r) => r.name === 'John Doe');
    const janeResource = reparsed.resources.find((r) => r.name === 'Jane Smith');

    expect(johnResource).toBeDefined();
    expect(janeResource).toBeDefined();

    // Tasks should reference the reparsed resource IDs (matched by name)
    expect(designTask!.resourceId).toBe(johnResource!.id);
    expect(buildTask!.resourceId).toBe(janeResource!.id);
  });

  it('writes resource name (not ID) as computedValue in task sheet resource column', () => {
    const model: ProjectModel = {
      id: 'proj-1',
      name: 'Test Project',
      description: 'Test',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      tasks: [
        {
          id: 'task-1',
          name: 'Design Phase',
          startDate: '2025-01-01',
          endDate: '2025-01-10',
          duration: 10,
          parentId: null,
          dependencies: [],
          progress: 0,
          resourceId: 'res-1',
          isMilestone: false,
          color: '#3B82F6',
          notes: '',
        },
      ],
      risks: [],
      resources: [
        { id: 'res-1', name: 'John Doe', role: 'Designer', costRate: 100, costCurrency: 'USD', availability: 100, color: '#3B82F6' },
      ],
      materials: [],
      actuals: [],
    };

    const workbook = projectModelToWorkbook(model);
    const tasksSheet = workbook.sheets.find((s) => s.name === 'Project Plan')!;

    // Find the resource column (column 7 based on headers)
    // The resource cell should have the resource NAME as computedValue, not the ID
    const resourceCell = tasksSheet.cells['1:7']; // Row 1, Column 7 (Resource column)

    expect(resourceCell).toBeDefined();
    // The computedValue should be the resource name, not the ID
    expect(resourceCell.computedValue).toBe('John Doe');
  });
});
