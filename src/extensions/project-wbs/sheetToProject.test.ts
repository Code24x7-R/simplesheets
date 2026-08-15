// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { detectColumnMapping, sheetToProject, projectModelToProject, projectModelToSheetCells, createProjectSheet, createSheetFromTemplate, getDefaultColumnMapping, PROJECT_SHEET_HEADERS, resourceToRow, rowToResource, riskToRow, rowToRisk } from './sheetToProject';
import type { Resource, Risk } from '../types';
import type { Sheet, ColumnMapping, ProjectModel } from '../../types';

function makeCell(row: number, col: number, value: string) {
  return { [`${row}:${col}`]: { rawValue: value, computedValue: value } };
}

function makeSheet(cells: Record<string, { rawValue: string; computedValue: string }>, colCount = 6, rowCount = 5): Sheet {
  return {
    id: 'sheet-1',
    name: 'Project Plan',
    cells,
    defaultColWidth: 100,
    defaultRowHeight: 24,
    columnWidths: {},
    rowHeights: {},
    columnCount: colCount,
    rowCount: rowCount,
    frozenColumns: 0,
    frozenRows: 0,
  };
}

describe('sheetToProject', () => {
  describe('detectColumnMapping', () => {
    it('detects standard column headers', () => {
      const sheet = makeSheet({
        ...makeCell(0, 0, 'Task'),
        ...makeCell(0, 1, 'Start Date'),
        ...makeCell(0, 2, 'End Date'),
        ...makeCell(0, 3, 'Progress'),
        ...makeCell(1, 0, 'My Task'),
        ...makeCell(1, 1, '2025-01-15'),
      });

      const mapping = detectColumnMapping(sheet);
      expect(mapping).not.toBeNull();
      expect(mapping!.taskCol).toBe(0);
      expect(mapping!.startDateCol).toBe(1);
      expect(mapping!.endDateCol).toBe(2);
      expect(mapping!.progressCol).toBe(3);
      expect(mapping!.headerRow).toBe(0);
    });

    it('detects alternate header names', () => {
      const sheet = makeSheet({
        ...makeCell(0, 0, 'Name'),
        ...makeCell(0, 1, 'Start'),
        ...makeCell(0, 2, 'Due'),
      });

      const mapping = detectColumnMapping(sheet);
      expect(mapping).not.toBeNull();
      expect(mapping!.taskCol).toBe(0);
      expect(mapping!.startDateCol).toBe(1);
      expect(mapping!.endDateCol).toBe(2);
    });

    it('returns null when no task column found', () => {
      const sheet = makeSheet({
        ...makeCell(0, 0, 'Foo'),
        ...makeCell(0, 1, 'Bar'),
      });

      expect(detectColumnMapping(sheet)).toBeNull();
    });

    it('detects header row not at top', () => {
      const sheet = makeSheet({
        ...makeCell(0, 0, ''),
        ...makeCell(1, 0, 'Task'),
        ...makeCell(1, 1, 'Start'),
        ...makeCell(1, 2, 'End'),
      }, 3, 5);

      const mapping = detectColumnMapping(sheet);
      expect(mapping).not.toBeNull();
      expect(mapping!.headerRow).toBe(1);
    });
  });

  describe('sheetToProject', () => {
    function makeBasicSheet(): Sheet {
      return makeSheet({
        ...makeCell(0, 0, 'Task'),
        ...makeCell(0, 1, 'Start Date'),
        ...makeCell(0, 2, 'End Date'),
        ...makeCell(0, 3, 'Progress'),
        ...makeCell(0, 4, 'Parent'),
        ...makeCell(0, 5, 'Dependency'),
        ...makeCell(1, 0, 'Planning Phase'),
        ...makeCell(1, 1, '2025-01-01'),
        ...makeCell(1, 2, '2025-01-15'),
        ...makeCell(1, 3, '50'),
        ...makeCell(2, 0, 'Research'),
        ...makeCell(2, 1, '2025-01-01'),
        ...makeCell(2, 2, '2025-01-05'),
        ...makeCell(2, 3, '100'),
        ...makeCell(2, 4, 'Planning Phase'),
        ...makeCell(3, 0, 'Design'),
        ...makeCell(3, 1, '2025-01-06'),
        ...makeCell(3, 2, '2025-01-15'),
        ...makeCell(3, 3, '0'),
        ...makeCell(3, 4, 'Planning Phase'),
        ...makeCell(3, 5, '2'),
      }, 6, 5);
    }

    it('converts sheet data to project model', () => {
      const sheet = makeBasicSheet();
      const mapping: ColumnMapping = {
        taskCol: 0,
        startDateCol: 1,
        endDateCol: 2,
        durationCol: null,
        parentCol: 4,
        dependencyCol: 5,
        progressCol: 3,
        resourceCol: null,
        milestoneCol: null,
        colorCol: null,
        notesCol: null,
        headerRow: 0,
      };

      const project = sheetToProject(sheet, mapping);
      expect(project.tasks).toHaveLength(3);
      expect(project.tasks[0].name).toBe('Planning Phase');
      expect(project.tasks[0].startDate).toBe('2025-01-01');
      expect(project.tasks[0].endDate).toBe('2025-01-15');
      expect(project.tasks[0].progress).toBe(50);
    });

    it('resolves parent references by name', () => {
      const sheet = makeBasicSheet();
      const mapping: ColumnMapping = {
        taskCol: 0,
        startDateCol: 1,
        endDateCol: 2,
        durationCol: null,
        parentCol: 4,
        dependencyCol: 5,
        progressCol: 3,
        resourceCol: null,
        milestoneCol: null,
        colorCol: null,
        notesCol: null,
        headerRow: 0,
      };

      const project = sheetToProject(sheet, mapping);
      // Research and Design should have Planning Phase as parent
      const research = project.tasks.find((t) => t.name === 'Research');
      const planningPhase = project.tasks.find((t) => t.name === 'Planning Phase');
      expect(research!.parentId).toBe(planningPhase!.id);
    });

    it('resolves dependency references by row number', () => {
      const sheet = makeBasicSheet();
      const mapping: ColumnMapping = {
        taskCol: 0,
        startDateCol: 1,
        endDateCol: 2,
        durationCol: null,
        parentCol: 4,
        dependencyCol: 5,
        progressCol: 3,
        resourceCol: null,
        milestoneCol: null,
        colorCol: null,
        notesCol: null,
        headerRow: 0,
      };

      const project = sheetToProject(sheet, mapping);
      // Design row has dependency "2" which is Research (row 2 in sheet = index 1 in tasks)
      const design = project.tasks.find((t) => t.name === 'Design');
      expect(design!.dependencies.length).toBeGreaterThan(0);
    });

    it('skips empty rows', () => {
      const sheet = makeSheet({
        ...makeCell(0, 0, 'Task'),
        ...makeCell(0, 1, 'Start'),
        ...makeCell(0, 2, 'End'),
        ...makeCell(1, 0, 'Task 1'),
        ...makeCell(1, 1, '2025-01-01'),
        ...makeCell(1, 2, '2025-01-05'),
        ...makeCell(2, 0, ''), // Empty row
        ...makeCell(3, 0, 'Task 2'),
        ...makeCell(3, 1, '2025-01-06'),
        ...makeCell(3, 2, '2025-01-10'),
      }, 3, 5);

      const mapping: ColumnMapping = {
        taskCol: 0,
        startDateCol: 1,
        endDateCol: 2,
        durationCol: null,
        parentCol: null,
        dependencyCol: null,
        progressCol: null,
        resourceCol: null,
        milestoneCol: null,
        colorCol: null,
        notesCol: null,
        headerRow: 0,
      };

      const project = sheetToProject(sheet, mapping);
      expect(project.tasks).toHaveLength(2);
    });

    it('computes project date range', () => {
      const sheet = makeBasicSheet();
      const mapping: ColumnMapping = {
        taskCol: 0,
        startDateCol: 1,
        endDateCol: 2,
        durationCol: null,
        parentCol: null,
        dependencyCol: null,
        progressCol: null,
        resourceCol: null,
        milestoneCol: null,
        colorCol: null,
        notesCol: null,
        headerRow: 0,
      };

      const project = sheetToProject(sheet, mapping);
      expect(project.startDate).toBe('2025-01-01');
      expect(project.endDate).toBe('2025-01-15');
    });

    it('parses percentage progress values', () => {
      const sheet = makeSheet({
        ...makeCell(0, 0, 'Task'),
        ...makeCell(0, 1, 'Progress'),
        ...makeCell(1, 0, 'Task 1'),
        ...makeCell(1, 1, '75%'),
      }, 2, 3);

      const mapping: ColumnMapping = {
        taskCol: 0,
        startDateCol: -1,
        endDateCol: -1,
        durationCol: null,
        parentCol: null,
        dependencyCol: null,
        progressCol: 1,
        resourceCol: null,
        milestoneCol: null,
        colorCol: null,
        notesCol: null,
        headerRow: 0,
      };

      const project = sheetToProject(sheet, mapping);
      expect(project.tasks[0].progress).toBe(75);
    });
  });

  describe('projectModelToProject', () => {
    it('builds WBSTask tree from flat tasks', () => {
      const model = {
        id: 'proj-1',
        name: 'Test Project',
        description: 'Test',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        tasks: [
          { id: 't1', name: 'Phase 1', startDate: '2025-01-01', endDate: '2025-01-15', duration: 15, parentId: null, dependencies: [], progress: 0, resourceId: null, isMilestone: false, color: '#3B82F6', notes: '' },
          { id: 't2', name: 'Task A', startDate: '2025-01-01', endDate: '2025-01-05', duration: 5, parentId: 't1', dependencies: [], progress: 0, resourceId: null, isMilestone: false, color: '#3B82F6', notes: '' },
          { id: 't3', name: 'Task B', startDate: '2025-01-06', endDate: '2025-01-15', duration: 10, parentId: 't1', dependencies: ['t2'], progress: 0, resourceId: null, isMilestone: false, color: '#3B82F6', notes: '' },
        ],
        risks: [],
      resources: [],
      };

      const project = projectModelToProject(model);
      expect(project.wbs).toHaveLength(1); // Phase 1 is root
      expect(project.wbs[0].children).toHaveLength(2); // Task A and Task B
      expect(project.wbs[0].isSummary).toBe(true);
      expect(project.wbs[0].children[0].name).toBe('Task A'); // First child
      expect(project.wbs[0].children[1].dependencies[0].predecessorId).toBe('t2'); // Task B depends on Task A
    });

    it('sets task levels correctly', () => {
      const model = {
        id: 'proj-1',
        name: 'Test',
        description: '',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        tasks: [
          { id: 't1', name: 'Root', startDate: '2025-01-01', endDate: '2025-01-31', duration: 30, parentId: null, dependencies: [], progress: 0, resourceId: null, isMilestone: false, color: '#3B82F6', notes: '' },
          { id: 't2', name: 'Child', startDate: '2025-01-01', endDate: '2025-01-15', duration: 15, parentId: 't1', dependencies: [], progress: 0, resourceId: null, isMilestone: false, color: '#3B82F6', notes: '' },
        ],
        risks: [],
      resources: [],
      };

      const project = projectModelToProject(model);
      expect(project.wbs[0].level).toBe(0);
      expect(project.wbs[0].children[0].level).toBe(1);
    });

    it('converts risks', () => {
      const model = {
        id: 'proj-1',
        name: 'Test',
        description: '',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        tasks: [],
        risks: [
          { id: 'r1', title: 'Server down', category: 'technical', probability: 4, impact: 5, status: 'identified', ownerId: null, mitigationPlan: 'Add redundancy', notes: '' },
        ],
        resources: [],
      };

      const project = projectModelToProject(model);
      expect(project.risks).toHaveLength(1);
      expect(project.risks[0].title).toBe('Server down');
      expect(project.risks[0].probability).toBe(4);
      expect(project.risks[0].impact).toBe(5);
    });
  });

  describe('createProjectSheet', () => {
    it('creates a sheet with headers', () => {
      const sheet = createProjectSheet();
      expect(sheet.name).toBe('Project Plan');
      expect(sheet.columnCount).toBe(PROJECT_SHEET_HEADERS.length);
      expect(sheet.cells['0:0']?.rawValue).toBe('Task');
      expect(sheet.cells['0:1']?.rawValue).toBe('Start Date');
      expect(sheet.cells['0:2']?.rawValue).toBe('End Date');
    });

    it('applies bold header styling', () => {
      const sheet = createProjectSheet();
      expect(sheet.cells['0:0']?.style?.fontWeight).toBe('bold');
      expect(sheet.cells['0:0']?.style?.backgroundColor).toBe('#EFF6FF');
    });

    it('includes sample rows by default', () => {
      const sheet = createProjectSheet();
      expect(sheet.rowCount).toBeGreaterThan(1);
      expect(sheet.cells['1:0']?.rawValue).toBe('Project Planning');
    });

    it('can exclude sample rows', () => {
      const sheet = createProjectSheet('My Project', false);
      // header + separator + risk header + separator + resource header + blank
      expect(sheet.rowCount).toBe(10);
      expect(sheet.cells['1:0']).toBeUndefined();
    });

    it('freezes header row and first column', () => {
      const sheet = createProjectSheet();
      expect(sheet.frozenRows).toBe(1);
      expect(sheet.frozenColumns).toBe(1);
    });

    it('sets custom column widths', () => {
      const sheet = createProjectSheet();
      expect(sheet.columnWidths[0]).toBe(200);
      expect(sheet.columnWidths[10]).toBe(180);
    });

    it('creates unique sheet IDs', () => {
      const sheet1 = createProjectSheet();
      const sheet2 = createProjectSheet();
      expect(sheet1.id).not.toBe(sheet2.id);
    });
  });

  describe('getDefaultColumnMapping', () => {
    it('returns correct column indices', () => {
      const mapping = getDefaultColumnMapping();
      expect(mapping.taskCol).toBe(0);
      expect(mapping.startDateCol).toBe(1);
      expect(mapping.endDateCol).toBe(2);
      expect(mapping.durationCol).toBe(3);
      expect(mapping.parentCol).toBe(4);
      expect(mapping.dependencyCol).toBe(5);
      expect(mapping.progressCol).toBe(6);
      expect(mapping.resourceCol).toBe(7);
      expect(mapping.milestoneCol).toBe(8);
      expect(mapping.colorCol).toBe(9);
      expect(mapping.notesCol).toBe(10);
      expect(mapping.headerRow).toBe(0);
    });

    it('mapping matches PROJECT_SHEET_HEADERS', () => {
      const mapping = getDefaultColumnMapping();
      expect(PROJECT_SHEET_HEADERS[mapping.taskCol]).toBe('Task');
      expect(PROJECT_SHEET_HEADERS[mapping.startDateCol]).toBe('Start Date');
      expect(PROJECT_SHEET_HEADERS[mapping.endDateCol]).toBe('End Date');
    });
  });

  describe('projectModelToSheetCells', () => {
    const mapping: ColumnMapping = {
      taskCol: 0,
      startDateCol: 1,
      endDateCol: 2,
      durationCol: 3,
      parentCol: 4,
      dependencyCol: 5,
      progressCol: 6,
      resourceCol: 7,
      milestoneCol: 8,
      colorCol: 9,
      notesCol: 10,
      headerRow: 0,
    };

    it('converts project model back to sheet cells', () => {
      const model: ProjectModel = {
        id: 'proj-1',
        name: 'Test Project',
        description: 'Test',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        tasks: [
          { id: 't1', name: 'Task 1', startDate: '2025-01-01', endDate: '2025-01-05', duration: 5, parentId: null, dependencies: [], progress: 50, resourceId: null, isMilestone: false, color: '#3B82F6', notes: 'First task' },
          { id: 't2', name: 'Task 2', startDate: '2025-01-06', endDate: '2025-01-10', duration: 5, parentId: null, dependencies: ['t1'], progress: 0, resourceId: null, isMilestone: true, color: '#EF4444', notes: '' },
        ],
        risks: [],
      resources: [],
      };

      const cells = projectModelToSheetCells(model, mapping);
      expect(cells['0:0']).toBe('Task');
      expect(cells['1:0']).toBe('Task 1');
      expect(cells['1:1']).toBe('2025-01-01');
      expect(cells['1:6']).toBe('50');
      expect(cells['2:0']).toBe('Task 2');
    });

    it('converts dependencies to row numbers', () => {
      const model: ProjectModel = {
        id: 'proj-1',
        name: 'Test',
        description: '',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        tasks: [
          { id: 't1', name: 'A', startDate: '2025-01-01', endDate: '2025-01-05', duration: 5, parentId: null, dependencies: [], progress: 0, resourceId: null, isMilestone: false, color: '#3B82F6', notes: '' },
          { id: 't2', name: 'B', startDate: '2025-01-06', endDate: '2025-01-10', duration: 5, parentId: null, dependencies: ['t1'], progress: 0, resourceId: null, isMilestone: false, color: '#3B82F6', notes: '' },
        ],
        risks: [],
      resources: [],
      };

      const cells = projectModelToSheetCells(model, mapping);
      expect(cells['2:5']).toBe('1'); // Task 2 depends on task at index 0 -> row 1
    });

    it('converts parent IDs to names', () => {
      const model: ProjectModel = {
        id: 'proj-1',
        name: 'Test',
        description: '',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        tasks: [
          { id: 't1', name: 'Parent', startDate: '2025-01-01', endDate: '2025-01-31', duration: 30, parentId: null, dependencies: [], progress: 0, resourceId: null, isMilestone: false, color: '#3B82F6', notes: '' },
          { id: 't2', name: 'Child', startDate: '2025-01-01', endDate: '2025-01-05', duration: 5, parentId: 't1', dependencies: [], progress: 0, resourceId: null, isMilestone: false, color: '#3B82F6', notes: '' },
        ],
        risks: [],
      resources: [],
      };

      const cells = projectModelToSheetCells(model, mapping);
      expect(cells['2:4']).toBe('Parent'); // Parent name
    });

    it('skips columns that are not mapped', () => {
      const partialMapping: ColumnMapping = {
        taskCol: 0,
        startDateCol: 1,
        endDateCol: 2,
        durationCol: null,
        parentCol: null,
        dependencyCol: null,
        progressCol: null,
        resourceCol: null,
        milestoneCol: null,
        colorCol: null,
        notesCol: null,
        headerRow: 0,
      };

      const model: ProjectModel = {
        id: 'proj-1',
        name: 'Test',
        description: '',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        tasks: [
          { id: 't1', name: 'Task 1', startDate: '2025-01-01', endDate: '2025-01-05', duration: 5, parentId: null, dependencies: [], progress: 50, resourceId: null, isMilestone: false, color: '#3B82F6', notes: 'Note' },
        ],
        risks: [],
      resources: [],
      };

      const cells = projectModelToSheetCells(model, partialMapping);
      expect(cells['1:0']).toBe('Task 1');
      expect(cells['1:1']).toBe('2025-01-01');
      expect(cells['1:6']).toBeUndefined(); // Progress not mapped
      expect(cells['1:10']).toBeUndefined(); // Notes not mapped
    });

    it('handles milestone flag', () => {
      const model: ProjectModel = {
        id: 'proj-1',
        name: 'Test',
        description: '',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        tasks: [
          { id: 't1', name: 'Go Live', startDate: '2025-01-10', endDate: '2025-01-10', duration: 1, parentId: null, dependencies: [], progress: 0, resourceId: null, isMilestone: true, color: '#3B82F6', notes: '' },
        ],
        risks: [],
      resources: [],
      };

      const cells = projectModelToSheetCells(model, mapping);
      expect(cells['1:8']).toBe('yes');
    });
  });

  describe('resourceToRow', () => {
    it('converts runtime Resource to serializable ResourceRow', () => {
      const resource: Resource = {
        id: 'r1',
        name: 'Alice',
        role: 'Dev',
        costRate: 100,
        costCurrency: 'USD',
        availability: 100,
        color: '#3B82F6',
      };
      const row = resourceToRow(resource);
      expect(row.id).toBe('r1');
      expect(row.name).toBe('Alice');
      expect(row.role).toBe('Dev');
      expect(row.costRate).toBe(100);
    });
  });

  describe('rowToResource', () => {
    it('converts ResourceRow to runtime Resource', () => {
      const row = {
        id: 'r1',
        name: 'Alice',
        role: 'Dev',
        costRate: 100,
        costCurrency: 'USD',
        availability: 100,
        color: '#3B82F6',
      };
      const resource = rowToResource(row);
      expect(resource.id).toBe('r1');
      expect(resource.name).toBe('Alice');
      expect(resource.costRate).toBe(100);
    });
  });

  describe('riskToRow', () => {
    it('converts runtime Risk to serializable RiskRow', () => {
      const risk: Risk = {
        id: 'risk-1',
        projectId: 'proj-1',
        taskId: null,
        title: 'Scope creep',
        description: 'Requirements may expand',
        category: 'scope',
        probability: 3,
        impact: 4,
        riskScore: 12,
        status: 'identified',
        mitigationPlan: 'Regular reviews',
        contingencyPlan: '',
        mitigationCost: 0,
        ownerId: null,
        identifiedDate: '2025-01-01',
        reviewDate: '',
        triggerCondition: '',
        residualProbability: 2,
        residualImpact: 3,
        residualRiskScore: 6,
        customFields: {},
      };
      const row = riskToRow(risk);
      expect(row.id).toBe('risk-1');
      expect(row.title).toBe('Scope creep');
      expect(row.category).toBe('scope');
      expect(row.probability).toBe(3);
      expect(row.notes).toBe('Requirements may expand');
    });
  });

  describe('rowToRisk', () => {
    it('converts RiskRow to runtime Risk', () => {
      const row = {
        id: 'risk-1',
        title: 'Scope creep',
        category: 'scope',
        probability: 3,
        impact: 4,
        status: 'identified',
        ownerId: null,
        mitigationPlan: 'Regular reviews',
        notes: 'Requirements may expand',
      };
      const risk = rowToRisk(row);
      expect(risk.id).toBe('risk-1');
      expect(risk.title).toBe('Scope creep');
      expect(risk.probability).toBe(3);
      expect(risk.impact).toBe(4);
      expect(risk.riskScore).toBe(12);
    });
  });

  describe('projectModelToSheetCells with risks and resources', () => {
    const mapping = {
      taskCol: 0,
      startDateCol: 1,
      endDateCol: 2,
      durationCol: 3,
      parentCol: 4,
      dependencyCol: 5,
      progressCol: 6,
      resourceCol: 7,
      milestoneCol: 8,
      colorCol: 9,
      notesCol: 10,
      headerRow: 0,
    };

    it('writes risk section after tasks', () => {
      const model: ProjectModel = {
        id: 'proj-1',
        name: 'Test',
        description: '',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        tasks: [
          { id: 't1', name: 'Task 1', startDate: '2025-01-01', endDate: '2025-01-05', duration: 5, parentId: null, dependencies: [], progress: 0, resourceId: null, isMilestone: false, color: '#3B82F6', notes: '' },
        ],
        risks: [
          { id: 'r1', title: 'Scope creep', category: 'scope', probability: 3, impact: 4, status: 'identified', ownerId: null, mitigationPlan: 'Reviews', notes: '' },
        ],
        resources: [],
      };

      const cells = projectModelToSheetCells(model, mapping);
      // Risk header at row 3 (after task header + 1 task + separator)
      expect(cells['3:0']).toBe('Risk');
      expect(cells['4:0']).toBe('Scope creep');
      expect(cells['4:1']).toBe('scope');
    });

    it('writes resource section after risks', () => {
      const model: ProjectModel = {
        id: 'proj-1',
        name: 'Test',
        description: '',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        tasks: [
          { id: 't1', name: 'Task 1', startDate: '2025-01-01', endDate: '2025-01-05', duration: 5, parentId: null, dependencies: [], progress: 0, resourceId: null, isMilestone: false, color: '#3B82F6', notes: '' },
        ],
        risks: [],
        resources: [
          { id: 'r1', name: 'Alice', role: 'Dev', costRate: 100, costCurrency: 'USD', availability: 100, color: '#3B82F6' },
        ],
      };

      const cells = projectModelToSheetCells(model, mapping);
      // Resource header at row 5 (after task header + 1 task + separator + risk header + separator)
      expect(cells['5:0']).toBe('Resource');
      expect(cells['6:0']).toBe('Alice');
      expect(cells['6:1']).toBe('Dev');
    });

    it('writes duration as NETWORKDAYS formula', () => {
      const model: ProjectModel = {
        id: 'proj-1',
        name: 'Test',
        description: '',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        tasks: [
          { id: 't1', name: 'Task 1', startDate: '2025-01-01', endDate: '2025-01-05', duration: 5, parentId: null, dependencies: [], progress: 0, resourceId: null, isMilestone: false, color: '#3B82F6', notes: '' },
        ],
        risks: [],
        resources: [],
      };

      const cells = projectModelToSheetCells(model, mapping);
      // Duration should be a NETWORKDAYS formula referencing start and end date cells
      expect(cells['1:3']).toBe('=NETWORKDAYS(B2,C2)');
    });
  });

  describe('createSheetFromTemplate', () => {
    it('creates a sheet from simple-wbs template', () => {
      const sheet = createSheetFromTemplate('simple-wbs');
      expect(sheet).not.toBeNull();
      expect(sheet!.name).toBe('Simple WBS');
      expect(sheet!.cells['0:0']).toBeDefined(); // Task header
      expect(sheet!.columnCount).toBe(11);
    });

    it('creates a sheet from website template', () => {
      const sheet = createSheetFromTemplate('website');
      expect(sheet).not.toBeNull();
      expect(sheet!.name).toBe('Website Project');
      // Should have task data
      expect(sheet!.cells['0:0']).toBeDefined();
    });

    it('creates a sheet from software template', () => {
      const sheet = createSheetFromTemplate('software');
      expect(sheet).not.toBeNull();
      expect(sheet!.name).toBe('Software Development');
    });

    it('returns null for unknown template', () => {
      const sheet = createSheetFromTemplate('nonexistent');
      expect(sheet).toBeNull();
    });

    it('creates sheet with custom project name', () => {
      const sheet = createSheetFromTemplate('simple-wbs', 'My Custom Project');
      expect(sheet).not.toBeNull();
      expect(sheet!.name).toBe('My Custom Project');
    });

    it('creates sheet with all sections', () => {
      const sheet = createSheetFromTemplate('simple-wbs');
      expect(sheet).not.toBeNull();
      // Task header at row 0
      expect(sheet!.cells['0:0']).toBeDefined();
      // Risk section should exist after tasks
      // Resource section should exist after risks
      expect(sheet!.rowCount).toBeGreaterThan(5);
    });

    it('freezes header row and first column', () => {
      const sheet = createSheetFromTemplate('simple-wbs');
      expect(sheet).not.toBeNull();
      expect(sheet!.frozenRows).toBe(1);
      expect(sheet!.frozenColumns).toBe(1);
    });
  });
});
