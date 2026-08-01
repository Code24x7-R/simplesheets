// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Performance benchmark for SimpleSheet.
 * Measures formula evaluation speed on a 5,000 cell workbook.
 */

import type { Workbook, Sheet, Cell } from '../types';
import { cellKey } from '../types';
import { evaluateWorkbook } from './formulaEngine';

/**
 * Creates a test workbook with the specified number of formula cells.
 */
function createTestWorkbook(formulaCount: number): Workbook {
  const cells: Record<string, Cell> = {};
  const cols = 26;
  const rowsNeeded = Math.ceil(formulaCount / cols);

  // Populate some source data
  for (let r = 0; r < Math.min(rowsNeeded, 100); r++) {
    for (let c = 0; c < cols; c++) {
      cells[cellKey(r, c)] = { rawValue: String(Math.round(Math.random() * 100)) };
    }
  }

  // Add formula cells
  let formulaIdx = 0;
  for (let r = 0; r < rowsNeeded && formulaIdx < formulaCount; r++) {
    for (let c = 0; c < cols && formulaIdx < formulaCount; c++) {
      const key = cellKey(r, c);
      if (cells[key]) {
        cells[key] = { rawValue: `=SUM(A${r + 1}:${String.fromCharCode(65 + c)}${r + 1})` };
        formulaIdx++;
      }
    }
  }

  const sheet: Sheet = {
    id: 'bench-sheet',
    name: 'Benchmark',
    cells,
    defaultColWidth: 100,
    defaultRowHeight: 28,
    columnWidths: {},
    rowHeights: {},
    columnCount: cols,
    rowCount: Math.max(rowsNeeded + 10, 100),
    frozenColumns: 0,
    frozenRows: 0,
  };

  return {
    id: 'bench-wb',
    title: 'Benchmark Workbook',
    sheets: [sheet],
    activeSheetIndex: 0,
    lastModified: Date.now(),
  };
}

/**
 * Runs the formula evaluation benchmark.
 * @param cellCount - Number of formula cells to evaluate.
 * @returns Benchmark results in ms.
 */
export function runBenchmark(cellCount: number = 5000): {
  cellCount: number;
  evalTimeMs: number;
  cellsPerMs: number;
  circularCount: number;
  success: boolean;
} {
  const workbook = createTestWorkbook(cellCount);

  const start = performance.now();
  const result = evaluateWorkbook(workbook, 0);
  const end = performance.now();

  const evalTimeMs = end - start;
  const cellsPerMs = cellCount / evalTimeMs;

  return {
    cellCount,
    evalTimeMs: Math.round(evalTimeMs * 100) / 100,
    cellsPerMs: Math.round(cellsPerMs * 100) / 100,
    circularCount: result.circularRefs.length,
    success: result.success,
  };
}

/**
 * Runs the benchmark and logs results to console.
 * Can be invoked from npm: `npm run benchmark`
 */
export function logBenchmark(): void {
  console.log('═'.repeat(60));
  console.log(' SimpleSheet Performance Benchmark');
  console.log('═'.repeat(60));

  const sizes = [100, 500, 1000, 5000];

  console.log('\n Cells  |  Time (ms)  |  Cells/ms  |  Status');
  console.log('─'.repeat(50));

  for (const size of sizes) {
    const result = runBenchmark(size);
    const status = result.evalTimeMs <= 10 ? '✅ PASS' : '⚠️  WARN';
    console.log(
      ` ${String(size).padStart(5)}  |  ${String(result.evalTimeMs).padStart(8)}  |  ${String(result.cellsPerMs).padStart(7)}  |  ${status}`
    );
  }

  console.log('\n Target: ≤10ms for 5,000 cells');
  console.log('═'.repeat(60));
}

// Auto-run if executed directly
/* istanbul ignore next - Node.js entry point, not executed in Jest */
if (require.main === module) {
  logBenchmark();
}
