import { existsSync, readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { google } from 'googleapis';
import { getDataFilePath, writeDataJson } from '../data/storage-path.js';

const TOKEN_PATH = getDataFilePath('google-calendar-token.json');
const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar'];

function sanitizeText(value = '') {
  return String(value ?? '').trim();
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

function readToken() {
  if (!existsSync(TOKEN_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function saveToken(token) {
  const payload = {
    ...(readToken() || {}),
    ...(token || {}),
    updatedAt: new Date().toISOString(),
  };
  writeDataJson(TOKEN_PATH, payload);
  return payload;
}

async function getAuthorizedClient() {
  const config = getConfig();
  const oauthClient = createOAuthClient(config);
  const token = readToken();
  if (!token) {
    throw new Error('Google Calendar account is not connected yet.');
  }
  oauthClient.setCredentials(token);
  oauthClient.on('tokens', (tokens) => {
    if (!tokens) return;
    saveToken(tokens);
  });
  await oauthClient.getAccessToken();
  return { oauthClient, config };
}

function safeIso(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(time).toISOString();
}

function buildEventDescription(client) {
  const mapQuery = sanitizeText(client.businessAddress || client.meetingPlace);
  const mapsUrl = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : '';
  const lines = [
    `Business: ${sanitizeText(client.businessName) || '—'}`,
    `Contact person: ${sanitizeText(client.contactPerson) || '—'}`,
    `Contact email: ${sanitizeText(client.contactEmail) || '—'}`,
    `Contact phone: ${sanitizeText(client.contactPhone) || '—'}`,
    `Industry: ${sanitizeText(client.industry) || '—'}`,
    `Meeting mode: ${sanitizeText(client.meetingMode) || '—'}`,
    `Meeting place: ${sanitizeText(client.meetingPlace) || '—'}`,
    `Address: ${sanitizeText(client.businessAddress) || '—'}`,
    mapsUrl ? `Google Maps: ${mapsUrl}` : '',
    '',
    'Meeting booked through Asoldi Sales admin.',
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

export function getGoogleCalendarStatus() {
  const config = getConfig();
  const token = readToken();
  return {
    configured: isConfigured(config),
    connected: Boolean(token?.refresh_token || token?.access_token),
    calendarId: config.calendarId,
    redirectUri: config.redirectUri,
    tokenUpdatedAt: sanitizeText(token?.updatedAt),
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

export async function exchangeGoogleCalendarCode(code) {
  const oauthClient = createOAuthClient(getConfig());
  const trimmedCode = sanitizeText(code);
  if (!trimmedCode) throw new Error('Missing OAuth code.');
  const { tokens } = await oauthClient.getToken(trimmedCode);
  if (!tokens) throw new Error('Failed to exchange OAuth code for tokens.');

  const existing = readToken() || {};
  const merged = {
    ...existing,
    ...tokens,
  };
  if (!merged.refresh_token && existing.refresh_token) {
    merged.refresh_token = existing.refresh_token;
  }
  saveToken(merged);
  return getGoogleCalendarStatus();
}

export async function deleteMeetingEvent(eventId) {
  const id = sanitizeText(eventId);
  if (!id) return { deleted: false };
  const { oauthClient, config } = await getAuthorizedClient();
  const calendar = google.calendar({ version: 'v3', auth: oauthClient });
  await calendar.events.delete({
    calendarId: config.calendarId,
    eventId: id,
    sendUpdates: 'none',
  });
  return { deleted: true };
}

export async function upsertMeetingEvent(client, existingEventId = '') {
  const { oauthClient, config } = await getAuthorizedClient();
  const calendar = google.calendar({ version: 'v3', auth: oauthClient });

  const meetingAtIso = safeIso(client?.meetingAt);
  if (!meetingAtIso) throw new Error('Meeting date/time is missing or invalid.');
  const durationMinutes = Number(client?.meetingDurationMinutes || (client?.meetingMode === 'in-person' ? 60 : 30));
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
  const eventBody = {
    summary: `${sanitizeText(client?.businessName) || 'Prospect'} · Sales meeting`,
    description: buildEventDescription(client),
    start: {
      dateTime: meetingAtIso,
      timeZone: config.timeZone,
    },
    end: {
      dateTime: endIso,
      timeZone: config.timeZone,
    },
    attendees,
    location: isOnline ? undefined : sanitizeText(client?.businessAddress || client?.meetingPlace),
    reminders: {
      useDefault: true,
    },
  };

  if (isOnline) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const eventId = sanitizeText(existingEventId || client?.calendar?.eventId);
  let response;
  if (eventId) {
    response = await calendar.events.update({
      calendarId: config.calendarId,
      eventId,
      requestBody: eventBody,
      sendUpdates: 'all',
      conferenceDataVersion: isOnline ? 1 : 0,
    });
  } else {
    response = await calendar.events.insert({
      calendarId: config.calendarId,
      requestBody: eventBody,
      sendUpdates: 'all',
      conferenceDataVersion: isOnline ? 1 : 0,
    });
  }

  const event = response?.data || {};
  return {
    eventId: sanitizeText(event.id),
    htmlLink: sanitizeText(event.htmlLink),
    meetLink: sanitizeText(extractMeetLink(event)),
    calendarId: config.calendarId,
    syncedAt: new Date().toISOString(),
  };
}
