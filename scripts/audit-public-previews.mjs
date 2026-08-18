#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
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

loadEnvFile(path.join(root, '.env'));
loadEnvFile(path.join(root, '.env.local'));
loadEnvFile(path.resolve('D:/Asoldi/website maker application/.env'));
loadEnvFile(path.resolve('D:/Asoldi/website maker application/.env.local'));

const base = String(process.env.PROD_ADMIN_URL || 'https://asoldi.com').replace(/\/+$/, '');
const username = String(process.env.PROD_ADMIN_USERNAME || process.env.ADMIN_USERNAME || 'asoldi.com').trim();
const password = String(
  process.env.PROD_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || process.env.ASOLDI_ADMIN_PASSWORD || ''
).trim();

async function login() {
  const res = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) throw new Error(body.message || `login failed ${res.status}`);
  return body.token;
}

function previewCssHealth(html = '') {
  const inlined = [...html.matchAll(/data-preview-css=["']([^"']+)["']/gi)].map((m) => m[1]);
  const hrefs = [...html.matchAll(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi)]
    .map((m) => m[0].match(/\bhref=["']([^"']+)["']/i)?.[1])
    .filter(Boolean)
    .filter((href) => !/^(https?:)?\/\//i.test(href) && !href.startsWith('data:'));
  return { inlined, hrefs };
}

async function checkUrl(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const html = await res.text();
  const health = previewCssHealth(html);
  const cssResults = [];
  for (const href of health.hrefs.slice(0, 8)) {
    const cssUrl = new URL(href, url.endsWith('/') ? url : `${url}/`).toString();
    const cssRes = await fetch(cssUrl, { redirect: 'follow' });
    const type = String(cssRes.headers.get('content-type') || '').toLowerCase();
    cssResults.push({
      href,
      status: cssRes.status,
      type,
      ok: cssRes.ok && type.includes('css') && !type.includes('html'),
    });
  }
  return {
    url,
    status: res.status,
    bytes: html.length,
    inlined: health.inlined.length,
    localCssLinks: health.hrefs.length,
    cssResults,
    styled: health.inlined.length > 0 || cssResults.some((row) => row.ok),
  };
}

const token = await login();
const headers = { Authorization: `Bearer ${token}` };
const salesRes = await fetch(`${base}/api/admin/sales?product=asoldi`, { headers });
const salesBody = await salesRes.json().catch(() => ({}));
const clients = Array.isArray(salesBody.clients) ? salesBody.clients : [];
const withSite = clients.filter(
  (client) =>
    String(client?.status || '') !== 'not-sold' &&
    (client?.websiteImport?.publicPreviewPublishedAt || client?.websiteImport?.importRoot || client?.makerRun?.runId)
);

console.log(`clients=${clients.length} withSite=${withSite.length}`);
for (const client of withSite) {
  const url = `${base}/sales-preview/${encodeURIComponent(client.id)}/`;
  const live = await checkUrl(url).catch((error) => ({ url, styled: false, error: error.message }));
  const runId = String(client?.makerRun?.runId || '');
  console.log(
    `${live.styled ? 'OK ' : 'BAD'} ${client.businessName} ${client.id} run=${runId || '-'} inlined=${live.inlined || 0} links=${live.localCssLinks || 0} http=${live.status || 0} ${live.error || ''}`
  );
  if (!live.styled && Array.isArray(live.cssResults)) {
    for (const row of live.cssResults) console.log(`    css ${row.status} ${row.href} ${row.type}`);
  }
}

const brokenIds = process.argv.slice(2);
for (const id of brokenIds) {
  const res = await fetch(`${base}/api/admin/sales/${encodeURIComponent(id)}/preview-files`, { headers });
  const body = await res.json().catch(() => ({}));
  const files = Array.isArray(body.files) ? body.files : [];
  const css = files.filter((file) => /\.css$/i.test(file.path));
  const js = files.filter((file) => /\.js$/i.test(file.path));
  const html = files.filter((file) => /\.html?$/i.test(file.path));
  console.log(`FILES ${id} count=${body.count} html=${html.length} css=${css.length} js=${js.length} root=${body.importRoot || ''}`);
  for (const file of css.slice(0, 20)) console.log(`    css ${file.size} ${file.path}`);
  if (!css.length) {
    for (const file of files.slice(0, 30)) console.log(`    file ${file.size} ${file.path}`);
  }
}
