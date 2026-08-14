import { readFileSync, existsSync } from 'fs';
import { getDataFilePath, ensurePersistentDataDir, writeDataJson } from './storage-path.js';

const SALES_PATH = getDataFilePath('sales-clients.json');

const PROGRESSION_KEYS = ['step0AgreeMeetingTime', 'contractSigned', 'paymentReceived', 'domainConnected', 'live'];
const SSU_PROGRESSION_KEYS = ['step0AgreeMeetingTime', 'contractSigned', 'paymentReceived'];
const SALES_STATUSES = ['active', 'not-sold', 'secondary'];
const SALES_PRODUCTS = ['asoldi', 'ssu'];
/** Known MyPhoner SSU list id(s). Extra ids can be added via MYPHONER_SSU_LIST_IDS. */
const DEFAULT_SSU_LIST_IDS = ['210172'];

function ensureDataDir() {
  ensurePersistentDataDir();
}

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeText(value = '') {
  return String(value ?? '').trim();
}

function normalizeWebsiteDomain(value = '') {
  return sanitizeText(value);
}

function normalizeSalesStatus(value = '') {
  const raw = sanitizeText(value).toLowerCase();
  if (SALES_STATUSES.includes(raw)) return raw;
  return 'active';
}

function normalizeSalesProduct(value = '', { allowEmpty = false } = {}) {
  const raw = sanitizeText(value).toLowerCase();
  if (raw === 'website' || raw === 'asoldi-website' || raw === 'nettside') return 'asoldi';
  if (SALES_PRODUCTS.includes(raw)) return raw;
  if (allowEmpty) return '';
  return 'asoldi';
}

export { normalizeSalesProduct };

function getConfiguredSsuListIds() {
  const fromEnv = String(process.env.MYPHONER_SSU_LIST_IDS || '')
    .split(/[,;\s]+/)
    .map((entry) => sanitizeText(entry))
    .filter(Boolean);
  return new Set([...DEFAULT_SSU_LIST_IDS, ...fromEnv]);
}

/**
 * Resolve sales product bracket from MyPhoner list metadata.
 * SSU winners land in their own bracket (no website Maker / domain / live flow).
 */
export function resolveSalesProductFromMyphoner({ listId = '', listName = '', product = '' } = {}) {
  const explicit = normalizeSalesProduct(product, { allowEmpty: true });
  if (explicit) return explicit;
  const id = sanitizeText(listId);
  const name = sanitizeText(listName);
  if (id && getConfiguredSsuListIds().has(id)) return 'ssu';
  if (/^ssu$/i.test(name) || /\bssu\b/i.test(name)) return 'ssu';
  return 'asoldi';
}

export function isSsuSalesProduct(product = '') {
  return normalizeSalesProduct(product) === 'ssu';
}

export function getProgressionKeysForProduct(product = '') {
  return isSsuSalesProduct(product) ? [...SSU_PROGRESSION_KEYS] : [...PROGRESSION_KEYS];
}

function normalizeMeetingMode(value) {
  const raw = sanitizeText(value).toLowerCase();
  if (raw === 'online') return 'online';
  if (raw === 'in-person' || raw === 'in_person' || raw === 'inperson' || raw === 'physical') return 'in-person';
  return 'online';
}

function durationForMode(mode) {
  // Keep both online and in-person meetings at the same baseline duration.
  return 30;
}

function readSalesFile() {
  ensureDataDir();
  if (!existsSync(SALES_PATH)) return [];
  try {
    const parsed = JSON.parse(readFileSync(SALES_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSalesFile(list) {
  ensureDataDir();
  writeDataJson(SALES_PATH, list);
}

function emptyReminders() {
  return {
    thankYouSentAt: '',
    reminder24hAt: '',
    reminder24hSentAt: '',
    reminder1hAt: '',
    reminder1hSentAt: '',
    skipDueToShortNotice: false,
  };
}

function normalizeProgression(value = {}, agreedTime = false) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    // Step 0 mirrors real scheduling data from Sales/Myphoner: green only when
    // an agreed meeting exists.
    step0AgreeMeetingTime: Boolean(agreedTime),
    contractSigned: Boolean(input.contractSigned),
    paymentReceived: Boolean(input.paymentReceived),
    domainConnected: Boolean(input.domainConnected),
    live: Boolean(input.live),
  };
}

function normalizeWebsiteImport(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    importedAt: sanitizeText(input.importedAt),
    sourceRunId: sanitizeText(input.sourceRunId),
    sourceStep: sanitizeText(input.sourceStep),
    sourceBaseUrl: sanitizeText(input.sourceBaseUrl),
    siteFolder: sanitizeText(input.siteFolder),
    importRoot: sanitizeText(input.importRoot),
    previewUrl: sanitizeText(input.previewUrl),
    publicPreviewPublishedAt: sanitizeText(input.publicPreviewPublishedAt),
  };
}

function normalizeMakerRun(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    runId: sanitizeText(input.runId),
    dashboardUrl: sanitizeText(input.dashboardUrl),
    previewUrl: sanitizeText(input.previewUrl),
    latestReadyStep: sanitizeText(input.latestReadyStep),
    latestStepStatus: sanitizeText(input.latestStepStatus),
    intakeStatus: sanitizeText(input.intakeStatus),
    exportPath: sanitizeText(input.exportPath),
    statusUpdatedAt: sanitizeText(input.statusUpdatedAt),
    fieldsSyncedAt: sanitizeText(input.fieldsSyncedAt),
    industry: sanitizeText(input.industry),
    createdAt: sanitizeText(input.createdAt),
  };
}

