// Generates build/icon.ico and build/icon.png from public/favicon.svg using
// ImageMagick. This is a development-time tool; ImageMagick is not a project
// dependency and is only required when regenerating the icon.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'public', 'favicon.svg');
const buildDir = join(root, 'build');
const sizes = [16, 24, 32, 48, 64, 128, 256];

if (!existsSync(source)) {
  console.error(`[icons] missing source artwork: ${source}`);
  process.exit(1);
}

try {
  execFileSync('magick', ['-version'], { stdio: 'ignore' });
} catch {
  console.error(
    '[icons] ImageMagick (`magick`) is required to generate icons.\n' +
      '        Install it, or commit the generated build/icon.ico and build/icon.png.',
  );
  process.exit(1);
}

mkdirSync(buildDir, { recursive: true });

const pngs = [];
for (const size of sizes) {
  const png = join(buildDir, `icon-${size}.png`);
  execFileSync('magick', [
    '-background', 'none',
    source,
    '-resize', `${size}x${size}`,
    png,
  ]);
  pngs.push(png);
}

execFileSync('magick', [...pngs, join(buildDir, 'icon.ico')]);
execFileSync('magick', [
  '-background', 'none',
  source,
  '-resize', '512x512',
  join(buildDir, 'icon.png'),
]);

for (const png of pngs) rmSync(png, { force: true });

console.log('[icons] wrote build/icon.ico and build/icon.png');
