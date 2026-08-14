/** Office LAN hosts used when a second laptop should open live Maker previews. */
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

export function buildMakerPreviewPath(runId = '', step = '3') {
  const id = sanitizeText(runId);
  if (!id) return '';
  const ready = sanitizeText(step) || '3';
  return `/preview/${encodeURIComponent(id)}/step/${encodeURIComponent(ready)}/view?route=/`;
}

export function buildLivePreviewPath(clientId = '') {
  const id = sanitizeText(clientId);
  if (!id) return '';
  return `/live-preview/${encodeURIComponent(id)}`;
}

export function rebaseMakerUrl(baseOrigin = '', pathOrUrl = '') {
  const raw = sanitizeText(pathOrUrl);
  const base = originFromCandidate(baseOrigin);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const suffix = `${parsed.pathname || ''}${parsed.search || ''}${parsed.hash || ''}`;
      if (base && suffix && suffix !== '/') return `${base}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
      if (suffix && suffix !== '/') return `${parsed.protocol}//${parsed.host}${suffix}`;
    } catch {
      // Fall through to origin normalization.
    }
    return originFromCandidate(raw);
  }
  if (!base) return '';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return `${base}${withSlash}`;
}

export function buildLaptopMakerPreviewUrl({
  runId = '',
  storedPreviewUrl = '',
  latestReadyStep = '3',
  lanMakerOrigin = '',
} = {}) {
  const id = sanitizeText(runId);
  if (!id) return '';
  const base = pickLanMakerOrigin([lanMakerOrigin, LAN_MAKER_ORIGIN]);
  return rebaseMakerUrl(base, sanitizeText(storedPreviewUrl) || buildMakerPreviewPath(id, latestReadyStep));
}

export function buildLaptopPreviewEntry(client = {}, { lanMakerOrigin = '', lanAsoldiOrigin = '' } = {}) {
  const id = sanitizeText(client?.id);
  const runId = sanitizeText(client?.makerRun?.runId);
  if (!id || !runId) return null;
  const latestReadyStep = sanitizeText(client?.makerRun?.latestReadyStep) || '3';
  const makerOrigin = pickLanMakerOrigin([lanMakerOrigin, LAN_MAKER_ORIGIN]);
  const asoldiOrigin = pickLanAsoldiOrigin([lanAsoldiOrigin, LAN_ASOLDI_ORIGIN]);
  const livePreviewPath = buildLivePreviewPath(id);
  return {
    id,
    businessName: sanitizeText(client?.businessName) || 'Unnamed business',
    status: sanitizeText(client?.status) || 'active',
    runId,
    latestReadyStep,
    makerPreviewUrl: buildLaptopMakerPreviewUrl({
      runId,
      storedPreviewUrl: client?.makerRun?.previewUrl,
      latestReadyStep,
      lanMakerOrigin: makerOrigin,
    }),
    laptopUrl: `${asoldiOrigin}${livePreviewPath}`,
    livePreviewPath,
  };
}