function normalizeArchive(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    archivedAt: sanitizeText(input.archivedAt),
    reason: sanitizeText(input.reason),
  };
}

function normalizeCalendar(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    eventId: sanitizeText(input.eventId),
    htmlLink: sanitizeText(input.htmlLink),
    meetLink: sanitizeText(input.meetLink),
    calendarId: sanitizeText(input.calendarId),
    accountKey: sanitizeText(input.accountKey),
    syncedAt: sanitizeText(input.syncedAt),
  };
}

function normalizeReminders(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    thankYouSentAt: sanitizeText(input.thankYouSentAt),
    reminder24hAt: sanitizeText(input.reminder24hAt),
    reminder24hSentAt: sanitizeText(input.reminder24hSentAt),
    reminder1hAt: sanitizeText(input.reminder1hAt),
    reminder1hSentAt: sanitizeText(input.reminder1hSentAt),
    skipDueToShortNotice: Boolean(input.skipDueToShortNotice),
  };
}

function normalizeSalesDetails(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    instagramUrl: sanitizeText(input.instagramUrl),
    facebookUrl: sanitizeText(input.facebookUrl),
    proffUrl: sanitizeText(input.proffUrl),
    otherLinks: sanitizeText(input.otherLinks),
    googleBusinessProfile: sanitizeText(input.googleBusinessProfile),
  };
}

function normalizeMyphoner(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const leadIds = Array.isArray(input.leadIds)
    ? input.leadIds.map((entry) => sanitizeText(entry)).filter(Boolean)
    : [];
  const primaryLeadId = sanitizeText(input.leadId);
  if (primaryLeadId && !leadIds.includes(primaryLeadId)) leadIds.unshift(primaryLeadId);
  return {
    leadId: primaryLeadId,
    leadIds,
    listId: sanitizeText(input.listId),
    listName: sanitizeText(input.listName),
    leadResourceUrl: sanitizeText(input.leadResourceUrl),
    winnerCategory: sanitizeText(input.winnerCategory),
    winnerComment: sanitizeText(input.winnerComment),
    lastWinnerWebhookAt: sanitizeText(input.lastWinnerWebhookAt),
    lastRecordingWebhookAt: sanitizeText(input.lastRecordingWebhookAt),
    latestEventAt: sanitizeText(input.latestEventAt),
    latestCallId: sanitizeText(input.latestCallId),
    latestCallStartedAt: sanitizeText(input.latestCallStartedAt),
    latestCallDurationSeconds: Number.isFinite(Number(input.latestCallDurationSeconds))
      ? Number(input.latestCallDurationSeconds)
      : 0,
    latestCallUserEmail: sanitizeText(input.latestCallUserEmail),
    latestCallDestinationNumber: sanitizeText(input.latestCallDestinationNumber),
    latestRecordingUrl: sanitizeText(input.latestRecordingUrl),
    latestRecordingSyncReason: sanitizeText(input.latestRecordingSyncReason),
  };
}

