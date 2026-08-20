import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import {
  assertImportedPreviewHasAssets,
  mergePreviewAssetsIntoSiteRoot,
  persistInlinedStylesheets,
  persistRecoveredStylesheets,
} from './preview-bundle-assets.js';
import { rewriteMakerPreviewRefs } from './laptop-preview.js';

export const PUBLIC_PREVIEW_ORIGIN = 'https://asoldi.com';

export function sanitizePreviewText(value = '') {
  return String(value ?? '').trim();
}

export function slugifyPreviewName(value = '') {
  const slug = sanitizePreviewText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  return slug.slice(0, 80);
}

export function getPublicPreviewOrigin() {
  const explicit = sanitizePreviewText(process.env.SALES_PREVIEW_PUBLIC_BASE || process.env.SALES_PREVIEW_ORIGIN);
  if (explicit) {
    try {
      const parsed = new URL(explicit);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return `${parsed.protocol}//${parsed.host}`;
      }
    } catch {
      // Fall through to the public production origin.
    }
  }
  return PUBLIC_PREVIEW_ORIGIN;
}

export function getSalesPreviewPath(clientId, slug = '') {
  const id = sanitizePreviewText(clientId);
  const pretty = slugifyPreviewName(slug);
  if (pretty) return `/sales-preview/${encodeURIComponent(pretty)}/`;
  if (!id) return '';
  return `/sales-preview/${encodeURIComponent(id)}/`;
}

export function getPublicSalesPreviewUrl(client = null, { pretty = false } = {}) {
  if (!client?.id) return '';
  const slug = pretty ? sanitizePreviewText(client.websiteImport?.previewSlug) || slugifyPreviewName(client.businessName) : '';
  const previewPath = getSalesPreviewPath(client.id, pretty ? slug : '');
  if (!previewPath) return '';
  // Always share the internet URL. LAN `/sales-preview/:id` still works locally
  // once files are imported, but laptops off the office network need asoldi.com.
  return `${getPublicPreviewOrigin()}${previewPath}`;
}

export function allocatePreviewSlug(client, allClients = []) {
  const base = slugifyPreviewName(client?.businessName) || slugifyPreviewName(client?.id) || 'client';
  const others = Array.isArray(allClients) ? allClients : [];
  const taken = new Set(
    others
      .filter((entry) => sanitizePreviewText(entry?.id) && sanitizePreviewText(entry.id) !== sanitizePreviewText(client?.id))
      .map((entry) => slugifyPreviewName(entry?.websiteImport?.previewSlug || entry?.businessName))
      .filter(Boolean)
  );
  if (!taken.has(base)) return base;
  const suffix = sanitizePreviewText(client?.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toLowerCase();
  return suffix ? `${base}-${suffix}` : `${base}-site`;
}

export function findSalesClientForPreviewParam(param, sales) {
  const raw = sanitizePreviewText(param);
  if (!raw || !sales) return null;
  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();
  const byId = sales.getSalesClientById(decoded) || sales.getSalesClientById(raw);
  if (byId) return byId;
  const slug = slugifyPreviewName(decoded);
  if (!slug) return null;
  const list = sales.getSalesClients();
  const exactSlug = list.find((entry) => slugifyPreviewName(entry?.websiteImport?.previewSlug) === slug);
  if (exactSlug) return exactSlug;
  const nameMatches = list.filter((entry) => slugifyPreviewName(entry?.businessName) === slug);
  if (nameMatches.length === 1) return nameMatches[0];
  return null;
}

export async function resolveImportedSiteRoot(importDir, preferredSiteFolder = '') {
  const preferred = preferredSiteFolder ? path.join(importDir, preferredSiteFolder) : '';
  if (preferred && existsSync(path.join(preferred, 'index.html'))) return preferred;
  if (existsSync(path.join(importDir, 'index.html'))) return importDir;

  const entries = await fs.readdir(importDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(importDir, entry.name);
    if (existsSync(path.join(candidate, 'index.html'))) return candidate;
  }
  return '';
}

async function persistMakerPreviewRefRewrite(siteRoot) {
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        await walk(abs);
        continue;
      }
      if (!entry.isFile() || !/\.(html?|css)$/i.test(entry.name)) continue;
      const before = await fs.readFile(abs, 'utf8');
      const after = rewriteMakerPreviewRefs(before, { rootAbsolute: false });
      if (after !== before) await fs.writeFile(abs, after, 'utf8');
    }
  }
  await walk(siteRoot);
}

export async function resolveSalesPreviewRoot(client, importsRoot) {
  if (!client?.id) return '';
  const stored = sanitizePreviewText(client?.websiteImport?.importRoot);
  if (stored) {
    const abs = path.resolve(stored);
    if (existsSync(path.join(abs, 'index.html'))) return abs;
  }
  const importDir = path.join(importsRoot, client.id);
  if (!existsSync(importDir)) return '';
  return resolveImportedSiteRoot(importDir, sanitizePreviewText(client?.websiteImport?.siteFolder));
}

