/**
 * Runs at the start of `npm install` on Hostinger (Express Default has no
 * separate build step, so a full disk dies with a 0-line Build log).
 *
 * Frees leftover Vite copies under dist/ only. Never touches public/,
 * ~/.asoldi-website-data, or Sales recordings.
 */
import { existsSync, rmSync, statfsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_LEFTOVERS = ['media', 'myphoner-audio', 'myphoner-recordings'];

function posix(p) {
  return String(p || '').replace(/\\/g, '/');
}

function isHostingerClone(dir) {
  const n = posix(dir);
  if (process.env.HOSTINGER) return true;
  // Hostinger Node.js web apps: ~/domains/{domain}/nodejs
  if (/\/domains\/[^/]+\/nodejs\/?$/i.test(n)) return true;
  return false;
}

function logFree(label) {
  try {
    const s = statfsSync(root);
    const freeGb = (Number(s.bavail) * Number(s.bsize)) / 1024 ** 3;
    console.log(`asoldi.com preinstall ${label}: ${freeGb.toFixed(2)} GB free`);
  } catch {
    console.log(`asoldi.com preinstall ${label}: free-space unknown`);
  }
}

function removeDir(rel) {
  const target = path.join(root, ...rel.split('/'));
  if (!existsSync(target)) return false;
  console.log(`asoldi.com preinstall: removing ${rel} (not public/, not user data)`);
  rmSync(target, { recursive: true, force: true });
  return true;
}

console.log(`asoldi.com preinstall: cwd=${root}`);
logFree('before');

let removed = 0;
for (const name of DIST_LEFTOVERS) {
  if (removeDir(`dist/${name}`)) removed += 1;
}
console.log(
  removed
    ? `asoldi.com preinstall: removed ${removed} leftover dist media folder(s)`
    : 'asoldi.com preinstall: no leftover dist/media copies',
);

if (isHostingerClone(root)) {
  if (removeDir('node_modules')) {
    console.log('asoldi.com preinstall: cleared node_modules so npm can extract into the freed space');
  }
} else {
  console.log('asoldi.com preinstall: not a Hostinger nodejs clone; leaving node_modules');
}

logFree('after');
console.log('asoldi.com preinstall: done');
