import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

function sanitizeText(value = '') {
  return String(value ?? '').trim();
}

export function looksLikeAssetFileName(value = '') {
  return /^[a-zA-Z0-9._-]+\.[a-zA-Z0-9]{2,8}$/.test(sanitizeText(value));
}

export function collectRelativeAssetRefs(text = '') {
  const refs = new Set();
  const push = (value = '') => {
    const raw = sanitizeText(value);
    if (!raw) return;
    if (/^localasset:\/\//i.test(raw)) {
      const id = raw.slice('localasset://'.length).split(/[?#]/)[0];
      if (looksLikeAssetFileName(id)) refs.add(`assets/${id}`);
      return;
    }
    const cleaned = raw.replace(/^\.\//, '').replace(/^\/+/, '').split(/[?#]/)[0];
    if (/^assets\//i.test(cleaned) && looksLikeAssetFileName(path.posix.basename(cleaned))) {
      refs.add(cleaned);
    }
  };
  const source = String(text || '');
  for (const match of source.matchAll(/(?:href|src|poster|data-src)=["']([^"']+)["']/gi)) push(match[1]);
  for (const match of source.matchAll(/url\(\s*["']?([^)"']+)["']?\s*\)/gi)) push(match[1]);
  for (const match of source.matchAll(/(?:srcset|data-srcset)=["']([^"']+)["']/gi)) {
    for (const part of String(match[1]).split(',')) push(part.trim().split(/\s+/)[0]);
  }
  return refs;
}

export function rewriteCssForStaticPreview(css = '') {
  return String(css || '')
    .replace(/localasset:\/\/([a-zA-Z0-9._-]+)/gi, '$1')
    .replace(
      /\/preview\/[^"'()\s]+\/(?:custom|step\/[^/'"]+)\/asset\?id=([a-zA-Z0-9._-]+)/gi,
      '$1'
    );
}

export function makerAssetFetchUrls({ makerBase, runId, exportStep = 'latest', assetPath = '' } = {}) {
  const base = sanitizeText(makerBase).replace(/\/+$/, '');
  const id = path.posix.basename(String(assetPath || '').replace(/^\/+/, ''));
  if (!base || !runId || !looksLikeAssetFileName(id)) return [];
  const stepRaw = sanitizeText(exportStep) || 'latest';
  const numeric = stepRaw.replace(/^step-/i, '');
  const urls = [
    `${base}/preview/${encodeURIComponent(runId)}/custom/asset?id=${encodeURIComponent(id)}`,
  ];
  const steps = [];
  if (numeric && numeric !== 'latest' && numeric !== 'custom') steps.push(numeric);
  for (const step of ['3', '2', '1.5', '1']) {
    if (!steps.includes(step)) steps.push(step);
  }
  for (const step of steps) {
    urls.push(
      `${base}/preview/${encodeURIComponent(runId)}/step/${encodeURIComponent(step)}/asset?id=${encodeURIComponent(id)}`
    );
  }
  return [...new Set(urls)];
}

export async function findPreviewFileByBasename(roots = [], fileName = '', { maxFiles = 800 } = {}) {
  const wanted = path.basename(sanitizeText(fileName));
  if (!wanted || wanted === '.' || wanted === '..') return '';
  const queue = [...roots].filter(Boolean).map((root) => path.resolve(root));
  const seen = new Set();
  let visited = 0;
  while (queue.length && visited < maxFiles) {
    const dir = queue.shift();
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      visited += 1;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        queue.push(abs);
        continue;
      }
      if (entry.isFile() && entry.name === wanted) return abs;
    }
  }
  return '';
}

export function assertImportedPreviewHasAssets(siteRoot, importDir = '') {
  const indexPath = path.join(siteRoot, 'index.html');
  if (!existsSync(indexPath)) {
    const error = new Error('Imported ZIP did not contain an index.html site root.');
    error.status = 502;
    throw error;
  }
  const html = readFileSync(indexPath, 'utf8');
  const missing = [...collectRelativeAssetRefs(html)].filter((ref) => {
    return !existsSync(path.join(siteRoot, ref)) && !(importDir && existsSync(path.join(importDir, ref)));
  });
  const critical = missing.filter((ref) => /\.(css|js)$/i.test(ref));
  if (!critical.length) return { missing, critical };
  const error = new Error(
    `Preview ZIP is missing the website's CSS/JS (${critical.slice(0, 6).join(', ')}). ` +
      'Refusing to replace a public preview with an unstyled HTML shell.'
  );
  error.status = 502;
  error.missing = critical;
  throw error;
}

