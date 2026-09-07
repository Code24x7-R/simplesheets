// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import type { Sheet, Workbook } from '../../types';

interface GridCell { value: string | number | boolean | null }

function sheetGrid(sheet: Sheet): GridCell[][] {
  const rows: GridCell[][] = [];
  for (let r = 0; r < sheet.rowCount; r++) {
    const row: GridCell[] = [];
    for (let c = 0; c < sheet.columnCount; c++) {
      const cell = sheet.cells[`${r}:${c}`];
      row.push({ value: cell?.rawValue ?? null });
    }
    rows.push(row);
  }
  return rows;
}
import type {
  CreatorCanvasModel,
  CanvasNode,
  CanvasConnection,
  CreatorTaskRow,
  CanvasCollection,
  CanvasTag,
  CanvasNodeType,
  CreatorProjectType,
  CreatorTechnique,
  CreatorProjectStatus,
  CreatorCanvasExtensionData,
} from './types';
import {
  CREATOR_CANVAS_SCHEMA_VERSION,
  createEmptyCreatorCanvasModel,
  createDefaultCanvasNode,
  createDefaultCanvasConnection,
  createDefaultCreatorTask,
  createDefaultCanvasCollection,
  createDefaultCanvasTag,
  sanitizeCreatorCanvasModel,
} from './schema';

export const CREATOR_CANVAS_SHEET_NAMES = {
  PROJECT: 'Creator Project',
  ITEMS: 'Canvas Items',
  LINKS: 'Canvas Links',
  TASKS: 'Creator Tasks',
  COLLECTIONS: 'Creator Collections',
  TAGS: 'Creator Tags',
} as const;

function createSheetFromGrid(
  id: string,
  name: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): Sheet {
  const data = [
    headers.map((h) => ({ value: h })),
    ...rows.map((row) =>
      row.map((val) => ({
        value: val === null || val === undefined ? '' : String(val),
      }))
    ),
  ];

  const cells: Sheet['cells'] = {};
  data.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
    if (cell.value !== '') cells[`${rowIndex}:${colIndex}`] = { rawValue: cell.value };
  }));
  return {
    id,
    name,
    cells,
    defaultColWidth: 100,
    defaultRowHeight: 24,
    columnWidths: {},
    rowHeights: {},
    columnCount: Math.max(headers.length + 2, 10),
    rowCount: Math.max(data.length + 10, 30),
    frozenColumns: 0,
    frozenRows: 0,
  };
}

/**
 * Converts a CreatorCanvasModel into the 6 normalized managed sheets.
 */
