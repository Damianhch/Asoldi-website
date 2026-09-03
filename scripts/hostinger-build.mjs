import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './hostinger-clean.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const distIndex = path.join(root, 'dist', 'index.html');
const stampPath = path.join(root, 'dist', '.asoldi-build-id');
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

function gitHead() {
  try {
    return execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const head = gitHead();
const stamp = existsSync(stampPath) ? readFileSync(stampPath, 'utf8').trim() : '';

// Skip only when this same commit already built dist (postinstall + later npm run build).
// A leftover dist/ from a previous deploy must not block a new commit.
if (head && stamp === head && existsSync(distIndex)) {
  console.log(`dist/ already built for ${head.slice(0, 7)}, skipping Vite`);
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  ['--max-old-space-size=1024', vite, 'build'],
  { stdio: 'inherit', cwd: root, env: process.env },
);

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

if (head) {
  writeFileSync(stampPath, `${head}\n`);
}

process.exit(0);
