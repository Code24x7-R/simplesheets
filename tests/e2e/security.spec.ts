// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { access, copyFile, mkdtemp, rm, symlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FIXTURES = path.resolve('tmp', 'desktop-fixtures');

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
  await access(path.join(FIXTURES, 'small.ssjson'), constants.R_OK);
});

test('rejects unknown write fields and unapproved paths', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-security-'));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-security-files-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-security-outside-'));
  const target = path.join(dir, 'small.ssjson');
  const secret = path.join(outside, 'secret.ssjson');
  await copyFile(path.join(FIXTURES, 'small.ssjson'), target);
  await copyFile(path.join(FIXTURES, 'small.ssjson'), secret);
  const session = await launch(profile, [target]);
  try {
    await expect(session.page.getByText('Item 1', { exact: true })).toBeVisible();

    const extraField = await session.page.evaluate(async (filePath) => {
      const bridge = window.simplesheetsDesktop as unknown as {
        writeFile(request: Record<string, unknown>): Promise<{ ok: boolean; code?: string }>;
      };
      return bridge.writeFile({ path: filePath, data: '{}', expected: null, extra: true });
    }, target);
    expect(extraField.ok).toBe(false);
    expect(extraField.code).toBe('INVALID_ARGUMENT');

    const traversal = await session.page.evaluate(async (filePath) => {
      const bridge = window.simplesheetsDesktop as unknown as {
        writeFile(request: Record<string, unknown>): Promise<{ ok: boolean; code?: string }>;
      };
      return bridge.writeFile({ path: filePath, data: '{}', expected: null });
    }, path.join(dir, '..', path.basename(outside), 'secret.ssjson'));
    expect(traversal.ok).toBe(false);
    expect(traversal.code).toBe('NOT_ALLOWED');

    const link = path.join(dir, 'link.ssjson');
    let linkCreated = true;
    try {
      await symlink(secret, link, 'file');
    } catch {
      linkCreated = false;
    }
    if (linkCreated) {
      const symlinked = await session.page.evaluate(async (filePath) => {
        const bridge = window.simplesheetsDesktop as unknown as {
          writeFile(request: Record<string, unknown>): Promise<{ ok: boolean; code?: string }>;
        };
        return bridge.writeFile({ path: filePath, data: '{}', expected: null });
      }, link);
      expect(symlinked.ok).toBe(false);
      expect(symlinked.code).toBe('NOT_ALLOWED');
    }

    const recent = await session.page.evaluate(async (filePath) => {
      const bridge = window.simplesheetsDesktop as unknown as {
        openRecent(filePath: string): Promise<{ ok: boolean; code?: string }>;
      };
      return bridge.openRecent(filePath);
    }, secret);
    expect(recent.ok).toBe(false);
    expect(recent.code).toBe('NOT_ALLOWED');
  } finally {
    await session.app.close();
    await cleanupProfile(profile);
    await rm(dir, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