export function modelToCreatorSheets(model: CreatorCanvasModel): Sheet[] {
  // 1. Creator Project Sheet
  const projectHeaders = ['Property', 'Value'];
  const projectRows = [
    ['Project ID', model.id],
    ['Project Name', model.name],
    ['Description', model.description || ''],
    ['Project Domain', model.projectType],
    ['Creative Techniques', (model.techniques || []).join(', ')],
    ['Status', model.status],
    ['Start Date', model.startDate || ''],
    ['Target Date', model.targetDate || ''],
    ['Created Date', model.createdDate],
    ['Modified Date', model.modifiedDate],
    ['Canvas Zoom', model.canvas.zoom],
    ['Canvas Pan X', model.canvas.panX],
    ['Canvas Pan Y', model.canvas.panY],
    ['Canvas Grid Snap', model.canvas.gridSnap],
    ['Canvas Grid Size', model.canvas.gridSize],
    ['Canvas Background', model.canvas.backgroundColor],
  ];
  const projectSheet = createSheetFromGrid('cc-sheet-project', CREATOR_CANVAS_SHEET_NAMES.PROJECT, projectHeaders, projectRows);

  // 2. Canvas Items Sheet
  const itemsHeaders = [
    'Node ID',
    'Type',
    'Title',
    'Description',
    'Pos X',
    'Pos Y',
    'Width',
    'Height',
    'Z Index',
    'Rotation',
    'Locked',
    'Collapsed',
    'Collection ID',
    'Tag IDs',
    'Payload JSON',
    'Linked WBS Task ID',
    'Created Date',
    'Modified Date',
  ];
  const itemRows = model.nodes.map((node) => [
    node.id,
    node.type,
    node.title,
    node.description || '',
    node.position.x,
    node.position.y,
    node.width,
    node.height,
    node.zIndex,
    node.rotation || 0,
    node.locked ? 'true' : 'false',
    node.collapsed ? 'true' : 'false',
    node.collectionId || '',
    (node.tagIds || []).join(', '),
    node.payload ? JSON.stringify(node.payload) : '',
    node.linkedWbsTaskId || '',
    node.createdDate,
    node.modifiedDate,
  ]);
  const itemsSheet = createSheetFromGrid('cc-sheet-items', CREATOR_CANVAS_SHEET_NAMES.ITEMS, itemsHeaders, itemRows);

  // 3. Canvas Links Sheet
  const linksHeaders = ['Link ID', 'From Node ID', 'To Node ID', 'Relationship', 'Label', 'Style JSON'];
  const linkRows = model.connections.map((conn) => [
    conn.id,
    conn.fromNodeId,
    conn.toNodeId,
    conn.relationship,
    conn.label || '',
    conn.style ? JSON.stringify(conn.style) : '',
  ]);
  const linksSheet = createSheetFromGrid('cc-sheet-links', CREATOR_CANVAS_SHEET_NAMES.LINKS, linksHeaders, linkRows);

  // 4. Creator Tasks Sheet
  const taskHeaders = [
    'Task ID',
    'Title',
    'Status',
    'Priority',
    'Due Date',
    'Start Date',
    'Assignee',
    'Est Hours',
    'Act Hours',
    'Cost',
    'Linked Node ID',
    'Linked WBS Task ID',
    'Tag IDs',
    'Description',
    'Created Date',
    'Modified Date',
  ];
  const taskRows = model.tasks.map((task) => [
    task.id,
    task.title,
    task.status,
    task.priority,
    task.dueDate || '',
    task.startDate || '',
    task.assignee || '',
    task.estimatedHours ?? '',
    task.actualHours ?? '',
    task.cost ?? '',
    task.linkedNodeId || '',
    task.linkedWbsTaskId || '',
    (task.tagIds || []).join(', '),
    task.description || '',
    task.createdDate,
    task.modifiedDate,
  ]);
  const tasksSheet = createSheetFromGrid('cc-sheet-tasks', CREATOR_CANVAS_SHEET_NAMES.TASKS, taskHeaders, taskRows);

  // 5. Creator Collections Sheet
  const collectionHeaders = ['Collection ID', 'Name', 'Category', 'Color', 'Bounds X', 'Bounds Y', 'Width', 'Height', 'Description'];
  const collectionRows = model.collections.map((col) => [
    col.id,
    col.name,
    col.category || 'custom',
    col.color || '',
    col.bounds.x,
    col.bounds.y,
    col.bounds.width,
    col.bounds.height,
    col.description || '',
  ]);
  const collectionsSheet = createSheetFromGrid(
    'cc-sheet-collections',
    CREATOR_CANVAS_SHEET_NAMES.COLLECTIONS,
    collectionHeaders,
    collectionRows
  );

  // 6. Creator Tags Sheet
  const tagHeaders = ['Tag ID', 'Name', 'Color'];
  const tagRows = model.tags.map((tag) => [tag.id, tag.name, tag.color]);
  const tagsSheet = createSheetFromGrid('cc-sheet-tags', CREATOR_CANVAS_SHEET_NAMES.TAGS, tagHeaders, tagRows);

  return [projectSheet, itemsSheet, linksSheet, tasksSheet, collectionsSheet, tagsSheet];
}

/**
 * Reads managed sheet grids and parses them into a normalized CreatorCanvasModel.
 */
