import express from 'express';
import { createHmac, randomBytes } from 'crypto';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import * as store from './data/store.js';
import * as hub from './data/hub.js';
import * as employees from './data/employees.js';
import * as sales from './data/sales.js';
import * as clientPortal from './data/client-portal.js';
import * as offers from './data/offers.js';
import * as resetTokens from './data/reset-tokens.js';
import { getPersistentDataDir } from './data/storage-path.js';
import * as emailLib from './lib/email.js';
import * as employeeWordPress from './lib/employee-wordpress.js';
import * as employeeLuca from './lib/employee-luca.js';
import * as employeeMyPhoner from './lib/employee-myphoner.js';
import { buildSalesReminderEmail, buildSalesThankYouEmail } from './lib/sales-email.js';
import {
  createGoogleCalendarAuthUrl,
  deleteMeetingEvent,
  exchangeGoogleCalendarCode,
  getGoogleCalendarStatus,
  upsertMeetingEvent,
} from './lib/google-calendar.js';
import {
  createClientGoogleAuthUrl,
  exchangeClientGoogleCode,
  getClientGoogleStatus,
  isClientGoogleConfigured,
  resolveClientGoogleRedirectUri,
} from './lib/client-google-auth.js';
import {
  getStripe,
  isStripeConfigured,
  getPublishableKey,
  getWebhookSecret,
  getStripeCurrency,
  priceIdForPlan,
} from './lib/stripe.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const distPath = join(__dirname, 'dist');
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-me-in-production';

function signToken(payload) {
  const data = JSON.stringify(payload);
  const sig = createHmac('sha256', ADMIN_SECRET).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url');
}

function verifyToken(token) {
  try {
    const raw = JSON.parse(Buffer.from(token, 'base64url').toString());
    const expect = createHmac('sha256', ADMIN_SECRET).update(raw.data).digest('hex');
    if (expect !== raw.sig) return null;
    return JSON.parse(raw.data);
  } catch {
    return null;
  }
}

async function ensureAdminExists() {
  const admin = await store.getAdmin();
  if (admin) return;
  const username = process.env.ADMIN_USERNAME || 'asoldi.com';
  const password = process.env.ADMIN_PASSWORD || 'D@mi@N102020';
  await store.setAdminCredentials(username, password);
  console.log('Default admin created (username:', username, '). Set ADMIN_USERNAME/ADMIN_PASSWORD/ADMIN_SECRET in production.');
}

// --- API (must be before static)
// Stripe webhook needs the raw, unparsed body to verify the signature, so it is
// registered before the global JSON body parser below.
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json());

// Rate limit forgot-password (5 per IP per 15 min)
const forgotPasswordAttempts = new Map();
function rateLimitForgotPassword(ip) {
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const entries = forgotPasswordAttempts.get(ip) || [];
  const recent = entries.filter((t) => now - t < window);
  if (recent.length >= 5) return false;
  recent.push(now);
  forgotPasswordAttempts.set(ip, recent);
  return true;
}

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }
  const valid = await store.verifyAdmin(username, password);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = signToken({ role: 'admin', username, at: Date.now() });
  res.json({ token });
});

function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  req.admin = payload;
  next();
}

const SALES_IMPORTS_ROOT = join(getPersistentDataDir(), 'sales-site-imports');
const SALES_REMINDER_POLL_MS = Number(process.env.SALES_REMINDER_POLL_MS || 60_000);
const SALES_EMAIL_AUTOSEND_ENABLED = String(process.env.SALES_EMAIL_AUTOSEND || '0') === '1';
const DEFAULT_MAKER_LOCAL_URL = String(process.env.WEBSITE_MAKER_LOCAL_URL || 'http://localhost:3000').trim() || 'http://localhost:3000';
const CLOUDFLARED_WINDOWS_CANDIDATES = [
  'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
  'C:\\Program Files\\cloudflared\\cloudflared.exe',
];
let salesReminderLoopRunning = false;
let salesReminderInterval = null;
let makerTunnelProcess = null;
let makerTunnelUrl = '';
let makerTunnelTargetUrl = '';
let makerTunnelStartedAt = '';
const SALES_MEETING_GEOCODE_MIN_INTERVAL_MS = Number(process.env.SALES_MEETING_GEOCODE_MIN_INTERVAL_MS || 1100);
const salesMeetingGeocodeCache = new Map();
let salesMeetingGeocodeLastRequestAt = 0;
const CLIENT_SOCIAL_DEV_MODE = String(process.env.CLIENT_SOCIAL_DEV_MODE || '1') !== '0';

const CLIENT_WEBSITE_PLANS = [
  {
    id: 'tier-1-standard',
    name: 'Tier 1: Standard',
    price: '999,-/mnd',
    setupFee: '999,- /engang',
    domainPrice: '79,-/mnd',
    emailPrice: '49,-/mnd',
    description: 'Inkluderer nettside, hosting, opprettelse, domene og e-post.',
    features: [
      'Nettsideutvikling',
      'Hosting',
      'Opprettelse',
      'Domene',
      'E-post',
    ],
    category: 'website',
  },
  {
    id: 'tier-2-seo',
    name: 'Tier 2: SEO',
    price: '1 499,-/mnd',
    setupFee: '999,- /engang',
    domainPrice: '79,-/mnd',
    emailPrice: '49,-/mnd',
    description: 'Inkluderer Tier 1 + SEO-optimalisering og synlighetstiltak.',
    features: [
      'Alt i Tier 1',
      'SEO optimalisering',
      'Anmeldelser & sosiale medier sync',
      'E-postliste innsamling',
    ],
    category: 'website',
  },
  {
    id: 'tier-3-ecommerce',
    name: 'Tier 3: Nettbutikk',
    price: '1 999,-/mnd',
    setupFee: '999,- /engang',
    domainPrice: '79,-/mnd',
    emailPrice: '49,-/mnd',
    description: 'Inkluderer Tier 2 + nettbutikk og utvidet analyse.',
    features: [
      'Alt i Tier 2',
      'Nettbutikk-funksjonalitet',
      'Analyse-dashboard',
      'Gjennomgangsmøte',
    ],
    category: 'website',
  },
];

function findWebsitePlan(planId) {
  return CLIENT_WEBSITE_PLANS.find((entry) => entry.id === sanitizeText(planId)) || null;
}

function sanitizeText(value = '') {
  return String(value ?? '').trim();
}

function normalizeMeetingPlaceKey(value = '') {
  return sanitizeText(value).toLowerCase().replace(/\s+/g, ' ');
}

function waitMs(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

async function geocodeMeetingPlace(place = '') {
  const meetingPlace = sanitizeText(place);
  if (!meetingPlace) return null;
  const cacheKey = normalizeMeetingPlaceKey(meetingPlace);
  if (salesMeetingGeocodeCache.has(cacheKey)) {
    return salesMeetingGeocodeCache.get(cacheKey);
  }

  const minInterval = Math.max(0, SALES_MEETING_GEOCODE_MIN_INTERVAL_MS);
  const elapsedSinceLast = Date.now() - salesMeetingGeocodeLastRequestAt;
  if (elapsedSinceLast < minInterval) {
    await waitMs(minInterval - elapsedSinceLast);
  }
  salesMeetingGeocodeLastRequestAt = Date.now();

  try {
    const params = new URLSearchParams({
      q: meetingPlace,
      format: 'jsonv2',
      limit: '1',
      addressdetails: '0',
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'nb',
        'User-Agent': 'AsoldiSalesMap/1.0 (+https://asoldi.com)',
      },
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => []);
    const first = Array.isArray(payload) ? payload[0] : null;
    const latitude = Number(first?.lat);
    const longitude = Number(first?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      salesMeetingGeocodeCache.set(cacheKey, null);
      return null;
    }
    const geocoded = {
      latitude,
      longitude,
      displayName: sanitizeText(first?.display_name) || meetingPlace,
    };
    salesMeetingGeocodeCache.set(cacheKey, geocoded);
    return geocoded;
  } catch {
    return null;
  }
}

function normalizeHttpBaseUrl(value = '') {
  const raw = sanitizeText(value);
  if (!raw) return '';
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    const cleanPath = String(parsed.pathname || '').replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host}${cleanPath}`;
  } catch {
    return '';
  }
}

function resolveCloudflaredBinary() {
  const envPath = sanitizeText(process.env.CLOUDFLARED_BIN);
  if (envPath && existsSync(envPath)) return envPath;

  const candidates = new Set(CLOUDFLARED_WINDOWS_CANDIDATES);
  const programFilesX86 = sanitizeText(process.env['ProgramFiles(x86)']);
  const programFiles = sanitizeText(process.env.ProgramFiles);
  const localAppData = sanitizeText(process.env.LOCALAPPDATA);
  const userProfile = sanitizeText(process.env.USERPROFILE);
  if (programFilesX86) candidates.add(`${programFilesX86}\\cloudflared\\cloudflared.exe`);
  if (programFiles) candidates.add(`${programFiles}\\cloudflared\\cloudflared.exe`);
  if (programFiles) candidates.add(`${programFiles}\\Cloudflare\\Cloudflared\\cloudflared.exe`);
  if (localAppData) candidates.add(`${localAppData}\\Programs\\cloudflared\\cloudflared.exe`);
  candidates.add('C:\\ProgramData\\chocolatey\\bin\\cloudflared.exe');
  if (userProfile) candidates.add(`${userProfile}\\scoop\\shims\\cloudflared.exe`);
  if (userProfile) candidates.add(`${userProfile}\\.cloudflared\\cloudflared.exe`);

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }

  if (process.platform === 'win32') {
    try {
      const probe = spawnSync('where.exe', ['cloudflared'], {
        encoding: 'utf8',
        windowsHide: true,
      });
      const hits = String(probe.stdout || '')
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean);
      for (const hit of hits) {
        if (existsSync(hit)) return hit;
      }
    } catch {
      // Ignore detection failures and continue to generic probe.
    }
  } else {
    try {
      const probe = spawnSync('which', ['cloudflared'], {
        encoding: 'utf8',
      });
      const hit = String(probe.stdout || '').split(/\r?\n/).map((entry) => entry.trim()).find(Boolean);
      if (hit && existsSync(hit)) return hit;
    } catch {
      // Ignore detection failures and continue to generic probe.
    }
  }

  try {
    const probe = spawnSync('cloudflared', ['--version'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (probe.status === 0) return 'cloudflared';
  } catch {
    // No-op
  }
  return '';
}

async function stopMakerTunnelProcess() {
  const child = makerTunnelProcess;
  if (!child || child.killed) {
    makerTunnelProcess = null;
    return;
  }
  await new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timeout = setTimeout(done, 4000);
    child.once('exit', () => {
      clearTimeout(timeout);
      done();
    });
    try {
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
          stdio: 'ignore',
          windowsHide: true,
        });
        killer.once('error', () => done());
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      done();
    }
  });
  makerTunnelProcess = null;
}

async function restartMakerTunnel(targetUrl = DEFAULT_MAKER_LOCAL_URL) {
  const normalizedTarget = normalizeHttpBaseUrl(targetUrl) || DEFAULT_MAKER_LOCAL_URL;
  await stopMakerTunnelProcess();

  const binary = resolveCloudflaredBinary();
  if (!binary) {
    throw new Error(
      'cloudflared was not found on this backend host. Install cloudflared, or set CLOUDFLARED_BIN to the executable path. If you are using a hosted backend, start this from your local backend to create a local tunnel.'
    );
  }
  return await new Promise((resolve, reject) => {
    const child = spawn(binary, ['tunnel', '--url', normalizedTarget], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    makerTunnelProcess = child;
    let settled = false;
    let outputBuffer = '';

    const finishSuccess = (url) => {
      if (settled) return;
      settled = true;
      makerTunnelUrl = url;
      makerTunnelTargetUrl = normalizedTarget;
      makerTunnelStartedAt = new Date().toISOString();
      resolve({
        url,
        targetUrl: normalizedTarget,
        startedAt: makerTunnelStartedAt,
      });
    };

    const finishError = (message) => {
      if (settled) return;
      settled = true;
      if (makerTunnelProcess === child) makerTunnelProcess = null;
      try {
        if (!child.killed) child.kill();
      } catch {
        // Ignore cleanup errors.
      }
      reject(new Error(message));
    };

    const onData = (chunk) => {
      const text = String(chunk || '');
      if (!text) return;
      outputBuffer = `${outputBuffer}${text}`;
      if (outputBuffer.length > 12_000) outputBuffer = outputBuffer.slice(-12_000);
      const matches = outputBuffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/ig);
      if (matches?.length) finishSuccess(matches[matches.length - 1]);
    };

    const timeout = setTimeout(() => {
      finishError('Timed out waiting for cloudflared to provide a tunnel URL.');
    }, 25_000);

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.once('error', (error) => {
      clearTimeout(timeout);
      if (error?.code === 'ENOENT') {
        finishError(
          `Failed to start cloudflared: executable not found (${binary}). Install cloudflared or set CLOUDFLARED_BIN.`
        );
        return;
      }
      finishError(`Failed to start cloudflared: ${error.message}`);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      if (!settled) {
        finishError(`cloudflared exited before creating a tunnel URL (exit code ${code ?? 'unknown'}).`);
      } else if (makerTunnelProcess === child) {
        makerTunnelProcess = null;
      }
    });
  });
}

function normalizeMeetingMode(value) {
  const raw = sanitizeText(value).toLowerCase();
  if (raw === 'in-person' || raw === 'in_person' || raw === 'inperson' || raw === 'physical') return 'in-person';
  return 'online';
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const raw = value.toLowerCase().trim();
    if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on') return true;
    if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function sanitizeSegment(value = '', fallback = 'site') {
  const cleaned = sanitizeText(value)
    .toLowerCase()
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  return cleaned || fallback;
}

function isValidIsoDate(value) {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms);
}

function normalizeEmail(value = '') {
  return sanitizeText(value).toLowerCase();
}

function isValidEmail(value = '') {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function passwordValid(value = '') {
  return String(value || '').length >= 8;
}

function clientTokenFromRequest(req) {
  const auth = req.headers.authorization;
  const bearer = auth && auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const fallbackHeader = sanitizeText(req.headers['x-client-token']);
  return bearer || fallbackHeader || '';
}

function normalizeSalesDetailLinks(value = {}, fallback = {}) {
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  const input = value && typeof value === 'object' ? value : {};
  return {
    instagramUrl: sanitizeText(input.instagramUrl ?? base.instagramUrl),
    facebookUrl: sanitizeText(input.facebookUrl ?? base.facebookUrl),
    proffUrl: sanitizeText(input.proffUrl ?? base.proffUrl),
    otherLinks: sanitizeText(input.otherLinks ?? base.otherLinks),
    googleBusinessProfile: sanitizeText(input.googleBusinessProfile ?? base.googleBusinessProfile),
  };
}

function buildSalesRelevantLinks(details = {}) {
  const links = [];
  const pushUnique = (value) => {
    const next = sanitizeText(value);
    if (!next || links.includes(next)) return;
    links.push(next);
  };
  pushUnique(details.instagramUrl);
  pushUnique(details.facebookUrl);
  pushUnique(details.proffUrl);
  const other = sanitizeText(details.otherLinks);
  if (other) {
    other
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach(pushUnique);
  }
  return links.join('\n');
}

function buildSalesQuickFillLinks(details = {}) {
  const instagramProfile = sanitizeText(details.instagramUrl);
  const facebookProfile = sanitizeText(details.facebookUrl);
  const proffLink = sanitizeText(details.proffUrl);
  const googleBusinessProfile = sanitizeText(details.googleBusinessProfile);
  const existingLinks = new Set(
    [instagramProfile, facebookProfile, proffLink, googleBusinessProfile]
      .map((entry) => sanitizeText(entry))
      .filter(Boolean)
  );
  const otherCandidates = sanitizeText(details.otherLinks)
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const customLink = otherCandidates.find((entry) => !existingLinks.has(entry)) || otherCandidates[0] || '';
  return {
    instagramProfile,
    facebookProfile,
    proffLink,
    googleBusinessProfile,
    customLink,
  };
}

function buildSalesInput(body = {}, { existing = null, requireCore = false } = {}) {
  const source = body && typeof body === 'object' ? body : {};
  const mode = normalizeMeetingMode(source.meetingMode ?? existing?.meetingMode ?? 'online');
  const agreedTime = parseBoolean(source.agreedTime, existing?.agreedTime ?? false);
  const meetingAt = agreedTime ? sanitizeText(source.meetingAt ?? existing?.meetingAt) : '';
  const meetingPlaceRaw = sanitizeText(source.meetingPlace ?? existing?.meetingPlace);

  const payload = {
    businessName: sanitizeText(source.businessName ?? existing?.businessName),
    contactPerson: sanitizeText(source.contactPerson ?? existing?.contactPerson),
    contactEmail: sanitizeText(source.contactEmail ?? existing?.contactEmail),
    contactPhone: sanitizeText(source.contactPhone ?? existing?.contactPhone),
    meetingPlace: mode === 'online' ? '' : meetingPlaceRaw,
    industry: sanitizeText(source.industry ?? existing?.industry),
    meetingMode: mode,
    agreedTime,
    meetingAt,
    websiteDomain: sanitizeText(source.websiteDomain ?? existing?.websiteDomain),
    details: normalizeSalesDetailLinks(source.details, existing?.details),
  };

  if (requireCore) {
    if (!payload.businessName) throw new Error('Business name is required.');
    if (!payload.contactPerson) throw new Error('Contact person is required.');
    if (!payload.contactEmail) throw new Error('Contact email is required.');
  }
  if (payload.agreedTime && !payload.meetingAt) {
    throw new Error('Meeting date/time is required when agreed time is enabled.');
  }
  if (payload.agreedTime && payload.meetingAt && !isValidIsoDate(payload.meetingAt)) {
    throw new Error('Meeting date/time must be a valid ISO date.');
  }
  return payload;
}

function formatBrregAddress(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const lines = Array.isArray(source.adresse) ? source.adresse.map((entry) => sanitizeText(entry)).filter(Boolean) : [];
  const postNumber = sanitizeText(source.postnummer);
  const postPlace = sanitizeText(source.poststed);
  const postal = [postNumber, postPlace].filter(Boolean).join(' ');
  const parts = [...lines];
  if (postal) parts.push(postal);
  return parts.join(', ');
}

function mapBrregEntity(entity = {}) {
  const source = entity && typeof entity === 'object' ? entity : {};
  return {
    organizationNumber: sanitizeText(source.organisasjonsnummer),
    name: sanitizeText(source.navn),
    address: formatBrregAddress(source.forretningsadresse || source.postadresse || {}),
  };
}

async function fetchBrregEntities(url, signal) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) return [];
  const payload = await response.json().catch(() => ({}));
  const list = Array.isArray(payload?._embedded?.enheter) ? payload._embedded.enheter : [];
  return list.map(mapBrregEntity).filter((entry) => entry.name);
}

async function searchBrregBusinesses(queryText = '') {
  const query = sanitizeText(queryText);
  if (query.length < 2) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const digits = query.replace(/\D+/g, '');
    const requests = [
      fetchBrregEntities(
        `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(query)}&size=10`,
        controller.signal
      ),
    ];
    if (digits.length >= 3) {
      requests.push(
        fetchBrregEntities(
          `https://data.brreg.no/enhetsregisteret/api/enheter?organisasjonsnummer=${encodeURIComponent(digits)}&size=10`,
          controller.signal
        )
      );
    }
    const groups = await Promise.allSettled(requests);
    const merged = [];
    const seen = new Set();
    for (const result of groups) {
      if (result.status !== 'fulfilled') continue;
      for (const entry of result.value) {
        const key = entry.organizationNumber || entry.name.toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(entry);
      }
    }
    return merged.slice(0, 15);
  } finally {
    clearTimeout(timeout);
  }
}

