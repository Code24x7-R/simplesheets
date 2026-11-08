// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { access, copyFile, mkdtemp, readFile, rm, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FIXTURES = path.resolve('tmp', 'desktop-fixtures');

interface Session {
  app: ElectronApplication;
  page: Page;
  profile: string;
}

async function launch(profile: string, args: string[] = []): Promise<Session> {
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

async function clickMenu(app: ElectronApplication, id: string): Promise<void> {
  await app.evaluate(({ Menu, BrowserWindow }, itemId) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById(itemId);
    if (!item) throw new Error(`Missing menu item: ${itemId}`);
    item.click(undefined as never, BrowserWindow.getAllWindows()[0], undefined as never);
  }, id);
}

async function stubOpenDialog(app: ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, target) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] });
  }, filePath);
}

async function stubMessageBox(app: ElectronApplication, response: number): Promise<void> {
  await app.evaluate(({ dialog }, choice) => {
    dialog.showMessageBox = async () => ({ response: choice, checkboxChecked: false });
  }, response);
}

test.beforeAll(async () => {
  await access(path.join(FIXTURES, 'small.ssjson'), constants.R_OK);
  await access(path.join(FIXTURES, 'small.csv'), constants.R_OK);
});

test('About actions: versions, Open Data Folder, Copy Diagnostics, Reset', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-about-actions-'));
  const session = await launch(profile, [path.join(FIXTURES, 'small.ssjson')]);
  try {
    const userData = await session.app.evaluate(({ app }) => app.getPath('userData'));
    await session.app.evaluate(({ shell }) => {
      globalThis.__simplesheetsFolders = [];
      shell.showItemInFolder = (folder: string) => {
        globalThis.__simplesheetsFolders.push(folder);
      };
    });

    await clickMenu(session.app, 'help-about');
    await expect(session.page.getByRole('heading', { name: 'About SimpleSheets' })).toBeVisible();
    await expect(session.page.getByText('Electron')).toBeVisible();
    await expect(session.page.getByText('Chromium')).toBeVisible();
    await expect(session.page.getByText('Node')).toBeVisible();

    await session.page.getByRole('button', { name: 'Open Data Folder' }).click();
    await expect
      .poll(() => session.app.evaluate(() => globalThis.__simplesheetsFolders ?? []))
      .toContain(userData);

    await session.page.getByLabel('Copy diagnostics').evaluate((element) => {
      (element as HTMLElement).click();
    });
    const clipboard = await session.app.evaluate(({ clipboard }) => clipboard.readText());
    expect(clipboard).toContain('SimpleSheets 0.1.0');
    expect(clipboard).toContain('Electron:');
    expect(clipboard).toContain('Data folder:');
    expect(clipboard).not.toContain('small.ssjson');

    await session.page.evaluate(() => {
      window.confirm = () => true;
    });
    await session.page.getByRole('button', { name: 'Reset Application Data…' }).click();
    await expect(session.page.getByText('Application data reset.')).toBeVisible();
    await session.page.waitForTimeout(300);
    const state = JSON.parse(await readFile(path.join(profile, 'state.json'), 'utf8')) as {
      recents: unknown[];
      lastPath: string | null;
    };
    expect(state.recents).toEqual([]);
    expect(state.lastPath).toBeNull();
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
  }
});

test('desktop Copy Link uses the public web base', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-copy-link-'));
  const session = await launch(profile, [path.join(FIXTURES, 'small.ssjson')]);
  try {
    await clickMenu(session.app, 'file-share-link');
    await expect
      .poll(() => session.app.evaluate(({ clipboard }) => clipboard.readText()))
      .toMatch(/^https:\/\/simplesheets\.mouseclick\.au\/#doc=/);
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
  }
});

test('native Import menu opens the Import Scope dialog', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-import-menu-'));
  const session = await launch(profile);
  try {
    await stubOpenDialog(session.app, path.join(FIXTURES, 'small.csv'));
    await clickMenu(session.app, 'file-import-csv');
    const dialog = session.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
  }
});

test('a missing recent offers Remove from list', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-missing-recent-'));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-missing-recent-file-'));
  const target = path.join(dir, 'small.ssjson');
  await copyFile(path.join(FIXTURES, 'small.ssjson'), target);
  const session = await launch(profile, [target]);
  try {
    await expect(session.page.getByText('Item 1', { exact: true })).toBeVisible();
    await unlink(target);
    await stubMessageBox(session.app, 0);
    await clickMenu(session.app, 'recent-0');
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Removed "small.ssjson" from recent files/i,
    );
    await session.page.waitForTimeout(300);
    const state = JSON.parse(await readFile(path.join(profile, 'state.json'), 'utf8')) as {
      recents: unknown[];
    };
    expect(state.recents).toEqual([]);
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
    await rm(dir, { recursive: true, force: true });
  }
});
