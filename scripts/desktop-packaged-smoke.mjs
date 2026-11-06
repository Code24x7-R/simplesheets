// Launches the unpacked packaged build with an isolated profile and verifies
// that the renderer loads from app://. Run after `npm run electron:build:dir`.
import { _electron as electron } from '@playwright/test';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const executablePath = path.resolve('release', 'win-unpacked', 'SimpleSheets.exe');

try {
  await access(executablePath, constants.X_OK);
} catch {
  console.error(`[smoke] packaged app not found at ${executablePath}`);
  console.error('[smoke] run `npm run electron:build:dir` first.');
  process.exit(1);
}

const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-packaged-'));
const electronApp = await electron.launch({
  executablePath,
  args: [],
  env: {
    ...process.env,
    SIMPLESHEETS_PROFILE: profile,
  },
});

try {
  const window = await electronApp.firstWindow();
  const title = await window.title();
  if (!/SimpleSheets/.test(title)) {
    throw new Error(`unexpected window title: ${title}`);
  }
  await window.locator('#root').waitFor({ state: 'visible', timeout: 30_000 });
  const childCount = await window.locator('#root > *').count();
  if (childCount === 0) {
    throw new Error('renderer root is empty');
  }
  const info = await window.evaluate(() => window.simplesheetsDesktop?.getAppInfo());
  if (!info || info.edition !== 'installed') {
    throw new Error(`unexpected edition: ${JSON.stringify(info)}`);
  }
  console.log(`[smoke] packaged app loaded: ${title} (${info.edition})`);
} finally {
  await electronApp.close();
  await rm(profile, { recursive: true, force: true });
}
