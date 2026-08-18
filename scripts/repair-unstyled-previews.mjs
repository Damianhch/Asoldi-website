#!/usr/bin/env node
/**
 * Repair public asoldi.com previews that are unstyled HTML shells.
 * Re-export from a local Maker run when possible, otherwise recover CSS
 * from original template origins still present in the snapshot HTML.
 * Validates each ZIP locally so a bad upload cannot wipe a live preview.
 */
import { existsSync, readFileSync, readdirSync, rmSync, statSync, mkdtempSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import AdmZip from 'adm-zip';
import {
  assertImportedPreviewHasAssets,
  mergePreviewAssetsIntoSiteRoot,
  persistInlinedStylesheets,
  recoverMissingStylesheets,
} from '../lib/preview-bundle-assets.js';
import { resolveImportedSiteRoot } from '../lib/sales-preview-import.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const asoldiRoot = path.resolve(__dirname, '..');
const makerRoot = path.resolve(asoldiRoot, '..', '..', 'website maker application');

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

loadEnvFile(path.join(asoldiRoot, '.env'));
loadEnvFile(path.join(makerRoot, '.env'));
loadEnvFile(path.join(makerRoot, '.env.local'));

const { exportRunForHostinger } = await import(
  pathToFileURL(path.join(makerRoot, 'lib', 'hostinger-export.mjs')).href
);

function normalizeName(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function login() {
  const base = String(process.env.PROD_ADMIN_URL || 'https://asoldi.com').replace(/\/+$/, '');
  const username = String(process.env.PROD_ADMIN_USERNAME || process.env.ADMIN_USERNAME || 'asoldi.com').trim();
  const password = String(
    process.env.PROD_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || process.env.ASOLDI_ADMIN_PASSWORD || ''
  ).trim();
  const res = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) throw new Error(body.message || `login failed ${res.status}`);
  return { base, token: body.token };
}

function listLocalHtmlRuns() {
  const runsRoot = path.join(makerRoot, '.generated-runs');
  if (!existsSync(runsRoot)) return [];
  const rows = [];
  for (const name of readdirSync(runsRoot)) {
    const dir = path.join(runsRoot, name);
    const runPath = path.join(dir, 'run.json');
    if (!existsSync(runPath)) continue;
    const run = readJson(runPath);
    const htmlCandidates = [
      path.join(dir, 'custom', 'site', 'index.html'),
      path.join(dir, 'custom', 'index.html'),
      path.join(dir, 'step-3', 'index.html'),
      path.join(dir, 'step-2', 'index.html'),
      path.join(dir, 'step-1.5', 'index.html'),
      path.join(dir, 'step-1', 'index.html'),
    ];
    const html = htmlCandidates.find((filePath) => existsSync(filePath));
    if (!html) continue;
    rows.push({
      runId: name,
      salesClientId: String(run?.metadata?.salesClientId || '').trim(),
      businessName: String(run?.answers?.businessName || '').trim(),
      mtime: statSync(html).mtimeMs,
    });
  }
  return rows.sort((a, b) => b.mtime - a.mtime);
}

function matchRun(client, localRuns) {
  const byId = localRuns.find((entry) => entry.salesClientId && entry.salesClientId === client.id);
  if (byId) return byId;
  const prodRunId = String(client?.makerRun?.runId || '').trim();
  if (prodRunId) {
    const byRun = localRuns.find((entry) => entry.runId === prodRunId);
    if (byRun) return byRun;
  }
  const target = normalizeName(client.businessName);
  if (!target || target.length < 4) return null;
  return localRuns.find((entry) => normalizeName(entry.businessName) === target) || null;
}

function previewStyled(html = '') {
  return /<style[^>]*data-preview-css=/i.test(html);
}

async function zipPassesCurrentIngest(zipBuffer, siteFolder = '') {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'preview-zip-'));
  try {
    new AdmZip(zipBuffer).extractAllTo(tmp, true);
    const siteRoot = await resolveImportedSiteRoot(tmp, siteFolder);
    if (!siteRoot) return { ok: false, error: 'ZIP has no index.html' };
    await mergePreviewAssetsIntoSiteRoot(siteRoot, tmp);
    await persistInlinedStylesheets(siteRoot, [siteRoot, tmp]);
    assertImportedPreviewHasAssets(siteRoot, tmp);
    const html = readFileSync(path.join(siteRoot, 'index.html'), 'utf8');
    if (!previewStyled(html)) return { ok: false, error: 'ZIP still has no inlined CSS' };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function postZip({ base, token, clientId, zipBuffer, runId, step, siteFolder }) {
  const check = await zipPassesCurrentIngest(zipBuffer, siteFolder);
  if (!check.ok) return { ok: false, status: 0, payload: { message: check.error } };
  const res = await fetch(`${base}/api/admin/sales/${encodeURIComponent(clientId)}/import-website-push`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/zip',
      'x-run-id': runId || '',
      'X-Source-Run-Id': runId || '',
      'x-export-step': step || 'latest',
      'X-Source-Step': step || 'latest',
      'x-site-folder': siteFolder || 'site',
      'X-Site-Folder': siteFolder || 'site',
    },
    body: zipBuffer,
  });
  const payload = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, payload };
}

