// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  buildDependencyGraph,
  flattenTasks,
  topologicalSort,
  detectDependencyCycles,
  calculateCPM,
  getCriticalPath,
  calculateTotalFloat,
  calculateDependencyDate,
} from './dependencies';
import { createDefaultCalendar } from './calendar';
import type { WBSTask } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function task(id: string, duration = 5, dependencies: WBSTask['dependencies'] = []): WBSTask {
  return {
    id,
    name: `Task ${id}`,
    description: '',
    level: 0,
    parentId: null,
    children: [],
    startDate: '2026-01-01',
    endDate: '2026-01-10',
    duration,
    progress: 0,
    effort: 0,
    effortUnit: 'hours',
    cost: 0,
    costCurrency: 'USD',
    responsibleResourceId: null,
    dependencies,
    isMilestone: false,
    isSummary: false,
    collapsed: false,
    color: '#3B82EF',
    riskIds: [],
    customFields: {},
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('dependencies', () => {
  describe('buildDependencyGraph', () => {
    it('builds graph from dependencies', () => {
      const tasks = [
        task('A'),
        task('B', 5, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
        task('C', 5, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
      ];
      const graph = buildDependencyGraph(tasks);
      expect(graph.successors.get('A')).toContain('B');
      expect(graph.successors.get('A')).toContain('C');
      expect(graph.predecessors.get('B')).toContain('A');
      expect(graph.predecessors.get('C')).toContain('A');
    });

    it('handles tasks with no dependencies', () => {
      const tasks = [task('A'), task('B')];
      const graph = buildDependencyGraph(tasks);
      expect(graph.successors.get('A')!.size).toBe(0);
      expect(graph.predecessors.get('B')!.size).toBe(0);
    });
  });

  describe('flattenTasks', () => {
    it('flattens a tree to a list', () => {
      const tree = [
        task('A', 5, []),
        { ...task('B', 5, []), children: [task('C', 3, [])] },
      ];
      const flat = flattenTasks(tree);
      expect(flat.map((t) => t.id)).toEqual(['A', 'B', 'C']);
    });
  });

  describe('topologicalSort', () => {
    it('sorts tasks in dependency order', () => {
      const tasks = [
        task('C', 5, [{ predecessorId: 'B', type: 'FS', lag: 0 }]),
        task('A'),
        task('B', 5, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
      ];
      const sorted = topologicalSort(tasks);
      expect(sorted).not.toBeNull();
      const ids = sorted!.map((t) => t.id);
      expect(ids.indexOf('A')).toBeLessThan(ids.indexOf('B'));
      expect(ids.indexOf('B')).toBeLessThan(ids.indexOf('C'));
    });

    it('returns null for cyclic dependencies', () => {
      const tasks = [
        task('A', 5, [{ predecessorId: 'C', type: 'FS', lag: 0 }]),
        task('B', 5, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
        task('C', 5, [{ predecessorId: 'B', type: 'FS', lag: 0 }]),
      ];
      expect(topologicalSort(tasks)).toBeNull();
    });
  });

  describe('detectDependencyCycles', () => {
    it('returns empty for acyclic graph', () => {
      const tasks = [
        task('A'),
        task('B', 5, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
      ];
      expect(detectDependencyCycles(tasks)).toEqual([]);
    });

    it('detects a simple cycle', () => {
      const tasks = [
        task('A', 5, [{ predecessorId: 'B', type: 'FS', lag: 0 }]),
        task('B', 5, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
      ];
      const cycles = detectDependencyCycles(tasks);
      expect(cycles).toContain('A');
      expect(cycles).toContain('B');
    });
  });

  describe('calculateCPM', () => {
    const calendar = createDefaultCalendar();

    it('calculates CPM for a simple chain', () => {
      const tasks = [
        task('A', 5),
        task('B', 3, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
        task('C', 4, [{ predecessorId: 'B', type: 'FS', lag: 0 }]),
      ];
      const cpm = calculateCPM(tasks, calendar);

      const a = cpm.get('A')!;
      const b = cpm.get('B')!;
      const c = cpm.get('C')!;

      expect(a.earlyStart).toBe(0);
      expect(a.earlyEnd).toBe(4); // 0 + 5 - 1
      expect(b.earlyStart).toBe(5);
      expect(b.earlyEnd).toBe(7); // 5 + 3 - 1
      expect(c.earlyStart).toBe(8);
      expect(c.earlyEnd).toBe(11); // 8 + 4 - 1
    });

    it('marks all tasks as critical in a chain', () => {
      const tasks = [
        task('A', 5),
        task('B', 3, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
      ];
      const cpm = calculateCPM(tasks, calendar);
      expect(cpm.get('A')!.isCritical).toBe(true);
      expect(cpm.get('B')!.isCritical).toBe(true);
    });

    it('calculates float for parallel tasks', () => {
      // A → B (critical) and A → C (parallel, has float)
      const tasks = [
        task('A', 5),
        task('B', 5, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
        task('C', 2, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
      ];
      const cpm = calculateCPM(tasks, calendar);
      // C finishes early, has float until B finishes
      expect(cpm.get('C')!.totalFloat).toBeGreaterThan(0);
      expect(cpm.get('B')!.isCritical).toBe(true);
    });

    it('returns empty map for cyclic graph', () => {
      const tasks = [
        task('A', 5, [{ predecessorId: 'B', type: 'FS', lag: 0 }]),
        task('B', 5, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
      ];
      const cpm = calculateCPM(tasks, calendar);
      expect(cpm.size).toBe(0);
    });
  });

  describe('getCriticalPath', () => {
    const calendar = createDefaultCalendar();

    it('returns critical path for a chain', () => {
      const tasks = [
        task('A', 5),
        task('B', 3, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
        task('C', 4, [{ predecessorId: 'B', type: 'FS', lag: 0 }]),
      ];
      const path = getCriticalPath(tasks, calendar);
      expect(path).toEqual(['A', 'B', 'C']);
    });

    it('excludes non-critical tasks', () => {
      const tasks = [
        task('A', 5),
        task('B', 5, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
        task('C', 2, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
      ];
      const path = getCriticalPath(tasks, calendar);
      expect(path).toContain('A');
      expect(path).toContain('B');
      expect(path).not.toContain('C');
    });
  });

  describe('calculateTotalFloat', () => {
    const calendar = createDefaultCalendar();

    it('returns 0 for critical task', () => {
      const tasks = [
        task('A', 5),
        task('B', 3, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
      ];
      expect(calculateTotalFloat(tasks, 'A', calendar)).toBe(0);
    });

    it('returns positive float for non-critical task', () => {
      const tasks = [
        task('A', 5),
        task('B', 5, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
        task('C', 2, [{ predecessorId: 'A', type: 'FS', lag: 0 }]),
      ];
      const float = calculateTotalFloat(tasks, 'C', calendar);
      expect(float).toBeGreaterThan(0);
    });

    it('returns null for non-existent task', () => {
      const tasks = [task('A')];
      expect(calculateTotalFloat(tasks, 'Z', calendar)).toBeNull();
    });
  });

  describe('calculateDependencyDate', () => {
    const calendar = createDefaultCalendar();

    it('FS dependency: successor starts after predecessor ends', () => {
      const pred = task('A', 5);
      pred.startDate = '2026-01-05'; // Monday
      pred.endDate = '2026-01-09';   // Friday
      const dep = { predecessorId: 'A', type: 'FS' as const, lag: 0 };
      const result = calculateDependencyDate(pred, dep, '2026-01-05', calendar);
      // FS: successor starts day after predecessor ends
      expect(result).toBe('2026-01-12'); // Next Monday
    });

    it('FS with lag', () => {
      const pred = task('A', 5);
      pred.startDate = '2026-01-05';
      pred.endDate = '2026-01-09';
      const dep = { predecessorId: 'A', type: 'FS' as const, lag: 2 };
      const result = calculateDependencyDate(pred, dep, '2026-01-05', calendar);
      // FS with 2-day lag: successor starts 2 working days after predecessor ends
      expect(result).toBe('2026-01-14'); // Wed
    });

    it('SS dependency: successor starts after predecessor starts', () => {
      const pred = task('A', 5);
      pred.startDate = '2026-01-05';
      const dep = { predecessorId: 'A', type: 'SS' as const, lag: 0 };
      const result = calculateDependencyDate(pred, dep, '2026-01-05', calendar);
      expect(result).toBe('2026-01-05');
    });
  });
});
