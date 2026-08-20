import { readFileSync, existsSync } from 'fs';
import { randomBytes } from 'crypto';
import { getDataFilePath, ensurePersistentDataDir, writeDataJson } from './storage-path.js';

const SITES_PATH = getDataFilePath('sites.json');

function ensureDataDir() {
  ensurePersistentDataDir();
}

function readSites() {
  ensureDataDir();
  if (!existsSync(SITES_PATH)) return [];
  try {
    return JSON.parse(readFileSync(SITES_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeSites(sites) {
  ensureDataDir();
  writeDataJson(SITES_PATH, sites);
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
    features: site.features || { users: true, analytics: false, ecommerce: false },
  };
}

export function getAllSites() {
  return readSites().map((s) => ({
    id: s.id,
    site_key: s.site_key,
    domain: s.domain,
    name: s.name,
    features: s.features || { users: true, analytics: false, ecommerce: false },
    createdAt: s.createdAt,
  }));
}

export function createSite({ name, domain, site_key } = {}) {
  const requestedKey = String(site_key || "").trim();
  if (requestedKey) {
    const existingByKey = getSiteByKey(requestedKey);
    if (existingByKey) {
      if (domain && existingByKey.domain !== domain) {
        const updated = updateSite(existingByKey.id, { domain, name: name || existingByKey.name });
        return updated.ok ? { ...updated.site } : { ...existingByKey };
      }
      return { ...existingByKey };
    }
  }
  if (domain) {
    const existingByDomain = getSiteByDomain(domain);
    if (existingByDomain) return { ...existingByDomain };
  }
  const sites = readSites();
  const siteKey = requestedKey || generateSiteKey();
  const id = String(Date.now());
  const site = {
    id,
    site_key: siteKey,
    domain: domain || "",
    name: name || "Unnamed site",
    features: { users: true, analytics: false, ecommerce: false },
    createdAt: new Date().toISOString(),
  };
  sites.push(site);
  writeSites(sites);
  return { ...site };
}

export function updateSite(id, { domain, name, features }) {
  const sites = readSites();
  const i = sites.findIndex((s) => s.id === id);
  if (i === -1) return { ok: false, error: 'Site not found' };
  if (domain !== undefined) sites[i].domain = domain;
  if (name !== undefined) sites[i].name = name;
  if (features !== undefined) sites[i].features = { ...(sites[i].features || {}), ...features };
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
