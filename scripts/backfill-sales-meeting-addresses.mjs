import 'dotenv/config';

import * as sales from '../data/sales.js';
import * as myphonerApi from '../lib/myphoner-api.js';

function sanitizeText(value = '') {
  return String(value ?? '').trim();
}

function normalizeLooseKey(value = '') {
  return sanitizeText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBusinessKey(value = '') {
  return normalizeLooseKey(value)
    .replace(/\b(as|ans|da|enk|holding|restaurant|barbershop|bar|cafe|pub|spiseri|lead)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePhoneDigits(value = '') {
  return sanitizeText(value).replace(/\D+/g, '');
}

function phoneTail(value = '') {
  const digits = normalizePhoneDigits(value);
  return digits.length > 8 ? digits.slice(-8) : digits;
}

function compactAddress(value = '') {
  const raw = sanitizeText(value).replace(/\uFFFD/g, '');
  if (!raw) return '';
  const lowered = raw.toLowerCase();
  if (
    lowered === 'not found' ||
    lowered === 'n/a' ||
    lowered === 'unknown' ||
    lowered === 'none' ||
    lowered === 'null'
  ) {
    return '';
  }
  return raw;
}

function waitMs(ms = 0) {
  const duration = Math.max(0, Math.trunc(Number(ms) || 0));
  if (!duration) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

function getLeadDataMap(lead = {}) {
  const source = lead && typeof lead === 'object' ? lead : {};
  const leadData = source.lead_data && typeof source.lead_data === 'object' ? source.lead_data : {};
  const map = new Map();
  for (const [key, value] of Object.entries(leadData)) {
    const normalized = normalizeLooseKey(key).replace(/\s+/g, '');
    const sanitized = sanitizeText(value);
    if (!normalized || !sanitized || map.has(normalized)) continue;
    map.set(normalized, sanitized);
  }
  return map;
}

function pickLeadDataValue(leadDataMap, keys = []) {
  if (!(leadDataMap instanceof Map) || !Array.isArray(keys)) return '';
  const normalizedKeys = keys.map((key) => normalizeLooseKey(key).replace(/\s+/g, '')).filter(Boolean);
  for (const key of normalizedKeys) {
    const direct = sanitizeText(leadDataMap.get(key));
    if (direct) return direct;
  }
  for (const [entryKey, value] of leadDataMap.entries()) {
    if (!value) continue;
    if (normalizedKeys.some((target) => entryKey.includes(target))) return sanitizeText(value);
  }
  return '';
}

function extractLeadBusinessName(lead = {}, leadDataMap = new Map()) {
  return sanitizeText(
    lead.primary_identifier ||
      pickLeadDataValue(leadDataMap, [
      'company_name',
      'business_name',
      'company',
      'firma',
      'foretak',
      'brreg_name',
      'name',
      'organization_name',
      'org_name',
    ]) ||
      lead.secondary_identifier
  );
}

function extractLeadContactName(lead = {}, leadDataMap = new Map()) {
  return sanitizeText(
    lead.secondary_identifier ||
      pickLeadDataValue(leadDataMap, [
      'contact_person',
      'kontaktperson',
      'full_name',
      'fullname',
      'contact_name',
      'name',
    ])
  );
}

function extractLeadPhone(lead = {}, leadDataMap = new Map()) {
  return sanitizeText(
    pickLeadDataValue(leadDataMap, [
      'mobile_phone',
      'phone',
      'business_phone',
      'phone_number',
      'work_office_phone',
      'telephone',
      'telefon',
    ]) ||
      lead.tertiary_identifier ||
      lead.destination_number
  );
}

function extractLeadAddress(lead = {}, leadDataMap = new Map()) {
  const primary = compactAddress(
    pickLeadDataValue(leadDataMap, [
      'meeting_place',
      'meeting_address',
      'address',
      'visiting_address',
      'besoksadresse',
      'moteadresse',
      'forretningsadresse',
      'street_address',
      'street',
    ])
  );
  if (primary) return primary;
  return compactAddress(
    pickLeadDataValue(leadDataMap, ['city', 'town', 'post_place', 'poststed', 'municipality', 'kommune'])
  );
}

function coerceLeadId(value = '') {
  return sanitizeText(value).replace(/[^\d]/g, '');
}

function buildLeadEntry(lead = {}, fallback = {}) {
  const source = lead && typeof lead === 'object' ? lead : {};
  const leadDataMap = getLeadDataMap(source);
  const leadId = coerceLeadId(source.id || source.lead_id || source.leadId || fallback.leadId);
  if (!leadId) return null;
  const businessName = extractLeadBusinessName(source, leadDataMap);
  const contactName = extractLeadContactName(source, leadDataMap);
  const phone = extractLeadPhone(source, leadDataMap);
  const address = extractLeadAddress(source, leadDataMap);
  const resourcePath = sanitizeText(
    source.location ||
      source.resource_url ||
      source.lead_resource_url ||
      fallback.resourcePath ||
      `/api/v2/leads/${encodeURIComponent(leadId)}`
  );
  return {
    leadId,
    listId: sanitizeText(source.list_id || source.listId || fallback.listId),
    listName: sanitizeText(source.list_name || source.listName || fallback.listName),
    resourcePath,
    businessName,
    businessKey: normalizeBusinessKey(businessName),
    contactName,
    contactKey: normalizeLooseKey(contactName),
    phoneTail: phoneTail(phone),
    phoneDigits: normalizePhoneDigits(phone),
    address,
  };
}

function addIndexEntry(map, key, entry) {
  const normalized = sanitizeText(key);
  if (!normalized) return;
  const current = map.get(normalized) || [];
  if (!current.some((candidate) => candidate.leadId === entry.leadId)) current.push(entry);
  map.set(normalized, current);
}

function parseLeadIdsFromText(value = '') {
  const ids = [];
  const raw = sanitizeText(value);
  if (!raw) return ids;
  for (const match of raw.matchAll(/\/(?:api\/v2\/)?leads\/(\d+)/gi)) {
    if (match?.[1]) ids.push(coerceLeadId(match[1]));
  }
  for (const match of raw.matchAll(/\blead(?:\s*id)?\s*[:#-]?\s*(\d{6,})\b/gi)) {
    if (match?.[1]) ids.push(coerceLeadId(match[1]));
  }
  return [...new Set(ids.filter(Boolean))];
}

function collectClientLeadIds(client = {}) {
  const source = client && typeof client === 'object' ? client : {};
  const ids = [
    coerceLeadId(source?.myphoner?.leadId),
    ...(Array.isArray(source?.myphoner?.leadIds) ? source.myphoner.leadIds.map(coerceLeadId) : []),
  ];

  const leadResourcePath = myphonerApi.parseMyPhonerResourcePath(
    sanitizeText(source?.myphoner?.leadResourceUrl),
    myphonerApi.getMyPhonerConfig()
  );
  if (leadResourcePath) {
    ids.push(coerceLeadId(myphonerApi.extractMyPhonerIdFromResource(leadResourcePath, 'leads')));
  }

  const otherLinks = sanitizeText(source?.details?.otherLinks);
  if (otherLinks) {
    for (const chunk of otherLinks.split(/\s+|,|\r?\n/)) {
      const parsedPath = myphonerApi.parseMyPhonerResourcePath(chunk, myphonerApi.getMyPhonerConfig());
      if (parsedPath) {
        ids.push(coerceLeadId(myphonerApi.extractMyPhonerIdFromResource(parsedPath, 'leads')));
      }
      parseLeadIdsFromText(chunk).forEach((id) => ids.push(id));
    }
  }

  parseLeadIdsFromText(source?.businessName).forEach((id) => ids.push(id));
  parseLeadIdsFromText(source?.contactPerson).forEach((id) => ids.push(id));
  return [...new Set(ids.filter(Boolean))];
}

function tokenOverlapScore(left = '', right = '') {
  const leftTokens = new Set(
    normalizeLooseKey(left)
      .split(' ')
      .filter((token) => token.length >= 3)
  );
  const rightTokens = new Set(
    normalizeLooseKey(right)
      .split(' ')
      .filter((token) => token.length >= 3)
  );
  if (!leftTokens.size || !rightTokens.size) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return overlap;
}

function assessBusinessSimilarity(clientBusiness = '', entryBusiness = '') {
  const left = sanitizeText(clientBusiness);
  const right = sanitizeText(entryBusiness);
  if (!left || !right) {
    return { strong: false, points: 0, overlap: 0, ratio: 0 };
  }
  if (left === right) {
    return { strong: true, points: 85, overlap: 999, ratio: 1 };
  }
  if (left.includes(right) || right.includes(left)) {
    return { strong: true, points: 55, overlap: 999, ratio: 1 };
  }
  const overlap = tokenOverlapScore(left, right);
  const leftTokenCount = left.split(' ').filter((token) => token.length >= 3).length;
  const rightTokenCount = right.split(' ').filter((token) => token.length >= 3).length;
  const ratio = overlap / Math.max(1, Math.min(leftTokenCount, rightTokenCount));
  if (overlap >= 1 && ratio >= 0.6) {
    return { strong: true, points: Math.min(40, overlap * 12), overlap, ratio };
  }
  return { strong: false, points: Math.min(15, overlap * 6), overlap, ratio };
}

function scoreLeadCandidate(client = {}, entry = {}, explicitLeadIds = new Set()) {
  let score = 0;
  const explicit = explicitLeadIds.has(entry.leadId);
  const clientBusiness = normalizeBusinessKey(client.businessName);
  const clientContact = normalizeLooseKey(client.contactPerson);
  const clientPhoneTail = phoneTail(client.contactPhone);
  const entryBusiness = sanitizeText(entry.businessKey);
  const entryContact = sanitizeText(entry.contactKey);
  const entryPhoneTail = sanitizeText(entry.phoneTail);
  const businessSimilarity = assessBusinessSimilarity(clientBusiness, entryBusiness);

  if (explicit) score += 180;

  if (clientPhoneTail && entryPhoneTail) {
    if (clientPhoneTail === entryPhoneTail) score += 90;
    else if (clientPhoneTail.endsWith(entryPhoneTail) || entryPhoneTail.endsWith(clientPhoneTail)) score += 70;
  }

  score += businessSimilarity.points;
  if (!explicit && clientBusiness && !businessSimilarity.strong) score -= 70;

  if (clientContact && entryContact) {
    if (clientContact === entryContact) score += 45;
    else if (clientContact.includes(entryContact) || entryContact.includes(clientContact)) score += 25;
    else score += Math.min(20, tokenOverlapScore(clientContact, entryContact) * 8);
  }

  if (sanitizeText(entry.address)) score += 5;
  if (sanitizeText(entry.businessName).length <= 1) score -= 100;
  if (sanitizeText(entry.businessName).toLowerCase() === 'not found') score -= 100;

  return {
    score,
    explicit,
    businessStrong: businessSimilarity.strong,
    businessOverlap: businessSimilarity.overlap,
    businessRatio: businessSimilarity.ratio,
  };
}

async function buildLeadCatalog() {
  const response = await myphonerApi.listMyPhonerLists();
  if (!response?.success) {
    throw new Error(response?.error || 'Failed loading Myphoner lists.');
  }
  const lists = Array.isArray(response.data) ? response.data : [];
  const entries = [];
  const byLeadId = new Map();
  const byPhoneTail = new Map();
  const byBusinessKey = new Map();
  const errors = [];

  async function fetchLeadsPage(listId = '', page = 1) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const leadsResponse = await myphonerApi.listMyPhonerLeadsInList(listId, { page, per_page: 100 });
      if (leadsResponse?.success) return leadsResponse;
      if (attempt < maxAttempts) await waitMs(250 * attempt);
    }
    return null;
  }

  for (const list of lists) {
    const listId = sanitizeText(list?.id);
    if (!listId) continue;
    const listName = sanitizeText(list?.name);
    let consecutiveFailures = 0;
    for (let page = 1; page <= 25; page += 1) {
      const leadsResponse = await fetchLeadsPage(listId, page);
      if (!leadsResponse?.success) {
        consecutiveFailures += 1;
        errors.push(`list:${listId}:page:${page}:fetch-failed`);
        if (consecutiveFailures >= 3) break;
        continue;
      }
      consecutiveFailures = 0;
      const leads = Array.isArray(leadsResponse.data) ? leadsResponse.data : [];
      if (!leads.length) break;

      for (const lead of leads) {
        const entry = buildLeadEntry(lead, { listId, listName });
        if (!entry || byLeadId.has(entry.leadId)) continue;
        byLeadId.set(entry.leadId, entry);
        entries.push(entry);
        addIndexEntry(byPhoneTail, entry.phoneTail, entry);
        addIndexEntry(byBusinessKey, entry.businessKey, entry);
      }
      if (leads.length < 100) break;
    }
  }

  return {
    entries,
    byLeadId,
    byPhoneTail,
    byBusinessKey,
    listCount: lists.length,
    leadCount: entries.length,
    errors,
  };
}

function chooseCandidate(scored = []) {
  if (!scored.length) return null;
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  if (!best || best.score < 95) return null;
  if (!best.explicit && !best.businessStrong) return null;
  const nearTop = sorted.filter((candidate) => best.score - candidate.score < 15);
  if (nearTop.length > 1) {
    const explicitTop = nearTop.find((candidate) => candidate.explicit);
    if (explicitTop) {
      return {
        ...explicitTop,
        second: nearTop[1] || null,
      };
    }
    const addressBuckets = new Map();
    for (const candidate of nearTop) {
      const key = sanitizeText(candidate.entry.address).toLowerCase();
      if (!key) continue;
      const list = addressBuckets.get(key) || [];
      list.push(candidate);
      addressBuckets.set(key, list);
    }
    let bestBucket = null;
    for (const bucket of addressBuckets.values()) {
      if (!bestBucket || bucket.length > bestBucket.length) bestBucket = bucket;
    }
    if (!bestBucket || bestBucket.length < 2) return null;
    return {
      ...bestBucket[0],
      second: nearTop[1] || null,
    };
  }
  return {
    ...best,
    second: sorted[1] || null,
  };
}

async function resolveLeadEntryForClient(client, catalog, fetchCache) {
  const explicitLeadIds = new Set(collectClientLeadIds(client));
  for (const leadId of explicitLeadIds) {
    if (catalog.byLeadId.has(leadId)) {
      return {
        entry: catalog.byLeadId.get(leadId),
        method: 'explicit-lead-id',
        score: 999,
        explicitLeadIds,
      };
    }
    if (!fetchCache.has(leadId)) {
      fetchCache.set(
        leadId,
        myphonerApi.fetchMyPhonerLeadById(leadId).then((response) =>
          response?.success && response?.data ? buildLeadEntry(response.data) : null
        )
      );
    }
    const fetched = await fetchCache.get(leadId);
    if (fetched) {
      catalog.byLeadId.set(fetched.leadId, fetched);
      catalog.entries.push(fetched);
      addIndexEntry(catalog.byPhoneTail, fetched.phoneTail, fetched);
      addIndexEntry(catalog.byBusinessKey, fetched.businessKey, fetched);
      return {
        entry: fetched,
        method: 'explicit-lead-id',
        score: 999,
        explicitLeadIds,
      };
    }
  }

  const businessKey = normalizeBusinessKey(client.businessName);
  if (businessKey) {
    const exactBusinessCandidates = (catalog.byBusinessKey.get(businessKey) || []).filter((entry) =>
      Boolean(sanitizeText(entry?.address))
    );
    if (exactBusinessCandidates.length) {
      const scoredExact = exactBusinessCandidates.map((entry) => ({
        entry,
        ...scoreLeadCandidate(client, entry, explicitLeadIds),
      }));
      const chosenExact = chooseCandidate(scoredExact);
      if (chosenExact) {
        return {
          entry: chosenExact.entry,
          method: 'business-exact',
          score: chosenExact.score,
          explicitLeadIds,
        };
      }
    }
  }

  const candidateSet = new Map();
  const phone = phoneTail(client.contactPhone);
  if (phone) {
    for (const entry of catalog.byPhoneTail.get(phone) || []) {
      candidateSet.set(entry.leadId, entry);
    }
  }

  if (businessKey) {
    for (const entry of catalog.entries) {
      if (!entry?.leadId) continue;
      const candidateBusinessKey = sanitizeText(entry.businessKey);
      if (!candidateBusinessKey || candidateBusinessKey.length < 3) continue;
      if (
        candidateBusinessKey === businessKey ||
        candidateBusinessKey.includes(businessKey) ||
        businessKey.includes(candidateBusinessKey) ||
        tokenOverlapScore(candidateBusinessKey, businessKey) >= 2
      ) {
        candidateSet.set(entry.leadId, entry);
      }
    }
  }

  const scored = [...candidateSet.values()].map((entry) => ({
    entry,
    ...scoreLeadCandidate(client, entry, explicitLeadIds),
  }));
  const chosen = chooseCandidate(scored);
  if (!chosen) return null;
  return {
    entry: chosen.entry,
    method: sanitizeText(phone) ? 'phone+business' : 'business',
    score: chosen.score,
    explicitLeadIds,
  };
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    dryRun: args.includes('--dry-run'),
    includeFilled: args.includes('--include-filled'),
    verbose: args.includes('--verbose'),
    limit: 0,
  };
  for (const arg of args) {
    if (!arg.startsWith('--limit=')) continue;
    const raw = Number(arg.slice('--limit='.length));
    if (Number.isFinite(raw) && raw > 0) parsed.limit = Math.trunc(raw);
  }
  return parsed;
}

function printUsage() {
  console.log('Usage: node scripts/backfill-sales-meeting-addresses.mjs [--dry-run] [--include-filled] [--limit=50] [--verbose]');
}

async function main() {
  const options = parseCliArgs();
  if (!myphonerApi.isMyPhonerConfigured()) {
    throw new Error('Myphoner env is not configured.');
  }

  const allClients = sales.getSalesClients();
  const scopedClients = options.limit > 0 ? allClients.slice(0, options.limit) : allClients;
  const clients = options.includeFilled
    ? scopedClients
    : scopedClients.filter((client) => !sanitizeText(client?.meetingPlace));

  const summary = {
    dryRun: options.dryRun,
    includeFilled: options.includeFilled,
    totalClients: allClients.length,
    selectedClients: scopedClients.length,
    targetClients: clients.length,
    updatedClients: 0,
    wouldUpdateClients: 0,
    unresolvedClients: 0,
    linkedByExplicitId: 0,
    linkedByMatch: 0,
    skippedNoAddress: 0,
  };

  const catalog = await buildLeadCatalog();
  const fetchCache = new Map();
  const changed = [];
  const unresolved = [];

  for (const client of clients) {
    const resolved = await resolveLeadEntryForClient(client, catalog, fetchCache);
    if (!resolved?.entry) {
      summary.unresolvedClients += 1;
      unresolved.push({
        clientId: client.id,
        businessName: sanitizeText(client.businessName),
        contactPerson: sanitizeText(client.contactPerson),
        reason: 'lead-not-matched',
      });
      continue;
    }

    const address = compactAddress(resolved.entry.address);
    if (!address) {
      summary.skippedNoAddress += 1;
      summary.unresolvedClients += 1;
      unresolved.push({
        clientId: client.id,
        businessName: sanitizeText(client.businessName),
        contactPerson: sanitizeText(client.contactPerson),
        leadId: resolved.entry.leadId,
        reason: 'lead-without-address',
      });
      continue;
    }

    const existingLeadIds = Array.isArray(client?.myphoner?.leadIds)
      ? client.myphoner.leadIds.map((id) => coerceLeadId(id)).filter(Boolean)
      : [];
    const mergedLeadIds = [...new Set([coerceLeadId(client?.myphoner?.leadId), ...existingLeadIds, resolved.entry.leadId].filter(Boolean))];

    const shouldPatchMyphonerMeta =
      resolved.method === 'explicit-lead-id' ||
      resolved.score >= 140 ||
      Boolean(client?.myphoner?.leadId) ||
      Boolean(client?.myphoner?.leadResourceUrl);

    const patch = {
      meetingPlace: address,
    };
    if (shouldPatchMyphonerMeta) {
      patch.myphoner = {
        ...(client.myphoner || {}),
        leadId: resolved.entry.leadId,
        leadIds: mergedLeadIds,
        listId: sanitizeText(client?.myphoner?.listId || resolved.entry.listId),
        listName: sanitizeText(client?.myphoner?.listName || resolved.entry.listName),
        leadResourceUrl: sanitizeText(client?.myphoner?.leadResourceUrl || resolved.entry.resourcePath),
        latestEventAt: new Date().toISOString(),
      };
    }

    if (options.dryRun) {
      summary.wouldUpdateClients += 1;
    } else {
      const updated = sales.updateSalesClient(client.id, patch);
      if (!updated) {
        summary.unresolvedClients += 1;
        unresolved.push({
          clientId: client.id,
          businessName: sanitizeText(client.businessName),
          contactPerson: sanitizeText(client.contactPerson),
          leadId: resolved.entry.leadId,
          reason: 'update-failed',
        });
        continue;
      }
      summary.updatedClients += 1;
    }

    if (resolved.method === 'explicit-lead-id') summary.linkedByExplicitId += 1;
    else summary.linkedByMatch += 1;

    changed.push({
      clientId: client.id,
      businessName: sanitizeText(client.businessName),
      contactPerson: sanitizeText(client.contactPerson),
      meetingPlace: address,
      leadId: resolved.entry.leadId,
      method: resolved.method,
      score: resolved.score,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        summary: {
          ...summary,
          catalog: {
            listCount: catalog.listCount,
            leadCount: catalog.leadCount,
          },
        },
        changed,
        unresolved,
      },
      null,
      2
    )
  );
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printUsage();
} else {
  main().catch((error) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          message: sanitizeText(error?.message) || 'Unknown error while backfilling sales addresses.',
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  });
}
