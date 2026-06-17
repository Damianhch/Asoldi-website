import { readFileSync, existsSync } from 'fs';
import { getDataFilePath, ensurePersistentDataDir, writeDataJson } from './storage-path.js';

const SALES_PATH = getDataFilePath('sales-clients.json');

const PROGRESSION_KEYS = ['step0AgreeMeetingTime', 'paymentReceived', 'domainConnected', 'live'];

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

function normalizeMeetingMode(value) {
  const raw = sanitizeText(value).toLowerCase();
  if (raw === 'online') return 'online';
  if (raw === 'in-person' || raw === 'in_person' || raw === 'inperson' || raw === 'physical') return 'in-person';
  return 'online';
}

function durationForMode(mode) {
  return mode === 'in-person' ? 60 : 30;
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
    step0AgreeMeetingTime: Boolean(agreedTime),
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
  };
}

function normalizeCalendar(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    eventId: sanitizeText(input.eventId),
    htmlLink: sanitizeText(input.htmlLink),
    meetLink: sanitizeText(input.meetLink),
    calendarId: sanitizeText(input.calendarId),
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

function normalizeSalesClient(raw = {}) {
  const meetingMode = normalizeMeetingMode(raw.meetingMode);
  const agreedTime = Boolean(raw.agreedTime);
  const meetingAt = agreedTime ? sanitizeText(raw.meetingAt) : '';
  const createdAt = sanitizeText(raw.createdAt) || nowIso();
  const updatedAt = sanitizeText(raw.updatedAt) || createdAt;

  return {
    id: sanitizeText(raw.id) || makeId(),
    businessName: sanitizeText(raw.businessName),
    contactPerson: sanitizeText(raw.contactPerson),
    contactEmail: sanitizeText(raw.contactEmail),
    contactPhone: sanitizeText(raw.contactPhone),
    meetingPlace: sanitizeText(raw.meetingPlace),
    businessAddress: sanitizeText(raw.businessAddress),
    industry: sanitizeText(raw.industry),
    meetingMode,
    meetingDurationMinutes: durationForMode(meetingMode),
    agreedTime,
    meetingAt,
    websiteDomain: sanitizeText(raw.websiteDomain),
    details: raw.details && typeof raw.details === 'object' ? raw.details : {},
    progression: normalizeProgression(raw.progression, agreedTime),
    reminders: normalizeReminders(raw.reminders || emptyReminders()),
    calendar: normalizeCalendar(raw.calendar),
    websiteImport: normalizeWebsiteImport(raw.websiteImport),
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
    reminders: updates.reminders
      ? { ...current.reminders, ...updates.reminders }
      : current.reminders,
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
  return updateSalesClient(id, {
    progression: {
      [key]: Boolean(value),
    },
  });
}

export function setSalesCalendar(id, calendarPatch = {}) {
  return updateSalesClient(id, { calendar: calendarPatch });
}

export function setSalesWebsiteImport(id, importPatch = {}) {
  return updateSalesClient(id, { websiteImport: importPatch });
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
      syncedAt: '',
    },
  });
}
