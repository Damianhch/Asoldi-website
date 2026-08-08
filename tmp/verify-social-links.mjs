// Verification harness for the Sales social-link finder.
// Mirrors the exact logic in server.js (queries, canonicalizers, scoring, selection)
// and runs it against real SerpAPI results. Also validates orgnr-based Proff URLs.
// Usage: node tmp/verify-social-links.mjs

import { readFileSync } from 'fs';

// --- env ---
const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const SERPAPI_API_KEY = (envText.match(/^SERPAPI_API_KEY=(.+)$/m) || [])[1]?.trim() || '';
if (!SERPAPI_API_KEY) {
  console.error('SERPAPI_API_KEY missing in .env');
  process.exit(1);
}

// --- helpers copied from server.js ---
const sanitizeText = (value = '') => String(value ?? '').trim();

function coerceHttpUrl(value = '') {
  const raw = sanitizeText(value);
  if (!raw) return '';
  const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw);
  const candidate = hasProtocol ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    if (!/^https?:$/i.test(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function normalizeSearchText(value = '') {
  return String(value || '')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[øØ]/g, 'o')
    .replace(/[åÅ]/g, 'a')
    .replace(/caf(?=e|é)/gi, 'kaf')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildBusinessSearchTokens(values = []) {
  const stopWords = new Set([
    'as', 'og', 'the', 'for', 'and', 'med', 'til', 'hos', 'butikk', 'norge',
    'holding', 'gruppen', 'group', 'invest', 'konsern', 'ans', 'enk',
  ]);
  const tokens = normalizeSearchText((Array.isArray(values) ? values : [values]).join(' '))
    .split(' ')
    .map((entry) => sanitizeText(entry))
    .filter((entry) => entry.length >= 3 && !stopWords.has(entry));
  return [...new Set(tokens)].slice(0, 10);
}

function haystackHasCityToken(haystack = '', cityToken = '') {
  const token = sanitizeText(cityToken);
  if (!token || !haystack) return false;
  return ` ${haystack} `.includes(` ${token} `);
}

function scoreSalesSearchCandidate(candidate = {}, context = {}) {
  const haystack = normalizeSearchText(
    `${sanitizeText(candidate.title)} ${sanitizeText(candidate.snippet)} ${sanitizeText(candidate.url)}`
  );
  if (!haystack) return 0;
  const businessTokens = Array.isArray(context.businessTokens) ? context.businessTokens : [];
  const cityToken = sanitizeText(context.cityToken);
  const organizationNumber = sanitizeText(context.organizationNumber);
  let score = 0;
  for (const token of businessTokens) {
    if (token && haystack.includes(token)) score += 2;
  }
  if (haystackHasCityToken(haystack, cityToken)) score += 2;
  if (organizationNumber && haystack.includes(organizationNumber)) score += 3;
  return score;
}

function canonicalizeInstagramProfileUrl(value = '') {
  const normalized = coerceHttpUrl(value);
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    const host = parsed.host.toLowerCase();
    if (!host.includes('instagram.com')) return '';
    const segments = parsed.pathname.split('/').map((entry) => sanitizeText(entry)).filter(Boolean);
    const firstSegment = sanitizeText(segments[0]).toLowerCase();
    const blocked = new Set([
      'p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'developer', 'legal', 'about',
      'popular', 'directory', 'web', 'tags',
    ]);
    if (!firstSegment || blocked.has(firstSegment)) return '';
    return `https://www.instagram.com/${segments[0]}/`;
  } catch {
    return '';
  }
}

function canonicalizeFacebookProfileUrl(value = '') {
  const normalized = coerceHttpUrl(value);
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    const host = parsed.host.toLowerCase();
    if (!(host.includes('facebook.com') || host.includes('fb.com') || host.includes('m.me'))) return '';
    if (host.includes('m.me')) return normalized;
    const segments = parsed.pathname.split('/').map((entry) => sanitizeText(entry)).filter(Boolean);
    if (!segments.length) return '';
    const firstSegment = sanitizeText(segments[0]).toLowerCase();
    if (firstSegment === 'profile.php') {
      const profileId = sanitizeText(parsed.searchParams.get('id'));
      if (!profileId) return '';
      return `https://www.facebook.com/profile.php?id=${encodeURIComponent(profileId)}`;
    }
    const blocked = new Set([
      'share', 'sharer', 'photos', 'photo', 'events', 'groups', 'watch', 'reel', 'reels', 'story.php', 'permalink.php',
      'marketplace', 'search', 'plugins', 'dialog', 'login',
    ]);
    if (blocked.has(firstSegment)) return '';
    if ((firstSegment === 'pages' || firstSegment === 'people') && segments[1]) {
      return `https://www.facebook.com/${segments[0]}/${segments[1]}/`;
    }
    if (firstSegment === 'p') {
      if (!segments[1]) return '';
      const idMatch = sanitizeText(segments[1]).match(/-(\d{5,})$/);
      if (idMatch?.[1]) return `https://www.facebook.com/${idMatch[1]}/`;
      return `https://www.facebook.com/p/${segments[1]}/`;
    }
    return `https://www.facebook.com/${segments[0]}/`;
  } catch {
    return '';
  }
}

