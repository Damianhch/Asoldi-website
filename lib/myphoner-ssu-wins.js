import * as myphonerApi from './myphoner-api.js';
import * as myphonerIntegration from '../data/myphoner-integration.js';

const DEFAULT_SSU_LIST_IDS = ['210172'];
const DEFAULT_SSU_WINS_LIST_IDS = ['216843'];
const DEFAULT_SSU_WINS_LIST_NAME = 'SSU wins';

const FIELD_SYNONYMS = {
  company_name: ['company_name', 'name', 'brreg_name', 'business_name', 'company', 'primary_identifier'],
  first_name: ['first_name', 'contact_person', 'full_name', 'secondary_identifier'],
  last_name: ['last_name'],
  title: ['title'],
  website: ['website'],
  work_office_phone: ['work_office_phone', 'business_phone'],
  mobile_phone: ['mobile_phone', 'phone', 'tertiary_identifier'],
  e_mail: ['e_mail', 'email'],
  name: ['name', 'company_name', 'brreg_name', 'primary_identifier'],
  contact_person: ['contact_person', 'full_name', 'secondary_identifier'],
  phone: ['phone', 'mobile_phone', 'tertiary_identifier'],
  business_phone: ['business_phone', 'work_office_phone'],
  email: ['email', 'e_mail'],
};

let listsCache = { expiresAt: 0, lists: [] };
let columnsCache = new Map();
let destIndexCache = { listId: '', expiresAt: 0, leads: [], byPhone: new Map(), byEmail: new Map() };

function sanitizeText(value = '') {
  return String(value ?? '').trim();
}

function isLikelyMissingValue(value = '') {
  const raw = sanitizeText(value).toLowerCase();
  if (!raw) return true;
  return [
    'not found',
    'n/a',
    'na',
    'none',
    'null',
    'unknown',
    'ikke funnet',
    'ikke tilgjengelig',
    'ingen',
    '-',
    '--',
  ].includes(raw);
}

function sanitizeFieldValue(value = '') {
  const cleaned = sanitizeText(String(value ?? '').replace(/\uFFFD/g, ''));
  if (isLikelyMissingValue(cleaned)) return '';
  return cleaned;
}

function nowIso() {
  return new Date().toISOString();
}

function parseIdList(raw, fallback = []) {
  const fromRaw = String(raw || '')
    .split(/[,;\s]+/)
    .map((entry) => sanitizeText(entry))
    .filter(Boolean);
  return new Set([...fallback, ...fromRaw]);
}

function normalizeListName(value = '') {
  return sanitizeText(value).toLowerCase().replace(/\s+/g, ' ');
}

function normalizeEmail(value = '') {
  const email = sanitizeFieldValue(value).toLowerCase();
  return email.includes('@') ? email : '';
}

function normalizePhoneDigits(value = '') {
  return String(value || '').replace(/\D+/g, '');
}

