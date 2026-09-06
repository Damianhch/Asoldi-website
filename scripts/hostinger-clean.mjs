import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Only dist/ copies. Never touch public/media or public/myphoner-audio. */
const DIST_LEFTOVERS = ['media', 'myphoner-audio', 'myphoner-recordings'];

export function cleanHostingerDist() {
  let removed = 0;
  for (const name of DIST_LEFTOVERS) {
    const target = path.join(root, 'dist', name);
    if (!existsSync(target)) continue;
    console.log(`Removing leftover dist/${name} (public/ originals stay)`);
    rmSync(target, { recursive: true, force: true });
    removed += 1;
  }
  console.log(
    removed
      ? `asoldi-website: removed ${removed} leftover dist media folder(s)`
      : 'asoldi-website: no leftover dist/media copies',
  );
}

cleanHostingerDist();
