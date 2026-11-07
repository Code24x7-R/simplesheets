// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { access, copyFile, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FIXTURES = path.resolve('tmp', 'desktop-fixtures');

function fixture(name: string): string {
  return path.join(FIXTURES, name);
}

interface Session {
  app: ElectronApplication;
  page: Page;
  profile: string;
}

async function launch(profile: string, extraArgs: string[] = []): Promise<Session> {
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

async function cleanupProfile(profile: string): Promise<void> {
  await rm(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
}

async function stubOpenDialog(app: ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, target) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] });
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

async function clickMenu(app: ElectronApplication, id: string): Promise<void> {
  await app.evaluate(({ Menu, BrowserWindow }, itemId) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById(itemId);
    if (!item) throw new Error(`Missing menu item: ${itemId}`);
    const window = BrowserWindow.getAllWindows()[0];
    item.click(undefined as never, window, undefined as never);
  }, id);
}

async function closeWindow(session: Session): Promise<void> {
  const closed = session.app.waitForEvent('close');
  await session.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.close();
  });
  await closed;
}

async function editFirstCell(session: Session, value: string): Promise<void> {
  await session.page.getByText('Item 1', { exact: true }).click();
  await session.page.keyboard.press('Delete');
  await session.page.keyboard.type(value);
  await session.page.keyboard.press('Enter');
  await expect(session.page.getByTestId('save-state')).toContainText(/Unsaved changes/);
}

test.beforeAll(async () => {
  await access(fixture('small.ssjson'), constants.R_OK);
  await access(fixture('unicode.ssjson'), constants.R_OK);
});

test('native menu exposes the required items and accelerators', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-menu-'));
  const session = await launch(profile);
  try {
    const menu = await session.app.evaluate(({ Menu }) => {
      const appMenu = Menu.getApplicationMenu();
      return appMenu?.items.map((item) => ({
        label: item.label,
        sub: item.submenu?.items.map((child) => ({
          id: child.id,
          label: child.label,
          accelerator: child.accelerator,
          enabled: child.enabled,
        })),
      }));
    });
    expect(menu?.map((item) => item.label)).toEqual(['File', 'Edit', 'View', 'Help']);
    const file = menu?.find((item) => item.label === 'File')?.sub ?? [];
    expect(file.map((item) => item.label)).toEqual(expect.arrayContaining([
      'New', 'Open…', 'Recent', 'Recover Unsaved Changes', 'Save', 'Save As…',
      'Import', 'Export', 'Exit',
    ]));
    expect(file.find((item) => item.id === 'file-save')?.accelerator).toBe('CmdOrCtrl+S');
    expect(file.find((item) => item.id === 'file-save-as')?.accelerator).toBe('CmdOrCtrl+Shift+S');
    const edit = menu?.find((item) => item.label === 'Edit')?.sub ?? [];
    expect(edit.find((item) => item.id === 'edit-find')?.accelerator).toBe('CmdOrCtrl+H');
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
  }
});

test('native menu Save routes to the existing save handler', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-menu-save-'));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-menu-target-'));
  const target = path.join(dir, 'small.ssjson');
  await copyFile(fixture('small.ssjson'), target);
  const session = await launch(profile, [target]);
  try {
    await expect(session.page.getByTestId('status-message')).toContainText(/Imported "small"/);
    await clickMenu(session.app, 'file-save');
    await expect(session.page.getByTestId('status-message')).toContainText(/Saved "small\.ssjson"/i);
    expect(JSON.parse(await readFile(target, 'utf8'))).toMatchObject({ title: 'small' });
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
    await rm(dir, { recursive: true, force: true });
  }
});

test('dirty close Cancel keeps the window, then Don’t Save closes', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-menu-close-'));
  const session = await launch(profile, [fixture('small.ssjson')]);
  try {
    await expect(session.page.getByText('Item 1', { exact: true })).toBeVisible();
    await editFirstCell(session, 'Unsaved close');
    await session.page.waitForTimeout(800);
    const menuStates = await session.app.evaluate(({ Menu }) => ({
      undo: Menu.getApplicationMenu()?.getMenuItemById('edit-undo')?.enabled,
      recover: Menu.getApplicationMenu()?.getMenuItemById('file-recover')?.enabled,
      save: Menu.getApplicationMenu()?.getMenuItemById('file-save')?.enabled,
    }));
    expect(menuStates).toEqual({ undo: true, recover: true, save: true });

    await stubMessageBox(session.app, 2);
    await session.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.close();
    });
    await session.page.waitForTimeout(500);
    expect(await session.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    await expect(session.page.getByTestId('save-state')).toContainText(/Unsaved changes/);

    await stubMessageBox(session.app, 1);
    await closeWindow(session);
    await new Promise((resolve) => setTimeout(resolve, 400));
    await expect(stat(path.join(profile, 'recovery.json'))).rejects.toThrow();
    const state = JSON.parse(await readFile(path.join(profile, 'state.json'), 'utf8')) as {
      cleanExit: boolean;
      windowBounds: { width: number } | null;
    };
    expect(state.cleanExit).toBe(true);
    expect(state.windowBounds?.width).toBeGreaterThan(0);
  } finally {
    await cleanupProfile(profile);
  }
});

