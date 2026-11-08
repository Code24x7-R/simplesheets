// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { access, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FIXTURES = path.resolve('tmp', 'desktop-fixtures');
const NAV_CSV = path.join(FIXTURES, 'nav-5000.csv');
const LARGE_JSON = path.join(FIXTURES, 'large.ssjson');

interface Session {
  app: ElectronApplication;
  page: Page;
  profile: string;
}

async function launch(profile: string, args: string[]): Promise<Session> {
  const app = await electron.launch({
    args: ['.', ...args],
    env: { ...process.env, SIMPLESHEETS_PROFILE: profile } as Record<string, string>,
  });
  const page = await app.firstWindow();
  await page.locator('#root > *').first().waitFor({ state: 'visible', timeout: 30_000 });
  return { app, page, profile };
}

async function cleanupProfile(profile: string): Promise<void> {
  await rm(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
}

test.beforeAll(async () => {
  await access(NAV_CSV, constants.R_OK);
  await access(LARGE_JSON, constants.R_OK);
});

test('5,000-row CSV navigation stays responsive', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-perf-nav-'));
  const session = await launch(profile, [NAV_CSV]);
  try {
    const dialog = session.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    const importStart = Date.now();
    await dialog.getByRole('button', { name: 'Import' }).click();
    await expect(session.page.getByText('Row 0', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    expect(Date.now() - importStart).toBeLessThan(5_000);

    await session.page.getByText('Row 0', { exact: true }).click();
    // Warm the navigation path before measuring.
    await session.page.keyboard.press('ArrowDown');
    await session.page.waitForTimeout(100);

    const timings: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const start = Date.now();
      await session.page.keyboard.press('ArrowDown');
      timings.push(Date.now() - start);
    }

    const average = timings.reduce((sum, value) => sum + value, 0) / timings.length;
    const worst = Math.max(...timings);
    // The regression fixed here was ~425 ms/key: CloudStorageModal compressed
    // the entire workbook during every parent render, including navigation.
    expect(average).toBeLessThan(100);
    expect(worst).toBeLessThan(250);
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
  }
});


test('10 MB-class workbook opens and saves within budget', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-perf-large-'));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-perf-large-file-'));
  const target = path.join(dir, 'large.ssjson');
  await copyFile(LARGE_JSON, target);

  const launchStart = Date.now();
  const session = await launch(profile, [target]);
  try {
    await expect(session.page.getByText('Column 1', { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });
    const openMs = Date.now() - launchStart;
    expect(openMs).toBeLessThan(5_000);

    await session.page.getByText('Column 1', { exact: true }).first().click();
    const navigation: number[] = [];
    for (let index = 0; index < 10; index += 1) {
      const start = Date.now();
      await session.page.keyboard.press('ArrowDown');
      navigation.push(Date.now() - start);
    }
    const navigationAverage = navigation.reduce((sum, value) => sum + value, 0) / navigation.length;
    expect(navigationAverage).toBeLessThan(100);

    const metrics = await session.app.evaluate(({ app }) =>
      app.getAppMetrics().reduce((total, metric) => total + metric.memory.workingSetSize, 0),
    );
    // workingSetSize is reported in KB; ceiling is 1.5 GB.
    expect(metrics).toBeLessThan(1_500_000);

    const saveStart = Date.now();
    await session.page.keyboard.press('Control+s');
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Saved "large\.ssjson"/,
      { timeout: 30_000 },
    );
    expect(Date.now() - saveStart).toBeLessThan(2_000);
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
    await rm(dir, { recursive: true, force: true });
  }
});

test('twenty open cycles do not grow the renderer heap by more than 20%', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-perf-leak-'));
  const session = await launch(profile, [path.join(FIXTURES, 'small.ssjson')]);
  try {
    await session.app.evaluate(({ dialog }, target) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] });
    }, path.join(FIXTURES, 'small.ssjson'));

    const client = await session.page.context().newCDPSession(session.page);
    const heap = async (): Promise<number> => {
      await client.send('HeapProfiler.collectGarbage');
      const usage = await client.send('Runtime.getHeapUsage');
      return usage.usedSize;
    };

    const windowObject = await client.send('Runtime.evaluate', { expression: 'window' });
    const objectId = windowObject.result.objectId;
    const listenerCount = async (): Promise<number> => {
      if (!objectId) return 0;
      const result = await client.send('DOMDebugger.getEventListeners', { objectId });
      return result.listeners.length;
    };
    const resourceCount = () =>
      session.app.evaluate(() => process.getActiveResourcesInfo().length);

    const first = await heap();
    const firstListeners = await listenerCount();
    const firstResources = await resourceCount();
    for (let index = 0; index < 20; index += 1) {
      await session.page.bringToFront();
      await session.page.keyboard.press('Control+o');
      await expect(session.page.getByTestId('status-message')).toContainText(
        /Imported "small"/,
        { timeout: 30_000 },
      );
    }
    const last = await heap();
    const lastListeners = await listenerCount();
    const lastResources = await resourceCount();
    expect(last).toBeLessThan(first * 1.2);
    expect(lastListeners).toBeLessThanOrEqual(firstListeners + 2);
    expect(lastResources).toBeLessThanOrEqual(firstResources + 2);
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
  }
});


test('cold start reaches a usable grid in under 3 seconds', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-perf-cold-'));
  const start = Date.now();
  const session = await launch(profile, []);
  try {
    await expect(session.page.getByTestId('grid-drop-zone')).toBeVisible({ timeout: 30_000 });
    expect(Date.now() - start).toBeLessThan(3_000);
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
  }
});