function getSalesPreviewUrl(clientId) {
  return `/sales-preview/${encodeURIComponent(clientId)}/`;
}

function httpStatusFromError(error, fallback = 500) {
  const status = Number(error?.status);
  if (Number.isFinite(status) && status >= 400 && status <= 599) return status;
  return fallback;
}

function makeHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function inferWebsiteMakerBaseUrlFromClient(client = null) {
  const candidates = [
    sanitizeText(client?.makerRun?.dashboardUrl),
    sanitizeText(client?.makerRun?.previewUrl),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      const normalized = normalizeHttpBaseUrl(`${parsed.protocol}//${parsed.host}`);
      if (normalized) return normalized;
    } catch {
      // Ignore malformed URLs saved in historical client records.
    }
  }
  return '';
}

function resolveWebsiteMakerBaseUrl(value = '', client = null) {
  const candidates = [
    value,
    process.env.WEBSITE_MAKER_BASE_URL,
    inferWebsiteMakerBaseUrlFromClient(client),
    'http://localhost:3000',
  ];
  for (const candidate of candidates) {
    const normalized = normalizeHttpBaseUrl(candidate);
    if (normalized) return normalized;
  }
  return '';
}

function getWebsiteMakerAuthHeaders() {
  const apiKey = sanitizeText(process.env.WEBSITE_MAKER_API_KEY);
  return apiKey ? { 'x-api-key': apiKey } : {};
}

function parseMakerErrorMessage(payloadBuffer, fallbackMessage) {
  try {
    const maybeJson = JSON.parse(payloadBuffer.toString('utf8'));
    return sanitizeText(maybeJson?.error || maybeJson?.message) || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function buildMakerRunLinks(websiteMakerBaseUrl, runId) {
  return {
    dashboardUrl: `${websiteMakerBaseUrl}/run/${encodeURIComponent(runId)}`,
    previewUrl: `${websiteMakerBaseUrl}/preview/${encodeURIComponent(runId)}/step/3/view?route=/`,
  };
}

function resolveSalesClientPreviewUrl(salesClientId = '') {
  const clientId = sanitizeText(salesClientId);
  if (!clientId) return '';
  const client = sales.getSalesClientById(clientId);
  return sanitizeText(client?.websiteImport?.previewUrl);
}

function hydrateOfferPreviewFromSalesImport(offer, { persist = false } = {}) {
  const source = offer && typeof offer === 'object' ? offer : null;
  if (!source) return null;
  const currentPreview = sanitizeText(source.previewUrl);
  if (currentPreview) return source;

  const linkedPreview = resolveSalesClientPreviewUrl(source.salesClientId);
  if (!linkedPreview) return source;
  if (persist && source.id) {
    const patched = offers.updateOffer(source.id, { previewUrl: linkedPreview });
    if (patched) return patched;
  }
  return {
    ...source,
    previewUrl: linkedPreview,
  };
}

async function fetchMakerRunRecord({ websiteMakerBaseUrl, runId }) {
  const targetRunId = sanitizeText(runId);
  if (!targetRunId) {
    throw makeHttpError(400, 'Run ID is required.');
  }
  const response = await fetch(
    `${websiteMakerBaseUrl}/api/runs/${encodeURIComponent(targetRunId)}`,
    { method: 'GET', headers: getWebsiteMakerAuthHeaders() }
  );
  const payloadBuffer = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    const fallback = `Website Maker run lookup failed (${response.status})`;
    throw makeHttpError(
      response.status === 404 ? 404 : 502,
      parseMakerErrorMessage(payloadBuffer, fallback)
    );
  }
  try {
    return JSON.parse(payloadBuffer.toString('utf8'));
  } catch {
    throw makeHttpError(502, 'Website Maker returned an invalid run response.');
  }
}

async function syncSalesClientFromMakerRun({
  client,
  runId = '',
  step = 'latest',
  siteFolder = '',
  baseUrl = '',
  websiteMakerBaseUrl = '',
} = {}) {
  const targetClient = client && typeof client === 'object' ? client : null;
  if (!targetClient?.id) {
    throw makeHttpError(404, 'Sales client not found.');
  }

  const resolvedRunId = sanitizeText(runId) || sanitizeText(targetClient.makerRun?.runId);
  if (!resolvedRunId) {
    throw makeHttpError(400, 'No Website Maker run is linked yet. Create or link a run first.');
  }

  const resolvedSiteFolder = sanitizeSegment(siteFolder || targetClient.businessName || 'site', 'site');
  const requestedStep = sanitizeText(step || 'latest') || 'latest';
  const sourceBaseUrl = sanitizeText(baseUrl || `https://asoldi.com/${resolvedSiteFolder}`);
  const makerBaseUrl = resolveWebsiteMakerBaseUrl(websiteMakerBaseUrl, targetClient);
  if (!makerBaseUrl) {
    throw makeHttpError(400, 'Website Maker URL is invalid. Use a valid host or URL (for example https://example.com).');
  }

  const exportUrl = `${makerBaseUrl}/api/runs/${encodeURIComponent(resolvedRunId)}/export?step=${encodeURIComponent(requestedStep)}&baseUrl=${encodeURIComponent(sourceBaseUrl)}&siteFolder=${encodeURIComponent(resolvedSiteFolder)}`;
  const response = await fetch(exportUrl, {
    method: 'GET',
    headers: getWebsiteMakerAuthHeaders(),
  });
  const payloadBuffer = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    const fallback = `Website export failed (${response.status})`;
    throw makeHttpError(
      response.status === 404 ? 404 : 502,
      parseMakerErrorMessage(payloadBuffer, fallback)
    );
  }

  let zip;
  try {
    zip = new AdmZip(payloadBuffer);
    const entries = zip.getEntries();
    if (!entries.length) {
      throw makeHttpError(502, 'Website Maker export ZIP was empty.');
    }
    for (const entry of entries) {
      if (path.isAbsolute(entry.entryName) || entry.entryName.split(/[\\/]/).includes('..')) {
        throw makeHttpError(502, 'Website Maker export ZIP contains unsafe file paths.');
      }
    }
  } catch (error) {
    if (error?.status) throw error;
    throw makeHttpError(502, 'Website Maker export is not a valid ZIP archive.');
  }

  const importDir = join(SALES_IMPORTS_ROOT, targetClient.id);
  await fs.rm(importDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(importDir, { recursive: true });
  zip.extractAllTo(importDir, true);

  const siteRoot = await resolveImportedSiteRoot(importDir, resolvedSiteFolder);
  if (!siteRoot) {
    await fs.rm(importDir, { recursive: true, force: true }).catch(() => {});
    throw makeHttpError(502, 'Imported ZIP did not contain an index.html site root.');
  }

  const exportStep = sanitizeText(response.headers.get('x-export-step')) || requestedStep;

  const makerRunCreatedAt = sanitizeText(targetClient.makerRun?.createdAt) || new Date().toISOString();
  const makerRunIndustry = sanitizeText(targetClient.makerRun?.industry) || sanitizeText(targetClient.industry);
  const existingRunId = sanitizeText(targetClient.makerRun?.runId);
  const existingDashboardUrl = sanitizeText(targetClient.makerRun?.dashboardUrl);
  const existingPreviewUrl = sanitizeText(targetClient.makerRun?.previewUrl);
  if (
    existingRunId !== resolvedRunId ||
    !existingDashboardUrl ||
    !existingPreviewUrl
  ) {
    sales.setSalesMakerRun(targetClient.id, {
      runId: resolvedRunId,
      ...buildMakerRunLinks(makerBaseUrl, resolvedRunId),
      industry: makerRunIndustry,
      createdAt: makerRunCreatedAt,
    });
  }

  const updatedClient = sales.setSalesWebsiteImport(targetClient.id, {
    importedAt: new Date().toISOString(),
    sourceRunId: resolvedRunId,
    sourceStep: exportStep,
    sourceBaseUrl,
    siteFolder: path.basename(siteRoot),
    importRoot: siteRoot,
    previewUrl: getSalesPreviewUrl(targetClient.id),
  });
  if (!updatedClient) {
    throw makeHttpError(404, 'Sales client not found.');
  }

  return {
    runId: resolvedRunId,
    sourceStep: exportStep,
    sourceExportUrl: exportUrl,
    websiteMakerBaseUrl: makerBaseUrl,
    client: updatedClient,
  };
}

function getMeetingMinutes(client) {
  return client?.meetingMode === 'in-person' ? 60 : 30;
}

// Stateless OAuth state. Signed with ADMIN_SECRET (same value across every
// worker process) so the callback can validate a state issued by any process
// and it survives app restarts — unlike an in-memory store, which breaks under
// Passenger/PM2 multi-process or idle-restart hosting.
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function signOAuthState(purpose, payload = {}) {
  const body = Buffer.from(
    JSON.stringify({
      p: String(purpose || ''),
      d: payload && typeof payload === 'object' ? payload : {},
      t: Date.now(),
      n: randomBytes(8).toString('hex'),
    })
  ).toString('base64url');
  const sig = createHmac('sha256', ADMIN_SECRET).update(`${purpose}.${body}`).digest('base64url');
  return `${body}.${sig}`;
}

// Returns the payload object on success, or null when invalid/expired/tampered.
function verifyOAuthState(purpose, state, maxAgeMs = OAUTH_STATE_TTL_MS) {
  const raw = sanitizeText(state);
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expect = createHmac('sha256', ADMIN_SECRET).update(`${purpose}.${body}`).digest('base64url');
  if (sig.length !== expect.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i += 1) diff |= sig.charCodeAt(i) ^ expect.charCodeAt(i);
  if (diff !== 0) return null;
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!parsed || parsed.p !== String(purpose || '')) return null;
  if (!Number.isFinite(parsed.t) || Date.now() - parsed.t > maxAgeMs) return null;
  return parsed.d && typeof parsed.d === 'object' ? parsed.d : {};
}

