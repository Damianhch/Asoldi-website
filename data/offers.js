import { readFileSync, existsSync } from 'fs';
import { getDataFilePath, ensurePersistentDataDir, writeDataJson } from './storage-path.js';

const OFFERS_PATH = getDataFilePath('client-offers.json');

// Website codes ("nettsidekode") are 2 uppercase letters + 2 digits, e.g. "QK74".
// Ambiguous characters (I, O, 0, 1) are excluded so codes are easy to read/share.
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_DIGITS = '23456789';

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

export function normalizeCode(value = '') {
  return sanitizeText(value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

function readOffersFile() {
  ensureDataDir();
  if (!existsSync(OFFERS_PATH)) return [];
  try {
    const parsed = JSON.parse(readFileSync(OFFERS_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOffersFile(list) {
  ensureDataDir();
  writeDataJson(OFFERS_PATH, list);
}

function normalizeOffer(raw = {}) {
  const createdAt = sanitizeText(raw.createdAt) || nowIso();
  return {
    id: sanitizeText(raw.id) || makeId(),
    code: normalizeCode(raw.code),
    ownerId: sanitizeText(raw.ownerId),
    salesClientId: sanitizeText(raw.salesClientId),
    planId: sanitizeText(raw.planId) || 'tier-1-standard',
    planName: sanitizeText(raw.planName),
    price: sanitizeText(raw.price),
    note: sanitizeText(raw.note),
    businessName: sanitizeText(raw.businessName),
    previewUrl: sanitizeText(raw.previewUrl),
    targetUserId: sanitizeText(raw.targetUserId),
    targetEmail: sanitizeText(raw.targetEmail).toLowerCase(),
    claimed: Boolean(raw.claimed),
    claimedAt: sanitizeText(raw.claimedAt),
    createdAt,
    updatedAt: sanitizeText(raw.updatedAt) || createdAt,
  };
}

export function listOffers() {
  return readOffersFile()
    .map(normalizeOffer)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getOfferById(id) {
  const target = sanitizeText(id);
  if (!target) return null;
  return listOffers().find((entry) => entry.id === target) || null;
}

export function getOfferByCode(code) {
  const target = normalizeCode(code);
  if (target.length !== 4) return null;
  return listOffers().find((entry) => entry.code === target) || null;
}

export function getActiveOfferForUser({ userId = '', email = '' } = {}) {
  const uid = sanitizeText(userId);
  const mail = sanitizeText(email).toLowerCase();
  if (!uid && !mail) return null;
  return (
    listOffers().find((entry) => (uid && entry.targetUserId === uid) || (mail && entry.targetEmail === mail)) || null
  );
}

function codeExists(code, list = listOffers()) {
  const target = normalizeCode(code);
  return list.some((entry) => entry.code === target);
}

export function generateUniqueCode() {
  const list = listOffers();
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const code =
      CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)] +
      CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)] +
      CODE_DIGITS[Math.floor(Math.random() * CODE_DIGITS.length)] +
      CODE_DIGITS[Math.floor(Math.random() * CODE_DIGITS.length)];
    if (!codeExists(code, list)) return code;
  }
  // Extremely unlikely fallback.
  return `${CODE_LETTERS[0]}${CODE_LETTERS[1]}${String(Date.now()).slice(-2)}`;
}

export function createOffer(input = {}) {
  const state = readOffersFile().map(normalizeOffer);
  const requestedCode = normalizeCode(input.code);
  const code = requestedCode.length === 4 && !codeExists(requestedCode, state) ? requestedCode : generateUniqueCode();
  const offer = normalizeOffer({
    ...input,
    id: makeId(),
    code,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  state.push(offer);
  writeOffersFile(state);
  return offer;
}

export function updateOffer(id, updates = {}) {
  const state = readOffersFile().map(normalizeOffer);
  const index = state.findIndex((entry) => entry.id === sanitizeText(id));
  if (index === -1) return null;
  const next = normalizeOffer({
    ...state[index],
    ...updates,
    id: state[index].id,
    code: state[index].code,
    createdAt: state[index].createdAt,
    updatedAt: nowIso(),
  });
  state[index] = next;
  writeOffersFile(state);
  return next;
}

export function deleteOffer(id) {
  const state = readOffersFile().map(normalizeOffer);
  const next = state.filter((entry) => entry.id !== sanitizeText(id));
  if (next.length === state.length) return false;
  writeOffersFile(next);
  return true;
}

export function claimOffer(id, { userId = '', email = '' } = {}) {
  return updateOffer(id, {
    targetUserId: sanitizeText(userId),
    targetEmail: sanitizeText(email).toLowerCase(),
    claimed: true,
    claimedAt: nowIso(),
  });
}
