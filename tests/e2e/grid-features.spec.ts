// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('double-clicking a column margin auto-fits it', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-autofit-'));
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, SIMPLESHEETS_PROFILE: profile } as Record<string, string>,
  });

  try {
    const page = await app.firstWindow();
    await page.locator('#root > *').first().waitFor({ state: 'visible', timeout: 30_000 });

    const firstCell = page.locator('.grid-cell').first();
    await firstCell.click();
    await page.keyboard.type('Widest column content');
    await page.keyboard.press('Enter');

    const header = page.locator('[data-col-header="0"]');
    const initialWidth = await header.evaluate((el) => parseFloat((el as HTMLElement).style.width));
    expect(initialWidth).toBe(100);

    await header.locator('.resize-handle').dblclick();
    const fittedWidth = await header.evaluate((el) => parseFloat((el as HTMLElement).style.width));
    expect(fittedWidth).toBeGreaterThan(initialWidth);
    expect(fittedWidth).toBeLessThanOrEqual(500);
  } finally {
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = (async () => ({ response: 1, checkboxChecked: false })) as typeof dialog.showMessageBox;
    });
    await app.close();
    await rm(profile, { recursive: true, force: true });
  }
});
