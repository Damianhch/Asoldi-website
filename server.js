import express from 'express';
import { createHmac, randomBytes } from 'crypto';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import * as store from './data/store.js';
import * as hub from './data/hub.js';
import * as employees from './data/employees.js';
import * as sales from './data/sales.js';
import { SALES_CONTACT_CORRECTIONS } from './data/sales-contact-corrections.js';
import * as clientPortal from './data/client-portal.js';
import * as offers from './data/offers.js';
import * as resetTokens from './data/reset-tokens.js';
import { getPersistentDataDir } from './data/storage-path.js';
import * as salesPreview from './lib/sales-preview-import.js';
import {
  assertImportedPreviewHasAssets,
  fillExportZipWithMakerAssets,
  findPreviewFileByBasename,
} from './lib/preview-bundle-assets.js';
import * as emailLib from './lib/email.js';
import * as employeeWordPress from './lib/employee-wordpress.js';
import * as employeeLuca from './lib/employee-luca.js';
import * as employeeMyPhoner from './lib/employee-myphoner.js';
import * as myphonerApi from './lib/myphoner-api.js';
import * as myphonerIntegration from './data/myphoner-integration.js';
import * as myphonerSsuWins from './lib/myphoner-ssu-wins.js';
import { buildSalesReminderEmail, buildSalesThankYouEmail } from './lib/sales-email.js';
import {
  PUBLIC_SALES_ORIGIN,
  buildLaptopPreviewEntry,
  buildMakerExportUrl,
  buildPreviewBundleUploadUrl,
  buildPublicSalesPreviewUrl,
  buildSalesPreviewPath,
  clientNeedsPublicPreviewSnapshot,
  injectPreviewBaseHref,
  isAllowedPreviewBridgeExportUrl,
  isAllowedPreviewBundleUploadUrl,
  isPrivateMakerUrl,
  lanAsoldiOriginFromMakerUrl,
  rewritePreviewAssetPaths,
  toPublicSalesPreviewUrl,
} from './lib/laptop-preview.js';
import {
  createGoogleCalendarAuthUrl,
  deleteMeetingEvent,
  exchangeGoogleCalendarCode,
  getGoogleCalendarStatus,
  isRealGoogleMeetLink,
  resolveCalendarSyncAccountKey,
  shareGoogleCalendarToken,
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
const DEFAULT_MAKER_LOCAL_URL = String(process.env.WEBSITE_MAKER_LOCAL_URL || 'http://192.168.68.92:3000').trim() || 'http://192.168.68.92:3000';
const CLOUDFLARED_WINDOWS_CANDIDATES = [
  'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
  'C:\\Program Files\\cloudflared\\cloudflared.exe',
];
const LOCAL_RECORDING_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.ogg', '.flac']);
let salesReminderLoopRunning = false;
let salesReminderInterval = null;
let makerTunnelProcess = null;
let makerTunnelUrl = '';
let makerTunnelTargetUrl = '';
let makerTunnelStartedAt = '';
const SALES_MEETING_GEOCODE_MIN_INTERVAL_MS = Number(process.env.SALES_MEETING_GEOCODE_MIN_INTERVAL_MS || 1100);
const SALES_MEETING_GEOCODE_MAX_PER_REQUEST = Math.max(
  0,
  Number(process.env.SALES_MEETING_GEOCODE_MAX_PER_REQUEST || 0)
);
const SALES_MEETING_GEOCODE_NEGATIVE_TTL_MS = Number(
  process.env.SALES_MEETING_GEOCODE_NEGATIVE_TTL_MS || 24 * 60 * 60 * 1000
);
const SALES_GEOCODE_CACHE_PATH = join(getPersistentDataDir(), 'sales-meeting-geocode-cache.json');
const salesMeetingGeocodeCache = new Map();
let salesMeetingGeocodeCacheLoaded = false;
let salesMeetingGeocodePersistTimer = null;
let salesMeetingGeocodeLastRequestAt = 0;
let salesGeocodeWarmupRunning = false;
let salesGeocodeWarmupInterval = null;
const salesAddressBackfillTried = new Set();
const CLIENT_SOCIAL_DEV_MODE = String(process.env.CLIENT_SOCIAL_DEV_MODE || '1') !== '0';
const MYPHONER_WEBHOOK_SECRET = String(process.env.MYPHONER_WEBHOOK_SECRET || '').trim();
const MYPHONER_WEBHOOK_REPLAY_WINDOW_MS = Number(process.env.MYPHONER_WEBHOOK_REPLAY_WINDOW_MS || 120_000);
const MYPHONER_WEBHOOK_RECONCILE_ENABLED = String(process.env.MYPHONER_WEBHOOK_RECONCILE_ENABLED || '1') !== '0';
const MYPHONER_WEBHOOK_RECONCILE_MS = Number(process.env.MYPHONER_WEBHOOK_RECONCILE_MS || 10 * 60 * 1000);
const MYPHONER_DEFAULT_SALES_OWNER_KEY =
  sanitizeText(process.env.MYPHONER_DEFAULT_SALES_OWNER_KEY) || 'admin:daracha777@gmail.com';
const MYPHONER_AUTO_LINK_ENRICH_ENABLED = String(process.env.MYPHONER_AUTO_LINK_ENRICH || '1') !== '0';
const MYPHONER_AUTO_LINK_ENRICH_TIMEOUT_MS = Number(process.env.MYPHONER_AUTO_LINK_ENRICH_TIMEOUT_MS || 6000);
const MYPHONER_AUTO_LINK_SEARCH_CACHE_MS = Number(process.env.MYPHONER_AUTO_LINK_SEARCH_CACHE_MS || 6 * 60 * 60 * 1000);
const SERPAPI_API_KEY = sanitizeText(process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY);
const SERPAPI_ENGINE = sanitizeText(process.env.SERPAPI_ENGINE || 'google') || 'google';
// site:-queries regularly take >10s on SerpAPI; a short timeout silently drops the best results.
const SERPAPI_TIMEOUT_MS = Number(process.env.SERPAPI_TIMEOUT_MS || 15000);
// Default to Norwegian Google results for local business profile discovery.
const SERPAPI_HL = sanitizeText(process.env.SERPAPI_HL || 'no') || 'no';
const SERPAPI_GL = sanitizeText(process.env.SERPAPI_GL || 'no') || 'no';
const SERPAPI_MIN_INTERVAL_MS = Number(process.env.SERPAPI_MIN_INTERVAL_MS || 900);
const SERPAPI_RETRY_LIMIT = Number(process.env.SERPAPI_RETRY_LIMIT || 3);
const SERPAPI_RETRY_BACKOFF_MS = Number(process.env.SERPAPI_RETRY_BACKOFF_MS || 1200);
const SOCIAL_BRAVE_FALLBACK_ENABLED = String(process.env.SOCIAL_BRAVE_FALLBACK_ENABLED || '1') !== '0';
const SOCIAL_BRAVE_TIMEOUT_MS = Number(process.env.SOCIAL_BRAVE_TIMEOUT_MS || 3500);
const SOCIAL_BRAVE_MIN_INTERVAL_MS = Number(process.env.SOCIAL_BRAVE_MIN_INTERVAL_MS || 250);
const SOCIAL_BRAVE_MAX_LINKS = Number(process.env.SOCIAL_BRAVE_MAX_LINKS || 80);
// Stricter defaults: prefer empty over wrong Instagram/Facebook profiles.
// The effective min score also scales down for short business names (see selectBestSearchCandidate).
const MYPHONER_SOCIAL_CONFIDENCE_MIN_SCORE = Number(process.env.MYPHONER_SOCIAL_CONFIDENCE_MIN_SCORE || 4);
const MYPHONER_SOCIAL_CONFIDENCE_MIN_MARGIN = Number(process.env.MYPHONER_SOCIAL_CONFIDENCE_MIN_MARGIN || 2);
const MYPHONER_SOCIAL_CONFIDENCE_MIN_TOKEN_MATCHES = Number(process.env.MYPHONER_SOCIAL_CONFIDENCE_MIN_TOKEN_MATCHES || 2);
// Inventing handles from business names caused widespread wrong IG/FB links.
const MYPHONER_SOCIAL_FORCE_FILL_ENABLED = String(process.env.MYPHONER_SOCIAL_FORCE_FILL || '0') === '1';
const MYPHONER_LEAD_CATALOG_MAX_PAGES = Math.max(1, Number(process.env.MYPHONER_LEAD_CATALOG_MAX_PAGES || 25));
const MYPHONER_RECORDING_RETRY_MAX_ATTEMPTS = Math.max(3, Number(process.env.MYPHONER_RECORDING_RETRY_MAX_ATTEMPTS || 12));
const MYPHONER_RECORDING_RETRY_DELAYS_MS = String(process.env.MYPHONER_RECORDING_RETRY_DELAYS_MS || '15000,30000,60000,120000,300000,600000')
  .split(',')
  .map((entry) => Number(String(entry || '').trim()))
  .filter((entry) => Number.isFinite(entry) && entry >= 5_000);
const MYPHONER_RECORDING_DOWNLOAD_ENABLED = String(process.env.MYPHONER_RECORDING_DOWNLOAD_ENABLED || '1') !== '0';
const MYPHONER_RECORDING_PENDING_BATCH = Math.max(1, Number(process.env.MYPHONER_RECORDING_PENDING_BATCH || 20));
const SALES_LINK_BACKFILL_ENABLED = String(process.env.SALES_LINK_BACKFILL_ENABLED || '1') !== '0';
const SALES_LINK_BACKFILL_VERSION = sanitizeText(process.env.SALES_LINK_BACKFILL_VERSION || 'social-links-v5-strict-serp-myphoner');
const SALES_LINK_BACKFILL_LIMIT = Number(process.env.SALES_LINK_BACKFILL_LIMIT || 0);
const SALES_MEETING_TIMEZONE = sanitizeText(process.env.GOOGLE_CALENDAR_TIMEZONE || 'Europe/Oslo') || 'Europe/Oslo';
const MYPHONER_RECORDINGS_DIR = path.join(getPersistentDataDir(), 'myphoner-recordings');
try {
  mkdirSync(MYPHONER_RECORDINGS_DIR, { recursive: true });
} catch {
  // Directory is created again during startup / download paths.
}
let myphonerWebhookReconcileInterval = null;
let myphonerWebhookReconcileRunning = false;
let myphonerRecordingRetryRunning = false;
let myphonerRecordingRetryInterval = null;
const MYPHONER_RECORDING_RETRY_TICK_MS = Math.max(
  15_000,
  Number(process.env.MYPHONER_RECORDING_RETRY_TICK_MS || 30_000)
);
const pendingSalesLinkEnrichment = new Set();
const salesSearchCache = new Map();
let serpApiMissingKeyWarned = false;
let serpApiLastRequestAt = 0;
let serpApiRateLimitWarningAt = 0;
let serpApiBlockedUntilMs = 0;
let braveSearchLastRequestAt = 0;
let salesLinkBackfillRunning = false;

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

function nowIso() {
  return new Date().toISOString();
}

function defaultCheckoutLegalAcknowledgement(planId = '', planName = '') {
  return {
    termsAccepted: false,
    privacyAccepted: false,
    bindingAccepted: false,
    bindingMonths: 6,
    planId: sanitizeText(planId),
    planName: sanitizeText(planName),
    acceptedAt: '',
  };
}

function sanitizeCheckoutLegalAcknowledgement(input = {}, fallback = {}) {
  const base = {
    ...defaultCheckoutLegalAcknowledgement(),
    ...(fallback && typeof fallback === 'object' ? fallback : {}),
  };
  const source = input && typeof input === 'object' ? input : {};
  const bindingMonths = Number.parseInt(String(source.bindingMonths ?? base.bindingMonths ?? 0), 10);
  return {
    termsAccepted: parseBoolean(source.termsAccepted, Boolean(base.termsAccepted)),
    privacyAccepted: parseBoolean(source.privacyAccepted, Boolean(base.privacyAccepted)),
    bindingAccepted: parseBoolean(source.bindingAccepted, Boolean(base.bindingAccepted)),
    bindingMonths: Number.isFinite(bindingMonths) && bindingMonths > 0 ? bindingMonths : 0,
    planId: sanitizeText(source.planId || base.planId),
    planName: sanitizeText(source.planName || base.planName),
    acceptedAt: sanitizeText(source.acceptedAt || base.acceptedAt),
  };
}

function hasAcceptedCheckoutLegalAcknowledgement(legal, expectedPlanId = '') {
  const normalized = sanitizeCheckoutLegalAcknowledgement(legal);
  if (!normalized.termsAccepted || !normalized.privacyAccepted || !normalized.bindingAccepted) return false;
  if (normalized.bindingMonths < 6) return false;
  if (!normalized.acceptedAt) return false;
  const targetPlanId = sanitizeText(expectedPlanId);
  if (targetPlanId && sanitizeText(normalized.planId) !== targetPlanId) return false;
  return true;
}

function checkoutLegalConsentMessage() {
  return 'Du må godkjenne vilkår, personvern og 6 måneders bindingstid før checkout.';
}

function resolveRequestBaseUrl(req) {
  const fromEnv = normalizeHttpBaseUrl(process.env.APP_URL || '');
  if (fromEnv) return fromEnv;
  const forwardedProtoRaw = sanitizeText(req.headers['x-forwarded-proto'] || '');
  const forwardedProto = sanitizeText(forwardedProtoRaw.split(',')[0]).toLowerCase();
  const fallbackProto = sanitizeText(req.protocol || '').toLowerCase();
  const protocol = forwardedProto === 'https' || forwardedProto === 'http'
    ? forwardedProto
    : (fallbackProto === 'https' || fallbackProto === 'http' ? fallbackProto : 'https');
  const forwardedHostRaw = sanitizeText(req.headers['x-forwarded-host'] || '');
  const fallbackHostRaw = sanitizeText(req.get('host') || '');
  const host = sanitizeText((forwardedHostRaw || fallbackHostRaw).split(',')[0]);
  if (!host) return '';
  return normalizeHttpBaseUrl(`${protocol}://${host}`);
}

function normalizeStripeCurrency(value = '') {
  return sanitizeText(value).toLowerCase() || getStripeCurrency();
}

function parsePlanAmount(value = '') {
  const digits = String(value || '').replace(/[^\d]/g, '');
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unixToIso(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return new Date(numeric * 1000).toISOString();
}

function planIdForStripePriceId(priceId = '') {
  const normalizedPriceId = sanitizeText(priceId);
  if (!normalizedPriceId) return '';
  for (const plan of CLIENT_WEBSITE_PLANS) {
    if (sanitizeText(priceIdForPlan(plan.id)) === normalizedPriceId) {
      return plan.id;
    }
  }
  return '';
}

function mapStripeInvoiceRecord(invoice = {}) {
  const amountPaid = Number(invoice.amount_paid || 0) / 100;
  const amountDue = Number(invoice.amount_due || 0) / 100;
  return {
    id: sanitizeText(invoice.id),
    number: sanitizeText(invoice.number),
    status: sanitizeText(invoice.status),
    paid: Boolean(invoice.paid),
    amountPaid: Number.isFinite(amountPaid) ? amountPaid : 0,
    amountDue: Number.isFinite(amountDue) ? amountDue : 0,
    currency: normalizeStripeCurrency(invoice.currency || ''),
    createdAt: unixToIso(invoice.created),
    dueAt: unixToIso(invoice.due_date),
    paidAt: unixToIso(invoice.status_transitions?.paid_at),
    hostedInvoiceUrl: sanitizeText(invoice.hosted_invoice_url),
    invoicePdf: sanitizeText(invoice.invoice_pdf),
  };
}

async function buildClientBillingOverview(profile = {}) {
  const payment = profile?.payment && typeof profile.payment === 'object' ? profile.payment : {};
  const selectedPlan = findWebsitePlan(payment.planId || profile?.websiteBuilder?.selectedPlanId);
  const summary = {
    status: sanitizeText(payment.status) || 'none',
    method: sanitizeText(payment.method),
    planId: sanitizeText(payment.planId || selectedPlan?.id || profile?.websiteBuilder?.selectedPlanId),
    planName: sanitizeText(payment.planName || selectedPlan?.name || profile?.websiteBuilder?.selectedPlanName),
    amount: Number(payment.amount) || parsePlanAmount(selectedPlan?.price || profile?.websiteBuilder?.selectedPlanPrice || ''),
    currency: normalizeStripeCurrency(payment.currency || ''),
    stripeCustomerId: sanitizeText(payment.stripeCustomerId),
    stripeSubscriptionId: sanitizeText(payment.stripeSubscriptionId),
    paidAt: sanitizeText(payment.paidAt),
    updatedAt: sanitizeText(payment.updatedAt),
    cancelAtPeriodEnd: parseBoolean(payment.cancelAtPeriodEnd, false),
    currentPeriodEnd: sanitizeText(payment.currentPeriodEnd),
    cancelAt: sanitizeText(payment.cancelAt),
    canceledAt: sanitizeText(payment.canceledAt),
  };

  let subscription = null;
  let invoices = [];
  let stripePortalAvailable = false;
  const warnings = [];

  if (isStripeConfigured()) {
    stripePortalAvailable = Boolean(summary.stripeCustomerId);
    try {
      const stripe = getStripe();
      if (summary.stripeCustomerId) {
        const invoiceList = await stripe.invoices.list({
          customer: summary.stripeCustomerId,
          limit: 30,
        });
        invoices = Array.isArray(invoiceList?.data) ? invoiceList.data.map(mapStripeInvoiceRecord) : [];
      }
      if (summary.stripeSubscriptionId) {
        const stripeSub = await stripe.subscriptions.retrieve(summary.stripeSubscriptionId, {
          expand: ['items.data.price'],
        });
        const priceId = sanitizeText(stripeSub?.items?.data?.[0]?.price?.id);
        const inferredPlanId = planIdForStripePriceId(priceId) || summary.planId;
        const inferredPlan = findWebsitePlan(inferredPlanId);
        subscription = {
          id: sanitizeText(stripeSub.id),
          status: sanitizeText(stripeSub.status),
          planId: inferredPlanId,
          planName: sanitizeText(inferredPlan?.name || summary.planName),
          priceId,
          cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
          currentPeriodEnd: unixToIso(stripeSub.current_period_end),
          cancelAt: unixToIso(stripeSub.cancel_at),
          canceledAt: unixToIso(stripeSub.canceled_at),
        };
        summary.status = subscription.status || summary.status;
        summary.planId = subscription.planId || summary.planId;
        summary.planName = subscription.planName || summary.planName;
        summary.cancelAtPeriodEnd = subscription.cancelAtPeriodEnd;
        summary.currentPeriodEnd = subscription.currentPeriodEnd;
        summary.cancelAt = subscription.cancelAt;
        summary.canceledAt = subscription.canceledAt || summary.canceledAt;
      }
    } catch (error) {
      warnings.push(sanitizeText(error?.message || 'Kunne ikke hente Stripe faktureringsdata.'));
    }
  }

  if (!invoices.length && payment.invoiceRequest && typeof payment.invoiceRequest === 'object') {
    const invoiceRequest = payment.invoiceRequest;
    invoices = [{
      id: 'invoice-request',
      number: 'Fakturaforespørsel',
      status: 'invoice_requested',
      paid: false,
      amountPaid: 0,
      amountDue: Number(summary.amount || 0),
      currency: summary.currency || getStripeCurrency(),
      createdAt: sanitizeText(invoiceRequest.requestedAt || summary.updatedAt),
      dueAt: '',
      paidAt: '',
      hostedInvoiceUrl: '',
      invoicePdf: '',
    }];
  }

  return {
    summary,
    subscription,
    invoices,
    stripePortalAvailable,
    warnings,
    availablePlans: CLIENT_WEBSITE_PLANS.map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      description: plan.description,
      isCurrent: plan.id === summary.planId,
      stripePriceConfigured: Boolean(sanitizeText(priceIdForPlan(plan.id))),
    })),
  };
}

function normalizePromotionCodeInput(value = '') {
  return sanitizeText(value).toUpperCase().replace(/\s+/g, '');
}

function normalizePromotionCodeLookupKey(value = '') {
  return normalizePromotionCodeInput(value).replace(/[^A-Z0-9]/g, '');
}

async function collectStripePromotionCodeCandidates(stripe, inputCode = '') {
  const rawCode = sanitizeText(inputCode);
  const normalizedCode = normalizePromotionCodeInput(rawCode);
  const lookupKey = normalizePromotionCodeLookupKey(rawCode);
  const seen = new Set();
  const candidates = [];

  const addCandidate = (promotionCode) => {
    const id = sanitizeText(promotionCode?.id);
    if (!id || seen.has(id)) return;
    seen.add(id);
    candidates.push(promotionCode);
  };

  const maybePromoId = /^promo_/i.test(rawCode) ? `promo_${rawCode.slice(6)}` : '';
  if (maybePromoId) {
    try {
      const direct = await stripe.promotionCodes.retrieve(maybePromoId, { expand: ['coupon'] });
      if (direct) addCandidate(direct);
    } catch {
      // Fall back to code-based lookup.
    }
  }

  async function addByCode(codeValue = '') {
    const nextCode = sanitizeText(codeValue);
    if (!nextCode) return;
    const list = await stripe.promotionCodes.list({
      code: nextCode,
      active: true,
      limit: 20,
      expand: ['data.coupon'],
    });
    const rows = Array.isArray(list?.data) ? list.data : [];
    for (const row of rows) addCandidate(row);
  }

  await addByCode(rawCode);
  if (normalizedCode && normalizedCode !== rawCode) {
    await addByCode(normalizedCode);
  }

  // Stripe's code filter can miss variants in some account/API-version setups.
  // Fallback to a bounded active-code scan and match by normalized comparison key.
  if (!candidates.length && lookupKey) {
    let startingAfter = '';
    for (let page = 0; page < 5; page += 1) {
      const batch = await stripe.promotionCodes.list({
        active: true,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
        expand: ['data.coupon'],
      });
      const rows = Array.isArray(batch?.data) ? batch.data : [];
      for (const row of rows) {
        const rowCodeKey = normalizePromotionCodeLookupKey(row?.code || '');
        if (rowCodeKey && rowCodeKey === lookupKey) addCandidate(row);
      }
      if (candidates.length || !batch?.has_more || !rows.length) break;
      startingAfter = sanitizeText(rows[rows.length - 1]?.id);
      if (!startingAfter) break;
    }
  }

  return candidates;
}

function extractAllowedPlanIdsFromMetadata(metadata = {}) {
  const source = metadata && typeof metadata === 'object' ? metadata : {};
  const raw =
    sanitizeText(source.allowedPlanIds) ||
    sanitizeText(source.allowed_plan_ids) ||
    sanitizeText(source.planIds) ||
    sanitizeText(source.plan_ids);
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,;|\s]+/)
      .map((entry) => sanitizeText(entry))
      .filter(Boolean)
  );
}

function isPromotionCodeAllowedForPlan(promotionCode, planId = '') {
  const targetPlanId = sanitizeText(planId);
  if (!targetPlanId) return true;
  const promoSet = extractAllowedPlanIdsFromMetadata(promotionCode?.metadata || {});
  if (promoSet.size && !promoSet.has(targetPlanId)) return false;
  const couponSet = extractAllowedPlanIdsFromMetadata(promotionCode?.coupon?.metadata || {});
  if (couponSet.size && !couponSet.has(targetPlanId)) return false;
  return true;
}

function computePromotionDiscountPreviewAmount({ coupon, amount = 0, currency = '' } = {}) {
  const safeAmount = Math.max(0, Math.round(Number(amount) || 0));
  if (!coupon || safeAmount <= 0) return 0;
  const percentOff = Number(coupon.percent_off || 0);
  if (Number.isFinite(percentOff) && percentOff > 0) {
    return Math.min(safeAmount, Math.round((safeAmount * percentOff) / 100));
  }
  const amountOffMinor = Number(coupon.amount_off || 0);
  if (!Number.isFinite(amountOffMinor) || amountOffMinor <= 0) return 0;
  const couponCurrency = normalizeStripeCurrency(coupon.currency || '');
  const targetCurrency = normalizeStripeCurrency(currency || '');
  if (couponCurrency && targetCurrency && couponCurrency !== targetCurrency) return 0;
  const amountOff = Math.max(0, Math.round(amountOffMinor / 100));
  return Math.min(safeAmount, amountOff);
}

async function resolveStripePromotionCodeForCheckout({
  code = '',
  planId = '',
  planName = '',
  amount = 0,
  currency = '',
  stripeCustomerId = '',
} = {}) {
  const normalizedCode = normalizePromotionCodeInput(code);
  if (!normalizedCode) {
    throw makeHttpError(400, 'Oppgi en rabattkode.');
  }
  if (!isStripeConfigured()) {
    throw makeHttpError(503, 'Rabattkode kan ikke valideres akkurat nå. Kortbetaling er ikke konfigurert.');
  }
  const stripe = getStripe();
  const candidates = await collectStripePromotionCodeCandidates(stripe, code);
  if (!candidates.length) {
    throw makeHttpError(404, 'Ugyldig rabattkode.');
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const normalizedPlanId = sanitizeText(planId);
  const normalizedCurrency = normalizeStripeCurrency(currency || '');
  const normalizedStripeCustomerId = sanitizeText(stripeCustomerId);
  const amountMinor = Math.max(0, Math.round(Number(amount || 0) * 100));
  let rejectionMessage = '';

  for (const promotionCode of candidates) {
    if (promotionCode?.active === false) {
      rejectionMessage = 'Rabattkoden er ikke aktiv.';
      continue;
    }
    const coupon = promotionCode?.coupon;
    if (!coupon || coupon.valid === false) {
      rejectionMessage = 'Rabattkoden er utløpt eller deaktivert.';
      continue;
    }
    if (promotionCode?.expires_at && Number(promotionCode.expires_at) <= nowUnix) {
      rejectionMessage = 'Rabattkoden er utløpt.';
      continue;
    }
    const restrictedCustomerId = sanitizeText(promotionCode?.customer);
    if (restrictedCustomerId && restrictedCustomerId !== normalizedStripeCustomerId) {
      rejectionMessage = 'Rabattkoden er knyttet til en annen kundeprofil.';
      continue;
    }
    if (!isPromotionCodeAllowedForPlan(promotionCode, normalizedPlanId)) {
      rejectionMessage = 'Rabattkoden gjelder ikke valgt plan.';
      continue;
    }

    const restrictions = promotionCode?.restrictions || {};
    const minimumAmount = Number(restrictions.minimum_amount || 0);
    const minimumAmountCurrency = normalizeStripeCurrency(restrictions.minimum_amount_currency || '');
    if (minimumAmount > 0) {
      if (minimumAmountCurrency && normalizedCurrency && minimumAmountCurrency !== normalizedCurrency) {
        rejectionMessage = 'Rabattkoden bruker en annen valuta enn valgt plan.';
        continue;
      }
      if (amountMinor < minimumAmount) {
        rejectionMessage = 'Rabattkoden krever høyere ordrebeløp.';
        continue;
      }
    }

    const discountAmount = computePromotionDiscountPreviewAmount({
      coupon,
      amount,
      currency: normalizedCurrency,
    });
    const percentOff = Number(coupon.percent_off || 0);
    const amountOffMinor = Number(coupon.amount_off || 0);
    const amountOff = Number.isFinite(amountOffMinor) && amountOffMinor > 0
      ? Math.max(0, Math.round(amountOffMinor / 100))
      : 0;
    const label = percentOff > 0
      ? `${Math.round(percentOff)}% rabatt`
      : amountOff > 0
        ? `${amountOff},- rabatt`
        : sanitizeText(coupon.name) || 'Rabattkode';

    return {
      code: normalizePromotionCodeInput(promotionCode?.code || normalizedCode),
      promotionCodeId: sanitizeText(promotionCode?.id),
      couponId: sanitizeText(coupon.id),
      label,
      percentOff: percentOff > 0 ? percentOff : 0,
      amountOff,
      currency: normalizedCurrency,
      discountAmount,
      totalAmount: Math.max(0, Math.round(Number(amount || 0) - discountAmount)),
      planId: normalizedPlanId,
      planName: sanitizeText(planName),
      appliedAt: nowIso(),
    };
  }

  throw makeHttpError(400, rejectionMessage || 'Rabattkoden kan ikke brukes på valgt plan.');
}

function mapStripeCheckoutSessionError(error, planName = '') {
  const code = sanitizeText(error?.code).toLowerCase();
  const type = sanitizeText(error?.type || error?.rawType).toLowerCase();
  const message = sanitizeText(error?.message);
  const safePlanName = sanitizeText(planName) || 'valgt plan';

  if (code === 'resource_missing' && /price/i.test(message)) {
    return {
      status: 503,
      code: 'stripe-price-missing',
      message: `Stripe-pris for ${safePlanName} finnes ikke. Oppdater prisoppsettet i Stripe.`,
    };
  }
  if (code === 'resource_missing' && /customer/i.test(message)) {
    return {
      status: 409,
      code: 'stripe-customer-missing',
      message: 'Tidligere betalingsprofil ble ikke funnet hos Stripe. Oppdater siden og prøv igjen.',
    };
  }
  if (type === 'stripeauthenticationerror' || code === 'authentication_error') {
    return {
      status: 503,
      code: 'stripe-auth-error',
      message: 'Stripe-autentisering feilet. Sjekk STRIPE_SECRET_KEY og prøv igjen.',
    };
  }
  if (
    type === 'stripeinvalidrequesterror' &&
    (/return_url/i.test(message) || /https/i.test(message))
  ) {
    return {
      status: 503,
      code: 'stripe-return-url-invalid',
      message: 'Betalingsretur-URL er ugyldig. Sett APP_URL til riktig https-domene.',
    };
  }
  if (type === 'stripeinvalidrequesterror' && /ui_mode/i.test(message)) {
    return {
      status: 503,
      code: 'stripe-ui-mode-invalid',
      message: 'Stripe checkout-oppsettet er utdatert. Kontakt support og prøv igjen om et øyeblikk.',
    };
  }
  if (
    type === 'stripeinvalidrequesterror' &&
    (/recurring/i.test(message) || /one_time/i.test(message) || /mode/i.test(message))
  ) {
    return {
      status: 503,
      code: 'stripe-price-mode-mismatch',
      message: `Stripe-pris for ${safePlanName} må være en aktiv månedlig abonnementspris.`,
    };
  }
  if (type === 'stripeinvalidrequesterror' || code === 'parameter_missing' || code === 'parameter_invalid_empty') {
    return {
      status: 400,
      code: 'stripe-invalid-request',
      message: 'Betalingsforespørselen mangler nødvendig data. Velg plan på nytt og prøv igjen.',
    };
  }
  return {
    status: 500,
    code: 'stripe-session-create-failed',
    message: 'Kunne ikke starte betaling. Prøv igjen eller velg faktura.',
  };
}

function shouldRetryWithoutStripeCustomer(error) {
  const code = sanitizeText(error?.code).toLowerCase();
  const type = sanitizeText(error?.type || error?.rawType).toLowerCase();
  const message = sanitizeText(error?.message).toLowerCase();
  if (code === 'resource_missing' && /customer/.test(message)) return true;
  if (type === 'stripeinvalidrequesterror' && /customer/.test(message) && /no such/.test(message)) return true;
  return false;
}

function resolveClientCheckoutPlan(profile = {}) {
  const builder = profile?.websiteBuilder && typeof profile.websiteBuilder === 'object'
    ? profile.websiteBuilder
    : {};
  const type = sanitizeText(builder.selectedPlanType) || 'standard';
  if (type === 'custom') {
    const custom = profile?.customWebsitePlan && typeof profile.customWebsitePlan === 'object'
      ? profile.customWebsitePlan
      : {};
    const planId = sanitizeText(builder.selectedPlanId || custom.id || 'custom-website-plan');
    const planName = sanitizeText(custom.title || custom.name || builder.selectedPlanName) || 'Din nettside plan';
    const monthly = typeof custom.monthlyPrice === 'number'
      ? custom.monthlyPrice
      : parsePlanAmount(custom.monthlyPrice || builder.selectedPlanPrice || '');
    return {
      type,
      planId,
      planName,
      amount: Number.isFinite(Number(monthly)) ? Number(monthly) : 0,
    };
  }

  const selectedPlan = findWebsitePlan(builder.selectedPlanId);
  if (!selectedPlan) {
    throw makeHttpError(400, 'Ingen gyldig plan valgt. Velg plan først.');
  }
  return {
    type,
    planId: selectedPlan.id,
    planName: selectedPlan.name,
    amount: parsePlanAmount(selectedPlan.price),
  };
}

function normalizeMeetingPlaceKey(value = '') {
  return sanitizeText(value).toLowerCase().replace(/\s+/g, ' ');
}

function waitMs(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function persistSalesGeocodeCache() {
  try {
    const places = {};
    for (const [key, value] of salesMeetingGeocodeCache.entries()) {
      if (!key) continue;
      places[key] = value;
    }
    writeFileSync(SALES_GEOCODE_CACHE_PATH, JSON.stringify({ places }, null, 2), 'utf8');
  } catch {
    // Cache persistence is best-effort; map pins still work from memory.
  }
}

function schedulePersistSalesGeocodeCache() {
  if (salesMeetingGeocodePersistTimer) return;
  salesMeetingGeocodePersistTimer = setTimeout(() => {
    salesMeetingGeocodePersistTimer = null;
    persistSalesGeocodeCache();
  }, 400);
}

function ensureSalesGeocodeCacheLoaded() {
  if (salesMeetingGeocodeCacheLoaded) return;
  salesMeetingGeocodeCacheLoaded = true;
  if (!existsSync(SALES_GEOCODE_CACHE_PATH)) return;
  try {
    const parsed = JSON.parse(readFileSync(SALES_GEOCODE_CACHE_PATH, 'utf8'));
    const places = parsed?.places && typeof parsed.places === 'object' ? parsed.places : parsed;
    if (!places || typeof places !== 'object') return;
    for (const [key, value] of Object.entries(places)) {
      const cacheKey = normalizeMeetingPlaceKey(key);
      if (!cacheKey) continue;
      if (value && value.failed) {
        salesMeetingGeocodeCache.set(cacheKey, {
          failed: true,
          updatedAt: sanitizeText(value.updatedAt) || nowIso(),
        });
        continue;
      }
      const latitude = Number(value?.latitude);
      const longitude = Number(value?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      salesMeetingGeocodeCache.set(cacheKey, {
        latitude,
        longitude,
        displayName: sanitizeText(value?.displayName) || cacheKey,
        updatedAt: sanitizeText(value?.updatedAt) || nowIso(),
      });
    }
  } catch {
    // Ignore a corrupt cache file and rebuild from Nominatim.
  }
}

function readCachedGeocode(cacheKey = '') {
  ensureSalesGeocodeCacheLoaded();
  const key = normalizeMeetingPlaceKey(cacheKey);
  if (!key || !salesMeetingGeocodeCache.has(key)) return { status: 'miss' };
  const entry = salesMeetingGeocodeCache.get(key);
  if (entry?.failed) {
    const failedAt = Date.parse(String(entry.updatedAt || ''));
    const age = Number.isFinite(failedAt) ? Date.now() - failedAt : Number.POSITIVE_INFINITY;
    if (age < SALES_MEETING_GEOCODE_NEGATIVE_TTL_MS) return { status: 'failed' };
    salesMeetingGeocodeCache.delete(key);
    return { status: 'miss' };
  }
  const latitude = Number(entry?.latitude);
  const longitude = Number(entry?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    salesMeetingGeocodeCache.delete(key);
    return { status: 'miss' };
  }
  return { status: 'ok', value: entry };
}

function storeCachedGeocode(cacheKey = '', value) {
  const key = normalizeMeetingPlaceKey(cacheKey);
  if (!key) return;
  salesMeetingGeocodeCache.set(key, value);
  schedulePersistSalesGeocodeCache();
}

function compactMapLocationText(value = '') {
  const raw = sanitizeText(value).replace(/\uFFFD/g, '');
  if (!raw) return '';
  const lowered = raw.toLowerCase();
  if (
    lowered === 'online' ||
    lowered === 'google meet' ||
    lowered === 'zoom' ||
    lowered === 'teams' ||
    lowered === 'meet' ||
    lowered === 'n/a' ||
    lowered === 'na' ||
    lowered === 'none' ||
    lowered === 'null' ||
    lowered === 'unknown' ||
    lowered === 'not found'
  ) {
    return '';
  }
  if (/^(https?:\/\/)?(meet\.google|zoom\.us|teams\.microsoft)/i.test(raw)) return '';
  return raw;
}

function resolveSalesClientMapQuery(client = {}) {
  const address = compactMapLocationText(client?.meetingPlace);
  if (address) {
    return { query: address, label: address, source: 'address' };
  }
  const name = sanitizeText(client?.businessName);
  if (!name) return null;
  return { query: `${name}, Norge`, label: name, source: 'businessName' };
}

async function fetchJsonWithTimeout(url, { headers = {}, timeoutMs = 6000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 6000));
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function coordsFromPayload(latitude, longitude, displayName, query) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    latitude: lat,
    longitude: lon,
    displayName: sanitizeText(displayName) || sanitizeText(query),
    updatedAt: nowIso(),
  };
}

async function geocodeViaKartverket(query = '') {
  const q = sanitizeText(query);
  if (!q) return null;
  const params = new URLSearchParams({
    sok: q,
    fuzzy: 'true',
    treffPerSide: '1',
  });
  const payload = await fetchJsonWithTimeout(`https://ws.geonorge.no/adresser/v1/sok?${params.toString()}`, {
    timeoutMs: 5000,
    headers: { Accept: 'application/json' },
  });
  const first = Array.isArray(payload?.adresser) ? payload.adresser[0] : null;
  const point = first?.representasjonspunkt || {};
  const label = [sanitizeText(first?.adressetekst), sanitizeText(first?.postnummer), sanitizeText(first?.poststed)]
    .filter(Boolean)
    .join(', ');
  return coordsFromPayload(point.lat, point.lon, label, q);
}

async function geocodeViaNominatim(query = '', { countrycodes = '' } = {}) {
  const q = sanitizeText(query);
  if (!q) return null;
  const minInterval = Math.max(0, SALES_MEETING_GEOCODE_MIN_INTERVAL_MS);
  const elapsedSinceLast = Date.now() - salesMeetingGeocodeLastRequestAt;
  if (elapsedSinceLast < minInterval) {
    await waitMs(minInterval - elapsedSinceLast);
  }
  salesMeetingGeocodeLastRequestAt = Date.now();
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: '1',
    addressdetails: '0',
  });
  if (countrycodes) params.set('countrycodes', countrycodes);
  const payload = await fetchJsonWithTimeout(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    timeoutMs: 6000,
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'nb',
      'User-Agent': 'AsoldiSalesMap/1.0 (+https://asoldi.com)',
    },
  });
  const first = Array.isArray(payload) ? payload[0] : null;
  return coordsFromPayload(first?.lat, first?.lon, first?.display_name, q);
}

async function geocodeViaPhoton(query = '') {
  const q = sanitizeText(query);
  if (!q) return null;
  const params = new URLSearchParams({
    q,
    limit: '1',
    lang: 'en',
  });
  const payload = await fetchJsonWithTimeout(`https://photon.komoot.io/api/?${params.toString()}`, {
    timeoutMs: 6000,
    headers: { Accept: 'application/json' },
  });
  const first = Array.isArray(payload?.features) ? payload.features[0] : null;
  const coords = Array.isArray(first?.geometry?.coordinates) ? first.geometry.coordinates : [];
  const lon = coords[0];
  const lat = coords[1];
  const props = first?.properties && typeof first.properties === 'object' ? first.properties : {};
  const label = [props.name, props.street, props.postcode, props.city, props.country].filter(Boolean).join(', ');
  return coordsFromPayload(lat, lon, label, q);
}

async function geocodeMeetingPlace(place = '', { allowNetwork = true } = {}) {
  const meetingPlace = sanitizeText(place);
  if (!meetingPlace) return null;
  const cacheKey = normalizeMeetingPlaceKey(meetingPlace);
  const cached = readCachedGeocode(cacheKey);
  if (cached.status === 'ok') return cached.value;
  if (cached.status === 'failed') return null;
  if (!allowNetwork) return undefined;

  const attempts = [];
  if (/\d/.test(meetingPlace)) {
    attempts.push(() => geocodeViaKartverket(meetingPlace));
  }
  attempts.push(() => geocodeViaNominatim(meetingPlace, { countrycodes: 'no' }));
  attempts.push(() => geocodeViaNominatim(`${meetingPlace}, Norge`, { countrycodes: 'no' }));
  attempts.push(() => geocodeViaPhoton(meetingPlace));
  let networkFailed = false;
  for (const attempt of attempts) {
    try {
      const geocoded = await attempt();
      if (geocoded) {
        storeCachedGeocode(cacheKey, geocoded);
        return geocoded;
      }
    } catch {
      networkFailed = true;
    }
  }
  if (networkFailed) return undefined;
  storeCachedGeocode(cacheKey, { failed: true, updatedAt: nowIso() });
  return null;
}

function collectUniqueSalesMapPlaces(clients = []) {
  const uniquePlaces = new Map();
  for (const client of Array.isArray(clients) ? clients : []) {
    const resolved = resolveSalesClientMapQuery(client);
    if (!resolved?.query) continue;
    const key = normalizeMeetingPlaceKey(resolved.query);
    if (!key || uniquePlaces.has(key)) continue;
    uniquePlaces.set(key, resolved.query);
  }
  return uniquePlaces;
}

async function backfillOneMissingSalesAddress() {
  const clients = sales.getSalesClients();
  const target = clients.find((client) => {
    const id = sanitizeText(client?.id);
    if (!id || salesAddressBackfillTried.has(id)) return false;
    if (compactMapLocationText(client?.meetingPlace)) return false;
    return Boolean(sanitizeText(client?.businessName));
  });
  if (!target) return false;
  salesAddressBackfillTried.add(sanitizeText(target.id));
  try {
    const orgnr = extractOrganizationNumberFromClientRecord(target);
    let entity = orgnr ? await lookupBrregEntityByOrganizationNumber(orgnr) : null;
    if (!compactMapLocationText(entity?.address)) {
      const candidates = await searchBrregBusinesses(target.businessName).catch(() => []);
      entity = selectBrregCandidateByBusinessName(candidates, target.businessName, '') || entity;
    }
    const address = compactMapLocationText(entity?.address);
    if (!address) return true;
    sales.updateSalesClient(target.id, { meetingPlace: address });
    return true;
  } catch {
    return true;
  }
}

async function warmSalesGeocodeCache() {
  if (salesGeocodeWarmupRunning) return;
  salesGeocodeWarmupRunning = true;
  try {
    const uniquePlaces = collectUniqueSalesMapPlaces(sales.getSalesClients());
    let geocodedOne = false;
    for (const [key, place] of uniquePlaces.entries()) {
      if (readCachedGeocode(key).status !== 'miss') continue;
      await geocodeMeetingPlace(place, { allowNetwork: true });
      geocodedOne = true;
      break;
    }
    if (!geocodedOne) await backfillOneMissingSalesAddress();
  } catch {
    // Background geocoding should never take down the server.
  } finally {
    salesGeocodeWarmupRunning = false;
  }
}

function startSalesGeocodeWarmupLoop() {
  if (salesGeocodeWarmupInterval) return;
  ensureSalesGeocodeCacheLoaded();
  void warmSalesGeocodeCache();
  salesGeocodeWarmupInterval = setInterval(() => {
    void warmSalesGeocodeCache();
  }, 1200);
}

function healStaleLocalMakerPort(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  // Maker always listens on :3000 locally. Remap any legacy :4000 origin so
  // Sales create-run / import never tries the dead port again.
  return raw.replace(
    /^(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)):4000(?=$|[/?#])/i,
    '$1:3000'
  );
}

function normalizeHttpBaseUrl(value = '') {
  const raw = sanitizeText(healStaleLocalMakerPort(value));
  if (!raw) return '';
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    const cleanPath = String(parsed.pathname || '').replace(/\/+$/, '');
    const originAndPath = `${parsed.protocol}//${parsed.host}${cleanPath}`;
    return healStaleLocalMakerPort(originAndPath);
  } catch {
    return '';
  }
}

function normalizeHttpOrigin(value = '') {
  const normalized = normalizeHttpBaseUrl(value);
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    return healStaleLocalMakerPort(`${parsed.protocol}//${parsed.host}`);
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
  if (
    raw === 'in-person' ||
    raw === 'in_person' ||
    raw === 'inperson' ||
    raw === 'physical' ||
    raw === 'fysisk' ||
    raw === 'irl'
  ) {
    return 'in-person';
  }
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

function isSyntheticMyphonerFallbackEmail(value = '') {
  const email = normalizeEmail(value);
  return /^lead-\d+@no-email\.asoldi$/.test(email);
}

function isMissingEmailPlaceholder(value = '') {
  const email = normalizeEmail(value);
  return ['', 'not found', 'n/a', 'na', 'none', 'unknown'].includes(email);
}

function isLikelyTestEmail(value = '') {
  const email = normalizeEmail(value);
  if (!email) return false;
  if (isSyntheticMyphonerFallbackEmail(email)) return true;
  if (/(?:^|@)(?:example\.com|example\.org|example\.net|test\.com|mailinator\.com)$/i.test(email)) return true;
  const [localPart = ''] = email.split('@');
  return /(?:^|[-_.])(test|demo|sample|fake|qa|no-?reply|noreply)(?:[-_.]|\d|$)/i.test(localPart);
}

function hasPreferredEmailContext(text = '') {
  return /\b(?:bruk\s+denne|use\s+this|primary|preferred|hoved|main)\b/i.test(String(text || ''));
}

function hasBlockedEmailContext(text = '') {
  return /\b(?:ikke\s+bruk|ikke\s+denne|do\s+not\s+use|don't\s+use|not\s+use)\b/i.test(String(text || ''));
}

function extractEmailCandidatesFromText(text = '') {
  const raw = String(text || '').replace(/\uFFFD/g, ' ');
  if (!raw) return [];
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const seen = new Set();
  const candidates = [];
  for (const match of raw.matchAll(emailRegex)) {
    const candidate = normalizeEmail(match[0] || '');
    if (!candidate || !isValidEmail(candidate) || seen.has(candidate)) continue;
    const index = Number(match.index || 0);
    const windowStart = Math.max(0, index - 80);
    const windowEnd = Math.min(raw.length, index + candidate.length + 80);
    const context = raw.slice(windowStart, windowEnd);
    candidates.push({
      email: candidate,
      preferred: hasPreferredEmailContext(context),
      blocked: hasBlockedEmailContext(context),
    });
    seen.add(candidate);
  }
  return candidates;
}

function pickBestEmailFromText(text = '') {
  const candidates = extractEmailCandidatesFromText(text);
  if (!candidates.length) return '';
  const preferred = candidates.find((entry) => entry.preferred && !entry.blocked && !isLikelyTestEmail(entry.email));
  if (preferred) return preferred.email;
  const firstGood = candidates.find((entry) => !entry.blocked && !isLikelyTestEmail(entry.email));
  if (firstGood) return firstGood.email;
  return '';
}

function normalizePhoneCandidate(value = '') {
  const raw = sanitizeText(value);
  if (!raw) return '';
  const compact = raw.replace(/[^\d+]/g, '');
  if (!compact) return '';
  const normalized = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  const digitsOnly = normalized.replace(/\D/g, '');
  if (digitsOnly.length < 8 || digitsOnly.length > 15) return '';
  return normalized;
}

function extractPhoneCandidatesFromText(text = '') {
  const raw = String(text || '').replace(/\uFFFD/g, ' ');
  if (!raw) return [];
  const fragments = [];
  const regex = /(?:\+?\d[\d\s()./-]{6,}\d)/g;
  for (const match of raw.matchAll(regex)) {
    const candidate = sanitizeText(match[0]);
    if (!candidate) continue;
    const split = candidate.includes('/') ? candidate.split('/').map((entry) => sanitizeText(entry)) : [candidate];
    for (const part of split) {
      if (!part) continue;
      if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(part)) continue;
      if (/\d{1,2}[:.]\d{2}/.test(part)) continue;
      const normalized = normalizePhoneCandidate(part);
      if (normalized) fragments.push(normalized);
    }
  }
  return [...new Set(fragments)];
}

function pickBestPhoneFromText(text = '') {
  const candidates = extractPhoneCandidatesFromText(text);
  return candidates[0] || '';
}

function extractRecordingDestinationPhoneFromBuffer(buffer) {
  if (!buffer || typeof buffer.length !== 'number' || buffer.length <= 0) return '';
  const metadataText = buffer.toString('latin1');
  if (!metadataText) return '';
  const compactText = metadataText.replace(/[^\x20-\x7E]+/g, ' ');
  const explicitMatch = compactText.match(/(?:Recording|Destination|Phone|To)\s*[:#-]?\s*(\+?\d[\d\s()./-]{6,}\d)/i);
  if (explicitMatch?.[1]) {
    const normalized = normalizePhoneCandidate(explicitMatch[1]);
    if (normalized) return normalized;
  }
  return '';
}

async function listLocalRecordingFiles() {
  const recordingDirs = [
    path.join(distPath, 'myphoner-audio'),
    path.join(__dirname, 'public', 'myphoner-audio'),
  ];
  const filesByName = new Map();
  for (const dirPath of recordingDirs) {
    let entries = [];
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fileName = sanitizeText(entry.name);
      const ext = path.extname(fileName).toLowerCase();
      if (!fileName || !LOCAL_RECORDING_EXTENSIONS.has(ext)) continue;
      if (filesByName.has(fileName)) continue;
      const fullPath = path.join(dirPath, fileName);
      try {
        const stats = await fs.stat(fullPath);
        filesByName.set(fileName, {
          fileName,
          fullPath,
          mtimeMs: Number(stats.mtimeMs || 0),
        });
      } catch {
        // Ignore unreadable files and continue with the rest.
      }
    }
  }
  return [...filesByName.values()].sort((a, b) => b.mtimeMs - a.mtimeMs);
}

async function syncLocalMyphonerRecordings({
  baseUrl = '',
  persist = true,
  fillMissingOnly = false,
} = {}) {
  const normalizedBaseUrl = normalizeHttpBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    throw new Error('Cannot sync recordings without a valid base URL.');
  }
  const files = await listLocalRecordingFiles();
  const filesWithoutPhone = [];
  const unmatchedByPhone = [];
  const matchedCandidates = [];
  for (const file of files) {
    let fileBuffer = null;
    try {
      fileBuffer = await fs.readFile(file.fullPath);
    } catch {
      filesWithoutPhone.push({ fileName: file.fileName, reason: 'read-failed' });
      continue;
    }
    const destinationPhone = extractRecordingDestinationPhoneFromBuffer(fileBuffer);
    if (!destinationPhone) {
      filesWithoutPhone.push({ fileName: file.fileName, reason: 'missing-phone-metadata' });
      continue;
    }
    const matchedClient = findSalesClientByPhone(destinationPhone);
    if (!matchedClient) {
      unmatchedByPhone.push({ fileName: file.fileName, destinationPhone });
      continue;
    }
    matchedCandidates.push({
      ...file,
      destinationPhone,
      clientId: matchedClient.id,
      businessName: sanitizeText(matchedClient.businessName),
    });
  }

  const selectedByClient = new Map();
  for (const candidate of matchedCandidates) {
    const previous = selectedByClient.get(candidate.clientId);
    if (!previous || candidate.mtimeMs > previous.mtimeMs) {
      selectedByClient.set(candidate.clientId, candidate);
    }
  }

  const applied = [];
  let skippedExistingRecording = 0;
  for (const candidate of selectedByClient.values()) {
    const recordingUrl = `${normalizedBaseUrl}/myphoner-audio/${encodeURIComponent(candidate.fileName)}`;
    if (persist) {
      const currentClient = sales.getSalesClientById(candidate.clientId);
      const existingRecordingUrl = sanitizeText(currentClient?.myphoner?.latestRecordingUrl);
      if (fillMissingOnly && existingRecordingUrl) {
        skippedExistingRecording += 1;
        continue;
      }
      sales.updateSalesClient(candidate.clientId, {
        myphoner: {
          latestRecordingUrl: recordingUrl,
          latestCallId: sanitizeText(candidate.fileName.replace(/\.[^.]+$/, '')),
          latestCallDestinationNumber: candidate.destinationPhone,
          latestRecordingSyncReason: 'local-recording-backfill',
          lastRecordingWebhookAt: nowIso(),
          latestEventAt: nowIso(),
        },
      });
    }
    applied.push({
      clientId: candidate.clientId,
      businessName: candidate.businessName,
      fileName: candidate.fileName,
      destinationPhone: candidate.destinationPhone,
      recordingUrl,
    });
  }

  return {
    summary: {
      filesFound: files.length,
      filesWithPhoneMetadata: matchedCandidates.length + unmatchedByPhone.length,
      matchedFiles: matchedCandidates.length,
      clientsSelected: selectedByClient.size,
      clientsUpdated: persist ? applied.length : 0,
      filesWithoutPhoneMetadata: filesWithoutPhone.length,
      unmatchedByPhone: unmatchedByPhone.length,
      ignoredOlderMatches: matchedCandidates.length - selectedByClient.size,
      skippedExistingRecording,
    },
    applied,
    filesWithoutPhone,
    unmatchedByPhone,
  };
}

function resolveLeadCommentText(source = {}, leadDataMap = new Map(), extra = []) {
  const extras = Array.isArray(extra) ? extra : [extra];
  const fragments = [
    ...extras,
    source?.last_event?.comment,
    source?.last_action_or_note?.comment,
    source?.comment,
    pickLeadDataValue(leadDataMap, ['winner_comment']),
    pickLeadDataValue(leadDataMap, ['comment']),
    pickLeadDataValue(leadDataMap, ['notes']),
    pickLeadDataValue(leadDataMap, ['note']),
    pickLeadDataValue(leadDataMap, ['description']),
  ]
    .map((entry) => sanitizeMyphonerFieldValue(entry))
    .filter(Boolean);
  return [...new Set(fragments)].join('\n');
}

function pickMyphonerLeadEmail(source = {}, leadDataMap = new Map(), commentText = '') {
  const structuredEmail = normalizeEmail(
    pickLeadDataValue(leadDataMap, ['email', 'e_mail', 'mail', 'epost', 'business_email', 'email_address'])
  );
  const fromComments = pickBestEmailFromText(commentText);
  if (fromComments) return fromComments;
  if (!structuredEmail) return '';
  if (!isValidEmail(structuredEmail) || isMissingEmailPlaceholder(structuredEmail) || isLikelyTestEmail(structuredEmail)) return '';
  return structuredEmail;
}

function pickMyphonerLeadPhone(source = {}, leadDataMap = new Map(), commentText = '') {
  const structuredPhone = normalizePhoneCandidate(
    pickLeadDataValue(leadDataMap, [
      'mobile_phone',
      'phone',
      'business_phone',
      'phone_number',
      'work_office_phone',
      'telephone',
      'telefon',
    ])
  );
  if (structuredPhone) return structuredPhone;
  const fromComments = pickBestPhoneFromText(commentText);
  if (fromComments) return fromComments;
  return '';
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
  const rawProffUrl = sanitizeText(input.proffUrl ?? base.proffUrl);
  const canonicalProffUrl = canonicalizeProffCompanyUrl(rawProffUrl);
  return {
    instagramUrl: sanitizeText(input.instagramUrl ?? base.instagramUrl),
    facebookUrl: sanitizeText(input.facebookUrl ?? base.facebookUrl),
    proffUrl: canonicalProffUrl || rawProffUrl,
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

  const product = (() => {
    const requested = sanitizeText(source.product ?? existing?.product);
    if (requested) return sales.normalizeSalesProduct(requested);
    return sales.normalizeSalesProduct(existing?.product || 'asoldi');
  })();
  const payload = {
    businessName: sanitizeText(source.businessName ?? existing?.businessName),
    contactPerson: sanitizeText(source.contactPerson ?? existing?.contactPerson),
    contactEmail: sanitizeText(source.contactEmail ?? existing?.contactEmail),
    contactPhone: sanitizeText(source.contactPhone ?? existing?.contactPhone),
    meetingPlace: meetingPlaceRaw,
    industry: sanitizeText(source.industry ?? existing?.industry),
    meetingMode: mode,
    agreedTime,
    meetingAt,
    product,
    websiteDomain:
      product === 'ssu' ? '' : sanitizeSalesWebsiteDomain(source.websiteDomain ?? existing?.websiteDomain),
    details: normalizeSalesDetailLinks(source.details, existing?.details),
  };

  if (requireCore) {
    if (!payload.businessName) throw new Error('Business name is required.');
    if (!payload.contactPerson) throw new Error('Contact person is required.');
  }
  if (payload.agreedTime && !payload.meetingAt) {
    throw new Error('Meeting date/time is required when agreed time is enabled.');
  }
  if (payload.agreedTime && payload.meetingAt && !isValidIsoDate(payload.meetingAt)) {
    throw new Error('Meeting date/time must be a valid ISO date.');
  }
  return payload;
}

function normalizeBusinessNameForMatch(value = '') {
  const normalized = String(value || '')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[øØ]/g, 'o')
    .replace(/[åÅ]/g, 'a')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalizeLooseKey(normalized);
}

function resolveCorrectionMeetingAt(value = '') {
  const raw = sanitizeText(value);
  if (!raw) return '';
  const parsedIso = myphonerApi.parseMyPhonerDateToIso(raw);
  if (parsedIso) return parsedIso;
  return parseMyphonerMeetingAtFromFreeText(raw);
}

function shouldOverrideEmail(currentValue = '', nextValue = '', force = false) {
  const current = normalizeEmail(currentValue);
  const next = normalizeEmail(nextValue);
  if (!next || !isValidEmail(next) || isLikelyTestEmail(next)) return false;
  if (force) return current !== next;
  if (!current) return true;
  if (!isValidEmail(current)) return true;
  if (isMissingEmailPlaceholder(current)) return true;
  if (isLikelyTestEmail(current)) return true;
  return false;
}

function correctionMatchesClient(correction = {}, client = {}) {
  const names = [correction.businessName, ...(Array.isArray(correction.aliases) ? correction.aliases : [])]
    .map((entry) => normalizeBusinessNameForMatch(entry))
    .filter(Boolean);
  if (!names.length) return false;
  const businessName = normalizeBusinessNameForMatch(client.businessName);
  if (!businessName) return false;
  return names.some((name) => businessName === name || businessName.includes(name) || name.includes(businessName));
}

function normalizeCorrectionTargetStatus(value = '') {
  const normalized = sanitizeText(value).toLowerCase();
  if (normalized === 'secondary' || normalized === 'not-sold' || normalized === 'active') return normalized;
  return '';
}

function applyConfiguredSalesContactCorrections({ createMissing = true } = {}) {
  if (!Array.isArray(SALES_CONTACT_CORRECTIONS) || !SALES_CONTACT_CORRECTIONS.length) {
    return { scanned: 0, matched: 0, updated: 0, created: 0, unmatched: [] };
  }
  const clients = sales.getSalesClients();
  const unmatched = [];
  let matched = 0;
  let updated = 0;
  let created = 0;

  for (const correction of SALES_CONTACT_CORRECTIONS) {
    const correctionPhone = normalizePhoneCandidate(correction.contactPhone);
    const correctionPhoneDigits = normalizePhoneDigits(correctionPhone);
    let existing = clients.find((client) => correctionMatchesClient(correction, client));
    if (!existing && correctionPhoneDigits) {
      existing = clients.find((client) => {
        const currentDigits = normalizePhoneDigits(client.contactPhone);
        if (!currentDigits) return false;
        return (
          currentDigits === correctionPhoneDigits ||
          currentDigits.endsWith(correctionPhoneDigits) ||
          correctionPhoneDigits.endsWith(currentDigits)
        );
      });
    }
    const correctionEmail = normalizeEmail(correction.contactEmail);
    const correctionPerson = sanitizeText(correction.contactPerson);
    const correctionPlace = sanitizeText(correction.meetingPlace);
    const correctionNotes = sanitizeText(correction.notes);
    const correctionTargetStatus = normalizeCorrectionTargetStatus(correction.targetStatus || correction.status);
    const correctionStatusReason = sanitizeText(correction.statusReason || correction.notes);
    const correctionMeetingAt = resolveCorrectionMeetingAt(correction.meetingAtHint || correction.meetingAt || '');
    const correctionMode = correction.meetingMode ? normalizeMeetingMode(correction.meetingMode) : '';
    const shouldCreate = parseBoolean(correction.createIfMissing, false);

    if (!existing) {
      unmatched.push(sanitizeText(correction.businessName));
      if (!createMissing || !shouldCreate) continue;
      const createdClient = sales.createSalesClient({
        ownerId: sanitizeText(MYPHONER_DEFAULT_SALES_OWNER_KEY),
        businessName: sanitizeText(correction.businessName),
        contactPerson: correctionPerson || sanitizeText(correction.businessName),
        contactEmail: isValidEmail(correctionEmail) && !isLikelyTestEmail(correctionEmail) ? correctionEmail : '',
        contactPhone: correctionPhone,
        meetingMode: correctionMode || 'online',
        meetingPlace: correctionPlace,
        agreedTime: Boolean(correctionMeetingAt),
        meetingAt: correctionMeetingAt,
        myphoner: {
          winnerComment: correctionNotes,
        },
      });
      let createdRecord = createdClient;
      if (correctionTargetStatus && correctionTargetStatus !== 'active' && createdRecord.status !== correctionTargetStatus) {
        const moved = sales.setSalesStatus(createdRecord.id, correctionTargetStatus, {
          reason: correctionStatusReason,
        });
        if (moved) createdRecord = moved;
      }
      clients.push(createdRecord);
      created += 1;
      continue;
    }

    matched += 1;
    const patch = {};
    if (correctionPerson && (parseBoolean(correction.forceContactPerson, false) || !sanitizeText(existing.contactPerson))) {
      patch.contactPerson = correctionPerson;
    }
    if (correctionPhone && (parseBoolean(correction.forcePhone, false) || !sanitizeText(existing.contactPhone))) {
      patch.contactPhone = correctionPhone;
    }
    if (correctionPlace && (parseBoolean(correction.forceMeetingPlace, false) || !sanitizeText(existing.meetingPlace))) {
      patch.meetingPlace = correctionPlace;
    }
    if (correctionMode && correctionMode !== normalizeMeetingMode(existing.meetingMode)) {
      patch.meetingMode = correctionMode;
    }
    if (
      correctionMeetingAt &&
      (parseBoolean(correction.forceMeetingAt, false) || !sanitizeText(existing.meetingAt))
    ) {
      patch.meetingAt = correctionMeetingAt;
      patch.agreedTime = true;
    }
    if (shouldOverrideEmail(existing.contactEmail, correctionEmail, parseBoolean(correction.forceEmail, false))) {
      patch.contactEmail = correctionEmail;
    }
    if (correctionNotes) {
      const currentComment = sanitizeText(existing.myphoner?.winnerComment);
      if (!currentComment.toLowerCase().includes(correctionNotes.toLowerCase())) {
        patch.myphoner = {
          ...(patch.myphoner || {}),
          winnerComment: currentComment ? `${currentComment}\n\n${correctionNotes}` : correctionNotes,
        };
      }
    }

    let next = existing;
    let changed = false;
    if (Object.keys(patch).length) {
      const saved = sales.updateSalesClient(existing.id, patch);
      if (saved) {
        next = saved;
        changed = true;
      }
    }
    if (correctionTargetStatus && correctionTargetStatus !== next.status) {
      const moved = sales.setSalesStatus(next.id, correctionTargetStatus, {
        reason: correctionStatusReason,
      });
      if (moved) {
        next = moved;
        changed = true;
      }
    }
    if (changed) {
      const index = clients.findIndex((client) => client.id === existing.id);
      if (index !== -1) clients[index] = next;
      updated += 1;
    }
  }

  return {
    scanned: SALES_CONTACT_CORRECTIONS.length,
    matched,
    updated,
    created,
    unmatched: [...new Set(unmatched.filter(Boolean))],
  };
}

function cleanupBlockedSalesWebsiteDomains() {
  const clients = sales.getSalesClients();
  let cleaned = 0;
  for (const client of clients) {
    const current = sanitizeText(client.websiteDomain);
    if (!current || !isBlockedSalesWebsiteDomain(current)) continue;
    const updated = sales.updateSalesClient(client.id, { websiteDomain: '' });
    if (updated) cleaned += 1;
  }
  return {
    scanned: clients.length,
    cleaned,
  };
}

function buildSalesEmailAudit(clients = []) {
  const rows = (Array.isArray(clients) ? clients : []).map((client) => {
    const email = normalizeEmail(client.contactEmail);
    const hasEmail = Boolean(email);
    const valid = hasEmail && isValidEmail(email);
    const testLike = valid && isLikelyTestEmail(email);
    return {
      id: sanitizeText(client.id),
      businessName: sanitizeText(client.businessName),
      contactPerson: sanitizeText(client.contactPerson),
      contactPhone: sanitizeText(client.contactPhone),
      email,
      hasEmail,
      valid,
      testLike,
    };
  });

  return {
    totals: {
      total: rows.length,
      withAnyEmail: rows.filter((row) => row.hasEmail).length,
      valid: rows.filter((row) => row.valid).length,
      validNonTest: rows.filter((row) => row.valid && !row.testLike).length,
      missing: rows.filter((row) => !row.hasEmail).length,
      invalid: rows.filter((row) => row.hasEmail && !row.valid).length,
      flaggedTest: rows.filter((row) => row.valid && row.testLike).length,
    },
    missing: rows
      .filter((row) => !row.hasEmail)
      .map((row) => ({
        id: row.id,
        businessName: row.businessName,
        contactPerson: row.contactPerson,
        contactPhone: row.contactPhone,
      })),
    invalid: rows
      .filter((row) => row.hasEmail && !row.valid)
      .map((row) => ({
        id: row.id,
        businessName: row.businessName,
        email: row.email,
      })),
    flaggedTest: rows
      .filter((row) => row.valid && row.testLike)
      .map((row) => ({
        id: row.id,
        businessName: row.businessName,
        email: row.email,
      })),
  };
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

function selectBrregCandidateByBusinessName(candidates = [], businessName = '', locationHint = '') {
  const list = Array.isArray(candidates)
    ? candidates.filter((entry) => sanitizeText(entry?.organizationNumber) && sanitizeText(entry?.name))
    : [];
  if (!list.length) return null;
  const normalizedBusinessName = normalizeSearchText(businessName);
  if (!normalizedBusinessName) return null;

  const exact = list.filter((entry) => normalizeSearchText(entry.name) === normalizedBusinessName);
  if (exact.length === 1) return exact[0];

  const loose = list.filter((entry) => {
    const normalizedCandidate = normalizeSearchText(entry.name);
    if (!normalizedCandidate) return false;
    return (
      normalizedCandidate.includes(normalizedBusinessName) ||
      normalizedBusinessName.includes(normalizedCandidate)
    );
  });
  if (loose.length === 1) return loose[0];

  const cityToken =
    normalizeSearchText(locationHint)
      .split(' ')
      .map((entry) => sanitizeText(entry))
      .find((entry) => entry.length >= 3 && !/^\d+$/.test(entry)) ||
    '';
  if (cityToken) {
    const pool = loose.length ? loose : list;
    const cityMatches = pool.filter((entry) => normalizeSearchText(entry.address).includes(cityToken));
    if (cityMatches.length === 1) return cityMatches[0];
  }

  return null;
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

function resolveSalesClientArg(clientOrId) {
  if (clientOrId && typeof clientOrId === 'object') return clientOrId;
  const id = sanitizeText(clientOrId);
  if (!id) return null;
  return sales.getSalesClientById(id) || { id };
}

function getSalesPreviewUrl(clientOrId) {
  const client = resolveSalesClientArg(clientOrId);
  if (!client?.id) return '';
  const slug = sanitizeText(client.websiteImport?.previewSlug);
  return salesPreview.getSalesPreviewPath(client.id, slug) || buildSalesPreviewPath(client.id);
}

function getPublicSalesPreviewUrl(clientOrId) {
  const client = resolveSalesClientArg(clientOrId);
  if (!client?.id) return '';
  return salesPreview.getPublicSalesPreviewUrl(client) || buildPublicSalesPreviewUrl(client.id);
}

function rewriteOffersToPublicPreview(clientId) {
  const id = sanitizeText(typeof clientId === 'object' ? clientId?.id : clientId);
  const publicUrl = getPublicSalesPreviewUrl(clientId);
  if (!publicUrl || !id) return 0;
  return offers.updatePreviewUrlForSalesClient(id, publicUrl);
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
    DEFAULT_MAKER_LOCAL_URL,
  ];
  for (const candidate of candidates) {
    // Accept pasted deep links (e.g. .../run/<id>) but always resolve the
    // Website Maker base to origin to keep downstream API/link building valid.
    const normalized = normalizeHttpOrigin(candidate);
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

function normalizeAbsoluteHttpUrl(value = '') {
  const raw = sanitizeText(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function resolveSalesMakerCallbackUrl(req) {
  const explicit = normalizeAbsoluteHttpUrl(process.env.WEBSITE_MAKER_STATUS_CALLBACK_URL || process.env.SALES_MAKER_STATUS_CALLBACK_URL || '');
  if (explicit) return explicit;
  const appBase = normalizeHttpBaseUrl(process.env.APP_URL || `${req.protocol}://${req.get('host')}`);
  if (!appBase) return '';
  return `${appBase}/api/admin/sales/maker-status-callback`;
}

function resolveSalesPreviewPushUrl() {
  const explicit = normalizeAbsoluteHttpUrl(process.env.SALES_PREVIEW_PUSH_URL || '');
  if (explicit) return explicit;
  return `${salesPreview.getPublicPreviewOrigin()}/api/admin/sales/maker-preview-push`;
}

function isMakerStatusCallbackAuthorized(req) {
  const requiredToken = sanitizeText(process.env.WEBSITE_MAKER_STATUS_CALLBACK_TOKEN || process.env.SALES_MAKER_STATUS_CALLBACK_TOKEN || '');
  if (!requiredToken) return true;
  const provided = sanitizeText(req.headers['x-sales-callback-token'] || req.headers['x-maker-callback-token']);
  return provided && secureStringEqual(provided, requiredToken);
}

function secureStringEqual(left = '', right = '') {
  const a = String(left || '');
  const b = String(right || '');
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function getMyphonerWebhookSecretFromRequest(req) {
  const header =
    sanitizeText(req.headers['x-myphoner-webhook-secret']) ||
    sanitizeText(req.headers['x-webhook-secret']);
  if (header) return header;
  const auth = sanitizeText(req.headers.authorization);
  if (auth.toLowerCase().startsWith('bearer ')) return sanitizeText(auth.slice(7));
  return sanitizeText(req.query?.secret);
}

function isMyphonerWebhookAuthorized(req) {
  if (!MYPHONER_WEBHOOK_SECRET) return false;
  const provided = getMyphonerWebhookSecretFromRequest(req);
  return secureStringEqual(provided, MYPHONER_WEBHOOK_SECRET);
}

function resolveMyphonerWebhookBaseUrl() {
  const raw = sanitizeText(process.env.MYPHONER_WEBHOOK_BASE_URL || process.env.APP_URL);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (!/^https?:$/i.test(parsed.protocol)) return '';
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function buildMyphonerWebhookTargetUrl(kind = 'winner', queryParams = {}) {
  const baseUrl = resolveMyphonerWebhookBaseUrl();
  if (!baseUrl) return '';
  const routeBase = `${baseUrl}/api/integrations/myphoner/webhook/${encodeURIComponent(kind)}`;
  const params = new URLSearchParams();
  if (MYPHONER_WEBHOOK_SECRET) {
    params.set('secret', MYPHONER_WEBHOOK_SECRET);
  }
  for (const [key, value] of Object.entries(queryParams || {})) {
    const normalizedKey = sanitizeText(key);
    const normalizedValue = sanitizeText(value);
    if (!normalizedKey || !normalizedValue) continue;
    params.set(normalizedKey, normalizedValue);
  }
  const queryString = params.toString();
  if (!queryString) return routeBase;
  return `${routeBase}?${queryString}`;
}

function isMyphonerWebhookAlreadyTakenError(response = null) {
  const message = sanitizeText(response?.error || response?.message);
  return /target url has already been taken/i.test(message);
}

function normalizeLooseKey(value = '') {
  return sanitizeText(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizePhoneDigits(value = '') {
  return String(value || '').replace(/\D+/g, '');
}

function extractHostFromDomainLikeValue(value = '') {
  const raw = sanitizeText(value);
  if (!raw) return '';
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw) ? raw : `https://${raw}`;
  try {
    return sanitizeText(new URL(withProtocol).host.toLowerCase().replace(/^www\./, ''));
  } catch {
    return sanitizeText(
      raw
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .split('/')[0]
        .replace(/^www\./, '')
    );
  }
}

function isBlockedSalesWebsiteDomain(value = '') {
  const host = extractHostFromDomainLikeValue(value);
  if (!host) return false;
  // Deprecated: websiteDomain now mirrors the dedicated Myphoner website-domain field directly.
  return false;
}

function sanitizeSalesWebsiteDomain(value = '') {
  return sanitizeText(value);
}

function splitMultilineValues(value = '') {
  return String(value || '')
    .split(/\r?\n|,/)
    .map((entry) => sanitizeText(entry))
    .filter(Boolean);
}

function coerceHttpUrl(value = '') {
  const raw = sanitizeText(value);
  if (!raw) return '';
  const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw);
  const candidate = hasProtocol ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    if (!/^https?:$/i.test(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function classifySalesLink(url = '') {
  const normalized = coerceHttpUrl(url);
  if (!normalized) return { kind: 'other', url: '' };
  let host = '';
  let pathName = '';
  let searchParams = new URLSearchParams();
  try {
    const parsed = new URL(normalized);
    host = parsed.host.toLowerCase();
    pathName = parsed.pathname.toLowerCase();
    searchParams = parsed.searchParams;
  } catch {
    return { kind: 'other', url: normalized };
  }
  if (host.includes('instagram.com')) return { kind: 'instagram', url: normalized };
  if (host.includes('facebook.com') || host.includes('fb.com') || host.includes('m.me')) {
    return { kind: 'facebook', url: normalized };
  }
  if (host.includes('proff.no')) return { kind: 'proff', url: normalized };
  const hasGoogleMapsQuerySignal =
    searchParams.has('cid') ||
    searchParams.has('g_mp') ||
    searchParams.has('gmp') ||
    searchParams.has('place_id') ||
    searchParams.has('placeid') ||
    searchParams.has('query_place_id');
  if (
    host.includes('maps.google.') ||
    host.includes('google') && (pathName.includes('/maps') || pathName.includes('/business') || hasGoogleMapsQuerySignal) ||
    host.includes('maps.app.goo.gl') ||
    host.includes('g.page')
  ) {
    return { kind: 'googleBusiness', url: normalized };
  }
  return { kind: 'other', url: normalized };
}

function isProffSearchUrl(value = '') {
  const normalized = coerceHttpUrl(value);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    const host = parsed.host.toLowerCase();
    if (!host.includes('proff.no')) return false;
    const rawPath = String(parsed.pathname || '').replace(/\/+$/, '').toLowerCase();
    let decodedPath = rawPath;
    try {
      decodedPath = decodeURIComponent(rawPath).replace(/\/+$/, '').toLowerCase();
    } catch {
      decodedPath = rawPath;
    }
    return (
      rawPath === '/bransjesok' ||
      rawPath.startsWith('/bransjesok/') ||
      rawPath === '/sok' ||
      rawPath.startsWith('/sok/') ||
      rawPath === '/s%c3%b8k' ||
      rawPath.startsWith('/s%c3%b8k/') ||
      decodedPath === '/søk' ||
      decodedPath.startsWith('/søk/')
    );
  } catch {
    return false;
  }
}

function canonicalizeProffCompanyUrl(value = '') {
  const normalized = coerceHttpUrl(value);
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    const host = parsed.host.toLowerCase();
    if (!host.includes('proff.no')) return '';
    const pathName = parsed.pathname.replace(/\/+$/, '');
    const lowerPath = pathName.toLowerCase();
    if (lowerPath.startsWith('/bransjesok/') || lowerPath === '/bransjesok') return '';
    const profilePrefixes = ['/selskap/', '/organisasjon/', '/nokkeltall/', '/regnskap/', '/roller/'];
    const matchedPrefix = profilePrefixes.find((prefix) => lowerPath.startsWith(prefix));
    if (!matchedPrefix) return '';
    const normalizedPath = pathName.replace(/^\/(organisasjon|nokkeltall|regnskap|roller)\//i, '/selskap/');
    return `https://www.proff.no${normalizedPath}`;
  } catch {
    return '';
  }
}

function isProffOrganizationLookupUrl(value = '') {
  const normalized = coerceHttpUrl(value);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    const host = parsed.host.toLowerCase();
    if (!host.includes('proff.no')) return false;
    const segments = String(parsed.pathname || '')
      .split('/')
      .map((entry) => sanitizeText(entry))
      .filter(Boolean);
    if (segments.length !== 2) return false;
    const section = sanitizeText(segments[0]).toLowerCase();
    if (section !== 'organisasjon' && section !== 'selskap') return false;
    const identifier = sanitizeText(segments[1]).replace(/\D+/g, '');
    return identifier.length === 9;
  } catch {
    return false;
  }
}

function shouldResolveProffUrl(value = '') {
  const normalized = coerceHttpUrl(value);
  if (!normalized) return true;
  const canonical = canonicalizeProffCompanyUrl(normalized);
  if (!canonical) return true;
  return isProffSearchUrl(canonical) || isProffOrganizationLookupUrl(canonical);
}

function extractProffOrganizationNumberFromUrl(value = '') {
  const canonical = canonicalizeProffCompanyUrl(value);
  if (!canonical) return '';
  try {
    const parsed = new URL(canonical);
    const segments = String(parsed.pathname || '')
      .split('/')
      .map((entry) => sanitizeText(entry))
      .filter(Boolean);
    if (!segments.length) return '';
    const digits = sanitizeText(segments[segments.length - 1]).replace(/\D+/g, '');
    return digits.length === 9 ? digits : '';
  } catch {
    return '';
  }
}

function isLikelyMissingMyphonerValue(value = '') {
  const raw = sanitizeText(value).toLowerCase();
  if (!raw) return true;
  return [
    'not found',
    'n/a',
    'na',
    'none',
    'null',
    'unknown',
    'ikke funnet',
    'ikke tilgjengelig',
    'ingen',
    '-',
    '--',
  ].includes(raw);
}

function sanitizeMyphonerFieldValue(value = '') {
  const cleaned = sanitizeText(String(value ?? '').replace(/\uFFFD/g, ''));
  if (isLikelyMissingMyphonerValue(cleaned)) return '';
  return cleaned;
}

function normalizeMyphonerWinnerCategory(value = '') {
  const raw = normalizeLooseKey(value);
  if (!raw) return '';
  const onlineTokens = [
    'online',
    'digital',
    'remote',
    'zoom',
    'googlemeet',
    'meet',
    'teams',
    'telefon',
    'phone',
    'call',
    'videomote',
    'webmote',
    'onlinemote',
  ];
  if (onlineTokens.some((token) => raw.includes(token))) return 'online';
  const inPersonTokens = [
    'irl',
    'inperson',
    'inpersonmeeting',
    'physical',
    'fysisk',
    'office',
    'kontor',
    'visit',
    'besok',
    'facetoface',
    'personlig',
  ];
  if (inPersonTokens.some((token) => raw.includes(token))) return 'irl';
  return '';
}

function getUtcOffsetMinutesForTimeZone(timeZone = '', date = new Date()) {
  const zone = sanitizeText(timeZone);
  if (!zone) return 0;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'shortOffset',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const tzPart = sanitizeText(parts.find((part) => part.type === 'timeZoneName')?.value);
    const match = tzPart.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);
    if (!match) return 0;
    const sign = String(match[1] || '').startsWith('-') ? -1 : 1;
    const hours = Math.abs(Number(match[1]));
    const minutes = Number(match[2] || 0);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
    return sign * (hours * 60 + minutes);
  } catch {
    return 0;
  }
}

function buildIsoForLocalTimeInTimeZone({ year = 0, month = 0, day = 0, hour = 0, minute = 0 } = {}) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return '';
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '';
  const calendarCheck = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    !Number.isFinite(calendarCheck.getTime()) ||
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) {
    return '';
  }
  const utcGuessMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetMinutes = getUtcOffsetMinutesForTimeZone(SALES_MEETING_TIMEZONE, new Date(utcGuessMs));
  const adjusted = new Date(utcGuessMs - offsetMinutes * 60_000);
  if (!Number.isFinite(adjusted.getTime())) return '';
  return adjusted.toISOString();
}

function parseMyphonerMeetingAtFromFreeText(text = '', fallbackYear = 0) {
  const raw = String(text ?? '').replace(/\uFFFD/g, '').trim();
  if (!raw) return '';
  const pattern = /(?:^|[\s,;:-])(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?(?:\s+|[^\d]{0,12})(\d{1,2})[:.](\d{2})(?!\d)/gim;
  const inferredYear = Number(fallbackYear) > 1970 ? Number(fallbackYear) : new Date().getUTCFullYear();
  for (const match of raw.matchAll(pattern)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = Number(match[3] || 0);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(hour) || !Number.isFinite(minute)) continue;
    if (day < 1 || day > 31 || month < 1 || month > 12 || hour < 0 || hour > 23 || minute < 0 || minute > 59) continue;
    if (year > 0 && year < 100) year += 2000;
    if (!year) year = inferredYear;
    const iso = buildIsoForLocalTimeInTimeZone({ year, month, day, hour, minute });
    if (iso) return iso;
  }
  return '';
}

function getLeadDataMap(lead = {}) {
  const source = lead && typeof lead === 'object' ? lead : {};
  const leadData = source.lead_data && typeof source.lead_data === 'object' ? source.lead_data : {};
  const entries = Object.entries(leadData).map(([key, value]) => [
    normalizeLooseKey(key),
    sanitizeMyphonerFieldValue(value),
  ]);
  const map = new Map();
  for (const [key, value] of entries) {
    if (!key || !value) continue;
    if (!map.has(key)) map.set(key, value);
  }
  return map;
}

function pickLeadDataValue(leadDataMap, keys = []) {
  if (!(leadDataMap instanceof Map) || !Array.isArray(keys)) return '';
  const normalizedKeys = keys.map((key) => normalizeLooseKey(key)).filter(Boolean);
  for (const key of normalizedKeys) {
    const direct = sanitizeMyphonerFieldValue(leadDataMap.get(key));
    if (direct) return direct;
  }
  for (const [entryKey, value] of leadDataMap.entries()) {
    if (!value) continue;
    if (normalizedKeys.some((target) => entryKey.endsWith(target) || entryKey.includes(target))) {
      return sanitizeMyphonerFieldValue(value);
    }
  }
  return '';
}

function pickLeadDataValueStrict(leadDataMap, keys = []) {
  if (!(leadDataMap instanceof Map) || !Array.isArray(keys)) return '';
  const normalizedKeys = keys.map((key) => normalizeLooseKey(key)).filter(Boolean);
  for (const key of normalizedKeys) {
    const direct = sanitizeMyphonerFieldValue(leadDataMap.get(key));
    if (direct) return direct;
  }
  return '';
}

function pickFirstNonEmpty(values = []) {
  for (const value of values) {
    const next = sanitizeMyphonerFieldValue(value);
    if (next) return next;
  }
  return '';
}

function pickMyphonerWebsiteDomainValue(lead = {}, leadDataMap = new Map()) {
  const source = lead && typeof lead === 'object' ? lead : {};
  const map = leadDataMap instanceof Map ? leadDataMap : getLeadDataMap(source);
  return pickFirstNonEmpty([
    source.website_domain,
    source.websiteDomain,
    source.website,
    pickLeadDataValueStrict(map, [
      'website_domain',
      'website domain',
      'website',
      'nettside',
      'hjemmeside',
      'webside',
    ]),
  ]);
}

function parseMyphonerMeetingAt(lead = {}, leadDataMap = new Map()) {
  const source = lead && typeof lead === 'object' ? lead : {};
  const candidates = [
    source.scheduled_for,
    source.scheduledFor,
    source.scheduled_at,
    source.scheduledAt,
    pickLeadDataValue(leadDataMap, [
      'scheduled_for',
      'meeting_at',
      'meeting_time',
      'appointment_time',
      'motetid',
      'mote_tid',
      'meeting_datetime',
      'appointment_datetime',
      'meeting_date',
    ]),
  ];
  for (const candidate of candidates) {
    const iso = myphonerApi.parseMyPhonerDateToIso(candidate);
    if (iso) return iso;
  }
  const commentText = resolveLeadCommentText(source, leadDataMap, candidates);
  const freeTextIso = parseMyphonerMeetingAtFromFreeText(commentText, new Date().getUTCFullYear());
  if (freeTextIso) return freeTextIso;
  return '';
}

function inferMeetingModeFromMyphonerLead(lead = {}, leadDataMap = new Map(), meetingPlace = '', options = {}) {
  const source = lead && typeof lead === 'object' ? lead : {};
  const opts = options && typeof options === 'object' ? options : {};
  const explicitCategory = normalizeMyphonerWinnerCategory(
    pickFirstNonEmpty([
      opts.winnerCategory,
      source.category,
      source.last_event?.category,
      source.last_action_or_note?.category,
      pickLeadDataValue(leadDataMap, ['winner_category', 'meeting_category', 'appointment_category']),
    ])
  );
  if (explicitCategory === 'irl') return 'in-person';
  if (explicitCategory === 'online') return 'online';

  const explicitMode = pickLeadDataValue(leadDataMap, ['meeting_mode', 'mode', 'moteform', 'meetingtype', 'appointment_type']);
  const onlineHints = ['online', 'digital', 'remote', 'zoom', 'google meet', 'meet', 'teams', 'telefon', 'phone', 'call'];
  const inPersonHints = ['irl', 'in person', 'in-person', 'fysisk', 'physical', 'office', 'kontor', 'hos', 'besok', 'visit'];
  const normalizeText = (value = '') => sanitizeText(value).toLowerCase();
  const explicitText = normalizeText(explicitMode);
  if (onlineHints.some((token) => explicitText.includes(token))) return 'online';
  if (inPersonHints.some((token) => explicitText.includes(token))) return 'in-person';

  const corpus = normalizeText([
    source.state,
    source.status,
    source.category,
    source.last_event?.category,
    source.last_action_or_note?.category,
    source.outcome,
    source.primary_identifier,
    source.secondary_identifier,
    source.tertiary_identifier,
    meetingPlace,
    pickLeadDataValue(leadDataMap, ['winner_category']),
  ].join(' '));
  const hasOnline = onlineHints.some((token) => corpus.includes(token));
  const hasInPerson = inPersonHints.some((token) => corpus.includes(token));
  if (hasOnline && !hasInPerson) return 'online';
  if (hasInPerson && !hasOnline) return 'in-person';
  if (meetingPlace) return 'in-person';
  return 'online';
}

function collectUrlCandidatesFromLead(lead = {}, leadDataMap = new Map()) {
  const values = [
    pickLeadDataValue(leadDataMap, ['instagram', 'instagram_url', 'instagram_profile', 'instagram_link']),
    pickLeadDataValue(leadDataMap, ['facebook', 'facebook_url', 'facebook_profile', 'facebook_link']),
    pickLeadDataValue(leadDataMap, ['proff', 'proff_url', 'proff_link', 'proffno']),
    pickLeadDataValue(leadDataMap, [
      'google_business_profile',
      'google_business_url',
      'google_maps',
      'google_maps_url',
      'google_maps_link',
      'google_map_url',
      'maps_url',
      'gbp',
    ]),
    pickLeadDataValue(leadDataMap, ['website', 'url', 'homepage', 'nettside']),
  ];
  for (const value of leadDataMap.values()) {
    if (!value || typeof value !== 'string') continue;
    if (value.includes('http://') || value.includes('https://') || /\.[a-z]{2,}\b/i.test(value)) {
      values.push(...value.split(/\s+/));
    }
  }
  return values
    .map((entry) => sanitizeText(entry))
    .filter(Boolean);
}

function buildSalesDetailsFromMyphonerLead(lead = {}, leadDataMap = new Map()) {
  const classified = {
    instagram: '',
    facebook: '',
    proff: '',
    googleBusiness: '',
    others: [],
  };
  for (const candidate of collectUrlCandidatesFromLead(lead, leadDataMap)) {
    const { kind, url } = classifySalesLink(candidate);
    if (!url) continue;
    if (kind === 'instagram' && !classified.instagram) classified.instagram = url;
    else if (kind === 'facebook' && !classified.facebook) classified.facebook = url;
    else if (kind === 'proff' && !classified.proff) classified.proff = url;
    else if (kind === 'googleBusiness' && !classified.googleBusiness) classified.googleBusiness = url;
    else if (!classified.others.includes(url)) classified.others.push(url);
  }
  return normalizeSalesDetailLinks({
    instagramUrl: classified.instagram,
    facebookUrl: classified.facebook,
    proffUrl: classified.proff,
    googleBusinessProfile: classified.googleBusiness,
    otherLinks: classified.others.join('\n'),
  });
}

function normalizeSearchText(value = '') {
  return String(value || '')
    // Transliterate Norwegian letters instead of dropping them ("KVÆRNER" -> "kvaerner", not "kv rner").
    .replace(/[æÆ]/g, 'ae')
    .replace(/[øØ]/g, 'o')
    .replace(/[åÅ]/g, 'a')
    // kafe/cafe/café/kafé are interchangeable spellings ("Bydelskafe" vs "Bydelscafe").
    .replace(/caf(?=e|é)/gi, 'kaf')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pruneSalesSearchCache(nowMs = Date.now()) {
  for (const [key, cached] of salesSearchCache.entries()) {
    if (!cached || Number(cached.expiresAt || 0) <= nowMs) {
      salesSearchCache.delete(key);
    }
  }
  if (salesSearchCache.size > 200) {
    salesSearchCache.clear();
  }
}

function waitForMs(ms = 0) {
  const delay = Math.max(0, Math.trunc(Number(ms) || 0));
  if (!delay) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

async function searchSerpApi(queryText = '') {
  const query = sanitizeText(queryText);
  if (!query) return [];
  if (!SERPAPI_API_KEY) {
    if (!serpApiMissingKeyWarned) {
      serpApiMissingKeyWarned = true;
      console.warn('[sales] SERPAPI_API_KEY missing: social link enrichment search is disabled.');
    }
    return [];
  }

  const nowMs = Date.now();
  if (nowMs < serpApiBlockedUntilMs) {
    return [];
  }

  const cacheKey = `serpapi:${normalizeLooseKey(query)}`;
  pruneSalesSearchCache(nowMs);
  const cached = salesSearchCache.get(cacheKey);
  if (cached && Number(cached.expiresAt || 0) > nowMs && Array.isArray(cached.results)) {
    return cached.results;
  }

  const maxAttempts = Math.max(1, Math.trunc(Number(SERPAPI_RETRY_LIMIT) || 0));
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const now = Date.now();
    const minInterval = Math.max(0, Math.trunc(Number(SERPAPI_MIN_INTERVAL_MS) || 0));
    const waitMs = Math.max(0, minInterval - Math.max(0, now - serpApiLastRequestAt));
    if (waitMs > 0) await waitForMs(waitMs);
    serpApiLastRequestAt = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, SERPAPI_TIMEOUT_MS));
    const params = new URLSearchParams({
      engine: SERPAPI_ENGINE,
      q: query,
      api_key: SERPAPI_API_KEY,
      num: '20',
    });
    if (SERPAPI_HL) params.set('hl', SERPAPI_HL);
    if (SERPAPI_GL) params.set('gl', SERPAPI_GL);

    try {
      const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 429) {
          const nowWarn = Date.now();
          const blockWindowMs = Math.max(30_000, Math.trunc(Number(SERPAPI_RETRY_BACKOFF_MS) || 0) * 10);
          serpApiBlockedUntilMs = Math.max(serpApiBlockedUntilMs, nowWarn + blockWindowMs);
          if (nowWarn - serpApiRateLimitWarningAt > 60_000) {
            serpApiRateLimitWarningAt = nowWarn;
            console.warn(`[sales] SerpAPI throttled (429); temporarily bypassing SerpAPI for ${Math.round(blockWindowMs / 1000)}s.`);
          }
          return [];
        }
        if (response.status === 503 || response.status === 502 || response.status === 504) {
          const nowWarn = Date.now();
          if (nowWarn - serpApiRateLimitWarningAt > 60_000) {
            serpApiRateLimitWarningAt = nowWarn;
            console.warn(`[sales] SerpAPI temporary error (${response.status}); retrying with backoff.`);
          }
          if (attempt < maxAttempts) {
            const baseBackoff = Math.max(200, Math.trunc(Number(SERPAPI_RETRY_BACKOFF_MS) || 0));
            await waitForMs(baseBackoff * attempt);
            continue;
          }
        }
        return [];
      }
      const payload = await response.json().catch(() => ({}));
      const rawResults = Array.isArray(payload?.organic_results) ? payload.organic_results : [];
      const results = rawResults
        .map((entry) => ({
          url: coerceHttpUrl(entry?.link || entry?.redirect_link || ''),
          title: sanitizeText(entry?.title || ''),
          snippet: sanitizeText(entry?.snippet || entry?.snippet_highlighted_words?.join(' ') || ''),
        }))
        .filter((entry) => entry.url)
        .slice(0, 20);
      salesSearchCache.set(cacheKey, {
        expiresAt: nowMs + Math.max(60_000, MYPHONER_AUTO_LINK_SEARCH_CACHE_MS),
        results,
      });
      return results;
    } catch {
      if (attempt < maxAttempts) {
        const baseBackoff = Math.max(200, Math.trunc(Number(SERPAPI_RETRY_BACKOFF_MS) || 0));
        await waitForMs(baseBackoff * attempt);
        continue;
      }
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
  return [];
}

function decodeHtmlEntities(value = '') {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeExtractedSearchUrl(value = '') {
  const decoded = decodeHtmlEntities(value);
  const trimmed = sanitizeText(decoded).replace(/[)\],.;]+$/, '');
  return coerceHttpUrl(trimmed);
}

function isBraveSearchHost(url = '') {
  try {
    const parsed = new URL(url);
    const host = parsed.host.toLowerCase();
    return host.endsWith('search.brave.com') || host.endsWith('cdn.search.brave.com') || host.endsWith('imgs.search.brave.com');
  } catch {
    return false;
  }
}

async function searchBraveHtml(queryText = '') {
  const query = sanitizeText(queryText);
  if (!query || !SOCIAL_BRAVE_FALLBACK_ENABLED) return [];

  const cacheKey = `brave:${normalizeLooseKey(query)}`;
  const nowMs = Date.now();
  pruneSalesSearchCache(nowMs);
  const cached = salesSearchCache.get(cacheKey);
  if (cached && Number(cached.expiresAt || 0) > nowMs && Array.isArray(cached.results)) {
    return cached.results;
  }

  const waitMs = Math.max(0, Math.trunc(Number(SOCIAL_BRAVE_MIN_INTERVAL_MS) || 0) - Math.max(0, nowMs - braveSearchLastRequestAt));
  if (waitMs > 0) await waitForMs(waitMs);
  braveSearchLastRequestAt = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, SOCIAL_BRAVE_TIMEOUT_MS));
  try {
    const targetUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/html',
        'User-Agent': 'Mozilla/5.0 (compatible; AsoldiBot/1.0; +https://asoldi.com)',
      },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const html = await response.text().catch(() => '');
    if (!html) return [];

    const rawUrls = [
      ...html.matchAll(/https?:\/\/[^\s"'<>]+/g),
    ].map((match) => normalizeExtractedSearchUrl(match?.[0] || ''));

    const seen = new Set();
    const results = [];
    for (const url of rawUrls) {
      if (!url || seen.has(url) || isBraveSearchHost(url)) continue;
      seen.add(url);
      results.push({
        url,
        title: '',
        snippet: '',
      });
      if (results.length >= Math.max(20, Math.trunc(Number(SOCIAL_BRAVE_MAX_LINKS) || 0))) break;
    }
    salesSearchCache.set(cacheKey, {
      expiresAt: nowMs + Math.max(60_000, MYPHONER_AUTO_LINK_SEARCH_CACHE_MS),
      results,
    });
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function buildDirectProffLookupUrlFromOrganizationNumber(organizationNumber = '') {
  const orgnr = sanitizeText(organizationNumber).replace(/\D+/g, '');
  if (orgnr.length !== 9) return '';
  // Proff resolves the company from the orgnr segment even when slug segments are placeholders.
  return canonicalizeProffCompanyUrl(`https://www.proff.no/selskap/x/x/x/${encodeURIComponent(orgnr)}`);
}

async function searchProffInternalByOrganizationNumber(organizationNumber = '') {
  const directUrl = buildDirectProffLookupUrlFromOrganizationNumber(organizationNumber);
  return directUrl ? [directUrl] : [];
}

async function resolveProffCompanyUrlByOrganizationNumber({
  organizationNumber = '',
} = {}) {
  const orgnr = sanitizeText(organizationNumber).replace(/\D+/g, '');
  if (orgnr.length !== 9) {
    return {
      url: '',
      reason: 'missing-orgnr',
    };
  }

  const directCandidates = await searchProffInternalByOrganizationNumber(orgnr);
  if (directCandidates.length) {
    return {
      url: directCandidates[0],
      reason: 'proff-orgnr-direct',
    };
  }
  return {
    url: '',
    reason: 'orgnr-proff-search-empty',
    queryCount: 0,
    rawResultCount: 0,
    uniqueCandidateCount: 0,
    top: null,
    runnerUp: null,
  };
}

function buildBusinessSearchTokens(values = []) {
  const stopWords = new Set([
    'as', 'og', 'the', 'for', 'and', 'med', 'til', 'hos', 'butikk', 'norge',
    // Legal/structural words that rarely appear on social profiles.
    'holding', 'gruppen', 'group', 'invest', 'konsern', 'ans', 'enk',
  ]);
  const tokens = normalizeSearchText((Array.isArray(values) ? values : [values]).join(' '))
    .split(' ')
    .map((entry) => sanitizeText(entry))
    .filter((entry) => entry.length >= 3 && !stopWords.has(entry));
  return [...new Set(tokens)].slice(0, 10);
}

function haystackHasCityToken(haystack = '', cityToken = '') {
  const token = sanitizeText(cityToken);
  if (!token || !haystack) return false;
  // Word-boundary match: short city names like "Ler" must not match inside other words.
  return ` ${haystack} `.includes(` ${token} `);
}

function scoreSalesSearchCandidate(candidate = {}, context = {}) {
  const haystack = normalizeSearchText(
    `${sanitizeText(candidate.title)} ${sanitizeText(candidate.snippet)} ${sanitizeText(candidate.url)}`
  );
  if (!haystack) return 0;
  const businessTokens = Array.isArray(context.businessTokens) ? context.businessTokens : [];
  const cityToken = sanitizeText(context.cityToken);
  const organizationNumber = sanitizeText(context.organizationNumber);
  let score = 0;
  for (const token of businessTokens) {
    if (token && haystack.includes(token)) score += 2;
  }
  if (haystackHasCityToken(haystack, cityToken)) score += 2;
  if (organizationNumber && haystack.includes(organizationNumber)) score += 3;
  return score;
}

function canonicalizeInstagramProfileUrl(value = '') {
  const normalized = coerceHttpUrl(value);
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    const host = parsed.host.toLowerCase();
    if (!host.includes('instagram.com')) return '';
    const segments = parsed.pathname.split('/').map((entry) => sanitizeText(entry)).filter(Boolean);
    const firstSegment = sanitizeText(segments[0]).toLowerCase();
    const blocked = new Set([
      'p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'developer', 'legal', 'about',
      'popular', 'directory', 'web', 'tags',
    ]);
    if (!firstSegment || blocked.has(firstSegment)) return '';
    return `https://www.instagram.com/${segments[0]}/`;
  } catch {
    return '';
  }
}

function canonicalizeFacebookProfileUrl(value = '') {
  const normalized = coerceHttpUrl(value);
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    const host = parsed.host.toLowerCase();
    if (!(host.includes('facebook.com') || host.includes('fb.com') || host.includes('m.me'))) return '';
    if (host.includes('m.me')) return normalized;
    const segments = parsed.pathname.split('/').map((entry) => sanitizeText(entry)).filter(Boolean);
    if (!segments.length) return '';
    const firstSegment = sanitizeText(segments[0]).toLowerCase();
    if (firstSegment === 'profile.php') {
      const profileId = sanitizeText(parsed.searchParams.get('id'));
      if (!profileId) return '';
      return `https://www.facebook.com/profile.php?id=${encodeURIComponent(profileId)}`;
    }
    const blocked = new Set([
      'share', 'sharer', 'photos', 'photo', 'events', 'groups', 'watch', 'reel', 'reels', 'story.php', 'permalink.php',
      'marketplace', 'search', 'plugins', 'dialog', 'login',
    ]);
    if (blocked.has(firstSegment)) return '';
    if ((firstSegment === 'pages' || firstSegment === 'people') && segments[1]) {
      return `https://www.facebook.com/${segments[0]}/${segments[1]}/`;
    }
    // Modern page URLs: facebook.com/p/<Name>-<numericId>. Canonicalize to the numeric id
    // so all URL variants of the same page merge into one candidate.
    if (firstSegment === 'p') {
      if (!segments[1]) return '';
      const idMatch = sanitizeText(segments[1]).match(/-(\d{5,})$/);
      if (idMatch?.[1]) return `https://www.facebook.com/${idMatch[1]}/`;
      return `https://www.facebook.com/p/${segments[1]}/`;
    }
    return `https://www.facebook.com/${segments[0]}/`;
  } catch {
    return '';
  }
}

function getSearchContextBusinessTokens(context = {}) {
  return (Array.isArray(context.businessTokens) ? context.businessTokens : [])
    .map((entry) => normalizeSearchText(entry))
    .filter(Boolean);
}

function getCandidateSearchHaystack(candidate = {}) {
  return normalizeSearchText(
    `${sanitizeText(candidate.title)} ${sanitizeText(candidate.snippet)} ${sanitizeText(candidate.url)}`
  );
}

function collectMatchedBusinessTokens(haystack = '', businessTokens = []) {
  const matched = [];
  for (const token of Array.isArray(businessTokens) ? businessTokens : []) {
    if (!token || !haystack.includes(token)) continue;
    if (!matched.includes(token)) matched.push(token);
  }
  return matched;
}

function extractSocialProfileIdentifier(url = '') {
  const normalized = coerceHttpUrl(url);
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    const segments = parsed.pathname.split('/').map((entry) => sanitizeText(entry)).filter(Boolean);
    if (!segments.length) return '';
    const first = sanitizeText(segments[0]).toLowerCase();
    if (first === 'profile.php') return '';
    if ((first === 'pages' || first === 'people' || first === 'p') && segments[1]) {
      // Strip the trailing numeric page id from facebook.com/p/<Name>-<id> slugs.
      return normalizeSearchText(sanitizeText(segments[1]).replace(/-\d{5,}$/, '')).replace(/\s+/g, '');
    }
    return normalizeSearchText(segments[0]).replace(/\s+/g, '');
  } catch {
    return '';
  }
}

function normalizeSocialHandleSeed(value = '') {
  return String(value || '')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[øØ]/g, 'o')
    .replace(/[åÅ]/g, 'a')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function sanitizeSocialHandle(value = '') {
  return normalizeSocialHandleSeed(value)
    .replace(/[^a-z0-9._-]+/g, '')
    .replace(/^[_\-.]+|[_\-.]+$/g, '')
    .slice(0, 30);
}

function buildBusinessSocialHandleSeed(value = '') {
  const normalized = normalizeSocialHandleSeed(value)
    .replace(/\b(as|ans|da|enk|holding|restaurant|resturant|avd|kafe|cafe)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = normalized.split(' ').filter(Boolean);
  if (!parts.length) return '';
  return parts.slice(0, 3).join('').slice(0, 30);
}

function inferFallbackSocialLinks({
  businessName = '',
  instagramUrl = '',
  facebookUrl = '',
} = {}) {
  const currentInstagramHandle = sanitizeSocialHandle(extractSocialProfileIdentifier(instagramUrl));
  const currentFacebookHandle = sanitizeSocialHandle(extractSocialProfileIdentifier(facebookUrl));
  const businessHandle = sanitizeSocialHandle(buildBusinessSocialHandleSeed(businessName));

  const inferred = {
    instagramUrl: '',
    facebookUrl: '',
    sources: {
      instagram: '',
      facebook: '',
    },
  };

  // Only mirror an already-verified opposite-platform handle. Never invent from business name.
  if (!sanitizeText(instagramUrl) && currentFacebookHandle) {
    inferred.instagramUrl = `https://www.instagram.com/${currentFacebookHandle}/`;
    inferred.sources.instagram = 'from-facebook-handle';
  } else if (!sanitizeText(instagramUrl) && businessHandle && MYPHONER_SOCIAL_FORCE_FILL_ENABLED) {
    // Opt-in only: business-name slug fill is historically a major source of wrong links.
    inferred.instagramUrl = `https://www.instagram.com/${businessHandle}/`;
    inferred.sources.instagram = 'from-business-name';
  }

  if (!sanitizeText(facebookUrl) && currentInstagramHandle) {
    inferred.facebookUrl = `https://www.facebook.com/${currentInstagramHandle}/`;
    inferred.sources.facebook = 'from-instagram-handle';
  } else if (!sanitizeText(facebookUrl) && businessHandle && MYPHONER_SOCIAL_FORCE_FILL_ENABLED) {
    inferred.facebookUrl = `https://www.facebook.com/${businessHandle}/`;
    inferred.sources.facebook = 'from-business-name';
  }

  return inferred;
}

function compactSocialHandleCompare(value = '') {
  return sanitizeSocialHandle(value).replace(/[._-]+/g, '');
}

function isLikelyInventedSocialProfileUrl(url = '', businessName = '') {
  const handle = compactSocialHandleCompare(extractSocialProfileIdentifier(url));
  if (!handle || handle.length < 4) return false;
  const businessHandle = compactSocialHandleCompare(buildBusinessSocialHandleSeed(businessName));
  if (!businessHandle || businessHandle.length < 4) return false;
  if (handle === businessHandle) return true;
  // Near-identical slug (common force-fill pattern).
  if (handle.startsWith(businessHandle) || businessHandle.startsWith(handle)) {
    const longer = Math.max(handle.length, businessHandle.length);
    const shorter = Math.min(handle.length, businessHandle.length);
    return shorter / longer >= 0.85;
  }
  return false;
}

function shouldRevalidateSocialProfileUrl(url = '', provider = 'instagram', businessName = '') {
  const normalized = sanitizeText(url);
  if (!normalized) return true;
  const canonical =
    sanitizeText(provider).toLowerCase().includes('face')
      ? canonicalizeFacebookProfileUrl(normalized)
      : canonicalizeInstagramProfileUrl(normalized);
  if (!canonical) return true;
  return isLikelyInventedSocialProfileUrl(canonical, businessName);
}

function preferMyphonerSocialUrl(currentUrl = '', leadUrl = '', canonicalize = (value) => value) {
  const leadCanonical = sanitizeText(canonicalize(leadUrl || ''));
  if (leadCanonical) return leadCanonical;
  const currentCanonical = sanitizeText(canonicalize(currentUrl || ''));
  return currentCanonical || sanitizeText(currentUrl || '');
}


function buildCompactBusinessNameVariants(businessName = '') {
  // Norwegians transliterate æ as both "ae" and "e" in handles (Kværner -> kvaerner/kverner),
  // and å as both "a" and "aa". Generate compact variants covering the common spellings.
  const base = String(businessName || '');
  const spellings = [
    { ae: 'ae', o: 'o', a: 'a' },
    { ae: 'e', o: 'o', a: 'a' },
    { ae: 'ae', o: 'oe', a: 'aa' },
  ];
  const variants = new Set();
  for (const map of spellings) {
    const transliterated = base
      .replace(/[æÆ]/g, map.ae)
      .replace(/[øØ]/g, map.o)
      .replace(/[åÅ]/g, map.a)
      .replace(/caf(?=e|é)/gi, 'kaf')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    // Handles may keep or drop connector/legal words ("lisafrisoroghudpleie" keeps "og"),
    // so generate both spellings.
    const raw = transliterated.replace(/[^a-z0-9]+/g, '');
    const stripped = transliterated
      .replace(/\b(as|ans|da|enk|og|for|med)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, '');
    if (raw) variants.add(raw);
    if (stripped) variants.add(stripped);
  }
  return [...variants];
}

function isHandleSegmentPartOfBusiness(segment = '', { nameVariants = [], cityToken = '' } = {}) {
  const value = sanitizeText(segment);
  if (!value) return true;
  if (value === sanitizeText(cityToken)) return true;
  if (['norge', 'no', 'as', 'offisiell', 'official'].includes(value)) return true;
  return nameVariants.some((variant) => variant.includes(value));
}

function hasStrongSocialIdentifierMatch({ url = '', matchedTokens = [], context = {} } = {}) {
  const profileIdentifier = extractSocialProfileIdentifier(url);
  if (!profileIdentifier) return false;
  const compactHandle = profileIdentifier.replace(/[._-]+/g, '');
  if (compactHandle.length < 3) return false;
  const nameVariants = buildCompactBusinessNameVariants(context.businessName || '');
  const cityToken = normalizeSearchText(context.cityToken || '').replace(/\s+/g, '');

  // Full business name inside the handle, or handle is a >=5 char prefix-chunk of the name.
  for (const variant of nameVariants) {
    if (variant.length >= 5 && compactHandle.includes(variant)) return true;
    if (compactHandle.length >= 5 && variant.includes(compactHandle)) return true;
  }

  const tokens = (Array.isArray(matchedTokens) ? matchedTokens : [])
    .map((token) => normalizeSearchText(token).replace(/\s+/g, ''))
    .filter((token) => token.length >= 4);
  if (!tokens.length) return false;
  const matchedInHandle = tokens.filter((token) => compactHandle.includes(token));
  if (!matchedInHandle.length) return false;

  // Structural check: whatever surrounds the matched name-word in the handle must itself
  // belong to the business name or city. This accepts "sirkusbilvask" and "rosto.oslo" but
  // rejects "sirkusshopping", "songlagetvaarenbyneset" and "elena.olkhovska".
  for (const token of matchedInHandle) {
    const index = compactHandle.indexOf(token);
    if (index < 0) continue;
    const prefix = compactHandle.slice(0, index);
    const suffix = compactHandle.slice(index + token.length);
    const prefixOk = isHandleSegmentPartOfBusiness(prefix, { nameVariants, cityToken });
    const suffixOk = isHandleSegmentPartOfBusiness(suffix, { nameVariants, cityToken });
    if (prefixOk && suffixOk) return true;
  }
  return false;
}

function selectBestSearchCandidate(
  results = [],
  {
    context = {},
    normalizeUrl = () => '',
    minScore = 2,
    minConfidenceMargin = 0,
    minBusinessTokenMatches = 1,
    strictConfidence = false,
    requireIdentifierMatch = false,
  } = {}
) {
  const businessTokens = getSearchContextBusinessTokens(context);
  // Compare exact names without legal suffixes ("... AS") and with/without connector words,
  // since pages write "bakeri & pizza" as often as "bakeri og pizza".
  const simplifiedBusinessName = normalizeBusinessNameForSearchQuery(context.businessName || '');
  const exactNameVariants = [
    ...new Set([
      normalizeSearchText(simplifiedBusinessName),
      normalizeSearchText(simplifiedBusinessName.replace(/\b(og|for|med|and)\b/gi, ' ')),
    ]),
  ].filter(Boolean);
  const cityToken = sanitizeText(context.cityToken);
  const scored = (Array.isArray(results) ? results : [])
    .map((entry) => {
      const url = normalizeUrl(entry?.url || '');
      if (!url) return null;
      const haystack = getCandidateSearchHaystack(entry);
      const score = scoreSalesSearchCandidate(entry, context);
      const matchedTokens = collectMatchedBusinessTokens(haystack, businessTokens);
      const tokenMatches = matchedTokens.length;
      const exactBusinessNameMatch = exactNameVariants.some((variant) => haystack.includes(variant));
      const cityMatch = haystackHasCityToken(haystack, cityToken);
      const strongIdentifierMatch = hasStrongSocialIdentifierMatch({
        url,
        matchedTokens,
        context,
      });
      // Google's own ranking is a real relevance signal: reward top-2 placement.
      const position = Number.isFinite(Number(entry?.position)) ? Number(entry.position) : -1;
      const positionBonus = position === 0 ? 2 : position === 1 ? 1 : 0;
      // A vanity handle that does NOT match the business (e.g. a choir page mentioning the
      // cafe) is affirmative evidence against the candidate. Numeric ids stay neutral.
      const profileIdentifier = extractSocialProfileIdentifier(url);
      const handleMismatchPenalty =
        profileIdentifier && !/^\d+$/.test(profileIdentifier) && !strongIdentifierMatch ? 2 : 0;
      const confidencePoints =
        score +
        tokenMatches * 2 +
        (exactBusinessNameMatch ? 2 : 0) +
        (strongIdentifierMatch ? 2 : 0) +
        (cityMatch ? 1 : 0) +
        positionBonus -
        handleMismatchPenalty;
      return {
        url,
        score,
        confidencePoints,
        tokenMatches,
        exactBusinessNameMatch,
        strongIdentifierMatch,
        cityMatch,
        position,
        query: sanitizeText(entry?.query || ''),
      };
    })
    .filter(Boolean);
  // Multiple raw results (page + subpages) often canonicalize to the same profile URL;
  // merge them so a duplicate of the top candidate never counts as a competing runner-up.
  const byCanonicalUrl = new Map();
  for (const candidate of scored) {
    const existing = byCanonicalUrl.get(candidate.url);
    if (!existing || candidate.confidencePoints > existing.confidencePoints) {
      byCanonicalUrl.set(candidate.url, candidate);
    }
  }
  const ranked = [...byCanonicalUrl.values()].sort((a, b) => {
    if (b.confidencePoints !== a.confidencePoints) return b.confidencePoints - a.confidencePoints;
    if (b.score !== a.score) return b.score - a.score;
    return b.tokenMatches - a.tokenMatches;
  });
  if (!ranked.length) {
    return {
      url: '',
      reason: 'no-canonical-candidates',
      top: null,
      runnerUp: null,
      scoredCount: 0,
    };
  }
  const top = ranked[0];
  const runnerUp = ranked[1] || null;
  // Short names can't accumulate a high absolute score (+2 per matched name word),
  // so scale the requirement: 1-word names need 2, 2-word names need 4, capped at minScore.
  const effectiveMinScore = Math.min(
    Math.max(1, Number(minScore) || 1),
    Math.max(2, businessTokens.length * 2)
  );
  if (top.score < effectiveMinScore) {
    return {
      url: '',
      reason: 'score-below-min',
      top,
      runnerUp,
      scoredCount: ranked.length,
    };
  }

  if (strictConfidence) {
    const availableTokens = Math.max(1, businessTokens.length);
    const requiredTokenMatches = Math.max(1, Math.min(minBusinessTokenMatches, availableTokens));
    if (top.tokenMatches < requiredTokenMatches) {
      return {
        url: '',
        reason: 'insufficient-token-matches',
        top,
        runnerUp,
        scoredCount: ranked.length,
      };
    }
    // Instagram business profiles virtually always incorporate the business name in the
    // handle; exact-name mentions in bios/posts of other accounts are not enough there.
    if (requireIdentifierMatch && !top.strongIdentifierMatch) {
      return {
        url: '',
        reason: 'missing-handle-match',
        top,
        runnerUp,
        scoredCount: ranked.length,
      };
    }
    // Token quantity alone is not enough: generic words ("thai", "takeaway") pile up on
    // unrelated pages. Require the handle or the exact business name to match.
    if (!top.strongIdentifierMatch && !top.exactBusinessNameMatch) {
      return {
        url: '',
        reason: 'missing-identifier-signal',
        top,
        runnerUp,
        scoredCount: ranked.length,
      };
    }
    // When location is known, token-only matches need city corroboration.
    // Exact-name or matching-handle results pass without it.
    if (cityToken && !top.cityMatch && !top.strongIdentifierMatch && !top.exactBusinessNameMatch) {
      return {
        url: '',
        reason: 'missing-city-signal',
        top,
        runnerUp,
        scoredCount: ranked.length,
      };
    }
    if (runnerUp && top.confidencePoints - runnerUp.confidencePoints < Math.max(0, Number(minConfidenceMargin || 0))) {
      return {
        url: '',
        reason: 'ambiguous-top-candidates',
        top,
        runnerUp,
        scoredCount: ranked.length,
      };
    }
  } else if (runnerUp && top.score === runnerUp.score && top.score < effectiveMinScore + 2) {
    return {
      url: '',
      reason: 'ambiguous-low-confidence',
      top,
      runnerUp,
      scoredCount: ranked.length,
    };
  }
  return {
    url: top.url,
    reason: 'resolved',
    top,
    runnerUp,
    scoredCount: ranked.length,
  };
}

function selectBestSearchUrl(results = [], options = {}) {
  return selectBestSearchCandidate(results, options).url;
}

function extractOrganizationNumberFromLead(lead = {}, leadDataMap = new Map()) {
  const source = lead && typeof lead === 'object' ? lead : {};
  const candidates = [
    pickLeadDataValue(leadDataMap, [
      'organisasjonsnummer',
      'organization_number',
      'organisation_number',
      'orgnr',
      'org_nr',
      'org_number',
      'brreg_number',
    ]),
    source.organisasjonsnummer,
    source.organization_number,
    source.organizationNumber,
  ];
  for (const value of leadDataMap.values()) {
    if (typeof value === 'string' || typeof value === 'number') candidates.push(value);
  }
  for (const candidate of candidates) {
    const match = String(candidate || '').match(/\b(\d{3}\s?\d{3}\s?\d{3})\b/);
    if (!match?.[1]) continue;
    const digits = match[1].replace(/\D+/g, '');
    if (digits.length === 9) return digits;
  }
  return '';
}

function extractMyphonerLocationHint(lead = {}, leadDataMap = new Map()) {
  const source = lead && typeof lead === 'object' ? lead : {};
  return pickFirstNonEmpty([
    pickLeadDataValue(leadDataMap, [
      'city',
      'town',
      'post_place',
      'poststed',
      'municipality',
      'kommune',
      'location',
      'county',
    ]),
    pickLeadDataValue(leadDataMap, ['meeting_place', 'meeting_address', 'address', 'visiting_address']),
    source.secondary_identifier,
  ]);
}

function extractCityTokenFromLocationHint(locationHint = '') {
  const parts = normalizeSearchText(locationHint)
    .split(' ')
    .map((entry) => sanitizeText(entry))
    .filter(Boolean);
  if (!parts.length) return '';
  const streetLike =
    /^(?:.*(?:vegen|veien|gata|gaten|gate|vei|veg|street|road|alleen|alle|plass|plassen)|[a-z]+(?:vn|gt))$/;
  // Norwegian addresses are usually "... <postal> <city>" — prefer the token after postal code.
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (!/^\d{4}$/.test(parts[index])) continue;
    const candidate = parts[index + 1];
    if (candidate && candidate.length >= 3 && !/^\d+$/.test(candidate) && !streetLike.test(candidate)) {
      return candidate;
    }
  }
  // Otherwise take the last non-street, non-numeric token (city/post place).
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const candidate = parts[index];
    if (!candidate || candidate.length < 3 || /^\d+$/.test(candidate) || streetLike.test(candidate)) continue;
    return candidate;
  }
  return '';
}

function buildSalesLinkSearchContext(client = {}, lead = {}, leadDataMap = new Map()) {
  const source = lead && typeof lead === 'object' ? lead : {};
  const businessName = sanitizeText(
    client.businessName ||
      source.primary_identifier ||
      pickLeadDataValue(leadDataMap, ['company_name', 'business_name', 'name']) ||
      pickLeadDataValue(leadDataMap, ['organization_name', 'org_name'])
  );
  const locationHint = sanitizeText(extractMyphonerLocationHint(lead, leadDataMap));
  const cityToken = extractCityTokenFromLocationHint(locationHint);
  const organizationNumber = sanitizeText(extractOrganizationNumberFromLead(lead, leadDataMap));
  const businessTokens = buildBusinessSearchTokens([businessName]);
  return {
    businessName,
    locationHint,
    cityToken,
    organizationNumber,
    businessTokens,
  };
}

function normalizeBusinessNameForSearchQuery(value = '') {
  return sanitizeText(value)
    .replace(/\b(as|ans|da|enk|holding)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSocialSearchQueries({ provider = 'instagram', context = {} } = {}) {
  const socialProvider = sanitizeText(provider).toLowerCase().includes('face') ? 'facebook' : 'instagram';
  const siteDomain = socialProvider === 'facebook' ? 'facebook.com' : 'instagram.com';
  const businessName = sanitizeText(context?.businessName || '');
  const simplifiedBusinessName = normalizeBusinessNameForSearchQuery(businessName);
  if (!businessName && !simplifiedBusinessName) return [];
  const locationHint = sanitizeText(context?.locationHint || '');
  const cityToken = sanitizeText(context?.cityToken || '');
  const organizationNumber = sanitizeText(context?.organizationNumber || '').replace(/\D+/g, '');
  const fragments = [
    [businessName, socialProvider, cityToken || locationHint, 'Norge'],
    [`"${businessName}"`, `site:${siteDomain}`, cityToken],
    [simplifiedBusinessName, `site:${siteDomain}`, cityToken || 'Norge'],
    [simplifiedBusinessName, socialProvider, cityToken, organizationNumber],
  ];
  const querySet = new Set();
  for (const parts of fragments) {
    const query = parts
      .map((entry) => sanitizeText(entry))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!query || query.length < 4) continue;
    querySet.add(query);
  }
  return [...querySet].slice(0, 4);
}

async function lookupBrregEntityByOrganizationNumber(orgNumber = '') {
  const digits = sanitizeText(orgNumber).replace(/\D+/g, '');
  if (digits.length !== 9) return null;
  const candidates = await searchBrregBusinesses(digits).catch(() => []);
  const list = Array.isArray(candidates) ? candidates : [];
  return (
    list.find((entry) => sanitizeText(entry.organizationNumber).replace(/\D+/g, '') === digits) ||
    list[0] ||
    null
  );
}

async function resolveBestSearchCandidate({
  queries = [],
  context = {},
  normalizeUrl = () => '',
  minScore = 2,
  minConfidenceMargin = 0,
  minBusinessTokenMatches = 1,
  strictConfidence = false,
  requireIdentifierMatch = false,
} = {}) {
  const list = [...new Set((Array.isArray(queries) ? queries : [queries]).map((entry) => sanitizeText(entry)).filter(Boolean))];
  if (!list.length) {
    return {
      url: '',
      reason: 'no-query',
      queryCount: 0,
      rawResultCount: 0,
      uniqueCandidateCount: 0,
      top: null,
      runnerUp: null,
    };
  }

  // Pool results from ALL queries before selecting, so the correct profile competes even
  // when the first query surfaces a plausible-but-wrong candidate.
  let queryCount = 0;
  let rawResultCount = 0;
  const pooledByUrl = new Map();
  for (const query of list) {
    queryCount += 1;
    const serpResults = await searchSerpApi(query);
    let normalizedResults = Array.isArray(serpResults) ? serpResults : [];
    let provider = 'serpapi';
    if (!normalizedResults.length && SOCIAL_BRAVE_FALLBACK_ENABLED) {
      const braveResults = await searchBraveHtml(query);
      normalizedResults = Array.isArray(braveResults) ? braveResults : [];
      if (normalizedResults.length) provider = 'brave';
    }
    rawResultCount += normalizedResults.length;
    normalizedResults.forEach((entry, index) => {
      const key = coerceHttpUrl(entry?.url || '');
      if (!key) return;
      const existing = pooledByUrl.get(key);
      if (existing) {
        // Keep the best (lowest) ranking position seen across queries.
        if (index < Number(existing.position)) existing.position = index;
        return;
      }
      pooledByUrl.set(key, {
        ...entry,
        query,
        provider,
        url: key,
        position: index,
      });
    });
  }
  const pooledResults = [...pooledByUrl.values()];

  if (!pooledResults.length) {
    return {
      url: '',
      reason: 'no-search-results',
      queryCount,
      rawResultCount,
      uniqueCandidateCount: 0,
      top: null,
      runnerUp: null,
    };
  }

  const selected = selectBestSearchCandidate(pooledResults, {
    context,
    normalizeUrl,
    minScore,
    minConfidenceMargin,
    minBusinessTokenMatches,
    strictConfidence,
    requireIdentifierMatch,
  });
  return {
    url: sanitizeText(selected?.url || ''),
    reason: sanitizeText(selected?.reason || 'unknown'),
    queryCount,
    rawResultCount,
    uniqueCandidateCount: pooledResults.length,
    top: selected?.top || null,
    runnerUp: selected?.runnerUp || null,
  };
}

async function enrichSalesClientLinksFromMyphoner({
  clientId = '',
  lead = {},
  leadDataMap = new Map(),
  persist = true,
} = {}) {
  const targetClientId = sanitizeText(clientId);
  if (!targetClientId) {
    return {
      updated: false,
      wouldUpdate: false,
      changedFields: [],
      resolvedDetails: {},
      resolvedMeetingPlace: '',
      socialDiagnostics: {},
    };
  }
  const source = lead && typeof lead === 'object' ? lead : {};
  const hasLeadPayload = Object.keys(source).length > 0;
  const map = leadDataMap instanceof Map ? leadDataMap : getLeadDataMap(source);
  const currentClient = sales.getSalesClientById(targetClientId);
  if (!currentClient) {
    return {
      updated: false,
      wouldUpdate: false,
      changedFields: [],
      resolvedDetails: {},
      resolvedMeetingPlace: '',
      socialDiagnostics: {},
    };
  }

  const currentDetails = normalizeSalesDetailLinks(currentClient.details || {});
  const nextDetails = { ...currentDetails };
  const currentMeetingPlace = sanitizeText(currentClient.meetingPlace);
  const currentBusinessName = sanitizeText(currentClient.businessName);
  const currentWebsiteDomain = sanitizeSalesWebsiteDomain(currentClient.websiteDomain);
  const leadDetails = buildSalesDetailsFromMyphonerLead(source, map);
  const leadMeetingPlace = sanitizeText(extractMyphonerLeadMeetingPlace(source, map));
  const leadBusinessName = sanitizeText(extractMyphonerLeadBusinessName(source, map));
  const leadWebsiteDomain = extractDomainFromMyphonerValue(
    pickMyphonerWebsiteDomainValue(source, map)
  );
  const resolvedBusinessName = sanitizeText(leadBusinessName || currentBusinessName);
  const resolvedWebsiteDomain = hasLeadPayload
    ? sanitizeSalesWebsiteDomain(leadWebsiteDomain)
    : currentWebsiteDomain;
  const resolvedMeetingPlace = currentMeetingPlace || leadMeetingPlace;
  const socialDiagnostics = {};
  const socialBusinessNameHint = sanitizeText(resolvedBusinessName || currentBusinessName);

  // MyPhoner is the source of truth when it already has profile URLs.
  nextDetails.instagramUrl = preferMyphonerSocialUrl(
    nextDetails.instagramUrl,
    leadDetails.instagramUrl,
    canonicalizeInstagramProfileUrl
  );
  nextDetails.facebookUrl = preferMyphonerSocialUrl(
    nextDetails.facebookUrl,
    leadDetails.facebookUrl,
    canonicalizeFacebookProfileUrl
  );
  if (!nextDetails.googleBusinessProfile && leadDetails.googleBusinessProfile) {
    nextDetails.googleBusinessProfile = leadDetails.googleBusinessProfile;
  }

  let searchContext = buildSalesLinkSearchContext(currentClient, source, map);
  const orgNumber = sanitizeText(searchContext.organizationNumber).replace(/\D+/g, '');
  const fallbackClientOrgnr = extractOrganizationNumberFromClientRecord(currentClient);
  const strictProffOrgnr = sanitizeText(orgNumber || fallbackClientOrgnr).replace(/\D+/g, '');
  let resolvedOrgnr = strictProffOrgnr;
  const candidateBusinessName = sanitizeText(searchContext.businessName || currentClient.businessName);
  let brregEntity = null;
  if (!resolvedOrgnr && candidateBusinessName) {
    const brregCandidatesByName = await searchBrregBusinesses(candidateBusinessName).catch(() => []);
    const selectedByName = selectBrregCandidateByBusinessName(
      brregCandidatesByName,
      candidateBusinessName,
      searchContext.locationHint || resolvedMeetingPlace
    );
    if (sanitizeText(selectedByName?.organizationNumber)) {
      resolvedOrgnr = sanitizeText(selectedByName.organizationNumber);
      brregEntity = selectedByName;
    }
  }
  if (resolvedOrgnr && !sanitizeText(searchContext.organizationNumber)) {
    searchContext = {
      ...searchContext,
      organizationNumber: resolvedOrgnr,
    };
  }
  if (!brregEntity && resolvedOrgnr) {
    brregEntity = await lookupBrregEntityByOrganizationNumber(resolvedOrgnr);
  }
  const enrichedBusinessName = sanitizeText(brregEntity?.name);
  const enrichedLocationHint = sanitizeText(searchContext.locationHint || brregEntity?.address);
  if (enrichedBusinessName || enrichedLocationHint) {
    searchContext = {
      ...searchContext,
      locationHint: enrichedLocationHint || searchContext.locationHint,
      cityToken:
        searchContext.cityToken || extractCityTokenFromLocationHint(enrichedLocationHint),
      businessTokens: buildBusinessSearchTokens([
        searchContext.businessName,
        enrichedBusinessName,
      ]),
    };
  }
  const baseBusinessName = sanitizeText(searchContext.businessName || enrichedBusinessName || currentClient.businessName);
  const socialContext = {
    ...searchContext,
    businessName: baseBusinessName || searchContext.businessName,
  };

  // Proff is orgnr-first: MyPhoner has no proff link, but its orgnr builds a
  // deterministic proff.no/selskap/x/x/x/<orgnr> URL that Proff resolves itself.
  if (!nextDetails.proffUrl && leadDetails.proffUrl) nextDetails.proffUrl = leadDetails.proffUrl;

  let proffResolution = {
    url: sanitizeText(nextDetails.proffUrl),
    reason: sanitizeText(nextDetails.proffUrl) ? 'already-present' : 'not-attempted',
  };
  const existingProffOrgnr = extractProffOrganizationNumberFromUrl(nextDetails.proffUrl);
  const proffNeedsResolution = shouldResolveProffUrl(nextDetails.proffUrl) || Boolean(
    strictProffOrgnr &&
    sanitizeText(nextDetails.proffUrl) &&
    (!existingProffOrgnr || existingProffOrgnr !== strictProffOrgnr)
  );
  if (proffNeedsResolution && strictProffOrgnr) {
    proffResolution = await resolveProffCompanyUrlByOrganizationNumber({
      organizationNumber: strictProffOrgnr,
      context: socialContext,
    });
    if (sanitizeText(proffResolution.url)) {
      nextDetails.proffUrl = sanitizeText(proffResolution.url);
    } else if (sanitizeText(nextDetails.proffUrl)) {
      // Drop stale search/org-only placeholders so they remain eligible for repair.
      nextDetails.proffUrl = '';
    }
  } else if (proffNeedsResolution && !strictProffOrgnr) {
    proffResolution = {
      url: '',
      reason: 'missing-orgnr',
    };
  }
  socialDiagnostics.proff = proffResolution;

  const myphonerInstagramUrl = sanitizeText(canonicalizeInstagramProfileUrl(leadDetails.instagramUrl));
  const myphonerFacebookUrl = sanitizeText(canonicalizeFacebookProfileUrl(leadDetails.facebookUrl));
  // Never wipe MyPhoner-provided profiles; only re-check likely invented auto-fill URLs.
  const shouldSearchInstagram =
    !myphonerInstagramUrl &&
    shouldRevalidateSocialProfileUrl(nextDetails.instagramUrl, 'instagram', socialBusinessNameHint);
  const shouldSearchFacebook =
    !myphonerFacebookUrl &&
    shouldRevalidateSocialProfileUrl(nextDetails.facebookUrl, 'facebook', socialBusinessNameHint);
  if (shouldSearchInstagram && nextDetails.instagramUrl) {
    socialDiagnostics.instagramCleared = {
      previousUrl: sanitizeText(nextDetails.instagramUrl),
      reason: 'likely-invented-handle',
    };
    nextDetails.instagramUrl = '';
  }
  if (shouldSearchFacebook && nextDetails.facebookUrl) {
    socialDiagnostics.facebookCleared = {
      previousUrl: sanitizeText(nextDetails.facebookUrl),
      reason: 'likely-invented-handle',
    };
    nextDetails.facebookUrl = '';
  }

  let instagramResolution = {
    url: sanitizeText(nextDetails.instagramUrl),
    reason: sanitizeText(nextDetails.instagramUrl) ? 'already-present' : 'not-attempted',
    queryCount: 0,
    rawResultCount: 0,
    uniqueCandidateCount: 0,
    top: null,
    runnerUp: null,
  };
  if (!nextDetails.instagramUrl) {
    instagramResolution = await resolveBestSearchCandidate({
      queries: buildSocialSearchQueries({
        provider: 'instagram',
        context: socialContext,
      }),
      context: socialContext,
      normalizeUrl: canonicalizeInstagramProfileUrl,
      minScore: Math.max(2, MYPHONER_SOCIAL_CONFIDENCE_MIN_SCORE),
      minConfidenceMargin: Math.max(0, MYPHONER_SOCIAL_CONFIDENCE_MIN_MARGIN),
      minBusinessTokenMatches: Math.max(1, MYPHONER_SOCIAL_CONFIDENCE_MIN_TOKEN_MATCHES),
      strictConfidence: true,
      requireIdentifierMatch: true,
    });
    if (instagramResolution.url) nextDetails.instagramUrl = instagramResolution.url;
  } else if (sanitizeText(leadDetails.instagramUrl)) {
    instagramResolution.reason = 'myphoner-social-url';
  }
  socialDiagnostics.instagram = instagramResolution;

  let facebookResolution = {
    url: sanitizeText(nextDetails.facebookUrl),
    reason: sanitizeText(nextDetails.facebookUrl) ? 'already-present' : 'not-attempted',
    queryCount: 0,
    rawResultCount: 0,
    uniqueCandidateCount: 0,
    top: null,
    runnerUp: null,
  };
  if (!nextDetails.facebookUrl) {
    facebookResolution = await resolveBestSearchCandidate({
      queries: buildSocialSearchQueries({
        provider: 'facebook',
        context: socialContext,
      }),
      context: socialContext,
      normalizeUrl: canonicalizeFacebookProfileUrl,
      minScore: Math.max(2, MYPHONER_SOCIAL_CONFIDENCE_MIN_SCORE),
      minConfidenceMargin: Math.max(0, MYPHONER_SOCIAL_CONFIDENCE_MIN_MARGIN),
      minBusinessTokenMatches: Math.max(1, MYPHONER_SOCIAL_CONFIDENCE_MIN_TOKEN_MATCHES),
      strictConfidence: true,
    });
    if (facebookResolution.url) nextDetails.facebookUrl = facebookResolution.url;
  } else if (sanitizeText(leadDetails.facebookUrl)) {
    facebookResolution.reason = 'myphoner-social-url';
  }
  socialDiagnostics.facebook = facebookResolution;

  // Mirror a verified opposite-platform handle only. Business-name slug invention stays opt-in.
  if (!nextDetails.instagramUrl || !nextDetails.facebookUrl) {
    const fallbackSocial = inferFallbackSocialLinks({
      businessName: baseBusinessName || currentClient.businessName,
      instagramUrl: nextDetails.instagramUrl,
      facebookUrl: nextDetails.facebookUrl,
    });

    if (!nextDetails.instagramUrl && fallbackSocial.instagramUrl) {
      const allowFill =
        fallbackSocial.sources?.instagram === 'from-facebook-handle' || MYPHONER_SOCIAL_FORCE_FILL_ENABLED;
      if (allowFill) {
        nextDetails.instagramUrl = fallbackSocial.instagramUrl;
        socialDiagnostics.instagram = {
          ...(socialDiagnostics.instagram || {}),
          url: fallbackSocial.instagramUrl,
          reason:
            fallbackSocial.sources?.instagram === 'from-facebook-handle'
              ? 'mirror-facebook-handle'
              : 'force-fill-handle',
          forced: fallbackSocial.sources?.instagram !== 'from-facebook-handle',
          fallbackSource: sanitizeText(fallbackSocial.sources?.instagram),
        };
      }
    }

    if (!nextDetails.facebookUrl && fallbackSocial.facebookUrl) {
      const allowFill =
        fallbackSocial.sources?.facebook === 'from-instagram-handle' || MYPHONER_SOCIAL_FORCE_FILL_ENABLED;
      if (allowFill) {
        nextDetails.facebookUrl = fallbackSocial.facebookUrl;
        socialDiagnostics.facebook = {
          ...(socialDiagnostics.facebook || {}),
          url: fallbackSocial.facebookUrl,
          reason:
            fallbackSocial.sources?.facebook === 'from-instagram-handle'
              ? 'mirror-instagram-handle'
              : 'force-fill-handle',
          forced: fallbackSocial.sources?.facebook !== 'from-instagram-handle',
          fallbackSource: sanitizeText(fallbackSocial.sources?.facebook),
        };
      }
    }
  }

  const normalizedNext = normalizeSalesDetailLinks(nextDetails, currentDetails);
  const changedFields = ['instagramUrl', 'facebookUrl', 'proffUrl', 'googleBusinessProfile'].filter((field) => {
    const previous = sanitizeText(currentDetails[field]);
    const nextValue = sanitizeText(normalizedNext[field]);
    if (nextValue && nextValue !== previous) return true;
    if (field === 'proffUrl' && previous && !nextValue && shouldResolveProffUrl(previous)) return true;
    // Persist clearing of invented/wrong social auto-fill links.
    if (
      (field === 'instagramUrl' || field === 'facebookUrl') &&
      previous &&
      !nextValue &&
      isLikelyInventedSocialProfileUrl(previous, socialBusinessNameHint)
    ) {
      return true;
    }
    return false;
  });
  if (!currentMeetingPlace && leadMeetingPlace) changedFields.push('meetingPlace');
  if (resolvedBusinessName && normalizeLooseKey(resolvedBusinessName) !== normalizeLooseKey(currentBusinessName)) {
    changedFields.push('businessName');
  }
  if (resolvedWebsiteDomain !== currentWebsiteDomain) changedFields.push('websiteDomain');
  if (!changedFields.length) {
    return {
      updated: false,
      wouldUpdate: false,
      changedFields: [],
      resolvedDetails: currentDetails,
      resolvedMeetingPlace: currentMeetingPlace,
      resolvedBusinessName: currentBusinessName,
      resolvedWebsiteDomain: currentWebsiteDomain,
      socialDiagnostics,
    };
  }

  if (!persist) {
    return {
      updated: false,
      wouldUpdate: true,
      changedFields,
      clientId: targetClientId,
      resolvedDetails: normalizedNext,
      resolvedMeetingPlace,
      resolvedBusinessName,
      resolvedWebsiteDomain,
      socialDiagnostics,
    };
  }

  const updatePayload = {
    details: normalizedNext,
  };
  if (!currentMeetingPlace && leadMeetingPlace) {
    updatePayload.meetingPlace = leadMeetingPlace;
  }
  if (resolvedBusinessName && normalizeLooseKey(resolvedBusinessName) !== normalizeLooseKey(currentBusinessName)) {
    updatePayload.businessName = resolvedBusinessName;
  }
  if (resolvedWebsiteDomain !== currentWebsiteDomain) {
    updatePayload.websiteDomain = resolvedWebsiteDomain;
  }
  const updated = sales.updateSalesClient(targetClientId, updatePayload);
  return {
    updated: Boolean(updated),
    wouldUpdate: Boolean(updated),
    changedFields,
    clientId: targetClientId,
    resolvedDetails: normalizedNext,
    resolvedMeetingPlace: sanitizeText(updated?.meetingPlace || resolvedMeetingPlace),
    resolvedBusinessName: sanitizeText(updated?.businessName || resolvedBusinessName),
    resolvedWebsiteDomain: sanitizeText(updated?.websiteDomain || resolvedWebsiteDomain),
    socialDiagnostics,
  };
}

function scheduleSalesClientLinkEnrichment({
  clientId = '',
  lead = {},
  leadDataMap = new Map(),
} = {}) {
  if (!MYPHONER_AUTO_LINK_ENRICH_ENABLED) return;
  const targetClientId = sanitizeText(clientId);
  if (!targetClientId || pendingSalesLinkEnrichment.has(targetClientId)) return;
  pendingSalesLinkEnrichment.add(targetClientId);
  setTimeout(async () => {
    try {
      const result = await enrichSalesClientLinksFromMyphoner({
        clientId: targetClientId,
        lead,
        leadDataMap,
      });
      if (result?.updated && Array.isArray(result.changedFields) && result.changedFields.length) {
        console.log(
          `[sales] auto-enriched links for ${targetClientId}: ${result.changedFields.join(', ')}`
        );
      }
    } catch (error) {
      console.warn(
        `[sales] auto-enrich links failed for ${targetClientId}:`,
        sanitizeText(error?.message) || error
      );
    } finally {
      pendingSalesLinkEnrichment.delete(targetClientId);
    }
  }, 0);
}

function collectMissingSalesLinkFields(details = {}, businessName = '') {
  const normalized = normalizeSalesDetailLinks(details || {});
  const missing = [];
  if (!sanitizeText(normalized.googleBusinessProfile)) missing.push('googleBusinessProfile');
  if (shouldResolveProffUrl(normalized.proffUrl)) missing.push('proffUrl');
  if (
    !sanitizeText(normalized.instagramUrl) ||
    isLikelyInventedSocialProfileUrl(normalized.instagramUrl, businessName)
  ) {
    missing.push('instagramUrl');
  }
  if (
    !sanitizeText(normalized.facebookUrl) ||
    isLikelyInventedSocialProfileUrl(normalized.facebookUrl, businessName)
  ) {
    missing.push('facebookUrl');
  }
  return missing;
}

function collectMissingSalesBackfillFields(client = {}) {
  const source = client && typeof client === 'object' ? client : {};
  const missing = collectMissingSalesLinkFields(source?.details || {}, source?.businessName || '');
  if (!sanitizeText(source?.meetingPlace)) missing.push('meetingPlace');
  return missing;
}

function normalizeMyphonerLeadId(value = '') {
  return sanitizeText(value).replace(/[^\d]/g, '');
}

function extractMyphonerLeadIdsFromText(value = '') {
  const raw = String(value || '');
  if (!raw) return [];
  const ids = [];
  for (const match of raw.matchAll(/\/(?:api\/v2\/)?leads\/(\d+)/gi)) {
    if (match?.[1]) ids.push(normalizeMyphonerLeadId(match[1]));
  }
  for (const match of raw.matchAll(/\blead(?:\s*id)?\s*[:#-]?\s*(\d{6,})\b/gi)) {
    if (match?.[1]) ids.push(normalizeMyphonerLeadId(match[1]));
  }
  return [...new Set(ids.filter(Boolean))];
}

function collectMyphonerLeadIdsFromClient(client = {}) {
  const source = client && typeof client === 'object' ? client : {};
  const leadIds = [
    normalizeMyphonerLeadId(source?.myphoner?.leadId),
    ...(Array.isArray(source?.myphoner?.leadIds) ? source.myphoner.leadIds.map((entry) => normalizeMyphonerLeadId(entry)) : []),
  ]
    .filter(Boolean);

  const leadResourcePath = myphonerApi.parseMyPhonerResourcePath(
    sanitizeText(source?.myphoner?.leadResourceUrl),
    myphonerApi.getMyPhonerConfig()
  );
  if (leadResourcePath) {
    leadIds.push(
      normalizeMyphonerLeadId(myphonerApi.extractMyPhonerIdFromResource(leadResourcePath, 'leads'))
    );
  }

  const freeTextCandidates = [
    source?.details?.otherLinks,
    source?.businessName,
    source?.contactPerson,
    source?.myphoner?.winnerComment,
  ];
  for (const candidate of freeTextCandidates) {
    for (const extracted of extractMyphonerLeadIdsFromText(candidate)) {
      leadIds.push(extracted);
    }
  }
  return [...new Set(leadIds)];
}

function extractOrganizationNumberFromText(value = '') {
  const raw = String(value || '');
  if (!raw) return '';
  const match = raw.match(/\b(\d{3}\s?\d{3}\s?\d{3})\b/);
  if (!match?.[1]) return '';
  const digits = match[1].replace(/\D+/g, '');
  return digits.length === 9 ? digits : '';
}

function extractOrganizationNumberFromClientRecord(client = {}) {
  const source = client && typeof client === 'object' ? client : {};
  const proffUrl = coerceHttpUrl(source?.details?.proffUrl || '');
  if (proffUrl) {
    try {
      const parsed = new URL(proffUrl);
      const qDigits = extractOrganizationNumberFromText(parsed.searchParams.get('q') || '');
      if (qDigits) return qDigits;
      const pathDigits = extractOrganizationNumberFromText(parsed.pathname);
      if (pathDigits) return pathDigits;
    } catch {
      // Ignore malformed proff URLs and continue with other candidates.
    }
  }
  const candidates = [
    source?.myphoner?.winnerComment,
    source?.businessName,
    source?.contactPerson,
  ];
  for (const candidate of candidates) {
    const digits = extractOrganizationNumberFromText(candidate);
    if (digits) return digits;
  }
  return '';
}

function extractGoogleBusinessRawValueFromLeadData(leadDataMap = new Map()) {
  return pickLeadDataValue(leadDataMap, [
    'google_business_profile',
    'google_business_url',
    'google_maps',
    'google_maps_url',
    'google_maps_link',
    'google_map_url',
    'maps_url',
    'gbp',
  ]);
}

function extractMyphonerLeadBusinessName(lead = {}, leadDataMap = new Map()) {
  const source = lead && typeof lead === 'object' ? lead : {};
  return pickFirstNonEmpty([
    source.primary_identifier,
    pickLeadDataValue(leadDataMap, ['company_name', 'business_name', 'company', 'firma', 'foretak', 'brreg_name', 'name']),
    pickLeadDataValue(leadDataMap, ['organization_name', 'org_name']),
  ]);
}

function extractMyphonerLeadContactName(lead = {}, leadDataMap = new Map()) {
  const source = lead && typeof lead === 'object' ? lead : {};
  return pickFirstNonEmpty([
    pickLeadDataValue(leadDataMap, ['contact_person', 'kontaktperson', 'full_name', 'fullname', 'contact_name', 'name']),
    source.secondary_identifier,
  ]);
}

function extractMyphonerLeadMeetingPlace(lead = {}, leadDataMap = new Map()) {
  const source = lead && typeof lead === 'object' ? lead : {};
  const map = leadDataMap instanceof Map ? leadDataMap : getLeadDataMap(source);
  return pickFirstNonEmpty([
    pickLeadDataValue(map, [
      'meeting_place',
      'meeting_address',
      'address',
      'visiting_address',
      'besoksadresse',
      'moteadresse',
      'forretningsadresse',
      'street_address',
      'street',
    ]),
    pickLeadDataValue(map, ['city', 'town', 'post_place', 'poststed', 'municipality', 'kommune']),
  ]);
}

function addLeadCatalogEntry(map, key, entry) {
  const normalizedKey = sanitizeText(key);
  if (!normalizedKey) return;
  const target = map.get(normalizedKey) || [];
  const existing = target.find((candidate) => sanitizeText(candidate?.leadId) === sanitizeText(entry?.leadId));
  if (!existing) target.push(entry);
  map.set(normalizedKey, target);
}

async function buildMyphonerLeadCatalog() {
  const emptyCatalog = {
    byOrgnr: new Map(),
    byBusinessPhone: new Map(),
    byBusiness: new Map(),
    leadById: new Map(),
    listCount: 0,
    leadCount: 0,
    errors: [],
  };
  if (!myphonerApi.isMyPhonerConfigured()) {
    return {
      ...emptyCatalog,
      errors: ['myphoner-not-configured'],
    };
  }

  const listsResponse = await myphonerApi.listMyPhonerLists();
  if (!listsResponse?.success) {
    return {
      ...emptyCatalog,
      errors: [sanitizeText(listsResponse?.error) || 'list-fetch-failed'],
    };
  }

  const lists = Array.isArray(listsResponse?.data) ? listsResponse.data : [];
  const byOrgnr = new Map();
  const byBusinessPhone = new Map();
  const byBusiness = new Map();
  const leadById = new Map();
  const errors = [];

  for (const list of lists) {
    const listId = sanitizeText(list?.id);
    if (!listId) continue;
    const listName = sanitizeText(list?.name);
    let previousPageLeadSignature = '';
    for (let page = 1; page <= MYPHONER_LEAD_CATALOG_MAX_PAGES; page += 1) {
      const pageSize = 100;
      const leadsResponse = await myphonerApi.listMyPhonerLeadsInList(listId, {
        page,
        per_page: pageSize,
      });
      if (!leadsResponse?.success) {
        errors.push(`list:${listId}:page:${page}:${sanitizeText(leadsResponse?.error) || 'lead-list-fetch-failed'}`);
        break;
      }
      const leads = Array.isArray(leadsResponse?.data) ? leadsResponse.data : [];
      if (!leads.length) break;
      const pageLeadSignature = leads
        .map((lead) => sanitizeText(lead?.id || lead?.lead_id || lead?.leadId))
        .filter(Boolean)
        .join(',');
      if (pageLeadSignature && pageLeadSignature === previousPageLeadSignature) break;
      previousPageLeadSignature = pageLeadSignature;
      for (const lead of leads) {
        const leadId = sanitizeText(lead?.id || lead?.lead_id || lead?.leadId);
        if (!leadId || leadById.has(leadId)) continue;
        const leadDataMap = getLeadDataMap(lead);
        const businessName = extractMyphonerLeadBusinessName(lead, leadDataMap);
        const businessKey = normalizeBusinessNameForMatch(businessName);
        const contactPerson = extractMyphonerLeadContactName(lead, leadDataMap);
        const contactKey = normalizeBusinessNameForMatch(contactPerson);
        const commentText = resolveLeadCommentText(lead, leadDataMap);
        const phone = pickMyphonerLeadPhone(lead, leadDataMap, commentText);
        const phoneDigits = normalizePhoneDigits(phone);
        const organizationNumber = extractOrganizationNumberFromLead(lead, leadDataMap);
        const meetingPlace = sanitizeText(extractMyphonerLeadMeetingPlace(lead, leadDataMap));
        const leadResourceUrl = sanitizeText(
          lead?.location || lead?.resource_url || `/api/v2/leads/${encodeURIComponent(leadId)}`
        );
        const entry = {
          leadId,
          leadResourceUrl,
          listId,
          listName,
          businessName: sanitizeText(businessName),
          businessKey,
          contactPerson: sanitizeText(contactPerson),
          contactKey,
          phoneDigits,
          organizationNumber,
          meetingPlace,
        };
        leadById.set(leadId, entry);
        if (organizationNumber) addLeadCatalogEntry(byOrgnr, organizationNumber, entry);
        if (businessKey) addLeadCatalogEntry(byBusiness, businessKey, entry);
        if (businessKey && phoneDigits) addLeadCatalogEntry(byBusinessPhone, `${businessKey}:${phoneDigits}`, entry);
      }
      if (leads.length < pageSize) break;
    }
  }

  return {
    byOrgnr,
    byBusinessPhone,
    byBusiness,
    leadById,
    listCount: lists.length,
    leadCount: leadById.size,
    errors,
  };
}

async function attemptRelinkSalesClientLead({
  client = {},
  dryRun = false,
  leadCatalog = null,
} = {}) {
  const source = client && typeof client === 'object' ? client : {};
  if (!source?.id) return { relinked: false, wouldRelink: false, reason: 'invalid-client' };
  const existingLeadIds = collectMyphonerLeadIdsFromClient(source);
  if (existingLeadIds.length || sanitizeText(source?.myphoner?.leadResourceUrl)) {
    return { relinked: false, wouldRelink: false, reason: 'already-linked' };
  }
  const catalog = leadCatalog && typeof leadCatalog === 'object' ? leadCatalog : null;
  if (!catalog) return { relinked: false, wouldRelink: false, reason: 'catalog-missing' };
  if (!Number(catalog.leadCount || 0)) {
    return { relinked: false, wouldRelink: false, reason: 'lead-catalog-empty' };
  }

  const orgnr = extractOrganizationNumberFromClientRecord(source);
  const businessKey = normalizeBusinessNameForMatch(source?.businessName);
  const phoneDigits = normalizePhoneDigits(source?.contactPhone);
  const contactKey = normalizeBusinessNameForMatch(source?.contactPerson);
  const sortCandidatesByLeadId = (list = []) =>
    [...list].sort((a, b) => Number(sanitizeText(b?.leadId || 0)) - Number(sanitizeText(a?.leadId || 0)));
  const filterCandidatesByContact = (list = []) => {
    if (!contactKey) return [];
    return list.filter((entry) => {
      const candidateContactKey = normalizeBusinessNameForMatch(entry?.contactKey || entry?.contactPerson || '');
      if (!candidateContactKey) return false;
      return (
        candidateContactKey === contactKey ||
        candidateContactKey.includes(contactKey) ||
        contactKey.includes(candidateContactKey)
      );
    });
  };
  const filterCandidatesByPhone = (list = []) => {
    if (!phoneDigits) return [];
    return list.filter((entry) => {
      const candidateDigits = normalizePhoneDigits(entry?.phoneDigits);
      if (!candidateDigits) return false;
      return (
        candidateDigits === phoneDigits ||
        candidateDigits.endsWith(phoneDigits) ||
        phoneDigits.endsWith(candidateDigits)
      );
    });
  };
  const pickDeterministicCandidate = (list = []) => {
    const candidates = Array.isArray(list) ? list.filter(Boolean) : [];
    if (!candidates.length || candidates.length > 5) return null;
    const businessValues = new Set(candidates.map((entry) => sanitizeText(entry?.businessKey)).filter(Boolean));
    const orgValues = new Set(candidates.map((entry) => sanitizeText(entry?.organizationNumber)).filter(Boolean));
    const phoneValues = new Set(candidates.map((entry) => sanitizeText(entry?.phoneDigits)).filter(Boolean));
    if (businessValues.size > 1) return null;
    if (orgValues.size > 1) return null;
    if (phoneValues.size > 1 && !phoneDigits) return null;
    return sortCandidatesByLeadId(candidates)[0] || null;
  };
  let candidate = null;
  let method = '';
  if (orgnr) {
    const orgMatches = catalog.byOrgnr.get(orgnr) || [];
    if (orgMatches.length === 1) {
      candidate = orgMatches[0];
      method = 'orgnr';
    } else if (orgMatches.length > 1) {
      const contactMatches = filterCandidatesByContact(orgMatches);
      if (contactMatches.length === 1) {
        candidate = contactMatches[0];
        method = 'orgnr-contact';
      } else {
        const deterministic = pickDeterministicCandidate(contactMatches.length ? contactMatches : orgMatches);
        if (deterministic) {
          candidate = deterministic;
          method = 'orgnr-duplicate';
        }
      }
    }
  }

  if (!candidate && businessKey && phoneDigits) {
    const key = `${businessKey}:${phoneDigits}`;
    const matches = catalog.byBusinessPhone.get(key) || [];
    if (matches.length === 1) {
      candidate = matches[0];
      method = 'business-phone';
    } else if (matches.length > 1) {
      const contactMatches = filterCandidatesByContact(matches);
      if (contactMatches.length === 1) {
        candidate = contactMatches[0];
        method = 'business-phone-contact';
      } else {
        const deterministic = pickDeterministicCandidate(contactMatches.length ? contactMatches : matches);
        if (deterministic) {
          candidate = deterministic;
          method = 'business-phone-duplicate';
        }
      }
    }
  }

  if (!candidate && businessKey) {
    const businessMatches = catalog.byBusiness.get(businessKey) || [];
    if (businessMatches.length === 1) {
      candidate = businessMatches[0];
      method = 'business';
    } else if (businessMatches.length > 1) {
      const contactMatches = filterCandidatesByContact(businessMatches);
      if (contactMatches.length === 1) {
        candidate = contactMatches[0];
        method = 'business-contact';
      } else {
        const phoneMatches = filterCandidatesByPhone(contactMatches.length ? contactMatches : businessMatches);
        if (phoneMatches.length === 1) {
          candidate = phoneMatches[0];
          method = 'business-phone-fallback';
        } else {
          const deterministic = pickDeterministicCandidate(
            phoneMatches.length ? phoneMatches : contactMatches.length ? contactMatches : businessMatches
          );
          if (deterministic) {
            candidate = deterministic;
            method = 'business-duplicate';
          }
        }
      }
    }
  }

  if (!candidate) {
    return {
      relinked: false,
      wouldRelink: false,
      reason: orgnr ? 'lead-link-ambiguous' : 'missing-lead-link',
    };
  }

  if (dryRun) {
    return {
      relinked: false,
      wouldRelink: true,
      reason: 'would-relink',
      method,
      candidate,
      client: source,
    };
  }

  const nextLeadIds = [...new Set([candidate.leadId, ...existingLeadIds].filter(Boolean))];
  const updated = sales.updateSalesClient(source.id, {
    myphoner: {
      ...(source.myphoner || {}),
      leadId: candidate.leadId,
      leadIds: nextLeadIds,
      listId: sanitizeText(source?.myphoner?.listId) || sanitizeText(candidate.listId),
      listName: sanitizeText(source?.myphoner?.listName) || sanitizeText(candidate.listName),
      leadResourceUrl: sanitizeText(source?.myphoner?.leadResourceUrl) || sanitizeText(candidate.leadResourceUrl),
      latestEventAt: nowIso(),
    },
  });

  return {
    relinked: Boolean(updated),
    wouldRelink: Boolean(updated),
    reason: updated ? 'relinked' : 'relink-failed',
    method,
    candidate,
    client: updated || source,
  };
}

function computeSalesLinksCoverage(clients = []) {
  const list = Array.isArray(clients) ? clients : [];
  const fields = ['googleBusinessProfile', 'proffUrl', 'instagramUrl', 'facebookUrl'];
  const fieldPresence = Object.fromEntries(fields.map((field) => [field, 0]));
  let withAll4 = 0;
  let withAny = 0;
  let withNone = 0;
  for (const client of list) {
    const details = normalizeSalesDetailLinks(client?.details || {});
    let presentCount = 0;
    for (const field of fields) {
      if (sanitizeText(details[field])) {
        fieldPresence[field] += 1;
        presentCount += 1;
      }
    }
    if (presentCount === fields.length) withAll4 += 1;
    if (presentCount > 0) withAny += 1;
    if (presentCount === 0) withNone += 1;
  }
  return {
    totalClients: list.length,
    withAll4,
    withAny,
    withNone,
    fieldPresence,
  };
}

async function fetchMyphonerLeadForSalesClient(client = {}) {
  if (!myphonerApi.isMyPhonerConfigured()) {
    return { lead: null, source: '', error: 'myphoner-not-configured' };
  }
  const source = client && typeof client === 'object' ? client : {};
  const leadIds = collectMyphonerLeadIdsFromClient(source);
  let lastError = '';
  const normalizeLeadFetchError = (response = {}) => {
    const status = Number(response?.status || 0);
    const raw = sanitizeText(response?.error || '');
    if (status === 429) return 'myphoner-rate-limited';
    if (/throttl|too many requests|429/i.test(raw)) return 'myphoner-rate-limited';
    return raw || '';
  };
  for (const leadId of leadIds) {
    const response = await myphonerApi.fetchMyPhonerLeadById(leadId);
    if (response?.success && response?.data && typeof response.data === 'object') {
      return { lead: response.data, source: `lead-id:${leadId}`, error: '' };
    }
    const nextError = normalizeLeadFetchError(response);
    if (nextError) lastError = nextError;
    if (nextError === 'myphoner-rate-limited') {
      return { lead: null, source: '', error: 'myphoner-rate-limited' };
    }
  }
  const leadResourceUrl = sanitizeText(source?.myphoner?.leadResourceUrl);
  if (leadResourceUrl) {
    const response = await myphonerApi.fetchMyPhonerLeadByResource(leadResourceUrl);
    if (response?.success && response?.data && typeof response.data === 'object') {
      return { lead: response.data, source: 'lead-resource', error: '' };
    }
    const nextError = normalizeLeadFetchError(response);
    if (nextError) lastError = nextError;
    if (nextError === 'myphoner-rate-limited') {
      return { lead: null, source: '', error: 'myphoner-rate-limited' };
    }
  }
  return { lead: null, source: '', error: lastError || 'lead-not-found' };
}

async function backfillSalesWebsiteAndBusinessFields({
  clients = [],
  dryRun = false,
  limit = 0,
} = {}) {
  const sourceClients = Array.isArray(clients) ? clients : [];
  const parsedLimit = Number(limit);
  const maxClients = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.max(1, Math.trunc(parsedLimit)) : 0;
  const selectedClients = maxClients ? sourceClients.slice(0, maxClients) : sourceClients;
  const summary = {
    selectedClients: selectedClients.length,
    processedClients: 0,
    updatedClients: 0,
    wouldUpdateClients: 0,
    unchangedClients: 0,
    unresolvedClients: 0,
    reasonCounts: {},
  };
  const changed = [];
  const unresolved = [];

  const registerReason = (reason = '') => {
    const key = sanitizeText(reason);
    if (!key) return;
    summary.reasonCounts[key] = Number(summary.reasonCounts[key] || 0) + 1;
  };

  for (const client of selectedClients) {
    const clientId = sanitizeText(client?.id);
    if (!clientId) continue;
    summary.processedClients += 1;
    const currentWebsiteDomain = sanitizeText(client?.websiteDomain);
    const sanitizedWebsiteDomain = sanitizeSalesWebsiteDomain(currentWebsiteDomain);
    const patch = {};
    const reasons = [];

    if (currentWebsiteDomain !== sanitizedWebsiteDomain) {
      patch.websiteDomain = sanitizedWebsiteDomain;
      reasons.push(sanitizedWebsiteDomain ? 'website-domain-normalized' : 'website-domain-cleared');
    }

    const hasPatch = Object.keys(patch).length > 0;
    if (hasPatch) {
      if (dryRun) {
        summary.wouldUpdateClients += 1;
      } else {
        sales.updateSalesClient(clientId, patch);
        summary.updatedClients += 1;
      }
      changed.push({
        clientId,
        businessName: sanitizeText(client?.businessName),
        changedFields: Object.keys(patch),
        values: patch,
        reasons,
      });
    } else {
      summary.unchangedClients += 1;
    }
    for (const reason of reasons) registerReason(reason);
  }

  return {
    summary,
    changed,
    unresolved,
  };
}

function collectSalesRecordingDiagnostics(clients = []) {
  const sourceClients = Array.isArray(clients) ? clients : [];
  const summary = {
    scannedClients: sourceClients.length,
    missingRecordingClients: 0,
    reasonCounts: {},
  };
  const unresolved = [];
  const registerReason = (reason = '') => {
    const key = sanitizeText(reason);
    if (!key) return;
    summary.reasonCounts[key] = Number(summary.reasonCounts[key] || 0) + 1;
  };

  for (const client of sourceClients) {
    const recordingUrl = sanitizeText(client?.myphoner?.latestRecordingUrl);
    if (recordingUrl) continue;
    summary.missingRecordingClients += 1;
    const leadId = sanitizeText(client?.myphoner?.leadId);
    const syncReason = sanitizeText(client?.myphoner?.latestRecordingSyncReason);
    const lastRecordingWebhookAt = sanitizeText(client?.myphoner?.lastRecordingWebhookAt);
    const reason = syncReason || (leadId ? (lastRecordingWebhookAt ? 'recording-url-missing' : 'recording-webhook-missing') : 'missing-lead-link');
    registerReason(reason);
    unresolved.push({
      clientId: sanitizeText(client?.id),
      businessName: sanitizeText(client?.businessName),
      leadId,
      lastRecordingWebhookAt,
      reason,
    });
  }

  return {
    summary,
    unresolved,
  };
}

async function runSalesDataIntegrityBackfill({
  dryRun = true,
  limit = 0,
  baseUrl = '',
  onlyMissingLinks = true,
} = {}) {
  const allClients = sales.getSalesClients();
  const parsedLimit = Number(limit);
  const maxClients = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.max(1, Math.trunc(parsedLimit)) : 0;
  const selectedClients = maxClients ? allClients.slice(0, maxClients) : allClients;
  const selectedClientIds = new Set(selectedClients.map((client) => sanitizeText(client?.id)).filter(Boolean));

  const websiteAndBusiness = await backfillSalesWebsiteAndBusinessFields({
    clients: selectedClients,
    dryRun,
  });
  const links = await backfillExistingSalesClientLinks({
    clients: selectedClients,
    onlyMissing: Boolean(onlyMissingLinks),
    dryRun,
    repairLeadLinks: true,
  });
  const calendar = await backfillMissingSalesCalendarEvents({
    dryRun,
    limit: maxClients,
  });

  const normalizedBaseUrl = normalizeHttpBaseUrl(baseUrl);
  let recordings = {
    summary: {
      skipped: 'missing-base-url',
    },
    applied: [],
    filesWithoutPhone: [],
    unmatchedByPhone: [],
  };
  if (normalizedBaseUrl) {
    recordings = await syncLocalMyphonerRecordings({
      baseUrl: normalizedBaseUrl,
      persist: !dryRun,
      fillMissingOnly: true,
    });
  }

  const refreshedSelectedClients = sales
    .getSalesClients()
    .filter((client) => selectedClientIds.has(sanitizeText(client?.id)));
  const recordingDiagnostics = collectSalesRecordingDiagnostics(
    dryRun ? selectedClients : refreshedSelectedClients
  );

  return {
    summary: {
      selectedClients: selectedClients.length,
      dryRun: Boolean(dryRun),
      onlyMissingLinks: Boolean(onlyMissingLinks),
      normalizedBaseUrl,
    },
    websiteAndBusiness,
    links,
    calendar,
    recordings,
    recordingDiagnostics,
  };
}

async function backfillExistingSalesClientLinks({
  clients = [],
  onlyMissing = true,
  dryRun = false,
  limit = 0,
  repairLeadLinks = true,
} = {}) {
  const allClients = Array.isArray(clients) ? clients : [];
  const parsedLimit = Number(limit);
  const maxClients = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.max(1, Math.trunc(parsedLimit)) : 0;
  const selectedClients = maxClients ? allClients.slice(0, maxClients) : allClients;
  const selectedClientIds = new Set(selectedClients.map((client) => sanitizeText(client?.id)).filter(Boolean));
  const coverageBefore = computeSalesLinksCoverage(selectedClients);
  const summary = {
    totalClients: allClients.length,
    selectedClients: selectedClients.length,
    onlyMissing: Boolean(onlyMissing),
    dryRun: Boolean(dryRun),
    eligibleClients: 0,
    processedClients: 0,
    skippedNoMissing: 0,
    updatedClients: 0,
    wouldUpdateClients: 0,
    unchangedClients: 0,
    leadFetched: 0,
    leadFetchFailed: 0,
    leadRelinked: 0,
    leadWouldRelink: 0,
    leadRelinkFailed: 0,
    unresolvedClients: 0,
    errors: 0,
    coverageBefore,
    coverageAfter: coverageBefore,
    reasonCounts: {},
  };
  const changed = [];
  const failures = [];
  const unresolved = [];
  let leadCatalog = null;
  let skipLeadFetchDueToRateLimit = false;

  const registerReason = (reason = '') => {
    const key = sanitizeText(reason);
    if (!key) return;
    summary.reasonCounts[key] = Number(summary.reasonCounts[key] || 0) + 1;
  };

  const ensureLeadCatalog = async () => {
    if (leadCatalog) return leadCatalog;
    leadCatalog = await buildMyphonerLeadCatalog();
    return leadCatalog;
  };

  for (const client of selectedClients) {
    const targetClientId = sanitizeText(client?.id);
    if (!targetClientId) continue;
    let workingClient = client;
    const missingFields = collectMissingSalesBackfillFields(client);
    if (onlyMissing && !missingFields.length) {
      summary.skippedNoMissing += 1;
      registerReason('no-missing-fields');
      continue;
    }

    summary.eligibleClients += 1;
    const clientReasons = [];
    let leadResult = skipLeadFetchDueToRateLimit
      ? { lead: null, source: '', error: 'myphoner-rate-limited' }
      : await fetchMyphonerLeadForSalesClient(workingClient);
    if (sanitizeText(leadResult?.error) === 'myphoner-rate-limited') {
      skipLeadFetchDueToRateLimit = true;
      clientReasons.push('myphoner-rate-limited');
    }
    if (!leadResult?.lead && repairLeadLinks && sanitizeText(leadResult?.error) !== 'myphoner-rate-limited') {
      const catalog = await ensureLeadCatalog();
      const relinkResult = await attemptRelinkSalesClientLead({
        client: workingClient,
        dryRun: Boolean(dryRun),
        leadCatalog: catalog,
      });
      if (relinkResult?.relinked) {
        summary.leadRelinked += 1;
        workingClient = relinkResult.client || workingClient;
        clientReasons.push(`lead-relinked:${sanitizeText(relinkResult.method || 'unknown')}`);
      } else if (relinkResult?.wouldRelink) {
        summary.leadWouldRelink += 1;
        clientReasons.push(`would-relink:${sanitizeText(relinkResult.method || 'unknown')}`);
      } else if (sanitizeText(relinkResult?.reason) && relinkResult.reason !== 'already-linked') {
        summary.leadRelinkFailed += 1;
        clientReasons.push(sanitizeText(relinkResult.reason));
      }
      if (relinkResult?.candidate?.leadId) {
        const leadFetchAfterRelink = await myphonerApi.fetchMyPhonerLeadById(relinkResult.candidate.leadId);
        if (leadFetchAfterRelink?.success && leadFetchAfterRelink?.data && typeof leadFetchAfterRelink.data === 'object') {
          leadResult = {
            lead: leadFetchAfterRelink.data,
            source: `lead-id:${sanitizeText(relinkResult.candidate.leadId)}`,
            error: '',
          };
        }
      }
    }

    if (leadResult?.lead) summary.leadFetched += 1;
    else if (leadResult?.error && leadResult.error !== 'myphoner-not-configured') summary.leadFetchFailed += 1;

    if (!leadResult?.lead && leadResult?.error) {
      const normalizedLeadError = sanitizeText(leadResult.error);
      if (normalizedLeadError === 'lead-not-found' || normalizedLeadError === 'missing-lead-link') {
        clientReasons.push('missing-lead-link');
      } else if (normalizedLeadError === 'myphoner-rate-limited') {
        clientReasons.push('myphoner-rate-limited');
      } else {
        clientReasons.push('lead-fetch-failed');
      }
    }

    const leadPayload = leadResult?.lead && typeof leadResult.lead === 'object' ? leadResult.lead : {};
    const map = getLeadDataMap(leadPayload);
    const googleRaw = extractGoogleBusinessRawValueFromLeadData(map);
    const orgnrFromLead = extractOrganizationNumberFromLead(leadPayload, map);
    const orgnrFromClient = extractOrganizationNumberFromClientRecord(workingClient);
    const resolvedOrgnr = sanitizeText(orgnrFromLead || orgnrFromClient);
    try {
      const result = await enrichSalesClientLinksFromMyphoner({
        clientId: targetClientId,
        lead: leadPayload,
        leadDataMap: map,
        persist: !dryRun,
      });
      const compactSocialDiagnostics = {
        instagram: {
          reason: sanitizeText(result?.socialDiagnostics?.instagram?.reason),
          queryCount: Number(result?.socialDiagnostics?.instagram?.queryCount || 0),
          rawResultCount: Number(result?.socialDiagnostics?.instagram?.rawResultCount || 0),
          uniqueCandidateCount: Number(result?.socialDiagnostics?.instagram?.uniqueCandidateCount || 0),
        },
        facebook: {
          reason: sanitizeText(result?.socialDiagnostics?.facebook?.reason),
          queryCount: Number(result?.socialDiagnostics?.facebook?.queryCount || 0),
          rawResultCount: Number(result?.socialDiagnostics?.facebook?.rawResultCount || 0),
          uniqueCandidateCount: Number(result?.socialDiagnostics?.facebook?.uniqueCandidateCount || 0),
        },
      };
      summary.processedClients += 1;
      if (result?.updated) summary.updatedClients += 1;
      else if (result?.wouldUpdate) summary.wouldUpdateClients += 1;
      else summary.unchangedClients += 1;
      if ((result?.updated || result?.wouldUpdate) && Array.isArray(result?.changedFields) && result.changedFields.length) {
        changed.push({
          clientId: targetClientId,
          businessName: sanitizeText(client?.businessName),
          changedFields: result.changedFields,
          missingBefore: missingFields,
          leadSource: sanitizeText(leadResult?.source || ''),
          dryRun: Boolean(dryRun),
          socialDiagnostics: compactSocialDiagnostics,
        });
      }

      const resolvedDetails = normalizeSalesDetailLinks(result?.resolvedDetails || workingClient?.details || {});
      const resolvedMeetingPlace = sanitizeText(result?.resolvedMeetingPlace || workingClient?.meetingPlace);
      const remainingMissing = collectMissingSalesBackfillFields({
        details: resolvedDetails,
        meetingPlace: resolvedMeetingPlace,
        businessName: sanitizeText(result?.resolvedBusinessName || workingClient?.businessName),
      });
      if (remainingMissing.includes('googleBusinessProfile')) {
        if (googleRaw) clientReasons.push('google-url-unparseable');
        else clientReasons.push('missing-google-metadata');
      }
      if (remainingMissing.includes('proffUrl')) {
        if (!resolvedOrgnr) clientReasons.push('missing-orgnr');
        else clientReasons.push('proff-unresolved');
      }
      if (remainingMissing.includes('instagramUrl')) {
        const instagramReason = sanitizeText(compactSocialDiagnostics.instagram.reason);
        if (instagramReason) clientReasons.push(`social-instagram:${instagramReason}`);
      }
      if (remainingMissing.includes('facebookUrl')) {
        const facebookReason = sanitizeText(compactSocialDiagnostics.facebook.reason);
        if (facebookReason) clientReasons.push(`social-facebook:${facebookReason}`);
      }
      if (remainingMissing.includes('instagramUrl') || remainingMissing.includes('facebookUrl')) {
        clientReasons.push('social-low-confidence');
      }
      if (remainingMissing.includes('meetingPlace')) {
        clientReasons.push('missing-meeting-address');
      }

      const uniqueReasons = [...new Set(clientReasons.filter(Boolean))];
      if (remainingMissing.length) {
        summary.unresolvedClients += 1;
        unresolved.push({
          clientId: targetClientId,
          businessName: sanitizeText(workingClient?.businessName),
          missingBefore: missingFields,
          missingAfter: remainingMissing,
          reasons: uniqueReasons,
          leadSource: sanitizeText(leadResult?.source || ''),
          socialDiagnostics: compactSocialDiagnostics,
        });
      }
      for (const reason of uniqueReasons) registerReason(reason);
    } catch (error) {
      summary.errors += 1;
      registerReason('backfill-error');
      failures.push({
        clientId: targetClientId,
        businessName: sanitizeText(workingClient?.businessName),
        message: sanitizeText(error?.message) || 'Unknown backfill error',
      });
    }
  }

  if (!dryRun) {
    const refreshed = sales.getSalesClients().filter((client) => selectedClientIds.has(sanitizeText(client?.id)));
    summary.coverageAfter = computeSalesLinksCoverage(refreshed);
  }
  if (leadCatalog && typeof leadCatalog === 'object') {
    summary.leadCatalog = {
      listCount: Number(leadCatalog.listCount || 0),
      leadCount: Number(leadCatalog.leadCount || 0),
      errors: Array.isArray(leadCatalog.errors) ? leadCatalog.errors : [],
    };
  }

  return {
    summary,
    changed,
    failures,
    unresolved,
  };
}

function extractDomainFromMyphonerValue(value = '') {
  return sanitizeMyphonerFieldValue(value);
}

function getMyphonerLeadId(lead = {}, resourcePath = '') {
  const source = lead && typeof lead === 'object' ? lead : {};
  const direct = sanitizeText(source.id || source.lead_id || source.leadId);
  if (direct) return direct;
  const fromLocation = myphonerApi.extractMyPhonerIdFromResource(
    sanitizeText(source.location || source.resource_url || resourcePath),
    'leads'
  );
  return sanitizeText(fromLocation);
}

function buildSalesInputFromMyphonerLead(lead = {}, resourcePath = '') {
  const source = lead && typeof lead === 'object' ? lead : {};
  const leadDataMap = getLeadDataMap(source);
  const fullName = pickLeadDataValue(leadDataMap, ['contact_person', 'full_name', 'fullname', 'contact_name', 'name']);
  const firstName = pickLeadDataValue(leadDataMap, ['first_name', 'firstname']);
  const lastName = pickLeadDataValue(leadDataMap, ['last_name', 'lastname']);
  const contactPerson = pickFirstNonEmpty([
    pickLeadDataValue(leadDataMap, ['contact_person', 'kontaktperson']),
    fullName,
    `${firstName} ${lastName}`.trim(),
    source.secondary_identifier,
    source.primary_identifier,
  ]);
  const businessName = pickFirstNonEmpty([
    source.primary_identifier,
    pickLeadDataValue(leadDataMap, ['company_name', 'business_name', 'company', 'firma', 'foretak', 'brreg_name', 'name']),
    pickLeadDataValue(leadDataMap, ['organization_name', 'org_name']),
    contactPerson,
    `Myphoner lead ${getMyphonerLeadId(source, resourcePath) || 'unknown'}`,
  ]);
  const meetingPlaceRaw = pickFirstNonEmpty([
    pickLeadDataValue(leadDataMap, ['meeting_place', 'meeting_address', 'address', 'visiting_address', 'besoksadresse', 'moteadresse']),
    pickLeadDataValue(leadDataMap, ['city', 'town', 'post_place', 'poststed']),
  ]);
  const winnerCategory = normalizeMyphonerWinnerCategory(
    pickFirstNonEmpty([
      source.category,
      source.last_event?.category,
      source.last_action_or_note?.category,
      pickLeadDataValue(leadDataMap, ['winner_category', 'meeting_category', 'appointment_category']),
    ])
  );
  const meetingMode = inferMeetingModeFromMyphonerLead(source, leadDataMap, meetingPlaceRaw, {
    winnerCategory,
  });
  const meetingAt = parseMyphonerMeetingAt(source, leadDataMap);
  const commentText = resolveLeadCommentText(source, leadDataMap);
  const contactEmail = pickMyphonerLeadEmail(source, leadDataMap, commentText);
  const contactPhone = pickMyphonerLeadPhone(source, leadDataMap, commentText);
  const websiteDomain = extractDomainFromMyphonerValue(
    pickMyphonerWebsiteDomainValue(source, leadDataMap)
  );
  return buildSalesInput(
    {
      businessName,
      contactPerson: contactPerson || businessName,
      contactEmail,
      contactPhone:
        contactPhone ||
        normalizePhoneCandidate(
          pickFirstNonEmpty([source.tertiary_identifier, source.destination_number])
        ),
      meetingMode,
      meetingPlace: meetingPlaceRaw,
      agreedTime: Boolean(meetingAt),
      meetingAt,
      industry: pickLeadDataValue(leadDataMap, ['industry', 'branche', 'bransje']),
      websiteDomain,
      details: buildSalesDetailsFromMyphonerLead(source, leadDataMap),
    },
    { requireCore: false }
  );
}

function mergeMyphonerSalesInput(existing = {}, incoming = {}) {
  const current = existing && typeof existing === 'object' ? existing : {};
  const next = incoming && typeof incoming === 'object' ? incoming : {};
  const incomingHasMeeting = Boolean(next.meetingAt);
  const mergedMeetingMode = normalizeMeetingMode(next.meetingMode || current.meetingMode || 'online');
  const nextEmail = sanitizeText(next.contactEmail);
  const currentEmail = sanitizeText(current.contactEmail);
  const mergedEmail = nextEmail || (isSyntheticMyphonerFallbackEmail(currentEmail) || isMissingEmailPlaceholder(currentEmail) ? '' : currentEmail);
  const merged = buildSalesInput(
    {
      businessName: next.businessName || current.businessName,
      contactPerson: next.contactPerson || current.contactPerson || next.businessName,
      contactEmail: mergedEmail,
      contactPhone: next.contactPhone || current.contactPhone,
      industry: next.industry || current.industry,
      websiteDomain: sanitizeSalesWebsiteDomain(next.websiteDomain),
      details: normalizeSalesDetailLinks(next.details || {}, current.details || {}),
      meetingMode: mergedMeetingMode,
      meetingPlace: next.meetingPlace || current.meetingPlace,
      agreedTime: incomingHasMeeting ? true : Boolean(current.agreedTime),
      meetingAt: incomingHasMeeting ? next.meetingAt : current.meetingAt,
    },
    { existing: current, requireCore: false }
  );
  if (!merged.businessName) merged.businessName = current.businessName || 'Myphoner client';
  if (!merged.contactPerson) merged.contactPerson = current.contactPerson || merged.businessName;
  return merged;
}

function buildMyphonerMetaPatch({
  lead = {},
  resourcePath = '',
  winnerCategory = '',
  winnerComment = '',
  recording = null,
  eventType = 'winner',
} = {}) {
  const source = lead && typeof lead === 'object' ? lead : {};
  const leadId = getMyphonerLeadId(source, resourcePath);
  const listIdRaw =
    source.list_id ??
    source.listId ??
    source.list_location ??
    source.listLocation ??
    '';
  const listId = sanitizeText(
    myphonerApi.extractMyPhonerIdFromResource(String(listIdRaw || ''), 'lists') || listIdRaw
  );
  const timestamp = nowIso();
  const recordingMeta = recording && typeof recording === 'object' ? recording : {};
  const patch = {
    latestEventAt: timestamp,
  };
  if (leadId) patch.leadId = leadId;
  if (listId) patch.listId = listId;
  const listName = sanitizeMyphonerFieldValue(source.list_name || source.listName);
  if (listName) patch.listName = listName;
  const leadResourceUrl = sanitizeText(resourcePath || source.location || source.resource_url);
  if (leadResourceUrl) patch.leadResourceUrl = leadResourceUrl;
  if (eventType === 'winner') {
    const leadDataMap = getLeadDataMap(source);
    const meetingPlaceHint = pickFirstNonEmpty([
      pickLeadDataValue(leadDataMap, ['meeting_place', 'meeting_address', 'address', 'visiting_address', 'besoksadresse', 'moteadresse']),
      pickLeadDataValue(leadDataMap, ['city', 'town', 'post_place', 'poststed']),
    ]);
    const category = normalizeMyphonerWinnerCategory(
      pickFirstNonEmpty([
        winnerCategory,
        source.category,
        source.last_event?.category,
        source.last_action_or_note?.category,
        pickLeadDataValue(leadDataMap, ['winner_category', 'meeting_category', 'appointment_category']),
      ])
    );
    const inferredMeetingMode = inferMeetingModeFromMyphonerLead(source, leadDataMap, meetingPlaceHint, {
      winnerCategory: category,
    });
    patch.winnerCategory = category || (inferredMeetingMode === 'in-person' ? 'irl' : 'online');
    const comment = pickFirstNonEmpty([winnerComment, source.last_event?.comment, source.last_action_or_note?.comment, source.comment]);
    if (comment) patch.winnerComment = comment;
  }
  if (eventType === 'winner') patch.lastWinnerWebhookAt = timestamp;
  if (eventType === 'recording') patch.lastRecordingWebhookAt = timestamp;

  const callId = sanitizeText(recordingMeta.callId);
  if (callId) patch.latestCallId = callId;
  const callStartedAt = sanitizeText(recordingMeta.callStartedAt);
  if (callStartedAt) patch.latestCallStartedAt = callStartedAt;
  if (Number.isFinite(Number(recordingMeta.durationSeconds))) {
    patch.latestCallDurationSeconds = Number(recordingMeta.durationSeconds);
  }
  const callUserEmail = sanitizeText(recordingMeta.userEmail);
  if (callUserEmail) patch.latestCallUserEmail = callUserEmail;
  const destination = sanitizeText(recordingMeta.destinationNumber);
  if (destination) patch.latestCallDestinationNumber = destination;
  const recordingUrl = sanitizeText(recordingMeta.recordingUrl);
  if (recordingUrl) {
    patch.latestRecordingUrl = recordingUrl;
    patch.latestRecordingSyncReason = 'recording-url-synced';
  }
  return patch;
}

function findSalesClientByPhone(phone = '') {
  const targetDigits = normalizePhoneDigits(phone);
  if (!targetDigits) return null;
  const all = sales.getSalesClients();
  return (
    all.find((client) => {
      const currentDigits = normalizePhoneDigits(client.contactPhone);
      if (!currentDigits) return false;
      return currentDigits === targetDigits || currentDigits.endsWith(targetDigits) || targetDigits.endsWith(currentDigits);
    }) || null
  );
}

function findSalesClientForMyphonerLead(lead = {}, resourcePath = '') {
  const source = lead && typeof lead === 'object' ? lead : {};
  const leadDataMap = getLeadDataMap(source);
  const commentText = resolveLeadCommentText(source, leadDataMap);
  const leadId = getMyphonerLeadId(source, resourcePath);
  if (leadId) {
    const byLead = sales.getSalesClientByMyphonerLeadId(leadId);
    if (byLead) return byLead;
    // Do not merge two distinct Myphoner winner leads onto one existing lead-linked sales row.
    // We only allow fallback matching to rows that are not already linked to another lead ID.
    const email = normalizeEmail(pickMyphonerLeadEmail(source, leadDataMap, commentText));
    if (email) {
      const byUnlinkedEmail = sales.getSalesClients().find((client) => {
        const clientEmail = normalizeEmail(client.contactEmail);
        const linkedLeadId = sanitizeText(client.myphoner?.leadId);
        return clientEmail === email && !linkedLeadId;
      });
      if (byUnlinkedEmail) return byUnlinkedEmail;
    }
    const phone = pickMyphonerLeadPhone(source, leadDataMap, commentText) || normalizePhoneCandidate(source.destination_number);
    if (phone) {
      const targetDigits = normalizePhoneDigits(phone);
      const byUnlinkedPhone = sales.getSalesClients().find((client) => {
        const linkedLeadId = sanitizeText(client.myphoner?.leadId);
        if (linkedLeadId) return false;
        const currentDigits = normalizePhoneDigits(client.contactPhone);
        if (!currentDigits || !targetDigits) return false;
        return (
          currentDigits === targetDigits ||
          currentDigits.endsWith(targetDigits) ||
          targetDigits.endsWith(currentDigits)
        );
      });
      if (byUnlinkedPhone) return byUnlinkedPhone;

      const incomingBusinessKey = normalizeLooseKey(
        pickFirstNonEmpty([
          source.primary_identifier,
          pickLeadDataValue(leadDataMap, ['company_name', 'business_name', 'company', 'firma', 'foretak', 'brreg_name', 'name']),
        ])
      );
      const incomingContactKey = normalizeLooseKey(
        pickFirstNonEmpty([
          pickLeadDataValue(leadDataMap, ['contact_person', 'kontaktperson', 'full_name', 'name']),
          source.secondary_identifier,
        ])
      );
      const byLinkedDuplicate = sales.getSalesClients().find((client) => {
        const linkedLeadId = sanitizeText(client.myphoner?.leadId);
        if (!linkedLeadId || linkedLeadId === leadId) return false;
        const currentDigits = normalizePhoneDigits(client.contactPhone);
        if (!currentDigits || !targetDigits) return false;
        const phoneMatches =
          currentDigits === targetDigits ||
          currentDigits.endsWith(targetDigits) ||
          targetDigits.endsWith(currentDigits);
        if (!phoneMatches) return false;
        const businessKey = normalizeLooseKey(client.businessName);
        const contactKey = normalizeLooseKey(client.contactPerson);
        const businessMatches =
          incomingBusinessKey &&
          businessKey &&
          (businessKey === incomingBusinessKey ||
            businessKey.includes(incomingBusinessKey) ||
            incomingBusinessKey.includes(businessKey));
        const contactMatches =
          incomingContactKey &&
          contactKey &&
          (contactKey === incomingContactKey ||
            contactKey.includes(incomingContactKey) ||
            incomingContactKey.includes(contactKey));
        return Boolean(businessMatches || (contactMatches && incomingBusinessKey && !businessKey));
      });
      if (byLinkedDuplicate) return byLinkedDuplicate;
    }
    return null;
  }
  const email = normalizeEmail(pickMyphonerLeadEmail(source, leadDataMap, commentText));
  if (email) {
    const byEmail = sales.getSalesClients().find((client) => normalizeEmail(client.contactEmail) === email);
    if (byEmail) return byEmail;
  }
  const phone = pickMyphonerLeadPhone(source, leadDataMap, commentText) || normalizePhoneCandidate(source.destination_number);
  return findSalesClientByPhone(phone);
}

async function resolveMyphonerSalesOwnerId(lead = {}, existingOwnerId = '') {
  const source = lead && typeof lead === 'object' ? lead : {};
  const existing = sanitizeText(existingOwnerId);
  let users = [];
  try {
    users = await store.getAllUsers();
  } catch {
    users = [];
  }
  const salesUsers = Array.isArray(users)
    ? users.filter((user) => sanitizeText(user?.role).toLowerCase() === 'sales' && sanitizeText(user?.id))
    : [];
  const salesOwnerFromUser = (user = null) => {
    const id = sanitizeText(user?.id);
    return id ? `sales:${id}` : '';
  };
  const findSalesByEmail = (email = '') => {
    const target = normalizeEmail(email);
    if (!target) return null;
    return salesUsers.find((user) => normalizeEmail(user?.username) === target) || null;
  };
  const claimedSalesUser = findSalesByEmail(source.claimed_by || source.claimedBy);
  if (claimedSalesUser) {
    const claimedOwner = salesOwnerFromUser(claimedSalesUser);
    if (claimedOwner) return claimedOwner;
  }
  if (existing.startsWith('sales:')) return existing;

  const configuredOwnerRaw = sanitizeText(MYPHONER_DEFAULT_SALES_OWNER_KEY);
  const configuredOwnerLower = configuredOwnerRaw.toLowerCase();
  if (configuredOwnerLower.startsWith('sales:')) return configuredOwnerRaw;
  if (configuredOwnerRaw && !configuredOwnerRaw.includes(':')) {
    const configuredSalesUser = findSalesByEmail(configuredOwnerRaw);
    if (configuredSalesUser) {
      const configuredSalesOwner = salesOwnerFromUser(configuredSalesUser);
      if (configuredSalesOwner) return configuredSalesOwner;
    }
  }

  if (salesUsers.length) {
    const fallbackSalesOwner = salesOwnerFromUser(salesUsers[0]);
    if (fallbackSalesOwner) return fallbackSalesOwner;
  }
  if (existing) return existing;
  if (configuredOwnerRaw) return configuredOwnerRaw;
  return '';
}

async function upsertSalesClientFromMyphonerLead({
  lead = {},
  resourcePath = '',
  winnerCategory = '',
  winnerComment = '',
} = {}) {
  const source = lead && typeof lead === 'object' ? lead : {};
  const leadId = getMyphonerLeadId(source, resourcePath);
  const existing = findSalesClientForMyphonerLead(source, resourcePath);
  const incomingInput = buildSalesInputFromMyphonerLead(source, resourcePath);
  const leadDataMap = getLeadDataMap(source);
  const winnerCommentText = pickFirstNonEmpty([
    winnerComment,
    source.last_event?.comment,
    source.last_action_or_note?.comment,
    source.comment,
    pickLeadDataValue(leadDataMap, ['winner_comment', 'comment', 'notes', 'note']),
  ]);
  const phoneForRecording =
    pickMyphonerLeadPhone(source, leadDataMap, winnerCommentText) ||
    normalizePhoneCandidate(source.destination_number || source.tertiary_identifier || '');
  const storedRecording =
    (leadId ? myphonerIntegration.getRecordingForLead(leadId) : null) ||
    (phoneForRecording ? myphonerIntegration.getRecordingForPhone(phoneForRecording) : null) ||
    null;
  const resolvedOwnerId = await resolveMyphonerSalesOwnerId(source, existing?.ownerId || '');
  const myphonerPatch = buildMyphonerMetaPatch({
    lead: source,
    resourcePath,
    winnerCategory,
    winnerComment: winnerCommentText,
    recording: storedRecording,
    eventType: 'winner',
  });
  const mergedLeadIds = Array.from(
    new Set(
      [
        myphonerPatch.leadId,
        existing?.myphoner?.leadId,
        ...(Array.isArray(existing?.myphoner?.leadIds) ? existing.myphoner.leadIds : []),
      ]
        .map((entry) => sanitizeText(entry))
        .filter(Boolean)
    )
  );
  let client;
  if (existing) {
    const mergedInput = mergeMyphonerSalesInput(existing, incomingInput);
    const product = sales.resolveSalesProductFromMyphoner({
      listId: myphonerPatch.listId || existing?.myphoner?.listId,
      listName: myphonerPatch.listName || existing?.myphoner?.listName,
    });
    client = sales.updateSalesClient(existing.id, {
      ...mergedInput,
      product,
      ownerId: resolvedOwnerId || existing.ownerId || MYPHONER_DEFAULT_SALES_OWNER_KEY,
      myphoner: {
        ...(existing.myphoner || {}),
        ...myphonerPatch,
        leadIds: mergedLeadIds,
      },
    });
  } else {
    const product = sales.resolveSalesProductFromMyphoner({
      listId: myphonerPatch.listId,
      listName: myphonerPatch.listName,
    });
    const createPayload = {
      ...incomingInput,
      product,
      ownerId: resolvedOwnerId || MYPHONER_DEFAULT_SALES_OWNER_KEY,
      myphoner: {
        ...myphonerPatch,
        leadIds: mergedLeadIds,
      },
    };
    if (!createPayload.businessName) createPayload.businessName = incomingInput.contactPerson || 'Myphoner client';
    if (!createPayload.contactPerson) createPayload.contactPerson = createPayload.businessName;
    client = sales.createSalesClient(createPayload);
  }
  if (!client) throw makeHttpError(500, 'Failed creating/updating sales client from Myphoner.');
  const syncResult = await maybeSyncCalendar(client, existing || null, {
    notifyAttendees: false,
    actorAccountKey: '',
    fallbackAccountKeys: await resolveCalendarFallbackAccountKeys(client?.ownerId || '', ''),
  });
  const finalClient = syncResult.client || client;
  scheduleSalesClientLinkEnrichment({
    clientId: sanitizeText(finalClient?.id),
    lead: source,
    leadDataMap,
  });
  return {
    client: finalClient,
    created: !existing,
    warnings: syncResult.warnings || [],
  };
}

async function processMyphonerWinnerFromResource(resourcePath = '', { winnerCategory = '', winnerComment = '' } = {}) {
  const normalizedResource = sanitizeText(resourcePath);
  if (!normalizedResource) throw makeHttpError(410, 'Missing resource URL.');
  if (!normalizedResource.includes('/leads/')) {
    throw makeHttpError(410, 'Winner webhook must point to a lead resource URL.');
  }
  const leadResponse = await myphonerApi.fetchMyPhonerLeadByResource(normalizedResource);
  if (!leadResponse.success) {
    throw makeHttpError(
      leadResponse.status === 404 ? 410 : 502,
      leadResponse.error || 'Failed fetching Myphoner lead.'
    );
  }
  const leadPayload = myphonerApi.unwrapMyPhonerLead(
    leadResponse.data && typeof leadResponse.data === 'object' ? leadResponse.data : {}
  );
  const upserted = await upsertSalesClientFromMyphonerLead({
    lead: leadPayload,
    resourcePath: normalizedResource,
    winnerCategory,
    winnerComment,
  });
  let client = upserted.client;
  const recordingAttach = await attachCachedOrPendingRecordingToClient(client, {
    syncReason: 'winner-recording-attached',
  });
  if (recordingAttach.client) client = recordingAttach.client;
  // Always schedule a short follow-up in case new_call arrives slightly after winner.
  const followUpCallId = sanitizeText(client?.myphoner?.latestCallId || recordingAttach.callId);
  if (followUpCallId && !sanitizeText(client?.myphoner?.latestRecordingUrl)) {
    myphonerIntegration.enqueuePendingRecording(
      {
        callId: followUpCallId,
        leadId: sanitizeText(client?.myphoner?.leadId),
        destinationNumber: sanitizeText(client?.contactPhone || client?.myphoner?.latestCallDestinationNumber),
        reason: 'winner-followup-awaiting-recording',
      },
      { delayMs: recordingRetryDelayMs(0) }
    );
  }
  let ssuWinsCopy = { skipped: 'not-attempted' };
  try {
    ssuWinsCopy = await myphonerSsuWins.copySsuWinnerToWinsList(leadPayload, {
      assumeWinner: true,
    });
    if (ssuWinsCopy?.created) {
      console.log(
        `[myphoner ssu-wins] copied winner ${sanitizeText(ssuWinsCopy.leadId)} -> ${sanitizeText(ssuWinsCopy.targetLeadId)}`
      );
    } else if (!ssuWinsCopy?.ok) {
      console.error(`[myphoner ssu-wins] copy failed: ${sanitizeText(ssuWinsCopy?.error) || 'unknown error'}`);
    }
  } catch (error) {
    ssuWinsCopy = { ok: false, error: sanitizeText(error?.message) || 'copy-failed' };
    console.error('[myphoner ssu-wins] copy crashed:', error?.message || error);
  }
  return {
    ok: true,
    created: Boolean(upserted.created),
    clientId: sanitizeText(client?.id),
    leadId: sanitizeText(client?.myphoner?.leadId),
    recordingAttached: Boolean(recordingAttach.attached),
    recordingReason: sanitizeText(recordingAttach.reason),
    warnings: upserted.warnings || [],
    ssuWinsCopy,
  };
}

function extractLeadIdFromCallPayload(call = {}) {
  const source = call && typeof call === 'object' ? call : {};
  const direct = sanitizeText(source.lead_id || source.leadId || source?.lead?.id);
  if (direct) return direct;
  const locationCandidates = [
    source.lead_location,
    source.leadLocation,
    source?.lead?.location,
    source.resource_url,
    source.location,
  ];
  for (const candidate of locationCandidates) {
    const resourcePath = myphonerApi.parseMyPhonerResourcePath(candidate, myphonerApi.getMyPhonerConfig());
    const leadId = myphonerApi.extractMyPhonerIdFromResource(resourcePath, 'leads');
    if (leadId) return sanitizeText(leadId);
  }
  return '';
}

function extractRecordingFromCall(call = {}, sourceResourceUrl = '') {
  const source = call && typeof call === 'object' ? call : {};
  const recordings = Array.isArray(source.recordings) ? source.recordings : [];
  const normalized = recordings
    .map((entry) => ({
      recordingUrl: coerceHttpUrl(entry?.url || entry?.recording_url || ''),
      callStartedAt: myphonerApi.parseMyPhonerDateToIso(entry?.started_at || source.started_at),
    }))
    .filter((entry) => entry.recordingUrl);
  const latest = normalized.sort(
    (a, b) => new Date(b.callStartedAt || 0).getTime() - new Date(a.callStartedAt || 0).getTime()
  )[0] || null;
  const destinationNumber = sanitizeText(source.destination_number || source.destinationNumber);
  return {
    recordingUrl: sanitizeText(latest?.recordingUrl),
    callId: sanitizeText(
      source.id ||
        source.call_id ||
        source.callId ||
        myphonerApi.extractMyPhonerIdFromResource(sourceResourceUrl, 'calls') ||
        myphonerApi.extractMyPhonerIdFromResource(source.location || '', 'calls')
    ),
    leadId: extractLeadIdFromCallPayload(source),
    callStartedAt: sanitizeText(latest?.callStartedAt || myphonerApi.parseMyPhonerDateToIso(source.started_at)),
    durationSeconds: Number.isFinite(Number(source.duration)) ? Number(source.duration) : 0,
    userEmail: sanitizeText(source.user_email || source.userEmail),
    destinationNumber,
    destinationDigits: normalizePhoneDigits(destinationNumber),
    sourceResourceUrl: sanitizeText(sourceResourceUrl || source.location || ''),
  };
}

function recordingRetryDelayMs(attempt = 0) {
  const delays = MYPHONER_RECORDING_RETRY_DELAYS_MS.length
    ? MYPHONER_RECORDING_RETRY_DELAYS_MS
    : [15_000, 30_000, 60_000, 120_000, 300_000, 600_000];
  const index = Math.max(0, Math.min(delays.length - 1, Number(attempt) || 0));
  return delays[index];
}

function isLocalOrManagedRecordingUrl(url = '') {
  const raw = sanitizeText(url);
  if (!raw) return false;
  if (raw.includes('/myphoner-audio/') || raw.includes('/myphoner-recordings/')) return true;
  return false;
}

function preferRecordingUrl(primary = '', secondary = '') {
  const first = sanitizeText(primary);
  const second = sanitizeText(secondary);
  if (first && !isLocalOrManagedRecordingUrl(first) && second && isLocalOrManagedRecordingUrl(second)) {
    // Prefer durable local copy once downloaded.
    return second;
  }
  return first || second;
}

async function ensureMyphonerRecordingsDir() {
  await fs.mkdir(MYPHONER_RECORDINGS_DIR, { recursive: true });
  return MYPHONER_RECORDINGS_DIR;
}

function guessRecordingExtension(contentType = '', sourceUrl = '') {
  const type = sanitizeText(contentType).toLowerCase();
  if (type.includes('wav')) return '.wav';
  if (type.includes('mpeg') || type.includes('mp3')) return '.mp3';
  if (type.includes('mp4') || type.includes('m4a')) return '.m4a';
  if (type.includes('ogg')) return '.ogg';
  if (type.includes('flac')) return '.flac';
  try {
    const pathname = new URL(sourceUrl).pathname || '';
    const ext = path.extname(pathname).toLowerCase();
    if (LOCAL_RECORDING_EXTENSIONS.has(ext)) return ext;
  } catch {
    // ignore
  }
  return '.wav';
}

async function downloadMyphonerRecordingToLocal(recordingUrl = '', callId = '') {
  if (!MYPHONER_RECORDING_DOWNLOAD_ENABLED) return '';
  const sourceUrl = coerceHttpUrl(recordingUrl);
  if (!sourceUrl) return '';
  const safeCallId = sanitizeText(callId).replace(/[^a-zA-Z0-9_-]/g, '') || `rec-${Date.now()}`;
  const myphonerConfig = myphonerApi.getMyPhonerConfig();
  const myphonerHost = sanitizeText(myphonerConfig?.subdomain)
    ? `${sanitizeText(myphonerConfig.subdomain).toLowerCase()}.myphoner.com`
    : '';
  let targetHost = '';
  try {
    targetHost = new URL(sourceUrl).host.toLowerCase();
  } catch {
    return '';
  }
  const headers = { Accept: '*/*' };
  if (myphonerHost && targetHost === myphonerHost && myphonerApi.isMyPhonerConfigured(myphonerConfig)) {
    headers.Authorization = `Token "${myphonerConfig.apiKey}"`;
  }
  try {
    const response = await fetch(sourceUrl, { method: 'GET', headers, redirect: 'follow' });
    if (!response.ok) {
      console.warn(`[myphoner recording] download failed ${response.status} for call ${safeCallId}`);
      return '';
    }
    const contentType = sanitizeText(response.headers.get('content-type'));
    const ext = guessRecordingExtension(contentType, sourceUrl);
    const fileName = `${safeCallId}${ext}`;
    await ensureMyphonerRecordingsDir();
    const absolutePath = path.join(MYPHONER_RECORDINGS_DIR, fileName);
    const payload = Buffer.from(await response.arrayBuffer());
    if (!payload.length) return '';
    await fs.writeFile(absolutePath, payload);
    const baseUrl = normalizeHttpBaseUrl(process.env.APP_URL || '');
    if (!baseUrl) return `/myphoner-recordings/${encodeURIComponent(fileName)}`;
    return `${baseUrl}/myphoner-recordings/${encodeURIComponent(fileName)}`;
  } catch (error) {
    console.warn(`[myphoner recording] download error for call ${safeCallId}:`, sanitizeText(error?.message) || error);
    return '';
  }
}

async function enrichRecordingMetaWithLocalCopy(recordingMeta = {}) {
  const meta = recordingMeta && typeof recordingMeta === 'object' ? { ...recordingMeta } : {};
  const sourceUrl = coerceHttpUrl(meta.recordingUrl || meta.localRecordingUrl);
  if (!sourceUrl) return meta;
  if (isLocalOrManagedRecordingUrl(sourceUrl)) {
    meta.localRecordingUrl = sourceUrl;
    meta.recordingUrl = sourceUrl;
    return meta;
  }
  const localUrl = await downloadMyphonerRecordingToLocal(sourceUrl, meta.callId || '');
  if (localUrl) {
    meta.localRecordingUrl = localUrl;
    meta.recordingUrl = localUrl;
  }
  return meta;
}

function findSalesClientForRecordingMeta(recordingMeta = {}, leadId = '') {
  const meta = recordingMeta && typeof recordingMeta === 'object' ? recordingMeta : {};
  const resolvedLeadId = sanitizeText(leadId || meta.leadId);
  if (resolvedLeadId) {
    const byLead = sales.getSalesClientByMyphonerLeadId(resolvedLeadId);
    if (byLead) return byLead;
  }
  const byPhone = findSalesClientByPhone(meta.destinationNumber || meta.destinationDigits || '');
  if (byPhone) return byPhone;
  const callId = sanitizeText(meta.callId);
  if (callId) {
    const byCall = sales.getSalesClients().find((client) => sanitizeText(client?.myphoner?.latestCallId) === callId);
    if (byCall) return byCall;
  }
  return null;
}

function applyRecordingMetaToSalesClient(client, recordingMeta = {}, syncReason = 'recording-url-synced') {
  if (!client?.id) return null;
  const meta = recordingMeta && typeof recordingMeta === 'object' ? recordingMeta : {};
  const recordingUrl = preferRecordingUrl(meta.localRecordingUrl, meta.recordingUrl);
  const patch = buildMyphonerMetaPatch({
    lead: { id: meta.leadId || client.myphoner?.leadId, list_name: client?.myphoner?.listName || '' },
    resourcePath: client?.myphoner?.leadResourceUrl || meta.sourceResourceUrl || '',
    recording: {
      ...meta,
      recordingUrl,
    },
    eventType: 'recording',
  });
  return sales.updateSalesClient(client.id, {
    myphoner: {
      ...(client.myphoner || {}),
      ...patch,
      latestRecordingUrl: sanitizeText(recordingUrl || client.myphoner?.latestRecordingUrl),
      latestCallId: sanitizeText(meta.callId || client.myphoner?.latestCallId),
      latestCallStartedAt: sanitizeText(meta.callStartedAt || client.myphoner?.latestCallStartedAt),
      latestCallDurationSeconds: Number.isFinite(Number(meta.durationSeconds))
        ? Number(meta.durationSeconds)
        : Number(client.myphoner?.latestCallDurationSeconds || 0),
      latestCallUserEmail: sanitizeText(meta.userEmail || client.myphoner?.latestCallUserEmail),
      latestCallDestinationNumber: sanitizeText(
        meta.destinationNumber || client.myphoner?.latestCallDestinationNumber
      ),
      latestRecordingSyncReason: sanitizeText(
        recordingUrl ? syncReason || 'recording-url-synced' : syncReason || 'recording-url-missing'
      ),
    },
  });
}

function cacheRecordingMetaEverywhere(recordingMeta = {}, leadId = '') {
  const meta = {
    ...(recordingMeta && typeof recordingMeta === 'object' ? recordingMeta : {}),
    leadId: sanitizeText(leadId || recordingMeta?.leadId),
    destinationDigits: normalizePhoneDigits(recordingMeta?.destinationDigits || recordingMeta?.destinationNumber),
  };
  return myphonerIntegration.cacheRecordingMeta(meta);
}

function resolveCachedRecordingForClient(client = {}) {
  const leadId = sanitizeText(client?.myphoner?.leadId);
  const callId = sanitizeText(client?.myphoner?.latestCallId);
  const phone = sanitizeText(client?.contactPhone || client?.myphoner?.latestCallDestinationNumber);
  const byLead = leadId ? myphonerIntegration.getRecordingForLead(leadId) : null;
  if (byLead?.recordingUrl || byLead?.localRecordingUrl) return byLead;
  const byCall = callId ? myphonerIntegration.getRecordingForCall(callId) : null;
  if (byCall?.recordingUrl || byCall?.localRecordingUrl) return byCall;
  const byPhone = phone ? myphonerIntegration.getRecordingForPhone(phone) : null;
  if (byPhone?.recordingUrl || byPhone?.localRecordingUrl) return byPhone;
  return byLead || byCall || byPhone || null;
}

async function attachCachedOrPendingRecordingToClient(client = {}, options = {}) {
  const current = client && typeof client === 'object' ? client : null;
  if (!current?.id) return { attached: false, reason: 'missing-client' };
  if (sanitizeText(current?.myphoner?.latestRecordingUrl) && !options.force) {
    return { attached: false, reason: 'already-has-recording', client: current };
  }
  let cached = resolveCachedRecordingForClient(current);
  if (!(cached?.recordingUrl || cached?.localRecordingUrl)) {
    const callId = sanitizeText(current?.myphoner?.latestCallId || cached?.callId);
    if (callId) {
      myphonerIntegration.enqueuePendingRecording(
        {
          callId,
          leadId: sanitizeText(current?.myphoner?.leadId),
          destinationNumber: sanitizeText(current?.contactPhone || current?.myphoner?.latestCallDestinationNumber),
          reason: 'winner-awaiting-recording-url',
        },
        { delayMs: recordingRetryDelayMs(0), resetAttempts: true }
      );
      return { attached: false, reason: 'queued-pending-call', callId };
    }
    return { attached: false, reason: 'no-cached-recording' };
  }
  cached = await enrichRecordingMetaWithLocalCopy(cached);
  cacheRecordingMetaEverywhere(cached, current?.myphoner?.leadId);
  const updated = applyRecordingMetaToSalesClient(
    current,
    cached,
    options.syncReason || 'winner-recording-attached'
  );
  if (cached.callId) myphonerIntegration.clearPendingRecording(cached.callId);
  return { attached: Boolean(updated?.myphoner?.latestRecordingUrl), client: updated || current, reason: '' };
}

async function ingestMyphonerCallRecording(callPayload = {}, options = {}) {
  const sourceResourceUrl = sanitizeText(options.sourceResourceUrl || callPayload?.location || '');
  let recordingMeta = extractRecordingFromCall(callPayload, sourceResourceUrl);
  const leadId = sanitizeText(options.leadId || recordingMeta.leadId);
  recordingMeta.leadId = leadId;
  if (recordingMeta.recordingUrl) {
    recordingMeta = await enrichRecordingMetaWithLocalCopy(recordingMeta);
  }
  cacheRecordingMetaEverywhere(recordingMeta, leadId);
  if (recordingMeta.callId && !recordingMeta.recordingUrl) {
    myphonerIntegration.enqueuePendingRecording(
      {
        callId: recordingMeta.callId,
        leadId,
        destinationNumber: recordingMeta.destinationNumber,
        sourceResourceUrl,
        reason: options.pendingReason || 'call-without-recording-url',
      },
      { delayMs: recordingRetryDelayMs(0) }
    );
  }
  if (recordingMeta.callId && recordingMeta.recordingUrl) {
    myphonerIntegration.clearPendingRecording(recordingMeta.callId);
  }
  const targetClient = findSalesClientForRecordingMeta(recordingMeta, leadId);
  if (!targetClient) {
    return {
      ok: true,
      updated: false,
      pending: Boolean(recordingMeta.callId && !recordingMeta.recordingUrl),
      leadId,
      callId: recordingMeta.callId,
      reason: recordingMeta.recordingUrl
        ? 'target-client-not-found'
        : options.pendingReason || 'call-without-recording-url',
      recordingUrl: recordingMeta.recordingUrl || '',
    };
  }
  const syncReason = recordingMeta.recordingUrl
    ? options.syncReason || 'recording-url-synced'
    : options.pendingReason || 'call-without-recording-url';
  const updated = applyRecordingMetaToSalesClient(targetClient, recordingMeta, syncReason);
  return {
    ok: true,
    updated: Boolean(updated),
    pending: Boolean(recordingMeta.callId && !recordingMeta.recordingUrl),
    leadId: leadId || targetClient.myphoner?.leadId || '',
    callId: recordingMeta.callId,
    clientId: sanitizeText(updated?.id || targetClient.id),
    reason: recordingMeta.recordingUrl ? '' : syncReason,
    recordingUrl: recordingMeta.recordingUrl || '',
  };
}

function extractCallResourceFromRecordingPayload(payload = {}) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const candidates = [
    source.call_resource_url,
    source.callResourceUrl,
    source.call_url,
    source.callUrl,
    source.call_location,
    source.callLocation,
    source?.call?.location,
    source?.call?.resource_url,
  ];
  for (const candidate of candidates) {
    const parsed = myphonerApi.parseMyPhonerResourcePath(candidate, myphonerApi.getMyPhonerConfig());
    if (!parsed || !parsed.includes('/calls/')) continue;
    return parsed;
  }
  return '';
}

function extractCallIdFromRecordingPayload(payload = {}) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const direct = sanitizeText(source.call_id || source.callId || source?.call?.id);
  if (direct) return direct;
  const callResourcePath = extractCallResourceFromRecordingPayload(source);
  if (callResourcePath) {
    const fromResource = myphonerApi.extractMyPhonerIdFromResource(callResourcePath, 'calls');
    if (fromResource) return sanitizeText(fromResource);
  }
  return '';
}

function extractCallIdFromAnyPayload(payload = {}, resourcePath = '') {
  const direct = extractCallIdFromRecordingPayload(payload);
  if (direct) return direct;
  const fromResource = myphonerApi.extractMyPhonerIdFromResource(resourcePath, 'calls');
  if (fromResource) return sanitizeText(fromResource);
  const source = payload && typeof payload === 'object' ? payload : {};
  const nestedCandidates = [
    source.resource_url,
    source.resourceUrl,
    source.url,
    source.location,
    source?.call?.id,
    source?.data?.id,
    source?.data?.call_id,
  ];
  for (const candidate of nestedCandidates) {
    const asText = sanitizeText(candidate);
    if (!asText) continue;
    if (/^\d+$/.test(asText) || /^[a-zA-Z0-9_-]{6,}$/.test(asText)) {
      // Prefer explicit call ids only when resource path already indicates calls.
      if (sanitizeText(resourcePath).includes('/calls/')) return asText;
    }
    const parsed = myphonerApi.parseMyPhonerResourcePath(asText, myphonerApi.getMyPhonerConfig());
    const callId = myphonerApi.extractMyPhonerIdFromResource(parsed, 'calls');
    if (callId) return sanitizeText(callId);
  }
  return '';
}

async function processMyphonerRecordingFromResource(resourcePath = '', payload = {}) {
  const normalizedResource = sanitizeText(resourcePath);
  if (!normalizedResource) throw makeHttpError(400, 'Missing resource URL.');
  const webhookPayload = payload && typeof payload === 'object' ? payload : {};
  const webhookEvent = sanitizeText(webhookPayload.event || webhookPayload.event_name || '').toLowerCase();
  let callPayload = null;
  let leadId = '';
  let diagnosticReason = '';

  if (normalizedResource.includes('/calls/')) {
    const callResponse = await myphonerApi.fetchMyPhonerCallByResource(normalizedResource);
    if (!callResponse.success) {
      // Temporary upstream failures should not unsubscribe the webhook (410).
      throw makeHttpError(
        callResponse.status === 404 ? 404 : 502,
        callResponse.error || 'Failed fetching Myphoner call.'
      );
    }
    callPayload = callResponse.data && typeof callResponse.data === 'object' ? callResponse.data : {};
    leadId = extractLeadIdFromCallPayload(callPayload);
    if (!callPayload || typeof callPayload !== 'object') diagnosticReason = 'call-payload-empty';
  } else if (normalizedResource.includes('/leads/')) {
    leadId = myphonerApi.extractMyPhonerIdFromResource(normalizedResource, 'leads');
    const callResourcePath = extractCallResourceFromRecordingPayload(webhookPayload);
    const callId = extractCallIdFromAnyPayload(webhookPayload, normalizedResource);
    if (callResourcePath || callId) {
      const callResponse = callResourcePath
        ? await myphonerApi.fetchMyPhonerCallByResource(callResourcePath)
        : await myphonerApi.fetchMyPhonerCallById(callId);
      if (callResponse.success) {
        callPayload = callResponse.data && typeof callResponse.data === 'object' ? callResponse.data : {};
        if (!leadId) leadId = extractLeadIdFromCallPayload(callPayload);
      } else {
        diagnosticReason = 'call-fetch-failed-from-webhook-payload';
      }
    } else {
      // Official docs describe resource_url as a lead URL. Recover by phone cache /
      // previously seen call ids for this lead, and keep waiting for a call webhook.
      const leadClient = leadId ? sales.getSalesClientByMyphonerLeadId(leadId) : null;
      const leadPhone =
        sanitizeText(leadClient?.contactPhone) ||
        sanitizeText(leadClient?.myphoner?.latestCallDestinationNumber);
      const cached =
        (leadId ? myphonerIntegration.getRecordingForLead(leadId) : null) ||
        (leadPhone ? myphonerIntegration.getRecordingForPhone(leadPhone) : null) ||
        (leadClient?.myphoner?.latestCallId
          ? myphonerIntegration.getRecordingForCall(leadClient.myphoner.latestCallId)
          : null);
      if (cached?.callId) {
        const callResponse = await myphonerApi.fetchMyPhonerCallById(cached.callId);
        if (callResponse.success) {
          callPayload = callResponse.data && typeof callResponse.data === 'object' ? callResponse.data : {};
        } else {
          diagnosticReason = 'lead-webhook-cached-call-fetch-failed';
        }
      } else if ((cached?.recordingUrl || cached?.localRecordingUrl) && leadClient?.id) {
        const attached = await attachCachedOrPendingRecordingToClient(leadClient, {
          force: true,
          syncReason: 'recording-cache-attached',
        });
        return {
          ok: true,
          updated: Boolean(attached.attached),
          leadId,
          reason: attached.attached ? '' : attached.reason || 'recording-webhook-without-call-reference',
        };
      } else {
        diagnosticReason = 'recording-webhook-without-call-reference';
        if (leadClient?.id) {
          sales.updateSalesClient(leadClient.id, {
            myphoner: {
              ...(leadClient.myphoner || {}),
              lastRecordingWebhookAt: nowIso(),
              latestRecordingSyncReason: diagnosticReason,
            },
          });
        }
        return { ok: true, updated: false, leadId, reason: diagnosticReason, pending: true };
      }
    }
  } else {
    // Unknown resource shape: try treating the last path segment as a call id before giving up.
    const maybeCallId = extractCallIdFromAnyPayload(webhookPayload, normalizedResource);
    if (!maybeCallId) {
      throw makeHttpError(400, 'Unsupported Myphoner recording resource URL.');
    }
    const callResponse = await myphonerApi.fetchMyPhonerCallById(maybeCallId);
    if (!callResponse.success) {
      throw makeHttpError(502, callResponse.error || 'Failed fetching Myphoner call.');
    }
    callPayload = callResponse.data && typeof callResponse.data === 'object' ? callResponse.data : {};
    leadId = extractLeadIdFromCallPayload(callPayload);
  }

  if (!callPayload) {
    return { ok: true, updated: false, leadId, reason: diagnosticReason || 'recording-url-missing', pending: true };
  }

  const result = await ingestMyphonerCallRecording(callPayload, {
    sourceResourceUrl: normalizedResource,
    leadId,
    syncReason: webhookEvent === 'new_call' ? 'new-call-recording-synced' : 'recording-url-synced',
    pendingReason: diagnosticReason || 'call-without-recording-url',
  });
  return result;
}

async function handleMyphonerWebhookEvent(req, res, eventType = 'winner') {
  if (!myphonerApi.isMyPhonerConfigured()) {
    return res.status(503).json({ message: 'Myphoner integration is not configured.' });
  }
  if (!MYPHONER_WEBHOOK_SECRET) {
    return res.status(503).json({ message: 'Myphoner webhook secret is not configured.' });
  }
  if (!isMyphonerWebhookAuthorized(req)) {
    return res.status(401).json({ message: 'Unauthorized webhook request.' });
  }
  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  const rawResource =
    sanitizeText(payload.resource_url) ||
    sanitizeText(payload.resourceUrl) ||
    sanitizeText(payload.url);
  if (!rawResource) {
    return res.status(400).json({ message: 'resource_url is required.' });
  }
  const resourcePath = myphonerApi.parseMyPhonerResourcePath(rawResource, myphonerApi.getMyPhonerConfig());
  if (!resourcePath) {
    return res.status(410).json({ message: 'Invalid resource_url. Remove this webhook subscription.' });
  }
  if (myphonerIntegration.wasRecentlyProcessed(eventType, resourcePath, MYPHONER_WEBHOOK_REPLAY_WINDOW_MS)) {
    return res.json({ ok: true, duplicate: true, eventType, resourcePath });
  }
  try {
    let result = { ok: true };
    if (eventType === 'winner') {
      result = await processMyphonerWinnerFromResource(resourcePath, {
        winnerCategory: sanitizeText(payload.category || payload.winner_category),
        winnerComment: sanitizeText(payload.comment || payload.winner_comment),
      });
    } else if (eventType === 'recording') {
      const eventHint = sanitizeText(req.query?.event || payload.event || '');
      result = await processMyphonerRecordingFromResource(resourcePath, {
        ...payload,
        event: eventHint || payload.event,
      });
    } else {
      throw makeHttpError(400, `Unsupported webhook event type: ${eventType}`);
    }
    // Always ACK so Myphoner keeps the subscription. Pending retries are owned by our worker.
    myphonerIntegration.markProcessedEvent(eventType, resourcePath, nowIso());
    if (eventType === 'recording') {
      console.log(
        `[myphoner webhook recording] resource=${resourcePath} updated=${Boolean(result?.updated)} pending=${Boolean(result?.pending)} reason=${sanitizeText(result?.reason)} callId=${sanitizeText(result?.callId)} leadId=${sanitizeText(result?.leadId)}`
      );
    }
    return res.json({ ok: true, eventType, resourcePath, ...result });
  } catch (error) {
    const status = httpStatusFromError(error, 500);
    // Only permanently invalid winner/resource subscriptions should unsubscribe.
    if (status === 410) {
      return res.status(410).json({
        message: sanitizeText(error?.message) || 'Webhook resource is no longer valid.',
      });
    }
    console.error(`[myphoner webhook ${eventType}]`, error?.message || error);
    return res.status(status >= 400 && status <= 599 ? status : 500).json({
      message: sanitizeText(error?.message) || `Failed processing Myphoner ${eventType} webhook.`,
    });
  }
}

async function reconcileMyphonerWebhooks() {
  if (!MYPHONER_WEBHOOK_RECONCILE_ENABLED) {
    return { ok: false, skipped: 'disabled' };
  }
  if (!myphonerApi.isMyPhonerConfigured()) {
    return { ok: false, skipped: 'myphoner-not-configured' };
  }
  if (!MYPHONER_WEBHOOK_SECRET) {
    return { ok: false, skipped: 'webhook-secret-missing' };
  }
  const winnerTargetBaseUrl = buildMyphonerWebhookTargetUrl('winner');
  const recordingTargetBaseUrl = buildMyphonerWebhookTargetUrl('recording');
  if (!winnerTargetBaseUrl || !recordingTargetBaseUrl) {
    return { ok: false, skipped: 'webhook-base-url-missing' };
  }

  const listResponse = await myphonerApi.listMyPhonerLists();
  if (!listResponse.success) {
    throw makeHttpError(502, listResponse.error || 'Failed loading Myphoner lists.');
  }
  const lists = Array.isArray(listResponse.data) ? listResponse.data : [];
  const listIds = new Set();
  const summary = {
    ok: true,
    checkedLists: lists.length,
    createdListWebhooks: 0,
    reusedListWebhooks: 0,
    removedListWebhooks: 0,
    createdAccountWebhooks: 0,
    reusedAccountWebhooks: 0,
  };

  for (const list of lists) {
    const listId = sanitizeText(list?.id);
    if (!listId) continue;
    // SSU wins is a copy destination, not a winner-intake source.
    if (myphonerSsuWins.isSsuWinsList({ listId, listName: sanitizeText(list?.name) })) {
      continue;
    }
    listIds.add(listId);
    const winnerTargetUrl = buildMyphonerWebhookTargetUrl('winner', { listId });
    const existing = myphonerIntegration.getListWinnerWebhook(listId);
    const targetChanged = sanitizeText(existing?.targetUrl) !== winnerTargetUrl;
    const eventChanged = sanitizeText(existing?.event).toLowerCase() !== 'winner';
    const missingWebhookId = !sanitizeText(existing?.webhookId);
    if (existing && !targetChanged && !eventChanged && !missingWebhookId) {
      summary.reusedListWebhooks += 1;
      continue;
    }
    if (existing?.webhookId && targetChanged) {
      await myphonerApi.deleteMyPhonerWebhook(existing.webhookId);
    }
    const createResponse = await myphonerApi.createMyPhonerListWebhook({
      listId,
      targetUrl: winnerTargetUrl,
      event: 'winner',
    });
    if (!createResponse.success) {
      if (isMyphonerWebhookAlreadyTakenError(createResponse)) {
        myphonerIntegration.setListWinnerWebhook(listId, {
          webhookId: sanitizeText(existing?.webhookId),
          targetUrl: winnerTargetUrl,
          event: 'winner',
          listId,
        });
        summary.reusedListWebhooks += 1;
        continue;
      }
      throw makeHttpError(
        createResponse.status === 404 ? 410 : 502,
        createResponse.error || `Failed registering winner webhook for list ${listId}.`
      );
    }
    myphonerIntegration.setListWinnerWebhook(listId, {
      webhookId: myphonerApi.extractWebhookId(createResponse.data),
      targetUrl: winnerTargetUrl,
      event: 'winner',
      listId,
    });
    summary.createdListWebhooks += 1;
  }

  const knownListMap = myphonerIntegration.getMyPhonerIntegrationState()?.webhooks?.listWinnerByListId || {};
  for (const [knownListId, payload] of Object.entries(knownListMap)) {
    if (listIds.has(knownListId)) continue;
    if (sanitizeText(payload?.webhookId)) {
      await myphonerApi.deleteMyPhonerWebhook(payload.webhookId);
    }
    myphonerIntegration.removeListWinnerWebhook(knownListId);
    summary.removedListWebhooks += 1;
  }

  for (const eventName of ['new_recording', 'new_call']) {
    const recordingTargetUrl = buildMyphonerWebhookTargetUrl('recording', { event: eventName });
    const existing = myphonerIntegration.getAccountWebhook(eventName);
    const targetChanged = sanitizeText(existing?.targetUrl) !== recordingTargetUrl;
    const eventChanged = sanitizeText(existing?.event).toLowerCase() !== eventName;
    const missingWebhookId = !sanitizeText(existing?.webhookId);
    if (existing && !targetChanged && !eventChanged && !missingWebhookId) {
      summary.reusedAccountWebhooks += 1;
      continue;
    }
    if (existing?.webhookId && targetChanged) {
      await myphonerApi.deleteMyPhonerWebhook(existing.webhookId);
    }
    const createResponse = await myphonerApi.createMyPhonerAccountWebhook({
      targetUrl: recordingTargetUrl,
      event: eventName,
    });
    if (!createResponse.success) {
      if (isMyphonerWebhookAlreadyTakenError(createResponse)) {
        myphonerIntegration.setAccountWebhook(eventName, {
          webhookId: sanitizeText(existing?.webhookId),
          targetUrl: recordingTargetUrl,
          event: eventName,
        });
        summary.reusedAccountWebhooks += 1;
        continue;
      }
      throw makeHttpError(
        createResponse.status === 404 ? 410 : 502,
        createResponse.error || `Failed registering account webhook ${eventName}.`
      );
    }
    myphonerIntegration.setAccountWebhook(eventName, {
      webhookId: myphonerApi.extractWebhookId(createResponse.data),
      targetUrl: recordingTargetUrl,
      event: eventName,
    });
    summary.createdAccountWebhooks += 1;
  }

  // Sync webhook IDs from Myphoner so local registry stays accurate even after
  // "target already taken" reuse paths that previously left webhookId empty.
  const remoteHooksResponse = await myphonerApi.listMyPhonerWebhooks();
  if (remoteHooksResponse.success && Array.isArray(remoteHooksResponse.data)) {
    for (const hook of remoteHooksResponse.data) {
      const eventName = sanitizeText(hook?.event).toLowerCase();
      const targetUrl = sanitizeText(hook?.target_url || hook?.targetUrl);
      const webhookId = sanitizeText(hook?.id || hook?.webhook_id);
      if (!eventName || !targetUrl || !webhookId) continue;
      if (eventName === 'new_recording' || eventName === 'new_call') {
        const expected = buildMyphonerWebhookTargetUrl('recording', { event: eventName });
        if (expected && targetUrl === expected) {
          myphonerIntegration.setAccountWebhook(eventName, {
            webhookId,
            targetUrl,
            event: eventName,
          });
        }
      }
    }
    summary.syncedRemoteWebhooks = remoteHooksResponse.data.length;
  }

  return summary;
}

async function processPendingMyphonerRecordings(options = {}) {
  if (myphonerRecordingRetryRunning) {
    return { ok: true, skipped: 'already-running' };
  }
  myphonerRecordingRetryRunning = true;
  const summary = {
    ok: true,
    checked: 0,
    attached: 0,
    pending: 0,
    exhausted: 0,
    failed: 0,
  };
  try {
    const due = myphonerIntegration.listDuePendingRecordings(
      Number(options.limit) || MYPHONER_RECORDING_PENDING_BATCH
    );
    for (const entry of due) {
      summary.checked += 1;
      const callId = sanitizeText(entry?.callId);
      if (!callId) continue;
      const attempts = Number(entry?.attempts || 0);
      if (attempts >= MYPHONER_RECORDING_RETRY_MAX_ATTEMPTS) {
        myphonerIntegration.clearPendingRecording(callId);
        summary.exhausted += 1;
        const client = findSalesClientForRecordingMeta(
          {
            callId,
            leadId: entry.leadId,
            destinationNumber: entry.destinationNumber,
          },
          entry.leadId
        );
        if (client?.id && !client.myphoner?.latestRecordingUrl) {
          sales.updateSalesClient(client.id, {
            myphoner: {
              ...(client.myphoner || {}),
              latestCallId: callId || client.myphoner?.latestCallId,
              latestRecordingSyncReason: 'recording-retry-exhausted',
            },
          });
        }
        continue;
      }
      const callResponse = await myphonerApi.fetchMyPhonerCallById(callId);
      if (!callResponse.success) {
        myphonerIntegration.bumpPendingRecordingAttempt(callId, {
          delayMs: recordingRetryDelayMs(attempts + 1),
          reason: 'pending-call-fetch-failed',
        });
        summary.failed += 1;
        summary.pending += 1;
        continue;
      }
      const result = await ingestMyphonerCallRecording(callResponse.data || {}, {
        sourceResourceUrl: sanitizeText(entry.sourceResourceUrl || `/api/v2/calls/${callId}`),
        leadId: sanitizeText(entry.leadId),
        syncReason: 'pending-recording-retry-synced',
        pendingReason: 'call-without-recording-url',
      });
      if (result.recordingUrl) {
        summary.attached += 1;
      } else {
        myphonerIntegration.bumpPendingRecordingAttempt(callId, {
          delayMs: recordingRetryDelayMs(attempts + 1),
          reason: result.reason || 'call-without-recording-url',
        });
        summary.pending += 1;
      }
    }
    return summary;
  } finally {
    myphonerRecordingRetryRunning = false;
  }
}

async function runMyphonerWebhookReconcileTick() {
  if (myphonerWebhookReconcileRunning) return;
  myphonerWebhookReconcileRunning = true;
  try {
    const result = await reconcileMyphonerWebhooks();
    if (!result?.ok && result?.skipped) {
      console.log(`[myphoner] webhook reconcile skipped: ${result.skipped}`);
    } else if (result?.ok) {
      console.log(
        `[myphoner] webhook reconcile complete: lists=${result.checkedLists}, created=${result.createdListWebhooks}, reused=${result.reusedListWebhooks}, removed=${result.removedListWebhooks}, accountCreated=${result.createdAccountWebhooks}, accountReused=${result.reusedAccountWebhooks}`
      );
    }
    const pendingResult = await processPendingMyphonerRecordings();
    if (pendingResult?.ok && Number(pendingResult.checked || 0) > 0) {
      console.log(
        `[myphoner] pending recording retry: checked=${pendingResult.checked}, attached=${pendingResult.attached}, pending=${pendingResult.pending}, exhausted=${pendingResult.exhausted}, failed=${pendingResult.failed}`
      );
    }
    if (myphonerSsuWins.isSsuWinsSyncEnabled()) {
      const ssuWinsResult = await myphonerSsuWins.maybeBackfillSsuWinners();
      if (ssuWinsResult?.created || Number(ssuWinsResult?.failed || 0) > 0) {
        console.log(
          `[myphoner ssu-wins] catch-up: created=${Number(ssuWinsResult.created || 0)}, skipped=${Number(ssuWinsResult.skipped || 0)}, failed=${Number(ssuWinsResult.failed || 0)}, winners=${Number(ssuWinsResult.winners || 0)}`
        );
      }
    }
  } catch (error) {
    console.error('[myphoner] webhook reconcile failed:', error?.message || error);
  } finally {
    myphonerWebhookReconcileRunning = false;
  }
}

function startMyphonerWebhookReconcileLoop() {
  if (!MYPHONER_WEBHOOK_RECONCILE_ENABLED) return;
  if (myphonerWebhookReconcileInterval) return;
  void runMyphonerWebhookReconcileTick();
  myphonerWebhookReconcileInterval = setInterval(() => {
    void runMyphonerWebhookReconcileTick();
  }, Math.max(60_000, MYPHONER_WEBHOOK_RECONCILE_MS));
}

async function runMyphonerRecordingRetryTick() {
  try {
    const pendingResult = await processPendingMyphonerRecordings();
    if (pendingResult?.ok && Number(pendingResult.checked || 0) > 0) {
      console.log(
        `[myphoner] recording retry tick: checked=${pendingResult.checked}, attached=${pendingResult.attached}, pending=${pendingResult.pending}, exhausted=${pendingResult.exhausted}, failed=${pendingResult.failed}`
      );
    }
  } catch (error) {
    console.error('[myphoner] recording retry tick failed:', error?.message || error);
  }
}

function startMyphonerRecordingRetryLoop() {
  if (!myphonerApi.isMyPhonerConfigured()) return;
  if (myphonerRecordingRetryInterval) return;
  void runMyphonerRecordingRetryTick();
  myphonerRecordingRetryInterval = setInterval(() => {
    void runMyphonerRecordingRetryTick();
  }, MYPHONER_RECORDING_RETRY_TICK_MS);
}

function joinMakerUrl(baseUrl = '', pathOrUrl = '') {
  const raw = sanitizeText(pathOrUrl);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    // Keep path/query from absolute Maker handoff URLs, but re-base onto the
    // active Website Maker origin when one is provided (tunnel/port rotation).
    try {
      const parsed = new URL(raw);
      const suffix = `${parsed.pathname || ''}${parsed.search || ''}${parsed.hash || ''}`;
      const base = normalizeHttpBaseUrl(baseUrl);
      if (base && suffix && suffix !== '/') return `${base}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
      if (suffix && suffix !== '/') return `${parsed.protocol}//${parsed.host}${suffix}`;
    } catch {
      // Fall through to origin normalization.
    }
    return normalizeHttpBaseUrl(raw);
  }
  const base = normalizeHttpBaseUrl(baseUrl);
  if (!base) return '';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return `${base}${withSlash}`;
}

function normalizeMakerDashboardPath(pathOrUrl = '') {
  const raw = sanitizeText(pathOrUrl);
  if (!raw) return '';

  const toPath = (parsedUrl) => {
    parsedUrl.searchParams.delete('__chunk_retry');
    return `${parsedUrl.pathname || ''}${parsedUrl.search || ''}${parsedUrl.hash || ''}` || '';
  };

  try {
    const parsedAbsolute = new URL(raw);
    return toPath(parsedAbsolute);
  } catch {
    try {
      const parsedRelative = new URL(raw, 'https://asoldi.local');
      return toPath(parsedRelative);
    } catch {
      return raw.startsWith('/') ? raw : `/${raw}`;
    }
  }
}

function parseHandoffNeedsIntake(handoff = {}, dashboardPath = '') {
  const payload = handoff && typeof handoff === 'object' ? handoff : {};
  if (typeof payload.needsIntakeSetup === 'boolean') return payload.needsIntakeSetup;
  const rawNeed = payload.needsIntakeSetup;
  if (rawNeed === true || rawNeed === 1 || /^true|1|yes$/i.test(String(rawNeed || '').trim())) return true;
  if (rawNeed === false || rawNeed === 0 || /^false|0|no$/i.test(String(rawNeed || '').trim())) return false;

  const status = sanitizeText(payload.intakeStatus).toLowerCase();
  if (status === 'configured') return false;
  if (status === 'pending') return true;

  const path = sanitizeText(dashboardPath) || normalizeMakerDashboardPath(payload.dashboardPath);
  if (/\/run-v2(?:\?|$)/i.test(path) && /[?&]draftRunId=/i.test(path)) return true;
  if (/^\/run\//i.test(path)) return false;
  // Unknown: prefer intake for Sales drafts until Maker reports configured.
  return true;
}

function buildMakerRunLinks(websiteMakerBaseUrl, runId, handoff = {}) {
  const encodedRunId = encodeURIComponent(runId);
  const intakePath = sanitizeText(handoff.intakePath) || `/run-v2?draftRunId=${encodedRunId}`;
  const handoffDashboardPath = normalizeMakerDashboardPath(handoff.dashboardPath);
  const wantsIntake = parseHandoffNeedsIntake(handoff, handoffDashboardPath);
  const fallbackDashboardPath = wantsIntake ? intakePath : `/run/${encodedRunId}`;
  const fallbackPreviewPath = `/preview/${encodedRunId}/step/3/view?route=/`;
  const dashboardPath = handoffDashboardPath || fallbackDashboardPath;
  const previewViewPath = sanitizeText(handoff.previewViewPath || handoff.previewPath);
  const exportPath = sanitizeText(handoff.exportPath);
  const links = {
    dashboardUrl: joinMakerUrl(websiteMakerBaseUrl, dashboardPath || fallbackDashboardPath),
    previewUrl: joinMakerUrl(websiteMakerBaseUrl, previewViewPath || fallbackPreviewPath),
    intakeStatus: wantsIntake ? 'pending' : sanitizeText(handoff.intakeStatus) || 'configured',
  };
  const latestReadyStep = sanitizeText(handoff.latestReadyStep);
  const latestStepStatus = sanitizeText(handoff.latestStepStatus);
  const resolvedExportPath = joinMakerUrl(websiteMakerBaseUrl, exportPath);
  if (latestReadyStep) links.latestReadyStep = latestReadyStep;
  if (latestStepStatus) links.latestStepStatus = latestStepStatus;
  if (resolvedExportPath) links.exportPath = resolvedExportPath;
  if (latestReadyStep || latestStepStatus || resolvedExportPath || links.intakeStatus) {
    links.statusUpdatedAt = new Date().toISOString();
  }
  return links;
}

function resolveSalesClientPreviewUrl(salesClientId = '') {
  const clientId = sanitizeText(salesClientId);
  if (!clientId) return '';
  const client = sales.getSalesClientById(clientId);
  return (
    sanitizeText(client?.websiteImport?.publicUrl) ||
    getPublicSalesPreviewUrl(client) ||
    sanitizeText(client?.websiteImport?.previewUrl)
  );
}

function hydrateOfferPreviewFromSalesImport(offer, { persist = false } = {}) {
  const source = offer && typeof offer === 'object' ? offer : null;
  if (!source) return null;
  const currentPreview = sanitizeText(source.previewUrl);
  const linkedPreview =
    resolveSalesClientPreviewUrl(source.salesClientId) ||
    toPublicSalesPreviewUrl(currentPreview, source.salesClientId);
  if (!linkedPreview) return source;
  if (linkedPreview === currentPreview) return source;
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

async function applyImportedWebsiteZip(client, zipBuffer, {
  sourceRunId = '',
  sourceStep = '',
  sourceBaseUrl = '',
  siteFolder = '',
  markPublic = false,
} = {}) {
  const targetClient = client && typeof client === 'object' ? client : null;
  if (!targetClient?.id) {
    throw makeHttpError(404, 'Sales client not found.');
  }
  let zip;
  try {
    zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    if (!entries.length) {
      throw makeHttpError(502, 'Website preview ZIP was empty.');
    }
    for (const entry of entries) {
      if (path.isAbsolute(entry.entryName) || entry.entryName.split(/[\\/]/).includes('..')) {
        throw makeHttpError(502, 'Website preview ZIP contains unsafe file paths.');
      }
    }
  } catch (error) {
    if (error?.status) throw error;
    throw makeHttpError(502, 'Website preview is not a valid ZIP archive.');
  }

  const resolvedSiteFolder = sanitizeSegment(siteFolder || targetClient.businessName || 'site', 'site');
  const importDir = join(SALES_IMPORTS_ROOT, targetClient.id);
  await fs.rm(importDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(importDir, { recursive: true });
  zip.extractAllTo(importDir, true);

  const siteRoot = await resolveImportedSiteRoot(importDir, resolvedSiteFolder);
  if (!siteRoot) {
    await fs.rm(importDir, { recursive: true, force: true }).catch(() => {});
    throw makeHttpError(502, 'Imported ZIP did not contain an index.html site root.');
  }
  try {
    assertImportedPreviewHasAssets(siteRoot, importDir);
  } catch (error) {
    await fs.rm(importDir, { recursive: true, force: true }).catch(() => {});
    throw error?.status ? error : makeHttpError(502, error.message);
  }

  const now = new Date().toISOString();
  const alreadyPublicHost = Boolean(
    String(process.env.APP_URL || '').match(/asoldi\.com/i)
  );
  const publishedNow = Boolean(markPublic || alreadyPublicHost);
  const previewSlug =
    sanitizeText(targetClient.websiteImport?.previewSlug) ||
    salesPreview.allocatePreviewSlug(targetClient, sales.getSalesClients());
  const publicUrl = salesPreview.getPublicSalesPreviewUrl({
    ...targetClient,
    websiteImport: { ...(targetClient.websiteImport || {}), previewSlug },
  });
  const updatedClient = sales.setSalesWebsiteImport(targetClient.id, {
    importedAt: now,
    publishedAt: publishedNow ? now : sanitizeText(targetClient.websiteImport?.publishedAt),
    sourceRunId: sanitizeText(sourceRunId) || sanitizeText(targetClient.makerRun?.runId),
    sourceStep: sanitizeText(sourceStep) || 'latest',
    sourceBaseUrl: sanitizeText(sourceBaseUrl) || publicUrl || getPublicSalesPreviewUrl(targetClient),
    siteFolder: path.basename(siteRoot),
    importRoot: siteRoot,
    previewUrl: salesPreview.getSalesPreviewPath(targetClient.id, previewSlug),
    previewSlug,
    publicUrl,
    publicPreviewPublishedAt: publishedNow
      ? now
      : sanitizeText(targetClient.websiteImport?.publicPreviewPublishedAt),
  });
  if (!updatedClient) {
    throw makeHttpError(404, 'Sales client not found.');
  }
  rewriteOffersToPublicPreview(targetClient.id);
  return updatedClient;
}

async function loginToProdAdmin() {
  const prodBase = resolveProdAdminBaseUrl();
  if (!prodBase) {
    return { prodBase: '', token: '' };
  }
  const username = sanitizeText(process.env.PROD_ADMIN_USERNAME || process.env.ADMIN_USERNAME) || 'asoldi.com';
  // Falls back to the same seeded default as ensureAdminExists so the office
  // Docker can publish previews without extra .env setup.
  const password =
    sanitizeText(process.env.PROD_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD) || 'D@mi@N102020';
  if (!password) {
    throw makeHttpError(503, 'Set PROD_ADMIN_PASSWORD (asoldi.com/admin password) to publish a public preview.');
  }
  const loginRes = await fetch(`${prodBase}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok || !loginBody.token) {
    throw makeHttpError(502, loginBody.message || 'Failed logging into asoldi.com/admin.');
  }
  return { prodBase, token: loginBody.token };
}

async function publishPreviewBundleToProd(client) {
  const targetClient = client && typeof client === 'object' ? client : null;
  if (!targetClient?.id) {
    throw makeHttpError(404, 'Sales client not found.');
  }
  const importDir = join(SALES_IMPORTS_ROOT, targetClient.id);
  if (!existsSync(importDir)) {
    throw makeHttpError(400, 'Sync latest from Maker first so there is a website snapshot to publish.');
  }

  const publicPreviewUrl = getPublicSalesPreviewUrl(targetClient.id);
  const prodBase = resolveProdAdminBaseUrl();
  if (!prodBase) {
    const updated = sales.setSalesWebsiteImport(targetClient.id, {
      ...targetClient.websiteImport,
      previewUrl: getSalesPreviewUrl(targetClient.id),
      publicPreviewPublishedAt: new Date().toISOString(),
    });
    rewriteOffersToPublicPreview(targetClient.id);
    return {
      ok: true,
      alreadyProduction: true,
      publicPreviewUrl,
      client: updated || targetClient,
    };
  }

  const zip = new AdmZip();
  zip.addLocalFolder(importDir);
  const payloadBuffer = zip.toBuffer();
  if (!payloadBuffer?.length) {
    throw makeHttpError(502, 'Could not zip the synced website snapshot.');
  }

  const auth = await loginToProdAdmin();
  const publishRes = await fetch(
    `${auth.prodBase}/api/admin/sales/${encodeURIComponent(targetClient.id)}/receive-preview-bundle`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/zip',
        'X-Source-Run-Id': sanitizeText(targetClient.websiteImport?.sourceRunId || targetClient.makerRun?.runId),
        'X-Source-Step': sanitizeText(targetClient.websiteImport?.sourceStep || 'latest'),
        'X-Site-Folder': sanitizeText(targetClient.websiteImport?.siteFolder || targetClient.businessName || 'site'),
      },
      body: payloadBuffer,
    }
  );
  const publishBody = await publishRes.json().catch(() => ({}));
  if (publishRes.status === 404) {
    throw makeHttpError(
      409,
      publishBody.message === 'Sales client not found.'
        ? 'This client id is not on asoldi.com. Refresh LAN from production, then retry.'
        : 'asoldi.com does not have the public-preview publish endpoint yet. Deploy this Asoldi-website change to production first, then retry.'
    );
  }
  if (!publishRes.ok) {
    throw makeHttpError(
      publishRes.status >= 400 && publishRes.status <= 599 ? publishRes.status : 502,
      publishBody.message || `asoldi.com rejected the public preview (${publishRes.status}).`
    );
  }

  const updated = sales.setSalesWebsiteImport(targetClient.id, {
    publicPreviewPublishedAt: new Date().toISOString(),
    previewUrl: getSalesPreviewUrl(targetClient.id),
  });
  rewriteOffersToPublicPreview(targetClient.id);
  return {
    ok: true,
    alreadyProduction: false,
    publicPreviewUrl,
    client: updated || targetClient,
  };
}

// --- Office auto-publisher -------------------------------------------------
// asoldi.com (HTTPS) can never fetch office LAN Maker (HTTP) from a browser —
// mixed-content blocking. So the office server pushes instead: every few
// minutes it exports each linked Maker run and uploads the ZIP to
// asoldi.com/sales-preview. Runs only where Maker is reachable (office LAN),
// never on Hostinger (resolveProdAdminBaseUrl() is empty there).
const LAN_PREVIEW_AUTOPUBLISH_ENABLED = String(process.env.LAN_PREVIEW_AUTOPUBLISH || '1') !== '0';
const LAN_PREVIEW_AUTOPUBLISH_MS = Math.max(
  60_000,
  Number(process.env.LAN_PREVIEW_AUTOPUBLISH_MS || 5 * 60_000)
);
const LAN_PREVIEW_FULL_REFRESH_MS = Math.max(
  LAN_PREVIEW_AUTOPUBLISH_MS,
  Number(process.env.LAN_PREVIEW_FULL_REFRESH_MS || 30 * 60_000)
);
let lanPreviewAutoPublishRunning = false;
let lanPreviewLastFullRefreshAtMs = 0;
let lanPreviewLastSummary = '';

async function isLocalMakerReachable(makerBase) {
  try {
    await fetch(makerBase, { method: 'GET', signal: AbortSignal.timeout(6_000) });
    return true;
  } catch {
    return false;
  }
}

function isDockerInternalHost(value = '') {
  try {
    return /\.docker\.internal$/i.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

// Docker-for-Windows containers usually cannot reach the host's own LAN IP
// (hairpin NAT), so probe several ways to reach Website Maker and use the
// first one that answers.
async function resolveReachableMakerBase() {
  const candidates = [
    sanitizeText(process.env.LAN_PREVIEW_MAKER_URL),
    resolveWebsiteMakerBaseUrl('', null),
    sanitizeText(process.env.WEBSITE_MAKER_LOCAL_URL),
    'http://host.docker.internal:3000',
    'http://gateway.docker.internal:3000',
    'http://172.17.0.1:3000',
    'http://localhost:3000',
  ];
  const tried = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const origin = normalizeHttpBaseUrl(candidate);
    if (!origin || seen.has(origin)) continue;
    seen.add(origin);
    // Never let the auto-publisher "export" from a public site by accident.
    if (!isPrivateMakerUrl(origin) && !isDockerInternalHost(origin)) continue;
    tried.push(origin);
    if (await isLocalMakerReachable(origin)) {
      return { makerBase: origin, tried };
    }
  }
  return { makerBase: '', tried };
}

/**
 * Website Maker's export ZIP sometimes references hashed assets/... files
 * without packing them. Fetch those from Maker's /asset?id= preview routes
 * and refuse to publish if CSS/JS are still missing.
 */
async function ensureExportBundleHasAssets({ makerBase, runId, exportStep, zipBuffer }) {
  return fillExportZipWithMakerAssets({
    makerBase,
    runId,
    exportStep,
    zipBuffer,
    headers: getWebsiteMakerAuthHeaders(),
  });
}

async function publishOneMakerRunToProd({ prodBase, token, makerBase, clientId, runId, businessName }) {
  const exportUrl = buildMakerExportUrl({
    makerBaseUrl: makerBase,
    runId,
    step: 'latest',
    siteFolder: businessName || 'site',
    clientId,
    // persist=1 asks Maker for the full static bundle (assets included),
    // matching the manual "download Hostinger ZIP" flow.
    persist: true,
  });
  if (!exportUrl) throw new Error('Could not build Maker export URL.');
  const exportRes = await fetch(exportUrl, {
    headers: getWebsiteMakerAuthHeaders(),
    signal: AbortSignal.timeout(180_000),
  });
  const zipBuffer = Buffer.from(await exportRes.arrayBuffer());
  if (!exportRes.ok) {
    throw new Error(parseMakerErrorMessage(zipBuffer, `Maker export failed (${exportRes.status})`));
  }
  const exportStep = sanitizeText(exportRes.headers.get('x-export-step')) || 'latest';
  const bundle = await ensureExportBundleHasAssets({ makerBase, runId, exportStep, zipBuffer });
  const uploadRes = await fetch(
    `${prodBase}/api/admin/sales/${encodeURIComponent(clientId)}/receive-preview-bundle`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/zip',
        'X-Source-Run-Id': runId,
        'X-Source-Step': exportStep,
        'X-Site-Folder': sanitizeText(businessName) || 'site',
      },
      body: bundle.buffer,
      signal: AbortSignal.timeout(300_000),
    }
  );
  const uploadBody = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok) {
    throw new Error(uploadBody.message || `asoldi.com rejected the preview (${uploadRes.status})`);
  }
  const publicUrl = uploadBody.publicPreviewUrl || getPublicSalesPreviewUrl(clientId);
  return `${publicUrl}${bundle.added ? ` (+${bundle.added} assets, ${bundle.note})` : bundle.note ? ` (${bundle.note})` : ''}`;
}

async function runLanPreviewAutoPublishOnce({ fullRefresh = false } = {}) {
  const prodBase = resolveProdAdminBaseUrl();
  if (!prodBase) return { skipped: 'production-host' };
  const { makerBase, tried } = await resolveReachableMakerBase();
  if (!makerBase) return { skipped: `maker-unreachable: tried ${tried.join(', ')}` };

  const auth = await loginToProdAdmin();
  const authHeaders = { Authorization: `Bearer ${auth.token}` };

  const targets = new Map();
  const backfillRes = await fetch(`${prodBase}/api/admin/sales/preview-backfill`, {
    headers: authHeaders,
    signal: AbortSignal.timeout(30_000),
  });
  const backfill = await backfillRes.json().catch(() => ({}));
  if (!backfillRes.ok) {
    throw new Error(backfill.message || `preview-backfill failed (${backfillRes.status})`);
  }
  for (const entry of Array.isArray(backfill.clients) ? backfill.clients : []) {
    const id = sanitizeText(entry?.id);
    const runId = sanitizeText(entry?.runId);
    if (id && runId) targets.set(id, { clientId: id, runId, businessName: sanitizeText(entry?.businessName) });
  }

  const now = Date.now();
  const refreshAll = fullRefresh || now - lanPreviewLastFullRefreshAtMs >= LAN_PREVIEW_FULL_REFRESH_MS;
  if (refreshAll) {
    const allRes = await fetch(`${prodBase}/api/admin/sales?product=asoldi`, {
      headers: authHeaders,
      signal: AbortSignal.timeout(30_000),
    });
    const all = await allRes.json().catch(() => ({}));
    if (allRes.ok) {
      lanPreviewLastFullRefreshAtMs = now;
      for (const client of Array.isArray(all.clients) ? all.clients : []) {
        const id = sanitizeText(client?.id);
        const runId = sanitizeText(client?.makerRun?.runId);
        if (!id || !runId || sales.isSsuSalesProduct(client?.product)) continue;
        if (sanitizeText(client?.status) === 'not-sold') continue;
        targets.set(id, { clientId: id, runId, businessName: sanitizeText(client?.businessName) });
      }
    }
  }

  const published = [];
  const failed = [];
  for (const target of targets.values()) {
    try {
      const url = await publishOneMakerRunToProd({
        prodBase,
        token: auth.token,
        makerBase,
        ...target,
      });
      published.push(`${target.clientId} -> ${url}`);
    } catch (error) {
      failed.push(`${target.clientId}: ${sanitizeText(error?.message) || 'failed'}`);
    }
  }
  return { published, failed, total: targets.size, refreshAll };
}

function startLanPreviewAutoPublishLoop() {
  if (!LAN_PREVIEW_AUTOPUBLISH_ENABLED) return;
  const tick = async () => {
    if (lanPreviewAutoPublishRunning) return;
    lanPreviewAutoPublishRunning = true;
    try {
      const summary = await runLanPreviewAutoPublishOnce();
      const line = summary.skipped
        ? `skipped (${summary.skipped})`
        : `published ${summary.published.length}/${summary.total}${summary.failed.length ? `, failed: ${summary.failed.join(' | ')}` : ''}`;
      if (line !== lanPreviewLastSummary || summary.published?.length || summary.failed?.length) {
        console.log(`[lan-preview] ${line}`);
        lanPreviewLastSummary = line;
      }
    } catch (error) {
      console.error('[lan-preview] cycle failed:', sanitizeText(error?.message) || error);
    } finally {
      lanPreviewAutoPublishRunning = false;
    }
  };
  setTimeout(tick, 15_000);
  setInterval(tick, LAN_PREVIEW_AUTOPUBLISH_MS);
}

async function syncSalesClientFromMakerRun({
  client,
  runId = '',
  step = 'latest',
  siteFolder = '',
  baseUrl = '',
  websiteMakerBaseUrl = '',
  publicHost = false,
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
  const sourceBaseUrl = sanitizeText(baseUrl) || getPublicSalesPreviewUrl(targetClient);
  const makerBaseUrl = resolveWebsiteMakerBaseUrl(websiteMakerBaseUrl, targetClient);
  if (!makerBaseUrl) {
    throw makeHttpError(400, 'Website Maker URL is invalid. Use a valid host or URL (for example https://example.com).');
  }

  const exportUrl =
    buildMakerExportUrl({
      makerBaseUrl,
      runId: resolvedRunId,
      step: requestedStep,
      siteFolder: resolvedSiteFolder,
      clientId: targetClient.id,
      persist: true,
    }) ||
    `${makerBaseUrl}/api/runs/${encodeURIComponent(resolvedRunId)}/export?step=${encodeURIComponent(requestedStep)}&baseUrl=${encodeURIComponent(sourceBaseUrl)}&siteFolder=${encodeURIComponent(resolvedSiteFolder)}&persist=1`;

  // Hostinger cannot fetch office-LAN Maker. Return a browser handoff so Sales
  // can pull the ZIP on home Wi-Fi and POST it to asoldi.com.
  if (isPrivateMakerUrl(makerBaseUrl) && publicHost) {
    return {
      browserExportHandoff: true,
      runId: resolvedRunId,
      sourceStep: requestedStep,
      websiteMakerBaseUrl: makerBaseUrl,
      exportUrl,
      uploadUrl: buildPreviewBundleUploadUrl(targetClient.id, PUBLIC_SALES_ORIGIN),
      lanBridgeOrigin: lanAsoldiOriginFromMakerUrl(makerBaseUrl),
      headers: {
        'X-Source-Run-Id': resolvedRunId,
        'X-Source-Step': requestedStep,
        'X-Site-Folder': resolvedSiteFolder,
      },
      publicPreviewUrl: getPublicSalesPreviewUrl(targetClient),
      siteFolder: resolvedSiteFolder,
      client: targetClient,
    };
  }

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

  const exportStep = sanitizeText(response.headers.get('x-export-step')) || requestedStep;
  const filled = await ensureExportBundleHasAssets({
    makerBase: makerBaseUrl,
    runId: resolvedRunId,
    exportStep,
    zipBuffer: payloadBuffer,
  });
  const payloadToImport = filled?.buffer?.length ? filled.buffer : payloadBuffer;

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

  const updatedClient = await applyImportedWebsiteZip(targetClient, payloadToImport, {
    sourceRunId: resolvedRunId,
    sourceStep: exportStep,
    sourceBaseUrl,
    siteFolder: resolvedSiteFolder,
    markPublic: !resolveProdAdminBaseUrl(),
  });

  return {
    runId: resolvedRunId,
    sourceStep: exportStep,
    sourceExportUrl: exportUrl,
    websiteMakerBaseUrl: makerBaseUrl,
    publicUrl: getPublicSalesPreviewUrl(updatedClient),
    zipBuffer: payloadToImport,
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

async function accountKeyToEmail(accountKey = '') {
  const key = sanitizeText(accountKey);
  if (!key) return '';
  if (key.startsWith('admin:')) return normalizeEmail(key.slice('admin:'.length));
  if (key.startsWith('sales:')) {
    const userId = key.slice('sales:'.length);
    try {
      const user = await store.getUserById(userId);
      return normalizeEmail(user?.username);
    } catch {
      return '';
    }
  }
  return '';
}

/** Admin + sales account keys that belong to the same email inbox. */
async function resolveSiblingCalendarAccountKeys(accountKey = '') {
  const key = sanitizeText(accountKey);
  if (!key) return [];
  const email = await accountKeyToEmail(key);
  if (!email) return [];

  const keys = new Set();
  keys.add(`admin:${email}`);
  try {
    const admin = await store.getAdmin();
    if (admin?.username && normalizeEmail(admin.username) === email) {
      keys.add(`admin:${sanitizeText(admin.username)}`);
    }
  } catch {
    // Ignore admin lookup failures; still share with other known keys.
  }

  try {
    const users = await store.getAllUsers();
    for (const user of Array.isArray(users) ? users : []) {
      if (normalizeEmail(user?.username) !== email) continue;
      const userId = sanitizeText(user?.id);
      if (userId) keys.add(`sales:${userId}`);
    }
  } catch {
    // Ignore user lookup failures.
  }

  keys.delete(key);
  return [...keys];
}

async function ensureSharedCalendarTokens(accountKey = '') {
  const key = sanitizeText(accountKey);
  if (!key) return getGoogleCalendarStatus(key);
  const status = getGoogleCalendarStatus(key);
  if (!status.connected) return status;
  const siblings = await resolveSiblingCalendarAccountKeys(key);
  if (siblings.length) shareGoogleCalendarToken(key, siblings);
  return getGoogleCalendarStatus(key);
}

async function resolveCalendarFallbackAccountKeys(ownerId = '', actorAccountKey = '') {
  const keys = new Set();
  const owner = sanitizeText(ownerId);
  const actor = sanitizeText(actorAccountKey);
  if (actor) keys.add(actor);
  if (owner) {
    for (const sibling of await resolveSiblingCalendarAccountKeys(owner)) keys.add(sibling);
  }
  if (actor) {
    for (const sibling of await resolveSiblingCalendarAccountKeys(actor)) keys.add(sibling);
  }
  const configuredOwner = sanitizeText(MYPHONER_DEFAULT_SALES_OWNER_KEY);
  if (configuredOwner) keys.add(configuredOwner);
  keys.delete(owner);
  return [...keys];
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

async function maybeSyncCalendar(client, previousClient = null, options = {}) {
  const notifyAttendees = Boolean(options?.notifyAttendees);
  const requireMeetLink = Boolean(options?.requireMeetLink);
  const actorAccountKey = sanitizeText(options?.actorAccountKey);
  const warnings = [];
  let nextClient = client;
  let calendarInviteSent = false;

  const previousAccountKey = sanitizeText(
    previousClient?.calendar?.accountKey || nextClient?.calendar?.accountKey
  );
  const fallbackAccountKeys = Array.isArray(options?.fallbackAccountKeys)
    ? options.fallbackAccountKeys
    : await resolveCalendarFallbackAccountKeys(nextClient?.ownerId || '', actorAccountKey);

  // Heal admin/sales token split for the same email before resolving.
  for (const key of [previousAccountKey, nextClient?.ownerId, actorAccountKey, ...fallbackAccountKeys]) {
    const candidate = sanitizeText(key);
    if (!candidate) continue;
    if (getGoogleCalendarStatus(candidate).connected) {
      await ensureSharedCalendarTokens(candidate);
      break;
    }
  }

  const accountKey = resolveCalendarSyncAccountKey({
    ownerId: nextClient?.ownerId || '',
    actorAccountKey,
    fallbackAccountKeys,
    previousAccountKey,
  });
  const deleteAccountKey = previousAccountKey || accountKey;
  const isOnline = normalizeMeetingMode(nextClient?.meetingMode) === 'online';

  if (!nextClient.agreedTime || !nextClient.meetingAt) {
    if (nextClient.calendar?.eventId) {
      try {
        await deleteMeetingEvent(nextClient.calendar.eventId, deleteAccountKey);
      } catch (error) {
        warnings.push(`Calendar cleanup failed: ${error.message}`);
      }
    }
    const cleared = sales.clearSalesMeetingScheduling(nextClient.id);
    return { client: cleared || nextClient, warnings, calendarInviteSent };
  }

  const rescheduled = sales.rescheduleSalesReminders(nextClient.id);
  nextClient = rescheduled || nextClient;

  const calendarStatus = getGoogleCalendarStatus(accountKey);
  if (calendarStatus.configured && calendarStatus.connected) {
    try {
      const currentEventId = sanitizeText(previousClient?.calendar?.eventId || nextClient?.calendar?.eventId);
      let eventIdForUpsert = currentEventId;
      const hasRealMeet = isRealGoogleMeetLink(nextClient?.calendar?.meetLink);
      // Fresh event when we must guarantee a real Meet link and the current one is missing/fake.
      if (
        isOnline
        && currentEventId
        && (notifyAttendees || (requireMeetLink && !hasRealMeet))
      ) {
        try {
          await deleteMeetingEvent(currentEventId, deleteAccountKey);
          eventIdForUpsert = '';
        } catch (deleteError) {
          warnings.push(`Calendar pre-invite cleanup failed: ${deleteError.message}`);
        }
      }
      // If the event lived on a different connected account, recreate instead of
      // updating with a token that cannot see the old event id.
      if (
        eventIdForUpsert &&
        previousAccountKey &&
        previousAccountKey !== accountKey
      ) {
        try {
          await deleteMeetingEvent(eventIdForUpsert, previousAccountKey);
        } catch {
          // Best-effort cleanup; insert will still create a fresh event.
        }
        eventIdForUpsert = '';
      }
      const calendarMeta = await upsertMeetingEvent(
        nextClient,
        eventIdForUpsert,
        accountKey,
        {
          sendUpdates: notifyAttendees ? 'all' : 'none',
          forceConference: isOnline && (requireMeetLink || !hasRealMeet),
        }
      );
      const withCalendar = sales.setSalesCalendar(nextClient.id, calendarMeta);
      if (withCalendar) nextClient = withCalendar;
      calendarInviteSent = notifyAttendees;
      if (
        sanitizeText(nextClient?.ownerId) &&
        accountKey !== sanitizeText(nextClient.ownerId)
      ) {
        warnings.push(
          `Synced to your connected Google Calendar (${accountKey}) because the client owner calendar (${nextClient.ownerId}) is not connected.`
        );
      }
      if (requireMeetLink && isOnline && !isRealGoogleMeetLink(nextClient?.calendar?.meetLink)) {
        warnings.push('Google Calendar sync ran but did not return a real Google Meet link.');
      }
    } catch (error) {
      warnings.push(`Calendar sync failed: ${error.message}`);
    }
  } else if (calendarStatus.configured && !calendarStatus.connected) {
    warnings.push('Google Calendar is not connected for this salesperson yet. Connect it from the Sales page.');
  } else if (!calendarStatus.configured) {
    warnings.push('Google Calendar is not configured on the server.');
  }

  return { client: nextClient, warnings, calendarInviteSent };
}

async function backfillMissingSalesCalendarEvents({
  dryRun = true,
  limit = 0,
  actorAccountKey = '',
  productFilter = '',
} = {}) {
  const allClients = sales.getSalesClients();
  const productScoped = productFilter
    ? allClients.filter((client) => sales.normalizeSalesProduct(client.product) === productFilter)
    : allClients;
  const scopedClients = Number(limit) > 0
    ? productScoped.slice(0, Math.max(1, Math.trunc(Number(limit))))
    : productScoped;
  const summary = {
    scanned: scopedClients.length,
    scheduled: 0,
    missingEvent: 0,
    updated: 0,
    wouldUpdate: 0,
    unresolved: 0,
    warnings: 0,
    warningReasons: {},
    skippedHasEvent: 0,
    skippedNoSchedule: 0,
  };
  const details = [];
  const registerWarningReason = (warning = '') => {
    const key = sanitizeText(warning);
    if (!key) return;
    summary.warningReasons[key] = Number(summary.warningReasons[key] || 0) + 1;
  };

  for (const client of scopedClients) {
    const hasSchedule = Boolean(client?.agreedTime && client?.meetingAt);
    if (!hasSchedule) {
      summary.skippedNoSchedule += 1;
      continue;
    }
    summary.scheduled += 1;
    const hasEvent = Boolean(sanitizeText(client?.calendar?.eventId));
    if (hasEvent) {
      summary.skippedHasEvent += 1;
      continue;
    }
    summary.missingEvent += 1;
    if (dryRun) {
      summary.wouldUpdate += 1;
      details.push({
        clientId: sanitizeText(client?.id),
        businessName: sanitizeText(client?.businessName),
        meetingAt: sanitizeText(client?.meetingAt),
        status: 'would-sync',
      });
      continue;
    }

    const syncResult = await maybeSyncCalendar(client, client, {
      notifyAttendees: false,
      actorAccountKey,
      fallbackAccountKeys: await resolveCalendarFallbackAccountKeys(client?.ownerId || '', actorAccountKey),
    });
    const syncedClient = syncResult.client || client;
    const warnings = Array.isArray(syncResult.warnings) ? syncResult.warnings : [];
    summary.warnings += warnings.length;
    for (const warning of warnings) registerWarningReason(warning);
    const hasSyncedEvent = Boolean(sanitizeText(syncedClient?.calendar?.eventId));
    if (hasSyncedEvent) summary.updated += 1;
    else summary.unresolved += 1;
    details.push({
      clientId: sanitizeText(client?.id),
      businessName: sanitizeText(client?.businessName),
      meetingAt: sanitizeText(client?.meetingAt),
      status: hasSyncedEvent ? 'synced' : 'unresolved',
      warnings,
    });
  }

  return {
    summary,
    details,
  };
}

async function sendSalesThankYou(client, { force = false } = {}) {
  if (!client?.agreedTime || !client?.meetingAt) return { sent: false, reason: 'meeting-not-scheduled' };
  if (!client?.contactEmail) return { sent: false, reason: 'missing-email' };
  if (!force && client?.reminders?.thankYouSentAt) return { sent: false, reason: 'already-sent' };
  if (!emailLib.canSendEmail()) return { sent: false, reason: 'smtp-not-configured' };
  if (
    normalizeMeetingMode(client?.meetingMode) === 'online'
    && !isRealGoogleMeetLink(client?.calendar?.meetLink)
  ) {
    return { sent: false, reason: 'missing-meet-link' };
  }
  // Always send the Asoldi template over SMTP. Online meetings include an .ics
  // attachment clients can Accept — Google Calendar notify emails are not a substitute.
  const message = buildSalesThankYouEmail(client, client.calendar || {});
  const meetLink = sanitizeText(client?.calendar?.meetLink);
  await emailLib.sendEmail({
    to: client.contactEmail,
    bcc: salesEmailCopyBcc(client.contactEmail),
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments,
    headers: message.headers,
    icalEvent: message.icalEvent,
  });
  const updated = sales.markSalesReminderSent(client.id, 'thankYou');
  return {
    sent: true,
    client: updated || client,
    channel: 'email',
    meetLink,
    copyTo: salesEmailCopyBcc(client.contactEmail),
  };
}

async function sendSalesReminderNow(client, kind = '24h') {
  if (!client?.agreedTime || !client?.meetingAt) return { sent: false, reason: 'meeting-not-scheduled' };
  if (!client?.contactEmail) return { sent: false, reason: 'missing-email' };
  if (!emailLib.canSendEmail()) return { sent: false, reason: 'smtp-not-configured' };
  const reminderKind = kind === '1h' ? '1h' : '24h';
  const message = buildSalesReminderEmail(client, client.calendar || {}, reminderKind);
  const meetLink = sanitizeText(client?.calendar?.meetLink);
  await emailLib.sendEmail({
    to: client.contactEmail,
    bcc: salesEmailCopyBcc(client.contactEmail),
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  const updated = sales.markSalesReminderSent(client.id, reminderKind);
  return {
    sent: true,
    client: updated || client,
    kind: reminderKind,
    meetLink,
    copyTo: salesEmailCopyBcc(client.contactEmail),
  };
}

function resolveSalesCopyRecipients() {
  const configured = sanitizeText(process.env.SALES_EMAIL_COPY_TO || process.env.SMTP_BCC);
  const defaults = ['daracha777@gmail.com'];
  const merged = `${configured},${defaults.join(',')}`
    .split(',')
    .map((value) => sanitizeText(value).toLowerCase())
    .filter(Boolean);
  return [...new Set(merged)];
}

function salesEmailCopyBcc(clientEmail = '') {
  const client = sanitizeText(clientEmail).toLowerCase();
  return resolveSalesCopyRecipients()
    .filter((email) => email !== client)
    .join(', ');
}

function salesEmailFailureMessage(reason = '') {
  if (reason === 'meeting-not-scheduled') return 'Meeting date/time must be set before sending this email.';
  if (reason === 'missing-email') return 'Client contact email is missing.';
  if (reason === 'smtp-not-configured') {
    return 'SMTP is not configured on the server (set SMTP_HOST, SMTP_USER, SMTP_PASS).';
  }
  if (reason === 'already-sent') return 'Email was already sent.';
  if (reason === 'missing-meet-link') {
    return 'Online meeting has no real Google Meet link yet. Connect Google Calendar on Sales, then send again.';
  }
  return 'Could not send email.';
}

function formatSmtpSendError(error) {
  const raw = String(error?.message || error || '').trim();
  const lower = raw.toLowerCase();
  if (lower.includes('535') || lower.includes('authentication failed') || lower.includes('invalid login')) {
    return (
      'SMTP login failed (535). Check production SMTP_USER/SMTP_PASS for contact@asoldi.com '
      + '(no extra quotes/spaces), then restart the app. '
      + (raw ? `Details: ${raw}` : '')
    ).trim();
  }
  if (lower.includes('disabled by user from hpanel')) {
    return 'SMTP sending is disabled in Hostinger hPanel for this mailbox. Enable outgoing email, then retry.';
  }
  return raw || 'Failed sending welcome email.';
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
          bcc: salesEmailCopyBcc(client.contactEmail),
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
          bcc: salesEmailCopyBcc(client.contactEmail),
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

// Faktura requests from the client checkout are stored in client portal profiles.
// Expose active requests so Admin can process them even before Luca is connected.
app.get('/api/admin/client-payment-requests', adminAuth, async (_req, res) => {
  const users = await store.getAllUsers();
  const userMap = new Map(users.map((entry) => [entry.id, entry]));
  const requests = clientPortal
    .listClientProfiles()
    .filter((profile) => sanitizeText(profile?.payment?.status) === 'invoice_requested')
    .map((profile) => {
      const user = userMap.get(profile.userId);
      const invoiceRequest = profile?.payment?.invoiceRequest && typeof profile.payment.invoiceRequest === 'object'
        ? profile.payment.invoiceRequest
        : {};
      return {
        userId: sanitizeText(profile.userId),
        email: sanitizeText(profile.email || user?.username).toLowerCase(),
        clientName: sanitizeText(profile.name),
        businessName: sanitizeText(invoiceRequest.businessName || profile.businessName),
        planName: sanitizeText(profile?.payment?.planName || profile?.websiteBuilder?.selectedPlanName),
        paymentStatus: sanitizeText(profile?.payment?.status),
        paymentMethod: sanitizeText(profile?.payment?.method),
        requestedAt: sanitizeText(invoiceRequest.requestedAt || profile?.payment?.updatedAt),
        updatedAt: sanitizeText(profile?.payment?.updatedAt),
        invoiceRequest: {
          orgNumber: sanitizeText(invoiceRequest.orgNumber),
          businessName: sanitizeText(invoiceRequest.businessName || profile.businessName),
          invoiceEmail: sanitizeText(invoiceRequest.invoiceEmail || profile.email).toLowerCase(),
          requestedAt: sanitizeText(invoiceRequest.requestedAt || profile?.payment?.updatedAt),
        },
      };
    })
    .sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
  res.json({ requests });
});

app.post('/api/admin/client-payment-requests/:userId/mark-handled', adminAuth, async (req, res) => {
  const userId = sanitizeText(req.params.userId);
  if (!userId) {
    return res.status(400).json({ message: 'Missing userId.' });
  }
  const profile = clientPortal.getClientProfileByUserId(userId);
  if (!profile) {
    return res.status(404).json({ message: 'Client profile not found.' });
  }
  const currentStatus = sanitizeText(profile?.payment?.status);
  if (currentStatus !== 'invoice_requested') {
    return res.status(400).json({ message: 'No pending faktura request for this client.' });
  }
  const updated = clientPortal.setClientPayment(userId, {
    status: 'processing',
    method: 'faktura',
  });
  return res.json({
    ok: true,
    userId,
    paymentStatus: sanitizeText(updated?.payment?.status) || 'processing',
  });
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

app.post('/api/admin/integrations/myphoner/reconcile', adminAuth, async (_req, res) => {
  try {
    const result = await reconcileMyphonerWebhooks();
    if (!result?.ok && result?.skipped) {
      return res.status(400).json({ ok: false, message: `Reconcile skipped: ${result.skipped}` });
    }
    return res.json({ ok: true, result });
  } catch (error) {
    return res.status(httpStatusFromError(error, 500)).json({
      ok: false,
      message: sanitizeText(error?.message) || 'Failed to reconcile Myphoner webhooks.',
    });
  }
});

app.post('/api/admin/integrations/myphoner/ssu-wins-backfill', adminAuth, async (req, res) => {
  try {
    const force = parseBoolean(req.body?.force, true);
    const result = await myphonerSsuWins.backfillSsuWinnersToWinsList({ force });
    if (!result?.ok && result?.error) {
      return res.status(502).json({ ok: false, message: result.error, result });
    }
    return res.json({ ok: true, result });
  } catch (error) {
    return res.status(httpStatusFromError(error, 500)).json({
      ok: false,
      message: sanitizeText(error?.message) || 'Failed to backfill SSU winners into SSU wins.',
    });
  }
});

app.post('/api/admin/integrations/myphoner/attach-recording', adminAuth, (req, res) => {
  const clientId = sanitizeText(req.body?.clientId);
  const leadId = sanitizeText(req.body?.leadId);
  const inputUrl = sanitizeText(req.body?.recordingUrl || req.body?.url);
  if (!clientId && !leadId) {
    return res.status(400).json({ ok: false, message: 'clientId or leadId is required.' });
  }
  if (!inputUrl) {
    return res.status(400).json({ ok: false, message: 'recordingUrl is required.' });
  }
  const baseUrl = normalizeHttpBaseUrl(process.env.APP_URL || `${req.protocol}://${req.get('host')}`);
  const recordingUrl = inputUrl.startsWith('/') ? `${baseUrl}${inputUrl}` : inputUrl;
  if (!/^https?:\/\//i.test(recordingUrl)) {
    return res.status(400).json({ ok: false, message: 'recordingUrl must be an absolute http(s) URL or root-relative path.' });
  }

  const existing = clientId
    ? sales.getSalesClientById(clientId)
    : sales.getSalesClientByMyphonerLeadId(leadId);
  if (!existing) {
    return res.status(404).json({ ok: false, message: 'Sales client not found for provided clientId/leadId.' });
  }

  const callDurationSeconds = Number(req.body?.callDurationSeconds);
  const updated = sales.updateSalesClient(existing.id, {
    myphoner: {
      latestRecordingUrl: recordingUrl,
      latestCallId: sanitizeText(req.body?.callId || existing?.myphoner?.latestCallId),
      latestCallStartedAt: sanitizeText(req.body?.callStartedAt || existing?.myphoner?.latestCallStartedAt),
      latestCallUserEmail: sanitizeText(req.body?.callUserEmail || existing?.myphoner?.latestCallUserEmail),
      latestCallDestinationNumber: sanitizeText(
        req.body?.callDestinationNumber || req.body?.destinationNumber || existing?.myphoner?.latestCallDestinationNumber
      ),
      latestCallDurationSeconds: Number.isFinite(callDurationSeconds)
        ? callDurationSeconds
        : Number(existing?.myphoner?.latestCallDurationSeconds || 0),
      latestRecordingSyncReason: 'manual-recording-attach',
      lastRecordingWebhookAt: nowIso(),
      latestEventAt: nowIso(),
    },
  });
  if (!updated) {
    return res.status(404).json({ ok: false, message: 'Sales client not found.' });
  }
  return res.json({ ok: true, client: updated });
});

app.post('/api/admin/sales/sync-local-recordings', adminAuth, async (req, res) => {
  try {
    const baseUrl = normalizeHttpBaseUrl(process.env.APP_URL || `${req.protocol}://${req.get('host')}`);
    if (!baseUrl) {
      return res.status(400).json({ ok: false, message: 'APP_URL (or request host) must be a valid http(s) URL.' });
    }
    const dryRun = Boolean(req.body?.dryRun);
    const fillMissingOnly = parseBoolean(req.body?.fillMissingOnly, false);
    const result = await syncLocalMyphonerRecordings({
      baseUrl,
      persist: !dryRun,
      fillMissingOnly,
    });
    return res.json({
      ok: true,
      dryRun,
      fillMissingOnly,
      ...result,
    });
  } catch (error) {
    return res.status(httpStatusFromError(error, 500)).json({
      ok: false,
      message: sanitizeText(error?.message) || 'Failed syncing local recordings.',
    });
  }
});

app.post('/api/admin/integrations/myphoner/retry-recordings', adminAuth, async (req, res) => {
  try {
    const enqueueMissing = parseBoolean(req.body?.enqueueMissing, true);
    const summary = {
      ok: true,
      enqueued: 0,
      skippedHasRecording: 0,
      skippedNoCallId: 0,
      attachedFromCache: 0,
      pendingRetry: null,
    };
    if (enqueueMissing) {
      for (const client of sales.getSalesClients()) {
        if (sanitizeText(client?.myphoner?.latestRecordingUrl)) {
          summary.skippedHasRecording += 1;
          continue;
        }
        const cachedAttach = await attachCachedOrPendingRecordingToClient(client, {
          syncReason: 'admin-retry-cache-attached',
        });
        if (cachedAttach.attached) {
          summary.attachedFromCache += 1;
          continue;
        }
        const callId = sanitizeText(client?.myphoner?.latestCallId || cachedAttach.callId);
        if (!callId) {
          summary.skippedNoCallId += 1;
          continue;
        }
        myphonerIntegration.enqueuePendingRecording(
          {
            callId,
            leadId: sanitizeText(client?.myphoner?.leadId),
            destinationNumber: sanitizeText(client?.contactPhone || client?.myphoner?.latestCallDestinationNumber),
            reason: 'admin-retry-enqueued',
          },
          { delayMs: 1_000, resetAttempts: true }
        );
        summary.enqueued += 1;
      }
    }
    summary.pendingRetry = await processPendingMyphonerRecordings({
      limit: Math.max(MYPHONER_RECORDING_PENDING_BATCH, Number(req.body?.limit) || 50),
    });
    return res.json(summary);
  } catch (error) {
    return res.status(httpStatusFromError(error, 500)).json({
      ok: false,
      message: sanitizeText(error?.message) || 'Failed retrying Myphoner recordings.',
    });
  }
});

app.post('/api/integrations/myphoner/webhook/winner', async (req, res) => {
  return handleMyphonerWebhookEvent(req, res, 'winner');
});

app.post('/api/integrations/myphoner/webhook/recording', async (req, res) => {
  return handleMyphonerWebhookEvent(req, res, 'recording');
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

app.get('/api/client/settings', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  const profile = clientPortal.ensureClientProfileForUser(user);
  const billing = await buildClientBillingOverview(profile);
  return res.json({
    profile,
    clientDataBank: profile?.clientDataBank || null,
    billing,
  });
});

app.put('/api/client/settings/client-data', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  const payload = req.body?.clientDataBank && typeof req.body.clientDataBank === 'object'
    ? req.body.clientDataBank
    : (req.body && typeof req.body === 'object' ? req.body : {});
  let profile = clientPortal.setClientDataBank(user.id, payload);
  const bank = profile?.clientDataBank && typeof profile.clientDataBank === 'object' ? profile.clientDataBank : {};
  profile = clientPortal.upsertClientProfile(user.id, {
    businessName: sanitizeText(
      bank?.generalInfo?.companyName
      || bank?.businessCard?.companyName
      || profile?.businessName
    ),
    businessOrgNumber: sanitizeText(bank?.brandIdentity?.orgNumber || profile?.businessOrgNumber),
    clientDataBank: bank,
  }, { syncPortalState: false });
  return res.json({ profile, clientDataBank: profile?.clientDataBank || null });
});

app.get('/api/client/billing/overview', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  const profile = clientPortal.ensureClientProfileForUser(user);
  const billing = await buildClientBillingOverview(profile);
  return res.json({ billing });
});

app.post('/api/client/billing/portal-session', clientAuth, async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ message: 'Stripe er ikke konfigurert for fakturaportalen ennå.' });
  }
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  const profile = clientPortal.ensureClientProfileForUser(user);
  const customerId = sanitizeText(profile?.payment?.stripeCustomerId);
  if (!customerId) {
    return res.status(400).json({ message: 'Ingen Stripe-kunde koblet til kontoen enda.' });
  }
  try {
    const stripe = getStripe();
    const baseUrl = resolveRequestBaseUrl(req) || normalizeHttpBaseUrl(process.env.APP_URL || '');
    const returnUrl = `${(baseUrl || 'https://asoldi.com').replace(/\/$/, '')}/kunde/innstillinger/fakturering`;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return res.json({ url: sanitizeText(session.url) });
  } catch (error) {
    return res.status(500).json({ message: error?.message || 'Kunne ikke åpne Stripe fakturaportal.' });
  }
});

app.post('/api/client/billing/upgrade-subscription', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  const planId = sanitizeText(req.body?.planId);
  const targetPlan = findWebsitePlan(planId);
  if (!targetPlan) {
    return res.status(400).json({ message: 'Ugyldig abonnementsnivå.' });
  }

  const selectedProfile = clientPortal.setClientSelectedWebsitePlan(user.id, {
    id: targetPlan.id,
    name: targetPlan.name,
    price: targetPlan.price,
    type: 'standard',
  });
  const subscriptionId = sanitizeText(selectedProfile?.payment?.stripeSubscriptionId);
  const stripePriceId = sanitizeText(priceIdForPlan(targetPlan.id));

  if (!isStripeConfigured() || !subscriptionId || !stripePriceId) {
    const refreshed = clientPortal.setClientPayment(user.id, {
      planId: targetPlan.id,
      planName: targetPlan.name,
      amount: parsePlanAmount(targetPlan.price),
      currency: getStripeCurrency(),
    });
    return res.json({
      ok: true,
      mode: 'checkout',
      redirect: '/kunde/tjenester/nettside/checkout',
      message: 'Planen er oppdatert. Fullfør oppgraderingen i checkout.',
      profile: refreshed,
    });
  }

  try {
    const stripe = getStripe();
    const existing = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price'],
    });
    const itemId = sanitizeText(existing?.items?.data?.[0]?.id);
    if (!itemId) {
      return res.status(409).json({ message: 'Fant ingen aktiv abonnementslinje å oppgradere.' });
    }
    const updated = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
      proration_behavior: 'create_prorations',
      items: [{ id: itemId, price: stripePriceId }],
    });
    clientPortal.setClientPayment(user.id, {
      status: sanitizeText(updated.status) || 'active',
      method: 'card',
      planId: targetPlan.id,
      planName: targetPlan.name,
      amount: parsePlanAmount(targetPlan.price),
      currency: getStripeCurrency(),
      stripeSubscriptionId: sanitizeText(updated.id),
      stripeCustomerId: sanitizeText(updated.customer),
      cancelAtPeriodEnd: Boolean(updated.cancel_at_period_end),
      currentPeriodEnd: unixToIso(updated.current_period_end),
      cancelAt: unixToIso(updated.cancel_at),
      canceledAt: unixToIso(updated.canceled_at),
    });
    const profile = clientPortal.ensureClientProfileForUser(user);
    const billing = await buildClientBillingOverview(profile);
    return res.json({
      ok: true,
      mode: 'stripe',
      message: 'Abonnementet er oppgradert.',
      billing,
    });
  } catch (error) {
    return res.status(502).json({ message: error?.message || 'Kunne ikke oppgradere abonnementet via Stripe.' });
  }
});

app.post('/api/client/billing/cancel-subscription', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  const immediate = parseBoolean(req.body?.immediate, false);
  const profile = clientPortal.ensureClientProfileForUser(user);
  const subscriptionId = sanitizeText(profile?.payment?.stripeSubscriptionId);

  if (!subscriptionId || !isStripeConfigured()) {
    clientPortal.setClientPayment(user.id, {
      status: 'canceled',
      cancelAtPeriodEnd: false,
      canceledAt: nowIso(),
    });
    const refreshed = clientPortal.ensureClientProfileForUser(user);
    const billing = await buildClientBillingOverview(refreshed);
    return res.json({
      ok: true,
      message: 'Abonnementet er avsluttet lokalt.',
      billing,
    });
  }

  try {
    const stripe = getStripe();
    const updated = immediate
      ? await stripe.subscriptions.cancel(subscriptionId)
      : await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    clientPortal.setClientPayment(user.id, {
      status: immediate ? 'canceled' : (sanitizeText(updated.status) || 'active'),
      cancelAtPeriodEnd: immediate ? false : Boolean(updated.cancel_at_period_end),
      currentPeriodEnd: unixToIso(updated.current_period_end),
      cancelAt: unixToIso(updated.cancel_at),
      canceledAt: immediate ? nowIso() : unixToIso(updated.canceled_at),
    });
    const refreshed = clientPortal.ensureClientProfileForUser(user);
    const billing = await buildClientBillingOverview(refreshed);
    return res.json({
      ok: true,
      message: immediate
        ? 'Abonnementet er avsluttet umiddelbart.'
        : 'Abonnementet avsluttes ved periodens slutt.',
      billing,
    });
  } catch (error) {
    return res.status(502).json({ message: error?.message || 'Kunne ikke avslutte abonnementet.' });
  }
});

app.post('/api/client/billing/resume-subscription', clientAuth, async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ message: 'Stripe er ikke konfigurert for gjenopptak.' });
  }
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  const profile = clientPortal.ensureClientProfileForUser(user);
  const subscriptionId = sanitizeText(profile?.payment?.stripeSubscriptionId);
  if (!subscriptionId) {
    return res.status(400).json({ message: 'Fant ikke et aktivt Stripe-abonnement.' });
  }
  try {
    const updated = await getStripe().subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
    clientPortal.setClientPayment(user.id, {
      status: sanitizeText(updated.status) || 'active',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: unixToIso(updated.current_period_end),
      cancelAt: '',
      canceledAt: '',
    });
    const refreshed = clientPortal.ensureClientProfileForUser(user);
    const billing = await buildClientBillingOverview(refreshed);
    return res.json({
      ok: true,
      message: 'Abonnementet fortsetter som normalt.',
      billing,
    });
  } catch (error) {
    return res.status(502).json({ message: error?.message || 'Kunne ikke gjenoppta abonnementet.' });
  }
});

app.post('/api/client/account/delete', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  const confirmText = sanitizeText(req.body?.confirmText).toUpperCase();
  if (confirmText !== 'SLETT') {
    return res.status(400).json({ message: 'Skriv "SLETT" for å bekrefte.' });
  }

  const profile = clientPortal.ensureClientProfileForUser(user);
  const subscriptionId = sanitizeText(profile?.payment?.stripeSubscriptionId);
  if (subscriptionId && isStripeConfigured()) {
    try {
      await getStripe().subscriptions.cancel(subscriptionId);
    } catch (error) {
      return res.status(502).json({
        message: error?.message || 'Kunne ikke avslutte aktivt Stripe-abonnement før kontoavslutning.',
      });
    }
  }

  clientPortal.setClientPayment(user.id, {
    status: 'canceled',
    cancelAtPeriodEnd: false,
    canceledAt: nowIso(),
  });
  const deactivated = await store.deactivateUserKeepingData(user.id, 'client-self-delete');
  if (!deactivated.ok) {
    return res.status(500).json({ message: deactivated.error || 'Kunne ikke deaktivere kontoen.' });
  }
  return res.json({
    ok: true,
    message: 'Kontoen er deaktivert. Data beholdes for historikk og etterlevelse.',
  });
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
  const legalPayload = req.body?.legalAcknowledgement;
  const hasExplicitLegalPayload = Boolean(legalPayload && typeof legalPayload === 'object');

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

  const legalAcknowledgement = hasExplicitLegalPayload
    ? sanitizeCheckoutLegalAcknowledgement(
      legalPayload,
      defaultCheckoutLegalAcknowledgement(selectedPlan.id, selectedPlan.name)
    )
    : defaultCheckoutLegalAcknowledgement(selectedPlan.id, selectedPlan.name);
  const profile = clientPortal.setClientSelectedWebsitePlan(user.id, {
    ...selectedPlan,
    legalAcknowledgement,
  });
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

app.get('/api/client/checkout/promotion-code', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });

  const profile = clientPortal.ensureClientProfileForUser(user);
  let plan;
  try {
    plan = resolveClientCheckoutPlan(profile);
  } catch (error) {
    return res.status(httpStatusFromError(error, 400)).json({ message: error.message || 'Ingen gyldig plan valgt.' });
  }

  const stored = profile?.websiteBuilder?.appliedPromotionCode;
  const storedCode = normalizePromotionCodeInput(stored?.code || '');
  if (!storedCode || !sanitizeText(stored?.promotionCodeId)) {
    return res.json({
      promotionCode: null,
      amount: plan.amount,
      totalAmount: plan.amount,
    });
  }
  if (sanitizeText(stored?.planId) && sanitizeText(stored.planId) !== sanitizeText(plan.planId)) {
    clientPortal.setClientAppliedPromotionCode(user.id, null);
    return res.json({
      promotionCode: null,
      amount: plan.amount,
      totalAmount: plan.amount,
    });
  }

  try {
    const resolved = await resolveStripePromotionCodeForCheckout({
      code: storedCode,
      planId: plan.planId,
      planName: plan.planName,
      amount: plan.amount,
      currency: getStripeCurrency(),
      stripeCustomerId: sanitizeText(profile?.payment?.stripeCustomerId),
    });
    clientPortal.setClientAppliedPromotionCode(user.id, resolved);
    return res.json({
      promotionCode: resolved,
      amount: plan.amount,
      totalAmount: resolved.totalAmount,
    });
  } catch (error) {
    clientPortal.setClientAppliedPromotionCode(user.id, null);
    return res.json({
      promotionCode: null,
      amount: plan.amount,
      totalAmount: plan.amount,
      warning: error.message || 'Rabattkoden er ikke lenger gyldig.',
    });
  }
});

app.post('/api/client/checkout/promotion-code', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });

  const profile = clientPortal.ensureClientProfileForUser(user);
  let plan;
  try {
    plan = resolveClientCheckoutPlan(profile);
  } catch (error) {
    return res.status(httpStatusFromError(error, 400)).json({ message: error.message || 'Ingen gyldig plan valgt.' });
  }

  try {
    const resolved = await resolveStripePromotionCodeForCheckout({
      code: req.body?.code,
      planId: plan.planId,
      planName: plan.planName,
      amount: plan.amount,
      currency: getStripeCurrency(),
      stripeCustomerId: sanitizeText(profile?.payment?.stripeCustomerId),
    });
    clientPortal.setClientAppliedPromotionCode(user.id, resolved);
    return res.json({
      promotionCode: resolved,
      amount: plan.amount,
      totalAmount: resolved.totalAmount,
    });
  } catch (error) {
    return res
      .status(httpStatusFromError(error, 400))
      .json({ message: error.message || 'Kunne ikke validere rabattkoden.' });
  }
});

app.delete('/api/client/checkout/promotion-code', clientAuth, async (req, res) => {
  const user = await store.getUserById(req.client.userId);
  if (!user || user.role !== 'client') return res.status(401).json({ message: 'Unauthorized' });
  clientPortal.setClientAppliedPromotionCode(user.id, null);
  return res.json({ ok: true });
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
  let selectedPlanId = sanitizeText(builder.selectedPlanId);

  if (type === 'custom') {
    const custom = profile.customWebsitePlan || {};
    planName = sanitizeText(custom.title || custom.name) || 'Din nettside plan';
    if (!selectedPlanId) selectedPlanId = 'custom-website-plan';
    const monthly = typeof custom.monthlyPrice === 'number'
      ? custom.monthlyPrice
      : Number.parseInt(String(custom.monthlyPrice ?? '').replace(/[^\d]/g, ''), 10);
    if (Number.isFinite(monthly) && monthly > 0) {
      amount = monthly;
    }
    const priceId = sanitizeText(custom.stripePriceId);
    if (priceId) {
      lineItem = { price: priceId, quantity: 1 };
    } else {
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          message: 'Denne planen har ikke en fast pris. Velg faktura, eller kontakt oss for et tilbud.',
          code: 'no-fixed-price',
        });
      }
      lineItem = {
        price_data: {
          currency: getStripeCurrency(),
          unit_amount: Math.round(amount * 100),
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
    selectedPlanId = found.id;
    const priceId = priceIdForPlan(found.id);
    if (!priceId) {
      return res.status(503).json({ message: `Mangler Stripe-pris for ${found.name}. Sett STRIPE_PRICE_* i miljøet.` });
    }
    amount = parsePlanAmount(found.price);
    lineItem = { price: priceId, quantity: 1 };
  }

  const legalAcknowledgement = sanitizeCheckoutLegalAcknowledgement(
    builder.legalAcknowledgement,
    defaultCheckoutLegalAcknowledgement(selectedPlanId, planName)
  );
  if (!hasAcceptedCheckoutLegalAcknowledgement(legalAcknowledgement, selectedPlanId)) {
    return res.status(400).json({
      message: checkoutLegalConsentMessage(),
      code: 'legal-consent-required',
    });
  }

  const appUrl = resolveRequestBaseUrl(req);
  if (!appUrl) {
    return res.status(503).json({
      message: 'APP_URL mangler eller er ugyldig. Sett APP_URL til riktig https-domene.',
      code: 'app-url-missing',
    });
  }
  const isLiveStripeKey = /^sk_live_/i.test(String(process.env.STRIPE_SECRET_KEY || '').trim());
  if (isLiveStripeKey && !/^https:\/\//i.test(appUrl)) {
    return res.status(503).json({
      message: 'APP_URL må bruke https i produksjon før kortbetaling kan starte.',
      code: 'app-url-https-required',
    });
  }
  try {
    const stripe = getStripe();
    const storedPromotion = builder.appliedPromotionCode && typeof builder.appliedPromotionCode === 'object'
      ? builder.appliedPromotionCode
      : null;
    let appliedPromotion = null;
    const storedPromotionCode = normalizePromotionCodeInput(storedPromotion?.code || '');
    const storedPromotionPlanId = sanitizeText(storedPromotion?.planId || selectedPlanId);
    if (storedPromotionCode && storedPromotionPlanId === selectedPlanId) {
      try {
        appliedPromotion = await resolveStripePromotionCodeForCheckout({
          code: storedPromotionCode,
          planId: selectedPlanId,
          planName,
          amount,
          currency: getStripeCurrency(),
          stripeCustomerId: sanitizeText(profile?.payment?.stripeCustomerId),
        });
        clientPortal.setClientAppliedPromotionCode(user.id, appliedPromotion);
      } catch (error) {
        clientPortal.setClientAppliedPromotionCode(user.id, null);
        return res
          .status(httpStatusFromError(error, 400))
          .json({ message: error.message || 'Rabattkoden er ikke lenger gyldig.', code: 'promotion-code-invalid' });
      }
    }

    const sessionParams = {
      mode: 'subscription',
      ui_mode: 'embedded_page',
      line_items: [lineItem],
      // Shows Stripe's "Add promotion code" field in the embedded checkout so a
      // coupon/promotion code (e.g. a 50%-off first-time code) is applied and
      // enforced by Stripe on the actual charge.
      allow_promotion_codes: true,
      client_reference_id: user.id,
      return_url: `${appUrl}/kunde/tjenester/nettside/checkout?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        userId: String(user.id),
        planId: selectedPlanId,
        planName,
        planType: type,
        amount: String(amount || ''),
        legalTermsAccepted: legalAcknowledgement.termsAccepted ? '1' : '0',
        legalPrivacyAccepted: legalAcknowledgement.privacyAccepted ? '1' : '0',
        legalBindingAccepted: legalAcknowledgement.bindingAccepted ? '1' : '0',
        legalBindingMonths: String(legalAcknowledgement.bindingMonths || ''),
        legalAcceptedAt: legalAcknowledgement.acceptedAt,
      },
      subscription_data: {
        metadata: {
          userId: String(user.id),
          planType: type,
          planId: selectedPlanId,
          legalBindingMonths: String(legalAcknowledgement.bindingMonths || ''),
          legalAcceptedAt: legalAcknowledgement.acceptedAt,
        },
      },
    };
    if (appliedPromotion?.promotionCodeId) {
      sessionParams.discounts = [{ promotion_code: appliedPromotion.promotionCodeId }];
      sessionParams.metadata.promotionCode = appliedPromotion.code;
      sessionParams.metadata.promotionCodeId = appliedPromotion.promotionCodeId;
      sessionParams.metadata.discountAmount = String(appliedPromotion.discountAmount || 0);
      sessionParams.subscription_data.metadata.promotionCodeId = appliedPromotion.promotionCodeId;
    }
    const existingCustomer = sanitizeText(profile.payment?.stripeCustomerId);
    const normalizedCustomerEmail = normalizeEmail(profile.email || user.username);
    if (existingCustomer) {
      sessionParams.customer = existingCustomer;
    } else {
      if (normalizedCustomerEmail) sessionParams.customer_email = normalizedCustomerEmail;
    }
    let session;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (error) {
      if (sessionParams.customer && shouldRetryWithoutStripeCustomer(error)) {
        const staleCustomer = sanitizeText(sessionParams.customer);
        delete sessionParams.customer;
        if (normalizedCustomerEmail) sessionParams.customer_email = normalizedCustomerEmail;
        clientPortal.setClientPayment(user.id, { stripeCustomerId: '' });
        console.warn('[stripe][create-session] stale customer id retry', {
          userId: sanitizeText(user?.id),
          staleCustomer,
          planId: selectedPlanId,
        });
        session = await stripe.checkout.sessions.create(sessionParams);
      } else {
        throw error;
      }
    }
    clientPortal.setClientPayment(user.id, {
      status: 'processing',
      method: 'card',
      planId: selectedPlanId,
      planName,
      amount,
      currency: getStripeCurrency(),
      stripeSessionId: session.id,
    });
    return res.json({ clientSecret: session.client_secret });
  } catch (error) {
    const mapped = mapStripeCheckoutSessionError(error, planName);
    console.error('[stripe][create-session] failed', {
      userId: sanitizeText(user?.id),
      planId: selectedPlanId,
      planName,
      appUrl,
      stripeType: sanitizeText(error?.type || error?.rawType),
      stripeCode: sanitizeText(error?.code),
      message: sanitizeText(error?.message || String(error || '')),
    });
    return res.status(mapped.status).json({ message: mapped.message, code: mapped.code });
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
  const selectedPlanId = sanitizeText(builder.selectedPlanId);
  const planName = builder.selectedPlanType === 'custom'
    ? (sanitizeText(profile.customWebsitePlan?.title) || 'Din nettside plan')
    : (findWebsitePlan(builder.selectedPlanId)?.name || sanitizeText(builder.selectedPlanName));
  const legalAcknowledgement = sanitizeCheckoutLegalAcknowledgement(
    builder.legalAcknowledgement,
    defaultCheckoutLegalAcknowledgement(selectedPlanId, planName)
  );
  if (!hasAcceptedCheckoutLegalAcknowledgement(legalAcknowledgement, selectedPlanId)) {
    return res.status(400).json({
      message: checkoutLegalConsentMessage(),
      code: 'legal-consent-required',
    });
  }

  clientPortal.setClientPayment(user.id, {
    status: 'invoice_requested',
    method: 'faktura',
    planId: selectedPlanId,
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
        if (profile) {
          clientPortal.setClientPayment(profile.userId, {
            status: 'canceled',
            cancelAtPeriodEnd: false,
            canceledAt: nowIso(),
          });
        }
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
  return salesPreview.resolveImportedSiteRoot(importDir, preferredSiteFolder);
}

// --- Sales workflow (admin + sales role). Each principal scopes to their own calendar/clients.
app.get('/api/admin/sales/google/status', salesAuth, async (req, res) => {
  try {
    const status = await ensureSharedCalendarTokens(req.salesUser.accountKey);
    res.json(status);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to read Google Calendar status.' });
  }
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
    const siblings = await resolveSiblingCalendarAccountKeys(accountKey);
    await exchangeGoogleCalendarCode(code, accountKey, siblings);
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

app.post('/api/admin/sales/maker-status-callback', async (req, res) => {
  if (!isMakerStatusCallbackAuthorized(req)) {
    return res.status(401).json({ message: 'Unauthorized callback.' });
  }
  const event = sanitizeText(req.body?.event) || 'run.step.updated';
  const runId = sanitizeText(req.body?.runId);
  const salesClientId = sanitizeText(req.body?.salesClientId);
  const callbackStatus = sanitizeText(req.body?.status);
  const handoff = req.body?.handoff && typeof req.body.handoff === 'object' ? req.body.handoff : {};
  const fields = req.body?.fields && typeof req.body.fields === 'object' ? req.body.fields : {};

  let client = salesClientId ? sales.getSalesClientById(salesClientId) : null;
  if (!client && runId) {
    client = sales.getSalesClients().find((entry) => sanitizeText(entry?.makerRun?.runId) === runId) || null;
  }
  if (!client) {
    return res.status(404).json({ message: 'No matching sales client for callback.' });
  }

  const nextRunId = runId || sanitizeText(client.makerRun?.runId);
  if (!nextRunId) {
    return res.status(400).json({ message: 'runId is required.' });
  }

  // Maker → Sales field sync (links + core parameters edited in Website Maker).
  if (event === 'run.fields.updated') {
    const links = fields.quickFillLinks && typeof fields.quickFillLinks === 'object' ? fields.quickFillLinks : {};
    const detailsPatch = normalizeSalesDetailLinks(
      {
        instagramUrl: sanitizeText(links.instagramProfile ?? fields.instagramUrl),
        facebookUrl: sanitizeText(links.facebookProfile ?? fields.facebookUrl),
        proffUrl: sanitizeText(links.proffLink ?? fields.proffUrl),
        googleBusinessProfile: sanitizeText(
          links.googleBusinessProfile ?? fields.googleBusinessProfile ?? client.details?.googleBusinessProfile
        ),
        otherLinks: sanitizeText(links.customLink ?? fields.customLink ?? client.details?.otherLinks),
      },
      client.details || {}
    );
    const clientPatch = {
      details: detailsPatch,
    };
    if (Object.prototype.hasOwnProperty.call(fields, 'businessName')) {
      clientPatch.businessName = sanitizeText(fields.businessName) || client.businessName;
    }
    if (Object.prototype.hasOwnProperty.call(fields, 'industry')) {
      const nextIndustry = sanitizeText(fields.industry);
      if (nextIndustry) clientPatch.industry = nextIndustry;
    }
    if (Object.prototype.hasOwnProperty.call(fields, 'phone')) {
      clientPatch.contactPhone = sanitizeText(fields.phone);
    }
    if (Object.prototype.hasOwnProperty.call(fields, 'email')) {
      clientPatch.contactEmail = sanitizeText(fields.email);
    }
    if (Object.prototype.hasOwnProperty.call(fields, 'address')) {
      const nextAddress = sanitizeText(fields.address);
      if (nextAddress || Object.prototype.hasOwnProperty.call(fields, 'address')) {
        clientPatch.meetingPlace = nextAddress;
      }
    }
    const updatedClient = sales.updateSalesClient(client.id, clientPatch);
    const makerPatch = {
      runId: nextRunId,
      industry: sanitizeText(updatedClient?.industry || client.industry),
      createdAt: sanitizeText(client.makerRun?.createdAt) || new Date().toISOString(),
      statusUpdatedAt: new Date().toISOString(),
      fieldsSyncedAt: new Date().toISOString(),
    };
    const updated = sales.setSalesMakerRun(client.id, makerPatch);
    return res.json({ ok: true, event, client: updated, fieldsApplied: true });
  }

  const makerBaseUrl = resolveWebsiteMakerBaseUrl('', client);
  const linked = buildMakerRunLinks(makerBaseUrl, nextRunId, handoff);
  const patch = {
    runId: nextRunId,
    industry: sanitizeText(client.makerRun?.industry || client.industry),
    createdAt: sanitizeText(client.makerRun?.createdAt) || new Date().toISOString(),
    statusUpdatedAt: new Date().toISOString(),
  };
  if (sanitizeText(linked.dashboardUrl)) patch.dashboardUrl = linked.dashboardUrl;
  if (sanitizeText(linked.previewUrl)) patch.previewUrl = linked.previewUrl;
  if (sanitizeText(linked.exportPath)) patch.exportPath = linked.exportPath;
  if (sanitizeText(linked.latestReadyStep)) patch.latestReadyStep = linked.latestReadyStep;
  if (sanitizeText(linked.latestStepStatus)) patch.latestStepStatus = linked.latestStepStatus;
  else if (callbackStatus) patch.latestStepStatus = callbackStatus;
  if (sanitizeText(linked.intakeStatus)) patch.intakeStatus = linked.intakeStatus;

  const updated = sales.setSalesMakerRun(client.id, patch);
  if (sanitizeText(patch.latestReadyStep) && resolveProdAdminBaseUrl()) {
    void syncSalesClientFromMakerRun({
      client: updated || client,
      runId: nextRunId,
      step: 'latest',
      siteFolder: (updated || client).businessName || 'site',
    })
      .then((syncResult) => maybePushImportedPreviewToProduction(syncResult))
      .catch((error) => {
        console.warn('[sales-preview] callback publish failed:', sanitizeText(error?.message) || error);
      });
  }
  return res.json({ ok: true, event, client: updated });
});

app.get('/api/admin/sales/laptop-previews', salesAuth, (req, res) => {
  const all = sales.getSalesClients();
  const owned = req.salesUser.isAdmin
    ? all
    : all.filter((client) => client.ownerId === req.salesUser.accountKey);
  const items = owned
    .filter((client) => !sales.isSsuSalesProduct(client.product))
    .map((client) => buildLaptopPreviewEntry(client))
    .filter(Boolean)
    .sort((a, b) => String(a.businessName || '').localeCompare(String(b.businessName || ''), 'nb'));
  res.json({
    ok: true,
    publicOrigin: PUBLIC_SALES_ORIGIN,
    boardUrl: `${PUBLIC_SALES_ORIGIN}/previews`,
    items,
  });
});

app.get('/api/admin/sales/preview-backfill', salesAuth, (req, res) => {
  const all = sales.getSalesClients();
  const owned = req.salesUser.isAdmin
    ? all
    : all.filter((client) => client.ownerId === req.salesUser.accountKey);
  const clients = owned
    .filter((client) => clientNeedsPublicPreviewSnapshot(client))
    .map((client) => ({
      id: client.id,
      businessName: sanitizeText(client.businessName) || 'Unnamed business',
      runId: sanitizeText(client.makerRun?.runId),
      makerPreviewUrl: sanitizeText(client.makerRun?.previewUrl),
      publicPreviewUrl: getPublicSalesPreviewUrl(client.id),
    }));
  res.json({
    ok: true,
    count: clients.length,
    clients,
  });
});

// Debug: list the files stored for a client's public preview snapshot.
app.get('/api/admin/sales/:id/preview-files', salesAuth, async (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });
  const base = join(SALES_IMPORTS_ROOT, client.id);
  const files = [];
  async function walk(dir, prefix) {
    if (files.length >= 800) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (files.length >= 800) return;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), rel);
      } else {
        const stats = await fs.stat(join(dir, entry.name)).catch(() => null);
        files.push({ path: rel, size: stats?.size || 0 });
      }
    }
  }
  await walk(base, '');
  res.json({
    ok: true,
    importRoot: sanitizeText(client.websiteImport?.importRoot),
    count: files.length,
    files,
  });
});

app.get('/api/admin/sales', salesAuth, async (req, res) => {
  const all = sales.getSalesClients();
  const productFilter = sanitizeText(req.query?.product).toLowerCase();
  const owned = req.salesUser.isAdmin
    ? all
    : all.filter((client) => client.ownerId === req.salesUser.accountKey);
  const clients =
    productFilter === 'asoldi' || productFilter === 'ssu'
      ? owned.filter((client) => sales.normalizeSalesProduct(client.product) === productFilter)
      : owned;
  const calendar = await ensureSharedCalendarTokens(req.salesUser.accountKey);
  res.json({
    clients,
    calendar,
    products: {
      asoldi: owned.filter((client) => sales.normalizeSalesProduct(client.product) === 'asoldi').length,
      ssu: owned.filter((client) => sales.normalizeSalesProduct(client.product) === 'ssu').length,
    },
  });
});

app.post('/api/admin/sales/backfill-products', salesAuth, (req, res) => {
  if (!req.salesUser?.isAdmin) {
    return res.status(403).json({ message: 'Only admin can backfill sales products.' });
  }
  const forceFromList = parseBoolean(req.body?.forceFromList, true);
  const summary = sales.backfillSalesClientProducts({ forceFromList });
  return res.json({ ok: true, ...summary });
});

app.get('/api/admin/sales/email-audit', salesAuth, (req, res) => {
  const all = sales.getSalesClients();
  const visible = req.salesUser.isAdmin
    ? all
    : all.filter((client) => client.ownerId === req.salesUser.accountKey);
  res.json(buildSalesEmailAudit(visible));
});

app.post('/api/admin/sales/apply-contact-corrections', salesAuth, (req, res) => {
  if (!req.salesUser?.isAdmin) {
    return res.status(403).json({ message: 'Only admin can apply bundled contact corrections.' });
  }
  const createMissing = parseBoolean(req.body?.createMissing, true);
  const summary = applyConfiguredSalesContactCorrections({ createMissing });
  return res.json({
    ok: true,
    ...summary,
  });
});

app.post('/api/admin/sales/backfill-links', salesAuth, async (req, res) => {
  if (!req.salesUser?.isAdmin) {
    return res.status(403).json({ message: 'Only admin can run sales link backfill.' });
  }
  try {
    const dryRun = parseBoolean(req.body?.dryRun, false);
    const onlyMissing = parseBoolean(req.body?.onlyMissing, true);
    const repairLeadLinks = parseBoolean(req.body?.repairLeadLinks, true);
    const requestedLimit = Number(req.body?.limit ?? SALES_LINK_BACKFILL_LIMIT);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.max(1, Math.min(2000, Math.trunc(requestedLimit)))
      : 0;
    const requestedIds = Array.isArray(req.body?.clientIds)
      ? req.body.clientIds.map((entry) => sanitizeText(entry)).filter(Boolean)
      : [];

    const allClients = sales.getSalesClients();
    const selectedClients = requestedIds.length
      ? allClients.filter((client) => requestedIds.includes(sanitizeText(client.id)))
      : allClients;
    const result = await backfillExistingSalesClientLinks({
      clients: selectedClients,
      onlyMissing,
      dryRun,
      limit,
      repairLeadLinks,
    });

    return res.json({
      ok: true,
      dryRun,
      onlyMissing,
      repairLeadLinks,
      limit,
      requestedClientIds: requestedIds.length,
      ...result,
    });
  } catch (error) {
    return res.status(httpStatusFromError(error, 500)).json({
      ok: false,
      message: sanitizeText(error?.message) || 'Failed backfilling sales links.',
    });
  }
});

app.post('/api/admin/sales/backfill-calendar', salesAuth, async (req, res) => {
  if (!req.salesUser?.isAdmin) {
    return res.status(403).json({ message: 'Only admin can run sales calendar backfill.' });
  }
  try {
    const dryRun = parseBoolean(req.body?.dryRun, true);
    const requestedLimit = Number(req.body?.limit ?? 0);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.max(1, Math.min(5000, Math.trunc(requestedLimit)))
      : 0;
    const productFilter = sanitizeText(req.body?.product).toLowerCase();
    const actorAccountKey = sanitizeText(req.salesUser.accountKey);
    const result = await backfillMissingSalesCalendarEvents({
      dryRun,
      limit,
      actorAccountKey,
      productFilter: productFilter === 'asoldi' || productFilter === 'ssu' ? productFilter : '',
    });
    return res.json({
      ok: true,
      dryRun,
      limit,
      productFilter: productFilter || null,
      actorAccountKey,
      ...result,
    });
  } catch (error) {
    return res.status(httpStatusFromError(error, 500)).json({
      ok: false,
      message: sanitizeText(error?.message) || 'Failed backfilling sales calendar events.',
    });
  }
});

app.post('/api/admin/sales/backfill-integrity', salesAuth, async (req, res) => {
  if (!req.salesUser?.isAdmin) {
    return res.status(403).json({ message: 'Only admin can run sales integrity backfill.' });
  }
  try {
    const dryRun = parseBoolean(req.body?.dryRun, true);
    const onlyMissingLinks = parseBoolean(req.body?.onlyMissingLinks, true);
    const requestedLimit = Number(req.body?.limit ?? 0);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.max(1, Math.min(5000, Math.trunc(requestedLimit)))
      : 0;
    const effectiveBaseUrl =
      sanitizeText(req.body?.baseUrl) ||
      sanitizeText(process.env.PUBLIC_API_BASE_URL) ||
      getRequestBaseUrl(req) ||
      '';
    const result = await runSalesDataIntegrityBackfill({
      dryRun,
      limit,
      baseUrl: effectiveBaseUrl,
      onlyMissingLinks,
    });
    return res.json({
      ok: true,
      dryRun,
      limit,
      onlyMissingLinks,
      ...result,
    });
  } catch (error) {
    return res.status(httpStatusFromError(error, 500)).json({
      ok: false,
      message: sanitizeText(error?.message) || 'Failed running sales integrity backfill.',
    });
  }
});

app.get('/api/admin/sales/meeting-map', salesAuth, async (req, res) => {
  const all = sales.getSalesClients();
  const visible = req.salesUser.isAdmin
    ? all
    : all.filter((client) => client.ownerId === req.salesUser.accountKey);

  const productFilter = sales.normalizeSalesProduct(req.query?.product, { allowEmpty: true });
  const scoped = productFilter
    ? visible.filter((client) => sales.normalizeSalesProduct(client.product) === productFilter)
    : visible;

  const uniquePlaces = collectUniqueSalesMapPlaces(scoped);
  const geocodedByKey = new Map();
  const pendingKeys = [];
  for (const [key, place] of uniquePlaces.entries()) {
    const cached = await geocodeMeetingPlace(place, { allowNetwork: false });
    if (cached && Number.isFinite(Number(cached.latitude)) && Number.isFinite(Number(cached.longitude))) {
      geocodedByKey.set(key, cached);
      continue;
    }
    if (cached === null) {
      geocodedByKey.set(key, null);
      continue;
    }
    pendingKeys.push(key);
  }

  let networkLookups = 0;
  for (const key of pendingKeys) {
    if (networkLookups >= SALES_MEETING_GEOCODE_MAX_PER_REQUEST) break;
    const place = uniquePlaces.get(key);
    const geocoded = await geocodeMeetingPlace(place, { allowNetwork: true });
    networkLookups += 1;
    if (geocoded && Number.isFinite(Number(geocoded.latitude)) && Number.isFinite(Number(geocoded.longitude))) {
      geocodedByKey.set(key, geocoded);
    } else if (geocoded === null) {
      geocodedByKey.set(key, null);
    }
  }

  let unresolvedCount = 0;
  let pendingCount = 0;
  let missingAddressCount = 0;
  const pins = [];
  for (const client of scoped) {
    const resolved = resolveSalesClientMapQuery(client);
    if (!resolved?.query) {
      unresolvedCount += 1;
      missingAddressCount += 1;
      continue;
    }
    if (resolved.source === 'businessName') missingAddressCount += 1;
    const key = normalizeMeetingPlaceKey(resolved.query);
    const geocoded = geocodedByKey.get(key);
    if (!geocoded) {
      if (geocoded === null) unresolvedCount += 1;
      else pendingCount += 1;
      continue;
    }
    pins.push({
      clientId: client.id,
      businessName: sanitizeText(client.businessName),
      contactPerson: sanitizeText(client.contactPerson),
      meetingPlace: resolved.label,
      locationSource: resolved.source,
      meetingAt: sanitizeText(client.meetingAt),
      meetingMode: normalizeMeetingMode(client.meetingMode),
      status: sanitizeText(client.status) || 'active',
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

  void warmSalesGeocodeCache();

  res.json({
    pins,
    unresolvedCount,
    pendingCount,
    totalCandidates: scoped.length,
    missingAddressCount,
  });
});

app.get('/api/admin/sales/:id', salesAuth, (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });
  res.json({ client });
});

function recordingContentTypeForPath(filePath = '') {
  const ext = String(path.extname(filePath || '')).toLowerCase();
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.m4a') return 'audio/mp4';
  if (ext === '.ogg') return 'audio/ogg';
  if (ext === '.flac') return 'audio/flac';
  return 'application/octet-stream';
}

async function resolveLocalRecordingAsset(targetPathname = '') {
  let decoded = '';
  try {
    decoded = decodeURIComponent(String(targetPathname || ''));
  } catch {
    return '';
  }
  const stripped = decoded.replace(/^[/\\]+/, '');
  if (!stripped) return '';
  const normalized = path.normalize(stripped);
  if (!normalized || normalized.startsWith('..') || normalized.includes(`..${path.sep}`)) {
    return '';
  }

  const roots = [
    path.resolve(distPath),
    path.resolve(__dirname, 'public'),
    path.resolve(getPersistentDataDir()),
  ];

  // Allow /myphoner-recordings/<file> to resolve from the persistent recordings dir.
  if (normalized.replace(/\\/g, '/').startsWith('myphoner-recordings/')) {
    roots.unshift(path.resolve(getPersistentDataDir()));
  }

  for (const root of roots) {
    const candidate = path.resolve(root, normalized);
    if (!candidate.startsWith(root)) continue;
    try {
      const stats = await fs.stat(candidate);
      if (stats.isFile()) return candidate;
    } catch {
      // Keep trying other roots.
    }
  }

  // Direct filename lookup in managed recordings dir.
  const baseName = path.basename(normalized);
  if (baseName && baseName === normalized.replace(/^[/\\]+/, '')) {
    const managed = path.resolve(MYPHONER_RECORDINGS_DIR, baseName);
    try {
      const stats = await fs.stat(managed);
      if (stats.isFile()) return managed;
    } catch {
      // ignore
    }
  }
  return '';
}

// Streams the latest synced call recording through this backend so the Sales UI
// can play audio inline without relying on direct third-party CORS/browser auth.
app.get('/api/admin/sales/:id/recording', salesAuth, async (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });
  const rawUrl = sanitizeText(client.myphoner?.latestRecordingUrl);
  const recordingUrl = normalizeAbsoluteHttpUrl(rawUrl);
  if (!recordingUrl) {
    return res.status(404).json({
      message: 'No recording URL is synced for this client.',
      reason: sanitizeText(client.myphoner?.latestRecordingSyncReason || ''),
    });
  }

  let target;
  try {
    target = new URL(recordingUrl);
  } catch {
    return res.status(400).json({ message: 'Recording URL is invalid.' });
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return res.status(400).json({ message: 'Recording URL must use http(s).' });
  }

  const myphonerConfig = myphonerApi.getMyPhonerConfig();
  const myphonerHost = sanitizeText(myphonerConfig?.subdomain)
    ? `${sanitizeText(myphonerConfig.subdomain).toLowerCase()}.myphoner.com`
    : '';
  const appBase = normalizeHttpBaseUrl(process.env.APP_URL || `${req.protocol}://${req.get('host')}`);
  let appHost = '';
  try {
    if (appBase) appHost = new URL(appBase).host.toLowerCase();
  } catch {
    appHost = '';
  }
  const requestHost = sanitizeText(req.get('host')).toLowerCase();
  const allowedHosts = new Set([myphonerHost, appHost, requestHost].map((entry) => sanitizeText(entry).toLowerCase()).filter(Boolean));

  const targetHost = String(target.host || '').toLowerCase();
  const isMyphonerHost = Boolean(myphonerHost && targetHost === myphonerHost);
  const isAppHost = Boolean(allowedHosts.has(targetHost));
  // App host + Myphoner host are preferred. External CDN URLs are also allowed
  // because Myphoner often serves recordings from signed third-party storage.
  if (!isAppHost && !isMyphonerHost && !/^https?:$/i.test(target.protocol)) {
    return res.status(403).json({ message: 'Recording host is not allowed.' });
  }
  if (/^\/api\/admin\/sales\/[^/]+\/recording$/i.test(target.pathname)) {
    return res.status(400).json({ message: 'Recording URL points to this proxy endpoint.' });
  }

  const localAssetPath = await resolveLocalRecordingAsset(target.pathname);
  if (localAssetPath) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', recordingContentTypeForPath(localAssetPath));
    return res.sendFile(localAssetPath);
  }

  const headers = {
    Accept: '*/*',
  };
  if (isMyphonerHost) {
    if (!myphonerApi.isMyPhonerConfigured(myphonerConfig)) {
      return res.status(503).json({ message: 'Myphoner integration is not configured.' });
    }
    headers.Authorization = `Token "${myphonerConfig.apiKey}"`;
  }

  try {
    const upstream = await fetch(recordingUrl, {
      method: 'GET',
      headers,
      redirect: 'follow',
    });
    if (!upstream.ok) {
      const body = await upstream.text().catch(() => '');
      return res.status(upstream.status).json({
        message: sanitizeText(body) || `Failed fetching recording (${upstream.status}).`,
      });
    }

    const contentType = sanitizeText(upstream.headers.get('content-type')) || 'audio/mpeg';
    const contentLengthRaw = upstream.headers.get('content-length');
    const contentLength = Number(contentLengthRaw);
    const payload = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', contentType);
    if (Number.isFinite(contentLength) && contentLength > 0) {
      res.setHeader('Content-Length', String(contentLength));
    }
    return res.send(payload);
  } catch (error) {
    return res.status(502).json({
      message: sanitizeText(error?.message) || 'Failed streaming recording.',
    });
  }
});

app.post('/api/admin/sales', salesAuth, async (req, res) => {
  try {
    const payload = buildSalesInput(req.body || {}, { requireCore: true });
    payload.ownerId = req.salesUser.accountKey;
    let client = sales.createSalesClient(payload);
    const syncResult = await maybeSyncCalendar(client, null, {
      notifyAttendees: false,
      actorAccountKey: req.salesUser.accountKey,
    });
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

    const syncResult = await maybeSyncCalendar(client, existing, {
      notifyAttendees: false,
      actorAccountKey: req.salesUser.accountKey,
    });
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
      const deleteKey =
        sanitizeText(existing.calendar?.accountKey) ||
        resolveCalendarSyncAccountKey({
          ownerId: existing.ownerId || '',
          actorAccountKey: req.salesUser.accountKey,
          previousAccountKey: existing.calendar?.accountKey || '',
        });
      await deleteMeetingEvent(existing.calendar.eventId, deleteKey);
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

    // Create/sync a real Google Meet link before sending online welcome mail.
    const syncResult = await maybeSyncCalendar(client, client, {
      notifyAttendees: false,
      requireMeetLink: normalizeMeetingMode(client?.meetingMode) === 'online',
      actorAccountKey: req.salesUser.accountKey,
    });
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
      channel: sentResult.channel || 'email',
      meetLink: sentResult.meetLink || client?.calendar?.meetLink || '',
      copyTo: sentResult.copyTo || '',
      client,
      warnings: syncResult.warnings || [],
    });
  } catch (error) {
    return res.status(500).json({ message: formatSmtpSendError(error) });
  }
});

app.post('/api/admin/sales/:id/send-reminder', salesAuth, async (req, res) => {
  try {
    let client = sales.getSalesClientById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Sales client not found.' });
    if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });

    const requestedKind = sanitizeText(req.body?.kind || '24h');
    const reminderKind = requestedKind === '1h' ? '1h' : '24h';
    const syncWarnings = [];
    const sentResult = await sendSalesReminderNow(client, reminderKind);
    client = sentResult.client || client;
    if (!sentResult.sent) {
      return res.status(400).json({
        message: salesEmailFailureMessage(sentResult.reason),
        reason: sentResult.reason || '',
        client,
        warnings: syncWarnings,
      });
    }
    return res.json({
      ok: true,
      sent: true,
      kind: reminderKind,
      meetLink: sentResult.meetLink || client?.calendar?.meetLink || '',
      copyTo: sentResult.copyTo || '',
      client,
      warnings: syncWarnings,
    });
  } catch (error) {
    return res.status(500).json({ message: formatSmtpSendError(error) });
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
      publicHost: requestIsPublicInternetHost(req),
    });
    if (syncResult?.browserExportHandoff) {
      return res.json({
        ok: true,
        ...syncResult,
      });
    }
    const published = await maybePushImportedPreviewToProduction(syncResult);
    let publishWarning = published.error || '';
    let publishedToProd = Boolean(published.ok) || Boolean(published.skipped);
    let publicClient = syncResult.client;
    let publicUrl = published.publicUrl || syncResult.publicUrl || getPublicSalesPreviewUrl(syncResult.client);
    if (!published.ok && !published.skipped) {
      try {
        const fromDir = await publishPreviewBundleToProd(syncResult.client);
        publishedToProd = Boolean(fromDir?.ok);
        publicClient = fromDir?.client || publicClient;
        publicUrl = fromDir?.publicPreviewUrl || publicUrl;
        publishWarning = '';
      } catch (publishError) {
        publishWarning =
          publishError.message ||
          publishWarning ||
          'Synced locally, but the public asoldi.com preview could not be updated.';
      }
    }
    res.json({
      ok: true,
      client: publicClient,
      runId: syncResult.runId,
      sourceStep: syncResult.sourceStep,
      sourceExportUrl: syncResult.sourceExportUrl,
      publicUrl,
      publicPreviewUrl: publicUrl,
      publishedToProd,
      publishWarning,
      warning: publishWarning,
    });
  } catch (error) {
    res.status(httpStatusFromError(error, 500)).json({ message: error.message || 'Failed importing website bundle.' });
  }
});

app.get('/api/admin/sales/:id/maker-export', salesAuth, async (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });

  const runId = sanitizeText(req.query?.runId || client.makerRun?.runId);
  if (!runId) {
    return res.status(400).json({ message: 'Link or create a Website Maker run before downloading export ZIP.' });
  }

  const websiteMakerBaseUrl = resolveWebsiteMakerBaseUrl(req.query?.websiteMakerBaseUrl, client);
  if (!websiteMakerBaseUrl) {
    return res.status(400).json({ message: 'Website Maker URL is invalid. Use a valid host or URL (for example https://example.com).' });
  }

  const step = sanitizeText(req.query?.step || 'latest') || 'latest';
  const siteFolder = sanitizeSegment(req.query?.siteFolder || client.businessName || 'site', 'site');
  const baseUrl = sanitizeText(req.query?.baseUrl) || getPublicSalesPreviewUrl(client.id);
  const exportUrl = `${websiteMakerBaseUrl}/api/runs/${encodeURIComponent(runId)}/export?step=${encodeURIComponent(step)}&baseUrl=${encodeURIComponent(baseUrl)}&siteFolder=${encodeURIComponent(siteFolder)}&persist=1`;

  try {
    const response = await fetch(exportUrl, {
      method: 'GET',
      headers: getWebsiteMakerAuthHeaders(),
    });
    const payloadBuffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      const fallback = `Website export failed (${response.status})`;
      return res
        .status(response.status === 404 ? 404 : 502)
        .json({ message: parseMakerErrorMessage(payloadBuffer, fallback) });
    }

    const disposition = sanitizeText(response.headers.get('content-disposition'));
    const matchedName = disposition.match(/filename=\"?([^\";]+)\"?/i);
    const fileName = sanitizeText(matchedName?.[1]) || `${siteFolder}-hostinger.zip`;
    const exportedStep = sanitizeText(response.headers.get('x-export-step')) || step;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Export-Step', exportedStep);
    res.setHeader('X-Export-Run-Id', runId);
    return res.send(payloadBuffer);
  } catch (error) {
    return res.status(httpStatusFromError(error, 502)).json({ message: error.message || 'Failed downloading export ZIP from Website Maker.' });
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
    const runHandoff = run?.salesHandoff && typeof run.salesHandoff === 'object' ? run.salesHandoff : {};
    const mergedIndustry =
      sanitizeText(client.industry) ||
      sanitizeText(client.makerRun?.industry) ||
      sanitizeText(answers?.industry);
    const updated = sales.setSalesMakerRun(client.id, {
      runId,
      ...buildMakerRunLinks(websiteMakerBaseUrl, runId, runHandoff),
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
        handoff: runHandoff,
      },
    });
  } catch (error) {
    res.status(httpStatusFromError(error, 502)).json({ message: error.message || 'Failed linking run from Website Maker.' });
  }
});

function requestIsPublicInternetHost(req) {
  const host = String(req.get('host') || '').split(':')[0];
  let appHost = '';
  try {
    appHost = new URL(String(process.env.APP_URL || '').trim()).hostname;
  } catch {
    appHost = '';
  }
  return /(^|\.)asoldi\.com$/i.test(host) || /(^|\.)asoldi\.com$/i.test(appHost);
}

function setPreviewBundleCorsHeaders(req, res) {
  const origin = sanitizeText(req.get('origin'));
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, X-Source-Run-Id, X-Source-Step, X-Site-Folder'
  );
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');
}

async function publishPreviewBridgeJob(job = {}) {
  const exportUrl = sanitizeText(job.exportUrl);
  const uploadUrl = sanitizeText(job.uploadUrl);
  const token = sanitizeText(job.token);
  if (!isAllowedPreviewBridgeExportUrl(exportUrl)) {
    throw makeHttpError(400, 'Export URL must be an office-LAN Website Maker /api/runs/:id/export link.');
  }
  if (!isAllowedPreviewBundleUploadUrl(uploadUrl)) {
    throw makeHttpError(400, 'Upload URL must be asoldi.com receive-preview-bundle.');
  }
  if (!token) {
    throw makeHttpError(400, 'Missing sales token for publishing the preview.');
  }
  const extraHeaders = job.headers && typeof job.headers === 'object' ? job.headers : {};
  const exportRes = await fetch(exportUrl, {
    method: 'GET',
    headers: getWebsiteMakerAuthHeaders(),
  });
  const zipBuffer = Buffer.from(await exportRes.arrayBuffer());
  if (!exportRes.ok) {
    throw makeHttpError(
      exportRes.status === 404 ? 404 : 502,
      parseMakerErrorMessage(zipBuffer, `Website export failed (${exportRes.status})`)
    );
  }
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/zip',
      'X-Source-Run-Id': sanitizeText(extraHeaders['X-Source-Run-Id'] || extraHeaders['x-source-run-id']),
      'X-Source-Step': sanitizeText(extraHeaders['X-Source-Step'] || extraHeaders['x-source-step']) || 'latest',
      'X-Site-Folder': sanitizeText(extraHeaders['X-Site-Folder'] || extraHeaders['x-site-folder']) || 'site',
    },
    body: zipBuffer,
  });
  const uploadBody = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok) {
    throw makeHttpError(
      uploadRes.status >= 400 && uploadRes.status <= 599 ? uploadRes.status : 502,
      uploadBody.message || `asoldi.com rejected the public preview (${uploadRes.status}).`
    );
  }
  return {
    ok: true,
    publicPreviewUrl: sanitizeText(uploadBody.publicPreviewUrl),
    clientId: sanitizeText(job.clientId),
  };
}

function resolveProdAdminBaseUrl() {
  const prod = normalizeHttpBaseUrl(process.env.PROD_ADMIN_URL || 'https://asoldi.com');
  const self = normalizeHttpBaseUrl(process.env.APP_URL || '');
  if (!prod) return '';
  if (self && prod.replace(/\/$/, '') === self.replace(/\/$/, '')) return '';
  return prod;
}

async function loginProdAdmin(prodBase = '') {
  const base = sanitizeText(prodBase) || resolveProdAdminBaseUrl();
  if (!base) {
    throw makeHttpError(400, 'This instance is already production (or PROD_ADMIN_URL is unset).');
  }
  const username = sanitizeText(process.env.PROD_ADMIN_USERNAME || process.env.ADMIN_USERNAME) || 'asoldi.com';
  const password = sanitizeText(process.env.PROD_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD);
  if (!password) {
    throw makeHttpError(503, 'Set PROD_ADMIN_PASSWORD (asoldi.com/admin password) to publish a preview to asoldi.com.');
  }
  const loginRes = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok || !loginBody.token) {
    throw makeHttpError(502, loginBody.message || 'Failed logging into asoldi.com/admin.');
  }
  return { prodBase: base, token: loginBody.token };
}

async function pushPreviewZipToProduction({
  client,
  zipBuffer,
  runId = '',
  step = 'latest',
  siteFolder = '',
} = {}) {
  const target = client && typeof client === 'object' ? client : null;
  if (!target?.id) throw makeHttpError(404, 'Sales client not found.');
  const { prodBase, token } = await loginProdAdmin();
  const response = await fetch(`${prodBase}/api/admin/sales/${encodeURIComponent(target.id)}/import-website-push`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/zip',
      'x-run-id': sanitizeText(runId || target.makerRun?.runId),
      'x-export-step': sanitizeText(step || target.websiteImport?.sourceStep || 'latest') || 'latest',
      'x-site-folder': sanitizeText(siteFolder || target.businessName || 'site') || 'site',
    },
    body: zipBuffer,
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 404) {
    throw makeHttpError(
      409,
      payload.message === 'Sales client not found.'
        ? 'This client id is not on asoldi.com. Refresh LAN from production, then retry.'
        : 'asoldi.com does not have the preview ingest endpoint yet. Deploy this Asoldi-website change to production first, then retry.'
    );
  }
  if (!response.ok) {
    throw makeHttpError(
      response.status >= 400 && response.status <= 599 ? response.status : 502,
      payload.message || `asoldi.com rejected the preview upload (${response.status}).`
    );
  }
  return payload;
}

async function maybePushImportedPreviewToProduction(syncResult) {
  if (!resolveProdAdminBaseUrl()) return { skipped: true, reason: 'already-production' };
  const zipBuffer = syncResult?.zipBuffer;
  if (!syncResult?.client?.id || !zipBuffer?.length) {
    return { skipped: true, reason: 'missing-export' };
  }
  try {
    const published = await pushPreviewZipToProduction({
      client: syncResult.client,
      zipBuffer,
      runId: syncResult.runId,
      step: syncResult.sourceStep,
      siteFolder: syncResult.client?.businessName || 'site',
    });
    return { skipped: false, ok: true, publicUrl: published.publicUrl || published.publicPreviewUrl || syncResult.publicUrl };
  } catch (error) {
    try {
      const fromDir = await publishPreviewBundleToProd(syncResult.client);
      return {
        skipped: false,
        ok: true,
        publicUrl: fromDir.publicPreviewUrl || syncResult.publicUrl,
      };
    } catch {
      return { skipped: false, ok: false, error: error?.message || 'Failed publishing preview to asoldi.com.' };
    }
  }
}

function readRequestZipBuffer(req) {
  const body = req.body;
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === 'string' && body) return Buffer.from(body, 'binary');
  return null;
}

function isMakerPreviewPushAuthorized(req) {
  if (isMakerStatusCallbackAuthorized(req) && sanitizeText(process.env.WEBSITE_MAKER_STATUS_CALLBACK_TOKEN || process.env.SALES_MAKER_STATUS_CALLBACK_TOKEN)) {
    return true;
  }
  const apiKey = sanitizeText(process.env.WEBSITE_MAKER_API_KEY);
  const providedKey = sanitizeText(req.headers['x-api-key']);
  if (apiKey && providedKey && secureStringEqual(providedKey, apiKey)) return true;
  return false;
}

async function ingestPreviewZipFromRequest(req, client) {
  const zipBuffer = readRequestZipBuffer(req);
  if (!zipBuffer?.length) {
    throw makeHttpError(400, 'Website preview ZIP body is required (Content-Type: application/zip).');
  }
  const updated = await applyImportedWebsiteZip(client, zipBuffer, {
    sourceRunId: sanitizeText(req.headers['x-run-id'] || req.headers['x-source-run-id'] || req.query?.runId),
    sourceStep: sanitizeText(req.headers['x-export-step'] || req.headers['x-source-step'] || req.query?.step || 'latest') || 'latest',
    sourceBaseUrl: getPublicSalesPreviewUrl(client),
    siteFolder: sanitizeText(req.headers['x-site-folder'] || req.query?.siteFolder || client.businessName || 'site'),
    markPublic: true,
  });
  return {
    client: updated,
    publicUrl: getPublicSalesPreviewUrl(updated),
    prettyPath: salesPreview.getSalesPreviewPath(updated.id, updated.websiteImport?.previewSlug),
    sourceStep: sanitizeText(updated.websiteImport?.sourceStep) || 'latest',
  };
}

app.post('/api/admin/sales/:id/set-maker-run', salesAuth, async (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });
  if (sales.isSsuSalesProduct(client.product)) {
    return res.status(400).json({ message: 'SSU clients do not use Website Maker runs.' });
  }
  const makerPatch = req.body?.makerRun && typeof req.body.makerRun === 'object' ? req.body.makerRun : req.body || {};
  const runId = sanitizeText(makerPatch.runId);
  if (!runId) {
    return res.status(400).json({ message: 'makerRun.runId is required.' });
  }
  const updated = sales.setSalesMakerRun(client.id, makerPatch);
  if (!updated) return res.status(404).json({ message: 'Sales client not found.' });
  const previewUrl = sanitizeText(updated.makerRun?.previewUrl);
  const dashboardUrl = sanitizeText(updated.makerRun?.dashboardUrl);
  res.json({
    ok: true,
    client: updated,
    lanOnlyPreview: isPrivateMakerUrl(previewUrl) || isPrivateMakerUrl(dashboardUrl),
  });
});

app.post('/api/admin/sales/:id/publish-maker-run-to-prod', salesAuth, async (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });
  const runId = sanitizeText(client.makerRun?.runId);
  if (!runId) {
    return res.status(400).json({ message: 'No Website Maker run is linked on this LAN client yet.' });
  }
  const prodBase = resolveProdAdminBaseUrl();
  if (!prodBase) {
    return res.status(400).json({
      message: 'This instance is already production. Use Sync latest from Maker, or let Website Maker push the preview ZIP to asoldi.com.',
    });
  }
  try {
    const syncResult = await syncSalesClientFromMakerRun({
      client,
      runId,
      step: req.body?.step || 'latest',
      siteFolder: req.body?.siteFolder || client.businessName || 'site',
      websiteMakerBaseUrl: req.body?.websiteMakerBaseUrl,
    });
    const published = await maybePushImportedPreviewToProduction(syncResult);
    if (!published.ok) {
      return res.status(502).json({
        message: published.error || 'Exported the site locally, but failed uploading it to asoldi.com.',
        publicUrl: syncResult.publicUrl,
      });
    }
    const { token } = await loginProdAdmin(prodBase);
    const makerRunPatch = {
      ...(client.makerRun || {}),
      ...(syncResult.client?.makerRun || {}),
      runId,
      previewUrl: published.publicUrl || getPublicSalesPreviewUrl(syncResult.client),
    };
    await fetch(`${prodBase}/api/admin/sales/${encodeURIComponent(client.id)}/set-maker-run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ makerRun: makerRunPatch }),
    }).catch(() => null);
    const previewUrl = sanitizeText(makerRunPatch.previewUrl);
    const dashboardUrl = sanitizeText(makerRunPatch.dashboardUrl);
    const lanOnlyPreview = isPrivateMakerUrl(previewUrl) || isPrivateMakerUrl(dashboardUrl);
    const publicUrl = published.publicUrl || syncResult.publicUrl || getPublicSalesPreviewUrl(syncResult.client);
    return res.json({
      ok: true,
      prodBase,
      runId,
      lanOnlyPreview,
      publicUrl,
      publicPreviewUrl: publicUrl,
      sourceStep: syncResult.sourceStep,
      warning: lanOnlyPreview
        ? 'Maker dashboard/preview links are still on the office LAN. The client checkout preview uses asoldi.com/sales-preview.'
        : '',
      client: syncResult.client,
    });
  } catch (error) {
    return res.status(httpStatusFromError(error, 502)).json({
      message: error.message || 'Failed publishing website preview to asoldi.com.',
    });
  }
});

// Refresh stored Maker dashboard/preview links from live Website Maker state so
// "Open in maker" resumes draft vs run correctly after the operator closes the tab.
app.post('/api/admin/sales/:id/refresh-maker-handoff', salesAuth, async (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });

  const runId = sanitizeText(req.body?.runId || client.makerRun?.runId);
  if (!runId) {
    return res.status(400).json({ message: 'No Website Maker run is linked to this sales client.' });
  }

  const websiteMakerBaseUrl = resolveWebsiteMakerBaseUrl(req.body?.websiteMakerBaseUrl, client);
  if (!websiteMakerBaseUrl) {
    return res.status(400).json({ message: 'Website Maker URL is invalid. Use a valid host or URL (for example https://example.com).' });
  }

  try {
    const run = await fetchMakerRunRecord({ websiteMakerBaseUrl, runId });
    const runHandoff = run?.salesHandoff && typeof run.salesHandoff === 'object' ? run.salesHandoff : {};
    const makerLinks = buildMakerRunLinks(websiteMakerBaseUrl, runId, runHandoff);
    const updated = sales.setSalesMakerRun(client.id, {
      runId,
      ...makerLinks,
      industry:
        sanitizeText(client.makerRun?.industry) ||
        sanitizeText(client.industry) ||
        sanitizeText(run?.answers?.industry),
      createdAt: sanitizeText(client.makerRun?.createdAt) || new Date().toISOString(),
    });
    if (!updated) return res.status(404).json({ message: 'Sales client not found.' });
    return res.json({
      ok: true,
      client: updated,
      websiteMakerBaseUrl,
      dashboardUrl: sanitizeText(makerLinks.dashboardUrl),
      previewUrl: sanitizeText(makerLinks.previewUrl),
      intakeStatus: sanitizeText(makerLinks.intakeStatus),
      handoff: runHandoff,
    });
  } catch (error) {
    return res
      .status(httpStatusFromError(error, 502))
      .json({ message: error.message || 'Failed refreshing Website Maker handoff.' });
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

  // Prefer the URL the operator typed in the Sales UI.
  // Only fall back to the Docker Maker host when no URL is configured.
  // normalizeHttpOrigin remaps legacy local :4000 → :3000.
  const requestedBase = normalizeHttpOrigin(req.body?.websiteMakerBaseUrl || '');
  const envBase = normalizeHttpOrigin(process.env.WEBSITE_MAKER_BASE_URL || '');
  const localBase = normalizeHttpOrigin(DEFAULT_MAKER_LOCAL_URL);
  const isLocalBase = (value = '') => /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(String(value || ''));
  const shouldAllowLocalFallback =
    (!requestedBase || isLocalBase(requestedBase)) && (!envBase || isLocalBase(envBase));
  const baseCandidates = [requestedBase, envBase, shouldAllowLocalFallback ? localBase : '']
    .filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
  if (!baseCandidates.length) {
    return res.status(503).json({ message: 'Website Maker is not configured (set the Website Maker URL or WEBSITE_MAKER_BASE_URL).' });
  }
  const apiKey = sanitizeText(process.env.WEBSITE_MAKER_API_KEY);

  try {
    const salesDetails = normalizeSalesDetailLinks(client.details || {});
    const relevantLinks = buildSalesRelevantLinks(salesDetails);
    const quickFillLinks = buildSalesQuickFillLinks(salesDetails);
    const clientMeetingPlace = sanitizeText(client.meetingPlace);
    const clientContactPerson = sanitizeText(client.contactPerson);
    const clientPhone = sanitizeText(client.contactPhone);
    const salesOwnerContact = sanitizeText(
      req.body?.salesContact ||
      process.env.SALES_CONTACT_EMAIL ||
      process.env.BOOKING_INBOX_EMAIL ||
      'kontakt@asoldi.com'
    );
    const clientContactEmail = sanitizeText(client.contactEmail);
    const extraContext = [
      clientContactPerson ? `Primary contact person: ${clientContactPerson}` : '',
      clientPhone ? `Primary contact phone: ${clientPhone}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const answersPatch = {
      businessName: client.businessName || '',
      industry: client.industry || '',
      email: clientContactEmail || salesOwnerContact,
      phone: clientPhone,
      address: clientMeetingPlace,
      googleBusinessProfile: salesDetails.googleBusinessProfile || '',
      relevantLinks,
      extraContext,
    };
    const previousRunId = sanitizeText(client.makerRun?.runId);
    const existingRunId = forceNewRun ? '' : previousRunId;
    const salesCallbackUrl = resolveSalesMakerCallbackUrl(req);
    const salesCallbackToken = sanitizeText(
      process.env.WEBSITE_MAKER_STATUS_CALLBACK_TOKEN || process.env.SALES_MAKER_STATUS_CALLBACK_TOKEN || ''
    );
    const requestBody = {
      existingRunId,
      businessName: client.businessName || 'Untitled client run',
      industry: client.industry || '',
      source: 'sales',
      salesContact: salesOwnerContact,
      salesAddress: clientMeetingPlace,
      salesClientId: client.id,
      salesOwnerId: req.salesUser?.accountKey || '',
      salesOrderId: sanitizeText(req.body?.salesOrderId || ''),
      salesCallbackUrl,
      salesCallbackToken,
      salesPreviewPushUrl: resolveSalesPreviewPushUrl(),
      skipSalesAddressEnrichment: true,
      answers: answersPatch,
      quickFillLinks,
    };

    const browserCreated = req.body?.browserCreated && typeof req.body.browserCreated === 'object' ? req.body.browserCreated : null;
    const browserCreatedRunId = sanitizeText(browserCreated?.runId);
    if (browserCreatedRunId) {
      const base = requestedBase || envBase || localBase;
      if (!base) {
        return res.status(400).json({ message: 'Website Maker URL is missing.' });
      }
      const runHandoff = browserCreated.handoff && typeof browserCreated.handoff === 'object' ? browserCreated.handoff : {};
      const makerLinks = buildMakerRunLinks(base, browserCreatedRunId, runHandoff);
      const updated = sales.setSalesMakerRun(client.id, {
        runId: browserCreatedRunId,
        ...makerLinks,
        industry: client.industry || '',
        createdAt:
          forceNewRun || !sanitizeText(client.makerRun?.createdAt)
            ? new Date().toISOString()
            : sanitizeText(client.makerRun?.createdAt),
      });
      return res.json({
        ok: true,
        client: updated,
        websiteMakerBaseUrl: base,
        alreadyExists: Boolean(previousRunId),
        replacedRunId: forceNewRun ? previousRunId : '',
        replacedRunDeleted: false,
        handoff: runHandoff,
      });
    }

    // asoldi.com (Hostinger) cannot fetch a LAN Maker URL. The sales browser can,
    // so return the payload and let the UI create the run at the pasted Maker URL.
    if (requestedBase && isPrivateMakerUrl(requestedBase) && requestIsPublicInternetHost(req)) {
      return res.json({
        ok: true,
        browserHandoff: true,
        websiteMakerBaseUrl: requestedBase,
        requestBody,
      });
    }

    let base = '';
    let runId = '';
    let makerPayload = {};
    let lastMakerError = '';
    for (const candidateBase of baseCandidates) {
      try {
        const response = await fetch(`${candidateBase}/api/runs/v2`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'x-api-key': apiKey } : {}),
          },
          body: JSON.stringify(requestBody),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          lastMakerError = data.error || data.message || `Website Maker error (${response.status}).`;
          continue;
        }
        const candidateRunId = sanitizeText(data.runId || existingRunId);
        if (!candidateRunId) {
          lastMakerError = 'Website Maker did not return a runId.';
          continue;
        }
        base = candidateBase;
        runId = candidateRunId;
        makerPayload = data && typeof data === 'object' ? data : {};
        break;
      } catch (error) {
        const raw = String(error?.message || 'Failed reaching the Website Maker.');
        if (/ENOTFOUND|getaddrinfo|Could not resolve|EAI_AGAIN/i.test(raw) || /ENOTFOUND|getaddrinfo/i.test(String(error?.cause || ''))) {
          lastMakerError =
            `Website Maker host could not be resolved (${candidateBase}). ` +
            'Check the Website Maker URL in the Sales field.';
        } else if (/ECONNREFUSED|ETIMEDOUT|fetch failed/i.test(raw)) {
          lastMakerError =
            `Website Maker is unreachable at ${candidateBase} (${raw}). Confirm Maker is running at that URL.`;
        } else {
          lastMakerError = raw;
        }
      }
    }
    if (!base || !runId) {
      if (requestedBase && requestIsPublicInternetHost(req)) {
        return res.json({
          ok: true,
          browserHandoff: true,
          websiteMakerBaseUrl: requestedBase,
          requestBody,
        });
      }
      return res.status(502).json({
        message: lastMakerError || 'Failed reaching the Website Maker.',
        triedBases: baseCandidates,
      });
    }

    let runHandoff = makerPayload?.handoff && typeof makerPayload.handoff === 'object' ? makerPayload.handoff : {};
    try {
      const freshRun = await fetchMakerRunRecord({ websiteMakerBaseUrl: base, runId });
      if (freshRun?.salesHandoff && typeof freshRun.salesHandoff === 'object') {
        runHandoff = freshRun.salesHandoff;
      }
    } catch {
      // Keep the lightweight handoff from /api/runs/v2 if detailed lookup fails.
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

    const makerLinks = buildMakerRunLinks(base, runId, runHandoff);
    const updated = sales.setSalesMakerRun(client.id, {
      runId,
      ...makerLinks,
      industry: client.industry || '',
      createdAt:
        forceNewRun || !sanitizeText(client.makerRun?.createdAt)
          ? new Date().toISOString()
          : sanitizeText(client.makerRun?.createdAt),
    });

    res.json({
      ok: true,
      client: updated,
      websiteMakerBaseUrl: base,
      alreadyExists: Boolean(previousRunId),
      replacedRunId,
      replacedRunDeleted,
      handoff: {
        ...runHandoff,
        dashboardPath: makerLinks.dashboardUrl ? normalizeMakerDashboardPath(makerLinks.dashboardUrl) : runHandoff?.dashboardPath,
        intakeStatus: makerLinks.intakeStatus || runHandoff?.intakeStatus || '',
      },
    });
  } catch (error) {
    res.status(502).json({ message: error.message || 'Failed reaching the Website Maker.' });
  }
});

app.options('/api/admin/sales/:id/receive-preview-bundle', (req, res) => {
  setPreviewBundleCorsHeaders(req, res);
  return res.status(204).end();
});

app.post(
  '/api/admin/sales/:id/receive-preview-bundle',
  (req, res, next) => {
    setPreviewBundleCorsHeaders(req, res);
    next();
  },
  express.raw({ type: ['application/zip', 'application/octet-stream'], limit: '300mb' }),
  salesAuth,
  async (req, res) => {
    const client = sales.getSalesClientById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Sales client not found.' });
    if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });
    if (sales.isSsuSalesProduct(client.product)) {
      return res.status(400).json({ message: 'SSU clients do not use website previews.' });
    }
    const zipBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
    if (!zipBuffer.length) {
      return res.status(400).json({ message: 'Missing website preview ZIP body.' });
    }
    try {
      const updated = await applyImportedWebsiteZip(client, zipBuffer, {
        sourceRunId: sanitizeText(req.get('x-source-run-id')),
        sourceStep: sanitizeText(req.get('x-source-step')) || 'latest',
        sourceBaseUrl: getPublicSalesPreviewUrl(client.id),
        siteFolder: sanitizeText(req.get('x-site-folder')) || client.businessName || 'site',
        markPublic: true,
      });
      return res.json({
        ok: true,
        client: updated,
        publicPreviewUrl: getPublicSalesPreviewUrl(updated),
        publicUrl: getPublicSalesPreviewUrl(updated),
      });
    } catch (error) {
      return res.status(httpStatusFromError(error, 502)).json({
        message: error.message || 'Failed storing public website preview.',
      });
    }
  }
);

app.post('/api/preview-bridge/publish', async (req, res) => {
  if (requestIsPublicInternetHost(req)) {
    return res.status(404).json({ message: 'Not found' });
  }
  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  const jobs = Array.isArray(payload.jobs) && payload.jobs.length ? payload.jobs : [payload];
  const results = [];
  for (const job of jobs) {
    try {
      results.push(await publishPreviewBridgeJob(job));
    } catch (error) {
      results.push({
        ok: false,
        clientId: sanitizeText(job?.clientId),
        error: error.message || 'Failed publishing preview through the office bridge.',
      });
    }
  }
  const failed = results.filter((entry) => !entry.ok);
  return res.status(failed.length === results.length ? 502 : 200).json({
    ok: failed.length === 0,
    results,
  });
});

app.post('/api/admin/sales/:id/publish-preview-to-prod', salesAuth, async (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });
  if (sales.isSsuSalesProduct(client.product)) {
    return res.status(400).json({ message: 'SSU clients do not use website previews.' });
  }
  try {
    const published = await publishPreviewBundleToProd(client);
    return res.json({
      ok: true,
      ...published,
    });
  } catch (error) {
    return res.status(httpStatusFromError(error, 502)).json({
      message: error.message || 'Failed publishing public preview to asoldi.com.',
    });
  }
});

app.post('/api/admin/sales/:id/import-website-upload', salesAuth, (req, res) => {
  return res.status(410).json({
    message: 'Manual ZIP upload from the browser is deprecated. Use "Publish website to asoldi.com" or Website Maker auto-push.',
  });
});

const salesPreviewZipParser = express.raw({
  type: ['application/zip', 'application/octet-stream', 'application/x-zip-compressed'],
  limit: '150mb',
});

app.post('/api/admin/sales/:id/import-website-push', salesPreviewZipParser, salesAuth, async (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });
  if (sales.isSsuSalesProduct(client.product)) {
    return res.status(400).json({ message: 'SSU clients do not use Website Maker previews.' });
  }
  try {
    const ingested = await ingestPreviewZipFromRequest(req, client);
    return res.json({
      ok: true,
      client: ingested.client,
      publicUrl: ingested.publicUrl,
      prettyPath: ingested.prettyPath,
      sourceStep: ingested.sourceStep,
    });
  } catch (error) {
    return res.status(httpStatusFromError(error, 500)).json({
      message: error.message || 'Failed storing website preview.',
    });
  }
});

app.post('/api/admin/sales/maker-preview-push', salesPreviewZipParser, async (req, res) => {
  if (!isMakerPreviewPushAuthorized(req)) {
    return res.status(401).json({ message: 'Unauthorized preview push.' });
  }
  const salesClientId = sanitizeText(req.headers['x-sales-client-id'] || req.query?.salesClientId);
  const runId = sanitizeText(req.headers['x-run-id'] || req.query?.runId);
  let client = salesClientId ? sales.getSalesClientById(salesClientId) : null;
  if (!client && runId) {
    client = sales.getSalesClients().find((entry) => sanitizeText(entry?.makerRun?.runId) === runId) || null;
  }
  if (!client) {
    return res.status(404).json({ message: 'No matching sales client for preview push.' });
  }
  if (sales.isSsuSalesProduct(client.product)) {
    return res.status(400).json({ message: 'SSU clients do not use Website Maker previews.' });
  }
  try {
    const ingested = await ingestPreviewZipFromRequest(req, client);
    if (runId) {
      sales.setSalesMakerRun(client.id, {
        runId,
        latestReadyStep: sanitizeText(req.headers['x-export-step'] || ingested.sourceStep),
        statusUpdatedAt: new Date().toISOString(),
      });
    }
    return res.json({
      ok: true,
      client: sales.getSalesClientById(client.id) || ingested.client,
      publicUrl: ingested.publicUrl,
      prettyPath: ingested.prettyPath,
      sourceStep: ingested.sourceStep,
    });
  } catch (error) {
    return res.status(httpStatusFromError(error, 500)).json({
      message: error.message || 'Failed storing website preview from Maker.',
    });
  }
});

app.post('/api/admin/sales/publish-all-previews-to-prod', salesAuth, async (req, res) => {
  if (!req.salesUser?.isAdmin) {
    return res.status(403).json({ message: 'Only admin can publish all website previews.' });
  }
  const requestedIds = Array.isArray(req.body?.clientIds)
    ? req.body.clientIds.map((entry) => sanitizeText(entry)).filter(Boolean)
    : [];
  const all = sales.getSalesClients().filter((entry) => !sales.isSsuSalesProduct(entry.product) && sanitizeText(entry?.makerRun?.runId));
  const selected = requestedIds.length ? all.filter((entry) => requestedIds.includes(entry.id)) : all;
  const results = [];
  for (const client of selected) {
    try {
      const syncResult = await syncSalesClientFromMakerRun({
        client,
        runId: client.makerRun.runId,
        step: 'latest',
        siteFolder: client.businessName || 'site',
        websiteMakerBaseUrl: req.body?.websiteMakerBaseUrl,
      });
      const published = await maybePushImportedPreviewToProduction(syncResult);
      results.push({
        id: client.id,
        businessName: client.businessName,
        ok: true,
        runId: syncResult.runId,
        sourceStep: syncResult.sourceStep,
        publicUrl: published.publicUrl || syncResult.publicUrl,
        publishedToProd: Boolean(published.ok) || published.skipped,
        error: published.error || '',
      });
    } catch (error) {
      results.push({
        id: client.id,
        businessName: client.businessName,
        ok: false,
        runId: sanitizeText(client.makerRun?.runId),
        error: error.message || 'Failed exporting this client.',
      });
    }
  }
  return res.json({
    ok: true,
    count: results.length,
    published: results.filter((entry) => entry.ok).length,
    failed: results.filter((entry) => !entry.ok).length,
    results,
  });
});

app.post('/api/admin/sales/:id/got-client', salesAuth, async (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Sales client not found.' });
  if (!canAccessSalesClient(req, client)) return res.status(403).json({ message: 'Not your sales client.' });
  if (sales.isSsuSalesProduct(client.product)) {
    return res.status(400).json({
      message: 'SSU leads are not website clients. Mark contract/payment instead of “Got the client”.',
    });
  }

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
  let resolvedTargetUserId = sanitizeText(body.targetUserId);
  let resolvedTargetEmail = sanitizeText(body.targetEmail).toLowerCase();
  if (salesClientId) {
    let salesClient = sales.getSalesClientById(salesClientId);
    if (salesClient && !canAccessSalesClient(req, salesClient)) {
      return res.status(403).json({ message: 'Not your sales client.' });
    }
    if (salesClient) {
      if (!businessName) businessName = sanitizeText(salesClient.businessName);
      const existingImportedPreviewUrl = resolveSalesClientPreviewUrl(salesClient.id);
      const linkedRunId = sanitizeText(body.runId || salesClient.makerRun?.runId);
      const shouldTryRefreshFromMaker = !previewUrl && Boolean(linkedRunId);
      if (shouldTryRefreshFromMaker) {
        try {
          const syncResult = await syncSalesClientFromMakerRun({
            client: salesClient,
            runId: linkedRunId,
            websiteMakerBaseUrl: body.websiteMakerBaseUrl,
            siteFolder: body.siteFolder || salesClient.businessName || 'site',
            step: body.step || 'latest',
            baseUrl: body.baseUrl,
            publicHost: requestIsPublicInternetHost(req),
          });
          if (syncResult?.browserExportHandoff) {
            if (!existingImportedPreviewUrl) {
              return res.status(400).json({
                message:
                  'Ingen synkronisert forhåndsvisning funnet ennå. Kjør "Sync latest from Maker" først (på hjemme-Wi-Fi).',
              });
            }
            previewUrl = existingImportedPreviewUrl;
          } else {
            await maybePushImportedPreviewToProduction(syncResult);
            salesClient = sales.getSalesClientById(salesClient.id) || syncResult.client;
            previewUrl =
              sanitizeText(syncResult.publicUrl) ||
              resolveSalesClientPreviewUrl(salesClient.id) ||
              sanitizeText(salesClient.websiteImport?.publicUrl);
            try {
              const published = await publishPreviewBundleToProd(salesClient);
              salesClient = published?.client || salesClient;
              previewUrl = published?.publicPreviewUrl || previewUrl;
            } catch {
              // Keep the synced snapshot even if asoldi.com publish fails; URL rewrite still happens below.
            }
          }
        } catch (error) {
          if (!existingImportedPreviewUrl) {
            return res.status(httpStatusFromError(error, 400)).json({
              message:
                error.message ||
                'Kunne ikke synkronisere nettside-forhåndsvisning fra Website Maker.',
            });
          }
          previewUrl = existingImportedPreviewUrl;
        }
      }
      if (!previewUrl) {
        previewUrl = existingImportedPreviewUrl;
      }
      if (!previewUrl) {
        return res.status(400).json({
          message:
            'Ingen synkronisert forhåndsvisning funnet ennå. Kjør "Sync latest from Maker" først.',
        });
      }
      previewUrl = getPublicSalesPreviewUrl(salesClient) || toPublicSalesPreviewUrl(previewUrl, salesClient.id);

      // If sales doesn't explicitly pick a client user, default to the sales
      // contact email so the offer appears automatically when that account logs in.
      if (!resolvedTargetUserId && !resolvedTargetEmail) {
        resolvedTargetEmail = sanitizeText(salesClient.contactEmail).toLowerCase();
      }
    }
  }

  if (!resolvedTargetUserId && resolvedTargetEmail) {
    const allUsers = await store.getAllUsers();
    const matchedClientUser = allUsers.find(
      (entry) =>
        entry.role === 'client' &&
        sanitizeText(entry.username).toLowerCase() === resolvedTargetEmail
    );
    if (matchedClientUser) {
      resolvedTargetUserId = sanitizeText(matchedClientUser.id);
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
    targetUserId: resolvedTargetUserId,
    targetEmail: resolvedTargetEmail,
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

// --- Booking (skip Calendly: send inquiry email to configured inbox)
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
  const bookingInbox = sanitizeText(process.env.BOOKING_INBOX_EMAIL || process.env.SALES_CONTACT_EMAIL) || 'kontakt@asoldi.com';
  const bookingReplyTo = sanitizeText(process.env.BOOKING_REPLY_TO || process.env.SMTP_REPLY_TO) || 'daracha777@gmail.com';
  try {
    await emailLib.sendEmail({
      to: bookingInbox,
      subject: `[Asoldi] Ny henvendelse: ${name} – ${company || 'Ingen bedrift'}`,
      text: body,
      html: `<pre style="font-family:sans-serif;white-space:pre-wrap;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
      replyTo: bookingReplyTo,
    });
  } catch (err) {
    console.error('Booking email error:', err);
    return res.status(500).json({ message: 'Kunne ikke sende henvendelsen. Prøv igjen.' });
  }
  res.json({ ok: true });
});

async function sendSalesPreviewFile(req, res, relativePath = '') {
  const client = salesPreview.findSalesClientForPreviewParam(req.params.id, sales);
  if (!client) {
    return res.status(404).send(
      'Preview not available. This sales client has a Maker run, but the website files are not on asoldi.com yet. On home Wi-Fi, open Sales and click Sync latest from Maker (or Backfill public previews).'
    );
  }
  if (salesPreview.shouldRedirectPreviewToSlash(req.path, relativePath)) {
    const suffix = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    return res.redirect(302, `${req.path}/${suffix}`);
  }

  const storedRoot = sanitizeText(client.websiteImport?.importRoot);
  const resolvedStored = storedRoot ? path.resolve(storedRoot) : '';
  const root =
    (resolvedStored && existsSync(path.join(resolvedStored, 'index.html')) && resolvedStored) ||
    (await salesPreview.resolveSalesPreviewRoot(client, SALES_IMPORTS_ROOT));
  if (!root) {
    return res.status(404).send(
      'Preview not available. This sales client has a Maker run, but the website files are not on asoldi.com yet. On home Wi-Fi, open Sales and click Sync latest from Maker (or Backfill public previews).'
    );
  }

  // Maker export ZIPs sometimes keep shared folders (assets/) beside the site
  // folder instead of inside it, so also serve from the whole import dir.
  const importBase = path.resolve(join(SALES_IMPORTS_ROOT, client.id));
  const roots = [root];
  if (root !== importBase && existsSync(importBase) && root.startsWith(importBase)) roots.push(importBase);
  const cleaned = sanitizeText(relativePath).replace(/^[/\\]+/, '');
  const normalized = path.normalize(cleaned || 'index.html');
  const requestedAbs = path.resolve(root, normalized);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  const importBaseWithSep = importBase.endsWith(path.sep) ? importBase : `${importBase}${path.sep}`;
  if (
    requestedAbs !== root &&
    !requestedAbs.startsWith(rootWithSep) &&
    requestedAbs !== importBase &&
    !requestedAbs.startsWith(importBaseWithSep)
  ) {
    return res.status(403).send('Forbidden');
  }

  async function sendIfFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) return false;
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      const ext = path.extname(filePath).toLowerCase();
      const looksHtml = ext === '.html' || ext === '.htm' || !ext;
      if (looksHtml) {
        const raw = await fs.readFile(filePath);
        const text = raw.toString('utf8');
        if (ext === '.html' || ext === '.htm' || /^\s*</.test(text)) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.send(rewritePreviewAssetPaths(injectPreviewBaseHref(text, client.id), client.id));
          return true;
        }
      }
      if (ext === '.css') {
        const raw = await fs.readFile(filePath);
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
        res.send(rewritePreviewAssetPaths(raw.toString('utf8'), client.id));
        return true;
      }
      res.sendFile(filePath);
      return true;
    } catch {
      return false;
    }
  }

  for (const candidateRoot of roots) {
    const absolute = path.resolve(candidateRoot, normalized);
    if (!absolute.startsWith(candidateRoot)) continue;
    if (await sendIfFile(absolute)) return;
    if (!path.extname(normalized) && (await sendIfFile(path.join(absolute, 'index.html')))) return;
  }
  if (!path.extname(normalized) && await sendIfFile(path.join(root, 'index.html'))) return;
  const wantedName = path.basename(normalized);
  if (wantedName && wantedName !== 'index.html' && path.extname(wantedName)) {
    const found = await findPreviewFileByBasename(roots, wantedName);
    if (found && (await sendIfFile(found))) return;
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(404).send('Preview file not found');
}

app.get('/live-preview/:id', (req, res) => {
  const client = sales.getSalesClientById(req.params.id);
  if (!client) return res.status(404).send('Sales client not found.');
  if (sales.isSsuSalesProduct(client.product)) {
    return res.status(404).send('SSU clients do not have website previews.');
  }
  const hasSnapshot =
    sanitizeText(client.websiteImport?.importRoot) || sanitizeText(client.websiteImport?.previewUrl);
  if (!hasSnapshot) {
    return res.status(404).send('No public website preview yet. Sync latest from Maker first.');
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(302, getSalesPreviewUrl(client.id));
});

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

app.use(
  '/myphoner-recordings',
  express.static(MYPHONER_RECORDINGS_DIR, {
    fallthrough: true,
    setHeaders: (res, filePath) => {
      res.setHeader('Content-Type', recordingContentTypeForPath(filePath));
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

app.use(express.static(distPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

app.get('*', (req, res) => {
  // Preview pages sometimes reference root-absolute URLs that JavaScript
  // builds at runtime (so the HTML rewrite cannot catch them). When such a
  // request comes from a /sales-preview/ page, send it back into that
  // client's snapshot instead of the asoldi.com SPA.
  const referer = String(req.get('referer') || '');
  const refererMatch = referer.match(/\/sales-preview\/([^/?#]+)\//);
  if (refererMatch && !req.path.startsWith('/sales-preview/') && !req.path.startsWith('/api/')) {
    let clientId = '';
    try {
      clientId = decodeURIComponent(refererMatch[1]);
    } catch {
      clientId = refererMatch[1];
    }
    const client = salesPreview.findSalesClientForPreviewParam(clientId, sales);
    const importRoot = sanitizeText(client?.websiteImport?.importRoot);
    if (importRoot) {
      const cleaned = req.path.replace(/^\/+/, '');
      const normalized = path.normalize(cleaned || 'index.html');
      const fileExists = [path.resolve(importRoot), path.resolve(join(SALES_IMPORTS_ROOT, client.id))].some(
        (root) => {
          const requestedAbs = path.resolve(root, normalized);
          return requestedAbs.startsWith(root) && existsSync(requestedAbs);
        }
      );
      const isNavigation = !path.extname(cleaned);
      if (fileExists || isNavigation) {
        const search = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
        return res.redirect(302, `/sales-preview/${encodeURIComponent(clientId)}${req.path}${search}`);
      }
    }
  }
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

async function runStartupSalesRecordingBackfill() {
  const baseUrl =
    normalizeHttpBaseUrl(process.env.APP_URL || '') ||
    normalizeHttpBaseUrl(`http://127.0.0.1:${PORT}`);
  if (!baseUrl) {
    console.log('[sales] startup recording backfill skipped: no valid base URL');
    return;
  }
  try {
    const result = await syncLocalMyphonerRecordings({
      baseUrl,
      persist: true,
      fillMissingOnly: true,
    });
    const summary = result?.summary || {};
    console.log(
      `[sales] startup recording backfill: files=${Number(summary.filesFound || 0)}, updated=${Number(summary.clientsUpdated || 0)}, skippedExisting=${Number(summary.skippedExistingRecording || 0)}, unmatched=${Number(summary.unmatchedByPhone || 0)}`
    );
  } catch (error) {
    console.error('[sales] startup recording backfill failed:', sanitizeText(error?.message) || error);
  }
}

async function runStartupSsuWinsBackfill() {
  if (!MYPHONER_WEBHOOK_RECONCILE_ENABLED) {
    console.log('[myphoner ssu-wins] startup backfill skipped: webhook reconcile disabled');
    return;
  }
  if (!myphonerSsuWins.isSsuWinsSyncEnabled()) {
    console.log('[myphoner ssu-wins] startup backfill skipped: disabled');
    return;
  }
  try {
    const result = await myphonerSsuWins.maybeBackfillSsuWinners({ force: true });
    if (result?.skipped) {
      console.log(`[myphoner ssu-wins] startup backfill skipped: ${result.skipped}`);
      return;
    }
    console.log(
      `[myphoner ssu-wins] startup backfill: scanned=${Number(result?.scanned || 0)}, winners=${Number(result?.winners || 0)}, created=${Number(result?.created || 0)}, skipped=${Number(result?.skipped || 0)}, failed=${Number(result?.failed || 0)}`
    );
  } catch (error) {
    console.error('[myphoner ssu-wins] startup backfill failed:', sanitizeText(error?.message) || error);
  }
}

async function runStartupSalesLinkBackfill() {
  if (!SALES_LINK_BACKFILL_ENABLED) return;
  if (salesLinkBackfillRunning) return;
  const version = sanitizeText(SALES_LINK_BACKFILL_VERSION);
  if (!version) return;

  const existingBackfillState = myphonerIntegration.getSalesLinksBackfillState();
  if (sanitizeText(existingBackfillState?.version) === version) {
    console.log(`[sales] startup links backfill skipped: already completed version=${version}`);
    return;
  }

  salesLinkBackfillRunning = true;
  try {
    const allClients = sales.getSalesClients();
    const result = await backfillExistingSalesClientLinks({
      clients: allClients,
      onlyMissing: true,
      dryRun: false,
      limit: Number.isFinite(SALES_LINK_BACKFILL_LIMIT) && SALES_LINK_BACKFILL_LIMIT > 0
        ? SALES_LINK_BACKFILL_LIMIT
        : 0,
    });
    myphonerIntegration.setSalesLinksBackfillState({
      version,
      completedAt: nowIso(),
    });
    const summary = result?.summary || {};
    console.log(
      `[sales] startup links backfill completed: version=${version}, selected=${Number(summary.selectedClients || 0)}, eligible=${Number(summary.eligibleClients || 0)}, processed=${Number(summary.processedClients || 0)}, updated=${Number(summary.updatedClients || 0)}, unchanged=${Number(summary.unchangedClients || 0)}, leadFetchFailed=${Number(summary.leadFetchFailed || 0)}, errors=${Number(summary.errors || 0)}`
    );
  } catch (error) {
    console.error('[sales] startup links backfill failed:', sanitizeText(error?.message) || error);
  } finally {
    salesLinkBackfillRunning = false;
  }
}

async function ensureData() {
  await ensureAdminExists();
  employees.ensureWorkersForUsers(await store.getAllUsers());
  ensureHubDefaultSite();
  await fs.mkdir(SALES_IMPORTS_ROOT, { recursive: true }).catch(() => {});
  const correctionSummary = applyConfiguredSalesContactCorrections({ createMissing: true });
  if (correctionSummary.updated || correctionSummary.created) {
    console.log(
      `[sales] applied bundled contact corrections: updated=${correctionSummary.updated}, created=${correctionSummary.created}, matched=${correctionSummary.matched}`
    );
  }
  await ensureMyphonerRecordingsDir().catch(() => {});
  await runStartupSalesRecordingBackfill();
}

ensureData().then(() => {
  startSalesReminderLoop();
  startMyphonerWebhookReconcileLoop();
  startMyphonerRecordingRetryLoop();
  startSalesGeocodeWarmupLoop();
  startLanPreviewAutoPublishLoop();
  sendDueSalesReminders().catch((error) => console.error('Initial sales reminder run failed:', error));
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    runStartupSalesLinkBackfill().catch((error) => {
      console.error('[sales] startup links backfill crashed:', sanitizeText(error?.message) || error);
    });
    runStartupSsuWinsBackfill().catch((error) => {
      console.error('[myphoner ssu-wins] startup backfill crashed:', sanitizeText(error?.message) || error);
    });
  });
}).catch((err) => {
  console.error('Failed to init admin:', err);
  process.exit(1);
});
