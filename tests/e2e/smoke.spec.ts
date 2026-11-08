// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('desktop shell launches and renders the existing app', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-e2e-'));
  const electronApp = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      SIMPLESHEETS_PROFILE: profile,
    } as Record<string, string>,
  });

  try {
    const window = await electronApp.firstWindow();
    await expect(window).toHaveTitle(/SimpleSheets/);
    await expect(window.locator('#root')).toBeVisible();
    await expect(window.locator('#root > *').first()).toBeVisible();
  } finally {
    await electronApp.close();
    await rm(profile, { recursive: true, force: true });
  }
});