test('dirty close Save writes the document and closes', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-menu-save-close-'));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-menu-save-target-'));
  const target = path.join(dir, 'small.ssjson');
  await copyFile(fixture('small.ssjson'), target);
  const session = await launch(profile, [target]);
  try {
    await expect(session.page.getByText('Item 1', { exact: true })).toBeVisible();
    await editFirstCell(session, 'Saved on close');
    await session.page.waitForTimeout(800);

    await stubMessageBox(session.app, 0);
    await closeWindow(session);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const saved = JSON.parse(await readFile(target, 'utf8')) as {
      sheets: Array<{ cells: Record<string, { rawValue: string }> }>;
    };
    expect(saved.sheets[0].cells['1:0'].rawValue).toBe('Saved on close');
    await expect(stat(path.join(profile, 'recovery.json'))).rejects.toThrow();
  } finally {
    await cleanupProfile(profile);
    await rm(dir, { recursive: true, force: true });
  }
});

test('replacing a dirty document can be cancelled or discarded', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-menu-open-dirty-'));
  const session = await launch(profile, [fixture('small.ssjson')]);
  try {
    await expect(session.page.getByText('Item 1', { exact: true })).toBeVisible();
    await editFirstCell(session, 'Keep this');
    await stubOpenDialog(session.app, fixture('unicode.ssjson'));

    await stubMessageBox(session.app, 2);
    await session.page.keyboard.press('Control+o');
    await session.page.waitForTimeout(800);
    await expect(session.page.getByText('Keep this', { exact: true })).toBeVisible();
    await expect(session.page.getByText('こんにちは', { exact: true })).toHaveCount(0);

    await stubMessageBox(session.app, 1);
    await session.page.keyboard.press('Control+o');
    await expect(session.page.getByText('こんにちは', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
  }
});


test('replacing a dirty document can save first', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-menu-open-save-'));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-menu-open-target-'));
  const target = path.join(dir, 'small.ssjson');
  await copyFile(fixture('small.ssjson'), target);
  const session = await launch(profile, [target]);
  try {
    await expect(session.page.getByText('Item 1', { exact: true })).toBeVisible();
    await editFirstCell(session, 'Save before open');
    await stubOpenDialog(session.app, fixture('unicode.ssjson'));
    await stubMessageBox(session.app, 0);
    await session.page.keyboard.press('Control+o');

    await expect(session.page.getByText('こんにちは', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    const saved = JSON.parse(await readFile(target, 'utf8')) as {
      sheets: Array<{ cells: Record<string, { rawValue: string }> }>;
    };
    expect(saved.sheets[0].cells['1:0'].rawValue).toBe('Save before open');
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
    await rm(dir, { recursive: true, force: true });
  }
});

test('window bounds restore after a clean close', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-menu-bounds-'));
  const first = await launch(profile, [fixture('small.ssjson')]);
  await first.page.waitForTimeout(500);
  await first.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setBounds({ x: 140, y: 90, width: 1000, height: 700 });
  });
  await closeWindow(first);

  const saved = JSON.parse(await readFile(path.join(profile, 'state.json'), 'utf8')) as {
    windowBounds: { x: number; y: number; width: number; height: number } | null;
  };
  expect(saved.windowBounds).toMatchObject({ x: 140, y: 90, width: 1000, height: 700 });

  const second = await launch(profile, [fixture('small.ssjson')]);
  try {
    const bounds = await second.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.getBounds(),
    );
    expect(bounds).toMatchObject({ x: 140, y: 90, width: 1000, height: 700 });
  } finally {
    await second.app.close();
    await cleanupProfile(profile);
  }
});

test('About opens from the native Help menu', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-menu-about-'));
  const session = await launch(profile);
  try {
    await clickMenu(session.app, 'help-about');
    await expect(session.page.getByRole('heading', { name: 'About SimpleSheets' })).toBeVisible();
    await expect(session.page.getByText(/Edition/i)).toBeVisible();
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
  }
});