export async function materializePreviewZip(zipBuffer, {
  importsRoot,
  clientId,
  siteFolder = '',
  fetchImpl = fetch,
} = {}) {
  const id = sanitizePreviewText(clientId);
  if (!id) {
    const error = new Error('Sales client not found.');
    error.status = 404;
    throw error;
  }
  const buffer = Buffer.isBuffer(zipBuffer) ? zipBuffer : Buffer.from(zipBuffer || []);
  if (!buffer.length) {
    const error = new Error('Website preview ZIP was empty.');
    error.status = 400;
    throw error;
  }

  let zip;
  try {
    zip = new AdmZip(buffer);
    assertSafeZipEntries(zip);
  } catch (error) {
    if (error?.status) throw error;
    const wrapped = new Error('Website preview is not a valid ZIP archive.');
    wrapped.status = 502;
    throw wrapped;
  }

  const dest = path.join(importsRoot, id);
  const staging = path.join(importsRoot, `.incoming-${id}-${Date.now()}`);
  await fs.mkdir(staging, { recursive: true });
  let backup = '';
  try {
    zip.extractAllTo(staging, true);
    const stagingSiteRoot = await resolveImportedSiteRoot(staging, siteFolder);
    if (!stagingSiteRoot) {
      const error = new Error('Imported ZIP did not contain an index.html site root.');
      error.status = 502;
      throw error;
    }
    await mergePreviewAssetsIntoSiteRoot(stagingSiteRoot, staging);
    await persistMakerPreviewRefRewrite(stagingSiteRoot);
    await persistInlinedStylesheets(stagingSiteRoot, [stagingSiteRoot, staging]);
    await persistRecoveredStylesheets(stagingSiteRoot, { fetchImpl });
    assertImportedPreviewHasAssets(stagingSiteRoot, staging);

    if (existsSync(dest)) {
      backup = `${dest}.prev-${Date.now()}`;
      await fs.rename(dest, backup);
    }
    await fs.rename(staging, dest);
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
    if (backup && existsSync(backup) && !existsSync(dest)) {
      await fs.rename(backup, dest).catch(() => {});
    }
    throw error;
  }
  if (backup) await fs.rm(backup, { recursive: true, force: true }).catch(() => {});

  const siteRoot = await resolveImportedSiteRoot(dest, siteFolder);
  if (!siteRoot) {
    const error = new Error('Imported ZIP did not contain an index.html site root.');
    error.status = 502;
    throw error;
  }
  return { importDir: dest, siteRoot };
}

function assertSafeZipEntries(zip) {
  const entries = zip.getEntries();
  if (!entries.length) {
    const error = new Error('Website preview ZIP was empty.');
    error.status = 502;
    throw error;
  }
  for (const entry of entries) {
    const name = String(entry.entryName || '');
    if (path.isAbsolute(name) || name.split(/[\\/]/).includes('..')) {
      const error = new Error('Website preview ZIP contains unsafe file paths.');
      error.status = 502;
      throw error;
    }
  }
  return entries;
}

export async function ingestSalesPreviewZip({
  client,
  zipBuffer,
  runId = '',
  step = 'latest',
  siteFolder = '',
  importsRoot,
  sales,
  offers = null,
  allClients = [],
} = {}) {
  if (!client?.id) {
    const error = new Error('Sales client not found.');
    error.status = 404;
    throw error;
  }
  if (!Buffer.isBuffer(zipBuffer) && !(zipBuffer instanceof Uint8Array)) {
    const error = new Error('Website preview ZIP is required.');
    error.status = 400;
    throw error;
  }
  const buffer = Buffer.isBuffer(zipBuffer) ? zipBuffer : Buffer.from(zipBuffer);
  if (!buffer.length) {
    const error = new Error('Website preview ZIP was empty.');
    error.status = 400;
    throw error;
  }

  const resolvedSiteFolder = sanitizePreviewText(siteFolder) || sanitizePreviewText(client.businessName) || 'site';
  const { siteRoot } = await materializePreviewZip(buffer, {
    importsRoot,
    clientId: client.id,
    siteFolder: resolvedSiteFolder,
  });

  const previewSlug = allocatePreviewSlug(client, allClients.length ? allClients : sales?.getSalesClients?.() || []);
  const previewPath = `/sales-preview/${encodeURIComponent(client.id)}/`;
  const prettyPath = getSalesPreviewPath(client.id, previewSlug);
  const publicUrl = `${getPublicPreviewOrigin()}${previewPath}`;

  const updatedClient = sales.setSalesWebsiteImport(client.id, {
    importedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    sourceRunId: sanitizePreviewText(runId) || sanitizePreviewText(client.makerRun?.runId),
    sourceStep: sanitizePreviewText(step) || 'latest',
    sourceBaseUrl: publicUrl,
    siteFolder: path.basename(siteRoot),
    importRoot: siteRoot,
    previewUrl: previewPath,
    previewSlug,
    publicUrl,
    publicPreviewPublishedAt: new Date().toISOString(),
  });
  if (!updatedClient) {
    const error = new Error('Sales client not found.');
    error.status = 404;
    throw error;
  }

  if (offers?.listOffers && offers.updateOffer) {
    for (const offer of offers.listOffers()) {
      if (sanitizePreviewText(offer?.salesClientId) !== client.id) continue;
      offers.updateOffer(offer.id, { previewUrl: publicUrl });
    }
  }

  return {
    client: updatedClient,
    previewPath,
    prettyPath,
    publicUrl,
    previewSlug,
    siteRoot,
    sourceStep: sanitizePreviewText(step) || 'latest',
  };
}

export function shouldRedirectPreviewToSlash(reqPath = '', relativePath = '') {
  if (sanitizePreviewText(relativePath)) return false;
  const raw = String(reqPath || '');
  return Boolean(raw) && !raw.endsWith('/');
}
