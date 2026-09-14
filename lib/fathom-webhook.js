import { createHmac, timingSafeEqual } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { getDataFilePath, writeDataJson } from '../data/storage-path.js';
import { sendEmail } from './email.js';

const NOTIFIED_PATH = getDataFilePath('fathom-notified.json');
const DEFAULT_NOTIFY_EMAIL = 'ansatte@asoldi.com';
const SIGNATURE_MAX_AGE_SECONDS = 5 * 60;

function sanitize(value = '') {
  return String(value ?? '').trim();
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function splitSecrets(value = '') {
  return String(value || '')
    .split(/[,;\s]+/)
    .map((entry) => sanitize(entry))
    .filter(Boolean);
}

export function readFathomWebhookConfig(env = process.env) {
  const secrets = [
    ...splitSecrets(env.FATHOM_WEBHOOK_SECRET),
    ...splitSecrets(env.FATHOM_WEBHOOK_SECRETS),
  ];
  return {
    secrets: [...new Set(secrets)],
    token: sanitize(env.FATHOM_WEBHOOK_TOKEN),
    notifyEmail: sanitize(env.FATHOM_NOTIFY_EMAIL) || DEFAULT_NOTIFY_EMAIL,
  };
}

export function isFathomWebhookConfigured(config = readFathomWebhookConfig()) {
  return Boolean(config.token || config.secrets.length);
}

function equal(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  if (!a.length || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function secretKey(secret = '') {
  const raw = sanitize(secret);
  const encoded = raw.startsWith('whsec_') ? raw.slice('whsec_'.length) : raw;
  return Buffer.from(encoded, 'base64');
}

export function verifyFathomSignature(secret, headers = {}, rawBody = '') {
  const webhookId = sanitize(headers['webhook-id'] || headers['Webhook-Id']);
  const webhookTimestamp = sanitize(headers['webhook-timestamp'] || headers['Webhook-Timestamp']);
  const webhookSignature = sanitize(headers['webhook-signature'] || headers['Webhook-Signature']);
  if (!secret || !webhookId || !webhookTimestamp || !webhookSignature) return false;
  const timestamp = Number.parseInt(webhookTimestamp, 10);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > SIGNATURE_MAX_AGE_SECONDS) return false;
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expected = createHmac('sha256', secretKey(secret)).update(signedContent).digest('base64');
  const signatures = webhookSignature.split(/\s+/).map((entry) => {
    const parts = entry.split(',');
    return parts.length > 1 ? parts.slice(1).join(',') : parts[0];
  });
  return signatures.some((signature) => equal(expected, signature));
}

export function authorizeFathomWebhook({ headers = {}, query = {}, rawBody = '' } = {}, config = readFathomWebhookConfig()) {
  if (!isFathomWebhookConfigured(config)) {
    return { ok: false, status: 503, reason: 'not-configured' };
  }
  const queryToken = sanitize(query.token || query.secret);
  if (config.token && queryToken && equal(config.token, queryToken)) {
    return { ok: true, via: 'token' };
  }
  if (config.secrets.some((secret) => verifyFathomSignature(secret, headers, rawBody))) {
    return { ok: true, via: 'signature' };
  }
  return { ok: false, status: 401, reason: 'unauthorized' };
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

export function unwrapFathomPayload(body = {}) {
  if (!body || typeof body !== 'object') return {};
  const nested = body.recording || body.meeting || body.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return { ...nested, ...body };
  }
  return body;
}

function inviteeLine(entry = {}) {
  const name = sanitize(entry.name || entry.display_name);
  const email = sanitize(entry.email);
  if (name && email) return `${name} <${email}>`;
  return name || email;
}

function transcriptItems(payload = {}) {
  const transcript = payload.transcript;
  if (Array.isArray(transcript)) return transcript;
  if (Array.isArray(transcript?.items)) return transcript.items;
  return [];
}

export function formatFathomTranscript(payload = {}) {
  return transcriptItems(payload).map((item) => {
    const speaker = sanitize(
      item?.speaker?.display_name
      || item?.speaker?.name
      || (typeof item?.speaker === 'string' ? item.speaker : '')
      || item?.speaker_name
      || 'Ukjent'
    );
    const text = sanitize(item?.text || item?.content || item?.utterance);
    return text ? `${speaker}: ${text}` : '';
  }).filter(Boolean).join('\n');
}

function actionItemText(item = {}) {
  return sanitize(item.description || item.title || item.text || item.markdown_formatted);
}

export function formatFathomActionItems(payload = {}) {
  return asList(payload.action_items || payload.actionItems)
    .map((item) => actionItemText(item))
    .filter(Boolean);
}

export function formatFathomSummary(payload = {}) {
  const summary = payload.summary || payload.default_summary || payload.call_summary;
  if (typeof summary === 'string') return sanitize(summary);
  return sanitize(summary?.markdown_formatted || summary?.text || '');
}

function formatWhen(iso = '') {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleString('nb-NO', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Oslo',
  });
}

export function recordingIdFromPayload(payload = {}) {
  return sanitize(payload.recording_id || payload.recordingId || payload.id);
}

export function buildFathomNotifyEmail(payload = {}, notifyEmail = DEFAULT_NOTIFY_EMAIL) {
  const meeting = unwrapFathomPayload(payload);
  const title = sanitize(meeting.title || meeting.meeting_title || 'Fathom-møte');
  const recordedBy = inviteeLine(meeting.recorded_by || meeting.recordedBy || {});
  const when = formatWhen(meeting.recording_start_time || meeting.scheduled_start_time || meeting.created_at);
  const shareUrl = sanitize(meeting.share_url || meeting.shareUrl);
  const appUrl = sanitize(meeting.url);
  const videoUrl = shareUrl || appUrl;
  const invitees = asList(meeting.calendar_invitees || meeting.attendees).map(inviteeLine).filter(Boolean);
  const summary = formatFathomSummary(meeting);
  const actionItems = formatFathomActionItems(meeting);
  const transcript = formatFathomTranscript(meeting);
  const lines = [
    `Møte: ${title}`,
    when ? `Tid: ${when}` : '',
    recordedBy ? `Salgsrep (Fathom): ${recordedBy}` : '',
    invitees.length ? `Deltakere: ${invitees.join(', ')}` : '',
    videoUrl ? `Video: ${videoUrl}` : 'Video: ingen lenke i webhooken — åpne opptaket i Fathom.',
    appUrl && shareUrl && appUrl !== shareUrl ? `Fathom: ${appUrl}` : '',
    '',
    summary ? `Sammendrag:\n${summary}` : '',
    actionItems.length ? `Action items:\n${actionItems.map((item) => `- ${item}`).join('\n')}` : '',
    transcript ? `Transkript:\n${transcript}` : 'Ingen transkript i denne webhooken.',
  ].filter((line, index, all) => line !== '' || (index > 0 && all[index - 1] !== ''));

  const videoHtml = videoUrl
    ? `<p style="margin:16px 0 8px;">
        <a href="${escapeHtml(videoUrl)}" style="display:inline-block;background:#FF5B00;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700;">Åpne video</a>
      </p>
      <p style="margin:0 0 16px;"><a href="${escapeHtml(videoUrl)}">${escapeHtml(videoUrl)}</a></p>`
    : '<p style="margin:0 0 16px;">Ingen videolenke i webhooken — åpne opptaket i Fathom.</p>';

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.45;">
      <p style="margin:0 0 12px;"><strong>${escapeHtml(title)}</strong></p>
      ${when ? `<p style="margin:0 0 8px;">Tid: ${escapeHtml(when)}</p>` : ''}
      ${recordedBy ? `<p style="margin:0 0 8px;">Salgsrep: ${escapeHtml(recordedBy)}</p>` : ''}
      ${invitees.length ? `<p style="margin:0 0 8px;">Deltakere: ${escapeHtml(invitees.join(', '))}</p>` : ''}
      ${videoHtml}
      ${summary ? `<h3 style="margin:16px 0 8px;font-size:15px;">Sammendrag</h3><pre style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(summary)}</pre>` : ''}
      ${actionItems.length ? `<h3 style="margin:16px 0 8px;font-size:15px;">Action items</h3><ul>${actionItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
      ${transcript ? `<h3 style="margin:16px 0 8px;font-size:15px;">Transkript</h3><p style="margin:0 0 8px;color:#5b5b5b;">Full tekst ligger også som vedlegg.</p>` : ''}
    </div>
  `;

  const attachments = transcript
    ? [{
      filename: `fathom-transcript-${recordingIdFromPayload(meeting) || 'meeting'}.txt`,
      content: Buffer.from(transcript, 'utf8'),
      contentType: 'text/plain; charset=utf-8',
    }]
    : [];

  return {
    to: notifyEmail,
    subject: `Fathom: ${title}${recordedBy ? ` — ${recordedBy}` : ''}`,
    text: lines.join('\n'),
    html,
    attachments,
    recordingId: recordingIdFromPayload(meeting),
    videoUrl,
  };
}

function readNotifiedMap() {
  if (!existsSync(NOTIFIED_PATH)) return {};
  try {
    const parsed = JSON.parse(readFileSync(NOTIFIED_PATH, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function wasFathomRecordingNotified(recordingId) {
  const id = sanitize(recordingId);
  if (!id) return false;
  return Boolean(readNotifiedMap()[id]);
}

export function markFathomRecordingNotified(recordingId) {
  const id = sanitize(recordingId);
  if (!id) return;
  const map = readNotifiedMap();
  map[id] = new Date().toISOString();
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  for (const [key, value] of Object.entries(map)) {
    const at = Date.parse(value);
    if (Number.isFinite(at) && at < cutoff) delete map[key];
  }
  writeDataJson(NOTIFIED_PATH, map);
}

export async function notifyFathomRecording(payload, config = readFathomWebhookConfig()) {
  const email = buildFathomNotifyEmail(payload, config.notifyEmail);
  if (email.recordingId && wasFathomRecordingNotified(email.recordingId)) {
    return { sent: false, reason: 'already-notified', recordingId: email.recordingId };
  }
  await sendEmail({
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
    attachments: email.attachments,
  });
  if (email.recordingId) markFathomRecordingNotified(email.recordingId);
  return { sent: true, recordingId: email.recordingId, to: email.to };
}
