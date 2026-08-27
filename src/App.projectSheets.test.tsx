// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Test for duplicate project sheets bug fix.
 *
 * When saving a project, the Allocations and Consumptions sheets were
 * being duplicated because they were not included in the projectSheetNames
 * set used to filter out old project sheets.
 */

import { TASKS_SHEET_NAME, RISKS_SHEET_NAME, RESOURCES_SHEET_NAME, MATERIALS_SHEET_NAME, ACTUALS_SHEET_NAME, ALLOCATIONS_SHEET_NAME, CONSUMPTIONS_SHEET_NAME } from './extensions/project-wbs/sheetToProject';

describe('project sheet deduplication', () => {
  it('projectSheetNames includes all project sheet names', () => {
    // This set must include all sheet names created by projectModelToWorkbook
    const projectSheetNames = new Set([
      TASKS_SHEET_NAME,
      RISKS_SHEET_NAME,
      RESOURCES_SHEET_NAME,
      MATERIALS_SHEET_NAME,
      ACTUALS_SHEET_NAME,
      ALLOCATIONS_SHEET_NAME,
      CONSUMPTIONS_SHEET_NAME,
    ]);

    // Verify all expected sheet names are present
    expect(projectSheetNames.has('Project Plan')).toBe(true);
    expect(projectSheetNames.has('Risks')).toBe(true);
    expect(projectSheetNames.has('Resources')).toBe(true);
    expect(projectSheetNames.has('Materials')).toBe(true);
    expect(projectSheetNames.has('Actuals')).toBe(true);
    expect(projectSheetNames.has('Allocations')).toBe(true);
    expect(projectSheetNames.has('Consumptions')).toBe(true);
  });

  it('non-project sheets are not in projectSheetNames', () => {
    const projectSheetNames = new Set([
      TASKS_SHEET_NAME,
      RISKS_SHEET_NAME,
      RESOURCES_SHEET_NAME,
      MATERIALS_SHEET_NAME,
      ACTUALS_SHEET_NAME,
      ALLOCATIONS_SHEET_NAME,
      CONSUMPTIONS_SHEET_NAME,
    ]);

    // These sheets should NOT be in the project sheet names
    expect(projectSheetNames.has('Project')).toBe(false);
    expect(projectSheetNames.has('Custom Sheet')).toBe(false);
    expect(projectSheetNames.has('Data')).toBe(false);
  });
});
