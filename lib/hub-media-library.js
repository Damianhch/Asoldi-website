/**
 * asoldi.com media library.
 *
 * Files live OUTSIDE the app folder — `<persistent data dir>/media/` — so a
 * GitHub auto-deploy (which replaces `nodejs/`) never touches them. They are
 * served at `/media/<name>`, the same URL scheme the React pages and the
 * ansatt Lydklipp player already use, so a file uploaded here works anywhere a
 * `public/media/...` file used to. `public/media` stays as a read-only
 * fallback for the small images that are still tracked in Git.
 *
 * Metadata (alt text, tags, who uploaded) is a small JSON index next to the
 * files. The index is optional: files copied onto the disk by hand or by the
 * migration script show up without an entry.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync } from 'fs';
import { basename, extname, join, posix, relative, resolve, sep } from 'path';
import { getDataFilePath, getPersistentDataDir, writeDataJson } from '../data/storage-path.js';

export const MEDIA_URL_PREFIX = '/media';
export const MEDIA_INDEX_FILE = 'media-library.json';

/** Whitelist — anything else is refused at upload time. */
export const MEDIA_EXTENSIONS = {
  image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg'],
  video: ['.mp4', '.webm', '.mov', '.m4v'],
  audio: ['.mp3', '.wav', '.m4a', '.ogg', '.flac'],
  document: ['.pdf'],
};

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.pdf': 'application/pdf',
};

export function mediaKindForName(name = '') {
  const ext = extname(String(name || '')).toLowerCase();
  for (const [kind, list] of Object.entries(MEDIA_EXTENSIONS)) {
    if (list.includes(ext)) return kind;
  }
  return 'other';
}

export function mediaMimeForName(name = '') {
  return MIME_BY_EXT[extname(String(name || '')).toLowerCase()] || 'application/octet-stream';
}

export function isAllowedMediaName(name = '') {
  return mediaKindForName(name) !== 'other';
}

export function readMediaMaxBytes(env = process.env) {
  const mb = Number(env.HUB_MEDIA_MAX_MB || 300);
  return Math.max(1, Number.isFinite(mb) ? mb : 300) * 1024 * 1024;
}

export function hubMediaDir() {
  const dir = join(getPersistentDataDir(), 'media');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Turn an uploaded file name into something safe to put on disk and in a URL.
 * Keeps the extension, replaces whitespace with `-`, drops everything that is
 * not `[A-Za-z0-9._-]`. Norwegian letters are transliterated so URLs stay
 * ASCII. Existing files (with spaces) are never renamed — only new uploads
 * pass through here.
 */
export function sanitizeMediaFileName(original = '') {
  const raw = basename(String(original || '').trim()).replace(/\\/g, '/');
  const ext = extname(raw).toLowerCase();
  let stem = raw.slice(0, raw.length - ext.length);
  stem = stem
    .normalize('NFKD')
    .replace(/æ/gi, (m) => (m === 'Æ' ? 'AE' : 'ae'))
    .replace(/ø/gi, (m) => (m === 'Ø' ? 'O' : 'o'))
    .replace(/å/gi, (m) => (m === 'Å' ? 'A' : 'a'))
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  if (!stem) stem = `file-${Date.now()}`;
  return `${stem}${ext}`;
}

/** Optional sub-folder for uploads: one level, safe characters only. */
export function sanitizeMediaFolder(folder = '') {
  const clean = String(folder || '')
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.trim().replace(/[^A-Za-z0-9._-]/g, '').replace(/^\.+$/, ''))
    .filter(Boolean)
    .slice(0, 2);
  return clean.join('/');
}

/**
 * Resolve a library-relative name (`x.mp4`, `client-flow/x.png`) to an
 * absolute path inside `root`, refusing traversal. Returns '' when unsafe.
 */
export function resolveMediaPath(root, name = '') {
  const rel = String(name || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel || rel.includes('\0')) return '';
  if (rel.split('/').some((part) => part === '..' || part === '')) return '';
  const abs = resolve(root, rel);
  const rootAbs = resolve(root);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + sep)) return '';
  return abs;
}

function walk(root, dir, out, depth = 0) {
  if (depth > 3) return;
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(root, abs, out, depth + 1);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!isAllowedMediaName(entry.name)) continue;
    let stat;
    try {
      stat = statSync(abs);
    } catch {
      continue;
    }
    const rel = relative(root, abs).split(sep).join(posix.sep);
    out.set(rel, { name: rel, size: stat.size, mtimeMs: stat.mtimeMs });
  }
}

function indexPath() {
  return getDataFilePath(MEDIA_INDEX_FILE);
}

export function readMediaIndex() {
  const file = indexPath();
  if (!existsSync(file)) return { items: {} };
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return { items: parsed && typeof parsed.items === 'object' && parsed.items ? parsed.items : {} };
  } catch {
    return { items: {} };
  }
}

export function writeMediaIndex(index) {
  writeDataJson(indexPath(), { items: index?.items || {} });
}

