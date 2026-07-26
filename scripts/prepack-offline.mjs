// Prepares package.json for an offline `npm pack`.
//
// `npm pack` is blocked when `private: true`, and by default does NOT include
// `node_modules` in the tarball. For an offline package we need:
//   1. `private: false`        — so pack is allowed
//   2. `bundledDependencies`   — so npm includes node_modules in the .tgz
//   3. `files` listing         — so dist/ AND node_modules/ are both shipped
//
// The original package.json is saved to .package.json.bak and restored by
// postpack-offline.mjs, so the working tree is left clean after packing.

import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pkgPath = join(root, 'package.json');
const backupPath = join(root, '.package.json.bak');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

// Don't clobber an existing backup (means a previous pack crashed mid-flight).
if (existsSync(backupPath)) {
  console.warn('[prepack-offline] Removing stale backup from a previous run.');
  rmSync(backupPath);
}

// Save original so postpack can restore it.
writeFileSync(backupPath, JSON.stringify(pkg, null, 2) + '\n');

// 1. Allow packing.
pkg.private = false;

// 2. Bundle ALL production dependencies into the tarball.
pkg.bundledDependencies = Object.keys(pkg.dependencies || {});

// 3. Ensure both dist/ and node_modules/ are shipped.
const files = new Set(pkg.files || []);
files.add('dist');
files.add('node_modules');
pkg.files = [...files];

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log('[prepack-offline] package.json prepared for offline pack.');
console.log(`  bundledDependencies: ${pkg.bundledDependencies.length} packages`);
console.log(`  files: ${pkg.files.join(', ')}`);
