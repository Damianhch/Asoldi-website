import { readFileSync, existsSync } from 'fs';
import { getDataFilePath, ensurePersistentDataDir, writeDataJson } from './storage-path.js';

const CLIENT_PROFILES_PATH = getDataFilePath('client-portal-profiles.json');
const CLIENT_STATE_PATH = getDataFilePath('client-portal-state.json');

function ensureDataDir() {
  ensurePersistentDataDir();
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeText(value = '') {
  return String(value ?? '').trim();
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const lowered = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(lowered)) return true;
  if (['0', 'false', 'no', 'off'].includes(lowered)) return false;
  return fallback;
}

function readJson(filePath, fallback) {
  ensureDataDir();
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDataDir();
  writeDataJson(filePath, payload);
}

function readProfiles() {
  const parsed = readJson(CLIENT_PROFILES_PATH, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeProfiles(items) {
  writeJson(CLIENT_PROFILES_PATH, items);
}

function readStateMap() {
  const parsed = readJson(CLIENT_STATE_PATH, {});
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function writeStateMap(map) {
  writeJson(CLIENT_STATE_PATH, map);
}

function defaultCustomPlan() {
  return {
    id: 'custom-nettside-plan',
    name: 'Din nettside plan',
    title: 'Din nettside plan',
    subtitle: 'Skreddersydd forslag',
    monthlyPrice: 999,
    summary: 'Skreddersydd onboarding-plan satt opp av Asoldi-teamet.',
    features: ['Nettsideutvikling', 'Hosting', 'Opprettelse', 'Domene', 'Email'],
    highlighted: true,
  };
}

function defaultWebsiteBuilder() {
  return {
    existingWebsiteCode: '',
    selectedPlanId: 'tier-1-standard',
    selectedPlanName: 'Tier 1: Standard',
    selectedPlanPrice: '999,-/mnd',
    selectedPlanType: 'standard',
    lastCheckoutStartedAt: '',
  };
}

function defaultPayment() {
  return {
    // none | processing | active | past_due | canceled | invoice_requested
    status: 'none',
    method: '', // card | faktura
    planId: '',
    planName: '',
    amount: 0, // numeric monthly amount captured at purchase (0 = unknown)
    currency: 'nok',
    stripeCustomerId: '',
    stripeSubscriptionId: '',
    stripeSessionId: '',
    paidAt: '',
    updatedAt: '',
    invoiceRequest: null, // faktura: { orgNumber, businessName, invoiceEmail, requestedAt }
  };
}

function normalizePayment(input = {}) {
  const base = defaultPayment();
  const src = input && typeof input === 'object' ? input : {};
  const amountNum = typeof src.amount === 'number'
    ? src.amount
    : Number.parseInt(String(src.amount ?? '').replace(/[^\d]/g, ''), 10);
  const ir = src.invoiceRequest && typeof src.invoiceRequest === 'object'
    ? {
        orgNumber: sanitizeText(src.invoiceRequest.orgNumber),
        businessName: sanitizeText(src.invoiceRequest.businessName),
        invoiceEmail: sanitizeText(src.invoiceRequest.invoiceEmail).toLowerCase(),
        requestedAt: sanitizeText(src.invoiceRequest.requestedAt),
      }
    : null;
  return {
    ...base,
    status: sanitizeText(src.status) || base.status,
    method: sanitizeText(src.method),
    planId: sanitizeText(src.planId),
    planName: sanitizeText(src.planName),
    amount: Number.isFinite(amountNum) ? amountNum : 0,
    currency: sanitizeText(src.currency) || base.currency,
    stripeCustomerId: sanitizeText(src.stripeCustomerId),
    stripeSubscriptionId: sanitizeText(src.stripeSubscriptionId),
    stripeSessionId: sanitizeText(src.stripeSessionId),
    paidAt: sanitizeText(src.paidAt),
    updatedAt: sanitizeText(src.updatedAt),
    invoiceRequest: ir,
  };
}

function normalizeCustomPlan(input = {}) {
  const base = defaultCustomPlan();
  const monthlyPriceRaw = input.monthlyPrice ?? base.monthlyPrice;
  const monthlyPrice = typeof monthlyPriceRaw === 'number'
    ? monthlyPriceRaw
    : Number.parseInt(String(monthlyPriceRaw).replace(/[^\d]/g, ''), 10) || base.monthlyPrice;
  const name = sanitizeText(input.name || input.title || base.name);
  return {
    ...base,
    ...input,
    id: sanitizeText(input.id || base.id),
    name,
    title: sanitizeText(input.title || name || base.title),
    subtitle: sanitizeText(input.subtitle || base.subtitle),
    monthlyPrice,
    summary: sanitizeText(input.summary || base.summary),
    features: Array.isArray(input.features) && input.features.length ? input.features.map((item) => sanitizeText(item)).filter(Boolean) : base.features,
    highlighted: toBoolean(input.highlighted, true),
  };
}

function normalizeWebsiteBuilder(input = {}) {
  const base = defaultWebsiteBuilder();
  return {
    ...base,
    ...input,
    existingWebsiteCode: sanitizeText(input.existingWebsiteCode || base.existingWebsiteCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4),
    selectedPlanId: sanitizeText(input.selectedPlanId || base.selectedPlanId),
    selectedPlanName: sanitizeText(input.selectedPlanName || base.selectedPlanName),
    selectedPlanPrice: sanitizeText(input.selectedPlanPrice || base.selectedPlanPrice),
    selectedPlanType: sanitizeText(input.selectedPlanType || base.selectedPlanType),
    lastCheckoutStartedAt: sanitizeText(input.lastCheckoutStartedAt || base.lastCheckoutStartedAt),
  };
}

function normalizeProfile(input = {}) {
  const createdAt = sanitizeText(input.createdAt) || nowIso();
  const name = sanitizeText(input.name || input.fullName);
  const source = sanitizeText(input.discoveryChannel || input.source);
  const onboarding = toBoolean(input.onboardingCompleted ?? input.onboardingComplete, false);
  return {
    userId: sanitizeText(input.userId),
    email: sanitizeText(input.email).toLowerCase(),
    name,
    fullName: name,
    businessName: sanitizeText(input.businessName),
    businessOrgNumber: sanitizeText(input.businessOrgNumber || input.organizationNumber),
    position: sanitizeText(input.position),
    discoveryChannel: source,
    source,
    onboardingCompleted: onboarding,
    onboardingComplete: onboarding,
    customWebsitePlan: normalizeCustomPlan(input.customWebsitePlan),
    websiteBuilder: normalizeWebsiteBuilder(input.websiteBuilder),
    payment: normalizePayment(input.payment),
    createdAt,
    updatedAt: sanitizeText(input.updatedAt) || createdAt,
  };
}

function profileToPortalState(profile = {}) {
  const custom = normalizeCustomPlan(profile.customWebsitePlan || {});
  const builder = normalizeWebsiteBuilder(profile.websiteBuilder || {});
  return {
    selectedMarketingElement: 'website',
    selectedWebsitePlanId: builder.selectedPlanId || 'tier-1-standard',
    selectedWebsitePlanName: builder.selectedPlanName || 'Tier 1: Standard',
    customWebsitePlan: {
      id: custom.id,
      name: custom.name,
      monthlyPrice: custom.monthlyPrice,
      summary: custom.summary,
      features: custom.features,
    },
    todos: defaultTodoList(builder.selectedPlanName, builder.existingWebsiteCode),
    websiteCode: builder.existingWebsiteCode || '',
    updatedAt: nowIso(),
  };
}

function defaultTodoList(selectedPlanName = '', existingCode = '') {
  return [
    {
      id: 'setup-website',
      title: 'Steg 1: Sett opp nettsiden din',
      description: 'Inkluderer SEO-optimalisering, kontaktskjema, hosting og vedlikehold.',
      actionLabel: 'Start',
      actionPath: '/kunde/tjenester/nettside/start',
      completed: false,
    },
    {
      id: 'website-plan',
      title: selectedPlanName ? `Valgt plan: ${selectedPlanName}` : 'Velg nettsideplan',
      description: selectedPlanName
        ? 'Du kan oppdatere eller bytte plan i checkout.'
        : 'Velg riktig plan for å fortsette.',
      actionLabel: selectedPlanName ? 'Se plan' : 'Velg plan',
      actionPath: '/kunde/tjenester/nettside/planer',
      completed: false,
    },
    {
      id: 'website-code',
      title: existingCode ? `Eksisterende nettsidekode: ${existingCode}` : 'Har du allerede en nettside? Legg inn kode',
      description: existingCode
        ? 'Koden er lagret og brukes ved kobling av eksisterende nettsted.'
        : 'Bruk 4-sifret kode for å koble eksisterende nettsted.',
      actionLabel: existingCode ? 'Oppdater' : 'Legg inn',
      actionPath: '/kunde/tjenester/nettside/start',
      completed: false,
    },
  ];
}

function syncPortalStateFromProfile(userId, profile, patch = {}) {
  const target = sanitizeText(userId);
  if (!target) return;
  const map = readStateMap();
  const base = profileToPortalState(profile);
  const current = map[target] && typeof map[target] === 'object' ? map[target] : base;
  map[target] = {
    ...base,
    ...current,
    ...patch,
    customWebsitePlan: {
      ...base.customWebsitePlan,
      ...(current.customWebsitePlan || {}),
      ...((patch.customWebsitePlan && typeof patch.customWebsitePlan === 'object') ? patch.customWebsitePlan : {}),
    },
    todos: Array.isArray(patch.todos)
      ? patch.todos
      : Array.isArray(current.todos) && current.todos.length
      ? current.todos
      : base.todos,
    updatedAt: nowIso(),
  };
  writeStateMap(map);
}

function mergeProfilePatch(current, patch = {}) {
  const nextName = sanitizeText(patch.name || patch.fullName || current.name);
  const nextSource = sanitizeText(patch.discoveryChannel || patch.source || current.discoveryChannel);
  const onboarding = toBoolean(
    patch.onboardingCompleted ?? patch.onboardingComplete,
    current.onboardingCompleted,
  );
  return normalizeProfile({
    ...current,
    ...patch,
    name: nextName,
    fullName: nextName,
    discoveryChannel: nextSource,
    source: nextSource,
    onboardingCompleted: onboarding,
    onboardingComplete: onboarding,
    customWebsitePlan: {
      ...(current.customWebsitePlan || {}),
      ...((patch.customWebsitePlan && typeof patch.customWebsitePlan === 'object') ? patch.customWebsitePlan : {}),
    },
    websiteBuilder: {
      ...(current.websiteBuilder || {}),
      ...((patch.websiteBuilder && typeof patch.websiteBuilder === 'object') ? patch.websiteBuilder : {}),
    },
    payment: {
      ...(current.payment || {}),
      ...((patch.payment && typeof patch.payment === 'object') ? patch.payment : {}),
    },
    updatedAt: nowIso(),
  });
}

export function listClientProfiles() {
  return readProfiles().map(normalizeProfile).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getClientProfileByUserId(userId) {
  const target = sanitizeText(userId);
  if (!target) return null;
  return listClientProfiles().find((entry) => entry.userId === target) || null;
}

export function getClientProfile(userId) {
  return getClientProfileByUserId(userId);
}

export function upsertClientProfile(userId, patch = {}, options = {}) {
  const target = sanitizeText(userId);
  if (!target) return null;
  const syncPortalState = options.syncPortalState !== false;
  const state = readProfiles().map(normalizeProfile);
  const index = state.findIndex((entry) => entry.userId === target);
  const now = nowIso();

  if (index === -1) {
    const created = normalizeProfile({
      userId: target,
      ...patch,
      createdAt: now,
      updatedAt: now,
    });
    state.push(created);
    writeProfiles(state);
    if (syncPortalState) syncPortalStateFromProfile(target, created);
    return created;
  }

  const merged = mergeProfilePatch(state[index], patch);
  state[index] = merged;
  writeProfiles(state);
  if (syncPortalState) {
    syncPortalStateFromProfile(target, merged, {
      selectedWebsitePlanId: merged.websiteBuilder.selectedPlanId,
      selectedWebsitePlanName: merged.websiteBuilder.selectedPlanName,
      websiteCode: merged.websiteBuilder.existingWebsiteCode,
      customWebsitePlan: {
        id: merged.customWebsitePlan.id,
        name: merged.customWebsitePlan.name,
        monthlyPrice: merged.customWebsitePlan.monthlyPrice,
        summary: merged.customWebsitePlan.summary,
        features: merged.customWebsitePlan.features,
      },
      todos: defaultTodoList(merged.websiteBuilder.selectedPlanName, merged.websiteBuilder.existingWebsiteCode),
    });
  }
  return merged;
}

export function ensureClientProfileForUser(user) {
  if (!user?.id) return null;
  const existing = getClientProfileByUserId(user.id);
  if (existing) return existing;
  return upsertClientProfile(user.id, {
    email: sanitizeText(user.username).toLowerCase(),
    onboardingCompleted: false,
  });
}

export function setClientOnboarding(userId, data = {}) {
  return upsertClientProfile(userId, {
    name: sanitizeText(data.name || data.fullName),
    businessName: sanitizeText(data.businessName),
    businessOrgNumber: sanitizeText(data.businessOrgNumber || data.organizationNumber),
    position: sanitizeText(data.position),
    discoveryChannel: sanitizeText(data.discoveryChannel || data.source),
    onboardingCompleted: true,
  });
}

export function setClientExistingWebsiteCode(userId, code) {
  const nextCode = sanitizeText(code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  return upsertClientProfile(userId, {
    websiteBuilder: {
      existingWebsiteCode: nextCode,
    },
  });
}

export function setClientSelectedWebsitePlan(userId, plan = {}) {
  return upsertClientProfile(userId, {
    websiteBuilder: {
      selectedPlanId: sanitizeText(plan.id),
      selectedPlanName: sanitizeText(plan.name),
      selectedPlanPrice: sanitizeText(plan.price),
      selectedPlanType: sanitizeText(plan.type || 'standard'),
      lastCheckoutStartedAt: nowIso(),
    },
  });
}

export function setClientPayment(userId, patch = {}) {
  const next = { ...patch, updatedAt: nowIso() };
  return upsertClientProfile(userId, { payment: next }, { syncPortalState: false });
}

export function getClientProfileByStripeCustomerId(customerId) {
  const target = sanitizeText(customerId);
  if (!target) return null;
  return listClientProfiles().find((entry) => entry.payment && entry.payment.stripeCustomerId === target) || null;
}

export function getClientDashboardData(profile) {
  const normalized = normalizeProfile(profile || {});
  const businessName = sanitizeText(normalized.businessName) || 'bedriften din';
  return {
    todoList: [
      {
        id: 'setup-website',
        title: 'Sett opp din nettside',
        description: 'Kom i gang med nettsiden din – velg plan, design og innhold.',
        actionLabel: 'Start her',
        route: '/kunde/tjenester/nettside/start',
      },
    ],
    marketingElements: [
      {
        key: 'website',
        label: 'Nettside',
        status: 'Running',
        health: ['Domene koblet', 'E-post koblet', 'Malware Protected', 'SSL', 'CDN'],
        createdAt: normalized.createdAt || nowIso(),
      },
    ],
    performance: {
      uniqueViews: 10000,
      bounceRate: 9.76,
      bounceDeltaPct: 10,
      purchases: 900,
      clicks: 7000,
      monthLabel: '1 mnd',
    },
    greetingName: sanitizeText(normalized.name) || businessName,
  };
}

export function getClientPortalState(userId) {
  const target = sanitizeText(userId);
  if (!target) return profileToPortalState({});
  const profile = getClientProfileByUserId(target) || normalizeProfile({ userId: target });
  const map = readStateMap();
  const saved = map[target];
  const base = profileToPortalState(profile);
  if (!saved || typeof saved !== 'object') {
    map[target] = base;
    writeStateMap(map);
    return base;
  }
  return {
    ...base,
    ...saved,
    customWebsitePlan: {
      ...base.customWebsitePlan,
      ...(saved.customWebsitePlan || {}),
    },
    todos: Array.isArray(saved.todos) && saved.todos.length
      ? saved.todos
      : base.todos,
  };
}

export function updateClientPortalState(userId, patch = {}) {
  const target = sanitizeText(userId);
  if (!target) return null;
  const map = readStateMap();
  const current = getClientPortalState(target);
  const next = {
    ...current,
    ...patch,
    customWebsitePlan: {
      ...current.customWebsitePlan,
      ...(patch.customWebsitePlan || {}),
    },
    updatedAt: nowIso(),
  };
  if (!Array.isArray(next.todos) || !next.todos.length) {
    next.todos = defaultTodoList(next.selectedWebsitePlanName, next.websiteCode);
  }
  map[target] = next;
  writeStateMap(map);

  // Keep core profile fields in sync so legacy routes still behave.
  const existingProfile = getClientProfileByUserId(target) || normalizeProfile({ userId: target });
  upsertClientProfile(target, {
    websiteBuilder: {
      ...existingProfile.websiteBuilder,
      selectedPlanId: sanitizeText(next.selectedWebsitePlanId || existingProfile.websiteBuilder.selectedPlanId),
      selectedPlanName: sanitizeText(next.selectedWebsitePlanName || existingProfile.websiteBuilder.selectedPlanName),
      existingWebsiteCode: sanitizeText(next.websiteCode || existingProfile.websiteBuilder.existingWebsiteCode),
    },
    customWebsitePlan: {
      ...existingProfile.customWebsitePlan,
      ...next.customWebsitePlan,
    },
  }, { syncPortalState: false });
  return next;
}
