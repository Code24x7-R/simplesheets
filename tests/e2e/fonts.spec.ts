// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('font picker lists installed families and applies one to a cell', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-fonts-'));
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, SIMPLESHEETS_PROFILE: profile } as Record<string, string>,
  });

  try {
    const page = await app.firstWindow();
    await page.locator('#root > *').first().waitFor({ state: 'visible', timeout: 30_000 });

    // Create a populated cell so the style can be applied.
    const firstCell = page.locator('.grid-cell').first();
    await firstCell.click();
    await page.keyboard.type('Arial test');
    await page.keyboard.press('Enter');
    await page.getByText('Arial test', { exact: true }).click();

    await page.getByLabel('Font Family').click();
    await expect(page.getByLabel('Search font families')).toBeVisible();

    const search = page.getByLabel('Search font families');
    await search.fill('Arial');
    const option = page.getByRole('option', { name: 'Arial', exact: true });
    await expect(option).toBeVisible();
    await option.click();

    await expect(page.getByLabel('Font Family')).toContainText('Arial');
    await expect(page.getByText('Showing common fonts.')).toHaveCount(0);
    await expect(page.getByText('Arial test', { exact: true })).toHaveCSS('font-family', 'Arial');
  } finally {
    // Discard the unsaved test cell so the native close prompt cannot block
    // Playwright's app.close().
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = (async () => ({ response: 1, checkboxChecked: false })) as typeof dialog.showMessageBox;
    });
    await app.close();
    await rm(profile, { recursive: true, force: true });
  }
});
