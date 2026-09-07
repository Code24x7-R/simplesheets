// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import {
  CREATOR_CANVAS_SHEET_NAMES,
  modelToCreatorSheets,
  sheetsToCreatorModel,
  syncCreatorCanvasToWorkbook,
  loadCreatorCanvasFromWorkbook,
} from './sheetConverter';
import {
  createEmptyCreatorCanvasModel,
  createDefaultCanvasNode,
  createDefaultCanvasConnection,
  createDefaultCreatorTask,
  createDefaultCanvasCollection,
  createDefaultCanvasTag,
} from './schema';
import type { Workbook, Sheet } from '../../types';

describe('Creator Canvas Sheet Converter', () => {
  it('converts an empty model to default managed sheets', () => {
    const model = createEmptyCreatorCanvasModel('p1', 'My Art Project', 'art');
    const sheets = modelToCreatorSheets(model);

    expect(sheets).toHaveLength(6);
    const sheetNames = sheets.map((s) => s.name);
    expect(sheetNames).toContain(CREATOR_CANVAS_SHEET_NAMES.PROJECT);
    expect(sheetNames).toContain(CREATOR_CANVAS_SHEET_NAMES.ITEMS);
    expect(sheetNames).toContain(CREATOR_CANVAS_SHEET_NAMES.LINKS);
    expect(sheetNames).toContain(CREATOR_CANVAS_SHEET_NAMES.TASKS);
    expect(sheetNames).toContain(CREATOR_CANVAS_SHEET_NAMES.COLLECTIONS);
    expect(sheetNames).toContain(CREATOR_CANVAS_SHEET_NAMES.TAGS);
  });

  it('performs a complete round-trip conversion without data loss', () => {
    const original = createEmptyCreatorCanvasModel('proj-film', 'Short Film Pre-prod', 'film-video');
    original.description = 'Pre-production workspace for sci-fi short';
    original.techniques = ['storyboarding', 'moodboarding', 'shot-list'];
    original.status = 'in-progress';
    original.startDate = '2026-10-01';
    original.targetDate = '2026-12-15';

    const node1 = createDefaultCanvasNode('n1', 'note', {
      title: 'Opening Scene',
      description: 'Dawn exterior shot on Mars base',
      position: { x: 100, y: 150 },
      width: 250,
      height: 180,
      tagIds: ['tag-urgent'],
    });

    const node2 = createDefaultCanvasNode('n2', 'link', {
      title: 'Mars Visual Reference',
      position: { x: 400, y: 150 },
      payload: {
        type: 'link',
        data: { url: 'https://mars.nasa.gov', description: 'NASA Mars imagery' },
      },
    });

    const conn = createDefaultCanvasConnection('c1', 'n1', 'n2', {
      relationship: 'inspiration',
      label: 'Visual look',
    });

    const task = createDefaultCreatorTask('t1', 'Storyboard Mars Intro', {
      status: 'in-progress',
      priority: 'high',
      dueDate: '2026-10-15',
      linkedNodeId: 'n1',
      tagIds: ['tag-urgent'],
    });

    const col = createDefaultCanvasCollection('col1', 'Mars Exterior', {
      category: 'moodboard',
      color: '#ef4444',
      bounds: { x: 50, y: 100, width: 700, height: 400 },
    });

    const tag = createDefaultCanvasTag('tag-urgent', 'Urgent', '#dc2626');

    original.nodes.push(node1, node2);
    original.connections.push(conn);
    original.tasks.push(task);
    original.collections.push(col);
    original.tags.push(tag);

    // Convert to sheets
    const sheets = modelToCreatorSheets(original);

    // Reconstruct model from sheets
    const reconstructed = sheetsToCreatorModel(sheets);

    expect(reconstructed.id).toBe(original.id);
    expect(reconstructed.name).toBe(original.name);
    expect(reconstructed.projectType).toBe(original.projectType);
    expect(reconstructed.status).toBe(original.status);
    expect(reconstructed.description).toBe(original.description);
    expect(reconstructed.techniques).toEqual(expect.arrayContaining(original.techniques));

    // Nodes
    expect(reconstructed.nodes).toHaveLength(2);
    const reconN1 = reconstructed.nodes.find((n) => n.id === 'n1');
    expect(reconN1).toBeDefined();
    expect(reconN1?.title).toBe('Opening Scene');
    expect(reconN1?.position).toEqual({ x: 100, y: 150 });
    expect(reconN1?.width).toBe(250);
    expect(reconN1?.tagIds).toEqual(['tag-urgent']);

    // Connections
    expect(reconstructed.connections).toHaveLength(1);
    expect(reconstructed.connections[0].fromNodeId).toBe('n1');
    expect(reconstructed.connections[0].toNodeId).toBe('n2');
    expect(reconstructed.connections[0].relationship).toBe('inspiration');

    // Tasks
    expect(reconstructed.tasks).toHaveLength(1);
    expect(reconstructed.tasks[0].id).toBe('t1');
    expect(reconstructed.tasks[0].title).toBe('Storyboard Mars Intro');
    expect(reconstructed.tasks[0].status).toBe('in-progress');
    expect(reconstructed.tasks[0].linkedNodeId).toBe('n1');

    // Collections
    expect(reconstructed.collections).toHaveLength(1);
    expect(reconstructed.collections[0].id).toBe('col1');
    expect(reconstructed.collections[0].name).toBe('Mars Exterior');
    expect(reconstructed.collections[0].bounds).toEqual({ x: 50, y: 100, width: 700, height: 400 });

    // Tags
    expect(reconstructed.tags).toHaveLength(1);
    expect(reconstructed.tags[0].id).toBe('tag-urgent');
    expect(reconstructed.tags[0].name).toBe('Urgent');
  });

  describe('Workbook sync and loading', () => {
    it('syncs model to a workbook preserving unrelated user sheets', () => {
      const userSheet: Sheet = {
        id: 'user-sheet-1',
        name: 'My Custom Calculations',
        cells: { '0:0': { rawValue: 'Custom Data' } },
        defaultColWidth: 100,
        defaultRowHeight: 24,
        columnWidths: {},
        rowHeights: {},
        columnCount: 10,
        rowCount: 10,
        frozenColumns: 0,
        frozenRows: 0,
      };

      const workbook: Workbook = {
        id: 'wb-1',
        title: 'Test Workbook',
        sheets: [userSheet],
        activeSheetIndex: 0,
        lastModified: Date.now(),
      };

      const model = createEmptyCreatorCanvasModel('p-sync', 'Sync Test');
      const syncedWorkbook = syncCreatorCanvasToWorkbook(workbook, model);

      // Total sheets = 1 existing user sheet + 6 managed sheets
      expect(syncedWorkbook.sheets).toHaveLength(7);
      expect(syncedWorkbook.sheets[0].name).toBe('My Custom Calculations');
      expect(syncedWorkbook.extensions?.['creator-canvas']).toBeDefined();

      // Load back
      const loadedModel = loadCreatorCanvasFromWorkbook(syncedWorkbook);
      expect(loadedModel).not.toBeNull();
      expect(loadedModel?.id).toBe('p-sync');
      expect(loadedModel?.name).toBe('Sync Test');
    });

    it('updates existing managed sheets in place on repeated syncs without duplicating', () => {
      const model1 = createEmptyCreatorCanvasModel('p1', 'V1');
      const wb1 = syncCreatorCanvasToWorkbook({ id: 'wb-1', title: 'Test', sheets: [], activeSheetIndex: 0, lastModified: Date.now() }, model1);
      expect(wb1.sheets).toHaveLength(6);

      const model2 = { ...model1, name: 'V2' };
      const wb2 = syncCreatorCanvasToWorkbook(wb1, model2);
      expect(wb2.sheets).toHaveLength(6);

      const loaded = loadCreatorCanvasFromWorkbook(wb2);
      expect(loaded?.name).toBe('V2');
    });
  });
});
