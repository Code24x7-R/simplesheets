// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import path from 'node:path';
import { mimeTypeForPath, resolveAppAssetPath } from './assetPath';

const distDir = path.resolve('C:/app/resources/app.asar/dist');

describe('resolveAppAssetPath', () => {
  it('maps the origin root to index.html', () => {
    expect(resolveAppAssetPath('app://simplesheets/', distDir)).toBe(
      path.join(distDir, 'index.html'),
    );
    expect(resolveAppAssetPath('app://simplesheets', distDir)).toBe(
      path.join(distDir, 'index.html'),
    );
  });

  it('resolves assets and ignores query strings and fragments', () => {
    expect(
      resolveAppAssetPath('app://simplesheets/assets/index-abc123.js?v=1', distDir),
    ).toBe(path.join(distDir, 'assets', 'index-abc123.js'));
    expect(
      resolveAppAssetPath('app://simplesheets/index.html#/sheet/1', distDir),
    ).toBe(path.join(distDir, 'index.html'));
  });

  it('rejects a different scheme or host', () => {
    expect(resolveAppAssetPath('http://simplesheets/index.html', distDir)).toBeNull();
    expect(resolveAppAssetPath('app://evil/index.html', distDir)).toBeNull();
  });

  it.each([
    'app://simplesheets/../secret.txt',
    'app://simplesheets/%2e%2e/secret.txt',
    'app://simplesheets/assets/%2E%2E/%2E%2E/secret.txt',
  ])('keeps dot-segment payload %s inside dist', (url) => {
    const resolved = resolveAppAssetPath(url, distDir);
    // The URL parser collapses dot segments before we see them; the result
    // must still resolve inside dist rather than escaping it.
    expect(resolved).not.toBeNull();
    expect(resolved?.startsWith(distDir + path.sep)).toBe(true);
  });

  it.each([
    'app://simplesheets/..%5csecret.txt',
    'app://simplesheets/assets/%00.js',
    'app://simplesheets/assets%5csecret.txt',
  ])('rejects encoded path payload %s', (url) => {
    expect(resolveAppAssetPath(url, distDir)).toBeNull();
  });

  it('rejects malformed encoding and URLs', () => {
    expect(resolveAppAssetPath('app://simplesheets/%E0%A4%A', distDir)).toBeNull();
    expect(resolveAppAssetPath('not a url', distDir)).toBeNull();
  });

  it('returns null for an empty allowlist-like invalid host', () => {
    expect(resolveAppAssetPath('app://', distDir)).toBeNull();
  });
});

describe('mimeTypeForPath', () => {
  it.each([
    ['index.html', 'text/html; charset=utf-8'],
    ['index-abc.js', 'text/javascript; charset=utf-8'],
    ['index.css', 'text/css; charset=utf-8'],
    ['favicon.svg', 'image/svg+xml'],
    ['icon.ico', 'image/x-icon'],
    ['font.woff2', 'font/woff2'],
    ['data.json', 'application/json; charset=utf-8'],
  ])('maps %s', (file, mime) => {
    expect(mimeTypeForPath(file)).toBe(mime);
  });

  it('defaults to octet-stream for unknown extensions', () => {
    expect(mimeTypeForPath('archive.bin')).toBe('application/octet-stream');
    expect(mimeTypeForPath('LICENSE')).toBe('application/octet-stream');
  });

  it('is case-insensitive', () => {
    expect(mimeTypeForPath('INDEX.HTML')).toBe('text/html; charset=utf-8');
  });
});
