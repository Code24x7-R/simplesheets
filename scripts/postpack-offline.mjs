// Restores the original package.json after an offline `npm pack`.
//
// npm runs `postpack` automatically after `pack` (and after a failed pack),
// so this is the correct lifecycle hook to undo prepack-offline.mjs.

import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pkgPath = join(root, 'package.json');
const backupPath = join(root, '.package.json.bak');

if (!existsSync(backupPath)) {
  console.warn('[postpack-offline] No backup found — package.json was not modified by prepack.');
  process.exit(0);
}

const original = readFileSync(backupPath, 'utf8');
writeFileSync(pkgPath, original);
rmSync(backupPath);

console.log('[postpack-offline] package.json restored to original state.');
