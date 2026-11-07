// Launches the unpacked packaged build with an isolated profile and verifies
// that argv open, the native picker, and app:// loading all work packaged.
import { _electron as electron } from '@playwright/test';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const executablePath = path.resolve('release', 'win-unpacked', 'SimpleSheets.exe');
const smallFixture = path.resolve('tmp', 'desktop-fixtures', 'small.ssjson');
const unicodeFixture = path.resolve('tmp', 'desktop-fixtures', 'unicode.ssjson');

for (const required of [executablePath, smallFixture, unicodeFixture]) {
  try {
    await access(required, constants.R_OK);
  } catch {
    console.error(`[smoke] missing required file: ${required}`);
    console.error('[smoke] run `npm run desktop:fixtures && npm run electron:build:dir` first.');
    process.exit(1);
  }
}

const profile = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-packaged-'));
console.log('[smoke] launching packaged build');
const electronApp = await electron.launch({
  executablePath,
  args: [smallFixture],
  timeout: 120_000,
  env: {
    ...process.env,
    SIMPLESHEETS_PROFILE: profile,
    SIMPLESHEETS_E2E: '1',
  },
});

try {
  const window = await electronApp.firstWindow();
  const title = await window.title();
  if (!/SimpleSheets/.test(title)) {
    throw new Error(`unexpected window title: ${title}`);
  }
  await window.locator('#root').waitFor({ state: 'visible', timeout: 60_000 });
  await window
    .getByTestId('status-message')
    .filter({ hasText: 'Imported "small"' })
    .waitFor({ timeout: 60_000 });
  await window
    .getByText('Item 1', { exact: true })
    .first()
    .waitFor({ timeout: 60_000 });

  const info = await window.evaluate(() => window.simplesheetsDesktop?.getAppInfo());
  if (!info || info.edition !== 'installed') {
    throw new Error(`unexpected edition: ${JSON.stringify(info)}`);
  }

  // Packaged picker path: stub the native dialog, then use Ctrl+O.
  await electronApp.evaluate(({ dialog }, target) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] });
  }, unicodeFixture);
  await window.bringToFront();
  await window.keyboard.press('Control+o');
  await window
    .getByText('こんにちは', { exact: true })
    .first()
    .waitFor({ timeout: 60_000 });

  console.log(`[smoke] packaged argv+picker open OK: ${title} (${info.edition})`);
} finally {
  await electronApp.close();
  await rm(profile, { recursive: true, force: true });
}
