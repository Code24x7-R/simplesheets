// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  findTask,
  findParent,
  getAncestors,
  getDescendants,
  findPath,
  flattenToRows,
  addResource,
  updateResource,
  removeResource,
  findResource,
  getTasksForResource,
  getResourceEffort,
  getResourceUtilization,
  getNextResourceColor,
  generateResourceId,
  getAllTasks,
  addTask,
  removeTask,
  updateTask,
  moveTask,
  toggleCollapsed,
  expandAll,
  collapseAll,
  detectCycles,
  validateTree,
  countTasks,
  getTreeDepth,
  syncResourceCosts,
  computeTaskCost,
} from './treeOps';
import type { WBSTask, Resource } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function task(id: string, parentId: string | null = null, level = 0, children: WBSTask[] = []): WBSTask {
  return {
    id,
    name: `Task ${id}`,
    description: '',
    level,
    parentId,
    children,
    startDate: '2026-01-01',
    endDate: '2026-01-10',
    duration: 5,
    progress: 0,
    effort: 0,
    effortUnit: 'hours',
    cost: 0,
    costCurrency: 'USD',
    responsibleResourceId: null,
    dependencies: [],
    isMilestone: false,
    isSummary: children.length > 0,
    collapsed: false,
    color: '#3B82EF',
    riskIds: [],
    customFields: {},
  };
}

/** Build a sample tree:
 *  A
 *  ├── B
 *  │   ├── D
 *  │   └── E
 *  └── C
 *      └── F
 */
