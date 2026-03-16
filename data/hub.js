import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const SITES_PATH = join(DATA_DIR, 'sites.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
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
  writeFileSync(SITES_PATH, JSON.stringify(sites, null, 2), 'utf8');
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

export function createSite({ name, domain }) {
  const sites = readSites();
  const siteKey = generateSiteKey();
  const id = String(Date.now());
  const site = {
    id,
    site_key: siteKey,
    domain: domain || '',
    name: name || 'Unnamed site',
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