function getSearchContextBusinessTokens(context = {}) {
  return (Array.isArray(context.businessTokens) ? context.businessTokens : [])
    .map((entry) => normalizeSearchText(entry))
    .filter(Boolean);
}

function getCandidateSearchHaystack(candidate = {}) {
  return normalizeSearchText(
    `${sanitizeText(candidate.title)} ${sanitizeText(candidate.snippet)} ${sanitizeText(candidate.url)}`
  );
}

function collectMatchedBusinessTokens(haystack = '', businessTokens = []) {
  const matched = [];
  for (const token of Array.isArray(businessTokens) ? businessTokens : []) {
    if (!token || !haystack.includes(token)) continue;
    if (!matched.includes(token)) matched.push(token);
  }
  return matched;
}

function extractSocialProfileIdentifier(url = '') {
  const normalized = coerceHttpUrl(url);
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    const segments = parsed.pathname.split('/').map((entry) => sanitizeText(entry)).filter(Boolean);
    if (!segments.length) return '';
    const first = sanitizeText(segments[0]).toLowerCase();
    if (first === 'profile.php') return '';
    if ((first === 'pages' || first === 'people' || first === 'p') && segments[1]) {
      return normalizeSearchText(sanitizeText(segments[1]).replace(/-\d{5,}$/, '')).replace(/\s+/g, '');
    }
    return normalizeSearchText(segments[0]).replace(/\s+/g, '');
  } catch {
    return '';
  }
}

function buildCompactBusinessNameVariants(businessName = '') {
  const base = String(businessName || '');
  const spellings = [
    { ae: 'ae', o: 'o', a: 'a' },
    { ae: 'e', o: 'o', a: 'a' },
    { ae: 'ae', o: 'oe', a: 'aa' },
  ];
  const variants = new Set();
  for (const map of spellings) {
    const transliterated = base
      .replace(/[æÆ]/g, map.ae)
      .replace(/[øØ]/g, map.o)
      .replace(/[åÅ]/g, map.a)
      .replace(/caf(?=e|é)/gi, 'kaf')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const raw = transliterated.replace(/[^a-z0-9]+/g, '');
    const stripped = transliterated
      .replace(/\b(as|ans|da|enk|og|for|med)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, '');
    if (raw) variants.add(raw);
    if (stripped) variants.add(stripped);
  }
  return [...variants];
}

function isHandleSegmentPartOfBusiness(segment = '', { nameVariants = [], cityToken = '' } = {}) {
  const value = sanitizeText(segment);
  if (!value) return true;
  if (value === sanitizeText(cityToken)) return true;
  if (['norge', 'no', 'as', 'offisiell', 'official'].includes(value)) return true;
  return nameVariants.some((variant) => variant.includes(value));
}

function hasStrongSocialIdentifierMatch({ url = '', matchedTokens = [], context = {} } = {}) {
  const profileIdentifier = extractSocialProfileIdentifier(url);
  if (!profileIdentifier) return false;
  const compactHandle = profileIdentifier.replace(/[._-]+/g, '');
  if (compactHandle.length < 3) return false;
  const nameVariants = buildCompactBusinessNameVariants(context.businessName || '');
  const cityToken = normalizeSearchText(context.cityToken || '').replace(/\s+/g, '');

  for (const variant of nameVariants) {
    if (variant.length >= 5 && compactHandle.includes(variant)) return true;
    if (compactHandle.length >= 5 && variant.includes(compactHandle)) return true;
  }

  const tokens = (Array.isArray(matchedTokens) ? matchedTokens : [])
    .map((token) => normalizeSearchText(token).replace(/\s+/g, ''))
    .filter((token) => token.length >= 4);
  if (!tokens.length) return false;
  const matchedInHandle = tokens.filter((token) => compactHandle.includes(token));
  if (!matchedInHandle.length) return false;

  for (const token of matchedInHandle) {
    const index = compactHandle.indexOf(token);
    if (index < 0) continue;
    const prefix = compactHandle.slice(0, index);
    const suffix = compactHandle.slice(index + token.length);
    const prefixOk = isHandleSegmentPartOfBusiness(prefix, { nameVariants, cityToken });
    const suffixOk = isHandleSegmentPartOfBusiness(suffix, { nameVariants, cityToken });
    if (prefixOk && suffixOk) return true;
  }
  return false;
}