function buildSampleTree(): WBSTask[] {
  const D = task('D', 'B', 2);
  const E = task('E', 'B', 2);
  const B = task('B', 'A', 1, [D, E]);
  const F = task('F', 'C', 2);
  const C = task('C', 'A', 1, [F]);
  const A = task('A', null, 0, [B, C]);
  return [A];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('treeOps', () => {
  describe('findTask', () => {
    it('finds a root-level task', () => {
      const tree = buildSampleTree();
      const found = findTask(tree, 'A');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('A');
    });

    it('finds a deeply nested task', () => {
      const tree = buildSampleTree();
      const found = findTask(tree, 'F');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('F');
    });

    it('returns null for non-existent ID', () => {
      const tree = buildSampleTree();
      expect(findTask(tree, 'Z')).toBeNull();
    });
  });

  describe('findParent', () => {
    it('finds parent of a nested task', () => {
      const tree = buildSampleTree();
      const parent = findParent(tree, 'D');
      expect(parent).not.toBeNull();
      expect(parent!.id).toBe('B');
    });

    it('returns null for root-level task', () => {
      const tree = buildSampleTree();
      expect(findParent(tree, 'A')).toBeNull();
    });
  });

  describe('getAncestors', () => {
    it('returns ancestors from root to parent', () => {
      const tree = buildSampleTree();
      const ancestors = getAncestors(tree, 'D');
      expect(ancestors.map((a) => a.id)).toEqual(['A', 'B']);
    });

    it('returns empty array for root task', () => {
      const tree = buildSampleTree();
      expect(getAncestors(tree, 'A')).toEqual([]);
    });
  });

  describe('getDescendants', () => {
    it('returns all descendants', () => {
      const tree = buildSampleTree();
      const a = findTask(tree, 'A')!;
      const descendants = getDescendants(a);
      expect(descendants.map((d) => d.id).sort()).toEqual(['B', 'C', 'D', 'E', 'F']);
    });

    it('returns empty for leaf task', () => {
      const tree = buildSampleTree();
      const d = findTask(tree, 'D')!;
      expect(getDescendants(d)).toEqual([]);
    });
  });

  describe('findPath', () => {
    it('returns path from root to task', () => {
      const tree = buildSampleTree();
      const path = findPath(tree, 'E');
      expect(path.map((p) => p.id)).toEqual(['A', 'B', 'E']);
    });

    it('returns empty for non-existent task', () => {
      const tree = buildSampleTree();
      expect(findPath(tree, 'Z')).toEqual([]);
    });
  });

  describe('flattenToRows', () => {
    it('flattens DFS order', () => {
      const tree = buildSampleTree();
      const flat = flattenToRows(tree);
      expect(flat.map((t) => t.id)).toEqual(['A', 'B', 'D', 'E', 'C', 'F']);
    });

    it('skips children of collapsed tasks', () => {
      const tree = buildSampleTree();
      const collapsed = toggleCollapsed(tree, 'A');
      const flat = flattenToRows(collapsed);
      expect(flat.map((t) => t.id)).toEqual(['A']);
    });
  });

  describe('addTask', () => {
    it('adds a root-level task', () => {
      const tree = buildSampleTree();
      const newTask = task('G', null);
      const result = addTask(tree, null, newTask);
      expect(result).toHaveLength(2);
      expect(result[1].id).toBe('G');
      expect(result[1].level).toBe(0);
    });

    it('adds a child under a parent', () => {
      const tree = buildSampleTree();
      const newTask = task('G', 'B');
      const result = addTask(tree, 'B', newTask);
      const b = findTask(result, 'B')!;
      expect(b.children).toHaveLength(3);
      expect(b.children[2].id).toBe('G');
      expect(b.children[2].level).toBe(2);
      expect(b.isSummary).toBe(true);
    });

    it('does not mutate original tree', () => {
      const tree = buildSampleTree();
      const newTask = task('G', 'B');
      addTask(tree, 'B', newTask);
      const b = findTask(tree, 'B')!;
      expect(b.children).toHaveLength(2);
    });
  });

  describe('removeTask', () => {
    it('removes a leaf task', () => {
      const tree = buildSampleTree();
      const result = removeTask(tree, 'D');
      const b = findTask(result, 'B')!;
      expect(b.children.map((c) => c.id)).toEqual(['E']);
    });

    it('removes a task and all descendants', () => {
      const tree = buildSampleTree();
      const result = removeTask(tree, 'B');
      const a = findTask(result, 'A')!;
      expect(a.children.map((c) => c.id)).toEqual(['C']);
      expect(findTask(result, 'D')).toBeNull();
      expect(findTask(result, 'E')).toBeNull();
    });

    it('removes root task', () => {
      const tree = buildSampleTree();
      const result = removeTask(tree, 'A');
      expect(result).toEqual([]);
    });
  });

  describe('moveTask', () => {
    it('moves a task to root level', () => {
      const tree = buildSampleTree();
      const result = moveTask(tree, 'D', null, 1);
      expect(result).toHaveLength(2);
      expect(result[1].id).toBe('D');
      expect(result[1].level).toBe(0);
    });

    it('moves a task under a different parent', () => {
      const tree = buildSampleTree();
      const result = moveTask(tree, 'D', 'C', 0);
      const c = findTask(result, 'C')!;
      expect(c.children.map((ch) => ch.id)).toContain('D');
      expect(findTask(result, 'D')!.level).toBe(2);
    });

    it('prevents moving a task under itself', () => {
      const tree = buildSampleTree();
      const result = moveTask(tree, 'A', 'A', 0);
      expect(result).toEqual(tree);
    });

    it('prevents moving a task under its own descendant', () => {
      const tree = buildSampleTree();
      const result = moveTask(tree, 'A', 'D', 0);
      expect(result).toEqual(tree);
    });
  });

  describe('toggleCollapsed', () => {
    it('toggles collapsed state', () => {
      const tree = buildSampleTree();
      const collapsed = toggleCollapsed(tree, 'A');
      expect(findTask(collapsed, 'A')!.collapsed).toBe(true);
      const expanded = toggleCollapsed(collapsed, 'A');
      expect(findTask(expanded, 'A')!.collapsed).toBe(false);
    });
  });

  describe('getAllTasks', () => {
    it('returns all tasks in flat array', () => {
      const tree = buildSampleTree();
      const all = getAllTasks(tree);
      expect(all).toHaveLength(6);
      const ids = all.map((t) => t.id);
      expect(ids).toContain('A');
      expect(ids).toContain('B');
      expect(ids).toContain('C');
      expect(ids).toContain('D');
      expect(ids).toContain('E');
      expect(ids).toContain('F');
    });

    it('returns empty array for empty tree', () => {
      expect(getAllTasks([])).toEqual([]);
    });

    it('returns tasks in depth-first order', () => {
      const tree = buildSampleTree();
      const all = getAllTasks(tree);
      // A is root, B is first child, D is first grandchild
      expect(all[0].id).toBe('A');
      expect(all[1].id).toBe('B');
      expect(all[2].id).toBe('D');
    });
  });

  describe('updateTask', () => {
    it('updates a task by ID', () => {
      const tree = buildSampleTree();
      const updated = updateTask(tree, 'B', (t) => ({ ...t, name: 'Updated B' }));
      expect(findTask(updated, 'B')!.name).toBe('Updated B');
      // Original tree is unchanged
      expect(findTask(tree, 'B')!.name).toBe('Task B');
    });

    it('updates nested task', () => {
      const tree = buildSampleTree();
      const updated = updateTask(tree, 'D', (t) => ({ ...t, progress: 75 }));
      expect(findTask(updated, 'D')!.progress).toBe(75);
    });

    it('returns same tree reference when ID not found', () => {
      const tree = buildSampleTree();
      const updated = updateTask(tree, 'nonexistent', (t) => ({ ...t, name: 'X' }));
      expect(updated).toBe(tree);
    });

    it('updates only the matching task', () => {
      const tree = buildSampleTree();
      const originalB = findTask(tree, 'B');
      const updated = updateTask(tree, 'A', (t) => ({ ...t, name: 'New A' }));
      // B should be the same object reference (not modified)
      expect(findTask(updated, 'B')).toBe(originalB);
    });

    it('updates parent isSummary when children change', () => {
      const tree = buildSampleTree();
      // Remove all children from A by updating B to have no children
      const updated = updateTask(tree, 'B', (t) => ({ ...t, children: [] }));
      // A should still be a summary (has child C)
      expect(findTask(updated, 'A')!.isSummary).toBe(true);
    });
  });

  describe('expandAll / collapseAll', () => {
    it('expands all tasks', () => {
      const tree = collapseAll(buildSampleTree());
      const expanded = expandAll(tree);
      const flat = flattenToRows(expanded);
      expect(flat).toHaveLength(6);
    });

    it('collapses all summary tasks', () => {
      const tree = buildSampleTree();
      const collapsed = collapseAll(tree);
      expect(findTask(collapsed, 'A')!.collapsed).toBe(true);
      expect(findTask(collapsed, 'B')!.collapsed).toBe(true);
      expect(findTask(collapsed, 'D')!.collapsed).toBe(false); // leaf
    });
  });

  describe('detectCycles', () => {
    it('returns empty for valid tree', () => {
      const tree = buildSampleTree();
      expect(detectCycles(tree)).toEqual([]);
    });
  });

  describe('validateTree', () => {
    it('returns empty for valid tree', () => {
      const tree = buildSampleTree();
      expect(validateTree(tree)).toEqual([]);
    });

    it('detects duplicate IDs', () => {
      const tree = buildSampleTree();
      // Manually create duplicate by adding same ID at root
      const duplicate = task('A', null);
      const badTree = [...tree, duplicate];
      const errors = validateTree(badTree);
      expect(errors.some((e) => e.includes('Duplicate'))).toBe(true);
    });

    it('detects level inconsistency', () => {
      const tree = buildSampleTree();
      // Manually corrupt D's level to create inconsistency
      const a = findTask(tree, 'A')!;
      const b = a.children.find((c) => c.id === 'B')!;
      const badTask = { ...b.children.find((c) => c.id === 'D')!, level: 99 };
      const badB = { ...b, children: b.children.map((c) => (c.id === 'D' ? badTask : c)) };
      const badTree = tree.map((t) => (t.id === 'A' ? { ...t, children: t.children.map((c) => (c.id === 'B' ? badB : c)) } : t));
      const errors = validateTree(badTree);
      expect(errors.some((e) => e.includes('level'))).toBe(true);
    });
  });

  describe('countTasks', () => {
    it('counts all tasks', () => {
      expect(countTasks(buildSampleTree())).toBe(6);
    });

    it('returns 0 for empty tree', () => {
      expect(countTasks([])).toBe(0);
    });
  });

  describe('getTreeDepth', () => {
    it('returns max depth', () => {
      expect(getTreeDepth(buildSampleTree())).toBe(3); // A → B → D
    });

    it('returns 0 for empty tree', () => {
      expect(getTreeDepth([])).toBe(0);
    });

    it('returns 1 for flat tree', () => {
      const flat = [task('X'), task('Y')];
      expect(getTreeDepth(flat)).toBe(1);
    });
  });

  // ─── Resource CRUD ─────────────────────────────────────────────────

  describe('addResource', () => {
    it('adds a resource to an empty list', () => {
      const resource: Resource = { id: 'r1', name: 'Alice', role: 'Dev', costRate: 100, costCurrency: 'USD', availability: 100, color: '#3B82F6' };
      const result = addResource([], resource);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(resource);
    });

    it('appends to existing resources', () => {
      const r1: Resource = { id: 'r1', name: 'Alice', role: 'Dev', costRate: 100, costCurrency: 'USD', availability: 100, color: '#3B82F6' };
      const r2: Resource = { id: 'r2', name: 'Bob', role: 'QA', costRate: 80, costCurrency: 'USD', availability: 100, color: '#10B981' };
      const result = addResource([r1], r2);
      expect(result).toHaveLength(2);
    });
  });

  describe('updateResource', () => {
    it('updates resource properties', () => {
      const r1: Resource = { id: 'r1', name: 'Alice', role: 'Dev', costRate: 100, costCurrency: 'USD', availability: 100, color: '#3B82F6' };
      const result = updateResource([r1], 'r1', { name: 'Alice Smith', costRate: 120 });
      expect(result[0].name).toBe('Alice Smith');
      expect(result[0].costRate).toBe(120);
      expect(result[0].role).toBe('Dev'); // unchanged
    });

    it('does not modify other resources', () => {
      const r1: Resource = { id: 'r1', name: 'Alice', role: 'Dev', costRate: 100, costCurrency: 'USD', availability: 100, color: '#3B82F6' };
      const r2: Resource = { id: 'r2', name: 'Bob', role: 'QA', costRate: 80, costCurrency: 'USD', availability: 100, color: '#10B981' };
      const result = updateResource([r1, r2], 'r1', { name: 'Updated' });
      expect(result[1].name).toBe('Bob');
    });
  });

  describe('removeResource', () => {
    it('removes a resource by ID', () => {
      const r1: Resource = { id: 'r1', name: 'Alice', role: 'Dev', costRate: 100, costCurrency: 'USD', availability: 100, color: '#3B82F6' };
      const r2: Resource = { id: 'r2', name: 'Bob', role: 'QA', costRate: 80, costCurrency: 'USD', availability: 100, color: '#10B981' };
      const result = removeResource([r1, r2], 'r1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('r2');
    });

    it('returns empty array when removing last resource', () => {
      const r1: Resource = { id: 'r1', name: 'Alice', role: 'Dev', costRate: 100, costCurrency: 'USD', availability: 100, color: '#3B82F6' };
      const result = removeResource([r1], 'r1');
      expect(result).toHaveLength(0);
    });
  });

  describe('findResource', () => {
    it('finds a resource by ID', () => {
      const r1: Resource = { id: 'r1', name: 'Alice', role: 'Dev', costRate: 100, costCurrency: 'USD', availability: 100, color: '#3B82F6' };
      expect(findResource([r1], 'r1')).toEqual(r1);
    });

    it('returns null when not found', () => {
      expect(findResource([], 'r99')).toBeNull();
    });
  });

  describe('getTasksForResource', () => {
    it('returns tasks assigned to a resource', () => {
      const tree: WBSTask[] = [
        { ...task('A'), responsibleResourceId: 'r1' },
        { ...task('B'), responsibleResourceId: 'r2' },
      ];
      const result = getTasksForResource(tree, 'r1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Task A');
    });

    it('returns empty array for unassigned resource', () => {
      const tree: WBSTask[] = [task('A')];
      expect(getTasksForResource(tree, 'r99')).toHaveLength(0);
    });
  });

  describe('getResourceEffort', () => {
    it('sums effort of assigned tasks', () => {
      const tree: WBSTask[] = [
        { ...task('A'), duration: 5, responsibleResourceId: 'r1' },
        { ...task('B'), duration: 3, responsibleResourceId: 'r1' },
        { ...task('C'), duration: 2, responsibleResourceId: 'r2' },
      ];
      expect(getResourceEffort(tree, 'r1')).toBe(8);
      expect(getResourceEffort(tree, 'r2')).toBe(2);
    });

    it('returns 0 for unassigned resource', () => {
      const tree: WBSTask[] = [task('A')];
      expect(getResourceEffort(tree, 'r99')).toBe(0);
    });
  });

  describe('getResourceUtilization', () => {
    it('calculates utilization percentage', () => {
      const tree: WBSTask[] = [
        { ...task('A'), duration: 5, responsibleResourceId: 'r1' },
      ];
      expect(getResourceUtilization(tree, 'r1', 10)).toBe(50);
    });

    it('returns 0 for zero project days', () => {
      expect(getResourceUtilization([], 'r1', 0)).toBe(0);
    });
  });

  describe('getNextResourceColor', () => {
    it('cycles through palette', () => {
      const r1: Resource = { id: 'r1', name: 'A', role: '', costRate: 0, costCurrency: 'USD', availability: 100, color: '#3B82F6' };
      const r2: Resource = { id: 'r2', name: 'B', role: '', costRate: 0, costCurrency: 'USD', availability: 100, color: '#10B981' };
      expect(getNextResourceColor([])).toBe('#3B82F6');
      expect(getNextResourceColor([r1])).toBe('#10B981');
      expect(getNextResourceColor([r1, r2])).toBe('#F59E0B');
    });
  });

  describe('generateResourceId', () => {
    it('generates sequential IDs', () => {
      const r1: Resource = { id: 'r1', name: 'A', role: '', costRate: 0, costCurrency: 'USD', availability: 100, color: '#3B82F6' };
      expect(generateResourceId([])).toBe('r1');
      expect(generateResourceId([r1])).toBe('r2');
    });

    it('handles non-sequential IDs', () => {
      const r5: Resource = { id: 'r5', name: 'A', role: '', costRate: 0, costCurrency: 'USD', availability: 100, color: '#3B82F6' };
      expect(generateResourceId([r5])).toBe('r6');
    });
  });

  describe('computeTaskCost', () => {
    const resourceMap = new Map<string, Resource>([
      ['r1', { id: 'r1', name: 'Alice', role: 'Dev', costRate: 100, costCurrency: 'USD', availability: 100, color: '#3B82F6' }],
    ]);

    it('returns 0 when no resource assigned', () => {
      const t = task('t1');
      t.responsibleResourceId = null;
      expect(computeTaskCost(t, resourceMap)).toBe(0);
    });

    it('returns 0 when resource not found', () => {
      const t = task('t1');
      t.responsibleResourceId = 'nonexistent';
      expect(computeTaskCost(t, resourceMap)).toBe(0);
    });

    it('computes cost as rate × duration', () => {
      const t = task('t1');
      t.responsibleResourceId = 'r1';
      t.duration = 5;
      // 100 × 5 = 500
      expect(computeTaskCost(t, resourceMap)).toBe(500);
    });

    it('uses minimum duration of 1', () => {
      const t = task('t1');
      t.responsibleResourceId = 'r1';
      t.duration = 0;
      expect(computeTaskCost(t, resourceMap)).toBe(100);
    });
  });

  describe('syncResourceCosts', () => {
    const resources: Resource[] = [
      { id: 'r1', name: 'Alice', role: 'Dev', costRate: 100, costCurrency: 'USD', availability: 100, color: '#3B82F6' },
      { id: 'r2', name: 'Bob', role: 'PM', costRate: 150, costCurrency: 'USD', availability: 100, color: '#10B981' },
    ];

    it('sets cost for tasks with assigned resources', () => {
      const t1 = task('t1');
      t1.responsibleResourceId = 'r1';
      t1.duration = 5;
      const result = syncResourceCosts([t1], resources);
      expect(result[0].cost).toBe(500);
    });

    it('leaves cost at 0 for tasks without resources', () => {
      const t1 = task('t1');
      t1.responsibleResourceId = null;
      const result = syncResourceCosts([t1], resources);
      expect(result[0].cost).toBe(0);
    });

    it('syncs costs recursively through children', () => {
      const child = task('t2', 't1', 1);
      child.responsibleResourceId = 'r2';
      child.duration = 3;
      const parent = task('t1', null, 0, [child]);
      parent.responsibleResourceId = 'r1';
      parent.duration = 5;
      const result = syncResourceCosts([parent], resources);
      expect(result[0].cost).toBe(500);
      expect(result[0].children[0].cost).toBe(450);
    });

    it('does not mutate the original tree', () => {
      const t1 = task('t1');
      t1.responsibleResourceId = 'r1';
      t1.duration = 5;
      t1.cost = 0;
      const original = [{ ...t1 }];
      syncResourceCosts(original, resources);
      expect(original[0].cost).toBe(0);
    });
  });
});
