import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const TOKENS_PATH = join(DATA_DIR, 'reset-tokens.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readTokens() {
  ensureDataDir();
  if (!existsSync(TOKENS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeTokens(tokens) {
  ensureDataDir();
  writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), 'utf8');
}

const EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export function saveResetToken(token, userId, username) {
  const tokens = readTokens();
  tokens[token] = { userId, username, expiresAt: Date.now() + EXPIRY_MS };
  writeTokens(tokens);
}

export function consumeResetToken(token) {
  const tokens = readTokens();
  const entry = tokens[token];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    delete tokens[token];
    writeTokens(tokens);
    return null;
  }
  delete tokens[token];
  writeTokens(tokens);
  return entry;
}
