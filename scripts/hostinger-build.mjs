import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const distIndex = path.join(root, 'dist', 'index.html');
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

if (existsSync(distIndex)) {
  console.log('dist/ already built, skipping Vite');
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  ['--max-old-space-size=1024', vite, 'build'],
  { stdio: 'inherit', cwd: root, env: process.env },
);

process.exit(result.status ?? 1);
