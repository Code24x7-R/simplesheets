// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import {
  access,
  chmod,
  copyFile,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FIXTURES = path.resolve('tmp', 'desktop-fixtures');

interface Session {
  app: ElectronApplication;
  page: Page;
  profile: string;
}

async function launch(extraArgs: string[] = []): Promise<Session> {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-save-e2e-'));
  const app = await electron.launch({
    args: ['.', ...extraArgs],
    env: {
      ...process.env,
      SIMPLESHEETS_PROFILE: profile,
    } as Record<string, string>,
  });
  const page = await app.firstWindow();
  await page.locator('#root > *').first().waitFor({ state: 'visible', timeout: 30_000 });
  return { app, page, profile };
}

async function close(session: Session): Promise<void> {
  await session.app.close();
  await rm(session.profile, { recursive: true, force: true });
}

async function stubSaveDialog(app: ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, target) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: target });
  }, filePath);
}

async function stubMessageBox(app: ElectronApplication, response: number): Promise<void> {
  await app.evaluate(({ dialog }, choice) => {
    dialog.showMessageBox = async () => ({
      response: choice,
      checkboxChecked: false,
    });
  }, response);
}

async function windowTitle(app: ElectronApplication): Promise<string> {
  return app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.getTitle() ?? '',
  );
}

test.beforeAll(async () => {
  await access(path.join(FIXTURES, 'small.ssjson'), constants.R_OK);
});

test('saves the current document in place', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-save-'));
  const target = path.join(dir, 'small.ssjson');
  await copyFile(path.join(FIXTURES, 'small.ssjson'), target);
  const session = await launch([target]);
  try {
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Imported "/,
      { timeout: 30_000 },
    );
    await session.page.keyboard.press('Control+s');
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Saved "small\.ssjson"/i,
      { timeout: 30_000 },
    );

    const saved = JSON.parse(await readFile(target, 'utf8')) as { title: string; sheets: unknown[] };
    expect(saved.title).toBe('small');
    expect(saved.sheets).toHaveLength(1);
    expect(await readdir(dir)).toEqual(['small.ssjson']);
    expect(await windowTitle(session.app)).toContain('small');
  } finally {
    await close(session);
    await rm(dir, { recursive: true, force: true });
  }
});

test('Save on an untitled document behaves as Save As', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-untitled-'));
  const target = path.join(dir, 'untitled.ssjson');
  const session = await launch();
  try {
    await stubSaveDialog(session.app, target);
    await session.page.keyboard.press('Control+s');
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Saved "untitled\.ssjson"/i,
      { timeout: 30_000 },
    );
    expect(JSON.parse(await readFile(target, 'utf8'))).toMatchObject({
      title: 'untitled',
    });
  } finally {
    await close(session);
    await rm(dir, { recursive: true, force: true });
  }
});

test('cancelling the Save As dialog writes nothing', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-cancel-'));
  const session = await launch();
  try {
    await session.app.evaluate(({ dialog }) => {
      dialog.showSaveDialog = async () => ({ canceled: true, filePath: undefined });
    });
    await session.page.keyboard.press('Control+s');
    await session.page.waitForTimeout(500);
    expect(await readdir(dir)).toEqual([]);
  } finally {
    await close(session);
    await rm(dir, { recursive: true, force: true });
  }
});

test('recreates a deleted target when asked', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-recreate-'));
  const target = path.join(dir, 'small.ssjson');
  await copyFile(path.join(FIXTURES, 'small.ssjson'), target);
  const session = await launch([target]);
  try {
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Imported "/,
      { timeout: 30_000 },
    );
    await rm(target);
    await stubMessageBox(session.app, 0); // Recreate
    await session.page.keyboard.press('Control+s');
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Saved "small\.ssjson"/i,
      { timeout: 30_000 },
    );
    expect(JSON.parse(await readFile(target, 'utf8'))).toMatchObject({
      title: 'small',
    });
  } finally {
    await close(session);
    await rm(dir, { recursive: true, force: true });
  }
});

test('Save As writes a new file through the native dialog', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-save-as-'));
  const target = path.join(dir, 'copy.ssjson');
  const session = await launch([path.join(FIXTURES, 'small.ssjson')]);
  try {
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Imported "/,
      { timeout: 30_000 },
    );
    await stubSaveDialog(session.app, target);
    await session.page.keyboard.press('Control+Shift+S');
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Saved "copy\.ssjson"/i,
      { timeout: 30_000 },
    );
    expect(JSON.parse(await readFile(target, 'utf8'))).toMatchObject({
      title: 'copy',
    });
    expect(await windowTitle(session.app)).toContain('copy');
  } finally {
    await close(session);
    await rm(dir, { recursive: true, force: true });
  }
});

