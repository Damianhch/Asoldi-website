/** Public client-facing preview hosted on asoldi.com (Hostinger). */
export const PUBLIC_SALES_ORIGIN = 'https://asoldi.com';
export const LAN_MAKER_ORIGIN = 'http://192.168.68.92:3000';
export const LAN_ASOLDI_ORIGIN = 'http://192.168.68.92:3200';

function sanitizeText(value = '') {
  return String(value ?? '').trim();
}

export function isLoopbackHostname(hostname = '') {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(sanitizeText(hostname));
}

export function isPrivateLanHostname(hostname = '') {
  return /^(192\.168\.|10\.\d+\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(sanitizeText(hostname));
}

export function isPublicInternetHostname(hostname = '') {
  return /(^|\.)asoldi\.com$/i.test(sanitizeText(hostname));
}

function originFromCandidate(value = '') {
  const raw = sanitizeText(value);
  if (!raw) return '';
  const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw);
  const withProtocol = hasProtocol ? raw : `http://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
}

export function buildSalesPreviewPath(clientId = '') {
  const id = sanitizeText(clientId);
  if (!id) return '';
  return `/sales-preview/${encodeURIComponent(id)}/`;
}

export function buildPublicSalesPreviewUrl(clientId = '') {
  const path = buildSalesPreviewPath(clientId);
  return path ? `${PUBLIC_SALES_ORIGIN}${path}` : '';
}

export function toPublicSalesPreviewUrl(value = '', clientId = '') {
  const id = sanitizeText(clientId);
  if (id) return buildPublicSalesPreviewUrl(id);
  const raw = sanitizeText(value);
  if (!raw) return '';
  if (raw.startsWith('/sales-preview/')) {
    return `${PUBLIC_SALES_ORIGIN}${raw.startsWith('/') ? raw : `/${raw}`}`;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (isLoopbackHostname(parsed.hostname) || isPrivateLanHostname(parsed.hostname)) return '';
    if (/\/sales-preview\//i.test(parsed.pathname)) {
      return `${PUBLIC_SALES_ORIGIN}${parsed.pathname}${parsed.search || ''}${parsed.hash || ''}`;
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

export function clientHasSalesPreviewSnapshot(client = {}) {
  return Boolean(
    sanitizeText(client?.websiteImport?.previewUrl) ||
      sanitizeText(client?.websiteImport?.importRoot) ||
      sanitizeText(client?.websiteImport?.importedAt)
  );
}

export function buildLaptopPreviewEntry(client = {}) {
  const id = sanitizeText(client?.id);
  if (!id || !clientHasSalesPreviewSnapshot(client)) return null;
  const publicPreviewUrl = buildPublicSalesPreviewUrl(id);
  return {
    id,
    businessName: sanitizeText(client?.businessName) || 'Unnamed business',
    status: sanitizeText(client?.status) || 'active',
    runId: sanitizeText(client?.makerRun?.runId),
    importedAt: sanitizeText(client?.websiteImport?.importedAt),
    publicPreviewPublishedAt: sanitizeText(client?.websiteImport?.publicPreviewPublishedAt),
    publicPreviewUrl,
    laptopUrl: publicPreviewUrl,
    livePreviewPath: buildSalesPreviewPath(id),
    makerPreviewUrl: publicPreviewUrl,
  };
}

function pickPrivateLanOrigin(candidates = [], fallback = '') {
  for (const candidate of candidates) {
    const origin = originFromCandidate(candidate);
    if (!origin) continue;
    let hostname = '';
    try {
      hostname = new URL(origin).hostname;
    } catch {
      continue;
    }
    if (isLoopbackHostname(hostname)) continue;
    if (isPublicInternetHostname(hostname)) continue;
    if (isPrivateLanHostname(hostname)) return origin;
  }
  return fallback;
}

export function pickLanMakerOrigin(candidates = []) {
  return pickPrivateLanOrigin(candidates, LAN_MAKER_ORIGIN);
}

export function pickLanAsoldiOrigin(candidates = []) {
  return pickPrivateLanOrigin(candidates, LAN_ASOLDI_ORIGIN);
}
