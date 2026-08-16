// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { exportJson, importJson, downloadJson } from './jsonService';
import type { Workbook } from '../types';
import { projectModelToWorkbook } from '../extensions/project-wbs/sheetToProject';
import type { ProjectModel } from '../types';

describe('JSON Service', () => {
  const testWorkbook: Workbook = {
    id: 'test-wb',
    title: 'Test Workbook',
    sheets: [
      {
        id: 'sheet-1',
        name: 'Sheet1',
        cells: {
          '0:0': { rawValue: 'Hello' },
          '0:1': { rawValue: '42' },
          '1:0': { rawValue: '=A1', computedValue: 'Hello' },
        },
        defaultColWidth: 100,
        defaultRowHeight: 28,
        columnWidths: { 0: 150 },
        rowHeights: {},
        columnCount: 26,
        rowCount: 100,
        frozenColumns: 0,
        frozenRows: 0,
      },
    ],
    activeSheetIndex: 0,
    lastModified: 1234567890,
  };

  describe('exportJson', () => {
    it('exports workbook to JSON string', () => {
      const json = exportJson(testWorkbook);
      const parsed = JSON.parse(json);
      expect(parsed.title).toBe('Test Workbook');
      expect(parsed.sheets).toHaveLength(1);
    });

    it('pretty-prints by default', () => {
      const json = exportJson(testWorkbook);
      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });

    it('can produce compact JSON', () => {
      const json = exportJson(testWorkbook, { pretty: false });
      expect(json).not.toContain('\n');
    });
  });

  describe('importJson', () => {
    it('imports a valid workbook JSON', () => {
      const json = exportJson(testWorkbook);
      const result = importJson(json);
      expect(result.success).toBe(true);
      expect(result.workbook?.title).toBe('Test Workbook');
      expect(result.workbook?.sheets[0].cells['0:0']?.rawValue).toBe('Hello');
    });

    it('generates a new ID on import', () => {
      const json = exportJson(testWorkbook);
      const result = importJson(json);
      expect(result.workbook?.id).not.toBe(testWorkbook.id);
    });

    it('updates lastModified on import', () => {
      const json = exportJson(testWorkbook);
      const result = importJson(json);
      expect(result.workbook?.lastModified).toBeGreaterThanOrEqual(testWorkbook.lastModified);
    });

    it('rejects invalid JSON', () => {
      const result = importJson('not valid json{{{');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects non-workbook JSON', () => {
      const result = importJson('{"foo": "bar"}');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid workbook format');
    });

    it('rejects empty JSON object', () => {
      const result = importJson('{}');
      expect(result.success).toBe(false);
    });

    it('rejects array JSON', () => {
      const result = importJson('[1,2,3]');
      expect(result.success).toBe(false);
    });
  });

  describe('round-trip', () => {
    it('preserves all data through export and import', () => {
      const json = exportJson(testWorkbook);
      const result = importJson(json);
      expect(result.success).toBe(true);

      const imported = result.workbook!;
      expect(imported.sheets[0].columnWidths[0]).toBe(150);
      expect(imported.sheets[0].cells['0:1']?.rawValue).toBe('42');
      expect(imported.activeSheetIndex).toBe(0);
    });
  });

  describe('downloadJson', () => {
    it('creates a download link and clicks it', () => {
      URL.createObjectURL = jest.fn(() => 'blob:mock');
      URL.revokeObjectURL = jest.fn();

      downloadJson(testWorkbook);

      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('uses custom filename when provided', () => {
      URL.createObjectURL = jest.fn(() => 'blob:mock');
      URL.revokeObjectURL = jest.fn();

      downloadJson(testWorkbook, 'custom-name');

      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('materials preservation', () => {
    it('exports materials in the materials sheet', () => {
      const model: ProjectModel = {
        id: 'proj-1',
        name: 'Test Project',
        description: 'Test',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        tasks: [
          { id: 't1', name: 'Task 1', startDate: '2025-01-01', endDate: '2025-01-05', duration: 5, parentId: null, dependencies: [], progress: 0, resourceId: null, isMilestone: false, color: '#3B82F6', notes: '' },
        ],
        risks: [],
        resources: [],
        materials: [
          { id: 'm1', name: 'Excavator', classification: 'capex', unit: 'each', unitCost: 50000, quantity: 1, vendor: 'Caterpillar', depreciationMethod: 'straight-line', usefulLifeMonths: 60, salvageValue: 5000, billingPeriod: 'daily', rentalRate: 0, leaseStartDate: null, leaseEndDate: null, wastageRate: 0, reorderPoint: 0, carryingCostPerUnit: 0, currency: 'USD', status: 'delivered' },
          { id: 'm2', name: 'Concrete', classification: 'consumable', unit: 'm³', unitCost: 180, quantity: 50, vendor: 'Acme', depreciationMethod: 'none', usefulLifeMonths: 0, salvageValue: 0, billingPeriod: 'daily', rentalRate: 0, leaseStartDate: null, leaseEndDate: null, wastageRate: 5, reorderPoint: 10, carryingCostPerUnit: 0, currency: 'USD', status: 'ordered' },
        ],
      };

      const workbook = projectModelToWorkbook(model);
      const json = exportJson(workbook);
      const parsed = JSON.parse(json);

      // Find the materials sheet
      const materialsSheet = parsed.sheets.find((s: { name: string }) => s.name === 'Materials');
      expect(materialsSheet).toBeDefined();

      // Verify material data is in the cells
      const cells = materialsSheet.cells;
      expect(cells['1:0']?.rawValue).toBe('Excavator');
      expect(cells['1:1']?.rawValue).toBe('capex');
      expect(cells['1:3']?.rawValue).toBe('50000');
      expect(cells['2:0']?.rawValue).toBe('Concrete');
      expect(cells['2:1']?.rawValue).toBe('consumable');
      expect(cells['2:3']?.rawValue).toBe('180');
    });

    it('preserves materials through round-trip export/import', () => {
      const model: ProjectModel = {
        id: 'proj-1',
        name: 'Test Project',
        description: 'Test',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        tasks: [],
        risks: [],
        resources: [],
        materials: [
          { id: 'm1', name: 'Steel', classification: 'consumable', unit: 'ton', unitCost: 2500, quantity: 12, vendor: 'Steel Corp', depreciationMethod: 'none', usefulLifeMonths: 0, salvageValue: 0, billingPeriod: 'daily', rentalRate: 0, leaseStartDate: null, leaseEndDate: null, wastageRate: 3, reorderPoint: 2, carryingCostPerUnit: 5, currency: 'USD', status: 'delivered' },
        ],
      };

      const workbook = projectModelToWorkbook(model);
      const json = exportJson(workbook);
      const result = importJson(json);
      expect(result.success).toBe(true);

      const imported = result.workbook!;
      const materialsSheet = imported.sheets.find((s) => s.name === 'Materials');
      expect(materialsSheet).toBeDefined();
      expect(materialsSheet!.cells['1:0']?.rawValue).toBe('Steel');
    });
  });

  describe('validation edge cases', () => {
    it('rejects workbook with empty sheets array', () => {
      const result = importJson('{"id":"1","title":"T","sheets":[],"activeSheetIndex":0}');
      expect(result.success).toBe(false);
    });

    it('rejects workbook with non-array sheets', () => {
      const result = importJson('{"id":"1","title":"T","sheets":"not-array","activeSheetIndex":0}');
      expect(result.success).toBe(false);
    });

    it('rejects null JSON', () => {
      const result = importJson('null');
      expect(result.success).toBe(false);
    });
  });
});
