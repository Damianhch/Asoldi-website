import { existsSync, readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { google } from 'googleapis';
import { getDataFilePath, writeDataJson } from '../data/storage-path.js';

const LEGACY_TOKEN_PATH = getDataFilePath('google-calendar-token.json');
const TOKENS_PATH = getDataFilePath('google-calendar-tokens.json');
// calendar.events is enough: the app only creates/updates/deletes meeting events
// (incl. Google Meet conferenceData). It does NOT need full-calendar/settings access.
const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
const DEFAULT_ACCOUNT_KEY = 'default';

function sanitizeText(value = '') {
  return String(value ?? '').trim();
}

function normalizeAccountKey(accountKey) {
  return sanitizeText(accountKey) || DEFAULT_ACCOUNT_KEY;
}

function getConfig() {
  return {
    clientId: sanitizeText(process.env.GOOGLE_OAUTH_CLIENT_ID),
    clientSecret: sanitizeText(process.env.GOOGLE_OAUTH_CLIENT_SECRET),
    redirectUri: sanitizeText(process.env.GOOGLE_OAUTH_REDIRECT_URI),
    calendarId: sanitizeText(process.env.GOOGLE_CALENDAR_ID) || 'primary',
    timeZone: sanitizeText(process.env.GOOGLE_CALENDAR_TIMEZONE) || 'Europe/Oslo',
  };
}

function isConfigured(config = getConfig()) {
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

function createOAuthClient(config = getConfig()) {
  if (!isConfigured(config)) {
    throw new Error('Google Calendar OAuth is not configured. Missing GOOGLE_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI.');
  }
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

function readTokensMap() {
  let map = {};
  if (existsSync(TOKENS_PATH)) {
    try {
      const parsed = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
      if (parsed && typeof parsed === 'object') map = parsed;
    } catch {
      map = {};
    }
  }
  // One-time migration: fold a legacy single-account token into the map.
  if (!map[DEFAULT_ACCOUNT_KEY] && existsSync(LEGACY_TOKEN_PATH)) {
    try {
      const legacy = JSON.parse(readFileSync(LEGACY_TOKEN_PATH, 'utf8'));
      if (legacy && typeof legacy === 'object') {
        map[DEFAULT_ACCOUNT_KEY] = legacy;
        writeDataJson(TOKENS_PATH, map);
      }
    } catch {
      // Ignore malformed legacy token.
    }
  }
  return map;
}

function readToken(accountKey) {
  const map = readTokensMap();
  const token = map[normalizeAccountKey(accountKey)];
  return token && typeof token === 'object' ? token : null;
}

function saveToken(accountKey, token) {
  const key = normalizeAccountKey(accountKey);
  const map = readTokensMap();
  const payload = {
    ...(map[key] || {}),
    ...(token || {}),
    updatedAt: new Date().toISOString(),
  };
  map[key] = payload;
  writeDataJson(TOKENS_PATH, map);
  return payload;
}

function isTokenConnected(token) {
  return Boolean(token?.refresh_token || token?.access_token);
}

/** Copy an existing connected token onto one or more alias account keys. */
export function shareGoogleCalendarToken(fromAccountKey, aliasAccountKeys = []) {
  const sourceKey = normalizeAccountKey(fromAccountKey);
  const token = readToken(sourceKey);
  if (!isTokenConnected(token)) {
    return { shared: false, sharedTo: [] };
  }
  const sharedTo = [];
  const aliases = Array.isArray(aliasAccountKeys) ? aliasAccountKeys : [];
  for (const raw of aliases) {
    const aliasKey = normalizeAccountKey(raw);
    if (!aliasKey || aliasKey === sourceKey) continue;
    const existing = readToken(aliasKey) || {};
    const merged = {
      ...existing,
      ...token,
    };
    if (!merged.refresh_token && existing.refresh_token) {
      merged.refresh_token = existing.refresh_token;
    }
    saveToken(aliasKey, merged);
    sharedTo.push(aliasKey);
  }
  return { shared: sharedTo.length > 0, sharedTo };
}

/**
 * Pick which Google token bucket to use for sync.
 * Prefer an already-synced calendar account, then owner, then actor, then fallbacks.
 */
export function resolveCalendarSyncAccountKey({
  ownerId = '',
  actorAccountKey = '',
  fallbackAccountKeys = [],
  previousAccountKey = '',
} = {}) {
  const candidates = [
    sanitizeText(previousAccountKey),
    sanitizeText(ownerId),
    sanitizeText(actorAccountKey),
    ...(Array.isArray(fallbackAccountKeys) ? fallbackAccountKeys.map((key) => sanitizeText(key)) : []),
  ].filter(Boolean);

  const seen = new Set();
  for (const candidate of candidates) {
    const key = normalizeAccountKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    if (isTokenConnected(readToken(key))) return key;
  }

  return normalizeAccountKey(sanitizeText(ownerId) || sanitizeText(actorAccountKey) || sanitizeText(previousAccountKey));
}

async function getAuthorizedClient(accountKey) {
  const config = getConfig();
  const oauthClient = createOAuthClient(config);
  const token = readToken(accountKey);
  if (!token) {
    throw new Error('Google Calendar account is not connected yet.');
  }
  oauthClient.setCredentials(token);
  oauthClient.on('tokens', (tokens) => {
    if (!tokens) return;
    saveToken(accountKey, tokens);
  });
  await oauthClient.getAccessToken();
  return { oauthClient, config };
}

function safeIso(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(time).toISOString();
}

function extractFirstName(name = '') {
  const clean = sanitizeText(name);
  if (!clean) return 'der';
  return clean.split(/\s+/)[0] || 'der';
}

function meetingDurationMinutes(client = {}) {
  const value = Number(client?.meetingDurationMinutes || 0);
  if (Number.isFinite(value) && value > 0) return Math.round(value);
  return 30;
}

function formatMeetingDate(iso = '', timeZone = 'Europe/Oslo') {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return 'Avtales nærmere';
  return new Date(ms).toLocaleString('nb-NO', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: sanitizeText(timeZone) || 'Europe/Oslo',
  });
}

function buildEventSummary(client) {
  const businessName = sanitizeText(client?.businessName);
  const isOnline = sanitizeText(client?.meetingMode) === 'online';
  if (isOnline) {
    return `Takk for at du booker møte med oss - online møte${businessName ? ` · ${businessName}` : ''}`;
  }
  return `Takk for at du booker møte med oss - fysisk møte${businessName ? ` · ${businessName}` : ''}`;
}

function buildEventDescription(client, config = {}) {
  const isOnline = sanitizeText(client?.meetingMode) === 'online';
  const firstName = extractFirstName(client?.contactPerson);
  const mapQuery = sanitizeText(client?.meetingPlace);
  const mapsUrl = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : '';
  const lines = isOnline
    ? [
        'Takk for at du booker møte med oss',
        '',
        `Hei ${firstName},`,
        '',
        'Da gleder vi oss til å møtes for å planlegge neste steg sammen.',
        '',
        `Tid: ${formatMeetingDate(client?.meetingAt, config?.timeZone)}`,
        `Varighet: ca. ${meetingDurationMinutes(client)} minutter`,
        'Møtelenke vises automatisk i kalenderinvitasjonen.',
        '',
        'Passer ikke tidspunktet, svar på denne e-posten så finner vi en ny tid.',
        '',
        'Vennlig hilsen,',
        'Asoldi',
      ]
    : [
        'Takk for at du booker møte med oss',
        '',
        `Hei ${firstName},`,
        '',
        'Da gleder vi oss til å møtes for å gå gjennom mål og neste steg sammen.',
        '',
        `Tid: ${formatMeetingDate(client?.meetingAt, config?.timeZone)}`,
        `Varighet: ca. ${meetingDurationMinutes(client)} minutter`,
        `Adresse: ${sanitizeText(client?.meetingPlace) || 'Avtales nærmere'}`,
        mapsUrl ? `Kart: ${mapsUrl}` : '',
        '',
        'Passer ikke tidspunktet, svar på denne e-posten så finner vi en ny tid.',
        '',
        'Vennlig hilsen,',
        'Asoldi',
      ];
  return lines.filter(Boolean).join('\n');
}

function extractMeetLink(event) {
  if (event?.hangoutLink) return event.hangoutLink;
  const video = Array.isArray(event?.conferenceData?.entryPoints)
    ? event.conferenceData.entryPoints.find((entry) => entry?.entryPointType === 'video')
    : null;
  return sanitizeText(video?.uri);
}

export function getGoogleCalendarStatus(accountKey) {
  const config = getConfig();
  const token = readToken(accountKey);
  return {
    configured: isConfigured(config),
    connected: Boolean(token?.refresh_token || token?.access_token),
    calendarId: config.calendarId,
    redirectUri: config.redirectUri,
    tokenUpdatedAt: sanitizeText(token?.updatedAt),
    accountKey: normalizeAccountKey(accountKey),
  };
}

export function createGoogleCalendarAuthUrl(state = '') {
  const oauthClient = createOAuthClient(getConfig());
  return oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    state: sanitizeText(state),
  });
}