function selectBestSearchCandidate(
  results = [],
  {
    context = {},
    normalizeUrl = () => '',
    minScore = 2,
    minConfidenceMargin = 0,
    minBusinessTokenMatches = 1,
    strictConfidence = false,
    requireIdentifierMatch = false,
  } = {}
) {
  const businessTokens = getSearchContextBusinessTokens(context);
  const simplifiedBusinessName = normalizeBusinessNameForSearchQuery(context.businessName || '');
  const exactNameVariants = [
    ...new Set([
      normalizeSearchText(simplifiedBusinessName),
      normalizeSearchText(simplifiedBusinessName.replace(/\b(og|for|med|and)\b/gi, ' ')),
    ]),
  ].filter(Boolean);
  const cityToken = sanitizeText(context.cityToken);
  const scored = (Array.isArray(results) ? results : [])
    .map((entry) => {
      const url = normalizeUrl(entry?.url || '');
      if (!url) return null;
      const haystack = getCandidateSearchHaystack(entry);
      const score = scoreSalesSearchCandidate(entry, context);
      const matchedTokens = collectMatchedBusinessTokens(haystack, businessTokens);
      const tokenMatches = matchedTokens.length;
      const exactBusinessNameMatch = exactNameVariants.some((variant) => haystack.includes(variant));
      const cityMatch = haystackHasCityToken(haystack, cityToken);
      const strongIdentifierMatch = hasStrongSocialIdentifierMatch({ url, matchedTokens, context });
      const position = Number.isFinite(Number(entry?.position)) ? Number(entry.position) : -1;
      const positionBonus = position === 0 ? 2 : position === 1 ? 1 : 0;
      const profileIdentifier = extractSocialProfileIdentifier(url);
      const handleMismatchPenalty =
        profileIdentifier && !/^\d+$/.test(profileIdentifier) && !strongIdentifierMatch ? 2 : 0;
      const confidencePoints =
        score +
        tokenMatches * 2 +
        (exactBusinessNameMatch ? 2 : 0) +
        (strongIdentifierMatch ? 2 : 0) +
        (cityMatch ? 1 : 0) +
        positionBonus -
        handleMismatchPenalty;
      return { url, score, confidencePoints, tokenMatches, exactBusinessNameMatch, strongIdentifierMatch, cityMatch, position };
    })
    .filter(Boolean);
  const byCanonicalUrl = new Map();
  for (const candidate of scored) {
    const existing = byCanonicalUrl.get(candidate.url);
    if (!existing || candidate.confidencePoints > existing.confidencePoints) {
      byCanonicalUrl.set(candidate.url, candidate);
    }
  }
  const ranked = [...byCanonicalUrl.values()].sort((a, b) => {
    if (b.confidencePoints !== a.confidencePoints) return b.confidencePoints - a.confidencePoints;
    if (b.score !== a.score) return b.score - a.score;
    return b.tokenMatches - a.tokenMatches;
  });
  if (!ranked.length) return { url: '', reason: 'no-canonical-candidates', top: null, runnerUp: null };
  const top = ranked[0];
  const runnerUp = ranked[1] || null;
  const effectiveMinScore = Math.min(
    Math.max(1, Number(minScore) || 1),
    Math.max(2, businessTokens.length * 2)
  );
  if (top.score < effectiveMinScore) return { url: '', reason: 'score-below-min', top, runnerUp };

  if (strictConfidence) {
    const availableTokens = Math.max(1, businessTokens.length);
    const requiredTokenMatches = Math.max(1, Math.min(minBusinessTokenMatches, availableTokens));
    if (top.tokenMatches < requiredTokenMatches) return { url: '', reason: 'insufficient-token-matches', top, runnerUp };
    if (requireIdentifierMatch && !top.strongIdentifierMatch) {
      return { url: '', reason: 'missing-handle-match', top, runnerUp };
    }
    if (!top.strongIdentifierMatch && !top.exactBusinessNameMatch) {
      return { url: '', reason: 'missing-identifier-signal', top, runnerUp };
    }
    if (cityToken && !top.cityMatch && !top.strongIdentifierMatch && !top.exactBusinessNameMatch) {
      return { url: '', reason: 'missing-city-signal', top, runnerUp };
    }
    if (runnerUp && top.confidencePoints - runnerUp.confidencePoints < Math.max(0, Number(minConfidenceMargin || 0))) {
      return { url: '', reason: 'ambiguous-top-candidates', top, runnerUp };
    }
  }
  return { url: top.url, reason: 'resolved', top, runnerUp };
}

