import { existsSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, unlinkSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEGACY_DATA_DIR = __dirname;
const HOME_DATA_DIR = join(homedir(), '.asoldi-website-data');
const OLD_BUILD_DATA_DIR = join(process.cwd(), '.builds', 'data');
const OLD_CWD_DATA_DIR = join(process.cwd(), 'data');
const PERSISTENT_DATA_DIR =
  (process.env.APP_DATA_DIR && process.env.APP_DATA_DIR.trim()) ||
  (process.env.DATA_DIR && process.env.DATA_DIR.trim()) ||
  HOME_DATA_DIR;

const STAMPED_BACKUP_RE = /^(.*)\.(\d{4}-\d{2}-\d{2}T.+)\.json$/;

function getLegacyCandidates(filename) {
  return [
    join(PERSISTENT_DATA_DIR, filename),
    join(OLD_BUILD_DATA_DIR, filename),
    join(OLD_CWD_DATA_DIR, filename),
    join(LEGACY_DATA_DIR, filename),
  ];
}

export function ensurePersistentDataDir() {
  if (!existsSync(PERSISTENT_DATA_DIR)) mkdirSync(PERSISTENT_DATA_DIR, { recursive: true });
}

export function getPersistentDataDir() {
  ensurePersistentDataDir();
  return PERSISTENT_DATA_DIR;
}

function getBackupDir() {
  const backupDir = join(PERSISTENT_DATA_DIR, 'backups');
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

export function getDataBackupDir() {
  return getBackupDir();
}

export function resolveDataBackupKeep(override) {
  if (Number.isFinite(override) && override >= 0) return Math.min(Math.floor(override), 50);
  const raw = process.env.DATA_BACKUP_KEEP;
  if (raw === undefined || raw === '') return 5;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 5;
  return Math.min(parsed, 50);
}

function sourceFileNameFromBackup(backupName) {
  if (backupName.endsWith('.latest.json')) {
    return backupName.slice(0, -'.latest.json'.length);
  }
  const match = backupName.match(STAMPED_BACKUP_RE);
  return match ? match[1] : '';
}

function listBackupNames(backupDir) {
  if (!existsSync(backupDir)) return [];
  try {
    return readdirSync(backupDir);
  } catch {
    return [];
  }
}

function unlinkQuiet(filePath) {
  try {
    unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

export function pruneDataBackupsForFile(fileName, { keep, backupDir } = {}) {
  const name = String(fileName || '').trim();
  if (!name) return { removed: 0, kept: 0 };
  const dir = backupDir || getBackupDir();
  const resolvedKeep = resolveDataBackupKeep(keep);
  const latestName = `${name}.latest.json`;
  const stamped = listBackupNames(dir)
    .filter((entry) => entry !== latestName && sourceFileNameFromBackup(entry) === name)
    .sort();

  const extra = resolvedKeep <= 0 ? stamped : stamped.slice(0, Math.max(0, stamped.length - resolvedKeep));
  let removed = 0;
  for (const entry of extra) {
    if (unlinkQuiet(join(dir, entry))) removed += 1;
  }
  return { removed, kept: stamped.length - removed };
}

export function pruneAllDataBackups({ keep } = {}) {
  const backupDir = getBackupDir();
  const resolvedKeep = resolveDataBackupKeep(keep);
  const sources = new Set();
  for (const entry of listBackupNames(backupDir)) {
    const source = sourceFileNameFromBackup(entry);
    if (source) sources.add(source);
  }
  let removed = 0;
  let kept = 0;
  for (const source of sources) {
    const result = pruneDataBackupsForFile(source, { keep: resolvedKeep, backupDir });
    removed += result.removed;
    kept += result.kept;
  }
  return { backupDir, keep: resolvedKeep, sources: sources.size, removed, kept };
}

export function getDataFilePath(filename) {
  ensurePersistentDataDir();
  const persistentPath = join(PERSISTENT_DATA_DIR, filename);

  // One-time migration path for existing installs that previously wrote inside
  // repo-local or build-local folders.
  if (!existsSync(persistentPath)) {
    for (const candidatePath of getLegacyCandidates(filename)) {
      if (!existsSync(candidatePath) || candidatePath === persistentPath) continue;
      copyFileSync(candidatePath, persistentPath);
      break;
    }
  }

  return persistentPath;
}

export function writeDataJson(filePath, data) {
  ensurePersistentDataDir();
  const serialized = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  writeFileSync(filePath, serialized, 'utf8');

  const backupDir = getBackupDir();
  const fileName = basename(filePath);
  const latestPath = join(backupDir, `${fileName}.latest.json`);
  const keep = resolveDataBackupKeep();

  // Free inodes before writing another snapshot — Hostinger plans cap file count.
  pruneDataBackupsForFile(fileName, { keep, backupDir });

  let previousLatest = '';
  if (existsSync(latestPath)) {
    try {
      previousLatest = readFileSync(latestPath, 'utf8');
    } catch {
      previousLatest = '';
    }
  }

  writeFileSync(latestPath, serialized, 'utf8');

  if (keep > 0 && serialized !== previousLatest) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    writeFileSync(join(backupDir, `${fileName}.${stamp}.json`), serialized, 'utf8');
    pruneDataBackupsForFile(fileName, { keep, backupDir });
  }
}