function encodeUrl(name) {
  return `${MEDIA_URL_PREFIX}/${name.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * List everything the site can serve under /media: disk (persistent) first,
 * then the Git-tracked `public/media` fallback. `source` tells the admin UI
 * where each file lives during the transition off Git.
 */
export function listHubMedia({ publicMediaDir = '' } = {}) {
  const diskRoot = hubMediaDir();
  const disk = new Map();
  walk(diskRoot, diskRoot, disk);
  const git = new Map();
  if (publicMediaDir && existsSync(publicMediaDir)) walk(publicMediaDir, publicMediaDir, git);
  const meta = readMediaIndex().items;

  const names = new Set([...disk.keys(), ...git.keys()]);
  const items = [];
  for (const name of names) {
    const onDisk = disk.get(name);
    const inGit = git.get(name);
    const file = onDisk || inGit;
    const m = meta[name] || {};
    items.push({
      name,
      url: encodeUrl(name),
      size: file.size,
      kind: mediaKindForName(name),
      mime: mediaMimeForName(name),
      alt: String(m.alt || ''),
      tags: Array.isArray(m.tags) ? m.tags : [],
      uploadedBy: String(m.uploadedBy || ''),
      createdAt: m.createdAt || new Date(file.mtimeMs).toISOString(),
      source: onDisk && inGit ? 'both' : onDisk ? 'disk' : 'git',
    });
  }
  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || a.name.localeCompare(b.name));
  return items;
}

export function getHubMediaItem(name, options = {}) {
  return listHubMedia(options).find((item) => item.name === name) || null;
}

/** Record a finished upload in the index (multer already wrote the file). */
export function registerHubMediaUpload({ name, uploadedBy = '', alt = '', tags = [] }) {
  const index = readMediaIndex();
  const existing = index.items[name] || {};
  index.items[name] = {
    ...existing,
    alt: String(alt || existing.alt || ''),
    tags: normalizeTags(tags.length ? tags : existing.tags),
    uploadedBy: String(uploadedBy || existing.uploadedBy || ''),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeMediaIndex(index);
  return index.items[name];
}

export function updateHubMediaMeta(name, { alt, tags } = {}) {
  const index = readMediaIndex();
  const existing = index.items[name] || { createdAt: new Date().toISOString() };
  index.items[name] = {
    ...existing,
    ...(alt !== undefined ? { alt: String(alt || '') } : {}),
    ...(tags !== undefined ? { tags: normalizeTags(tags) } : {}),
    updatedAt: new Date().toISOString(),
  };
  writeMediaIndex(index);
  return index.items[name];
}

/**
 * Delete the disk copy. A file that only exists in Git cannot be removed from
 * here (it would come back on the next deploy) — the caller gets `git-only`.
 */
export function deleteHubMedia(name) {
  const root = hubMediaDir();
  const abs = resolveMediaPath(root, name);
  if (!abs) return { ok: false, reason: 'invalid-name' };
  if (!existsSync(abs)) return { ok: false, reason: 'git-only' };
  unlinkSync(abs);
  const index = readMediaIndex();
  if (index.items[name]) {
    delete index.items[name];
    writeMediaIndex(index);
  }
  return { ok: true };
}

/** Rename within the library (same folder). Refuses to overwrite. */
export function renameHubMedia(name, nextBaseName) {
  const root = hubMediaDir();
  const from = resolveMediaPath(root, name);
  if (!from || !existsSync(from)) return { ok: false, reason: 'not-found' };
  const folder = name.includes('/') ? name.slice(0, name.lastIndexOf('/')) : '';
  const safe = sanitizeMediaFileName(nextBaseName);
  if (!isAllowedMediaName(safe) || extname(safe).toLowerCase() !== extname(name).toLowerCase()) {
    return { ok: false, reason: 'bad-name' };
  }
  const nextName = folder ? `${folder}/${safe}` : safe;
  const to = resolveMediaPath(root, nextName);
  if (!to) return { ok: false, reason: 'bad-name' };
  if (existsSync(to)) return { ok: false, reason: 'exists' };
  renameSync(from, to);
  const index = readMediaIndex();
  if (index.items[name]) {
    index.items[nextName] = { ...index.items[name], updatedAt: new Date().toISOString() };
    delete index.items[name];
    writeMediaIndex(index);
  }
  return { ok: true, name: nextName };
}

export function normalizeTags(tags) {
  const list = Array.isArray(tags) ? tags : String(tags || '').split(',');
  const out = [];
  for (const tag of list) {
    const clean = String(tag || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9æøå_-]/g, '')
      .slice(0, 32);
    if (clean && !out.includes(clean)) out.push(clean);
  }
  return out.slice(0, 12);
}

/** Pick a free file name in `dir` for `safeName` unless override is allowed. */
export function pickUploadTarget(dir, safeName, { override = false } = {}) {
  if (override) return safeName;
  if (!existsSync(join(dir, safeName))) return safeName;
  const ext = extname(safeName);
  const stem = safeName.slice(0, safeName.length - ext.length);
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${stem}-${i}${ext}`;
    if (!existsSync(join(dir, candidate))) return candidate;
  }
  return `${stem}-${Date.now()}${ext}`;
}