function normalizeBusinessNameForSearchQuery(value = '') {
  return sanitizeText(value)
    .replace(/\b(as|ans|da|enk|holding)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSocialSearchQueries({ provider = 'instagram', context = {} } = {}) {
  const socialProvider = sanitizeText(provider).toLowerCase().includes('face') ? 'facebook' : 'instagram';
  const siteDomain = socialProvider === 'facebook' ? 'facebook.com' : 'instagram.com';
  const businessName = sanitizeText(context?.businessName || '');
  const simplifiedBusinessName = normalizeBusinessNameForSearchQuery(businessName);
  if (!businessName && !simplifiedBusinessName) return [];
  const locationHint = sanitizeText(context?.locationHint || '');
  const cityToken = sanitizeText(context?.cityToken || '');
  const organizationNumber = sanitizeText(context?.organizationNumber || '').replace(/\D+/g, '');
  const fragments = [
    [businessName, socialProvider, cityToken || locationHint, 'Norge'],
    [`"${businessName}"`, `site:${siteDomain}`, cityToken],
    [simplifiedBusinessName, `site:${siteDomain}`, cityToken || 'Norge'],
    [simplifiedBusinessName, socialProvider, cityToken, organizationNumber],
  ];
  const querySet = new Set();
  for (const parts of fragments) {
    const query = parts
      .map((entry) => sanitizeText(entry))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!query || query.length < 4) continue;
    querySet.add(query);
  }
  return [...querySet].slice(0, 4);
}

function extractCityTokenFromLocationHint(locationHint = '') {
  const parts = normalizeSearchText(locationHint)
    .split(' ')
    .map((entry) => sanitizeText(entry))
    .filter(Boolean);
  if (!parts.length) return '';
  const streetLike =
    /^(?:.*(?:vegen|veien|gata|gaten|gate|vei|veg|street|road|alleen|alle|plass|plassen)|[a-z]+(?:vn|gt))$/;
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (!/^\d{4}$/.test(parts[index])) continue;
    const candidate = parts[index + 1];
    if (candidate && candidate.length >= 3 && !/^\d+$/.test(candidate) && !streetLike.test(candidate)) {
      return candidate;
    }
  }
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const candidate = parts[index];
    if (!candidate || candidate.length < 3 || /^\d+$/.test(candidate) || streetLike.test(candidate)) continue;
    return candidate;
  }
  return '';
}