export function sheetsToCreatorModel(sheets: Sheet[]): CreatorCanvasModel {
  const projectSheet = sheets.find((s) => s.name === CREATOR_CANVAS_SHEET_NAMES.PROJECT);
  const itemsSheet = sheets.find((s) => s.name === CREATOR_CANVAS_SHEET_NAMES.ITEMS);
  const linksSheet = sheets.find((s) => s.name === CREATOR_CANVAS_SHEET_NAMES.LINKS);
  const tasksSheet = sheets.find((s) => s.name === CREATOR_CANVAS_SHEET_NAMES.TASKS);
  const collectionsSheet = sheets.find((s) => s.name === CREATOR_CANVAS_SHEET_NAMES.COLLECTIONS);
  const tagsSheet = sheets.find((s) => s.name === CREATOR_CANVAS_SHEET_NAMES.TAGS);

  // Parse project metadata key-values
  const metaMap = new Map<string, string>();
  if (projectSheet && sheetGrid(projectSheet).length > 1) {
    for (let i = 1; i < sheetGrid(projectSheet).length; i++) {
      const row = sheetGrid(projectSheet)[i];
      if (row && row[0]?.value) {
        metaMap.set(String(row[0].value).trim(), row[1]?.value != null ? String(row[1].value).trim() : '');
      }
    }
  }

  const model = createEmptyCreatorCanvasModel(
    metaMap.get('Project ID') || undefined,
    metaMap.get('Project Name') || undefined,
    (metaMap.get('Project Domain') as CreatorProjectType) || 'other'
  );

  if (metaMap.has('Description')) model.description = metaMap.get('Description') || '';
  if (metaMap.has('Status')) model.status = (metaMap.get('Status') as CreatorProjectStatus) || 'draft';
  if (metaMap.has('Start Date')) model.startDate = metaMap.get('Start Date') || undefined;
  if (metaMap.has('Target Date')) model.targetDate = metaMap.get('Target Date') || undefined;
  if (metaMap.has('Created Date')) model.createdDate = metaMap.get('Created Date') || model.createdDate;
  if (metaMap.has('Modified Date')) model.modifiedDate = metaMap.get('Modified Date') || model.modifiedDate;

  if (metaMap.has('Creative Techniques')) {
    const rawTechniques = metaMap.get('Creative Techniques') || '';
    model.techniques = rawTechniques
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean) as CreatorTechnique[];
  }

  if (metaMap.has('Canvas Zoom')) {
    const z = parseFloat(metaMap.get('Canvas Zoom') || '');
    if (!isNaN(z)) model.canvas.zoom = z;
  }
  if (metaMap.has('Canvas Pan X')) {
    const px = parseFloat(metaMap.get('Canvas Pan X') || '');
    if (!isNaN(px)) model.canvas.panX = px;
  }
  if (metaMap.has('Canvas Pan Y')) {
    const py = parseFloat(metaMap.get('Canvas Pan Y') || '');
    if (!isNaN(py)) model.canvas.panY = py;
  }

  // Parse Tags
  const tags: CanvasTag[] = [];
  if (tagsSheet && sheetGrid(tagsSheet).length > 1) {
    for (let i = 1; i < sheetGrid(tagsSheet).length; i++) {
      const row = sheetGrid(tagsSheet)[i];
      if (row && row[0]?.value) {
        tags.push(
          createDefaultCanvasTag(
            String(row[0].value).trim(),
            String(row[1]?.value || '').trim(),
            String(row[2]?.value || '#3b82f6').trim()
          )
        );
      }
    }
  }
  model.tags = tags;

  // Parse Collections
  const collections: CanvasCollection[] = [];
  if (collectionsSheet && sheetGrid(collectionsSheet).length > 1) {
    for (let i = 1; i < sheetGrid(collectionsSheet).length; i++) {
      const row = sheetGrid(collectionsSheet)[i];
      if (row && row[0]?.value) {
        collections.push(
          createDefaultCanvasCollection(String(row[0].value).trim(), String(row[1]?.value || 'Untitled').trim(), {
            category: (row[2]?.value as CanvasCollection['category']) || 'custom',
            color: row[3]?.value ? String(row[3].value).trim() : undefined,
            bounds: {
              x: parseFloat(String(row[4]?.value || '50')) || 50,
              y: parseFloat(String(row[5]?.value || '50')) || 50,
              width: parseFloat(String(row[6]?.value || '500')) || 500,
              height: parseFloat(String(row[7]?.value || '400')) || 400,
            },
            description: row[8]?.value ? String(row[8].value).trim() : '',
          })
        );
      }
    }
  }
  model.collections = collections;

  // Parse Nodes (Items)
  const nodes: CanvasNode[] = [];
  if (itemsSheet && sheetGrid(itemsSheet).length > 1) {
    for (let i = 1; i < sheetGrid(itemsSheet).length; i++) {
      const row = sheetGrid(itemsSheet)[i];
      if (row && row[0]?.value) {
        const nodeId = String(row[0].value).trim();
        const type = (String(row[1]?.value || 'note').trim() as CanvasNodeType);
        const title = String(row[2]?.value || '').trim();
        const description = row[3]?.value ? String(row[3].value).trim() : '';
        const posX = parseFloat(String(row[4]?.value || '100')) || 100;
        const posY = parseFloat(String(row[5]?.value || '100')) || 100;
        const width = parseFloat(String(row[6]?.value || '200')) || 200;
        const height = parseFloat(String(row[7]?.value || '150')) || 150;
        const zIndex = parseInt(String(row[8]?.value || '1'), 10) || 1;
        const rotation = parseFloat(String(row[9]?.value || '0')) || 0;
        const locked = String(row[10]?.value).toLowerCase() === 'true';
        const collapsed = String(row[11]?.value).toLowerCase() === 'true';
        const collectionId = row[12]?.value ? String(row[12].value).trim() : undefined;
        const tagIds = row[13]?.value
          ? String(row[13].value)
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [];
        let payload = undefined;
        if (row[14]?.value) {
          try {
            payload = JSON.parse(String(row[14].value));
          } catch {
            payload = undefined;
          }
        }

        nodes.push(
          createDefaultCanvasNode(nodeId, type, {
            title,
            description,
            position: { x: posX, y: posY },
            width,
            height,
            zIndex,
            rotation,
            locked,
            collapsed,
            collectionId,
            tagIds,
            payload,
            linkedWbsTaskId: row[15]?.value ? String(row[15].value).trim() : undefined,
            createdDate: row[16]?.value ? String(row[16].value).trim() : undefined,
            modifiedDate: row[17]?.value ? String(row[17].value).trim() : undefined,
          })
        );
      }
    }
  }
  model.nodes = nodes;

  // Parse Links
  const connections: CanvasConnection[] = [];
  if (linksSheet && sheetGrid(linksSheet).length > 1) {
    for (let i = 1; i < sheetGrid(linksSheet).length; i++) {
      const row = sheetGrid(linksSheet)[i];
      if (row && row[0]?.value && row[1]?.value && row[2]?.value) {
        connections.push(
          createDefaultCanvasConnection(
            String(row[0].value).trim(),
            String(row[1].value).trim(),
            String(row[2].value).trim(),
            {
              relationship: (String(row[3]?.value || 'sequence').trim() as CanvasConnection['relationship']),
              label: row[4]?.value ? String(row[4].value).trim() : undefined,
              style: row[5]?.value
                ? (() => {
                    try {
                      return JSON.parse(String(row[5].value));
                    } catch {
                      return undefined;
                    }
                  })()
                : undefined,
            }
          )
        );
      }
    }
  }
  model.connections = connections;

  // Parse Tasks
  const tasks: CreatorTaskRow[] = [];
  if (tasksSheet && sheetGrid(tasksSheet).length > 1) {
    for (let i = 1; i < sheetGrid(tasksSheet).length; i++) {
      const row = sheetGrid(tasksSheet)[i];
      if (row && row[0]?.value) {
        tasks.push(
          createDefaultCreatorTask(String(row[0].value).trim(), String(row[1]?.value || 'Task').trim(), {
            status: (String(row[2]?.value || 'todo').trim() as CreatorTaskRow['status']),
            priority: (String(row[3]?.value || 'medium').trim() as CreatorTaskRow['priority']),
            dueDate: row[4]?.value ? String(row[4].value).trim() : undefined,
            startDate: row[5]?.value ? String(row[5].value).trim() : undefined,
            assignee: row[6]?.value ? String(row[6].value).trim() : undefined,
            estimatedHours: row[7]?.value ? parseFloat(String(row[7].value)) || undefined : undefined,
            actualHours: row[8]?.value ? parseFloat(String(row[8].value)) || undefined : undefined,
            cost: row[9]?.value ? parseFloat(String(row[9].value)) || undefined : undefined,
            linkedNodeId: row[10]?.value ? String(row[10].value).trim() : undefined,
            linkedWbsTaskId: row[11]?.value ? String(row[11].value).trim() : undefined,
            tagIds: row[12]?.value
              ? String(row[12].value)
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
              : [],
            description: row[13]?.value ? String(row[13].value).trim() : undefined,
            createdDate: row[14]?.value ? String(row[14].value).trim() : undefined,
            modifiedDate: row[15]?.value ? String(row[15].value).trim() : undefined,
          })
        );
      }
    }
  }
  model.tasks = tasks;

  return sanitizeCreatorCanvasModel(model);
}