function buildOAuthState(accountKey = '') {
  return signOAuthState('sales-calendar', { accountKey: sanitizeText(accountKey) });
}

// Returns the associated accountKey string on success, or null when invalid/expired.
function consumeOAuthState(state) {
  const data = verifyOAuthState('sales-calendar', state);
  if (!data) return null;
  return sanitizeText(data.accountKey) || '';
}

// Sales area is accessible to the single admin account and to users with the `sales` role.
// Each principal gets a stable accountKey used to scope their own Google Calendar tokens.
function salesAuth(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload || (payload.role !== 'admin' && payload.role !== 'sales')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  if (payload.role === 'admin') {
    req.salesUser = { accountKey: `admin:${payload.username || 'admin'}`, isAdmin: true, role: 'admin' };
  } else {
    req.salesUser = { accountKey: `sales:${payload.userId}`, isAdmin: false, role: 'sales', userId: payload.userId };
  }
  next();
}

function canAccessSalesClient(req, client) {
  if (!client) return false;
  if (req.salesUser?.isAdmin) return true;
  return Boolean(client.ownerId) && client.ownerId === req.salesUser?.accountKey;
}

function buildClientGoogleOAuthState() {
  return signOAuthState('client-login', {});
}

function consumeClientGoogleOAuthState(state) {
  return verifyOAuthState('client-login', state) !== null;
}

function sendClientOAuthSuccessPage(res, { token, redirectPath }) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="no"><head><meta charset="utf-8"><title>Logger inn…</title></head>
<body><p>Logger inn…</p><script>
  try {
    localStorage.setItem('clientToken', ${JSON.stringify(token)});
    window.dispatchEvent(new Event('client-auth-changed'));
  } catch (e) {}
  window.location.replace(${JSON.stringify(redirectPath)});
</script></body></html>`);
}

function sendClientOAuthErrorPage(res, message) {
  const loginPath = '/login/kunde';
  res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="no"><head><meta charset="utf-8"><title>Innlogging feilet</title></head>
<body>
  <h2>Google-innlogging feilet</h2>
  <p>${String(message || 'Ukjent feil').replace(/[<>&"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[ch] || ch))}</p>
  <p><a href="${loginPath}">Tilbake til innlogging</a></p>
</body></html>`);
}

async function finalizeClientGoogleSignIn(googleProfile) {
  const email = normalizeEmail(googleProfile.email);
  if (!isValidEmail(email)) {
    throw new Error('Google returnerte en ugyldig e-postadresse.');
  }

  let user = await store.getUserByUsername(email);
  if (!user) {
    const tempPassword = randomBytes(24).toString('base64url');
    const created = await store.createUser(email, tempPassword, 'client');
    if (!created.ok) {
      throw new Error(created.error || 'Kunne ikke opprette konto.');
    }
    user = await store.getUserById(created.user.id);
  } else if (user.role !== 'client') {
    throw new Error('E-posten er registrert for en annen brukertype.');
  }

  const profile = clientPortal.upsertClientProfile(user.id, {
    email,
    name: googleProfile.name || undefined,
  });
  const token = signToken({ role: 'client', userId: user.id, at: Date.now(), provider: 'google' });
  const redirectPath = profile?.onboardingCompleted ? '/kunde/hjem' : '/kunde/onboarding';
  return { token, redirectPath, profile };
}

async function maybeSyncCalendar(client, previousClient = null) {
  const warnings = [];
  let nextClient = client;
  const accountKey = client.ownerId || '';

  if (!nextClient.agreedTime || !nextClient.meetingAt) {
    if (nextClient.calendar?.eventId) {
      try {
        await deleteMeetingEvent(nextClient.calendar.eventId, accountKey);
      } catch (error) {
        warnings.push(`Calendar cleanup failed: ${error.message}`);
      }
    }
    const cleared = sales.clearSalesMeetingScheduling(nextClient.id);
    return { client: cleared || nextClient, warnings };
  }

  const rescheduled = sales.rescheduleSalesReminders(nextClient.id);
  nextClient = rescheduled || nextClient;

  const calendarStatus = getGoogleCalendarStatus(accountKey);
  if (calendarStatus.configured && calendarStatus.connected) {
    try {
      const calendarMeta = await upsertMeetingEvent(nextClient, previousClient?.calendar?.eventId || nextClient?.calendar?.eventId, accountKey);
      const withCalendar = sales.setSalesCalendar(nextClient.id, calendarMeta);
      if (withCalendar) nextClient = withCalendar;
    } catch (error) {
      warnings.push(`Calendar sync failed: ${error.message}`);
    }
  } else if (calendarStatus.configured && !calendarStatus.connected) {
    warnings.push('Google Calendar is not connected for this salesperson yet. Connect it from the Sales page.');
  }

  return { client: nextClient, warnings };
}

async function sendSalesThankYou(client, { force = false } = {}) {
  if (!client?.agreedTime || !client?.meetingAt) return { sent: false, reason: 'meeting-not-scheduled' };
  if (!client?.contactEmail) return { sent: false, reason: 'missing-email' };
  if (!emailLib.canSendEmail()) return { sent: false, reason: 'smtp-not-configured' };
  if (!force && client?.reminders?.thankYouSentAt) return { sent: false, reason: 'already-sent' };
  const message = buildSalesThankYouEmail(client, client.calendar || {});
  await emailLib.sendEmail({
    to: client.contactEmail,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  const updated = sales.markSalesReminderSent(client.id, 'thankYou');
  return { sent: true, client: updated || client };
}

async function sendSalesReminderNow(client, kind = '24h') {
  if (!client?.agreedTime || !client?.meetingAt) return { sent: false, reason: 'meeting-not-scheduled' };
  if (!client?.contactEmail) return { sent: false, reason: 'missing-email' };
  if (!emailLib.canSendEmail()) return { sent: false, reason: 'smtp-not-configured' };
  const reminderKind = kind === '1h' ? '1h' : '24h';
  const message = buildSalesReminderEmail(client, client.calendar || {}, reminderKind);
  await emailLib.sendEmail({
    to: client.contactEmail,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  const updated = sales.markSalesReminderSent(client.id, reminderKind);
  return { sent: true, client: updated || client, kind: reminderKind };
}

function salesEmailFailureMessage(reason = '') {
  if (reason === 'meeting-not-scheduled') return 'Meeting date/time must be set before sending this email.';
  if (reason === 'missing-email') return 'Client contact email is missing.';
  if (reason === 'smtp-not-configured') return 'SMTP is not configured.';
  if (reason === 'already-sent') return 'Email was already sent.';
  return 'Could not send email.';
}

async function sendDueSalesReminders() {
  if (!SALES_EMAIL_AUTOSEND_ENABLED) return;
  if (salesReminderLoopRunning) return;
  if (!emailLib.canSendEmail()) return;
  salesReminderLoopRunning = true;
  try {
    const nowMs = Date.now();
    const clients = sales.getSalesClients();
    for (const client of clients) {
      if (!client.agreedTime || !client.meetingAt || client.reminders?.skipDueToShortNotice) continue;
      const meetingMs = new Date(client.meetingAt).getTime();
      if (!Number.isFinite(meetingMs) || meetingMs <= nowMs) continue;

      const reminder24hAt = client.reminders?.reminder24hAt ? new Date(client.reminders.reminder24hAt).getTime() : 0;
      const reminder1hAt = client.reminders?.reminder1hAt ? new Date(client.reminders.reminder1hAt).getTime() : 0;

      if (reminder24hAt && nowMs >= reminder24hAt && !client.reminders?.reminder24hSentAt) {
        const message = buildSalesReminderEmail(client, client.calendar || {}, '24h');
        await emailLib.sendEmail({
          to: client.contactEmail,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        sales.markSalesReminderSent(client.id, '24h');
      }

      if (reminder1hAt && nowMs >= reminder1hAt && !client.reminders?.reminder1hSentAt) {
        const message = buildSalesReminderEmail(client, client.calendar || {}, '1h');
        await emailLib.sendEmail({
          to: client.contactEmail,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        sales.markSalesReminderSent(client.id, '1h');
      }
    }
  } catch (error) {
    console.error('Sales reminder loop failed:', error);
  } finally {
    salesReminderLoopRunning = false;
  }
}

function startSalesReminderLoop() {
  if (!SALES_EMAIL_AUTOSEND_ENABLED) return;
  if (salesReminderInterval) return;
  salesReminderInterval = setInterval(() => {
    sendDueSalesReminders().catch((error) => console.error('Sales reminder tick failed:', error));
  }, SALES_REMINDER_POLL_MS);
}

app.get('/api/admin/users', adminAuth, async (_req, res) => {
  const users = await store.getAllUsers();
  res.json(users.map((u) => store.toPublicUser(u)));
});

app.post('/api/admin/users', adminAuth, async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }
  const result = await store.createUser(username, password, role || 'none');
  if (!result.ok) {
    return res.status(400).json({ message: result.error });
  }
  res.status(201).json(result.user);
});

app.put('/api/admin/users/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { username, password, role, employeeProduct } = req.body || {};
  if (username !== undefined) {
    const result = await store.updateUserUsername(id, username);
    if (!result.ok) return res.status(400).json({ message: result.error });
  }
  if (password !== undefined && password !== '') {
    const result = await store.updateUserPassword(id, password);
    if (!result.ok) return res.status(400).json({ message: result.error });
  }
  if (role !== undefined && ['employee', 'client', 'sales', 'none'].includes(role)) {
    const result = await store.updateUserRole(id, role);
    if (!result.ok) return res.status(400).json({ message: result.error });
  }
  if (employeeProduct !== undefined && ['asoldi', 'ssu'].includes(employeeProduct)) {
    const result = await store.updateUserEmployeeProduct(id, employeeProduct);
    if (!result.ok) return res.status(400).json({ message: result.error });
  }
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  const result = await store.deleteUser(req.params.id);
  if (!result.ok) return res.status(404).json({ message: result.error });
  res.json({ ok: true });
});

app.post('/api/admin/change-password', adminAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password required' });
  }
  const valid = await store.verifyAdmin(req.admin.username, currentPassword);
  if (!valid) return res.status(401).json({ message: 'Current password is wrong' });
  const admin = await store.getAdmin();
  if (!admin) return res.status(500).json({ message: 'Admin not found' });
  await store.setAdminCredentials(admin.username, newPassword);
  res.json({ ok: true });
});

app.get('/api/admin/employees/overview', adminAuth, async (_req, res) => {
  const users = await store.getAllUsers();
  employees.ensureWorkersForUsers(users);
  const workers = employees.getWorkers();
  const wpStatus = await employeeWordPress.testWordPressConnection().catch(() => false);
  const lucaStatus = await employeeLuca.testLucaConnection().catch(() => ({ connected: false, error: 'Unavailable' }));
  const myphonerStatus = await employeeMyPhoner.testMyPhonerConnection().catch(() => ({ connected: false, error: 'Unavailable' }));
  res.json({
    success: true,
    stats: employees.getDashboardStats(),
    workers,
    workersNeedingAttention: employees.getWorkersNeedingAttention(),
    topPerformers: employees.getTopPerformers(),
    syncState: employees.getSyncState(),
    integrations: {
      wordpress: { connected: !!wpStatus },
      luca: lucaStatus,
      myphoner: myphonerStatus,
    },
  });
});

app.get('/api/admin/employees/workers', adminAuth, async (_req, res) => {
  const users = await store.getAllUsers();
  employees.ensureWorkersForUsers(users);
  res.json({ success: true, workers: employees.getWorkers() });
});

app.post('/api/admin/employees/workers', adminAuth, (req, res) => {
  const { name, email, role, status, startDate, hourlyRate, commissionPerMeeting } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Name and email are required' });
  }
  const existing = employees.getWorkerByEmail(email);
  if (existing) {
    return res.status(400).json({ success: false, message: 'Worker already exists' });
  }
  const worker = employees.createWorker({
    name,
    email,
    role: role || 'caller',
    status: status || 'active',
    startDate: startDate || new Date().toISOString().slice(0, 10),
    paymentInfo: {
      hourlyRate: Number(hourlyRate || 0),
      commissionPerMeeting: Number(commissionPerMeeting || 0),
    },
  });
  res.status(201).json({ success: true, worker });
});

app.get('/api/admin/employees/workers/:id', adminAuth, (req, res) => {
  const worker = employees.getWorkerById(req.params.id);
  if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });
  res.json({ success: true, worker });
});

