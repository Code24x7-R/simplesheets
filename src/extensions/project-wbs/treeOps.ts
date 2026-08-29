// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * WBS Tree Operations
 *
 * Pure functions for manipulating the Work Breakdown Structure tree.
 * All operations are immutable — they return new trees, never mutate inputs.
 */

import type { WBSTask, Resource } from '../types';

// ─── Lookup ─────────────────────────────────────────────────────────────────

/**
 * Find a task by ID anywhere in the tree.
 * @param tree - Array of root-level tasks.
 * @param id - Task ID to find.
 * @returns The task or null if not found.
 */
export function findTask(tree: WBSTask[], id: string): WBSTask | null {
  for (const task of tree) {
    if (task.id === id) return task;
    const found = findTask(task.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * Find the parent of a task by ID.
 * @param tree - Array of root-level tasks.
 * @param id - Task ID whose parent to find.
 * @returns The parent task or null if root-level or not found.
 */
export function findParent(tree: WBSTask[], id: string): WBSTask | null {
  for (const task of tree) {
    if (task.children.some((c) => c.id === id)) return task;
    const found = findParent(task.children, id);
    if (found) return found;
  }
  return null;
}

// ─── Traversal ──────────────────────────────────────────────────────────────

/**
 * Get all ancestors of a task (from root down to parent).
 * @param tree - Array of root-level tasks.
 * @param id - Task ID.
 * @returns Array of ancestor tasks (empty if root-level or not found).
 */
export function getAncestors(tree: WBSTask[], id: string): WBSTask[] {
  const ancestors: WBSTask[] = [];
  const path = findPath(tree, id);
  if (path.length > 1) {
    // Exclude the task itself (last element)
    ancestors.push(...path.slice(0, -1));
  }
  return ancestors;
}

/**
 * Get all descendants of a task as a flat list.
 * @param task - The task whose descendants to collect.
 * @returns Array of all tasks below this task.
 */
export function getDescendants(task: WBSTask): WBSTask[] {
  const result: WBSTask[] = [];
  for (const child of task.children) {
    result.push(child);
    result.push(...getDescendants(child));
  }
  return result;
}

/**
 * Find the path from root to a specific task.
 * @param tree - Array of root-level tasks.
 * @param id - Target task ID.
 * @returns Array of tasks forming the path (empty if not found).
 */
export function findPath(tree: WBSTask[], id: string): WBSTask[] {
  for (const task of tree) {
    if (task.id === id) return [task];
    const subPath = findPath(task.children, id);
    if (subPath.length > 0) return [task, ...subPath];
  }
  return [];
}

/**
 * Flatten the tree to a row list (depth-first).
 * @param tree - Array of root-level tasks.
 * @returns Flat array of all tasks in DFS order.
 */
export function flattenToRows(tree: WBSTask[]): WBSTask[] {
  const result: WBSTask[] = [];
  for (const task of tree) {
    result.push(task);
    if (!task.collapsed) {
      result.push(...flattenToRows(task.children));
    }
  }
  return result;
}

// ─── Insertion ──────────────────────────────────────────────────────────────

/**
 * Add a child task under a parent.
 * @param tree - Array of root-level tasks.
 * @param parentId - Parent task ID (null for root-level).
 * @param task - Task to add.
 * @returns New tree with the task added.
 */
export function addTask(tree: WBSTask[], parentId: string | null, task: WBSTask): WBSTask[] {
  if (parentId === null) {
    return [...tree, { ...task, level: 0, parentId: null }];
  }

  return tree.map((t) => {
    if (t.id === parentId) {
      const newChild = { ...task, level: t.level + 1, parentId };
      const newChildren = [...t.children, newChild];
      return { ...t, children: newChildren, isSummary: true };
    }
    if (t.children.length > 0) {
      const newChildren = addTask(t.children, parentId, task);
      if (newChildren !== t.children) {
        return { ...t, children: newChildren, isSummary: true };
      }
    }
    return t;
  });
}

// ─── Removal ────────────────────────────────────────────────────────────────

/**
 * Remove a task and all its descendants.
 * @param tree - Array of root-level tasks.
 * @param id - Task ID to remove.
 * @returns New tree with the task removed.
 */
export function removeTask(tree: WBSTask[], id: string): WBSTask[] {
  return tree
    .filter((t) => t.id !== id)
    .map((t) => {
      if (t.children.length > 0) {
        const newChildren = removeTask(t.children, id);
        if (newChildren !== t.children) {
          return {
            ...t,
            children: newChildren,
            isSummary: newChildren.length > 0,
          };
        }
      }
      return t;
    });
}

// ─── Move / Reparent ────────────────────────────────────────────────────────

/**
 * Move a task to a new parent at a specific index.
 * @param tree - Array of root-level tasks.
 * @param id - Task ID to move.
 * @param newParentId - Target parent ID (null for root-level).
 * @param index - Insertion index within the new parent's children.
 * @returns New tree with the task moved. Returns original if invalid.
 */
export function moveTask(
  tree: WBSTask[],
  id: string,
  newParentId: string | null,
  index: number,
): WBSTask[] {
  // Cannot move a task under itself or its own descendant
  const task = findTask(tree, id);
  if (!task) return tree;

  if (id === newParentId) return tree;
  if (newParentId !== null) {
    const descendants = getDescendants(task);
    if (descendants.some((d) => d.id === newParentId)) return tree;
  }

  // Remove from current location
  const withoutTask = removeTask(tree, id);

  // Recalculate level for the moved task and its descendants
  const newParent = newParentId !== null ? findTask(withoutTask, newParentId) : null;
  const newLevel = newParent ? newParent.level + 1 : 0;
  const movedTask = recalculateLevels(task, newLevel);

  // Insert at new location
  if (newParentId === null) {
    const newTree = [...withoutTask];
    newTree.splice(Math.min(index, newTree.length), 0, movedTask);
    return newTree;
  }

  return withoutTask.map((t) => insertAt(t, newParentId, movedTask, index));
}

/**
 * Recursively recalculate levels for a task and its descendants.
 */
function recalculateLevels(task: WBSTask, newLevel: number): WBSTask {
  return {
    ...task,
    level: newLevel,
    children: task.children.map((c) => recalculateLevels(c, newLevel + 1)),
  };
}

/**
 * Insert a task into a parent's children at a specific index.
 */
function insertAt(tree: WBSTask, parentId: string, task: WBSTask, index: number): WBSTask {
  if (tree.id === parentId) {
    const newChildren = [...tree.children];
    newChildren.splice(Math.min(index, newChildren.length), 0, task);
    return { ...tree, children: newChildren, isSummary: true };
  }
  if (tree.children.length > 0) {
    return {
      ...tree,
      children: tree.children.map((c) => insertAt(c, parentId, task, index)),
    };
  }
  return tree;
}

// ─── Collapse / Expand ──────────────────────────────────────────────────────

/**
 * Toggle the collapsed state of a task.
 * @param tree - Array of root-level tasks.
 * @param id - Task ID to toggle.
 * @returns New tree with the collapse state toggled.
 */
export function toggleCollapsed(tree: WBSTask[], id: string): WBSTask[] {
  return tree.map((t) => {
    if (t.id === id) {
      return { ...t, collapsed: !t.collapsed };
    }
    if (t.children.length > 0) {
      return { ...t, children: toggleCollapsed(t.children, id) };
    }
    return t;
  });
}

/**
 * Expand all tasks in the tree.
 * @param tree - Array of root-level tasks.
 * @returns New tree with all tasks expanded.
 */
export function expandAll(tree: WBSTask[]): WBSTask[] {
  return tree.map((t) => ({
    ...t,
    collapsed: false,
    children: expandAll(t.children),
  }));
}

/**
 * Collapse all summary tasks in the tree.
 * @param tree - Array of root-level tasks.
 * @returns New tree with all summary tasks collapsed.
 */
export function collapseAll(tree: WBSTask[]): WBSTask[] {
  return tree.map((t) => ({
    ...t,
    collapsed: t.children.length > 0,
    children: collapseAll(t.children),
  }));
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Detect cycles in the task tree (should never happen with proper parenting,
 * but checked defensively after imports or manual tree construction).
 * @param tree - Array of root-level tasks.
 * @returns Array of task IDs involved in cycles (empty if valid).
 */
export function detectCycles(tree: WBSTask[]): string[] {
  const cycles: string[] = [];
  const visited = new Set<string>();

  function check(task: WBSTask, ancestors: Set<string>): void {
    if (ancestors.has(task.id)) {
      cycles.push(task.id);
      return;
    }
    if (visited.has(task.id)) {
      cycles.push(task.id);
      return;
    }
    visited.add(task.id);
    const newAncestors = new Set(ancestors);
    newAncestors.add(task.id);
    for (const child of task.children) {
      check(child, newAncestors);
    }
  }

  for (const task of tree) {
    check(task, new Set());
  }

  return cycles;
}

/**
 * Validate the tree structure. Returns array of error messages (empty if valid).
 * @param tree - Array of root-level tasks.
 * @returns Array of validation error strings.
 */
export function validateTree(tree: WBSTask[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  function check(task: WBSTask, expectedLevel: number): void {
    // Check for duplicate IDs
    if (ids.has(task.id)) {
      errors.push(`Duplicate task ID: ${task.id}`);
    }
    ids.add(task.id);

    // Check level consistency
    if (task.level !== expectedLevel) {
      errors.push(`Task ${task.id}: level ${task.level} ≠ expected ${expectedLevel}`);
    }

    // Check summary flag consistency
    if (task.children.length > 0 && !task.isSummary) {
      errors.push(`Task ${task.id}: has children but isSummary=false`);
    }
    if (task.children.length === 0 && task.isSummary) {
      errors.push(`Task ${task.id}: no children but isSummary=true`);
    }

    // Check milestone consistency
    if (task.isMilestone && task.children.length > 0) {
      errors.push(`Task ${task.id}: milestone cannot have children`);
    }

    // Check parent reference
    if (task.parentId !== null && !ids.has(task.parentId)) {
      // Parent not yet visited — could be valid if parent is above in DFS
      // We'll check for orphans separately
    }

    // Recurse
    for (const child of task.children) {
      check(child, expectedLevel + 1);
    }
  }

  for (const task of tree) {
    check(task, 0);
  }

  // Check for cycles
  const cycles = detectCycles(tree);
  if (cycles.length > 0) {
    errors.push(`Circular references detected: ${cycles.join(', ')}`);
  }

  return errors;
}

/**
 * Count total tasks in the tree.
 * @param tree - Array of root-level tasks.
 * @returns Total number of tasks.
 */
export function countTasks(tree: WBSTask[]): number {
  let count = 0;
  for (const task of tree) {
    count += 1 + countTasks(task.children);
  }
  return count;
}

/**
 * Get the maximum depth of the tree.
 * @param tree - Array of root-level tasks.
 * @returns Maximum nesting depth (0 for empty tree).
 */
export function getTreeDepth(tree: WBSTask[]): number {
  if (tree.length === 0) return 0;
  let max = 0;
  for (const task of tree) {
    const childDepth = getTreeDepth(task.children);
    max = Math.max(max, childDepth + 1);
  }
  return max;
}

/**
 * Get all tasks in a flat array (depth-first).
 */
export function getAllTasks(tree: WBSTask[]): WBSTask[] {
  const result: WBSTask[] = [];
  function traverse(tasks: WBSTask[]) {
    for (const task of tasks) {
      result.push(task);
      if (task.children.length > 0) {
        traverse(task.children);
      }
    }
  }
  traverse(tree);
  return result;
}

/**
 * Update a task by ID using a transform function.
 * Returns a new tree with the task updated.
 */
export function updateTask(
  tree: WBSTask[],
  id: string,
  updater: (task: WBSTask) => WBSTask,
): WBSTask[] {
  let changed = false;
  const result = tree.map((task) => {
    if (task.id === id) {
      changed = true;
      return updater(task);
    }
    if (task.children.length > 0) {
      const updatedChildren = updateTask(task.children, id, updater);
      if (updatedChildren !== task.children) {
        changed = true;
        return { ...task, children: updatedChildren, isSummary: updatedChildren.length > 0 };
      }
    }
    return task;
  });
  return changed ? result : tree;
}

// ─── Baseline ───────────────────────────────────────────────────────────────

/**
 * Set the baseline cost and duration for a task.
 * Returns a new tree with the task's baseline fields updated.
 */
export function setBaseline(
  tree: WBSTask[],
  taskId: string,
  baselineCost: number,
  baselineDuration: number,
): WBSTask[] {
  return updateTask(tree, taskId, (task) => ({
    ...task,
    baselineCost,
    baselineDuration,
  }));
}

/**
 * Capture the current cost and duration of every task as its baseline.
 * Returns a new tree with baselineCost/baselineDuration set on all tasks.
 */
export function captureBaseline(tree: WBSTask[]): WBSTask[] {
  return tree.map((task) => ({
    ...task,
    baselineCost: task.cost,
    baselineDuration: task.duration,
    children: captureBaseline(task.children),
  }));
}

// ─── Resource CRUD ──────────────────────────────────────────────────────────

/**
 * Add a resource to a project's resource list.
 * Returns a new array with the resource added.
 */
export function addResource(resources: Resource[], resource: Resource): Resource[] {
  return [...resources, resource];
}

/**
 * Update a resource in a project's resource list.
 * Returns a new array with the resource updated.
 */
export function updateResource(
  resources: Resource[],
  id: string,
  changes: Partial<Resource>,
): Resource[] {
  return resources.map((r) => (r.id === id ? { ...r, ...changes } : r));
}

/**
 * Remove a resource from a project's resource list.
 * Returns a new array with the resource removed.
 */
export function removeResource(resources: Resource[], id: string): Resource[] {
  return resources.filter((r) => r.id !== id);
}

/**
 * Get a resource by ID.
 */
export function findResource(resources: Resource[], id: string): Resource | null {
  return resources.find((r) => r.id === id) ?? null;
}

/**
 * Get all tasks assigned to a specific resource.
 */
export function getTasksForResource(tree: WBSTask[], resourceId: string): WBSTask[] {
  return getAllTasks(tree).filter((t) => t.responsibleResourceId === resourceId);
}

/**
 * Calculate total effort assigned to a resource (sum of task durations).
 */
export function getResourceEffort(tree: WBSTask[], resourceId: string): number {
  return getTasksForResource(tree, resourceId).reduce((sum, t) => sum + t.duration, 0);
}

/**
 * Calculate utilization for a resource (total effort / available days in project range).
 * Returns a percentage (0-100+).
 */
export function getResourceUtilization(
  tree: WBSTask[],
  resourceId: string,
  projectDays: number,
): number {
  const totalEffort = getResourceEffort(tree, resourceId);
  return projectDays > 0 ? (totalEffort / projectDays) * 100 : 0;
}

/**
 * Get a unique color for a new resource.
 * Cycles through a palette of distinct colors.
 */
export function getNextResourceColor(resources: Resource[]): string {
  const palette = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#84CC16', // lime
    '#F97316', // orange
    '#6366F1', // indigo
  ];
  return palette[resources.length % palette.length];
}

/**
 * Generate a unique resource ID.
 */
export function generateResourceId(resources: Resource[]): string {
  const maxNum = resources.reduce((max, r) => {
    const match = r.id.match(/r(\d+)/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `r${maxNum + 1}`;
}

// ─── Resource Cost Sync ───────────────────────────────────────────────────

/**
 * Compute the cost of a task based on its assigned resource's cost rate.
 * Cost = resource costRate × task duration (working days).
 * Returns 0 if no resource is assigned or rate is 0.
 */
export function computeTaskCost(task: WBSTask, resourceMap: Map<string, Resource>): number {
  if (!task.responsibleResourceId) return 0;
  const resource = resourceMap.get(task.responsibleResourceId);
  if (!resource || resource.costRate <= 0) return 0;
  return resource.costRate * Math.max(task.duration, 1);
}

/**
 * Sync resource cost rates into task cost fields.
 * For each task with an assigned resource, sets task.cost = resource.costRate × duration.
 * Tasks without a resource assignment (or with costRate 0) are left unchanged.
 * Returns a new tree with updated costs.
 */
export function syncResourceCosts(tree: WBSTask[], resources: Resource[]): WBSTask[] {
  const resourceMap = new Map(resources.map((r) => [r.id, r]));
  function sync(task: WBSTask): WBSTask {
    const cost = computeTaskCost(task, resourceMap);
    const updated = cost > 0 ? { ...task, cost } : task;
    return {
      ...updated,
      children: updated.children.map(sync),
    };
  }
  return tree.map(sync);
}
