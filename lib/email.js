import nodemailer from 'nodemailer';

let primaryTransporter = null;
let fallbackTransporter = null;

function normalizeHeaderValue(value) {
  return String(value || '').trim();
}

function normalizeSecretValue(value) {
  let cleaned = String(value || '').trim();
  // Hostinger/env UIs sometimes persist the value with wrapping quotes.
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length >= 2)
    || (cleaned.startsWith("'") && cleaned.endsWith("'") && cleaned.length >= 2)
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

function readSmtpConfig(prefix = 'SMTP') {
  const host = normalizeHeaderValue(process.env[`${prefix}_HOST`]);
  const port = Number(process.env[`${prefix}_PORT`]) || 587;
  const user = normalizeHeaderValue(process.env[`${prefix}_USER`]);
  const pass = normalizeSecretValue(process.env[`${prefix}_PASS`]);
  return { host, port, user, pass };
}

function hasSmtpCredentials(config = {}) {
  return Boolean(config.host && config.user && config.pass);
}

function createTransporter(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });
}

function getPrimaryTransporter() {
  if (primaryTransporter) return primaryTransporter;
  const config = readSmtpConfig('SMTP');
  if (!hasSmtpCredentials(config)) return null;
  primaryTransporter = createTransporter(config);
  return primaryTransporter;
}

function getFallbackTransporter() {
  if (fallbackTransporter) return fallbackTransporter;
  const config = readSmtpConfig('SMTP_FALLBACK');
  if (!hasSmtpCredentials(config)) return null;
  fallbackTransporter = createTransporter(config);
  return fallbackTransporter;
}

function resolveFromHeader(prefix = 'SMTP') {
  const explicit = normalizeHeaderValue(process.env[`${prefix}_FROM`]);
  if (explicit) return explicit;
  return 'Asoldi <kontakt@asoldi.com>';
}

function resolveReplyToHeader(explicitReplyTo = '', prefix = 'SMTP') {
  const direct = normalizeHeaderValue(explicitReplyTo);
  if (direct) return direct;
  const prefixed = normalizeHeaderValue(process.env[`${prefix}_REPLY_TO`]);
  if (prefixed) return prefixed;
  return normalizeHeaderValue(process.env.SMTP_REPLY_TO);
}

function resolveBccHeader(explicitBcc = '') {
  const direct = normalizeHeaderValue(explicitBcc);
  if (direct) return direct;
  const fromEnv = normalizeHeaderValue(process.env.SMTP_BCC);
  if (fromEnv) return fromEnv;
  // Keep a delivery copy in the mailbox used for SMTP auth (API sends do not
  // appear in Sent unless the provider stores them).
  const user = normalizeHeaderValue(process.env.SMTP_USER);
  return user || '';
}

function buildMessage(payload, prefix = 'SMTP') {
  const { to, subject, text, html, replyTo, bcc, attachments, headers, icalEvent } = payload || {};
  const from = resolveFromHeader(prefix);
  const resolvedReplyTo = resolveReplyToHeader(replyTo, prefix);
  const resolvedBcc = resolveBccHeader(bcc);
  return {
    from,
    to,
    subject,
    text: text || undefined,
    html: html || undefined,
    replyTo: resolvedReplyTo || undefined,
    bcc: resolvedBcc || undefined,
    attachments: Array.isArray(attachments) && attachments.length ? attachments : undefined,
    headers: headers && typeof headers === 'object' ? headers : undefined,
    icalEvent: icalEvent && typeof icalEvent === 'object' ? icalEvent : undefined,
  };
}

export function canSendEmail() {
  return hasSmtpCredentials(readSmtpConfig('SMTP')) || hasSmtpCredentials(readSmtpConfig('SMTP_FALLBACK'));
}

export async function sendEmail({ to, subject, text, html, replyTo, bcc, attachments, headers, icalEvent }) {
  const payload = { to, subject, text, html, replyTo, bcc, attachments, headers, icalEvent };
  const primary = getPrimaryTransporter();
  const fallback = getFallbackTransporter();
  if (!primary && !fallback) throw new Error('SMTP not configured');
  if (primary) {
    try {
      await primary.sendMail(buildMessage(payload, 'SMTP'));
      return;
    } catch (primaryError) {
      if (!fallback) throw primaryError;
      try {
        await fallback.sendMail(buildMessage(payload, 'SMTP_FALLBACK'));
        return;
      } catch (fallbackError) {
        const primaryMessage = normalizeHeaderValue(primaryError?.message || primaryError);
        const fallbackMessage = normalizeHeaderValue(fallbackError?.message || fallbackError);
        throw new Error(`Primary SMTP failed: ${primaryMessage || 'unknown error'}; fallback SMTP failed: ${fallbackMessage || 'unknown error'}`);
      }
    }
  }
  await fallback.sendMail(buildMessage(payload, 'SMTP_FALLBACK'));
}
