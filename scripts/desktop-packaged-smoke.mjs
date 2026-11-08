// Launches the unpacked packaged build with an isolated profile and verifies
// that argv open, the native picker, and app:// loading all work packaged.
import { _electron as electron } from '@playwright/test';
import { access, copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const executablePath = path.resolve('release', 'win-unpacked', 'SimpleSheets.exe');
const smallFixture = path.resolve('tmp', 'desktop-fixtures', 'small.ssjson');
const unicodeFixture = path.resolve('tmp', 'desktop-fixtures', 'unicode.ssjson');
const workDir = await mkdtemp(path.join(os.tmpdir(), 'simplesheets-smoke-save-'));
const smallCopy = path.join(workDir, 'small.ssjson');
await copyFile(smallFixture, smallCopy);

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
const consoleMessages = [];
const externalRequests = [];
const electronApp = await electron.launch({
  executablePath,
  args: [smallCopy],
  timeout: 120_000,
  env: {
    ...process.env,
    SIMPLESHEETS_PROFILE: profile,
    SIMPLESHEETS_E2E: '1',
  },
});

electronApp.on('window', (page) => {
  page.on('console', (message) => consoleMessages.push(message.text()));
});

try {
  const window = await electronApp.firstWindow();
  await electronApp.evaluate(({ session }) => {
    globalThis.__simplesheetsRequests = [];
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (/^https?:/i.test(details.url)) {
        globalThis.__simplesheetsRequests.push(details.url);
      }
      callback({});
    });
  });
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

  // Security negative checks: permissions, window.open, traversal.
  const permission = await window.evaluate(() => {
    if (!navigator.geolocation) return Promise.resolve('unavailable');
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        () => resolve('denied'),
      );
    });
  });
  if (permission !== 'denied' && permission !== 'unavailable') {
    throw new Error(`permission request was not denied: ${permission}`);
  }
  const openedWindow = await window.evaluate(() => window.open('about:blank') !== null);
  if (openedWindow) throw new Error('window.open was not denied');
  const csp = await window.evaluate(async () => {
    const response = await fetch('app://simplesheets/index.html');
    return response.headers.get('content-security-policy') ?? '';
  });
  if (!csp.includes("default-src 'self'") || !csp.includes("object-src 'none'")) {
    throw new Error(`unexpected packaged CSP: ${csp}`);
  }
  const traversalStatuses = await window.evaluate(async () => {
    const first = await fetch('app://simplesheets/../package.json');
    const second = await fetch('app://simplesheets/assets/%2e%2e/%2e%2e/package.json');
    return [first.status, second.status];
  });
  if (traversalStatuses.some((status) => status === 200)) {
    throw new Error(`traversal request succeeded: ${JSON.stringify(traversalStatuses)}`);
  }

  // Packaged Save: writes the current path through the atomic writer.
  await window.keyboard.press('Control+s');
  await window
    .getByTestId('status-message')
    .filter({ hasText: 'Saved "small.ssjson"' })
    .waitFor({ timeout: 60_000 });
  const saved = JSON.parse(await readFile(smallCopy, 'utf8'));
  if (saved.title !== 'small' || !Array.isArray(saved.sheets)) {
    throw new Error(`unexpected saved workbook: ${JSON.stringify(saved.title)}`);
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

  if (consoleMessages.some((text) => /content security policy/i.test(text))) {
    throw new Error('packaged renderer reported a CSP violation');
  }

  // SEC-12: no external network traffic while idle.
  await window.waitForTimeout(30_000);
  const requests = await electronApp.evaluate(() => globalThis.__simplesheetsRequests ?? []);
  if (requests.length > 0) {
    throw new Error(`idle network requests detected: ${JSON.stringify(requests)}`);
  }

  console.log(`[smoke] packaged argv+picker/save/security OK: ${title} (${info.edition})`);
} finally {
  await electronApp.close();
  await rm(profile, { recursive: true, force: true });
  await rm(workDir, { recursive: true, force: true });
}