app.put('/api/admin/employees/workers/:id', adminAuth, (req, res) => {
  const worker = employees.updateWorker(req.params.id, req.body || {});
  if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });
  res.json({ success: true, worker });
});

app.delete('/api/admin/employees/workers/:id', adminAuth, (req, res) => {
  const ok = employees.deleteWorker(req.params.id);
  if (!ok) return res.status(404).json({ success: false, message: 'Worker not found' });
  res.json({ success: true });
});

app.patch('/api/admin/employees/workers/:id/checklist', adminAuth, (req, res) => {
  const { key, value } = req.body || {};
  const worker = employees.updateChecklistItem(req.params.id, key, value);
  if (!worker) return res.status(400).json({ success: false, message: 'Checklist update failed' });
  res.json({ success: true, worker });
});

app.post('/api/admin/employees/workers/:id/notes', adminAuth, (req, res) => {
  const { content } = req.body || {};
  if (!content || !String(content).trim()) {
    return res.status(400).json({ success: false, message: 'Note content required' });
  }
  const worker = employees.addNote(req.params.id, String(content).trim(), req.admin?.username || 'admin');
  if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });
  res.json({ success: true, worker, note: worker.notes[worker.notes.length - 1] });
});

app.patch('/api/admin/employees/workers/:id/payment', adminAuth, (req, res) => {
  const worker = employees.updatePaymentInfo(req.params.id, req.body || {});
  if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });
  res.json({ success: true, worker });
});

app.get('/api/admin/employees/payments', adminAuth, (_req, res) => {
  const workers = employees.getWorkers();
  res.json({
    success: true,
    workers,
    stats: employees.getDashboardStats(),
    totalOwed: workers.reduce((sum, worker) => sum + Number(worker.paymentInfo?.totalOwed || 0), 0),
  });
});

app.get('/api/admin/employees/reports', adminAuth, (_req, res) => {
  const workers = employees.getWorkers();
  const activeWorkers = workers.filter((worker) => worker.status === 'active');
  const averages = {
    calls: activeWorkers.length ? Math.round(activeWorkers.reduce((sum, worker) => sum + Number(worker.myphonerStats?.totalCalls || 0), 0) / activeWorkers.length) : 0,
    meetings: activeWorkers.length ? Math.round(activeWorkers.reduce((sum, worker) => sum + Number(worker.myphonerStats?.meetingsBooked || 0), 0) / activeWorkers.length) : 0,
    hours: activeWorkers.length ? Number((activeWorkers.reduce((sum, worker) => sum + Number(worker.myphonerStats?.hoursCalled || 0), 0) / activeWorkers.length).toFixed(1)) : 0,
    conversion: activeWorkers.length ? Number((activeWorkers.reduce((sum, worker) => sum + Number(worker.myphonerStats?.conversionRate || 0), 0) / activeWorkers.length).toFixed(1)) : 0,
  };
  res.json({
    success: true,
    stats: employees.getDashboardStats(),
    workers,
    topPerformers: employees.getTopPerformers(3),
    averages,
  });
});

app.get('/api/admin/employees/income', adminAuth, async (_req, res) => {
  const connection = await employeeLuca.testLucaConnection();
  if (!connection.connected) {
    return res.json({ success: false, connected: false, error: connection.error || 'Luca not connected', invoices: [], summary: null });
  }
  const result = await employeeLuca.getIncomeSummary();
  if (!result.success) {
    return res.status(500).json({ success: false, connected: true, error: result.error || 'Failed to fetch income' });
  }
  employees.markSync('luca', { invoices: result.invoices?.length || 0 });
  res.json({ success: true, connected: true, invoices: result.invoices, summary: result.summary });
});

app.get('/api/admin/employees/clients', adminAuth, async (_req, res) => {
  const result = await employeeLuca.getCustomersWithRevenue();
  if (!result.success) {
    return res.status(500).json({ success: false, error: result.error || 'Failed to fetch clients', customers: [] });
  }
  res.json({ success: true, customers: result.customers });
});

app.post('/api/admin/employees/sync/wordpress', adminAuth, async (_req, res) => {
  const result = await employeeWordPress.syncWordPressEmployees();
  if (!result.success) {
    return res.status(500).json({ success: false, error: result.error || 'Failed to sync WordPress employees' });
  }
  let added = 0;
  let updated = 0;
  for (const employee of result.employees) {
    const existing = employees.getWorkerByEmail(employee.email);
    employees.upsertWorkerByEmail(employee);
    if (existing) updated += 1;
    else added += 1;
  }
  employees.markSync('wordpress', { total: result.employees.length, added, updated });
  res.json({ success: true, total: result.employees.length, added, updated, workers: employees.getWorkers() });
});

app.post('/api/admin/employees/sync/myphoner', adminAuth, async (req, res) => {
  const interval = String(req.query.interval || 'month');
  const workers = employees.getWorkers();
  const result = await employeeMyPhoner.syncStatsForWorkers(workers, interval);
  if (!result.success) {
    return res.status(500).json({ success: false, error: result.error || 'Failed to sync MyPhoner stats' });
  }
  const syncedWorkers = result.results.map((entry) => employees.updateMyphonerStats(entry.workerId, entry.stats)).filter(Boolean);
  employees.markSync('myphoner', { interval, synced: syncedWorkers.length });
  res.json({ success: true, interval, synced: syncedWorkers.length, workers: employees.getWorkers(), results: result.results });
});

app.post('/api/admin/employees/sync/luca', adminAuth, async (_req, res) => {
  const connection = await employeeLuca.testLucaConnection();
  if (!connection.connected) {
    return res.status(500).json({ success: false, error: connection.error || 'Luca not connected' });
  }
  const income = await employeeLuca.getIncomeSummary();
  const customers = await employeeLuca.getCustomersWithRevenue();
  employees.markSync('luca', {
    invoices: income.invoices?.length || 0,
    customers: customers.customers?.length || 0,
  });
  res.json({
    success: income.success && customers.success,
    income: income.success ? { invoices: income.invoices, summary: income.summary } : null,
    customers: customers.success ? customers.customers : [],
    error: income.error || customers.error || '',
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }
  const result = await store.verifyStaff(username, password);
  if (!result.ok) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }
  const token = signToken({ role: result.user.role, userId: result.user.id, username: result.user.username, at: Date.now() });
  res.json({
    token,
    user: {
      id: result.user.id,
      username: result.user.username,
      role: result.user.role,
      employeeProduct: result.user.employeeProduct,
    },
  });
});

app.get('/api/client/auth/google/status', (req, res) => {
  res.json(getClientGoogleStatus(req));
});

// Which social login providers are actually configured + implemented (drives the UI buttons).
// Facebook stays false until a real Facebook OAuth flow is implemented (no dummy in production).
app.get('/api/client/auth/providers', (req, res) => {
  res.json({
    google: isClientGoogleConfigured(),
    facebook: false,
  });
});

app.get('/api/client/auth/google', (req, res) => {
  try {
    if (!isClientGoogleConfigured()) {
      return res.status(503).json({ message: 'Google login er ikke konfigurert enda.' });
    }
    const redirectUri = resolveClientGoogleRedirectUri(req);
    const state = buildClientGoogleOAuthState();
    const authUrl = createClientGoogleAuthUrl(state, redirectUri);
    return res.redirect(authUrl);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to start Google login.' });
  }
});

app.get('/api/client/auth/google/callback', async (req, res) => {
  const code = sanitizeText(req.query.code);
  const state = sanitizeText(req.query.state);
  const oauthError = sanitizeText(req.query.error);

  if (oauthError) {
    return sendClientOAuthErrorPage(res, oauthError === 'access_denied'
      ? 'Du avbrøt Google-innloggingen.'
      : `Google returnerte feil: ${oauthError}`);
  }
  if (!consumeClientGoogleOAuthState(state)) {
    return sendClientOAuthErrorPage(res, 'Ugyldig eller utløpt OAuth-tilstand. Prøv igjen.');
  }
  if (!code) {
    return sendClientOAuthErrorPage(res, 'Mangler autorisasjonskode fra Google.');
  }

  try {
    const redirectUri = resolveClientGoogleRedirectUri(req);
    const googleProfile = await exchangeClientGoogleCode(code, redirectUri);
    const session = await finalizeClientGoogleSignIn(googleProfile);
    return sendClientOAuthSuccessPage(res, session);
  } catch (error) {
    return sendClientOAuthErrorPage(res, error.message || 'Google-innlogging feilet.');
  }
});

app.post('/api/client/auth/email-status', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Skriv inn en gyldig e-postadresse.' });
  }
  const user = await store.getUserByUsername(email);
  if (!user) {
    return res.json({
      exists: false,
      role: null,
      suggestedFlow: 'signup',
    });
  }
  if (user.role !== 'client') {
    return res.status(409).json({
      exists: true,
      role: user.role,
      message: 'Denne e-posten er registrert for en annen brukertype.',
    });
  }
  clientPortal.ensureClientProfileForUser(user);
  return res.json({
    exists: true,
    role: 'client',
    suggestedFlow: 'login',
  });
});

app.post('/api/client/auth/signup', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Skriv inn en gyldig e-postadresse.' });
  }
  if (!passwordValid(password)) {
    return res.status(400).json({ message: 'Passord må være minst 8 tegn.' });
  }

  const existing = await store.getUserByUsername(email);
  if (existing) {
    if (existing.role === 'client') {
      return res.status(409).json({ message: 'Kontoen finnes allerede. Logg inn i stedet.' });
    }
    return res.status(409).json({ message: 'E-posten er allerede registrert for en annen brukertype.' });
  }

  const created = await store.createUser(email, password, 'client');
  if (!created.ok) {
    return res.status(400).json({ message: created.error || 'Kunne ikke opprette konto.' });
  }
  const user = await store.getUserById(created.user.id);
  const profile = clientPortal.ensureClientProfileForUser(user);
  const token = signToken({ role: 'client', userId: created.user.id, at: Date.now() });
  res.status(201).json({
    token,
    user: {
      id: created.user.id,
      email,
      role: 'client',
    },
    profile,
  });
});

app.post('/api/client/auth/social-signin', async (req, res) => {
  const provider = sanitizeText(req.body?.provider || '').toLowerCase();
  const email = normalizeEmail(req.body?.email);
  const name = sanitizeText(req.body?.name);
  if (!['google', 'facebook'].includes(provider)) {
    return res.status(400).json({ message: 'Ugyldig leverandør.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Skriv inn en gyldig e-postadresse.' });
  }
  if (provider === 'google' && isClientGoogleConfigured()) {
    return res.status(400).json({
      message: 'Bruk Google-knappen for omdirigert innlogging.',
      authUrl: '/api/client/auth/google',
    });
  }
  if (!CLIENT_SOCIAL_DEV_MODE) {
    return res.status(503).json({
      message: `${provider === 'google' ? 'Google' : 'Facebook'} login er ikke konfigurert enda.`,
    });
  }

  let user = await store.getUserByUsername(email);
  if (!user) {
    const tempPassword = randomBytes(24).toString('base64url');
    const created = await store.createUser(email, tempPassword, 'client');
    if (!created.ok) {
      return res.status(400).json({ message: created.error || 'Kunne ikke opprette konto.' });
    }
    user = await store.getUserById(created.user.id);
  } else if (user.role !== 'client') {
    return res.status(409).json({ message: 'E-posten er registrert for en annen brukertype.' });
  }

  const profile = clientPortal.upsertClientProfile(user.id, {
    email,
    name: name || undefined,
  });
  const token = signToken({ role: 'client', userId: user.id, at: Date.now(), provider });
  res.json({
    token,
    user: {
      id: user.id,
      email,
      role: 'client',
      provider,
    },
    profile,
  });
});

app.post('/api/client/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ message: 'E-post og passord er påkrevd.' });
  }
  const result = await store.verifyClient(email, password);
  if (!result.ok) {
    return res.status(401).json({ message: 'Ugyldig e-post eller passord.' });
  }
  const user = await store.getUserById(result.user.id);
  const profile = clientPortal.ensureClientProfileForUser(user);
  const token = signToken({ role: 'client', userId: result.user.id, at: Date.now() });
  res.json({
    token,
    user: {
      id: result.user.id,
      email: result.user.username,
      role: 'client',
    },
    profile,
  });
});