async function publishFromMaker({ client, runId, token, base }) {
  const siteFolder = String(client.businessName || 'site').replace(/[^\w.-]+/g, '-') || 'site';
  const report = await exportRunForHostinger({
    runId,
    step: 'latest',
    baseUrl: `https://asoldi.com/sales-preview/${encodeURIComponent(client.id)}/`,
    siteFolder,
    createBackup: false,
    exportRootBase: path.join(makerRoot, '.generated-runs', '.api-exports'),
    workspaceRoot: makerRoot,
  });
  try {
    const zipBuffer = readFileSync(report.zipPath);
    return postZip({
      base,
      token,
      clientId: client.id,
      zipBuffer,
      runId,
      step: report.step,
      siteFolder,
    });
  } finally {
    if (report.exportRoot) rmSync(report.exportRoot, { recursive: true, force: true });
  }
}

function publicRel(filePath, importRoot) {
  const posix = String(filePath || '').replace(/\\/g, '/');
  const folder = path.posix.basename(String(importRoot || '').replace(/\\/g, '/'));
  if (folder && (posix === folder || posix.startsWith(`${folder}/`))) {
    return posix.slice(folder.length).replace(/^\//, '') || 'index.html';
  }
  return posix;
}

async function repairFromLiveSnapshot({ client, base, token }) {
  const filesRes = await fetch(`${base}/api/admin/sales/${encodeURIComponent(client.id)}/preview-files`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const filesBody = await filesRes.json().catch(() => ({}));
  const files = Array.isArray(filesBody.files) ? filesBody.files : [];
  if (!files.length) return { ok: false, error: 'no snapshot files on asoldi.com' };
  const zip = new AdmZip();
  let recoveredAny = false;
  for (const file of files) {
    const rel = publicRel(file.path, filesBody.importRoot);
    if (!rel || rel.endsWith('.htaccess')) continue;
    const url = `${base}/sales-preview/${encodeURIComponent(client.id)}/${rel.replace(/^\/+/, '')}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    let buffer = Buffer.from(await res.arrayBuffer());
    if (/\.html?$/i.test(rel)) {
      const before = buffer.toString('utf8');
      const after = await recoverMissingStylesheets(before);
      if (after !== before) recoveredAny = true;
      buffer = Buffer.from(after, 'utf8');
    }
    zip.addFile(rel, buffer);
  }
  if (!recoveredAny) return { ok: false, error: 'could not recover CSS from original template URLs' };
  const siteFolder = path.posix.basename(String(filesBody.importRoot || '').replace(/\\/g, '/')) || 'site';
  return postZip({
    base,
    token,
    clientId: client.id,
    zipBuffer: zip.toBuffer(),
    runId: String(client?.makerRun?.runId || ''),
    step: 'recovered',
    siteFolder,
  });
}

const { base, token } = await login();
const headers = { Authorization: `Bearer ${token}` };
const salesRes = await fetch(`${base}/api/admin/sales?product=asoldi`, { headers });
const salesBody = await salesRes.json().catch(() => ({}));
const clients = (Array.isArray(salesBody.clients) ? salesBody.clients : []).filter(
  (client) => String(client?.status || '') !== 'not-sold'
);
const localRuns = listLocalHtmlRuns();

console.log(`Repairing public previews for ${clients.length} sales clients`);
let ok = 0;
let failed = 0;
let skipped = 0;
for (const client of clients) {
  const url = `${base}/sales-preview/${encodeURIComponent(client.id)}/`;
  const live = await fetch(url).catch(() => null);
  const html = live?.ok ? await live.text() : '';
  if (live?.ok && previewStyled(html)) {
    console.log(`OK  ${client.businessName} already styled`);
    ok += 1;
    continue;
  }
  const local = matchRun(client, localRuns);
  try {
    if (local) {
      try {
        const published = await publishFromMaker({ client, runId: local.runId, token, base });
        const check = await fetch(url).then((res) => res.text()).catch(() => '');
        const styled = published.ok && previewStyled(check);
        if (styled) {
          console.log(`LIVE ${client.businessName} from Maker ${local.runId} (${published.status})`);
          ok += 1;
          continue;
        }
        console.log(
          `WARN ${client.businessName} Maker export did not style live preview (${published.status}) ${published.payload?.message || ''}`
        );
      } catch (error) {
        console.log(`WARN ${client.businessName} Maker export failed: ${error.message}`);
      }
    }
    if (live?.ok) {
      const repaired = await repairFromLiveSnapshot({ client, base, token });
      const check = await fetch(url).then((res) => res.text()).catch(() => '');
      const styled = repaired.ok && previewStyled(check);
      console.log(
        `${styled ? 'LIVE' : 'ERR'} ${client.businessName} recovered CSS (${repaired.status || 0}) ${repaired.error || repaired.payload?.message || ''}`
      );
      if (styled) ok += 1;
      else failed += 1;
      continue;
    }
    skipped += 1;
    console.log(`SKIP ${client.businessName} no local HTML and no public snapshot (run Step 1 in Maker)`);
  } catch (error) {
    failed += 1;
    console.log(`ERR ${client.businessName} ${error.message}`);
  }
}
console.log(`Done. styled=${ok} failed=${failed} skipped=${skipped}`);
if (failed) process.exitCode = 1;
