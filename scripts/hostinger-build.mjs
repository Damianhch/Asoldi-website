import { existsSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanHostingerDist } from './hostinger-clean.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

cleanHostingerDist();

if (!existsSync(vite)) {
  console.error('Vite is not installed. Run this on a machine with npm install (devDependencies).');
  process.exit(1);
}

for (const name of ['assets', 'index.html']) {
  const target = path.join(root, 'dist', name);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}

const result = spawnSync(
  process.execPath,
  ['--max-old-space-size=4096', vite, 'build'],
  {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production' },
  },
);

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

writeFileSync(path.join(root, 'dist', '.asoldi-prebuilt'), 'prebuilt on maker, not on Hostinger\n');
process.exit(0);