app.post('/api/client/auth/forgot-password', async (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (!rateLimitForgotPassword(ip)) {
    return res.status(429).json({ message: 'For mange forespørsler. Prøv igjen om 15 minutter.' });
  }
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Skriv inn en gyldig e-postadresse.' });
  }
  const user = await store.getUserByUsername(email);
  if (!user || user.role !== 'client') {
    return res.json({ ok: true, message: 'Hvis e-posten finnes, sender vi en lenke for tilbakestilling.' });
  }
  if (!emailLib.canSendEmail()) {
    return res.status(503).json({ message: 'E-post er ikke konfigurert. Kontakt administrator.' });
  }
  const token = randomBytes(32).toString('base64url');
  resetTokens.saveResetToken(token, user.id, user.username);
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const resetUrl = `${baseUrl.replace(/\/$/, '')}/login/kunde/reset-password?token=${token}`;
  try {
    await emailLib.sendEmail({
      to: user.username,
      subject: 'Tilbakestill passord – Asoldi Kundeportal',
      text: `Hei,\n\nDu ba om å tilbakestille passordet ditt i kundeportalen. Klikk på lenken under:\n\n${resetUrl}\n\nLenken utløper om 1 time.\n\nHilsen Asoldi`,
      html: `<p>Hei,</p><p>Du ba om å tilbakestille passordet ditt i kundeportalen.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Lenken utløper om 1 time.</p><p>Hilsen Asoldi</p>`,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Kunne ikke sende e-post. Prøv igjen senere.' });
  }
  return res.json({ ok: true, message: 'Hvis e-posten finnes, sender vi en lenke for tilbakestilling.' });
});

app.post('/api/client/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token og nytt passord kreves.' });
  }
  if (!passwordValid(newPassword)) {
    return res.status(400).json({ message: 'Passord må være minst 8 tegn.' });
  }
  const entry = resetTokens.consumeResetToken(token);
  if (!entry) {
    return res.status(400).json({ message: 'Lenken er ugyldig eller utløpt.' });
  }
  const user = await store.getUserById(entry.userId);
  if (!user || user.role !== 'client') {
    return res.status(403).json({ message: 'Denne tilbakestillingslenken tilhører ikke en klientkonto.' });
  }
  const result = await store.updateUserPassword(entry.userId, newPassword);
  if (!result.ok) {
    return res.status(500).json({ message: 'Kunne ikke oppdatere passord.' });
  }
  return res.json({ ok: true, message: 'Passordet er oppdatert. Logg inn på nytt.' });
});

function clientAuth(req, res, next) {
  const token = clientTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'client') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  req.client = payload;
  return next();
}

app.get('/api/client/auth/me', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') {
    return res.status(401).json({ message: 'User not found' });
  }
  const profile = clientPortal.ensureClientProfileForUser(user);
  return res.json({
    user: {
      id: user.id,
      email: user.username,
      role: 'client',
    },
    profile,
  });
});

app.get('/api/client/profile', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  const profile = clientPortal.ensureClientProfileForUser(user);
  return res.json({ profile });
});

app.put('/api/client/profile', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  const body = req.body || {};
  const profile = clientPortal.upsertClientProfile(user.id, {
    name: sanitizeText(body.name),
    businessName: sanitizeText(body.businessName),
    businessOrgNumber: sanitizeText(body.businessOrgNumber || body.organizationNumber),
    position: sanitizeText(body.position),
    discoveryChannel: sanitizeText(body.discoveryChannel),
    onboardingCompleted: parseBoolean(body.onboardingCompleted, true),
  });
  return res.json({ profile });
});

app.get('/api/client/brreg-search', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  const query = sanitizeText(req.query?.q);
  if (query.length < 2) return res.json({ results: [] });
  try {
    const results = await searchBrregBusinesses(query);
    return res.json({ results });
  } catch (error) {
    return res.status(502).json({ message: error.message || 'Failed searching BRREG.' });
  }
});

app.get('/api/client/dashboard', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  const profile = clientPortal.ensureClientProfileForUser(user);
  const dashboard = clientPortal.getClientDashboardData(profile);
  return res.json({
    profile,
    dashboard,
  });
});

app.get('/api/client/plans/website', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  const profile = clientPortal.ensureClientProfileForUser(user);
  const customPlan = profile?.customWebsitePlan
    ? {
        ...profile.customWebsitePlan,
        monthlyPrice: typeof profile.customWebsitePlan.monthlyPrice === 'number'
          ? `${profile.customWebsitePlan.monthlyPrice},-/mnd`
          : sanitizeText(profile.customWebsitePlan.monthlyPrice) || 'Etter avtale',
      }
    : null;
  return res.json({
    customPlan,
    plans: CLIENT_WEBSITE_PLANS,
  });
});

app.post('/api/client/plans/website/select', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });

  const planId = sanitizeText(req.body?.planId);
  const type = sanitizeText(req.body?.type || 'standard');

  let selectedPlan = null;
  if (type === 'custom') {
    const profile = clientPortal.ensureClientProfileForUser(user);
    const customPrice = profile?.customWebsitePlan?.monthlyPrice;
    selectedPlan = {
      id: 'custom-website-plan',
      name: profile.customWebsitePlan?.title || 'Din nettside plan',
      price: typeof customPrice === 'number' ? `${customPrice},-/mnd` : sanitizeText(customPrice) || 'Etter avtale',
      type: 'custom',
    };
  } else {
    const found = CLIENT_WEBSITE_PLANS.find((entry) => entry.id === planId);
    if (!found) return res.status(400).json({ message: 'Ugyldig planvalg.' });
    selectedPlan = {
      id: found.id,
      name: found.name,
      price: found.price,
      type: 'standard',
    };
  }

  const profile = clientPortal.setClientSelectedWebsitePlan(user.id, selectedPlan);
  return res.json({ profile, selectedPlan });
});

// --- Stripe card checkout (embedded) -------------------------------------

// Public-safe config the client portal needs to mount embedded Checkout.
app.get('/api/client/checkout/config', clientAuth, (req, res) => {
  const publishableKey = getPublishableKey();
  return res.json({
    configured: isStripeConfigured() && Boolean(publishableKey),
    publishableKey,
    currency: getStripeCurrency(),
  });
});

// Resolves the client's saved plan to a Stripe subscription line item and
// creates an embedded Checkout Session. Standard tiers use a configured Price
// id; the rep-set offer/custom tier uses its own price id when present, else an
// inline recurring price built from its monthly amount.
app.post('/api/client/checkout/create-session', clientAuth, async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ message: 'Kortbetaling er ikke konfigurert enda.' });
  }
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  const profile = clientPortal.ensureClientProfileForUser(user);
  const builder = profile.websiteBuilder || {};
  const type = sanitizeText(builder.selectedPlanType) || 'standard';

  let lineItem = null;
  let planName = '';
  let amount = 0;

  if (type === 'custom') {
    const custom = profile.customWebsitePlan || {};
    planName = sanitizeText(custom.title || custom.name) || 'Din nettside plan';
    const priceId = sanitizeText(custom.stripePriceId);
    if (priceId) {
      lineItem = { price: priceId, quantity: 1 };
    } else {
      const monthly = typeof custom.monthlyPrice === 'number'
        ? custom.monthlyPrice
        : Number.parseInt(String(custom.monthlyPrice ?? '').replace(/[^\d]/g, ''), 10);
      if (!Number.isFinite(monthly) || monthly <= 0) {
        return res.status(400).json({
          message: 'Denne planen har ikke en fast pris. Velg faktura, eller kontakt oss for et tilbud.',
          code: 'no-fixed-price',
        });
      }
      amount = monthly;
      lineItem = {
        price_data: {
          currency: getStripeCurrency(),
          unit_amount: Math.round(monthly * 100),
          recurring: { interval: 'month' },
          product_data: { name: planName },
        },
        quantity: 1,
      };
    }
  } else {
    const found = findWebsitePlan(builder.selectedPlanId);
    if (!found) return res.status(400).json({ message: 'Ingen gyldig plan valgt. Velg plan først.' });
    planName = found.name;
    const priceId = priceIdForPlan(found.id);
    if (!priceId) {
      return res.status(503).json({ message: `Mangler Stripe-pris for ${found.name}. Sett STRIPE_PRICE_* i miljøet.` });
    }
    lineItem = { price: priceId, quantity: 1 };
  }

  const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  try {
    const stripe = getStripe();
    const sessionParams = {
      mode: 'subscription',
      ui_mode: 'embedded',
      line_items: [lineItem],
      // Shows Stripe's "Add promotion code" field in the embedded checkout so a
      // coupon/promotion code (e.g. a 50%-off first-time code) is applied and
      // enforced by Stripe on the actual charge.
      allow_promotion_codes: true,
      client_reference_id: user.id,
      return_url: `${appUrl}/kunde/tjenester/nettside/checkout?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        userId: String(user.id),
        planId: sanitizeText(builder.selectedPlanId),
        planName,
        planType: type,
        amount: String(amount || ''),
      },
      subscription_data: { metadata: { userId: String(user.id), planType: type } },
    };
    const existingCustomer = sanitizeText(profile.payment?.stripeCustomerId);
    if (existingCustomer) {
      sessionParams.customer = existingCustomer;
    } else {
      const email = normalizeEmail(profile.email || user.username);
      if (email) sessionParams.customer_email = email;
    }
    const session = await stripe.checkout.sessions.create(sessionParams);
    clientPortal.setClientPayment(user.id, {
      status: 'processing',
      method: 'card',
      planId: sanitizeText(builder.selectedPlanId),
      planName,
      amount,
      currency: getStripeCurrency(),
      stripeSessionId: session.id,
    });
    return res.json({ clientSecret: session.client_secret });
  } catch (error) {
    console.error('Stripe create-session error:', error?.message || error);
    return res.status(500).json({ message: 'Kunne ikke starte betaling. Prøv igjen.' });
  }
});

// Lets the return page show the right status after embedded Checkout completes.
app.get('/api/client/checkout/session-status', clientAuth, async (req, res) => {
  if (!isStripeConfigured()) return res.status(503).json({ message: 'Stripe ikke konfigurert.' });
  const sessionId = sanitizeText(req.query.session_id);
  if (!sessionId) return res.status(400).json({ message: 'Mangler session_id.' });
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const ref = sanitizeText(session.client_reference_id);
    if (ref && ref !== sanitizeText(req.client.userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return res.json({ status: session.status, paymentStatus: session.payment_status });
  } catch (error) {
    console.error('Stripe session-status error:', error?.message || error);
    return res.status(500).json({ message: 'Kunne ikke hente status.' });
  }
});

// Faktura (EHF) path: capture the business org details, mark the request, and
// notify Asoldi to issue the e-invoice. Full PEPPOL/EHF automation comes later.
app.post('/api/client/checkout/request-faktura', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  const profile = clientPortal.ensureClientProfileForUser(user);
  const orgNumber = sanitizeText(req.body?.orgNumber).replace(/\s+/g, '');
  if (!/^\d{9}$/.test(orgNumber)) {
    return res.status(400).json({ message: 'Oppgi et gyldig organisasjonsnummer (9 siffer).' });
  }
  const businessName = sanitizeText(req.body?.businessName) || sanitizeText(profile.businessName);
  const invoiceEmail = normalizeEmail(req.body?.invoiceEmail || profile.email || user.username);
  const builder = profile.websiteBuilder || {};
  const planName = builder.selectedPlanType === 'custom'
    ? (sanitizeText(profile.customWebsitePlan?.title) || 'Din nettside plan')
    : (findWebsitePlan(builder.selectedPlanId)?.name || sanitizeText(builder.selectedPlanName));

  clientPortal.setClientPayment(user.id, {
    status: 'invoice_requested',
    method: 'faktura',
    planId: sanitizeText(builder.selectedPlanId),
    planName,
    invoiceRequest: { orgNumber, businessName, invoiceEmail, requestedAt: new Date().toISOString() },
  });

  if (emailLib.canSendEmail()) {
    try {
      await emailLib.sendEmail({
        to: process.env.SALES_NOTIFY_EMAIL || process.env.SMTP_USER || 'contact@asoldi.com',
        subject: `[Asoldi] EHF-faktura forespurt: ${businessName || invoiceEmail}`,
        text: [
          'En kunde har bedt om faktura (EHF).',
          '',
          `Bedrift: ${businessName || '—'}`,
          `Org.nr: ${orgNumber}`,
          `Faktura-e-post: ${invoiceEmail || '—'}`,
          `Plan: ${planName || '—'}`,
          `Konto: ${user.username} (userId ${user.id})`,
        ].join('\n'),
      });
    } catch (error) {
      console.error('Faktura notify email failed:', error?.message || error);
    }
  }

  return res.json({ ok: true });
});

// Verifies the Stripe webhook signature and reconciles subscription state onto
// the client's profile. Registered with a raw body parser before express.json().
async function handleStripeWebhook(req, res) {
  const secret = getWebhookSecret();
  if (!isStripeConfigured() || !secret) {
    return res.status(503).send('Stripe webhook not configured');
  }
  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, secret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error?.message || error);
    return res.status(400).send(`Webhook Error: ${error?.message || 'invalid signature'}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object || {};
        const userId = sanitizeText(session.client_reference_id || session.metadata?.userId);
        if (userId) {
          clientPortal.setClientPayment(userId, {
            status: 'active',
            method: 'card',
            planId: sanitizeText(session.metadata?.planId),
            planName: sanitizeText(session.metadata?.planName),
            amount: Number(session.amount_total ? session.amount_total / 100 : session.metadata?.amount || 0) || 0,
            currency: sanitizeText(session.currency) || getStripeCurrency(),
            stripeCustomerId: sanitizeText(session.customer),
            stripeSubscriptionId: sanitizeText(session.subscription),
            stripeSessionId: sanitizeText(session.id),
            paidAt: new Date().toISOString(),
          });
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object || {};
        const profile = clientPortal.getClientProfileByStripeCustomerId(sanitizeText(invoice.customer));
        if (profile) clientPortal.setClientPayment(profile.userId, { status: 'past_due' });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object || {};
        const profile = clientPortal.getClientProfileByStripeCustomerId(sanitizeText(sub.customer));
        if (profile) clientPortal.setClientPayment(profile.userId, { status: 'canceled' });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error('Stripe webhook handler error:', error?.message || error);
  }

  return res.json({ received: true });
}

app.get('/api/client/offer', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  let offer = offers.getActiveOfferForUser({ userId: user.id, email: user.username });
  if (!offer) return res.json({ offer: null });
  offer = hydrateOfferPreviewFromSalesImport(offer, { persist: true });
  const plan = findWebsitePlan(offer.planId);
  return res.json({
    offer: {
      ...offer,
      planName: offer.planName || plan?.name || '',
      price: offer.price || plan?.price || '',
    },
  });
});

