import { existsSync, readFileSync } from 'fs';
import { getDataFilePath, ensurePersistentDataDir, writeDataJson } from './storage-path.js';

const MYPHONER_INTEGRATION_PATH = getDataFilePath('myphoner-integration.json');
const MAX_PROCESSED_EVENTS_PER_TYPE = 3000;
const MAX_RECORDINGS = 1500;

function ensureDataDir() {
  ensurePersistentDataDir();
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeText(value = '') {
  return String(value ?? '').trim();
}

function normalizeWebhookEntry(value = {}, fallback = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  return {
    webhookId: sanitizeText(input.webhookId ?? input.id ?? base.webhookId ?? base.id),
    targetUrl: sanitizeText(input.targetUrl ?? input.target_url ?? base.targetUrl),
    event: sanitizeText(input.event ?? base.event),
    listId: sanitizeText(input.listId ?? base.listId),
    createdAt: sanitizeText(input.createdAt ?? base.createdAt) || nowIso(),
    updatedAt: nowIso(),
  };
}

function normalizeProcessedBucket(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const out = {};
  for (const [key, timestamp] of Object.entries(input)) {
    const entryKey = sanitizeText(key);
    const entryValue = sanitizeText(timestamp);
    if (!entryKey || !entryValue) continue;
    out[entryKey] = entryValue;
  }
  const sorted = Object.entries(out).sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime());
  return Object.fromEntries(sorted.slice(0, MAX_PROCESSED_EVENTS_PER_TYPE));
}

function normalizeRecordingEntry(value = {}, fallback = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  return {
    recordingUrl: sanitizeText(input.recordingUrl ?? input.url ?? base.recordingUrl),
    callId: sanitizeText(input.callId ?? base.callId),
    callStartedAt: sanitizeText(input.callStartedAt ?? base.callStartedAt),
    durationSeconds: Number.isFinite(Number(input.durationSeconds))
      ? Number(input.durationSeconds)
      : Number(base.durationSeconds || 0),
    userEmail: sanitizeText(input.userEmail ?? base.userEmail),
    destinationNumber: sanitizeText(input.destinationNumber ?? base.destinationNumber),
    sourceResourceUrl: sanitizeText(input.sourceResourceUrl ?? base.sourceResourceUrl),
    updatedAt: nowIso(),
  };
}

function normalizeRecordingMap(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const out = {};
  for (const [leadId, payload] of Object.entries(input)) {
    const key = sanitizeText(leadId);
    if (!key) continue;
    out[key] = normalizeRecordingEntry(payload);
  }
  const sorted = Object.entries(out).sort(
    (a, b) => new Date(b[1]?.updatedAt || 0).getTime() - new Date(a[1]?.updatedAt || 0).getTime()
  );
  return Object.fromEntries(sorted.slice(0, MAX_RECORDINGS));
}

function normalizeSalesLinksBackfillState(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    version: sanitizeText(input.version),
    completedAt: sanitizeText(input.completedAt),
  };
}

function defaultState() {
  return {
    webhooks: {
      listWinnerByListId: {},
      accountByEvent: {},
    },
    processedEvents: {
      winner: {},
      recording: {},
    },
    recordingsByLeadId: {},
    maintenance: {
      salesLinksBackfill: normalizeSalesLinksBackfillState(),
    },
    updatedAt: nowIso(),
  };
}

function normalizeState(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const state = defaultState();
  const listMap = input?.webhooks?.listWinnerByListId && typeof input.webhooks.listWinnerByListId === 'object'
    ? input.webhooks.listWinnerByListId
    : {};
  for (const [listId, payload] of Object.entries(listMap)) {
    const key = sanitizeText(listId);
    if (!key) continue;
    state.webhooks.listWinnerByListId[key] = normalizeWebhookEntry(payload, { listId: key, event: 'winner' });
  }
  const accountMap = input?.webhooks?.accountByEvent && typeof input.webhooks.accountByEvent === 'object'
    ? input.webhooks.accountByEvent
    : {};
  for (const [eventName, payload] of Object.entries(accountMap)) {
    const key = sanitizeText(eventName).toLowerCase();
    if (!key) continue;
    state.webhooks.accountByEvent[key] = normalizeWebhookEntry(payload, { event: key });
  }
  state.processedEvents = {
    winner: normalizeProcessedBucket(input?.processedEvents?.winner),
    recording: normalizeProcessedBucket(input?.processedEvents?.recording),
  };
  state.recordingsByLeadId = normalizeRecordingMap(input?.recordingsByLeadId);
  state.maintenance = {
    salesLinksBackfill: normalizeSalesLinksBackfillState(input?.maintenance?.salesLinksBackfill),
  };
  state.updatedAt = nowIso();
  return state;
}

function readStore() {
  ensureDataDir();
  if (!existsSync(MYPHONER_INTEGRATION_PATH)) return defaultState();
  try {
    const parsed = JSON.parse(readFileSync(MYPHONER_INTEGRATION_PATH, 'utf8'));
    return normalizeState(parsed);
  } catch {
    return defaultState();
  }
}