/**
 * Synchronizes the CreatorCanvasModel to the Workbook object:
 * 1. Updates/replaces managed sheets without duplicating.
 * 2. Updates `workbook.extensions['creator-canvas']` persistence payload.
 */
export function syncCreatorCanvasToWorkbook(
  workbook: Workbook,
  model: CreatorCanvasModel
): Workbook {
  const managedSheetNames = new Set<string>(Object.values(CREATOR_CANVAS_SHEET_NAMES));
  const newManagedSheets = modelToCreatorSheets(model);

  // Preserve non-managed user sheets
  const preservedSheets = workbook.sheets.filter((s) => !managedSheetNames.has(s.name));

  const allSheets = [...preservedSheets, ...newManagedSheets];

  const extData: CreatorCanvasExtensionData = {
    extensionId: 'creator-canvas',
    schemaVersion: CREATOR_CANVAS_SCHEMA_VERSION,
    data: {
      project: model,
      sourceSheetIds: {
        project: newManagedSheets.find((s) => s.name === CREATOR_CANVAS_SHEET_NAMES.PROJECT)?.id,
        items: newManagedSheets.find((s) => s.name === CREATOR_CANVAS_SHEET_NAMES.ITEMS)?.id,
        links: newManagedSheets.find((s) => s.name === CREATOR_CANVAS_SHEET_NAMES.LINKS)?.id,
        tasks: newManagedSheets.find((s) => s.name === CREATOR_CANVAS_SHEET_NAMES.TASKS)?.id,
        collections: newManagedSheets.find((s) => s.name === CREATOR_CANVAS_SHEET_NAMES.COLLECTIONS)?.id,
        tags: newManagedSheets.find((s) => s.name === CREATOR_CANVAS_SHEET_NAMES.TAGS)?.id,
      },
    },
  };

  return {
    ...workbook,
    sheets: allSheets,
    extensions: {
      ...(workbook.extensions || {}),
      'creator-canvas': extData,
    },
  };
}

/**
 * Loads the CreatorCanvasModel from a Workbook, giving precedence to extension payload
 * with fallback to reading the managed sheets directly.
 */
export function loadCreatorCanvasFromWorkbook(workbook: Workbook): CreatorCanvasModel | null {
  const ext = workbook.extensions?.['creator-canvas'] as CreatorCanvasExtensionData | undefined;
  if (ext && ext.data?.project) {
    return sanitizeCreatorCanvasModel(ext.data.project);
  }

  // Fallback: check if managed sheets exist
  const managedSheetNames = new Set<string>(Object.values(CREATOR_CANVAS_SHEET_NAMES));
  const hasManagedSheets = workbook.sheets.some((s) => managedSheetNames.has(s.name));
  if (hasManagedSheets) {
    return sheetsToCreatorModel(workbook.sheets);
  }

  return null;
}
