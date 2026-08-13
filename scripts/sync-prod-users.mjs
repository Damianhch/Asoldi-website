#!/usr/bin/env node
/**
 * Copy Admin → Users metadata from live asoldi.com into a local/LAN users.json.
 *
 * Production passwords cannot be read over the public API (hashes stay on Hostinger).
 * Existing local hashes are kept when the username already exists. New users get
 * LAN_USER_SYNC_PASSWORD (or ADMIN_PASSWORD).
 *
 * Usage:
 *   node scripts/sync-prod-users.mjs --out "$HOME/.asoldi-website-data/users.json"
 *   node scripts/sync-prod-users.mjs --out C:\hosted\asoldi-data\users.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { homedir } from 'os';
import bcrypt from 'bcryptjs';

const DEFAULT_PROD_URL = 'https://asoldi.com';
const DEFAULT_OUT = resolve(homedir(), '.asoldi-website-data', 'users.json');

function argValue(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || !process.argv[idx + 1]) return fallback;
  return process.argv[idx + 1];
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === '') process.env[key] = value;
  }
}

function readJsonArray(filePath) {
  if (!existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function adminLogin(baseUrl, username, password) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) {
    throw new Error(`Admin login failed (${res.status}): ${body.message || 'no token'}`);
  }
  return body.token;
}

async function fetchProdUsers(baseUrl, token) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => []);
  if (!res.ok || !Array.isArray(body)) {
    throw new Error(`Fetch users failed (${res.status})`);
  }
  return body;
}

function publicToRecord(user, passwordHash) {
  const role = String(user.role || 'none').toLowerCase();
  const record = {
    id: String(user.id),
    username: String(user.username),
    passwordHash,
    createdAt: user.createdAt || new Date().toISOString(),
    role,
  };
  if (role === 'employee' && user.employeeProduct) {
    record.employeeProduct = user.employeeProduct;
  }
  return record;
}

async function main() {
  const cwd = process.cwd();
  loadEnvFile(resolve(cwd, '.env.local'));
  loadEnvFile(resolve(cwd, '.env'));

  const prodUrl = argValue('--from', process.env.PROD_ADMIN_URL || DEFAULT_PROD_URL);
  const outPath = resolve(argValue('--out', process.env.APP_DATA_DIR ? resolve(process.env.APP_DATA_DIR, 'users.json') : DEFAULT_OUT));
  const username = process.env.PROD_ADMIN_USERNAME || process.env.ADMIN_USERNAME || 'asoldi.com';
  const password = process.env.PROD_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  const newUserPassword = process.env.LAN_USER_SYNC_PASSWORD || password;

  if (!password) {
    throw new Error('Set PROD_ADMIN_PASSWORD or ADMIN_PASSWORD (same credentials as asoldi.com/admin).');
  }
  if (!newUserPassword) {
    throw new Error('Set LAN_USER_SYNC_PASSWORD for newly created LAN users.');
  }

  const token = await adminLogin(prodUrl, username, password);
  const prodUsers = await fetchProdUsers(prodUrl, token);
  const existing = readJsonArray(outPath);
  const byUsername = new Map(existing.map((u) => [String(u.username || '').toLowerCase(), u]));

  const next = [];
  let keptHash = 0;
  let hashedNew = 0;
  for (const user of prodUsers) {
    const prev = byUsername.get(String(user.username).toLowerCase());
    let passwordHash = prev?.passwordHash;
    if (typeof passwordHash === 'string' && passwordHash.startsWith('$2')) {
      keptHash += 1;
    } else {
      passwordHash = await bcrypt.hash(newUserPassword, 12);
      hashedNew += 1;
    }
    next.push(publicToRecord(user, passwordHash));
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');

  console.log(`Synced ${next.length} users from ${prodUrl} → ${outPath}`);
  console.log(`Kept existing password hashes: ${keptHash}; new LAN hashes: ${hashedNew}`);
  for (const user of next) {
    const product = user.employeeProduct ? ` / ${user.employeeProduct}` : '';
    console.log(`- ${user.username} (${user.role}${product})`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