function writeStore(state) {
  ensureDataDir();
  writeDataJson(MYPHONER_INTEGRATION_PATH, normalizeState(state));
}

export function getMyPhonerIntegrationState() {
  return readStore();
}

export function getListWinnerWebhook(listId = '') {
  const key = sanitizeText(listId);
  if (!key) return null;
  const state = readStore();
  return state.webhooks.listWinnerByListId[key] || null;
}

export function setListWinnerWebhook(listId = '', payload = {}) {
  const key = sanitizeText(listId);
  if (!key) return null;
  const state = readStore();
  const current = state.webhooks.listWinnerByListId[key] || { listId: key, event: 'winner' };
  state.webhooks.listWinnerByListId[key] = normalizeWebhookEntry(payload, current);
  state.updatedAt = nowIso();
  writeStore(state);
  return state.webhooks.listWinnerByListId[key];
}

export function removeListWinnerWebhook(listId = '') {
  const key = sanitizeText(listId);
  if (!key) return false;
  const state = readStore();
  if (!state.webhooks.listWinnerByListId[key]) return false;
  delete state.webhooks.listWinnerByListId[key];
  state.updatedAt = nowIso();
  writeStore(state);
  return true;
}

export function getAccountWebhook(eventName = '') {
  const key = sanitizeText(eventName).toLowerCase();
  if (!key) return null;
  const state = readStore();
  return state.webhooks.accountByEvent[key] || null;
}

export function setAccountWebhook(eventName = '', payload = {}) {
  const key = sanitizeText(eventName).toLowerCase();
  if (!key) return null;
  const state = readStore();
  const current = state.webhooks.accountByEvent[key] || { event: key };
  state.webhooks.accountByEvent[key] = normalizeWebhookEntry(payload, current);
  state.updatedAt = nowIso();
  writeStore(state);
  return state.webhooks.accountByEvent[key];
}

export function removeAccountWebhook(eventName = '') {
  const key = sanitizeText(eventName).toLowerCase();
  if (!key) return false;
  const state = readStore();
  if (!state.webhooks.accountByEvent[key]) return false;
  delete state.webhooks.accountByEvent[key];
  state.updatedAt = nowIso();
  writeStore(state);
  return true;
}

export function wasRecentlyProcessed(eventType = '', resourceUrl = '', windowMs = 120000) {
  const typeKey = sanitizeText(eventType).toLowerCase();
  const resourceKey = sanitizeText(resourceUrl);
  if (!typeKey || !resourceKey) return false;
  const state = readStore();
  const bucket = state.processedEvents?.[typeKey];
  if (!bucket || typeof bucket !== 'object') return false;
  const timestamp = sanitizeText(bucket[resourceKey]);
  if (!timestamp) return false;
  const diff = Date.now() - new Date(timestamp).getTime();
  return Number.isFinite(diff) && diff >= 0 && diff < Math.max(1000, Number(windowMs) || 0);
}

export function markProcessedEvent(eventType = '', resourceUrl = '', processedAt = nowIso()) {
  const typeKey = sanitizeText(eventType).toLowerCase();
  const resourceKey = sanitizeText(resourceUrl);
  if (!typeKey || !resourceKey) return null;
  const state = readStore();
  if (!state.processedEvents[typeKey] || typeof state.processedEvents[typeKey] !== 'object') {
    state.processedEvents[typeKey] = {};
  }
  state.processedEvents[typeKey][resourceKey] = sanitizeText(processedAt) || nowIso();
  state.processedEvents[typeKey] = normalizeProcessedBucket(state.processedEvents[typeKey]);
  state.updatedAt = nowIso();
  writeStore(state);
  return state.processedEvents[typeKey][resourceKey];
}

export function getRecordingForLead(leadId = '') {
  const key = sanitizeText(leadId);
  if (!key) return null;
  const state = readStore();
  return state.recordingsByLeadId[key] || null;
}

export function setRecordingForLead(leadId = '', payload = {}) {
  const key = sanitizeText(leadId);
  if (!key) return null;
  const state = readStore();
  const current = state.recordingsByLeadId[key] || {};
  state.recordingsByLeadId[key] = normalizeRecordingEntry(payload, current);
  state.recordingsByLeadId = normalizeRecordingMap(state.recordingsByLeadId);
  state.updatedAt = nowIso();
  writeStore(state);
  return state.recordingsByLeadId[key];
}

export function getSalesLinksBackfillState() {
  const state = readStore();
  return normalizeSalesLinksBackfillState(state?.maintenance?.salesLinksBackfill);
}

export function setSalesLinksBackfillState(payload = {}) {
  const input = payload && typeof payload === 'object' ? payload : {};
  const state = readStore();
  if (!state.maintenance || typeof state.maintenance !== 'object') {
    state.maintenance = {};
  }
  state.maintenance.salesLinksBackfill = normalizeSalesLinksBackfillState({
    version: input.version,
    completedAt: sanitizeText(input.completedAt) || nowIso(),
  });
  state.updatedAt = nowIso();
  writeStore(state);
  return state.maintenance.salesLinksBackfill;
}
