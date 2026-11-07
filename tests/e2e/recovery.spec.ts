// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { access, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
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

async function close(session: Session): Promise<void> {
  await session.app.close();
}

async function cleanupProfile(profile: string): Promise<void> {
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 250,
  });
}

async function stubMessageBox(app: ElectronApplication, response: number): Promise<void> {
  await app.evaluate(({ dialog }, choice) => {
    dialog.showMessageBox = async () => ({
      response: choice,
      checkboxChecked: false,
    });
  }, response);
}

test.beforeAll(async () => {
  await access(fixture('small.ssjson'), constants.R_OK);
  await access(fixture('unicode.ssjson'), constants.R_OK);
});

test('clean exit reopens the last document', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-recovery-clean-'));
  try {
    const first = await launch(profile, [fixture('small.ssjson')]);
    await expect(first.page.getByText('Item 1', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await close(first);

    const second = await launch(profile);
    try {
      await expect(second.page.getByText('Item 1', { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(second.page.getByTestId('status-message')).toContainText(/Imported "small"/);
    } finally {
      await close(second);
    }
  } finally {
    await cleanupProfile(profile);
  }
});

async function seedInterruptedSession(profile: string, workbook: unknown): Promise<void> {
  const small = fixture('small.ssjson');
  const state = {
    schemaVersion: 1,
    recents: [
      {
        id: 'seed-recent',
        name: 'small.ssjson',
        size: 1024,
        timestamp: Date.now(),
        source: 'local',
        path: small,
        canReopen: true,
      },
    ],
    lastPath: small,
    lastDirectory: path.dirname(small),
    reopenLast: true,
    cleanExit: false,
    legacyImported: true,
  };
  const recovery = {
    schemaVersion: 1,
    timestamp: Date.now(),
    appVersion: '0.1.0',
    path: small,
    displayName: 'small',
    workbook,
  };
  await writeFile(path.join(profile, 'state.json'), JSON.stringify(state));
  await writeFile(path.join(profile, 'recovery.json'), JSON.stringify(recovery));
}

test('editing writes a recovery snapshot that survives a dirty close', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-recovery-write-'));
  try {
    const session = await launch(profile, [fixture('small.ssjson')]);
    await expect(session.page.getByText('Item 1', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await session.page.getByText('Item 1', { exact: true }).click();
    await session.page.keyboard.press('Delete');
    await session.page.keyboard.type('Persisted Edit');
    await session.page.keyboard.press('Enter');
    await expect(session.page.getByTestId('save-state')).toContainText(/Unsaved changes/);
    await session.page.waitForTimeout(1500);

    const recoveryRaw = await readFile(path.join(profile, 'recovery.json'), 'utf8');
    expect(recoveryRaw).toContain('Persisted Edit');
    await close(session);
    await expect(stat(path.join(profile, 'recovery.json'))).resolves.toBeTruthy();
    const state = JSON.parse(await readFile(path.join(profile, 'state.json'), 'utf8')) as {
      cleanExit: boolean;
    };
    expect(state.cleanExit).toBe(false);
  } finally {
    await cleanupProfile(profile);
  }
});


test('unclean startup without an explicit intent prompts Recover', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-recovery-auto-'));
  try {
    const workbook = JSON.parse(await readFile(fixture('small.ssjson'), 'utf8')) as {
      sheets: Array<{ cells: Record<string, { rawValue: string }> }>;
    };
    workbook.sheets[0].cells['1:0'].rawValue = 'Auto Recovered';
    await seedInterruptedSession(profile, workbook);

    const app = await electron.launch({
      args: ['.'],
      env: { ...process.env, SIMPLESHEETS_PROFILE: profile } as Record<string, string>,
    });
    await stubMessageBox(app, 0);
    const page = await app.firstWindow();
    await page.locator('#root > *').first().waitFor({ state: 'visible', timeout: 30_000 });
    try {
      await expect(page.getByText('Auto Recovered', { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByTestId('save-state')).toContainText(/Unsaved changes/);
    } finally {
      await app.close();
    }
  } finally {
    await cleanupProfile(profile);
  }
});


test('Discard in the startup prompt opens the last document', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-recovery-discard-auto-'));
  try {
    const workbook = JSON.parse(await readFile(fixture('small.ssjson'), 'utf8')) as {
      sheets: Array<{ cells: Record<string, { rawValue: string }> }>;
    };
    workbook.sheets[0].cells['1:0'].rawValue = 'Not this one';
    await seedInterruptedSession(profile, workbook);

    const app = await electron.launch({
      args: ['.'],
      env: { ...process.env, SIMPLESHEETS_PROFILE: profile } as Record<string, string>,
    });
    await stubMessageBox(app, 1);
    const page = await app.firstWindow();
    await page.locator('#root > *').first().waitFor({ state: 'visible', timeout: 30_000 });
    try {
      await expect(page.getByText('Item 1', { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText('Not this one', { exact: true })).toHaveCount(0);
      await expect(stat(path.join(profile, 'recovery.json'))).rejects.toThrow();
    } finally {
      await app.close();
    }
  } finally {
    await cleanupProfile(profile);
  }
});

test('a missing last document is cleared without an open error', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-recovery-missing-'));
  try {
    const missing = path.join(profile, 'gone.ssjson');
    const state = {
      schemaVersion: 1,
      recents: [
        {
          id: 'missing',
          name: 'gone.ssjson',
          size: 1,
          timestamp: Date.now(),
          source: 'local',
          path: missing,
          canReopen: true,
        },
      ],
      lastPath: missing,
      lastDirectory: profile,
      reopenLast: true,
      cleanExit: true,
      legacyImported: true,
    };
    await writeFile(path.join(profile, 'state.json'), JSON.stringify(state));

    const session = await launch(profile);
    try {
      await expect(session.page.getByTestId('status-message')).not.toContainText(/Open error/i);
      await session.page.waitForTimeout(500);
    } finally {
      await close(session);
    }
    const saved = JSON.parse(await readFile(path.join(profile, 'state.json'), 'utf8')) as {
      lastPath: string | null;
    };
    expect(saved.lastPath).toBeNull();
  } finally {
    await cleanupProfile(profile);
  }
});

test('explicit open wins over recovery and Recover applies the snapshot', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-recovery-crash-'));
  try {
    const workbook = JSON.parse(await readFile(fixture('small.ssjson'), 'utf8')) as {
      sheets: Array<{ cells: Record<string, { rawValue: string }> }>;
    };
    workbook.sheets[0].cells['1:0'].rawValue = 'Recovered Edit';
    await seedInterruptedSession(profile, workbook);

    const session = await launch(profile, [fixture('unicode.ssjson')]);
    try {
      await expect(session.page.getByText('こんにちは', { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      const banner = session.page.getByTestId('recovery-banner');
      await expect(banner).toBeVisible({ timeout: 30_000 });
      await expect(banner).toContainText(/Unsaved changes/);

      await stubMessageBox(session.app, 0);
      await banner.getByRole('button', { name: 'Recover' }).click();
      await expect(session.page.getByText('Recovered Edit', { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(session.page.getByTestId('save-state')).toContainText(/Unsaved changes/);
      await expect(session.page.getByTestId('status-message')).toContainText(
        /Recovered "small \(Recovered\)"/,
      );
      await expect(banner).toHaveCount(0);
      await expect(stat(path.join(profile, 'recovery.json'))).rejects.toThrow();
    } finally {
      await close(session);
    }
  } finally {
    await cleanupProfile(profile);
  }
});

test('Discard removes the recovery snapshot and keeps the explicit document', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-recovery-discard-'));
  try {
    const workbook = JSON.parse(await readFile(fixture('small.ssjson'), 'utf8')) as {
      sheets: Array<{ cells: Record<string, { rawValue: string }> }>;
    };
    workbook.sheets[0].cells['1:0'].rawValue = 'Discard me';
    await seedInterruptedSession(profile, workbook);

    const session = await launch(profile, [fixture('unicode.ssjson')]);
    try {
      await expect(session.page.getByText('こんにちは', { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      const banner = session.page.getByTestId('recovery-banner');
      await expect(banner).toBeVisible({ timeout: 30_000 });
      await banner.getByRole('button', { name: 'Discard' }).click();
      await expect(banner).toHaveCount(0);
      await expect(session.page.getByText('こんにちは', { exact: true })).toBeVisible();
      await expect(stat(path.join(profile, 'recovery.json'))).rejects.toThrow();
    } finally {
      await close(session);
    }
  } finally {
    await cleanupProfile(profile);
  }
});