function normalizeSalesClient(raw = {}) {
  const meetingMode = normalizeMeetingMode(raw.meetingMode);
  const agreedTime = Boolean(raw.agreedTime);
  const meetingAt = agreedTime ? sanitizeText(raw.meetingAt) : '';
  const createdAt = sanitizeText(raw.createdAt) || nowIso();
  const updatedAt = sanitizeText(raw.updatedAt) || createdAt;
  const status = normalizeSalesStatus(raw.status);
  const archive = normalizeArchive(raw.archive);
  const myphoner = normalizeMyphoner(raw.myphoner);
  const product = resolveSalesProductFromMyphoner({
    product: raw.product,
    listId: myphoner.listId,
    listName: myphoner.listName,
  });
  const progression = normalizeProgression(raw.progression, agreedTime);
  if (product === 'ssu') {
    progression.domainConnected = false;
    progression.live = false;
  }

  return {
    id: sanitizeText(raw.id) || makeId(),
    ownerId: sanitizeText(raw.ownerId),
    product,
    businessName: sanitizeText(raw.businessName),
    contactPerson: sanitizeText(raw.contactPerson),
    contactEmail: sanitizeText(raw.contactEmail),
    contactPhone: sanitizeText(raw.contactPhone),
    meetingPlace: sanitizeText(raw.meetingPlace),
    industry: sanitizeText(raw.industry),
    meetingMode,
    meetingDurationMinutes: durationForMode(meetingMode),
    agreedTime,
    meetingAt,
    websiteDomain: product === 'ssu' ? '' : normalizeWebsiteDomain(raw.websiteDomain),
    details: normalizeSalesDetails(raw.details),
    myphoner,
    progression,
    reminders: normalizeReminders(raw.reminders || emptyReminders()),
    calendar: normalizeCalendar(raw.calendar),
    websiteImport: product === 'ssu' ? normalizeWebsiteImport() : normalizeWebsiteImport(raw.websiteImport),
    makerRun: product === 'ssu' ? normalizeMakerRun() : normalizeMakerRun(raw.makerRun),
    status,
    archive: status === 'not-sold' || status === 'secondary' ? archive : normalizeArchive(),
    createdAt,
    updatedAt,
  };
}

function readState() {
  return readSalesFile().map(normalizeSalesClient);
}

function writeState(items) {
  writeSalesFile(items.map(normalizeSalesClient));
}

export function deriveReminderSchedule({ agreedTime, meetingAt }, nowMs = Date.now()) {
  if (!agreedTime || !meetingAt) {
    return {
      reminder24hAt: '',
      reminder1hAt: '',
      skipDueToShortNotice: false,
    };
  }
  const meetingMs = new Date(meetingAt).getTime();
  if (!Number.isFinite(meetingMs)) {
    return {
      reminder24hAt: '',
      reminder1hAt: '',
      skipDueToShortNotice: true,
    };
  }
  const diffMs = meetingMs - nowMs;
  if (diffMs < 24 * 60 * 60 * 1000) {
    return {
      reminder24hAt: '',
      reminder1hAt: '',
      skipDueToShortNotice: true,
    };
  }
  return {
    reminder24hAt: new Date(meetingMs - 24 * 60 * 60 * 1000).toISOString(),
    reminder1hAt: new Date(meetingMs - 60 * 60 * 1000).toISOString(),
    skipDueToShortNotice: false,
  };
}

