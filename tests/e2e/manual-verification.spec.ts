// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { access, copyFile, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
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

async function stubSaveDialog(app: ElectronApplication, filePath: string | null): Promise<void> {
  await app.evaluate(({ dialog }, target) => {
    dialog.showSaveDialog = async () => ({ canceled: target === null, filePath: target ?? undefined });
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
  await access(path.join(FIXTURES, 'unicode.ssjson'), constants.R_OK);
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


test('same file reopens cleanly and prompts when dirty', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-reopen-same-'));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-reopen-file-'));
  const target = path.join(dir, 'small.ssjson');
  await copyFile(path.join(FIXTURES, 'small.ssjson'), target);
  const session = await launch(profile, [target]);
  try {
    await expect(session.page.getByText('Item 1', { exact: true })).toBeVisible();
    await stubOpenDialog(session.app, target);

    // Replace the file behind the app, then reopen while clean.
    await copyFile(path.join(FIXTURES, 'unicode.ssjson'), target);
    await session.page.keyboard.press('Control+o');
    await expect(session.page.getByText('こんにちは', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    // Edit, then reopen the same file with Don't Save.
    await session.page.getByText('こんにちは', { exact: true }).click();
    await session.page.keyboard.press('Delete');
    await session.page.keyboard.type('Dirty local');
    await session.page.keyboard.press('Enter');
    await stubMessageBox(session.app, 1);
    await session.page.keyboard.press('Control+o');
    await expect(session.page.getByText('こんにちは', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
    await rm(dir, { recursive: true, force: true });
  }
});

test('clearing recents updates state and the native menu', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-recents-clear-'));
  const session = await launch(profile, [path.join(FIXTURES, 'small.ssjson')]);
  try {
    await expect(session.page.getByText('Item 1', { exact: true })).toBeVisible();
    await clickMenu(session.app, 'file-clear-recents');
    await session.page.waitForTimeout(300);
    const state = JSON.parse(await readFile(path.join(profile, 'state.json'), 'utf8')) as {
      recents: unknown[];
    };
    expect(state.recents).toEqual([]);
    const recentLabel = await session.app.evaluate(
      ({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById('recent-0')?.label ?? null,
    );
    expect(recentLabel).toBeNull();
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
  }
});


test('PDF export writes through the native Save dialog', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-pdf-export-'));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-pdf-target-'));
  const target = path.join(dir, 'small.pdf');
  const session = await launch(profile, [path.join(FIXTURES, 'small.ssjson')]);
  try {
    await stubSaveDialog(session.app, target);
    await clickMenu(session.app, 'file-export-pdf');
    await expect(session.page.getByTestId('status-message')).toContainText(/Exported "small\.pdf"/i, {
      timeout: 60_000,
    });
    await expect(access(target, constants.R_OK)).resolves.toBeUndefined();
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
    await rm(dir, { recursive: true, force: true });
  }
});

test('cancelling an export leaves the document untouched', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-export-cancel-'));
  const session = await launch(profile, [path.join(FIXTURES, 'small.ssjson')]);
  try {
    await stubSaveDialog(session.app, null);
    await clickMenu(session.app, 'file-export-csv');
    await session.page.waitForTimeout(500);
    await expect(session.page.getByTestId('status-message')).toContainText(/Imported "small"/);
    await expect(session.page.getByTestId('save-state')).not.toContainText(/Unsaved changes/);
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
  }
});

test('a simplesheets:// argument is ignored without registering a protocol', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-url-protocol-'));
  const session = await launch(profile, ['simplesheets://open?file=small.ssjson']);
  try {
    await expect(session.page.getByTestId('grid-drop-zone')).toBeVisible();
    await expect(session.page.getByTestId('status-message')).not.toContainText(/Open error/i);
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
  }
});


test('a Windows share-lock is retried and can be cancelled', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-lock-'));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-lock-file-'));
  const target = path.join(dir, 'small.ssjson');
  await copyFile(path.join(FIXTURES, 'small.ssjson'), target);
  const session = await launch(profile, [target]);
  let locker: ReturnType<typeof spawn> | null = null;
  try {
    await expect(session.page.getByText('Item 1', { exact: true })).toBeVisible();
    await session.page.getByText('Item 1', { exact: true }).click();
    await session.page.keyboard.press('Delete');
    await session.page.keyboard.type('Locked edit');
    await session.page.keyboard.press('Enter');
    await expect(session.page.getByTestId('save-state')).toContainText(/Unsaved changes/);
    await session.page.waitForTimeout(800);

    const script = path.join(dir, 'lock.ps1');
    const escaped = target.replace(/'/g, "''");
    await writeFile(
      script,
      `$fs = [System.IO.File]::Open('${escaped}', 'Open', 'ReadWrite', 'None')
Write-Output 'LOCKED'
Start-Sleep -Seconds 15
$fs.Close()
`,
    );
    locker = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script]);
    await new Promise<void>((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('locker did not start')), 10_000);
      locker!.stdout?.on('data', (chunk) => {
        output += String(chunk);
        if (output.includes('LOCKED')) {
          clearTimeout(timer);
          resolve();
        }
      });
      locker!.on('error', reject);
    });

    await stubMessageBox(session.app, 2);
    await session.page.keyboard.press('Control+s');
    await session.page.waitForTimeout(1_500);
    await expect(session.page.getByTestId('save-state')).toContainText(/Unsaved changes/);

    locker.kill();
    await new Promise<void>((resolve) => locker!.once('exit', () => resolve()));
    locker = null;
    await session.page.keyboard.press('Control+s');
    await expect(session.page.getByTestId('status-message')).toContainText(/Saved "small\.ssjson"/i, {
      timeout: 30_000,
    });
  } finally {
    locker?.kill();
    await session.app.close();
    await cleanupProfile(profile);
    await rm(dir, { recursive: true, force: true });
  }
});
