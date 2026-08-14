import { existsSync, readFileSync } from 'fs';
import { getDataFilePath, ensurePersistentDataDir, writeDataJson } from './storage-path.js';

const MYPHONER_INTEGRATION_PATH = getDataFilePath('myphoner-integration.json');
const MAX_PROCESSED_EVENTS_PER_TYPE = 3000;
const MAX_RECORDINGS = 1500;
const MAX_PENDING_RECORDINGS = 500;

function ensureDataDir() {
  ensurePersistentDataDir();
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeText(value = '') {
  return String(value ?? '').trim();
}

function normalizePhoneDigits(value = '') {
  return String(value || '').replace(/\D+/g, '');
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
    localRecordingUrl: sanitizeText(input.localRecordingUrl ?? base.localRecordingUrl),
    callId: sanitizeText(input.callId ?? base.callId),
    leadId: sanitizeText(input.leadId ?? base.leadId),
    callStartedAt: sanitizeText(input.callStartedAt ?? base.callStartedAt),
    durationSeconds: Number.isFinite(Number(input.durationSeconds))
      ? Number(input.durationSeconds)
      : Number(base.durationSeconds || 0),
    userEmail: sanitizeText(input.userEmail ?? base.userEmail),
    destinationNumber: sanitizeText(input.destinationNumber ?? base.destinationNumber),
    destinationDigits: normalizePhoneDigits(input.destinationDigits ?? input.destinationNumber ?? base.destinationDigits ?? base.destinationNumber),
    sourceResourceUrl: sanitizeText(input.sourceResourceUrl ?? base.sourceResourceUrl),
    updatedAt: nowIso(),
  };
}

function sortAndCapRecordingMap(input = {}, max = MAX_RECORDINGS) {
  const out = {};
  for (const [key, payload] of Object.entries(input || {})) {
    const entryKey = sanitizeText(key);
    if (!entryKey) continue;
    out[entryKey] = normalizeRecordingEntry(payload);
  }
  const sorted = Object.entries(out).sort(
    (a, b) => new Date(b[1]?.updatedAt || 0).getTime() - new Date(a[1]?.updatedAt || 0).getTime()
  );
  return Object.fromEntries(sorted.slice(0, max));
}

function normalizePendingRecordingEntry(value = {}, fallback = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  const attempts = Number.isFinite(Number(input.attempts))
    ? Number(input.attempts)
    : Number.isFinite(Number(base.attempts))
      ? Number(base.attempts)
      : 0;
  return {
    callId: sanitizeText(input.callId ?? base.callId),
    leadId: sanitizeText(input.leadId ?? base.leadId),
    destinationNumber: sanitizeText(input.destinationNumber ?? base.destinationNumber),
    destinationDigits: normalizePhoneDigits(
      input.destinationDigits ?? input.destinationNumber ?? base.destinationDigits ?? base.destinationNumber
    ),
    sourceResourceUrl: sanitizeText(input.sourceResourceUrl ?? base.sourceResourceUrl),
    reason: sanitizeText(input.reason ?? base.reason),
    attempts: Math.max(0, attempts),
    nextAttemptAt: sanitizeText(input.nextAttemptAt ?? base.nextAttemptAt) || nowIso(),
    createdAt: sanitizeText(input.createdAt ?? base.createdAt) || nowIso(),
    updatedAt: nowIso(),
  };
}

function normalizePendingRecordingMap(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const out = {};
  for (const [callId, payload] of Object.entries(input)) {
    const key = sanitizeText(callId);
    if (!key) continue;
    out[key] = normalizePendingRecordingEntry(payload, { callId: key });
  }
  const sorted = Object.entries(out).sort(
    (a, b) => new Date(a[1]?.nextAttemptAt || 0).getTime() - new Date(b[1]?.nextAttemptAt || 0).getTime()
  );
  return Object.fromEntries(sorted.slice(0, MAX_PENDING_RECORDINGS));
}

function normalizeSalesLinksBackfillState(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    version: sanitizeText(input.version),
    completedAt: sanitizeText(input.completedAt),
  };
}

const MAX_SSU_WINS_COPIES = 5000;

function normalizeSsuWinsCopyEntry(value = {}, fallback = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  return {
    targetLeadId: sanitizeText(input.targetLeadId ?? base.targetLeadId),
    copiedAt: sanitizeText(input.copiedAt ?? base.copiedAt) || nowIso(),
    phone: sanitizeText(input.phone ?? base.phone),
    email: sanitizeText(input.email ?? base.email),
  };
}

function normalizeSsuWinsCopiedMap(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const out = {};
  for (const [key, payload] of Object.entries(input)) {
    const sourceLeadId = sanitizeText(key);
    if (!sourceLeadId) continue;
    out[sourceLeadId] = normalizeSsuWinsCopyEntry(payload, { sourceLeadId });
  }
  const sorted = Object.entries(out).sort(
    (a, b) => new Date(b[1]?.copiedAt || 0).getTime() - new Date(a[1]?.copiedAt || 0).getTime()
  );
  return Object.fromEntries(sorted.slice(0, MAX_SSU_WINS_COPIES));
}

