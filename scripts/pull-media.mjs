/**
 * Pull the asoldi.com media library (audio/video that is no longer in Git)
 * into public/media so a fresh clone plays the same videos locally.
 *
 *   ASOLDI_ADMIN_USER=... ASOLDI_ADMIN_PASS=... npm run media:pull
 *   ASOLDI_ADMIN_TOKEN=<admin token> npm run media:pull
 *   npm run media:pull -- --origin http://localhost:3001 --all
 *
 * Only files missing locally are downloaded. `--all` also pulls images/PDFs;
 * by default only audio/video (the untracked kinds) are fetched.
 */
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_MEDIA = join(__dirname, '..', 'public', 'media');

const args = process.argv.slice(2);
const flag = (name) => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : '';
};
const origin = (flag('--origin') || process.env.ASOLDI_ORIGIN || 'https://asoldi.com').replace(/\/$/, '');
const pullAll = args.includes('--all');

async function resolveToken() {
  if (process.env.ASOLDI_ADMIN_TOKEN) return process.env.ASOLDI_ADMIN_TOKEN;
  const username = process.env.ASOLDI_ADMIN_USER;
  const password = process.env.ASOLDI_ADMIN_PASS;
  if (!username || !password) {
    throw new Error('Set ASOLDI_ADMIN_TOKEN, or ASOLDI_ADMIN_USER + ASOLDI_ADMIN_PASS.');
  }
  const res = await fetch(`${origin}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) throw new Error(`Login failed (${res.status}): ${data.message || 'no token'}`);
  return data.token;
}

const token = await resolveToken();
const list = await fetch(`${origin}/api/admin/media`, { headers: { Authorization: `Bearer ${token}` } });
const payload = await list.json().catch(() => ({}));
if (!list.ok) throw new Error(`Could not list media (${list.status}): ${payload.message || ''}`);

const items = (payload.items || []).filter((item) => pullAll || item.kind === 'audio' || item.kind === 'video');
let downloaded = 0;
let skipped = 0;
for (const item of items) {
  const target = join(PUBLIC_MEDIA, ...item.name.split('/'));
  if (existsSync(target) && statSync(target).size === item.size) {
    skipped += 1;
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  const res = await fetch(`${origin}${item.url}`);
  if (!res.ok || !res.body) {
    console.log(`skip ${item.name} (${res.status})`);
    continue;
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(target));
  downloaded += 1;
  console.log(`✓ ${item.name} (${(item.size / 1048576).toFixed(1)} MB)`);
}
console.log(`done — downloaded ${downloaded}, already present ${skipped}, total in library ${items.length}`);
