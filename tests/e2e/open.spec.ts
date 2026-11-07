// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
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

async function launch(extraArgs: string[] = []): Promise<Session> {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-e2e-'));
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

async function stubOpenDialog(app: ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, target) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] });
  }, filePath);
}

test.beforeAll(async () => {
  await access(fixture('small.ssjson'), constants.R_OK);
  await access(fixture('unicode.ssjson'), constants.R_OK);
  await access(fixture('corrupt.ssjson'), constants.R_OK);
  await access(fixture('small.csv'), constants.R_OK);
});

test('opens a fixture passed on the command line', async () => {
  const session = await launch([fixture('small.ssjson')]);
  try {
    await expect(session.page.getByTestId('status-message')).toContainText(
      /Imported "small"/,
      { timeout: 30_000 },
    );
  } finally {
    await close(session);
  }
});

test('opens a fixture selected in the native dialog', async () => {
  const session = await launch();
  try {
    await stubOpenDialog(session.app, fixture('unicode.ssjson'));
    await session.page.bringToFront();
    await session.page.keyboard.press('Control+o');
    await expect(session.page.getByText('こんにちは', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    await close(session);
  }
});


test('serializes two open intents behind the import scope dialog', async () => {
  const session = await launch([fixture('small.csv'), fixture('unicode.ssjson')]);
  try {
    const dialog = session.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(session.page.getByText('こんにちは', { exact: true })).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(session.page.getByText('こんにちは', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    await close(session);
  }
});

test('reports a corrupt file without replacing the UI', async () => {
  const session = await launch([fixture('corrupt.ssjson')]);
  try {
    await expect(session.page.getByTestId('status-message')).toContainText(/open error/i, {
      timeout: 30_000,
    });
    await expect(session.page.locator('#root > *').first()).toBeVisible();
  } finally {
    await close(session);
  }
});

test('opens a file dropped onto the window', async () => {
  const session = await launch();
  try {
    await session.page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'file';
      input.id = 'e2e-drop-input';
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
    });
    await session.page.setInputFiles('#e2e-drop-input', fixture('small.ssjson'));
    await session.page.evaluate(() => {
      const input = document.getElementById('e2e-drop-input') as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) throw new Error('no file selected');
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const dropZone = document.querySelector('[data-testid="grid-drop-zone"]');
      if (!dropZone) throw new Error('no drop zone');
      dropZone.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );
    });

    await expect(session.page.getByText('Item 1', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    await close(session);
  }
});

test('rejects a synthetic File with no OS path', async () => {
  const session = await launch();
  try {
    const result = await session.page.evaluate(async () => {
      const bridge = (
        window as unknown as {
          simplesheetsDesktop?: {
            openDroppedFile(file: File): Promise<{ ok: boolean; code?: string }>;
          };
        }
      ).simplesheetsDesktop;
      return bridge?.openDroppedFile(
        new File(['{}'], 'small.ssjson', { type: 'application/json' }),
      );
    });
    expect(result).toMatchObject({ ok: false, code: 'NO_PATH' });
  } finally {
    await close(session);
  }
});

test('a second instance opens its file in the existing window', async () => {
  const session = await launch();
  try {
    // app.process().spawnfile points at cmd.exe when Electron is launched via
    // node_modules/.bin; use the real executable so the lock is exercised.
    const electronBinary = path.resolve(
      'node_modules',
      'electron',
      'dist',
      'electron.exe',
    );
    const second = spawn(electronBinary, ['.', fixture('unicode.ssjson')], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SIMPLESHEETS_PROFILE: session.profile,
      },
      stdio: 'ignore',
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        second.kill();
        reject(new Error('second instance did not exit'));
      }, 20_000);
      second.on('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      second.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    await expect(session.page.getByText('こんにちは', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    await close(session);
  }
});

test('reports a missing file selected in the native dialog', async () => {
  const session = await launch();
  try {
    const missing = path.join(FIXTURES, 'does-not-exist.ssjson');
    await stubOpenDialog(session.app, missing);
    await session.page.bringToFront();
    await session.page.keyboard.press('Control+o');
    await expect(session.page.getByTestId('status-message')).toContainText(
      /no longer exists/i,
      { timeout: 30_000 },
    );
  } finally {
    await close(session);
  }
});