export function getSalesClients() {
  return readState().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getSalesClientById(id) {
  return readState().find((entry) => entry.id === id) || null;
}

export function getSalesClientByMyphonerLeadId(leadId) {
  const target = sanitizeText(leadId);
  if (!target) return null;
  return (
    readState().find((entry) => {
      if (sanitizeText(entry.myphoner?.leadId) === target) return true;
      if (!Array.isArray(entry.myphoner?.leadIds)) return false;
      return entry.myphoner.leadIds.some((candidate) => sanitizeText(candidate) === target);
    }) || null
  );
}

export function createSalesClient(input = {}) {
  const state = readState();
  const now = nowIso();
  const client = normalizeSalesClient({
    ...input,
    id: input.id || makeId(),
    createdAt: now,
    updatedAt: now,
    reminders: input.reminders || emptyReminders(),
  });
  state.push(client);
  writeState(state);
  return client;
}

export function updateSalesClient(id, updates = {}) {
  const state = readState();
  const index = state.findIndex((entry) => entry.id === id);
  if (index === -1) return null;
  const current = state[index];
  const mergedDetails = updates.details && typeof updates.details === 'object'
    ? { ...(current.details || {}), ...updates.details }
    : current.details;
  const next = normalizeSalesClient({
    ...current,
    ...updates,
    details: mergedDetails,
    progression: updates.progression
      ? { ...current.progression, ...updates.progression }
      : current.progression,
    calendar: updates.calendar
      ? { ...current.calendar, ...updates.calendar }
      : current.calendar,
    websiteImport: updates.websiteImport
      ? { ...current.websiteImport, ...updates.websiteImport }
      : current.websiteImport,
    makerRun: updates.makerRun
      ? { ...current.makerRun, ...updates.makerRun }
      : current.makerRun,
    archive: updates.archive
      ? { ...current.archive, ...updates.archive }
      : current.archive,
    reminders: updates.reminders
      ? { ...current.reminders, ...updates.reminders }
      : current.reminders,
    myphoner: updates.myphoner
      ? { ...(current.myphoner || {}), ...updates.myphoner }
      : current.myphoner,
    updatedAt: nowIso(),
  });
  state[index] = next;
  writeState(state);
  return next;
}

export function deleteSalesClient(id) {
  const state = readState();
  const next = state.filter((entry) => entry.id !== id);
  if (next.length === state.length) return false;
  writeState(next);
  return true;
}

export function setSalesProgress(id, key, value) {
  if (!PROGRESSION_KEYS.includes(key)) return null;
  const current = getSalesClientById(id);
  if (!current) return null;
  if (isSsuSalesProduct(current.product) && !SSU_PROGRESSION_KEYS.includes(key)) {
    return current;
  }
  return updateSalesClient(id, {
    progression: {
      [key]: Boolean(value),
    },
  });
}

/** Stamp product brackets from MyPhoner list metadata for existing rows. */
export function backfillSalesClientProducts({ forceFromList = true } = {}) {
  const state = readState();
  let updated = 0;
  const next = state.map((client) => {
    const fromList = resolveSalesProductFromMyphoner({
      listId: client.myphoner?.listId,
      listName: client.myphoner?.listName,
    });
    const previous = normalizeSalesProduct(client.product);
    const product = forceFromList
      ? fromList
      : previous || fromList;
    if (product === previous && client.product === product) return client;
    updated += 1;
    return normalizeSalesClient({
      ...client,
      product,
      updatedAt: nowIso(),
    });
  });
  writeState(next);
  return {
    total: next.length,
    updated,
    ssu: next.filter((entry) => entry.product === 'ssu').length,
    asoldi: next.filter((entry) => entry.product === 'asoldi').length,
  };
}

export function setSalesCalendar(id, calendarPatch = {}) {
  return updateSalesClient(id, { calendar: calendarPatch });
}

export function setSalesWebsiteImport(id, importPatch = {}) {
  return updateSalesClient(id, { websiteImport: importPatch });
}

export function setSalesMakerRun(id, makerPatch = {}) {
  return updateSalesClient(id, { makerRun: makerPatch });
}

export function setSalesStatus(id, status, archivePatch = {}) {
  const normalizedStatus = normalizeSalesStatus(status);
  if (normalizedStatus === 'not-sold' || normalizedStatus === 'secondary') {
    return updateSalesClient(id, {
      status: normalizedStatus,
      archive: {
        archivedAt: sanitizeText(archivePatch.archivedAt) || nowIso(),
        reason: sanitizeText(archivePatch.reason),
      },
    });
  }
  return updateSalesClient(id, {
    status: normalizedStatus,
    archive: {
      archivedAt: '',
      reason: '',
    },
  });
}

export function rescheduleSalesReminders(id, nowMs = Date.now()) {
  const current = getSalesClientById(id);
  if (!current) return null;
  const schedule = deriveReminderSchedule(current, nowMs);
  return updateSalesClient(id, {
    reminders: {
      reminder24hAt: schedule.reminder24hAt,
      reminder1hAt: schedule.reminder1hAt,
      reminder24hSentAt: '',
      reminder1hSentAt: '',
      skipDueToShortNotice: schedule.skipDueToShortNotice,
    },
  });
}

export function markSalesReminderSent(id, key, at = nowIso()) {
  const patch = {};
  if (key === 'thankYou') patch.thankYouSentAt = at;
  if (key === '24h') patch.reminder24hSentAt = at;
  if (key === '1h') patch.reminder1hSentAt = at;
  if (!Object.keys(patch).length) return null;
  return updateSalesClient(id, { reminders: patch });
}

export function clearSalesMeetingScheduling(id) {
  return updateSalesClient(id, {
    reminders: {
      reminder24hAt: '',
      reminder1hAt: '',
      reminder24hSentAt: '',
      reminder1hSentAt: '',
      skipDueToShortNotice: false,
    },
    calendar: {
      eventId: '',
      htmlLink: '',
      meetLink: '',
      calendarId: '',
      accountKey: '',
      syncedAt: '',
    },
  });
}