// --- SerpAPI (with timeout) ---
let lastRequestAt = 0;
let apiCalls = 0;
async function searchSerpApi(query) {
  const wait = Math.max(0, 700 - (Date.now() - lastRequestAt));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
  apiCalls += 1;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const params = new URLSearchParams({ engine: 'google', q: query, api_key: SERPAPI_API_KEY, num: '20', hl: 'no', gl: 'no' });
    const response = await fetch(`https://serpapi.com/search.json?${params}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(`  serpapi HTTP ${response.status} for: ${query}`);
      return [];
    }
    const payload = await response.json().catch(() => ({}));
    return (Array.isArray(payload?.organic_results) ? payload.organic_results : [])
      .map((entry) => ({
        url: coerceHttpUrl(entry?.link || entry?.redirect_link || ''),
        title: sanitizeText(entry?.title || ''),
        snippet: sanitizeText(entry?.snippet || entry?.snippet_highlighted_words?.join(' ') || ''),
      }))
      .filter((entry) => entry.url)
      .slice(0, 20);
  } catch (error) {
    console.error(`  serpapi error for "${query}": ${error?.message || error}`);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveBestSearchCandidate({ queries, context, normalizeUrl, requireIdentifierMatch = false }) {
  const pooledByUrl = new Map();
  for (const query of queries) {
    let results = await searchSerpApi(query);
    if (!results.length) results = await searchSerpApi(query); // one retry like production
    results.forEach((entry, index) => {
      const existing = pooledByUrl.get(entry.url);
      if (existing) {
        if (index < existing.position) existing.position = index;
        return;
      }
      pooledByUrl.set(entry.url, { ...entry, query, position: index });
    });
  }
  const pooled = [...pooledByUrl.values()];
  if (!pooled.length) return { url: '', reason: 'no-search-results' };
  return selectBestSearchCandidate(pooled, {
    context,
    normalizeUrl,
    minScore: 4,
    minConfidenceMargin: 2,
    minBusinessTokenMatches: 2,
    strictConfidence: true,
    requireIdentifierMatch,
  });
}

// --- test data (real production clients from tmp/missing-social-clients.json) ---
const clients = [
  { businessName: 'Byneset Bydelskafe', meetingPlace: '', orgnr: '985626154', expect: 'FB should be found (user saw top 3); IG likely none' },
  { businessName: 'Lisa Frisør og hudpleie', meetingPlace: 'Armfeldts veg 1, 7562 Hundhammeren', orgnr: '', expect: 'FB lisafrisoroghudpleie' },
  { businessName: 'SIRKUS BILVASK & BILPLEIE', meetingPlace: '', orgnr: '814372022', expect: 'IG sirkusbilvask; NOT sirkusshopping/popular' },
  { businessName: 'ROSTO HOLDING AS', meetingPlace: 'Gronland 30, 0188 Oslo', orgnr: '989221744', expect: 'IG/FB rosto.oslo' },
  { businessName: 'KVÆRNER BAKERI OG PIZZA AS', meetingPlace: 'Konows gate 77, 0196 Oslo', orgnr: '929582918', expect: 'IG kvernerbakeri' },
  { businessName: 'nordic bygg', meetingPlace: '', orgnr: '988486183', expect: 'ambiguous - skip acceptable' },
  { businessName: 'NEOMÅL OLKHOVSKA', meetingPlace: 'Fautgardsvegen 15, 7234 Ler', orgnr: '933941752', expect: 'personal profiles - skip is correct' },
  { businessName: 'ONE TAKEAWAY THAI MATVOGN', meetingPlace: '', orgnr: '912567524', expect: 'IG onetakeaway (low conf)' },
];

const filter = (process.argv[2] || '').toLowerCase();
const selectedClients = filter
  ? clients.filter((client) => client.businessName.toLowerCase().includes(filter))
  : clients;

const rows = [];
for (const client of selectedClients) {
  const cityToken = extractCityTokenFromLocationHint(client.meetingPlace);
  const context = {
    businessName: client.businessName,
    locationHint: client.meetingPlace,
    cityToken,
    organizationNumber: client.orgnr,
    businessTokens: buildBusinessSearchTokens([client.businessName]),
  };
  for (const provider of ['instagram', 'facebook']) {
    const normalizeUrl = provider === 'facebook' ? canonicalizeFacebookProfileUrl : canonicalizeInstagramProfileUrl;
    const queries = buildSocialSearchQueries({ provider, context });
    const result = await resolveBestSearchCandidate({
      queries,
      context,
      normalizeUrl,
      requireIdentifierMatch: provider === 'instagram',
    });
    rows.push({ business: client.businessName, provider, url: result.url || '(skipped)', reason: result.reason });
    console.log(
      `${client.businessName} [${provider}] -> ${result.url || 'SKIP'} (${result.reason})` +
        (result.top && !result.url ? ` top=${result.top.url} score=${result.top.score} conf=${result.top.confidencePoints}` : '')
    );
  }
}

// --- proff orgnr direct URL validation ---
console.log('\n=== PROFF orgnr URL check ===');
for (const orgnr of ['985626154', '814372022', '929582918']) {
  const url = `https://www.proff.no/selskap/x/x/x/${orgnr}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    console.log(`${orgnr}: HTTP ${response.status} -> ${response.url}`);
  } catch (error) {
    console.log(`${orgnr}: fetch failed (${error?.message || error})`);
  }
}

console.log('\n=== SUMMARY ===');
for (const row of rows) {
  console.log(`${row.business.padEnd(28)} ${row.provider.padEnd(9)} ${row.url} [${row.reason}]`);
}
console.log(`\nSerpAPI calls used: ${apiCalls}`);
