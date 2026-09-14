import { formatMailbox, parseMailbox, readResendConfig } from './email.js';

function sanitize(value = '') {
  return String(value ?? '').trim();
}

function compactLetters(value = '') {
  return sanitize(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function isGenericBrandName(value = '') {
  const compact = compactLetters(value);
  return !compact
    || compact === 'asoldi'
    || compact === 'asoldicom'
    || compact === 'admin'
    || compact === 'contact'
    || compact === 'user';
}

function isGenericAsoldiMailbox(address = '') {
  const email = parseMailbox(address).address;
  return !email
    || email === 'contact@asoldi.com'
    || email === 'asoldi@asoldi.com'
    || email === 'admin@asoldi.com';
}

export function titleCaseFirst(value = '') {
  const raw = sanitize(value);
  if (!raw) return '';
  return `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
}

function firstToken(value = '') {
  const raw = sanitize(value);
  if (!raw) return '';
  if (raw.includes('@')) return titleCaseFirst(raw.split('@')[0]);
  return titleCaseFirst(raw.split(/\s+/)[0]);
}

export function firstNameFromProfile(profile = {}) {
  const named = firstToken(profile.name);
  if (named && !isGenericBrandName(named)) return named;
  const googleNamed = firstToken(profile.googleName);
  if (googleNamed && !isGenericBrandName(googleNamed)) return googleNamed;
  const username = firstToken(profile.username);
  if (username && !isGenericBrandName(username)) return username;
  return 'Asoldi';
}

export function asoldiAddress(value = '', fallback = '') {
  const address = parseMailbox(value).address;
  if (address.endsWith('@asoldi.com') && !isGenericAsoldiMailbox(address)) return address;
  const fallbackAddress = parseMailbox(fallback).address;
  if (fallbackAddress.endsWith('@asoldi.com') && !isGenericAsoldiMailbox(fallbackAddress)) {
    return fallbackAddress;
  }
  if (fallbackAddress.endsWith('@asoldi.com')) return fallbackAddress;
  return 'contact@asoldi.com';
}

export function normalizeAsoldiFromEmail(value = '') {
  const address = parseMailbox(value).address;
  return address.endsWith('@asoldi.com') ? address : '';
}

export function fallbackFromHeader() {
  return sanitize(readResendConfig().from) || 'Asoldi <contact@asoldi.com>';
}

function mailboxFromUsername(username = '') {
  const address = parseMailbox(username).address || sanitize(username).toLowerCase();
  if (address.endsWith('@asoldi.com') && !isGenericAsoldiMailbox(address)) return address;
  return '';
}

function mailboxFromFirstName(name = '') {
  const local = compactLetters(firstToken(name));
  if (!local || isGenericBrandName(local)) return '';
  return `${local}@asoldi.com`;
}

export function buildSalesSender(profile = {}, fallbackFrom = fallbackFromHeader()) {
  const name = firstNameFromProfile(profile);
  const fromEmail = mailboxFromUsername(profile.username)
    || mailboxFromUsername(profile.googleEmail)
    || mailboxFromUsername(profile.fromEmail)
    || mailboxFromFirstName(name)
    || asoldiAddress('', fallbackFrom);
  return {
    name,
    fullName: (!isGenericBrandName(profile.name) && sanitize(profile.name)) || name,
    fromEmail,
    from: formatMailbox(`${name} fra Asoldi`, fromEmail),
    replyTo: fromEmail,
  };
}