function phonesMatch(a = '', b = '') {
  const left = normalizePhoneDigits(a);
  const right = normalizePhoneDigits(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const minLen = 8;
  if (left.length < minLen && right.length < minLen) return false;
  return left.endsWith(right) || right.endsWith(left);
}

export function isSsuWinsSyncEnabled() {
  return String(process.env.MYPHONER_SSU_WINS_SYNC_ENABLED || '1') !== '0';
}

export function getConfiguredSsuListIds() {
  return parseIdList(process.env.MYPHONER_SSU_LIST_IDS, DEFAULT_SSU_LIST_IDS);
}

export function getConfiguredSsuWinsListIds() {
  return parseIdList(process.env.MYPHONER_SSU_WINS_LIST_IDS, DEFAULT_SSU_WINS_LIST_IDS);
}

export function getConfiguredSsuWinsListName() {
  return sanitizeText(process.env.MYPHONER_SSU_WINS_LIST_NAME) || DEFAULT_SSU_WINS_LIST_NAME;
}

export function isSsuWinsList({ listId = '', listName = '' } = {}) {
  const id = sanitizeText(listId);
  if (id && getConfiguredSsuWinsListIds().has(id)) return true;
  return normalizeListName(listName) === normalizeListName(getConfiguredSsuWinsListName());
}

export function isSsuSourceList({ listId = '', listName = '' } = {}) {
  if (isSsuWinsList({ listId, listName })) return false;
  const id = sanitizeText(listId);
  if (id && getConfiguredSsuListIds().has(id)) return true;
  return normalizeListName(listName) === 'ssu';
}

export function isWinnerLead(lead = {}) {
  const source = lead && typeof lead === 'object' ? lead : {};
  const state = sanitizeText(source.state || source.status).toLowerCase();
  if (state === 'won' || state === 'winner') return true;
  const outcome = sanitizeText(source.outcome).toLowerCase();
  return outcome === 'winner';
}

export function getLeadId(lead = {}) {
  const source = myphonerApi.unwrapMyPhonerLead(lead);
  return sanitizeText(source.id || source.lead_id || source.leadId);
}

export function getLeadListMeta(lead = {}) {
  const source = myphonerApi.unwrapMyPhonerLead(lead);
  const listLocation = sanitizeText(source.list_location || source.listLocation || source.list_id || source.listId);
  const listId = sanitizeText(
    myphonerApi.extractMyPhonerIdFromResource(listLocation, 'lists') || source.list_id || source.listId
  );
  const listName = sanitizeText(source.list_name || source.listName);
  return { listId, listName };
}

function collectSourceFields(lead = {}) {
  const source = myphonerApi.unwrapMyPhonerLead(lead);
  const leadData = source.lead_data && typeof source.lead_data === 'object' ? source.lead_data : {};
  const fields = {};
  for (const [key, value] of Object.entries(leadData)) {
    const text = sanitizeFieldValue(value);
    if (!key || !text) continue;
    fields[String(key)] = text;
  }
  const primary = sanitizeFieldValue(source.primary_identifier);
  const secondary = sanitizeFieldValue(source.secondary_identifier);
  const tertiary = sanitizeFieldValue(source.tertiary_identifier);
  if (primary && !fields.primary_identifier) fields.primary_identifier = primary;
  if (secondary && !fields.secondary_identifier) fields.secondary_identifier = secondary;
  if (tertiary && !fields.tertiary_identifier) fields.tertiary_identifier = tertiary;
  if (primary && !fields.name) fields.name = primary;
  if (secondary && !fields.contact_person) fields.contact_person = secondary;
  if (tertiary && !fields.phone) fields.phone = tertiary;
  return fields;
}

function pickSourceValue(fields, keys = []) {
  for (const key of keys) {
    const value = sanitizeFieldValue(fields[key]);
    if (value) return { key, value };
  }
  return { key: '', value: '' };
}

function splitPersonName(value = '') {
  const parts = sanitizeText(value).split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

export function mapLeadToTargetColumns(lead = {}, targetColumns = []) {
  const fields = collectSourceFields(lead);
  const keys = (Array.isArray(targetColumns) ? targetColumns : [])
    .map((column) => sanitizeText(column?.key || column))
    .filter(Boolean);
  const payload = {};
  const usedSourceKeys = new Set();

  for (const targetKey of keys) {
    const synonyms = FIELD_SYNONYMS[targetKey] || [targetKey];
    const picked = pickSourceValue(fields, synonyms);
    if (!picked.value) continue;
    payload[targetKey] = picked.value;
    if (picked.key) usedSourceKeys.add(picked.key);
  }

  if (keys.includes('first_name') || keys.includes('last_name')) {
    const hasExplicitFirst = sanitizeText(fields.first_name);
    const hasExplicitLast = sanitizeText(fields.last_name);
    if (!hasExplicitFirst || !hasExplicitLast) {
      const person = sanitizeText(fields.contact_person || fields.full_name || fields.secondary_identifier);
      const split = splitPersonName(person);
      if (keys.includes('first_name') && split.first && (!payload.first_name || payload.first_name === person)) {
        payload.first_name = split.first;
      }
      if (keys.includes('last_name') && split.last && !payload.last_name) {
        payload.last_name = split.last;
      }
    }
  }

  if (keys.includes('title') && !payload.title) {
    const extras = ['industry', 'orgnr', 'address']
      .map((key) => {
        const value = sanitizeText(fields[key]);
        if (!value || usedSourceKeys.has(key)) return '';
        if (key === 'orgnr') return `Orgnr ${value}`;
        return value;
      })
      .filter(Boolean);
    if (extras.length) payload.title = extras.join(' · ');
  }

  return payload;
}

async function loadLists({ force = false } = {}) {
  if (!force && listsCache.lists.length && Date.now() < listsCache.expiresAt) {
    return { success: true, data: listsCache.lists };
  }
  const response = await myphonerApi.listMyPhonerLists();
  if (!response.success) return response;
  const lists = Array.isArray(response.data) ? response.data : [];
  listsCache = { lists, expiresAt: Date.now() + 5 * 60 * 1000 };
  return { success: true, data: lists };
}

export async function resolveSsuWinsLists({ force = false } = {}) {
  const response = await loadLists({ force });
  if (!response.success) {
    return { ok: false, error: response.error || 'Failed loading MyPhoner lists.' };
  }
  const lists = Array.isArray(response.data) ? response.data : [];
  const source = lists.find((list) =>
    isSsuSourceList({ listId: sanitizeText(list?.id), listName: sanitizeText(list?.name) })
  );
  const target = lists.find((list) =>
    isSsuWinsList({ listId: sanitizeText(list?.id), listName: sanitizeText(list?.name) })
  );
  if (!source?.id) {
    return { ok: false, error: 'SSU source list was not found in MyPhoner.' };
  }
  if (!target?.id) {
    return { ok: false, error: 'SSU wins target list was not found in MyPhoner.' };
  }
  return {
    ok: true,
    source: { id: sanitizeText(source.id), name: sanitizeText(source.name), leadsCount: Number(source.leads_count) || 0 },
    target: { id: sanitizeText(target.id), name: sanitizeText(target.name), leadsCount: Number(target.leads_count) || 0 },
  };
}

async function loadTargetColumns(listId) {
  const key = sanitizeText(listId);
  const cached = columnsCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.columns;
  const response = await myphonerApi.getMyPhonerListColumns(key);
  const columns = response.success && Array.isArray(response.data) ? response.data : [];
  columnsCache.set(key, { columns, expiresAt: Date.now() + 10 * 60 * 1000 });
  return columns;
}

function indexDestLeads(leads = []) {
  const byPhone = new Map();
  const byEmail = new Map();
  for (const lead of leads) {
    const source = myphonerApi.unwrapMyPhonerLead(lead);
    const fields = collectSourceFields(source);
    const phones = [fields.mobile_phone, fields.phone, fields.work_office_phone, fields.business_phone, source.tertiary_identifier];
    for (const phone of phones) {
      const digits = normalizePhoneDigits(phone);
      if (digits) byPhone.set(digits, source);
    }
    const email = normalizeEmail(fields.e_mail || fields.email);
    if (email) byEmail.set(email, source);
  }
  return { byPhone, byEmail };
}

async function loadDestIndex(listId, { force = false } = {}) {
  const key = sanitizeText(listId);
  if (
    !force &&
    destIndexCache.listId === key &&
    Date.now() < destIndexCache.expiresAt &&
    Array.isArray(destIndexCache.leads)
  ) {
    return destIndexCache;
  }
  const response = await myphonerApi.listAllMyPhonerLeadsInList(key, { per_page: 100, order: 'last_updated_first' }, { maxPages: 30 });
  const leads = response.success && Array.isArray(response.data) ? response.data : [];
  const indexed = indexDestLeads(leads);
  destIndexCache = {
    listId: key,
    expiresAt: Date.now() + 2 * 60 * 1000,
    leads,
    ...indexed,
  };
  return destIndexCache;
}

function findExistingDestLead(lead, destIndex) {
  const fields = collectSourceFields(lead);
  const phones = [fields.phone, fields.mobile_phone, fields.business_phone, fields.tertiary_identifier];
  for (const phone of phones) {
    const digits = normalizePhoneDigits(phone);
    if (!digits) continue;
    const direct = destIndex.byPhone.get(digits);
    if (direct) return direct;
    for (const [existingDigits, existingLead] of destIndex.byPhone.entries()) {
      if (phonesMatch(digits, existingDigits)) return existingLead;
    }
  }
  const email = normalizeEmail(fields.email || fields.e_mail);
  if (email && destIndex.byEmail.get(email)) return destIndex.byEmail.get(email);
  return null;
}

function extractCreatedLeadId(payload) {
  const lead = myphonerApi.unwrapMyPhonerLead(payload);
  return sanitizeText(lead?.id || payload?.id || payload?.lead_id);
}

export async function copySsuWinnerToWinsList(lead = {}, options = {}) {
  if (!isSsuWinsSyncEnabled() && !options.force) {
    return { ok: true, skipped: 'disabled' };
  }
  const sourceLead = myphonerApi.unwrapMyPhonerLead(lead);
  const sourceLeadId = getLeadId(sourceLead);
  if (!sourceLeadId) return { ok: false, error: 'Missing source lead id.' };

  const listMeta = getLeadListMeta(sourceLead);
  if (isSsuWinsList(listMeta)) {
    return { ok: true, skipped: 'already-on-ssu-wins', leadId: sourceLeadId };
  }
  if (!options.ignoreSourceList && !isSsuSourceList(listMeta)) {
    return { ok: true, skipped: 'not-ssu-source', leadId: sourceLeadId, listId: listMeta.listId, listName: listMeta.listName };
  }
  if (!options.assumeWinner && !isWinnerLead(sourceLead)) {
    return { ok: true, skipped: 'not-winner', leadId: sourceLeadId };
  }

  const already = myphonerIntegration.getCopiedSsuWinner(sourceLeadId);
  if (already?.targetLeadId && !options.forceRecreate) {
    return {
      ok: true,
      skipped: 'already-copied',
      leadId: sourceLeadId,
      targetLeadId: already.targetLeadId,
    };
  }

  const lists = await resolveSsuWinsLists();
  if (!lists.ok) return lists;

  const destIndex = await loadDestIndex(lists.target.id, { force: Boolean(options.refreshDestIndex) });
  const existing = findExistingDestLead(sourceLead, destIndex);
  if (existing?.id) {
    myphonerIntegration.markSsuWinnerCopied(sourceLeadId, {
      targetLeadId: sanitizeText(existing.id),
      sourceListId: lists.source.id,
      targetListId: lists.target.id,
      phone: sanitizeText(collectSourceFields(sourceLead).phone),
      email: sanitizeText(collectSourceFields(sourceLead).email),
      copiedAt: nowIso(),
    });
    return {
      ok: true,
      skipped: 'already-in-target',
      leadId: sourceLeadId,
      targetLeadId: sanitizeText(existing.id),
    };
  }

  const columns = await loadTargetColumns(lists.target.id);
  const payload = mapLeadToTargetColumns(sourceLead, columns);
  if (!Object.keys(payload).length) {
    return { ok: false, error: 'Mapped lead payload was empty.', leadId: sourceLeadId };
  }

  const createResponse = await myphonerApi.createMyPhonerLeadInList(lists.target.id, payload);
  if (!createResponse.success) {
    return {
      ok: false,
      error: createResponse.error || 'Failed creating lead in SSU wins.',
      status: createResponse.status,
      leadId: sourceLeadId,
    };
  }

  const targetLeadId = extractCreatedLeadId(createResponse.data);
  myphonerIntegration.markSsuWinnerCopied(sourceLeadId, {
    targetLeadId,
    sourceListId: lists.source.id,
    targetListId: lists.target.id,
    phone: sanitizeText(payload.mobile_phone || payload.phone || collectSourceFields(sourceLead).phone),
    email: sanitizeText(payload.e_mail || payload.email || collectSourceFields(sourceLead).email),
    copiedAt: nowIso(),
  });
  destIndexCache.expiresAt = 0;

  return {
    ok: true,
    created: true,
    leadId: sourceLeadId,
    targetLeadId,
    targetListId: lists.target.id,
    mappedFields: Object.keys(payload),
  };
}

export async function backfillSsuWinnersToWinsList(options = {}) {
  if (!isSsuWinsSyncEnabled() && !options.force) {
    return { ok: true, skipped: 'disabled' };
  }
  if (!myphonerApi.isMyPhonerConfigured()) {
    return { ok: false, skipped: 'myphoner-not-configured' };
  }

  const lists = await resolveSsuWinsLists({ force: true });
  if (!lists.ok) return lists;

  const statsResponse = await myphonerApi.getMyPhonerListStats(lists.source.id);
  const wonCount = Number(statsResponse?.data?.leads_counts?.won?.total);
  const summary = {
    ok: true,
    sourceListId: lists.source.id,
    sourceListName: lists.source.name,
    targetListId: lists.target.id,
    targetListName: lists.target.name,
    sourceWonCount: Number.isFinite(wonCount) ? wonCount : null,
    scanned: 0,
    winners: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  await loadDestIndex(lists.target.id, { force: true });

  const leadsResponse = await myphonerApi.listAllMyPhonerLeadsInList(
    lists.source.id,
    { per_page: 100, order: 'last_updated_first' },
    { maxPages: Math.max(20, Number(options.maxPages) || 50) }
  );
  if (!leadsResponse.success) {
    return { ok: false, error: leadsResponse.error || 'Failed listing SSU leads.', summary };
  }

  const leads = Array.isArray(leadsResponse.data) ? leadsResponse.data : [];
  summary.scanned = leads.length;
  const winners = leads.filter((lead) => isWinnerLead(lead));
  summary.winners = winners.length;

  for (const winner of winners) {
    const result = await copySsuWinnerToWinsList(winner, {
      force: true,
      assumeWinner: true,
      ignoreSourceList: false,
    });
    if (result?.created) summary.created += 1;
    else if (result?.ok && result?.skipped) summary.skipped += 1;
    else {
      summary.failed += 1;
      if (result?.error) summary.errors.push(result.error);
    }
  }

  myphonerIntegration.setSsuWinsBackfillState({
    sourceListId: lists.source.id,
    targetListId: lists.target.id,
    lastBackfillAt: nowIso(),
    lastBackfillSummary: {
      scanned: summary.scanned,
      winners: summary.winners,
      created: summary.created,
      skipped: summary.skipped,
      failed: summary.failed,
    },
  });

  return summary;
}

export async function maybeBackfillSsuWinners(options = {}) {
  if (!isSsuWinsSyncEnabled() && !options.force) {
    return { ok: true, skipped: 'disabled' };
  }
  const lists = await resolveSsuWinsLists();
  if (!lists.ok) return lists;
  const statsResponse = await myphonerApi.getMyPhonerListStats(lists.source.id);
  const wonCount = Number(statsResponse?.data?.leads_counts?.won?.total) || 0;
  const copiedCount = Object.keys(myphonerIntegration.getSsuWinsState()?.copiedBySourceLeadId || {}).length;
  if (copiedCount >= wonCount && wonCount > 0) {
    return { ok: true, skipped: 'already-copied', wonCount, copiedCount };
  }
  if (wonCount <= 0) {
    return { ok: true, skipped: 'no-winners', wonCount };
  }
  return backfillSsuWinnersToWinsList(options);
}