app.post('/api/client/website/existing-code', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  const code = offers.normalizeCode(req.body?.code);
  if (code.length !== 4) {
    return res.status(400).json({ message: 'Koden må være 2 bokstaver og 2 tall (f.eks. AB12).' });
  }
  const offer = offers.getOfferByCode(code);
  if (!offer) {
    return res.status(404).json({ message: 'Fant ingen tilbud med denne koden. Sjekk at koden er riktig.' });
  }
  const claimed = offers.claimOffer(offer.id, { userId: user.id, email: user.username });
  clientPortal.setClientExistingWebsiteCode(user.id, code);
  const plan = findWebsitePlan(offer.planId);
  if (plan) {
    clientPortal.setClientSelectedWebsitePlan(user.id, {
      id: plan.id,
      name: plan.name,
      price: plan.price,
      type: 'standard',
    });
  }
  const profile = clientPortal.ensureClientProfileForUser(user);
  return res.json({
    profile,
    code,
    offer: claimed || offer,
    redirect: '/kunde/tjenester/nettside/planer',
  });
});

function issueResetTokenForUser(user, req, resetPath) {
  const token = randomBytes(32).toString('base64url');
  resetTokens.saveResetToken(token, user.id, user.username);
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const resetUrl = `${baseUrl.replace(/\/$/, '')}${resetPath}?token=${token}`;
  return { token, resetUrl };
}

app.post('/api/client-auth/check-email', async (req, res) => {
  const email = sanitizeText(req.body?.email || '').toLowerCase();
  if (!email) return res.status(400).json({ message: 'E-post er påkrevd.' });
  const user = await store.getUserByUsername(email);
  if (!user || user.role !== 'client') {
    return res.json({
      exists: false,
      authMethods: ['google', 'facebook', 'direct'],
      directEnabled: true,
    });
  }
  return res.json({
    exists: true,
    authMethods: ['google', 'facebook', 'direct'],
    directEnabled: true,
  });
});

app.post('/api/client-auth/register', async (req, res) => {
  const email = sanitizeText(req.body?.email || '').toLowerCase();
  const password = String(req.body?.password || '');
  if (!email) return res.status(400).json({ message: 'E-post er påkrevd.' });
  if (!password || password.length < 8) {
    return res.status(400).json({ message: 'Passord må være minst 8 tegn.' });
  }
  const existing = await store.getUserByUsername(email);
  if (existing) {
    if (existing.role !== 'client') {
      return res.status(400).json({ message: 'Denne e-posten er allerede registrert med en annen rolle.' });
    }
    return res.status(409).json({ message: 'Konto finnes allerede. Logg inn i stedet.' });
  }
  const created = await store.createUser(email, password, 'client');
  if (!created.ok) {
    return res.status(400).json({ message: created.error || 'Kunne ikke opprette konto.' });
  }
  const token = signToken({ role: 'client', userId: created.user.id, at: Date.now() });
  clientPortal.upsertClientProfile(created.user.id, {
    userId: created.user.id,
    email,
    onboardingComplete: false,
  });
  res.status(201).json({
    token,
    user: {
      id: created.user.id,
      email,
      role: 'client',
    },
  });
});

app.post('/api/client-auth/login', async (req, res) => {
  const email = sanitizeText(req.body?.email || '').toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) {
    return res.status(400).json({ message: 'E-post og passord er påkrevd.' });
  }
  const result = await store.verifyClient(email, password);
  if (!result.ok) {
    return res.status(401).json({ message: 'Ugyldig e-post eller passord.' });
  }
  const token = signToken({ role: 'client', userId: result.user.id, at: Date.now() });
  const profile = clientPortal.getClientProfile(result.user.id) || clientPortal.upsertClientProfile(result.user.id, {
    userId: result.user.id,
    email,
    onboardingComplete: false,
  });
  res.json({
    token,
    user: {
      id: result.user.id,
      email,
      role: 'client',
      onboardingComplete: Boolean(profile.onboardingComplete),
    },
  });
});

app.post('/api/client-auth/forgot-password', async (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (!rateLimitForgotPassword(ip)) {
    return res.status(429).json({ message: 'For mange forespørsler. Prøv igjen om 15 minutter.' });
  }
  const email = sanitizeText(req.body?.email || '').toLowerCase();
  if (!email) return res.status(400).json({ message: 'E-post er påkrevd.' });

  const user = await store.getUserByUsername(email);
  if (!user || user.role !== 'client') {
    return res.json({ ok: true, message: 'Hvis e-posten finnes, sender vi en lenke for å tilbakestille passordet.' });
  }
  if (!emailLib.canSendEmail()) {
    return res.status(503).json({ message: 'E-post er ikke konfigurert.' });
  }

  const { resetUrl } = issueResetTokenForUser(user, req, '/login/client/reset-password');
  try {
    await emailLib.sendEmail({
      to: user.username,
      subject: 'Tilbakestill passord – Asoldi kundeportal',
      text: `Hei,\n\nDu ba om å tilbakestille passordet ditt for kundeportalen.\n\nKlikk her: ${resetUrl}\n\nLenken utløper om 1 time.\n\nHilsen Asoldi`,
      html: `<p>Hei,</p><p>Du ba om å tilbakestille passordet ditt for kundeportalen.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Lenken utløper om 1 time.</p><p>Hilsen Asoldi</p>`,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Kunne ikke sende e-post akkurat nå.' });
  }
  return res.json({ ok: true, message: 'Hvis e-posten finnes, sender vi en lenke for å tilbakestille passordet.' });
});

app.post('/api/client-auth/reset-password', async (req, res) => {
  const token = sanitizeText(req.body?.token || '');
  const newPassword = String(req.body?.newPassword || '');
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token og nytt passord er påkrevd.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'Passord må være minst 8 tegn.' });
  }
  const entry = resetTokens.consumeResetToken(token);
  if (!entry) {
    return res.status(400).json({ message: 'Lenken er ugyldig eller utløpt.' });
  }
  const user = await store.getUserById(entry.userId);
  if (!user || user.role !== 'client') {
    return res.status(400).json({ message: 'Lenken tilhører ikke en kundekonto.' });
  }
  const result = await store.updateUserPassword(entry.userId, newPassword);
  if (!result.ok) {
    return res.status(500).json({ message: 'Kunne ikke oppdatere passord.' });
  }
  return res.json({ ok: true, message: 'Passordet er oppdatert. Du kan nå logge inn.' });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (!rateLimitForgotPassword(ip)) {
    return res.status(429).json({ message: 'For mange forespørsler. Prøv igjen om 15 minutter.' });
  }
  const { username } = req.body || {};
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ message: 'E-post kreves' });
  }
  const user = await store.getUserByUsername(username.trim());
  if (!user || user.role !== 'employee') {
    return res.json({ ok: true, message: 'Hvis e-posten finnes, vil du motta en lenke for å tilbakestille passordet.' });
  }
  if (!emailLib.canSendEmail()) {
    return res.status(503).json({ message: 'E-post er ikke konfigurert. Kontakt administrator.' });
  }
  const token = randomBytes(32).toString('base64url');
  resetTokens.saveResetToken(token, user.id, user.username);
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const resetUrl = `${baseUrl.replace(/\/$/, '')}/login/reset-password?token=${token}`;
  try {
    await emailLib.sendEmail({
      to: user.username,
      subject: 'Tilbakestill passord – Asoldi',
      text: `Hei,\n\nDu ba om å tilbakestille passordet ditt. Klikk på lenken under for å velge et nytt passord:\n\n${resetUrl}\n\nLenken utløper om 1 time.\n\nHvis du ikke ba om dette, kan du ignorere denne e-posten.\n\nMed vennlig hilsen,\nAsoldi`,
      html: `<p>Hei,</p><p>Du ba om å tilbakestille passordet ditt. Klikk på lenken under for å velge et nytt passord:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Lenken utløper om 1 time.</p><p>Hvis du ikke ba om dette, kan du ignorere denne e-posten.</p><p>Med vennlig hilsen,<br>Asoldi</p>`,
    });
  } catch (err) {
    console.error('Forgot password email error:', err);
    return res.status(500).json({ message: 'Kunne ikke sende e-post. Prøv igjen senere.' });
  }
  res.json({ ok: true, message: 'Hvis e-posten finnes, vil du motta en lenke for å tilbakestille passordet.' });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token og nytt passord kreves' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'Passordet må være minst 8 tegn' });
  }
  const entry = resetTokens.consumeResetToken(token);
  if (!entry) {
    return res.status(400).json({ message: 'Lenken er ugyldig eller utløpt. Be om en ny.' });
  }
  const result = await store.updateUserPassword(entry.userId, newPassword);
  if (!result.ok) {
    return res.status(500).json({ message: 'Kunne ikke oppdatere passord.' });
  }
  res.json({ ok: true, message: 'Passordet er tilbakestilt. Du kan nå logge inn.' });
});

function employeeAuth(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'employee') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  req.employee = payload;
  next();
}

function clientAuthV2(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'client') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  req.clientUser = payload;
  next();
}

app.get('/api/auth/me', employeeAuth, async (req, res) => {
  const user = await store.getUserById(req.employee.userId);
  if (!user) return res.status(401).json({ message: 'User not found' });
  if (user.role !== 'employee') {
    return res.status(403).json({ message: 'Access denied. Employee role required.' });
  }
  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      employeeProduct: store.toPublicUser(user).employeeProduct,
    },
  });
});

app.get('/api/client-auth/me', clientAuthV2, async (req, res) => {
  const user = await store.getUserById(req.clientUser.userId);
  if (!user) return res.status(401).json({ message: 'User not found' });
  if (user.role !== 'client') {
    return res.status(403).json({ message: 'Access denied. Client role required.' });
  }
  const profile = clientPortal.getClientProfile(user.id) || clientPortal.upsertClientProfile(user.id, {
    userId: user.id,
    email: user.username,
    onboardingComplete: false,
  });
  res.json({
    user: {
      id: user.id,
      email: user.username,
      role: user.role,
      onboardingComplete: Boolean(profile.onboardingComplete),
    },
    profile,
  });
});

app.get('/api/client-auth/profile', clientAuthV2, async (req, res) => {
  const user = await store.getUserById(req.clientUser.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'User not found' });
  const profile = clientPortal.getClientProfile(user.id) || clientPortal.upsertClientProfile(user.id, {
    userId: user.id,
    email: user.username,
    onboardingComplete: false,
  });
  res.json({ profile });
});

app.put('/api/client-auth/profile', clientAuthV2, async (req, res) => {
  const user = await store.getUserById(req.clientUser.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'User not found' });
  const fullName = sanitizeText(req.body?.fullName || '');
  const businessName = sanitizeText(req.body?.businessName || '');
  const businessOrgNumber = sanitizeText(req.body?.businessOrgNumber || req.body?.organizationNumber || '');
  const position = sanitizeText(req.body?.position || '');
  const source = sanitizeText(req.body?.source || '');
  const onboardingComplete = parseBoolean(req.body?.onboardingComplete, false);

  const profile = clientPortal.upsertClientProfile(user.id, {
    userId: user.id,
    email: user.username,
    fullName,
    businessName,
    businessOrgNumber,
    position,
    source,
    onboardingComplete,
  });
  res.json({ profile });
});

app.get('/api/client-portal/state', clientAuthV2, async (req, res) => {
  const state = clientPortal.getClientPortalState(req.clientUser.userId);
  res.json({ state });
});

app.patch('/api/client-portal/state', clientAuthV2, async (req, res) => {
  const patch = req.body && typeof req.body === 'object' ? req.body : {};
  const state = clientPortal.updateClientPortalState(req.clientUser.userId, patch);
  res.json({ state });
});

// --- Hub API (public: site config for client CMS)
app.get('/api/hub/site-config', (req, res) => {
  const siteKey = req.query.site_key;
  const domain = req.query.domain;
  if (siteKey) {
    const config = hub.getSiteConfig(siteKey, false);
    if (!config) return res.status(404).json({ message: 'Site not found' });
    return res.json({ features: config.features, name: config.name, id: config.id });
  }
  if (domain) {
    const config = hub.getSiteConfig(domain, true);
    if (!config) return res.status(404).json({ message: 'Site not found' });
    return res.json({ features: config.features, name: config.name, id: config.id });
  }
  return res.status(400).json({ message: 'Provide site_key or domain' });
});

// --- CMS config (for client CMS on this server: lookup by env CMS_SITE_KEY or by Host)
app.get('/api/cms/config', (req, res) => {
  const siteKey = process.env.CMS_SITE_KEY;
  if (siteKey) {
    const config = hub.getSiteConfig(siteKey, false);
    if (config) return res.json({ features: config.features, name: config.name, id: config.id });
  }
  const host = (req.get('host') || '').split(':')[0];
  const config = hub.getSiteConfig(host, true);
  if (config) return res.json({ features: config.features, name: config.name, id: config.id });
  res.json({ features: { users: true, analytics: false, ecommerce: false }, name: 'Site' });
});

