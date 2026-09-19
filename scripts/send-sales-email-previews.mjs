import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

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

loadEnvFile(resolve('C:/Asoldi/asoldi code/website-maker/.env.local'));
loadEnvFile(resolve('C:/Asoldi/asoldi code/asoldi-website/.env'));
loadEnvFile(resolve('C:/Asoldi/asoldi code/asoldi-website/.env.local'));

const prodUrl = String(process.env.PROD_ADMIN_URL || 'https://asoldi.com').replace(/\/$/, '');
const username = process.env.PROD_ADMIN_USERNAME || process.env.ADMIN_USERNAME || 'asoldi.com';
const password = process.env.PROD_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
const to = process.argv[2] || 'daracha777@gmail.com';

if (!password) {
  throw new Error('Set PROD_ADMIN_PASSWORD to send preview emails from production.');
}

const login = await fetch(`${prodUrl}/api/admin/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password }),
});
const loginBody = await login.json().catch(() => ({}));
if (!login.ok || !loginBody.token) {
  throw new Error(`Admin login failed (${login.status}): ${loginBody.message || 'no token'}`);
}

const response = await fetch(`${prodUrl}/api/admin/sales/preview-send-emails`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${loginBody.token}`,
  },
  body: JSON.stringify({ to }),
});
const body = await response.json().catch(() => ({}));
if (!response.ok) {
  throw new Error(`Preview send failed (${response.status}): ${body.message || JSON.stringify(body)}`);
}

console.log(JSON.stringify({
  ok: body.ok,
  to: body.to,
  count: Array.isArray(body.sent) ? body.sent.length : 0,
  subjects: (body.sent || []).map((row) => row.subject),
}, null, 2));