export async function exchangeGoogleCalendarCode(code, accountKey, aliasAccountKeys = []) {
  const oauthClient = createOAuthClient(getConfig());
  const trimmedCode = sanitizeText(code);
  if (!trimmedCode) throw new Error('Missing OAuth code.');
  const { tokens } = await oauthClient.getToken(trimmedCode);
  if (!tokens) throw new Error('Failed to exchange OAuth code for tokens.');

  const existing = readToken(accountKey) || {};
  const merged = {
    ...existing,
    ...tokens,
  };
  if (!merged.refresh_token && existing.refresh_token) {
    merged.refresh_token = existing.refresh_token;
  }
  saveToken(accountKey, merged);
  shareGoogleCalendarToken(accountKey, aliasAccountKeys);
  return getGoogleCalendarStatus(accountKey);
}

export async function deleteMeetingEvent(eventId, accountKey) {
  const id = sanitizeText(eventId);
  if (!id) return { deleted: false };
  const { oauthClient, config } = await getAuthorizedClient(accountKey);
  const calendar = google.calendar({ version: 'v3', auth: oauthClient });
  await calendar.events.delete({
    calendarId: config.calendarId,
    eventId: id,
    sendUpdates: 'none',
  });
  return { deleted: true };
}

export async function upsertMeetingEvent(client, existingEventId = '', accountKey, options = {}) {
  const { oauthClient, config } = await getAuthorizedClient(accountKey);
  const calendar = google.calendar({ version: 'v3', auth: oauthClient });

  const meetingAtIso = safeIso(client?.meetingAt);
  if (!meetingAtIso) throw new Error('Meeting date/time is missing or invalid.');
  const durationMinutes = meetingDurationMinutes(client);
  const endIso = new Date(new Date(meetingAtIso).getTime() + durationMinutes * 60 * 1000).toISOString();

  const attendees = [];
  const attendeeEmail = sanitizeText(client?.contactEmail);
  if (attendeeEmail) {
    attendees.push({
      email: attendeeEmail,
      displayName: sanitizeText(client?.contactPerson) || sanitizeText(client?.businessName) || undefined,
    });
  }

  const isOnline = sanitizeText(client?.meetingMode) === 'online';
  const sendUpdates = sanitizeText(options?.sendUpdates).toLowerCase() === 'all' ? 'all' : 'none';
  const eventId = sanitizeText(existingEventId || client?.calendar?.eventId);
  const shouldRequestConference = isOnline && (!eventId || !sanitizeText(client?.calendar?.meetLink));
  const eventBody = {
    summary: buildEventSummary(client),
    description: buildEventDescription(client, config),
    start: {
      dateTime: meetingAtIso,
      timeZone: config.timeZone,
    },
    end: {
      dateTime: endIso,
      timeZone: config.timeZone,
    },
    attendees,
    location: isOnline ? undefined : sanitizeText(client?.meetingPlace),
    reminders: {
      useDefault: true,
    },
  };

  if (shouldRequestConference) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  let response;
  if (eventId) {
    response = await calendar.events.update({
      calendarId: config.calendarId,
      eventId,
      requestBody: eventBody,
      sendUpdates,
      conferenceDataVersion: shouldRequestConference ? 1 : 0,
    });
  } else {
    response = await calendar.events.insert({
      calendarId: config.calendarId,
      requestBody: eventBody,
      sendUpdates,
      conferenceDataVersion: shouldRequestConference ? 1 : 0,
    });
  }

  const event = response?.data || {};
  return {
    eventId: sanitizeText(event.id),
    htmlLink: sanitizeText(event.htmlLink),
    meetLink: sanitizeText(extractMeetLink(event)),
    calendarId: config.calendarId,
    accountKey: normalizeAccountKey(accountKey),
    syncedAt: new Date().toISOString(),
  };
}
