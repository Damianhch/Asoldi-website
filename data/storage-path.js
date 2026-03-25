import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEGACY_DATA_DIR = __dirname;
const PERSISTENT_DATA_DIR =
  (process.env.APP_DATA_DIR && process.env.APP_DATA_DIR.trim()) ||
  (process.env.DATA_DIR && process.env.DATA_DIR.trim()) ||
  join(process.cwd(), '.builds', 'data');

export function ensurePersistentDataDir() {
  if (!existsSync(PERSISTENT_DATA_DIR)) mkdirSync(PERSISTENT_DATA_DIR, { recursive: true });
}

export function getPersistentDataDir() {
  ensurePersistentDataDir();
  return PERSISTENT_DATA_DIR;
}

export function getDataFilePath(filename) {
  ensurePersistentDataDir();
  const persistentPath = join(PERSISTENT_DATA_DIR, filename);
  const legacyPath = join(LEGACY_DATA_DIR, filename);

  // One-time migration path for existing installs that previously wrote into repo/data.
  if (!existsSync(persistentPath) && existsSync(legacyPath)) {
    copyFileSync(legacyPath, persistentPath);
  }

  return persistentPath;
}