export async function fillExportZipWithMakerAssets({
  makerBase,
  runId,
  exportStep = 'latest',
  zipBuffer,
  fetchImpl = fetch,
  headers = {},
} = {}) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const entryNames = new Set(entries.map((entry) => entry.entryName.replace(/\\/g, '/')));
  const htmlEntries = entries.filter((entry) => /\.html?$/i.test(entry.entryName));
  if (!htmlEntries.length) return { buffer: zipBuffer, added: 0, missing: [], note: 'no html' };

  const indexEntry =
    htmlEntries
      .filter((entry) => /(^|\/)index\.html$/i.test(entry.entryName))
      .sort((a, b) => a.entryName.split('/').length - b.entryName.split('/').length)[0] || htmlEntries[0];
  const indexName = indexEntry.entryName.replace(/\\/g, '/');
  const prefix = indexName.includes('/') ? indexName.slice(0, indexName.lastIndexOf('/') + 1) : '';

  const wanted = new Set();
  for (const entry of htmlEntries) {
    for (const ref of collectRelativeAssetRefs(entry.getData().toString('utf8'))) wanted.add(ref);
  }
  const missing = [...wanted].filter((ref) => !entryNames.has(`${prefix}${ref}`) && !entryNames.has(ref));
  if (!missing.length) return { buffer: zipBuffer, added: 0, missing: [], note: 'complete' };

  const tryUrl = async (url, assetPath) => {
    try {
      const response = await fetchImpl(url, {
        headers,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response?.ok) return null;
      const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
      if (!/\.html?$/i.test(assetPath) && contentType.includes('text/html')) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) return null;
      return { buffer, contentType };
    } catch {
      return null;
    }
  };

  const fetchAsset = async (assetPath) => {
    const urls = makerAssetFetchUrls({ makerBase, runId, exportStep, assetPath });
    for (const url of urls) {
      const found = await tryUrl(url, assetPath);
      if (found) return found;
    }
    return null;
  };

  let added = 0;
  const queue = [...missing];
  const seen = new Set(queue);
  const MAX_FILES = 500;
  while (queue.length && added < MAX_FILES) {
    const assetPath = queue.shift();
    const found = await fetchAsset(assetPath);
    if (!found) continue;
    let payload = found.buffer;
    if (/\.css$/i.test(assetPath) || String(found.contentType || '').includes('text/css')) {
      payload = Buffer.from(rewriteCssForStaticPreview(payload.toString('utf8')), 'utf8');
      const cssDir = assetPath.includes('/') ? assetPath.slice(0, assetPath.lastIndexOf('/') + 1) : '';
      for (const match of payload.toString('utf8').matchAll(/url\(\s*["']?([^)"']+)["']?\s*\)/gi)) {
        const raw = String(match[1] || '').trim().split(/[?#]/)[0];
        if (!raw || /^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('/')) continue;
        const resolved = path.posix.normalize(path.posix.join(cssDir, raw));
        if (resolved.startsWith('..')) continue;
        const asAssets = resolved.includes('/') ? resolved : `${cssDir}${resolved}`;
        if (!seen.has(asAssets) && !entryNames.has(`${prefix}${asAssets}`)) {
          seen.add(asAssets);
          queue.push(asAssets);
        }
      }
    }
    zip.addFile(`${prefix}${assetPath}`, payload);
    entryNames.add(`${prefix}${assetPath}`);
    added += 1;
  }

  const stillMissing = [...wanted].filter(
    (ref) => !entryNames.has(`${prefix}${ref}`) && !entryNames.has(ref) && /\.(css|js)$/i.test(ref)
  );
  if (stillMissing.length) {
    const error = new Error(
      `Export ZIP is missing CSS/JS (${stillMissing.slice(0, 6).join(', ')}) and Website Maker did not serve those files.`
    );
    error.status = 502;
    error.missing = stillMissing;
    throw error;
  }
  return {
    buffer: added ? zip.toBuffer() : zipBuffer,
    added,
    missing: stillMissing,
    note: added ? 'maker-asset-id' : 'complete',
  };
}
