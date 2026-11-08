// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  APP_ORIGIN,
  DEV_ORIGIN,
  isAllowedExternalUrl,
  isTrustedOrigin,
} from './appOrigin';

describe('isTrustedOrigin', () => {
  const allowed = [APP_ORIGIN, DEV_ORIGIN];

  it('accepts the packaged app origin with a path', () => {
    expect(isTrustedOrigin('app://simplesheets/index.html', allowed)).toBe(true);
  });

  it('accepts the development origin', () => {
    expect(isTrustedOrigin('http://localhost:3000/', allowed)).toBe(true);
  });

  it('rejects a lookalike app host', () => {
    expect(isTrustedOrigin('app://simplesheets.evil.com/index.html', allowed)).toBe(false);
  });

  it('rejects a lookalike development host', () => {
    expect(isTrustedOrigin('http://localhost:3000.evil.com/', allowed)).toBe(false);
  });

  it('rejects file and data URLs', () => {
    expect(isTrustedOrigin('file:///C:/secret.txt', allowed)).toBe(false);
    expect(isTrustedOrigin('data:text/html,<h1>x</h1>', allowed)).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isTrustedOrigin('not a url', allowed)).toBe(false);
    expect(isTrustedOrigin('', allowed)).toBe(false);
  });

  it('rejects null, wrong ports, and userinfo lookalikes', () => {
    expect(isTrustedOrigin('null', allowed)).toBe(false);
    expect(isTrustedOrigin('http://localhost:3001/', allowed)).toBe(false);
    expect(isTrustedOrigin('http://localhost:3000@evil.example/', allowed)).toBe(false);
    expect(isTrustedOrigin('app://simplesheets:444/index.html', allowed)).toBe(false);
  });

  it('rejects a development origin when only the app origin is trusted', () => {
    expect(isTrustedOrigin('http://localhost:3000/', [APP_ORIGIN])).toBe(false);
  });

  it('rejects an empty allowlist', () => {
    expect(isTrustedOrigin('app://simplesheets/index.html', [])).toBe(false);
  });
});

describe('isAllowedExternalUrl', () => {
  it.each([
    'https://simplesheets.mouseclick.au/',
    'http://localhost:3000/docs',
    'mailto:support@example.com',
  ])('allows %s', (url) => {
    expect(isAllowedExternalUrl(url)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<h1>x</h1>',
    'file:///C:/Windows/System32/calc.exe',
    'ftp://example.com/file',
    'not a url',
    '',
    ' javascript:alert(1)',
  ])('rejects %s', (url) => {
    expect(isAllowedExternalUrl(url)).toBe(false);
  });
});