test('prompts on an external change and overwrites when asked', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-conflict-'));
  const target = path.join(dir, 'small.ssjson');
  await copyFile(path.join(FIXTURES, 'small.ssjson'), target);
  const session = await launch([target]);
  try {
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Imported "/,
      { timeout: 30_000 },
    );
    await writeFile(
      target,
      JSON.stringify({ id: 'external', title: 'External', sheets: [], activeSheetIndex: 0 }),
      'utf8',
    );
    await stubMessageBox(session.app, 0); // Overwrite
    await session.page.keyboard.press('Control+s');
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Saved "small\.ssjson"/i,
      { timeout: 30_000 },
    );
    const saved = JSON.parse(await readFile(target, 'utf8')) as { title: string };
    expect(saved.title).toBe('small');
  } finally {
    await close(session);
    await rm(dir, { recursive: true, force: true });
  }
});

test('reloads the on-disk version when the conflict prompt says Reload', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-reload-'));
  const target = path.join(dir, 'small.ssjson');
  await copyFile(path.join(FIXTURES, 'small.ssjson'), target);
  const session = await launch([target]);
  try {
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Imported "/,
      { timeout: 30_000 },
    );
    const external = {
      id: 'external',
      title: 'External',
      sheets: [
        {
          id: 'sheet-data',
          name: 'Data',
          cells: { '0:0': { rawValue: 'External cell' } },
          defaultColWidth: 96,
          defaultRowHeight: 24,
          columnWidths: {},
          rowHeights: {},
          columnCount: 26,
          rowCount: 1000,
          frozenColumns: 0,
          frozenRows: 0,
        },
      ],
      activeSheetIndex: 0,
    };
    await writeFile(target, JSON.stringify(external), 'utf8');
    await stubMessageBox(session.app, 2); // Reload
    await session.page.keyboard.press('Control+s');
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Reloaded "small\.ssjson"/i,
      { timeout: 30_000 },
    );
    await expect(session.page.getByText('External cell', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    await close(session);
    await rm(dir, { recursive: true, force: true });
  }
});

test('exports an Excel binary through the native save dialog', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-export-xlsx-'));
  const target = path.join(dir, 'export.xlsx');
  const session = await launch([path.join(FIXTURES, 'small.ssjson')]);
  try {
    await expect(session.page.getByTestId('status-message')).toContainText(/Imported "/, {
      timeout: 30_000,
    });
    await stubSaveDialog(session.app, target);
    await session.page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('simplesheets:export-excel'));
    });
    await expect
      .poll(async () => {
        try {
          const bytes = await readFile(target);
          return bytes.subarray(0, 2).toString('utf8');
        } catch {
          return '';
        }
      }, { timeout: 30_000 })
      .toBe('PK');
  } finally {
    await close(session);
    await rm(dir, { recursive: true, force: true });
  }
});

test('exports CSV through the native save dialog', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-export-'));
  const target = path.join(dir, 'export.csv');
  const session = await launch([path.join(FIXTURES, 'small.ssjson')]);
  try {
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Imported "/,
      { timeout: 30_000 },
    );
    await stubSaveDialog(session.app, target);
    await session.page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('simplesheets:export-csv'));
    });
    await expect
      .poll(async () => {
        try {
          return await readFile(target, 'utf8');
        } catch {
          return '';
        }
      }, { timeout: 30_000 })
      .toContain('Item,Q1');
  } finally {
    await close(session);
    await rm(dir, { recursive: true, force: true });
  }
});

test('a read-only target offers Save As instead of failing silently', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-readonly-'));
  const target = path.join(dir, 'readonly.ssjson');
  const replacement = path.join(dir, 'replacement.ssjson');
  await copyFile(path.join(FIXTURES, 'small.ssjson'), target);
  await chmod(target, 0o444);
  const session = await launch([target]);
  try {
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Imported "/,
      { timeout: 30_000 },
    );
    await stubSaveDialog(session.app, replacement);
    await stubMessageBox(session.app, 1); // Save As
    await session.page.keyboard.press('Control+s');
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Saved "replacement\.ssjson"/i,
      { timeout: 30_000 },
    );
    expect(JSON.parse(await readFile(replacement, 'utf8'))).toMatchObject({
      title: 'replacement',
    });
    expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  } finally {
    await chmod(target, 0o644).catch(() => undefined);
    await close(session);
    await rm(dir, { recursive: true, force: true });
  }
});
