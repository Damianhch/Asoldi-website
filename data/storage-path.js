import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'fs';
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
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  writeFileSync(join(backupDir, `${fileName}.latest.json`), serialized, 'utf8');
  writeFileSync(join(backupDir, `${fileName}.${stamp}.json`), serialized, 'utf8');
}
