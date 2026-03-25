import { readFileSync, writeFileSync, existsSync } from 'fs';
import { getDataFilePath, ensurePersistentDataDir } from './storage-path.js';

const TOKENS_PATH = getDataFilePath('reset-tokens.json');

function ensureDataDir() {
  ensurePersistentDataDir();
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
