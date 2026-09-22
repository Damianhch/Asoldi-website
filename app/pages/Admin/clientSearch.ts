// Shared client search (Sales + Development boards): accent-insensitive, token based,
// with "area" synonyms so "oslo area" also matches Bærum/Asker/Sandvika clients.

export function normalizeClientSearchText(value = '') {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SEARCH_QUERY_NOISE_WORDS = new Set([
  'area',
  'omrade',
  'omradet',
  'region',
  'city',
  'by',
  'location',
  'sted',
  'near',
  'naer',
  'i',
  'in',
]);

const SEARCH_LOCATION_GROUPS = [
  ['oslo', 'akershus', 'baerum', 'asker', 'lorenskog', 'ski', 'kolbotn', 'sandvika', 'fetsund', 'drammen'],
  ['trondheim', 'malvik', 'melhus', 'stjordal', 'levanger', 'skaun', 'orkanger', 'selbu', 'skogn', 'spongdal', 'sjetnmarka', 'svorkmo', 'lian'],
  ['bergen', 'fana', 'arna', 'askoy', 'os'],
  ['stavanger', 'sandnes', 'sola', 'randaberg', 'bryne', 'klepp'],
] as const;

function buildClientSearchTokens(value = '') {
  return normalizeClientSearchText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token && !SEARCH_QUERY_NOISE_WORDS.has(token));
}

function extractActiveLocationSearchGroups(queryTokens: string[]) {
  if (!queryTokens.length) return [] as string[][];
  return SEARCH_LOCATION_GROUPS.filter((group) => group.some((token) => queryTokens.includes(token))).map((group) => [...group]);
}

export function matchesClientSearchQuery(haystack = '', rawQuery = '') {
  const normalizedHaystack = normalizeClientSearchText(haystack);
  const normalizedQuery = normalizeClientSearchText(rawQuery);
  if (!normalizedQuery) return true;
  if (normalizedHaystack.includes(normalizedQuery)) return true;

  const queryTokens = buildClientSearchTokens(normalizedQuery);
  if (!queryTokens.length) return false;

  const activeLocationGroups = extractActiveLocationSearchGroups(queryTokens);
  for (const groupTokens of activeLocationGroups) {
    if (!groupTokens.some((token) => normalizedHaystack.includes(token))) return false;
  }

  const locationTokenSet = new Set(activeLocationGroups.flat());
  for (const token of queryTokens) {
    if (locationTokenSet.has(token)) continue;
    if (!normalizedHaystack.includes(token)) return false;
  }
  return true;
}

export function buildClientSearchHaystack(parts: Array<unknown>) {
  return parts
    .map((entry) => normalizeClientSearchText(String(entry ?? '')))
    .filter(Boolean)
    .join(' ');
}