function normalizeSsuWinsState(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    sourceListId: sanitizeText(input.sourceListId),
    targetListId: sanitizeText(input.targetListId),
    copiedBySourceLeadId: normalizeSsuWinsCopiedMap(input.copiedBySourceLeadId),
    lastBackfillAt: sanitizeText(input.lastBackfillAt),
    lastBackfillSummary: input.lastBackfillSummary && typeof input.lastBackfillSummary === 'object'
      ? input.lastBackfillSummary
      : null,
    historicalBackfillVersion: sanitizeText(input.historicalBackfillVersion),
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
    recordingsByCallId: {},
    recordingsByPhoneDigits: {},
    pendingRecordingsByCallId: {},
    maintenance: {
      salesLinksBackfill: normalizeSalesLinksBackfillState(),
    },
    ssuWins: normalizeSsuWinsState(),
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
  state.recordingsByLeadId = sortAndCapRecordingMap(input?.recordingsByLeadId);
  state.recordingsByCallId = sortAndCapRecordingMap(input?.recordingsByCallId);
  state.recordingsByPhoneDigits = sortAndCapRecordingMap(input?.recordingsByPhoneDigits);
  state.pendingRecordingsByCallId = normalizePendingRecordingMap(input?.pendingRecordingsByCallId);
  state.maintenance = {
    salesLinksBackfill: normalizeSalesLinksBackfillState(input?.maintenance?.salesLinksBackfill),
  };
  state.ssuWins = normalizeSsuWinsState(input?.ssuWins);
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

export function getRecordingForCall(callId = '') {
  const key = sanitizeText(callId);
  if (!key) return null;
  const state = readStore();
  return state.recordingsByCallId[key] || null;
}

export function getRecordingForPhone(phone = '') {
  const key = normalizePhoneDigits(phone);
  if (!key) return null;
  const state = readStore();
  const direct = state.recordingsByPhoneDigits[key];
  if (direct) return direct;
  // Soft match on suffix for NO numbers (8 digits) / international variants.
  const entries = Object.entries(state.recordingsByPhoneDigits || {});
  for (const [digits, payload] of entries) {
    if (!digits) continue;
    if (digits === key || digits.endsWith(key) || key.endsWith(digits)) return payload;
  }
  return null;
}

export function setRecordingForLead(leadId = '', payload = {}) {
  const key = sanitizeText(leadId);
  if (!key) return null;
  const state = readStore();
  const current = state.recordingsByLeadId[key] || {};
  const next = normalizeRecordingEntry({ ...payload, leadId: key }, current);
  state.recordingsByLeadId[key] = next;
  if (next.callId) {
    state.recordingsByCallId[next.callId] = normalizeRecordingEntry(next, state.recordingsByCallId[next.callId] || {});
  }
  if (next.destinationDigits) {
    state.recordingsByPhoneDigits[next.destinationDigits] = normalizeRecordingEntry(
      next,
      state.recordingsByPhoneDigits[next.destinationDigits] || {}
    );
  }
  state.recordingsByLeadId = sortAndCapRecordingMap(state.recordingsByLeadId);
  state.recordingsByCallId = sortAndCapRecordingMap(state.recordingsByCallId);
  state.recordingsByPhoneDigits = sortAndCapRecordingMap(state.recordingsByPhoneDigits);
  state.updatedAt = nowIso();
  writeStore(state);
  return state.recordingsByLeadId[key];
}

export function cacheRecordingMeta(payload = {}) {
  const meta = normalizeRecordingEntry(payload);
  if (!meta.callId && !meta.leadId && !meta.destinationDigits && !meta.recordingUrl) return null;
  const state = readStore();
  if (meta.callId) {
    state.recordingsByCallId[meta.callId] = normalizeRecordingEntry(meta, state.recordingsByCallId[meta.callId] || {});
  }
  if (meta.leadId) {
    state.recordingsByLeadId[meta.leadId] = normalizeRecordingEntry(meta, state.recordingsByLeadId[meta.leadId] || {});
  }
  if (meta.destinationDigits) {
    state.recordingsByPhoneDigits[meta.destinationDigits] = normalizeRecordingEntry(
      meta,
      state.recordingsByPhoneDigits[meta.destinationDigits] || {}
    );
  }
  state.recordingsByLeadId = sortAndCapRecordingMap(state.recordingsByLeadId);
  state.recordingsByCallId = sortAndCapRecordingMap(state.recordingsByCallId);
  state.recordingsByPhoneDigits = sortAndCapRecordingMap(state.recordingsByPhoneDigits);
  state.updatedAt = nowIso();
  writeStore(state);
  return meta;
}

export function enqueuePendingRecording(payload = {}, options = {}) {
  const callId = sanitizeText(payload.callId);
  if (!callId) return null;
  const delayMs = Math.max(5_000, Number(options.delayMs) || 30_000);
  const state = readStore();
  const current = state.pendingRecordingsByCallId[callId] || { callId, createdAt: nowIso(), attempts: 0 };
  const attempts = Number(options.resetAttempts) ? 0 : Number(current.attempts || 0);
  const nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
  state.pendingRecordingsByCallId[callId] = normalizePendingRecordingEntry(
    {
      ...current,
      ...payload,
      callId,
      attempts,
      nextAttemptAt,
      reason: sanitizeText(payload.reason || current.reason || 'awaiting-recording-url'),
    },
    current
  );
  state.pendingRecordingsByCallId = normalizePendingRecordingMap(state.pendingRecordingsByCallId);
  state.updatedAt = nowIso();
  writeStore(state);
  return state.pendingRecordingsByCallId[callId];
}

export function bumpPendingRecordingAttempt(callId = '', options = {}) {
  const key = sanitizeText(callId);
  if (!key) return null;
  const state = readStore();
  const current = state.pendingRecordingsByCallId[key];
  if (!current) return null;
  const attempts = Number(current.attempts || 0) + 1;
  const delayMs = Math.max(5_000, Number(options.delayMs) || 60_000);
  state.pendingRecordingsByCallId[key] = normalizePendingRecordingEntry(
    {
      ...current,
      attempts,
      nextAttemptAt: new Date(Date.now() + delayMs).toISOString(),
      reason: sanitizeText(options.reason || current.reason || 'awaiting-recording-url'),
    },
    current
  );
  state.pendingRecordingsByCallId = normalizePendingRecordingMap(state.pendingRecordingsByCallId);
  state.updatedAt = nowIso();
  writeStore(state);
  return state.pendingRecordingsByCallId[key];
}

export function clearPendingRecording(callId = '') {
  const key = sanitizeText(callId);
  if (!key) return false;
  const state = readStore();
  if (!state.pendingRecordingsByCallId[key]) return false;
  delete state.pendingRecordingsByCallId[key];
  state.updatedAt = nowIso();
  writeStore(state);
  return true;
}

export function listDuePendingRecordings(limit = 25, nowMs = Date.now()) {
  const state = readStore();
  const due = Object.values(state.pendingRecordingsByCallId || {})
    .filter((entry) => {
      const nextAt = new Date(entry?.nextAttemptAt || 0).getTime();
      return Number.isFinite(nextAt) && nextAt <= nowMs;
    })
    .sort((a, b) => new Date(a.nextAttemptAt || 0).getTime() - new Date(b.nextAttemptAt || 0).getTime());
  return due.slice(0, Math.max(1, Number(limit) || 25));
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

export function getSsuWinsState() {
  const state = readStore();
  return normalizeSsuWinsState(state?.ssuWins);
}

export function getCopiedSsuWinner(sourceLeadId = '') {
  const key = sanitizeText(sourceLeadId);
  if (!key) return null;
  const state = getSsuWinsState();
  return state.copiedBySourceLeadId[key] || null;
}

export function clearCopiedSsuWinner(sourceLeadId = '') {
  const key = sanitizeText(sourceLeadId);
  if (!key) return false;
  const state = readStore();
  const current = normalizeSsuWinsState(state.ssuWins);
  if (!current.copiedBySourceLeadId[key]) return false;
  delete current.copiedBySourceLeadId[key];
  state.ssuWins = current;
  state.updatedAt = nowIso();
  writeStore(state);
  return true;
}

export function markSsuWinnerCopied(sourceLeadId = '', payload = {}) {
  const key = sanitizeText(sourceLeadId);
  if (!key) return null;
  const state = readStore();
  const current = normalizeSsuWinsState(state.ssuWins);
  current.copiedBySourceLeadId[key] = normalizeSsuWinsCopyEntry(payload, current.copiedBySourceLeadId[key] || {});
  current.copiedBySourceLeadId = normalizeSsuWinsCopiedMap(current.copiedBySourceLeadId);
  if (sanitizeText(payload.sourceListId)) current.sourceListId = sanitizeText(payload.sourceListId);
  if (sanitizeText(payload.targetListId)) current.targetListId = sanitizeText(payload.targetListId);
  state.ssuWins = current;
  state.updatedAt = nowIso();
  writeStore(state);
  return current.copiedBySourceLeadId[key];
}

export function setSsuWinsBackfillState(payload = {}) {
  const input = payload && typeof payload === 'object' ? payload : {};
  const state = readStore();
  const current = normalizeSsuWinsState(state.ssuWins);
  if (sanitizeText(input.sourceListId)) current.sourceListId = sanitizeText(input.sourceListId);
  if (sanitizeText(input.targetListId)) current.targetListId = sanitizeText(input.targetListId);
  current.lastBackfillAt = sanitizeText(input.lastBackfillAt) || nowIso();
  current.lastBackfillSummary = input.lastBackfillSummary && typeof input.lastBackfillSummary === 'object'
    ? input.lastBackfillSummary
    : current.lastBackfillSummary;
  if (sanitizeText(input.historicalBackfillVersion)) {
    current.historicalBackfillVersion = sanitizeText(input.historicalBackfillVersion);
  }
  state.ssuWins = current;
  state.updatedAt = nowIso();
  writeStore(state);
  return state.ssuWins;
}
