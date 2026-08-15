import { readFileSync, existsSync } from 'fs';
import { randomBytes } from 'crypto';
import { getDataFilePath, ensurePersistentDataDir, writeDataJson } from './storage-path.js';
import {
  desiredCmsVersion,
  featuresFromPlan,
  normalizeCatalogType,
  normalizeCmsMeta,
  normalizeFeatures,
  normalizeSite,
  normalizeWebsitePlan,
  resolveCatalogTypeForSite,
} from './hub-model.js';

const SITES_PATH = getDataFilePath('sites.json');

function ensureDataDir() {
  ensurePersistentDataDir();
}

function readSites() {
  ensureDataDir();
  if (!existsSync(SITES_PATH)) return [];
  try {
    const raw = JSON.parse(readFileSync(SITES_PATH, 'utf8'));
    return (Array.isArray(raw) ? raw : []).map(normalizeSite).filter((site) => site && site.id);
  } catch {
    return [];
  }
}

function writeSites(sites) {
  ensureDataDir();
  writeDataJson(SITES_PATH, sites.map(normalizeSite).filter(Boolean));
}

export function generateSiteKey() {
  return randomBytes(16).toString('hex');
}

export function getSiteByKey(siteKey) {
  const sites = readSites();
  return sites.find((s) => s.site_key === siteKey) || null;
}

export function getSiteByDomain(domain) {
  const sites = readSites();
  const normalized = (domain || '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  return sites.find((s) => (s.domain || '').toLowerCase() === normalized) || null;
}

export function getSiteConfig(siteKeyOrDomain, byDomain = false) {
  const site = byDomain ? getSiteByDomain(siteKeyOrDomain) : getSiteByKey(siteKeyOrDomain);
  if (!site) return null;
  return {
    id: site.id,
    name: site.name,
    domain: site.domain,
    features: site.features,
    ecommerceCatalogType: site.ecommerceCatalogType,
    websitePlan: site.websitePlan,
    desiredCmsVersion: desiredCmsVersion(site),
  };
}

export function getAllSites() {
  return readSites();
}

export function createSite({ name, domain, websitePlan, ecommerceCatalogType, githubRepo, features } = {}) {
  const sites = readSites();
  const siteKey = generateSiteKey();
  const id = String(Date.now());
  const plan = normalizeWebsitePlan(websitePlan);
  const nextFeatures = features ? normalizeFeatures(features) : featuresFromPlan(plan);
  const site = normalizeSite({
    id,
    site_key: siteKey,
    domain: domain || '',
    name: name || 'Unnamed site',
    websitePlan: plan,
    features: nextFeatures,
    ecommerceCatalogType: resolveCatalogTypeForSite({
      features: nextFeatures,
      ecommerceCatalogType,
    }),
    cms: {
      githubRepo: githubRepo || '',
    },
    createdAt: new Date().toISOString(),
  });
  sites.push(site);
  writeSites(sites);
  return { ...site };
}

export function updateSite(id, patch = {}) {
  const sites = readSites();
  const i = sites.findIndex((s) => s.id === id);
  if (i === -1) return { ok: false, error: 'Site not found' };
  const current = sites[i];
  if (patch.domain !== undefined) current.domain = patch.domain;
  if (patch.name !== undefined) current.name = patch.name;
  if (patch.websitePlan !== undefined) current.websitePlan = normalizeWebsitePlan(patch.websitePlan);
  if (patch.features !== undefined) current.features = normalizeFeatures({ ...current.features, ...patch.features });
  if (patch.ecommerceCatalogType !== undefined) {
    current.ecommerceCatalogType = current.features.ecommerce
      ? normalizeCatalogType(patch.ecommerceCatalogType) || 'normal'
      : null;
  } else {
    current.ecommerceCatalogType = resolveCatalogTypeForSite(current);
  }
  if (patch.githubRepo !== undefined || patch.cms !== undefined) {
    current.cms = normalizeCmsMeta({
      ...current.cms,
      ...(patch.cms || {}),
      ...(patch.githubRepo !== undefined ? { githubRepo: patch.githubRepo } : {}),
    });
  }
  sites[i] = normalizeSite(current);
  writeSites(sites);
  return { ok: true, site: sites[i] };
}

export function recordHeartbeat(siteKey, { packageVersion, adminUrl, name } = {}) {
  const key = String(siteKey || '').trim();
  if (!key) return { ok: false, error: 'site_key required' };
  const sites = readSites();
  const i = sites.findIndex((s) => s.site_key === key);
  if (i === -1) return { ok: false, error: 'Site not found' };
  sites[i].cms = normalizeCmsMeta({
    ...sites[i].cms,
    lastSeenAt: new Date().toISOString(),
    packageVersion: packageVersion || sites[i].cms.packageVersion,
    adminUrl: adminUrl || sites[i].cms.adminUrl,
  });
  if (name && !sites[i].name) sites[i].name = name;
  writeSites(sites);
  return { ok: true, site: sites[i] };
}

export function deleteSite(id) {
  const sites = readSites();
  const filtered = sites.filter((s) => s.id !== id);
  if (filtered.length === sites.length) return { ok: false, error: 'Site not found' };
  writeSites(filtered);
  return { ok: true };
}

export { featuresFromPlan, normalizeWebsitePlan };
