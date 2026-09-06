import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Only dist/ copies. Never touch public/media or public/myphoner-audio. */
const DIST_LEFTOVERS = ['media', 'myphoner-audio', 'myphoner-recordings'];

export function cleanHostingerDist() {
  for (const name of DIST_LEFTOVERS) {
    const target = path.join(root, 'dist', name);
    if (!existsSync(target)) continue;
    console.log(`Removing leftover dist/${name} (duplicate of public/, not the live files)`);
    rmSync(target, { recursive: true, force: true });
  }
}

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  cleanHostingerDist();
}
