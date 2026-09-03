import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Vite used to copy public/ into dist. Leftover copies fill Hostinger's disk quota (errno 122). */
const DIST_LEFTOVERS = ['media', 'myphoner-audio', 'myphoner-recordings'];

export function cleanHostingerDist() {
  for (const name of DIST_LEFTOVERS) {
    const target = path.join(root, 'dist', name);
    if (!existsSync(target)) continue;
    console.log(`Removing leftover dist/${name} (Hostinger disk quota)`);
    rmSync(target, { recursive: true, force: true });
  }
}

cleanHostingerDist();
