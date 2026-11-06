// Writes a package.json beside the compiled Electron output so Node treats the
// emitted .js files as CommonJS even though the repo root is "type": "module".
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'dist-electron');

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
);

console.log('[electron] wrote dist-electron/package.json (CommonJS)');