// --- Super-admin: hub sites CRUD (admin only)
app.get('/api/hub/sites', adminAuth, (_req, res) => {
  res.json(hub.getAllSites());
});

app.post('/api/hub/sites', adminAuth, (req, res) => {
  const { name, domain } = req.body || {};
  const site = hub.createSite({ name: name || 'New site', domain: domain || '' });
  res.status(201).json(site);
});

app.put('/api/hub/sites/:id', adminAuth, (req, res) => {
  const result = hub.updateSite(req.params.id, req.body || {});
  if (!result.ok) return res.status(404).json({ message: result.error });
  res.json(result.site);
});

app.delete('/api/hub/sites/:id', adminAuth, (req, res) => {
  const result = hub.deleteSite(req.params.id);
  if (!result.ok) return res.status(404).json({ message: result.error });
  res.json({ ok: true });
});

async function resolveImportedSiteRoot(importDir, preferredSiteFolder) {
  const preferred = join(importDir, preferredSiteFolder);
  if (existsSync(join(preferred, 'index.html'))) return preferred;
  if (existsSync(join(importDir, 'index.html'))) return importDir;

  const entries = await fs.readdir(importDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = join(importDir, entry.name);
    if (existsSync(join(candidate, 'index.html'))) return candidate;
  }
  return '';
}

// --- Sales workflow (admin + sales role). Each principal scopes to their own calendar/clients.
app.get('/api/admin/sales/google/status', salesAuth, (req, res) => {
  res.json(getGoogleCalendarStatus(req.salesUser.accountKey));
});

app.get('/api/admin/sales/google/auth-url', salesAuth, (req, res) => {
  try {
    const state = buildOAuthState(req.salesUser.accountKey);
    const authUrl = createGoogleCalendarAuthUrl(state);
    res.json({ authUrl, state });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to create Google auth URL.' });
  }
});

app.get('/api/admin/sales/google/oauth/callback', async (req, res) => {
  const code = sanitizeText(req.query.code);
  const state = sanitizeText(req.query.state);
  const accountKey = consumeOAuthState(state);
  if (accountKey === null) {
    return res.status(400).send('<h2>Invalid or expired OAuth state.</h2>');
  }
  try {
    await exchangeGoogleCalendarCode(code, accountKey);
    return res.send('<html><body><h3>Google Calendar connected.</h3><script>window.close()</script></body></html>');
  } catch (error) {
    return res.status(500).send(`<h2>Google Calendar connection failed:</h2><pre>${String(error.message || error)}</pre>`);
  }
});

app.post('/api/admin/sales/maker-tunnel/start', salesAuth, async (req, res) => {
  const targetUrl = sanitizeText(req.body?.targetUrl || req.body?.websiteMakerLocalUrl || DEFAULT_MAKER_LOCAL_URL);
  try {
    const tunnel = await restartMakerTunnel(targetUrl);
    res.json({
      ok: true,
      tunnelUrl: tunnel.url,
      websiteMakerBaseUrl: tunnel.url,
      targetUrl: tunnel.targetUrl,
      startedAt: tunnel.startedAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to start Website Maker tunnel.' });
  }
});

app.get('/api/admin/sales/maker-tunnel/status', salesAuth, (_req, res) => {
  res.json({
    ok: true,
    running: Boolean(makerTunnelProcess && !makerTunnelProcess.killed),
    tunnelUrl: makerTunnelUrl,
    websiteMakerBaseUrl: makerTunnelUrl,
    targetUrl: makerTunnelTargetUrl,
    startedAt: makerTunnelStartedAt,
  });
});

app.get('/api/admin/sales', salesAuth, (req, res) => {
  const all = sales.getSalesClients();
  const clients = req.salesUser.isAdmin
    ? all
    : all.filter((client) => client.ownerId === req.salesUser.accountKey);
  res.json({
    clients,
    calendar: getGoogleCalendarStatus(req.salesUser.accountKey),
  });
});

app.get('/api/admin/sales/meeting-map', salesAuth, async (req, res) => {
  const all = sales.getSalesClients();
  const visible = req.salesUser.isAdmin
    ? all
    : all.filter((client) => client.ownerId === req.salesUser.accountKey);

  const inPersonClients = visible.filter(
    (client) =>
      client.status === 'active' &&
      client.meetingMode === 'in-person' &&
      sanitizeText(client.meetingPlace)
  );

  const uniquePlaces = new Map();
  for (const client of inPersonClients) {
    const place = sanitizeText(client.meetingPlace);
    const key = normalizeMeetingPlaceKey(place);
    if (!key || uniquePlaces.has(key)) continue;
    uniquePlaces.set(key, place);
  }

  const geocodedByKey = new Map();
  for (const [key, place] of uniquePlaces.entries()) {
    const geocoded = await geocodeMeetingPlace(place);
    geocodedByKey.set(key, geocoded);
  }

  let unresolvedCount = 0;
  const pins = [];
  for (const client of inPersonClients) {
    const place = sanitizeText(client.meetingPlace);
    const key = normalizeMeetingPlaceKey(place);
    const geocoded = geocodedByKey.get(key);
    if (!geocoded) {
      unresolvedCount += 1;
      continue;
    }
    pins.push({
      clientId: client.id,
      businessName: sanitizeText(client.businessName),
      contactPerson: sanitizeText(client.contactPerson),
      meetingPlace: place,
      meetingAt: sanitizeText(client.meetingAt),
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
    });
  }

  const now = Date.now();
  const timestampFor = (value = '') => {
    const time = Date.parse(String(value || ''));
    return Number.isFinite(time) ? time : null;
  };
  pins.sort((a, b) => {
    const timeA = timestampFor(a.meetingAt);
    const timeB = timestampFor(b.meetingAt);
    if (timeA === null && timeB === null) return a.businessName.localeCompare(b.businessName, 'nb-NO');
    if (timeA === null) return -1;
    if (timeB === null) return 1;
    const aPast = timeA < now;
    const bPast = timeB < now;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return aPast ? timeB - timeA : timeA - timeB;
  });

  res.json({
    pins,
    unresolvedCount,
    totalCandidates: inPersonClients.length,
  });
});

app.get('/api/admin/sales/:id', salesAuth, (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });
  res.json({ client });
});

app.post('/api/admin/sales', salesAuth, async (req, res) => {
  try {
    const payload = buildSalesInput(req.body || {}, { requireCore: true });
    payload.ownerId = req.salesUser.accountKey;
    let client = sales.createSalesClient(payload);
    const syncResult = await maybeSyncCalendar(client, null);
    client = syncResult.client || client;

    const thankYou = SALES_EMAIL_AUTOSEND_ENABLED
      ? await sendSalesThankYou(client, { force: false })
      : { sent: false, reason: 'manual-only', client };
    if (thankYou?.client) client = thankYou.client;

    res.status(201).json({
      client,
      warnings: syncResult.warnings || [],
      thankYouSent: Boolean(thankYou?.sent),
      autoEmailEnabled: SALES_EMAIL_AUTOSEND_ENABLED,
    });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to create sales client.' });
  }
});

app.put('/api/admin/sales/:id', salesAuth, async (req, res) => {
  try {
    const existing = sales.getSalesClientById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Sales client not found.' });
    if (!canAccessSalesClient(req, existing)) return res.status(403).json({ message: 'Not your sales client.' });

    const payload = buildSalesInput(req.body || {}, { existing });
    let client = sales.updateSalesClient(req.params.id, payload);
    if (!client) return res.status(404).json({ message: 'Sales client not found.' });

    const meetingChanged =
      existing.agreedTime !== client.agreedTime ||
      existing.meetingAt !== client.meetingAt ||
      existing.meetingMode !== client.meetingMode ||
      existing.contactEmail !== client.contactEmail;

    const syncResult = await maybeSyncCalendar(client, existing);
    client = syncResult.client || client;

    const thankYou = SALES_EMAIL_AUTOSEND_ENABLED
      ? await sendSalesThankYou(client, { force: meetingChanged })
      : { sent: false, reason: 'manual-only', client };
    if (thankYou?.client) client = thankYou.client;

    res.json({
      client,
      warnings: syncResult.warnings || [],
      thankYouSent: Boolean(thankYou?.sent),
      autoEmailEnabled: SALES_EMAIL_AUTOSEND_ENABLED,
    });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to update sales client.' });
  }
});

app.delete('/api/admin/sales/:id', salesAuth, async (req, res) => {
  const existing = sales.getSalesClientById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, existing)) return res.status(403).json({ message: 'Not your sales client.' });

  if (existing.calendar?.eventId) {
    try {
      await deleteMeetingEvent(existing.calendar.eventId, existing.ownerId || '');
    } catch {
      // Ignore remote cleanup failures; deletion in local sales store still proceeds.
    }
  }
  if (existing.websiteImport?.importRoot) {
    const importBase = join(SALES_IMPORTS_ROOT, existing.id);
    await fs.rm(importBase, { recursive: true, force: true }).catch(() => {});
  }

  const ok = sales.deleteSalesClient(existing.id);
  if (!ok) return res.status(404).json({ message: 'Sales client not found.' });
  res.json({ ok: true });
});

app.patch('/api/admin/sales/:id/progression', salesAuth, (req, res) => {
  const key = sanitizeText(req.body?.key);
  const value = parseBoolean(req.body?.value, false);
  if (!key) return res.status(400).json({ message: 'Progression key is required.' });
  const existing = sales.getSalesClientById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, existing)) return res.status(403).json({ message: 'Not your sales client.' });
  const updated = sales.setSalesProgress(req.params.id, key, value);
  if (!updated) return res.status(404).json({ message: 'Sales client not found.' });
  res.json({ client: updated });
});

app.post('/api/admin/sales/:id/not-sold', salesAuth, (req, res) => {
  const existing = sales.getSalesClientById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, existing)) return res.status(403).json({ message: 'Not your sales client.' });
  const reason = sanitizeText(req.body?.reason);
  const updated = sales.setSalesStatus(req.params.id, 'not-sold', {
    reason,
    archivedAt: new Date().toISOString(),
  });
  if (!updated) return res.status(404).json({ message: 'Sales client not found.' });
  res.json({ client: updated });
});

app.post('/api/admin/sales/:id/secondary', salesAuth, (req, res) => {
  const existing = sales.getSalesClientById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, existing)) return res.status(403).json({ message: 'Not your sales client.' });
  const reason = sanitizeText(req.body?.reason);
  const updated = sales.setSalesStatus(req.params.id, 'secondary', {
    reason,
    archivedAt: new Date().toISOString(),
  });
  if (!updated) return res.status(404).json({ message: 'Sales client not found.' });
  res.json({ client: updated });
});

app.post('/api/admin/sales/:id/restore', salesAuth, (req, res) => {
  const existing = sales.getSalesClientById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, existing)) return res.status(403).json({ message: 'Not your sales client.' });
  const updated = sales.setSalesStatus(req.params.id, 'active');
  if (!updated) return res.status(404).json({ message: 'Sales client not found.' });
  res.json({ client: updated });
});

app.post('/api/admin/sales/:id/send-welcome-email', salesAuth, async (req, res) => {
  try {
    let client = sales.getSalesClientById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Sales client not found.' });
    if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });

    const syncResult = await maybeSyncCalendar(client, client);
    client = syncResult.client || client;
    const sentResult = await sendSalesThankYou(client, { force: true });
    client = sentResult.client || client;
    if (!sentResult.sent) {
      return res.status(400).json({
        message: salesEmailFailureMessage(sentResult.reason),
        reason: sentResult.reason || '',
        client,
        warnings: syncResult.warnings || [],
      });
    }
    return res.json({
      ok: true,
      sent: true,
      client,
      warnings: syncResult.warnings || [],
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed sending welcome email.' });
  }
});

app.post('/api/admin/sales/:id/send-reminder', salesAuth, async (req, res) => {
  try {
    let client = sales.getSalesClientById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Sales client not found.' });
    if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });

    const requestedKind = sanitizeText(req.body?.kind || '24h');
    const reminderKind = requestedKind === '1h' ? '1h' : '24h';
    const syncResult = await maybeSyncCalendar(client, client);
    client = syncResult.client || client;
    const sentResult = await sendSalesReminderNow(client, reminderKind);
    client = sentResult.client || client;
    if (!sentResult.sent) {
      return res.status(400).json({
        message: salesEmailFailureMessage(sentResult.reason),
        reason: sentResult.reason || '',
        client,
        warnings: syncResult.warnings || [],
      });
    }
    return res.json({
      ok: true,
      sent: true,
      kind: reminderKind,
      client,
      warnings: syncResult.warnings || [],
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed sending reminder email.' });
  }
});

app.post('/api/admin/sales/:id/import-website', salesAuth, async (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });
  try {
    const syncResult = await syncSalesClientFromMakerRun({
      client,
      runId: req.body?.runId,
      step: req.body?.step || 'latest',
      siteFolder: req.body?.siteFolder || client.businessName || 'site',
      baseUrl: req.body?.baseUrl,
      websiteMakerBaseUrl: req.body?.websiteMakerBaseUrl,
    });
    res.json({
      ok: true,
      client: syncResult.client,
      runId: syncResult.runId,
      sourceStep: syncResult.sourceStep,
      sourceExportUrl: syncResult.sourceExportUrl,
    });
  } catch (error) {
    res.status(httpStatusFromError(error, 500)).json({ message: error.message || 'Failed importing website bundle.' });
  }
});

