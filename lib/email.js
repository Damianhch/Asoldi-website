import nodemailer from 'nodemailer';

export function stripWrappingQuotes(value = '') {
  let cleaned = String(value ?? '').trim();
  while (
    (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length >= 2)
    || (cleaned.startsWith("'") && cleaned.endsWith("'") && cleaned.length >= 2)
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

export function parseMailbox(value = '') {
  const raw = stripWrappingQuotes(value);
  if (!raw) return { name: '', address: '' };
  const match = raw.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return {
      name: stripWrappingQuotes(match[1]),
      address: stripWrappingQuotes(match[2]).toLowerCase(),
    };
  }
  return { name: '', address: raw.toLowerCase() };
}

export function formatMailbox(name = '', address = '') {
  const email = stripWrappingQuotes(address).toLowerCase();
  if (!email) return '';
  const display = stripWrappingQuotes(name);
  return display ? `${display} <${email}>` : email;
}

export function resolveSmtpFrom(fromValue = '', authUser = '') {
  const fallback = parseMailbox(authUser);
  const parsed = parseMailbox(fromValue);
  const address = parsed.address || fallback.address;
  if (!address) return '';
  // Hostinger rejects mail when the From address is not the authenticated mailbox.
  const authAddress = fallback.address;
  const finalAddress = authAddress && address !== authAddress ? authAddress : address;
  return formatMailbox(parsed.name || 'Asoldi', finalAddress);
}

function readSmtpConfig(prefix = 'SMTP') {
  const host = stripWrappingQuotes(process.env[`${prefix}_HOST`]);
  const port = Number(stripWrappingQuotes(process.env[`${prefix}_PORT`])) || 587;
  const user = stripWrappingQuotes(process.env[`${prefix}_USER`]).toLowerCase();
  const pass = stripWrappingQuotes(process.env[`${prefix}_PASS`]);
  const from = resolveSmtpFrom(process.env[`${prefix}_FROM`], user);
  return { host, port, user, pass, from };
}

function hasSmtpCredentials(config = {}) {
  return Boolean(config.host && config.user && config.pass);
}

function createTransporter(config) {
  const port = Number(config.port) || 587;
  return nodemailer.createTransport({
    host: config.host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
}

function resolveReplyToHeader(explicitReplyTo = '', prefix = 'SMTP') {
  const direct = stripWrappingQuotes(explicitReplyTo);
  if (direct) return direct;
  const prefixed = stripWrappingQuotes(process.env[`${prefix}_REPLY_TO`]);
  if (prefixed) return prefixed;
  return stripWrappingQuotes(process.env.SMTP_REPLY_TO);
}

export function resolveBccHeader(explicitBcc, to = '', prefix = 'SMTP') {
  if (explicitBcc === false || explicitBcc === null) return '';
  const candidate = explicitBcc === undefined
    ? (stripWrappingQuotes(process.env.SMTP_BCC) || stripWrappingQuotes(process.env[`${prefix}_USER`]))
    : stripWrappingQuotes(explicitBcc);
  if (!candidate) return '';
  const toAddress = parseMailbox(to).address;
  const bccAddress = parseMailbox(candidate).address;
  if (toAddress && bccAddress && toAddress === bccAddress) return '';
  return candidate;
}

function buildMessage(payload, prefix = 'SMTP') {
  const config = readSmtpConfig(prefix);
  const {
    to,
    subject,
    text,
    html,
    replyTo,
    bcc,
    attachments,
    headers,
    icalEvent,
    from: explicitFrom,
  } = payload || {};
  const from = resolveSmtpFrom(explicitFrom || config.from, config.user);
  const resolvedReplyTo = resolveReplyToHeader(replyTo, prefix);
  const resolvedBcc = resolveBccHeader(bcc, to, prefix);
  return {
    from,
    envelope: config.user ? { from: config.user, to } : undefined,
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

async function sendViaPrefix(payload, prefix) {
  const config = readSmtpConfig(prefix);
  if (!hasSmtpCredentials(config)) return false;
  const transporter = createTransporter(config);
  await transporter.sendMail(buildMessage(payload, prefix));
  return true;
}

export async function sendEmail({ to, subject, text, html, replyTo, bcc, attachments, headers, icalEvent, from }) {
  const payload = { to, subject, text, html, replyTo, bcc, attachments, headers, icalEvent, from };
  let primaryError = null;
  try {
    if (await sendViaPrefix(payload, 'SMTP')) return;
  } catch (error) {
    primaryError = error;
  }
  try {
    if (await sendViaPrefix(payload, 'SMTP_FALLBACK')) return;
  } catch (fallbackError) {
    if (primaryError) {
      throw new Error(
        `Primary SMTP failed: ${stripWrappingQuotes(primaryError?.message || primaryError) || 'unknown error'}; fallback SMTP failed: ${stripWrappingQuotes(fallbackError?.message || fallbackError) || 'unknown error'}`
      );
    }
    throw fallbackError;
  }
  if (primaryError) throw primaryError;
  throw new Error('SMTP not configured');
}