app.post('/api/admin/sales/:id/link-maker-run', salesAuth, async (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });

  const runId = sanitizeText(req.body?.runId);
  if (!runId) {
    return res.status(400).json({ message: 'Run ID is required.' });
  }

  const websiteMakerBaseUrl = resolveWebsiteMakerBaseUrl(req.body?.websiteMakerBaseUrl, client);
  if (!websiteMakerBaseUrl) {
    return res.status(400).json({ message: 'Website Maker URL is invalid. Use a valid host or URL (for example https://example.com).' });
  }

  try {
    const run = await fetchMakerRunRecord({ websiteMakerBaseUrl, runId });
    const answers = run?.answers && typeof run.answers === 'object' ? run.answers : {};
    const mergedIndustry =
      sanitizeText(client.industry) ||
      sanitizeText(client.makerRun?.industry) ||
      sanitizeText(answers?.industry);
    const updated = sales.setSalesMakerRun(client.id, {
      runId,
      ...buildMakerRunLinks(websiteMakerBaseUrl, runId),
      industry: mergedIndustry,
      createdAt: sanitizeText(client.makerRun?.createdAt) || new Date().toISOString(),
    });
    if (!updated) return res.status(404).json({ message: 'Sales client not found.' });
    res.json({
      ok: true,
      client: updated,
      run: {
        id: sanitizeText(run?.id) || runId,
        intakeStatus: sanitizeText(run?.metadata?.intakeStatus),
      },
    });
  } catch (error) {
    res.status(httpStatusFromError(error, 502)).json({ message: error.message || 'Failed linking run from Website Maker.' });
  }
});

// Auto-create a run in the Website Maker (server-to-server) pre-filled with the
// client's business name + industry, then store the runId + maker links so the
// rep can "Open in maker" and "Preview" without manual export/import.
app.post('/api/admin/sales/:id/create-maker-run', salesAuth, async (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });
  const forceNewRun = parseBoolean(req.body?.forceNewRun, false);

  // Prefer the URL the operator typed in the Sales UI; fall back to env. This lets
  // local testing target a maker on http://localhost:3000 without redeploying.
  const baseRaw = sanitizeText(req.body?.websiteMakerBaseUrl || process.env.WEBSITE_MAKER_BASE_URL);
  if (!baseRaw) {
    return res.status(503).json({ message: 'Website Maker is not configured (set the Website Maker URL or WEBSITE_MAKER_BASE_URL).' });
  }
  const base = normalizeHttpBaseUrl(baseRaw);
  if (!base) {
    return res.status(400).json({ message: 'Website Maker URL is invalid. Use a valid host or URL (for example https://example.com).' });
  }
  const apiKey = sanitizeText(process.env.WEBSITE_MAKER_API_KEY);

  try {
    const salesDetails = normalizeSalesDetailLinks(client.details || {});
    const relevantLinks = buildSalesRelevantLinks(salesDetails);
    const quickFillLinks = buildSalesQuickFillLinks(salesDetails);
    const answersPatch = {
      businessName: client.businessName || '',
      industry: client.industry || '',
      googleBusinessProfile: salesDetails.googleBusinessProfile || '',
      relevantLinks,
    };
    const previousRunId = sanitizeText(client.makerRun?.runId);
    const existingRunId = forceNewRun ? '' : previousRunId;
    const requestBody = {
      existingRunId,
      businessName: client.businessName || 'Untitled client run',
      industry: client.industry || '',
      source: 'sales',
      salesContact: client.contactPerson || '',
      answers: answersPatch,
      quickFillLinks,
    };
    const response = await fetch(`${base}/api/runs/v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
      body: JSON.stringify(requestBody),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(502).json({ message: data.error || data.message || `Website Maker error (${response.status}).` });
    }
    const runId = sanitizeText(data.runId || existingRunId);
    if (!runId) {
      return res.status(502).json({ message: 'Website Maker did not return a runId.' });
    }
    const replacedRunId = forceNewRun ? previousRunId : '';
    let replacedRunDeleted = false;
    if (replacedRunId && replacedRunId !== runId) {
      try {
        const deleteRes = await fetch(`${base}/api/runs/${encodeURIComponent(replacedRunId)}`, {
          method: 'DELETE',
          headers: {
            ...(apiKey ? { 'x-api-key': apiKey } : {}),
          },
        });
        replacedRunDeleted = deleteRes.ok;
      } catch {
        replacedRunDeleted = false;
      }
    }

    const updated = sales.setSalesMakerRun(client.id, {
      runId,
      ...buildMakerRunLinks(base, runId),
      industry: client.industry || '',
      createdAt:
        forceNewRun || !sanitizeText(client.makerRun?.createdAt)
          ? new Date().toISOString()
          : sanitizeText(client.makerRun?.createdAt),
    });

    res.json({
      ok: true,
      client: updated,
      alreadyExists: Boolean(previousRunId),
      replacedRunId,
      replacedRunDeleted,
    });
  } catch (error) {
    res.status(502).json({ message: error.message || 'Failed reaching the Website Maker.' });
  }
});

app.post('/api/admin/sales/:id/import-website-upload', salesAuth, (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });
  return res.status(410).json({
    message: 'Manual ZIP upload is deprecated. Use "Sync latest from Maker" instead.',
  });
});

app.post('/api/admin/sales/:id/got-client', salesAuth, async (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });

  const site = hub.createSite({
    name: client.businessName || 'New client',
    domain: client.websiteDomain || '',
  });

  if (client.websiteImport?.importRoot) {
    const importBase = join(SALES_IMPORTS_ROOT, client.id);
    await fs.rm(importBase, { recursive: true, force: true }).catch(() => {});
  }
  sales.deleteSalesClient(client.id);

  res.json({
    ok: true,
    site,
    movedClient: client,
  });
});

// --- Sales: search registered client portal users (to grant website offers to).
app.get('/api/admin/sales/client-search', salesAuth, async (req, res) => {
  const query = sanitizeText(req.query?.q).toLowerCase();
  const allUsers = await store.getAllUsers();
  const clientUsers = allUsers.filter((entry) => entry.role === 'client');
  const queryTerms = query
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  const results = clientUsers
    .map((entry) => {
      const profile = clientPortal.getClientProfile(entry.id);
      return {
        userId: entry.id,
        email: sanitizeText(entry.username).toLowerCase(),
        name: sanitizeText(profile?.name),
        businessName: sanitizeText(profile?.businessName),
        createdAt: entry.createdAt,
      };
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .filter((entry) => {
      if (!queryTerms.length) return true;
      const haystack = `${entry.email} ${entry.name.toLowerCase()} ${entry.businessName.toLowerCase()}`;
      return queryTerms.every((term) => haystack.includes(term));
    })
    .slice(0, 25);
  res.json({ users: results });
});

// --- Sales: website offers (tier recommendation + nettsidekode) given to clients.
app.get('/api/admin/sales/offers', salesAuth, (req, res) => {
  const all = offers.listOffers();
  const visible = req.salesUser.isAdmin
    ? all
    : all.filter((entry) => entry.ownerId === req.salesUser.accountKey);
  const list = visible.map((entry) => hydrateOfferPreviewFromSalesImport(entry, { persist: true }));
  res.json({ offers: list });
});

app.post('/api/admin/sales/offers', salesAuth, async (req, res) => {
  const body = req.body || {};
  const plan = findWebsitePlan(body.planId);
  if (!plan) return res.status(400).json({ message: 'Velg en gyldig nettsideplan (Tier 1, 2 eller 3).' });

  let previewUrl = sanitizeText(body.previewUrl);
  let businessName = sanitizeText(body.businessName);
  const salesClientId = sanitizeText(body.salesClientId);
  if (salesClientId) {
    let salesClient = sales.getSalesClientById(salesClientId);
    if (salesClient && !canAccessSalesClient(req, salesClient)) {
      return res.status(403).json({ message: 'Not your sales client.' });
    }
    if (salesClient) {
      if (!businessName) businessName = sanitizeText(salesClient.businessName);
      if (!previewUrl) {
        previewUrl = sanitizeText(salesClient.websiteImport?.previewUrl);
      }
      if (!previewUrl) {
        try {
          const syncResult = await syncSalesClientFromMakerRun({
            client: salesClient,
            runId: body.runId,
            websiteMakerBaseUrl: body.websiteMakerBaseUrl,
            siteFolder: body.siteFolder || salesClient.businessName || 'site',
            step: body.step || 'latest',
            baseUrl: body.baseUrl,
          });
          salesClient = syncResult.client;
          previewUrl = sanitizeText(salesClient.websiteImport?.previewUrl);
        } catch (error) {
          return res.status(httpStatusFromError(error, 400)).json({
            message:
              error.message ||
              'Kunne ikke synkronisere nettside-forhåndsvisning fra Website Maker.',
          });
        }
      }
      if (!previewUrl) {
        return res.status(400).json({
          message:
            'Ingen synkronisert forhåndsvisning funnet ennå. Kjør "Sync latest from Maker" først.',
        });
      }
    }
  }

  const offer = offers.createOffer({
    ownerId: req.salesUser.accountKey,
    salesClientId,
    planId: plan.id,
    planName: plan.name,
    price: plan.price,
    note: sanitizeText(body.note),
    businessName,
    previewUrl,
    targetUserId: sanitizeText(body.targetUserId),
    targetEmail: sanitizeText(body.targetEmail),
  });
  res.status(201).json({ offer });
});

app.delete('/api/admin/sales/offers/:id', salesAuth, (req, res) => {
  const offer = offers.getOfferById(req.params.id);
  if (!offer) return res.status(404).json({ message: 'Offer not found.' });
  if (!req.salesUser.isAdmin && offer.ownerId !== req.salesUser.accountKey) {
    return res.status(403).json({ message: 'Not your offer.' });
  }
  const ok = offers.deleteOffer(offer.id);
  if (!ok) return res.status(404).json({ message: 'Offer not found.' });
  res.json({ ok: true });
});

// --- Booking (skip Calendly: send email to daracha777@gmail.com)
app.post('/api/booking', async (req, res) => {
  const { name, email, phone, company, service, message } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ message: 'Navn og e-post kreves' });
  }
  if (!emailLib.canSendEmail()) {
    return res.status(503).json({ message: 'E-post er ikke konfigurert.' });
  }
  const when = new Date().toLocaleString('nb-NO', { dateStyle: 'full', timeStyle: 'short' });
  const body = `Ny henvendelse fra nettsiden (brukeren valgte å hoppe over Calendly-booking).

Hvem:
- Navn: ${name}
- E-post: ${email}
- Telefon: ${phone || 'Ikke oppgitt'}
- Bedrift: ${company || 'Ikke oppgitt'}

Når: ${when}
Hvor: Nettsiden (booking-siden, skip Calendly)
Tjeneste: ${service || 'Ikke oppgitt'}

Melding:
${message || '(Ingen melding)'}`;
  try {
    await emailLib.sendEmail({
      to: 'daracha777@gmail.com',
      subject: `[Asoldi] Ny henvendelse: ${name} – ${company || 'Ingen bedrift'}`,
      text: body,
      html: `<pre style="font-family:sans-serif;white-space:pre-wrap;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
    });
  } catch (err) {
    console.error('Booking email error:', err);
    return res.status(500).json({ message: 'Kunne ikke sende henvendelsen. Prøv igjen.' });
  }
  res.json({ ok: true });
});

async function sendSalesPreviewFile(req, res, relativePath = '') {
  const client = sales.getSalesClientById(req.params.id);
  if (!client || !client.websiteImport?.importRoot) {
    return res.status(404).send('Preview not available');
  }

  const root = path.resolve(client.websiteImport.importRoot);
  const cleaned = sanitizeText(relativePath).replace(/^[/\\]+/, '');
  const normalized = path.normalize(cleaned || 'index.html');
  const requestedAbs = path.resolve(root, normalized);
  if (!requestedAbs.startsWith(root)) {
    return res.status(403).send('Forbidden');
  }

  async function sendIfFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) return false;
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(filePath);
      return true;
    } catch {
      return false;
    }
  }

  if (await sendIfFile(requestedAbs)) return;
  if (!path.extname(normalized) && await sendIfFile(path.join(requestedAbs, 'index.html'))) return;
  if (!path.extname(normalized) && await sendIfFile(path.join(root, 'index.html'))) return;
  return res.status(404).send('Preview file not found');
}

app.get('/sales-preview/:id', async (req, res) => {
  await sendSalesPreviewFile(req, res, '');
});

app.get('/sales-preview/:id/*', async (req, res) => {
  await sendSalesPreviewFile(req, res, req.params[0] || '');
});

// --- Static and SPA
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (req.path.match(/\.(tsx?|jsx)$/)) return res.status(404).send('Not found');
  next();
});

app.use(express.static(distPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  if (existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(500).send('index.html not found');
});

function ensureHubDefaultSite() {
  const sites = hub.getAllSites();
  if (sites.length > 0) return;
  hub.createSite({ name: 'Mong Sushi', domain: 'mongsushi.no' });
  console.log('Hub: seeded default site Mong Sushi (mongsushi.no). Copy its site key and set CMS_SITE_KEY on the client.');
}

async function ensureData() {
  await ensureAdminExists();
  employees.ensureWorkersForUsers(await store.getAllUsers());
  ensureHubDefaultSite();
  await fs.mkdir(SALES_IMPORTS_ROOT, { recursive: true }).catch(() => {});
}

ensureData().then(() => {
  startSalesReminderLoop();
  sendDueSalesReminders().catch((error) => console.error('Initial sales reminder run failed:', error));
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}).catch((err) => {
  console.error('Failed to init admin:', err);
  process.exit(1);
});
