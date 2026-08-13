import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  ArchiveX,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Gift,
  Link2,
  Loader2,
  MailPlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  Volume2,
  Wand2,
  X,
} from 'lucide-react';
import { API, salesAuthHeaders, type SalesClient, type SalesProduct } from '../shared';
import 'leaflet/dist/leaflet.css';

type WebsiteOffer = {
  id: string;
  code: string;
  salesClientId: string;
  planId: string;
  planName: string;
  price: string;
  note: string;
  businessName: string;
  previewUrl: string;
  targetUserId: string;
  targetEmail: string;
  claimed: boolean;
  claimedAt: string;
  createdAt: string;
};

type ClientUserResult = {
  userId: string;
  email: string;
  name: string;
  businessName: string;
};

const OFFER_TIERS = [
  { id: 'tier-1-standard', name: 'Tier 1: Standard', price: '999,-/mnd' },
  { id: 'tier-2-seo', name: 'Tier 2: SEO', price: '1 499,-/mnd' },
  { id: 'tier-3-ecommerce', name: 'Tier 3: Nettbutikk', price: '1 999,-/mnd' },
];
const MAKER_BASE_URL_STORAGE_KEY = 'asoldi.sales.websiteMakerBaseUrl.v1';
const LAN_MAKER_URL = 'http://192.168.68.92:3000';
const LOCAL_MAKER_URL = 'http://localhost:3000';
const IS_LAN_SALES_HOST = typeof window !== 'undefined' && !/(^|\.)asoldi\.com$/i.test(window.location.hostname);
const SALES_MAP_DEFAULT_CENTER: [number, number] = [63.4305, 10.3951];
const SALES_MAP_DEFAULT_ZOOM = 5;

type CalendarStatus = {
  configured: boolean;
  connected: boolean;
  calendarId: string;
  redirectUri: string;
  tokenUpdatedAt: string;
  accountKey?: string;
};

type MeetingMapPin = {
  clientId: string;
  businessName: string;
  contactPerson: string;
  meetingPlace: string;
  meetingAt: string;
  meetingMode?: 'online' | 'in-person';
  status?: 'active' | 'not-sold' | 'secondary';
  latitude: number;
  longitude: number;
};

type Props = {
  onPromotedToClient?: () => void;
};

type SalesFormState = {
  product: SalesProduct;
  businessName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  meetingPlace: string;
  industry: string;
  meetingMode: 'online' | 'in-person';
  agreedTime: boolean;
  meetingAt: string;
  websiteDomain: string;
  instagramUrl: string;
  facebookUrl: string;
  proffUrl: string;
  otherLinks: string;
  googleBusinessProfile: string;
};

const INITIAL_FORM: SalesFormState = {
  product: 'asoldi',
  businessName: '',
  contactPerson: '',
  contactEmail: '',
  contactPhone: '',
  meetingPlace: '',
  industry: '',
  meetingMode: 'online',
  agreedTime: false,
  meetingAt: '',
  websiteDomain: '',
  instagramUrl: '',
  facebookUrl: '',
  proffUrl: '',
  otherLinks: '',
  googleBusinessProfile: '',
};

function normalizeSalesProduct(value: unknown): SalesProduct {
  return String(value || '').trim().toLowerCase() === 'ssu' ? 'ssu' : 'asoldi';
}

function isSsuClient(client: Pick<SalesClient, 'product'> | null | undefined) {
  return normalizeSalesProduct(client?.product) === 'ssu';
}

function parseDetails(details: Record<string, unknown> | undefined) {
  const safe = details && typeof details === 'object' ? details : {};
  return {
    instagramUrl: String(safe.instagramUrl || ''),
    facebookUrl: String(safe.facebookUrl || ''),
    proffUrl: String(safe.proffUrl || ''),
    otherLinks: String(safe.otherLinks || ''),
    googleBusinessProfile: String(safe.googleBusinessProfile || ''),
  };
}

function durationForMode(mode: 'online' | 'in-person') {
  return mode === 'in-person' ? 60 : 30;
}

function toDateTimeLocal(value = '') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function toIsoDateTime(value = '') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function formatWhen(value = '') {
  if (!value) return 'Not agreed yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('nb-NO');
}

function formatDateTime(value = '') {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('nb-NO');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isTestLikeEmail(value = '') {
  const email = normalizeEmail(value);
  if (!email) return false;
  if (/(?:^|@)(?:example\.com|example\.org|example\.net|test\.com|mailinator\.com)$/i.test(email)) return true;
  const [localPart = ''] = email.split('@');
  return /(?:^|[-_.])(test|demo|sample|fake|qa|no-?reply|noreply)(?:[-_.]|\d|$)/i.test(localPart);
}

function buildRecordingProxyUrl(clientId = '') {
  const id = String(clientId || '').trim();
  if (!id) return '';
  return `${API}/admin/sales/${encodeURIComponent(id)}/recording`;
}

function normalizeClientSearchText(value = '') {
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

function matchesClientSearchQuery(haystack = '', rawQuery = '') {
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

function parseMeetingTimestamp(value = '') {
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return null;
  return time;
}

function pinStyleFor(pin: MeetingMapPin) {
  if (pin.status === 'not-sold') {
    return { color: '#9ca3af', fillColor: '#6b7280' };
  }
  if (pin.status === 'secondary') {
    return { color: '#c084fc', fillColor: '#a855f7' };
  }
  if (pin.meetingMode === 'online') {
    return { color: '#60a5fa', fillColor: '#3b82f6' };
  }
  return { color: '#ff7a2f', fillColor: '#FF5B00' };
}

function offsetOverlappingPin(lat: number, lng: number, indexAtCell: number): [number, number] {
  if (indexAtCell <= 0) return [lat, lng];
  const angle = indexAtCell * 2.399;
  const radius = 0.00018 * Math.ceil(indexAtCell / 6);
  return [lat + Math.cos(angle) * radius, lng + Math.sin(angle) * radius];
}

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type ProgressionKey = 'step0AgreeMeetingTime' | 'contractSigned' | 'paymentReceived' | 'domainConnected' | 'live';

function formatStepLabel(value: string) {
  if (value === 'step0AgreeMeetingTime') return 'Agree meeting time';
  if (value === 'contractSigned') return 'Contract signed';
  if (value === 'paymentReceived') return 'Payment received';
  if (value === 'domainConnected') return 'Domain connected';
  return 'Live';
}

function normalizeHttpBaseUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw);
  const looksLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(raw);
  const withProtocol = hasProtocol ? raw : `${looksLocal ? 'http' : 'https'}://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    // Sales stores a base host for Website Maker. If users paste a deep route
    // (e.g. /run/<id>), normalize to origin so links don't become /run/<id>/run/<id>.
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
}

function healStaleLocalMakerBase(value = '') {
  const normalized = normalizeHttpBaseUrl(value);
  if (!normalized) return '';
  // Maker local port is always :3000 — remap any legacy wrong local port.
  // Do not rewrite localhost to the office Docker host: away from home, Maker
  // runs on this computer and needs a tunnel from localhost:3000.
  return normalized.replace(
    /^(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)):(?:4000|3001|5173)(?=$)/i,
    '$1:3000'
  );
}

function isPrivateMakerHost(value = '') {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.\d+\.|172\.(1[6-9]|2\d|3[0-1])\./i.test(
    String(value || '')
  );
}

function tunnelPopupMakerOrigin(fieldUrl = '') {
  const origin = normalizeHttpBaseUrl(fieldUrl);
  if (!origin) return LOCAL_MAKER_URL;
  return isPrivateMakerHost(origin) ? origin : LOCAL_MAKER_URL;
}

function buildMakerRunUrl(
  baseUrl = '',
  runId = '',
  mode: 'dashboard' | 'preview' | 'intake' = 'dashboard',
  previewStep = '3',
) {
  const base = healStaleLocalMakerBase(baseUrl) || normalizeHttpBaseUrl(baseUrl);
  const id = String(runId || '').trim();
  if (!base || !id) return '';
  if (mode === 'preview') return `${base}/preview/${encodeURIComponent(id)}/step/${encodeURIComponent(previewStep || '3')}/view?route=/`;
  if (mode === 'intake') return `${base}/run-v2?draftRunId=${encodeURIComponent(id)}`;
  return `${base}/run/${encodeURIComponent(id)}`;
}

function resolveOpenInMakerUrl({
  baseUrl = '',
  runId = '',
  storedDashboardUrl = '',
  intakeStatus = '',
  latestReadyStep = '',
}: {
  baseUrl?: string;
  runId?: string;
  storedDashboardUrl?: string;
  intakeStatus?: string;
  latestReadyStep?: string;
}) {
  const id = String(runId || '').trim();
  const base = healStaleLocalMakerBase(baseUrl) || LAN_MAKER_URL;
  if (!id) return '';
  const stored = String(storedDashboardUrl || '').trim();
  const status = String(intakeStatus || '').trim().toLowerCase();
  const storedLooksLikeIntake = /\/run-v2(?:\?|$)/i.test(stored) && /[?&]draftRunId=/i.test(stored);
  const storedLooksLikeRun = /\/run\/[^/?#]+/i.test(stored) && !storedLooksLikeIntake;
  const hasReadyStep = Boolean(String(latestReadyStep || '').trim());
  // Prefer explicit intake status from Maker. Do NOT trap forever on a stale
  // stored draft URL once intake is configured / a pipeline step is ready.
  if (status === 'configured' || hasReadyStep || storedLooksLikeRun) {
    if (storedLooksLikeRun) {
      const remapped = remapMakerUrlToBase(base, stored);
      if (remapped) return normalizeMakerDashboardDraftUrl(remapped);
    }
    return buildMakerRunUrl(base, id, 'dashboard');
  }
  if (status === 'pending' || storedLooksLikeIntake) {
    return buildMakerRunUrl(base, id, 'intake');
  }
  // Unknown status: keep path semantics from stored URL when present.
  if (stored) {
    const remapped = remapMakerUrlToBase(base, stored);
    if (remapped) return normalizeMakerDashboardDraftUrl(remapped);
  }
  return buildMakerRunUrl(base, id, 'dashboard');
}

function remapMakerUrlToBase(baseUrl = '', absoluteUrl = '') {
  const base = normalizeHttpBaseUrl(baseUrl);
  const raw = String(absoluteUrl || '').trim();
  if (!base || !raw) return '';
  try {
    const source = new URL(raw);
    if (source.protocol !== 'http:' && source.protocol !== 'https:') return '';
    const suffix = `${source.pathname || ''}${source.search || ''}${source.hash || ''}`;
    const normalizedSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`;
    return `${base}${normalizedSuffix}`;
  } catch {
    return '';
  }
}

function normalizeMakerDashboardDraftUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const rewrite = (url: URL) => {
    if (url.pathname !== '/run-v2') return false;
    if (!url.searchParams.get('draftRunId')) return false;
    url.searchParams.delete('__chunk_retry');
    return true;
  };

  try {
    const parsed = new URL(raw);
    if (!rewrite(parsed)) return raw;
    return parsed.toString();
  } catch {
    try {
      const relative = new URL(raw, 'https://asoldi.local');
      if (!rewrite(relative)) return raw;
      return `${relative.pathname}${relative.search}${relative.hash}`;
    } catch {
      return raw;
    }
  }
}

export function SalesClientsSection({ onPromotedToClient }: Props) {
  const [clients, setClients] = useState<SalesClient[]>([]);
  const [productCounts, setProductCounts] = useState<{ asoldi: number; ssu: number }>({ asoldi: 0, ssu: 0 });
  const [productBracket, setProductBracket] = useState<SalesProduct>('asoldi');
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [emailActionFeedback, setEmailActionFeedback] = useState<{
    clientId: string;
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [clientSearchInput, setClientSearchInput] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SalesFormState>(INITIAL_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [linkingRunId, setLinkingRunId] = useState<string | null>(null);
  const [sendingWelcomeId, setSendingWelcomeId] = useState<string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [deletingArchivedId, setDeletingArchivedId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [creatingRunId, setCreatingRunId] = useState<string | null>(null);
  const [publishingMakerId, setPublishingMakerId] = useState<string | null>(null);
  const [openingMakerId, setOpeningMakerId] = useState<string | null>(null);
  const [startingMakerTunnel, setStartingMakerTunnel] = useState(false);
  const [progressBusyKey, setProgressBusyKey] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [websiteMakerBaseUrl, setWebsiteMakerBaseUrl] = useState(LAN_MAKER_URL);
  const [runIdByClient, setRunIdByClient] = useState<Record<string, string>>({});
  const [meetingNowMs, setMeetingNowMs] = useState(() => Date.now());
  const [meetingMapPins, setMeetingMapPins] = useState<MeetingMapPin[]>([]);
  const [meetingMapLoading, setMeetingMapLoading] = useState(false);
  const [meetingMapError, setMeetingMapError] = useState('');
  const [meetingMapUnresolvedCount, setMeetingMapUnresolvedCount] = useState(0);
  const [meetingMapPendingCount, setMeetingMapPendingCount] = useState(0);
  const [meetingMapMissingAddressCount, setMeetingMapMissingAddressCount] = useState(0);
  const [recordingBlobUrlByClient, setRecordingBlobUrlByClient] = useState<Record<string, string>>({});
  const [recordingOpenClientId, setRecordingOpenClientId] = useState<string | null>(null);
  const [recordingLoadingClientId, setRecordingLoadingClientId] = useState<string | null>(null);
  const [recordingErrorByClient, setRecordingErrorByClient] = useState<Record<string, string>>({});
  const meetingMapContainerRef = useRef<HTMLDivElement | null>(null);
  const meetingMapRef = useRef<any>(null);
  const meetingMapMarkerLayerRef = useRef<any>(null);
  const recordingBlobUrlsRef = useRef<Record<string, string>>({});

  // Website offers (tier + nettsidekode given to a client).
  const [offers, setOffers] = useState<WebsiteOffer[]>([]);
  const [offerOpenId, setOfferOpenId] = useState<string | null>(null);
  const [offerPlanId, setOfferPlanId] = useState('tier-1-standard');
  const [offerNote, setOfferNote] = useState('');
  const [offerSearch, setOfferSearch] = useState('');
  const [offerResults, setOfferResults] = useState<ClientUserResult[]>([]);
  const [offerSelectedUser, setOfferSelectedUser] = useState<ClientUserResult | null>(null);
  const [offerSearching, setOfferSearching] = useState(false);
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null);

  const formDuration = useMemo(() => durationForMode(form.meetingMode), [form.meetingMode]);
  const normalizedClientSearchQuery = useMemo(
    () => normalizeClientSearchText(clientSearchQuery),
    [clientSearchQuery]
  );
  const productClients = useMemo(
    () => clients.filter((client) => normalizeSalesProduct(client.product) === productBracket),
    [clients, productBracket]
  );
  const isSsuBracket = productBracket === 'ssu';
  const clientMatchesNameSearch = (client: SalesClient) => {
    if (!normalizedClientSearchQuery) return true;
    const haystack = [
      client.businessName,
      client.contactPerson,
      client.contactEmail,
      client.contactPhone,
      client.meetingPlace,
      client.industry,
    ]
      .map((entry) => normalizeClientSearchText(entry))
      .filter(Boolean)
      .join(' ');
    return matchesClientSearchQuery(haystack, normalizedClientSearchQuery);
  };
  const timelineClients = useMemo(
    () => productClients.filter((client) => client.status !== 'not-sold' && clientMatchesNameSearch(client)),
    [productClients, normalizedClientSearchQuery]
  );
  const emailAudit = useMemo(() => {
    const rows = productClients.map((client) => {
      const email = normalizeEmail(client.contactEmail);
      const hasEmail = Boolean(email);
      const valid = hasEmail && EMAIL_RE.test(email);
      const testLike = valid && isTestLikeEmail(email);
      return { hasEmail, valid, testLike };
    });
    return {
      total: rows.length,
      withAnyEmail: rows.filter((entry) => entry.hasEmail).length,
      valid: rows.filter((entry) => entry.valid).length,
      validNonTest: rows.filter((entry) => entry.valid && !entry.testLike).length,
      missing: rows.filter((entry) => !entry.hasEmail).length,
      invalid: rows.filter((entry) => entry.hasEmail && !entry.valid).length,
      flaggedTest: rows.filter((entry) => entry.testLike).length,
    };
  }, [productClients]);
  const archivedClients = useMemo(
    () => productClients.filter((client) => client.status === 'not-sold' && clientMatchesNameSearch(client)),
    [productClients, normalizedClientSearchQuery]
  );
  const activeMeetingGroups = useMemo(() => {
    const upcoming: SalesClient[] = [];
    const pastDue: SalesClient[] = [];
    const noMeetingDate: SalesClient[] = [];

    for (const client of timelineClients) {
      const meetingTime = client.agreedTime ? parseMeetingTimestamp(client.meetingAt) : null;
      if (meetingTime === null) {
        noMeetingDate.push(client);
      } else if (meetingTime < meetingNowMs) {
        pastDue.push(client);
      } else {
        upcoming.push(client);
      }
    }

    upcoming.sort((a, b) => (parseMeetingTimestamp(a.meetingAt) || 0) - (parseMeetingTimestamp(b.meetingAt) || 0));
    pastDue.sort((a, b) => (parseMeetingTimestamp(b.meetingAt) || 0) - (parseMeetingTimestamp(a.meetingAt) || 0));
    noMeetingDate.sort((a, b) =>
      String(a.businessName || '').localeCompare(String(b.businessName || ''), 'nb-NO', { sensitivity: 'base' })
    );

    return { upcoming, pastDue, noMeetingDate };
  }, [timelineClients, meetingNowMs]);
  const orderedTimelineClients = useMemo(
    () => [...activeMeetingGroups.upcoming, ...activeMeetingGroups.noMeetingDate, ...activeMeetingGroups.pastDue],
    [activeMeetingGroups]
  );
  const firstNoMeetingDateClientId = activeMeetingGroups.noMeetingDate[0]?.id || '';
  const firstPastDueClientId = activeMeetingGroups.pastDue[0]?.id || '';
  const visibleMeetingMapPins = useMemo(() => {
    const allowedIds = new Set(productClients.map((client) => client.id));
    return meetingMapPins.filter((pin) => allowedIds.has(pin.clientId));
  }, [meetingMapPins, productClients]);

  async function request(path: string, init?: RequestInit) {
    const headers: Record<string, string> = {
      ...salesAuthHeaders(),
      ...(init?.headers as Record<string, string> || {}),
    };
    if (init?.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers,
    });
    const data = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok) {
      const message = String(
        (data as { message?: string; error?: string })?.message
        || (data as { message?: string; error?: string })?.error
        || `Request failed (${response.status})`
      ).trim();
      throw new Error(message || `Request failed (${response.status})`);
    }
    return data;
  }

  async function loadMeetingMap(options?: { quiet?: boolean }) {
    const quiet = Boolean(options?.quiet);
    if (!quiet) setMeetingMapLoading(true);
    setMeetingMapError('');
    try {
      const data = await request('/admin/sales/meeting-map');
      const pins = Array.isArray(data.pins) ? data.pins : [];
      setMeetingMapPins(pins as MeetingMapPin[]);
      setMeetingMapUnresolvedCount(Number.isFinite(Number(data.unresolvedCount)) ? Number(data.unresolvedCount) : 0);
      setMeetingMapPendingCount(Number.isFinite(Number(data.pendingCount)) ? Number(data.pendingCount) : 0);
      setMeetingMapMissingAddressCount(
        Number.isFinite(Number(data.missingAddressCount)) ? Number(data.missingAddressCount) : 0
      );
    } catch (err) {
      setMeetingMapError(err instanceof Error ? err.message : 'Failed loading client map');
      setMeetingMapPins([]);
      setMeetingMapUnresolvedCount(0);
      setMeetingMapPendingCount(0);
      setMeetingMapMissingAddressCount(0);
    } finally {
      if (!quiet) setMeetingMapLoading(false);
    }
  }

  async function loadSales(options: { clearMessages?: boolean; showLoading?: boolean } = {}) {
    const clearMessages = options.clearMessages !== false;
    const showLoading = options.showLoading !== false;
    if (showLoading) setLoading(true);
    if (clearMessages) {
      setError('');
      setNotice('');
    }
    try {
      const data = await request('/admin/sales');
      const nextClients = Array.isArray(data.clients) ? data.clients : [];
      setClients(nextClients);
      const counts = data.products && typeof data.products === 'object'
        ? data.products
        : {
            asoldi: nextClients.filter((client: SalesClient) => normalizeSalesProduct(client.product) === 'asoldi').length,
            ssu: nextClients.filter((client: SalesClient) => normalizeSalesProduct(client.product) === 'ssu').length,
          };
      setProductCounts({
        asoldi: Number(counts.asoldi) || 0,
        ssu: Number(counts.ssu) || 0,
      });
      setCalendarStatus((data.calendar || null) as CalendarStatus | null);
      void loadMeetingMap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales clients');
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function loadOffers() {
    try {
      const data = await request('/admin/sales/offers');
      setOffers(Array.isArray(data.offers) ? data.offers : []);
    } catch {
      // Offers are non-critical for the main list; ignore load errors here.
    }
  }

  useEffect(() => {
    void loadSales();
    void loadOffers();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setMeetingNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const hasPendingMapGeocodes = meetingMapPendingCount > 0;
  useEffect(() => {
    if (!hasPendingMapGeocodes) return undefined;
    const timer = window.setInterval(() => {
      void loadMeetingMap({ quiet: true });
    }, 2500);
    return () => window.clearInterval(timer);
  }, [hasPendingMapGeocodes]);

  useEffect(() => {
    recordingBlobUrlsRef.current = recordingBlobUrlByClient;
  }, [recordingBlobUrlByClient]);

  useEffect(() => () => {
    for (const url of Object.values(recordingBlobUrlsRef.current || {}) as string[]) {
      if (!url) continue;
      URL.revokeObjectURL(url);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function syncMeetingMap() {
      if (!meetingMapContainerRef.current) return;
      const L = await import('leaflet');
      if (cancelled || !meetingMapContainerRef.current) return;

      if (!meetingMapRef.current) {
        const map = L.map(meetingMapContainerRef.current, {
          zoomControl: true,
          // Keep page scrolling natural when cursor is over the map panel.
          scrollWheelZoom: false,
        });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);
        map.setView(SALES_MAP_DEFAULT_CENTER, SALES_MAP_DEFAULT_ZOOM);
        window.setTimeout(() => {
          try {
            map.invalidateSize();
          } catch {
            // Map may already have been torn down.
          }
        }, 80);
        const mapContainer = map.getContainer?.();
        if (mapContainer) {
          mapContainer.style.position = 'relative';
          mapContainer.style.zIndex = '0';
        }
        const tilePane = map.getPane?.('tilePane');
        const overlayPane = map.getPane?.('overlayPane');
        const markerPane = map.getPane?.('markerPane');
        const popupPane = map.getPane?.('popupPane');
        if (tilePane) tilePane.style.zIndex = '1';
        if (overlayPane) overlayPane.style.zIndex = '2';
        if (markerPane) markerPane.style.zIndex = '3';
        if (popupPane) popupPane.style.zIndex = '4';
        meetingMapRef.current = map;
        meetingMapMarkerLayerRef.current = L.layerGroup().addTo(map);
      }

      const map = meetingMapRef.current;
      if (!map) return;
      const markerLayer = meetingMapMarkerLayerRef.current || L.layerGroup().addTo(map);
      markerLayer.clearLayers();

      if (!visibleMeetingMapPins.length) {
        map.setView(SALES_MAP_DEFAULT_CENTER, SALES_MAP_DEFAULT_ZOOM);
        return;
      }

      const bounds = L.latLngBounds([]);
      const occupancy = new Map<string, number>();
      for (const pin of visibleMeetingMapPins) {
        const lat = Number(pin.latitude);
        const lng = Number(pin.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const cellKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
        const overlapIndex = occupancy.get(cellKey) || 0;
        occupancy.set(cellKey, overlapIndex + 1);
        const [markerLat, markerLng] = offsetOverlappingPin(lat, lng, overlapIndex);
        const style = pinStyleFor(pin);
        const marker = L.circleMarker([markerLat, markerLng], {
          radius: 8,
          color: style.color,
          weight: 2,
          fillColor: style.fillColor,
          fillOpacity: 0.85,
        });
        const modeLabel = pin.meetingMode === 'online' ? 'Online' : 'In person';
        const statusLabel = pin.status === 'not-sold' ? 'Not sold' : pin.status === 'secondary' ? 'Secondary' : 'Active';
        const popupHtml = [
          `<div style="min-width:180px;line-height:1.35;font-size:12px;">`,
          `<div style="font-weight:600;margin-bottom:4px;">${escapeHtml(pin.businessName || 'Client')}</div>`,
          pin.contactPerson ? `<div style="margin-bottom:2px;">${escapeHtml(pin.contactPerson)}</div>` : '',
          `<div style="margin-bottom:2px;">${escapeHtml(pin.meetingPlace || '')}</div>`,
          `<div style="margin-bottom:2px;color:#6b7280;">${escapeHtml(modeLabel)} · ${escapeHtml(statusLabel)}</div>`,
          pin.meetingAt ? `<div style="color:#6b7280;">${escapeHtml(formatWhen(pin.meetingAt))}</div>` : '',
          '</div>',
        ].join('');
        marker.bindPopup(popupHtml);
        marker.addTo(markerLayer);
        bounds.extend([markerLat, markerLng]);
      }

      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2), { maxZoom: 13 });
      }
    }
    void syncMeetingMap();
    return () => {
      cancelled = true;
    };
  }, [visibleMeetingMapPins]);

  useEffect(
    () => () => {
      if (meetingMapRef.current) {
        meetingMapRef.current.remove();
        meetingMapRef.current = null;
        meetingMapMarkerLayerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MAKER_BASE_URL_STORAGE_KEY);
      if (!stored) return;
      const normalized = healStaleLocalMakerBase(stored) || normalizeHttpBaseUrl(stored);
      if (normalized) setWebsiteMakerBaseUrl(normalized);
    } catch {
      // Ignore storage access issues.
    }
  }, []);

  useEffect(() => {
    const normalized = healStaleLocalMakerBase(websiteMakerBaseUrl) || normalizeHttpBaseUrl(websiteMakerBaseUrl);
    if (!normalized) return;
    if (normalized !== websiteMakerBaseUrl) {
      setWebsiteMakerBaseUrl(normalized);
      return;
    }
    try {
      window.localStorage.setItem(MAKER_BASE_URL_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage access issues.
    }
  }, [websiteMakerBaseUrl]);

  // Live (debounced) search of registered client accounts while an offer panel
  // is open. Runs with an empty query on open so the rep immediately sees the
  // signed-up clients, then filters as they type.
  useEffect(() => {
    if (!offerOpenId || offerSelectedUser) return;
    let active = true;
    setOfferSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await request(`/admin/sales/client-search?q=${encodeURIComponent(offerSearch.trim())}`);
        if (active) setOfferResults(Array.isArray(data.users) ? data.users : []);
      } catch {
        if (active) setOfferResults([]);
      } finally {
        if (active) setOfferSearching(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [offerSearch, offerOpenId, offerSelectedUser]);

  function openOfferPanel(client: SalesClient) {
    setOfferOpenId((prev) => (prev === client.id ? null : client.id));
    setOfferPlanId('tier-1-standard');
    setOfferNote('');
    setOfferSearch('');
    setOfferResults([]);
    setOfferSelectedUser(null);
    setLastCreatedCode(null);
    setError('');
  }

  async function createOffer(client: SalesClient) {
    setCreatingOffer(true);
    setError('');
    try {
      const selectedRunId = String(runIdByClient[client.id] || client.makerRun?.runId || '').trim();
      const data = await request('/admin/sales/offers', {
        method: 'POST',
        body: JSON.stringify({
          planId: offerPlanId,
          note: offerNote,
          salesClientId: client.id,
          runId: selectedRunId,
          websiteMakerBaseUrl,
          targetUserId: offerSelectedUser?.userId || '',
          targetEmail: offerSelectedUser?.email || '',
        }),
      });
      setLastCreatedCode(data.offer?.code || null);
      setOfferNote('');
      await loadSales();
      await loadOffers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed creating offer');
    } finally {
      setCreatingOffer(false);
    }
  }

  async function deleteOffer(id: string) {
    setError('');
    try {
      await request(`/admin/sales/offers/${id}`, { method: 'DELETE' });
      await loadOffers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed deleting offer');
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...INITIAL_FORM, product: productBracket });
    setShowForm(true);
  }

  function openEdit(client: SalesClient) {
    const details = parseDetails(client.details);
    setEditingId(client.id);
    setForm({
      product: normalizeSalesProduct(client.product),
      businessName: client.businessName || '',
      contactPerson: client.contactPerson || '',
      contactEmail: client.contactEmail || '',
      contactPhone: client.contactPhone || '',
      meetingPlace: client.meetingPlace || '',
      industry: client.industry || '',
      meetingMode: client.meetingMode === 'in-person' ? 'in-person' : 'online',
      agreedTime: Boolean(client.agreedTime),
      meetingAt: toDateTimeLocal(client.meetingAt),
      websiteDomain: client.websiteDomain || '',
      instagramUrl: details.instagramUrl,
      facebookUrl: details.facebookUrl,
      proffUrl: details.proffUrl,
      otherLinks: details.otherLinks,
      googleBusinessProfile: details.googleBusinessProfile,
    });
    setShowForm(true);
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        product: form.product,
        businessName: form.businessName,
        contactPerson: form.contactPerson,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        meetingPlace: form.meetingPlace,
        industry: form.industry,
        meetingMode: form.meetingMode,
        agreedTime: form.agreedTime,
        meetingAt: form.agreedTime ? toIsoDateTime(form.meetingAt) : '',
        websiteDomain: form.product === 'ssu' ? '' : form.websiteDomain,
        details: {
          instagramUrl: form.instagramUrl,
          facebookUrl: form.facebookUrl,
          proffUrl: form.proffUrl,
          otherLinks: form.otherLinks,
          googleBusinessProfile: form.googleBusinessProfile,
        },
      };
      const endpoint = editingId ? `/admin/sales/${editingId}` : '/admin/sales';
      const method = editingId ? 'PUT' : 'POST';
      const data = await request(endpoint, {
        method,
        body: JSON.stringify(payload),
      });
      if (Array.isArray(data.warnings) && data.warnings.length) {
        setError(data.warnings.join(' | '));
      }
      setShowForm(false);
      setEditingId(null);
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed saving sales client');
    } finally {
      setSaving(false);
    }
  }

  async function toggleProgress(client: SalesClient, key: ProgressionKey) {
    if (key === 'step0AgreeMeetingTime') {
      openEdit(client);
      return;
    }
    setProgressBusyKey(`${client.id}:${key}`);
    setError('');
    try {
      await request(`/admin/sales/${client.id}/progression`, {
        method: 'PATCH',
        body: JSON.stringify({
          key,
          value: !client.progression?.[key],
        }),
      });
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed updating progression');
    } finally {
      setProgressBusyKey(null);
    }
  }

  async function syncWebsiteFromMaker(client: SalesClient) {
    const fallbackRunId = String(runIdByClient[client.id] || '').trim();
    const linkedRunId = String(client.makerRun?.runId || '').trim();
    const runId = linkedRunId || fallbackRunId;
    if (!runId) {
      setError('Create or link a Website Maker run before syncing.');
      return;
    }
    setSyncingId(client.id);
    setError('');
    try {
      await request(`/admin/sales/${client.id}/import-website`, {
        method: 'POST',
        body: JSON.stringify({
          runId,
          websiteMakerBaseUrl,
          siteFolder: client.businessName || 'site',
          step: 'latest',
        }),
      });
      await loadSales();
      await loadOffers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed syncing website from maker');
    } finally {
      setSyncingId(null);
    }
  }

  async function linkMakerRun(client: SalesClient) {
    const runId = String(runIdByClient[client.id] || '').trim();
    if (!runId) {
      setError('Enter an existing Website Maker run ID before linking.');
      return;
    }
    setLinkingRunId(client.id);
    setError('');
    try {
      await request(`/admin/sales/${client.id}/link-maker-run`, {
        method: 'POST',
        body: JSON.stringify({
          runId,
          websiteMakerBaseUrl,
        }),
      });
      setRunIdByClient((prev) => ({ ...prev, [client.id]: '' }));
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed linking Website Maker run');
    } finally {
      setLinkingRunId(null);
    }
  }

  async function createMakerRun(client: SalesClient, options: { forceNewRun?: boolean } = {}) {
    const forceNewRun = Boolean(options.forceNewRun);
    if (forceNewRun) {
      const confirmed = window.confirm(
        'Do you want to delete the other run request?'
      );
      if (!confirmed) return;
    }
    setCreatingRunId(client.id);
    setError('');
    try {
      const makerBase =
        healStaleLocalMakerBase(websiteMakerBaseUrl) ||
        normalizeHttpBaseUrl(websiteMakerBaseUrl) ||
        LAN_MAKER_URL;
      if (makerBase !== websiteMakerBaseUrl) setWebsiteMakerBaseUrl(makerBase);
      let data = await request(`/admin/sales/${client.id}/create-maker-run`, {
        method: 'POST',
        body: JSON.stringify({
          websiteMakerBaseUrl: makerBase,
          forceNewRun,
        }),
      });
      if (data?.browserHandoff) {
        const created = await createRunViaMakerPopup(
          String(data.websiteMakerBaseUrl || makerBase),
          data.requestBody && typeof data.requestBody === 'object'
            ? (data.requestBody as Record<string, unknown>)
            : {}
        );
        data = await request(`/admin/sales/${client.id}/create-maker-run`, {
          method: 'POST',
          body: JSON.stringify({
            websiteMakerBaseUrl: makerBase,
            forceNewRun,
            browserCreated: created,
          }),
        });
      }
      const resolvedBase =
        normalizeHttpBaseUrl(String(data?.websiteMakerBaseUrl || '')) || makerBase;
      if (resolvedBase) setWebsiteMakerBaseUrl(resolvedBase);
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed creating website run');
    } finally {
      setCreatingRunId(null);
    }
  }

  async function publishMakerRunToProd(client: SalesClient) {
    const makerRunId = String(client.makerRun?.runId || '').trim();
    if (!makerRunId) {
      setError('Create or link a Website Maker run on this LAN client first.');
      return;
    }
    const confirmed = window.confirm(
      'Publish only this website run (preview/dashboard links) to asoldi.com?\n\nClient name, status, MyPhoner data, and other CRM fields on production will not change.'
    );
    if (!confirmed) return;
    setPublishingMakerId(client.id);
    setError('');
    setNotice('');
    try {
      const data = await request(`/admin/sales/${client.id}/publish-maker-run-to-prod`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const extra = typeof data?.warning === 'string' && data.warning ? ` ${data.warning}` : '';
      setNotice(`Website run ${makerRunId} is now on asoldi.com/sales.${extra}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed publishing website run to asoldi.com');
    } finally {
      setPublishingMakerId(null);
    }
  }

  async function openInMaker(client: SalesClient) {
    const makerRunId = String(client.makerRun?.runId || '').trim();
    if (!makerRunId) {
      setError('No Website Maker run is linked to this client yet.');
      return;
    }
    setOpeningMakerId(client.id);
    setError('');
    const fallbackUrl = resolveOpenInMakerUrl({
      baseUrl: websiteMakerBaseUrl,
      runId: makerRunId,
      storedDashboardUrl: normalizeMakerDashboardDraftUrl(String(client.makerRun?.dashboardUrl || '').trim()),
      intakeStatus: String(client.makerRun?.intakeStatus || ''),
      latestReadyStep: String(client.makerRun?.latestReadyStep || ''),
    });
    try {
      const data = await request(`/admin/sales/${client.id}/refresh-maker-handoff`, {
        method: 'POST',
        body: JSON.stringify({
          websiteMakerBaseUrl,
          runId: makerRunId,
        }),
      });
      const resolvedBase = normalizeHttpBaseUrl(data?.websiteMakerBaseUrl || '');
      if (resolvedBase) setWebsiteMakerBaseUrl(resolvedBase);
      const refreshedUrl = resolveOpenInMakerUrl({
        baseUrl: resolvedBase || websiteMakerBaseUrl,
        runId: makerRunId,
        storedDashboardUrl: normalizeMakerDashboardDraftUrl(String(data?.dashboardUrl || data?.client?.makerRun?.dashboardUrl || '').trim()),
        intakeStatus: String(data?.intakeStatus || data?.client?.makerRun?.intakeStatus || ''),
        latestReadyStep: String(data?.client?.makerRun?.latestReadyStep || client.makerRun?.latestReadyStep || ''),
      });
      const target = refreshedUrl || fallbackUrl;
      if (!target) throw new Error('Could not resolve Website Maker URL for this client.');
      window.open(target, '_blank');
      await loadSales();
    } catch (err) {
      if (fallbackUrl) {
        window.open(fallbackUrl, '_blank');
      }
      setError(err instanceof Error ? err.message : 'Failed opening Website Maker');
    } finally {
      setOpeningMakerId(null);
    }
  }

  async function sendWelcomeEmail(client: SalesClient) {
    setSendingWelcomeId(client.id);
    setError('');
    setNotice('');
    setEmailActionFeedback(null);
    try {
      if (!client.contactEmail) throw new Error('Client contact email is missing.');
      if (!client.agreedTime || !client.meetingAt) {
        throw new Error('Meeting date/time must be set before sending this email.');
      }
      const data = await request(`/admin/sales/${client.id}/send-welcome-email`, { method: 'POST' });
      await loadSales({ clearMessages: false, showLoading: false });
      const warnings = Array.isArray(data?.warnings) ? data.warnings.filter(Boolean) : [];
      const meetLink = String(data?.meetLink || data?.client?.calendar?.meetLink || '').trim();
      const parts = [`Welcome email sent to ${client.contactEmail}`];
      if (meetLink) parts.push(`Meet: ${meetLink}`);
      else if (client.meetingMode === 'online') parts.push('Meet link: not created yet (connect Google Calendar / sync meeting)');
      if (warnings.length) parts.push(`Warning: ${warnings.join(' | ')}`);
      const text = parts.join(' · ');
      setNotice(text);
      setEmailActionFeedback({ clientId: client.id, tone: 'ok', text });
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Failed sending welcome email';
      setError(text);
      setEmailActionFeedback({ clientId: client.id, tone: 'err', text });
    } finally {
      setSendingWelcomeId(null);
    }
  }

  async function sendReminderEmail(client: SalesClient) {
    setSendingReminderId(client.id);
    setError('');
    setNotice('');
    setEmailActionFeedback(null);
    try {
      if (!client.contactEmail) throw new Error('Client contact email is missing.');
      if (!client.agreedTime || !client.meetingAt) {
        throw new Error('Meeting date/time must be set before sending this email.');
      }
      const data = await request(`/admin/sales/${client.id}/send-reminder`, {
        method: 'POST',
        body: JSON.stringify({ kind: '24h' }),
      });
      await loadSales({ clearMessages: false, showLoading: false });
      const meetLink = String(data?.meetLink || data?.client?.calendar?.meetLink || '').trim();
      const parts = [`Reminder email sent to ${client.contactEmail}`];
      if (meetLink) parts.push(`Meet: ${meetLink}`);
      const text = parts.join(' · ');
      setNotice(text);
      setEmailActionFeedback({ clientId: client.id, tone: 'ok', text });
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Failed sending reminder email';
      setError(text);
      setEmailActionFeedback({ clientId: client.id, tone: 'err', text });
    } finally {
      setSendingReminderId(null);
    }
  }

  async function toggleInlineRecording(client: SalesClient) {
    const existingBlobUrl = recordingBlobUrlByClient[client.id];
    if (recordingOpenClientId === client.id) {
      setRecordingOpenClientId(null);
      return;
    }
    if (existingBlobUrl) {
      setRecordingOpenClientId(client.id);
      return;
    }
    setRecordingLoadingClientId(client.id);
    setRecordingErrorByClient((prev) => ({ ...prev, [client.id]: '' }));
    try {
      const response = await fetch(buildRecordingProxyUrl(client.id), {
        method: 'GET',
        headers: salesAuthHeaders(),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed loading recording audio.');
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setRecordingBlobUrlByClient((prev) => ({ ...prev, [client.id]: blobUrl }));
      setRecordingOpenClientId(client.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed loading recording audio.';
      setRecordingErrorByClient((prev) => ({ ...prev, [client.id]: message }));
      setRecordingOpenClientId(client.id);
    } finally {
      setRecordingLoadingClientId(null);
    }
  }

  async function promoteClient(client: SalesClient) {
    setPromotingId(client.id);
    setError('');
    try {
      await request(`/admin/sales/${client.id}/got-client`, { method: 'POST' });
      await loadSales();
      onPromotedToClient?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed promoting client');
    } finally {
      setPromotingId(null);
    }
  }

  async function markNotSold(client: SalesClient) {
    const label = client.businessName || 'this client';
    const reasonInput = window.prompt(`Optional reason for archiving "${label}" as not sold:`, '');
    if (reasonInput === null) return;
    setStatusBusyId(`not-sold:${client.id}`);
    setError('');
    try {
      await request(`/admin/sales/${client.id}/not-sold`, {
        method: 'POST',
        body: JSON.stringify({ reason: reasonInput }),
      });
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed archiving client as not sold');
    } finally {
      setStatusBusyId(null);
    }
  }

  async function markSecondary(client: SalesClient) {
    const label = client.businessName || 'this client';
    const reasonInput = window.prompt(`Optional note for moving "${label}" to Sekundært:`, '');
    if (reasonInput === null) return;
    setStatusBusyId(`secondary:${client.id}`);
    setError('');
    try {
      await request(`/admin/sales/${client.id}/secondary`, {
        method: 'POST',
        body: JSON.stringify({ reason: reasonInput }),
      });
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed moving client to Sekundært');
    } finally {
      setStatusBusyId(null);
    }
  }

  async function restoreArchivedClient(client: SalesClient) {
    setStatusBusyId(`restore:${client.id}`);
    setError('');
    try {
      await request(`/admin/sales/${client.id}/restore`, { method: 'POST' });
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed restoring archived client');
    } finally {
      setStatusBusyId(null);
    }
  }

  async function deleteArchivedClient(client: SalesClient) {
    const label = client.businessName || 'this archived client';
    const ok = window.confirm(`Delete "${label}" permanently? This cannot be undone.`);
    if (!ok) return;
    setDeletingArchivedId(client.id);
    setError('');
    try {
      await request(`/admin/sales/${client.id}`, { method: 'DELETE' });
      await loadSales();
      await loadOffers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed deleting archived client');
    } finally {
      setDeletingArchivedId(null);
    }
  }

  async function connectGoogleCalendar() {
    setError('');
    try {
      const data = await request('/admin/sales/google/auth-url');
      const popup = window.open(String(data.authUrl || ''), 'asoldi-google-calendar', 'width=560,height=760');
      if (!popup) {
        setError('Popup blocked. Please allow popups and try again.');
        return;
      }
      setTimeout(() => {
        void loadSales();
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Google OAuth');
    }
  }

  async function createRunViaMakerPopup(
    makerBase: string,
    requestBody: Record<string, unknown>
  ): Promise<{ runId: string; handoff: Record<string, unknown> }> {
    const makerOrigin = normalizeHttpBaseUrl(makerBase);
    if (!makerOrigin) {
      throw new Error('Website Maker URL is invalid.');
    }
    const popupUrl = new URL('/sales-create-run', makerOrigin);
    popupUrl.searchParams.set('returnOrigin', window.location.origin);
    try {
      const encoded = encodeURIComponent(JSON.stringify(requestBody || {}));
      if (encoded.length < 50000) popupUrl.hash = `p=${encoded}`;
    } catch {
      // Fall back to postMessage if the payload cannot be hashed.
    }
    const popup = window.open(popupUrl.toString(), 'asoldi-sales-create-run', 'width=520,height=420');
    if (!popup) {
      throw new Error('Popup blocked. Allow popups for this site and try Create run again.');
    }

    return await new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        window.clearTimeout(timeoutId);
        window.clearInterval(closeWatcherId);
      };
      const finish = (handler: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        handler();
      };
      const timeoutId = window.setTimeout(() => {
        finish(() =>
          reject(
            new Error(
              `Timed out creating the run at ${makerOrigin}. Confirm Website Maker is open in this browser and try again.`
            )
          )
        );
      }, 90_000);
      const closeWatcherId = window.setInterval(() => {
        if (!popup.closed) return;
        finish(() => reject(new Error('The Website Maker popup was closed before the run was created.')));
      }, 450);

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== makerOrigin) return;
        const payload = event.data && typeof event.data === 'object' ? (event.data as Record<string, unknown>) : null;
        if (!payload) return;
        if (payload.type === 'asoldi-sales-create-run-listening') {
          popup.postMessage({ type: 'asoldi-sales-create-run', requestBody }, makerOrigin);
          return;
        }
        if (payload.type === 'asoldi-sales-create-run-error') {
          finish(() => reject(new Error(String(payload.message || 'Failed creating website run.'))));
          return;
        }
        if (payload.type === 'asoldi-sales-create-run-ready') {
          const runId = String(payload.runId || '').trim();
          if (!runId) {
            finish(() => reject(new Error('Website Maker did not return a runId.')));
            return;
          }
          const handoff =
            payload.handoff && typeof payload.handoff === 'object'
              ? (payload.handoff as Record<string, unknown>)
              : {};
          finish(() => resolve({ runId, handoff }));
        }
      };

      window.addEventListener('message', onMessage);
    });
  }

  async function startMakerTunnel() {
    setStartingMakerTunnel(true);
    setError('');
    try {
      const tunnelHost = tunnelPopupMakerOrigin(websiteMakerBaseUrl);
      const popupUrl = new URL('/local-tunnel', tunnelHost);
      popupUrl.searchParams.set('returnOrigin', window.location.origin);
      popupUrl.searchParams.set('targetUrl', LOCAL_MAKER_URL);
      popupUrl.searchParams.set('forceRestart', '0');
      const popup = window.open(popupUrl.toString(), 'asoldi-maker-local-tunnel', 'width=620,height=740');
      if (!popup) {
        throw new Error('Popup blocked. Allow popups and try again.');
      }
      const tunnelUrl = await new Promise<string>((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
          window.removeEventListener('message', onMessage);
          window.clearTimeout(timeoutId);
          window.clearInterval(closeWatcherId);
        };
        const finish = (handler: () => void) => {
          if (settled) return;
          settled = true;
          cleanup();
          handler();
        };
        const timeoutId = window.setTimeout(() => {
          finish(() =>
            reject(
              new Error(
                `Timed out waiting for tunnel setup. Start Website Maker on this computer (${LOCAL_MAKER_URL}) or on the office Docker host (${LAN_MAKER_URL}), then try again.`
              )
            )
          );
        }, 300_000);
        const closeWatcherId = window.setInterval(() => {
          if (!popup.closed) return;
          finish(() => reject(new Error('Tunnel popup was closed before completion.')));
        }, 450);
        const onMessage = (event: MessageEvent) => {
          if (event.origin !== tunnelHost) return;
          const payload = event.data && typeof event.data === 'object' ? (event.data as Record<string, unknown>) : null;
          if (!payload) return;
          if (payload.type === 'asoldi-maker-tunnel-error') {
            finish(() => reject(new Error(String(payload.message || 'Failed starting local tunnel.'))));
            return;
          }
          if (payload.type === 'asoldi-maker-tunnel-ready') {
            const next = normalizeHttpBaseUrl(String(payload.tunnelUrl || ''));
            if (!next) {
              finish(() => reject(new Error('Local tunnel returned an invalid URL.')));
              return;
            }
            finish(() => resolve(next));
          }
        };
        window.addEventListener('message', onMessage);
      });
      setWebsiteMakerBaseUrl(tunnelUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Website Maker tunnel');
    } finally {
      setStartingMakerTunnel(false);
    }
  }

  function applyClientNameSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setClientSearchQuery(normalizeClientSearchText(clientSearchInput));
  }

  function clearClientNameSearch() {
    setClientSearchInput('');
    setClientSearchQuery('');
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Sales clients</h2>
            <p className="text-sm text-gray-400 mt-1">
              {isSsuBracket
                ? 'SSU partner leads from MyPhoner. Meeting time/type and contract/payment only — no website Maker flow.'
                : 'Website leads: meetings, Google Calendar, Website Maker previews, and promote won clients to Clients.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium hover:bg-[#e55200]">
              <Plus size={16} />
              Add client
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setProductBracket('asoldi')}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              productBracket === 'asoldi'
                ? 'bg-[#FF5B00] border-[#FF5B00] text-white'
                : 'bg-black/20 border-white/10 text-gray-300 hover:bg-white/10'
            }`}
          >
            Websites ({productCounts.asoldi})
          </button>
          <button
            type="button"
            onClick={() => setProductBracket('ssu')}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              productBracket === 'ssu'
                ? 'bg-[#FF5B00] border-[#FF5B00] text-white'
                : 'bg-black/20 border-white/10 text-gray-300 hover:bg-white/10'
            }`}
          >
            SSU ({productCounts.ssu})
          </button>
        </div>

        <form onSubmit={applyClientNameSearch} className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <label className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Search clients by name or area</label>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={clientSearchInput}
                onChange={(e) => setClientSearchInput(e.target.value)}
                placeholder="Business, contact, or area (e.g. oslo area)"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/10 text-white text-sm"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#FF5B00] text-white text-sm hover:bg-[#e55200]"
            >
              <Search size={14} />
              Search
            </button>
            {clientSearchQuery && (
              <button
                type="button"
                onClick={clearClientNameSearch}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15"
              >
                <X size={14} />
                Clear
              </button>
            )}
          </div>
          {clientSearchQuery && (
            <p className="mt-2 text-[11px] text-gray-400">
              Showing matches for: <span className="text-white">{clientSearchQuery}</span>
            </p>
          )}
        </form>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Email coverage</div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <span className="px-2 py-1 rounded border border-white/10 bg-black/30 text-gray-300">Total: {emailAudit.total}</span>
            <span className="px-2 py-1 rounded border border-green-700/30 bg-green-900/20 text-green-300">Valid (non-test): {emailAudit.validNonTest}</span>
            <span className="px-2 py-1 rounded border border-amber-700/30 bg-amber-900/20 text-amber-300">Missing: {emailAudit.missing}</span>
            <span className="px-2 py-1 rounded border border-red-700/30 bg-red-900/20 text-red-300">Invalid: {emailAudit.invalid}</span>
            <span className="px-2 py-1 rounded border border-purple-700/30 bg-purple-900/20 text-purple-300">Test-like: {emailAudit.flaggedTest}</span>
          </div>
        </div>

        {!isSsuBracket && (
        <div className="mt-4 grid md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className="text-xs text-gray-500">Website Maker URL</label>
            <div className="mt-1 flex flex-col sm:flex-row gap-2">
              <input
                value={websiteMakerBaseUrl}
                onChange={(e) => setWebsiteMakerBaseUrl(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/10 text-white"
                placeholder={LAN_MAKER_URL}
              />
              <button
                type="button"
                onClick={() => setWebsiteMakerBaseUrl(LAN_MAKER_URL)}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15"
                title={`Fill ${LAN_MAKER_URL}`}
              >
                Use Docker Maker
              </button>
              <button
                type="button"
                onClick={() => setWebsiteMakerBaseUrl(LOCAL_MAKER_URL)}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15"
                title={`Fill ${LOCAL_MAKER_URL}`}
              >
                Use localhost
              </button>
              <button
                type="button"
                onClick={() => void startMakerTunnel()}
                disabled={startingMakerTunnel}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 disabled:opacity-50"
                title="Generate a public tunnel from the Maker in this field (localhost when you are not on the office LAN)"
              >
                <RefreshCw size={14} className={startingMakerTunnel ? 'animate-spin' : ''} />
                New tunnel URL
              </button>
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              At home: <code>{LAN_MAKER_URL}</code>. Away: start Maker on this computer, click Use localhost,
              then New tunnel URL, then Create run.
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <span className={`text-xs px-2 py-1 rounded ${calendarStatus?.connected ? 'bg-green-900/40 text-green-300' : 'bg-amber-900/40 text-amber-300'}`}>
              Google Calendar: {calendarStatus?.connected ? 'Connected' : calendarStatus?.configured ? 'Not connected' : 'Not configured'}
            </span>
            {calendarStatus?.configured && (
              <button type="button" onClick={connectGoogleCalendar} className="px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15">
                {calendarStatus.connected ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
              </button>
            )}
            <p className="text-[11px] text-gray-500 max-w-xs md:text-right">
              Connection covers admin and sales logins that share the same email. Meeting sync uses the client owner calendar when available, otherwise your connected calendar.
            </p>
          </div>
        </div>
        )}
        {isSsuBracket && (
          <div className="mt-4 flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
            <span className={`text-xs px-2 py-1 rounded ${calendarStatus?.connected ? 'bg-green-900/40 text-green-300' : 'bg-amber-900/40 text-amber-300'}`}>
              Google Calendar: {calendarStatus?.connected ? 'Connected' : calendarStatus?.configured ? 'Not connected' : 'Not configured'}
            </span>
            {calendarStatus?.configured && (
              <button type="button" onClick={connectGoogleCalendar} className="px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15">
                {calendarStatus.connected ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
              </button>
            )}
          </div>
        )}
      </div>

      {(error || notice) && (
        <div className="sticky top-2 z-20 space-y-2">
          {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 px-4 py-3 shadow-lg shadow-black/30">{error}</div>}
          {notice && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200 px-4 py-3 shadow-lg shadow-black/30">{notice}</div>}
        </div>
      )}

      <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Client map (OpenStreetMap)</h3>
            <p className="text-xs text-gray-400 mt-1">
              Shows every sales client with an address, including online meetings, in production and test.
            </p>
          </div>
          <span className="text-xs px-2 py-1 rounded bg-black/20 border border-white/10 text-gray-300">
            {visibleMeetingMapPins.length} pins
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-400">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#FF5B00]" /> In person</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#3b82f6]" /> Online</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#a855f7]" /> Secondary</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#6b7280]" /> Not sold</span>
        </div>
        {meetingMapError && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 px-3 py-2 text-xs">
            {meetingMapError}
          </div>
        )}
        <div className="mt-3 h-[340px] rounded-xl border border-white/10 overflow-hidden relative z-0 isolate">
          <div ref={meetingMapContainerRef} className="h-full w-full relative z-0" />
          {meetingMapLoading && (
            <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-gray-200 text-sm">
              <Loader2 size={16} className="animate-spin mr-2" />
              Loading map pins…
            </div>
          )}
        </div>
        {!meetingMapLoading && visibleMeetingMapPins.length === 0 && (
          <p className="mt-2 text-xs text-gray-500">No client addresses to show yet.</p>
        )}
        {meetingMapPendingCount > 0 && (
          <p className="mt-2 text-xs text-sky-300">
            {meetingMapPendingCount} address(es) still geocoding. Pins will appear automatically.
          </p>
        )}
        {meetingMapUnresolvedCount > 0 && (
          <p className="mt-2 text-xs text-amber-300">
            {meetingMapUnresolvedCount} address(es) could not be geocoded automatically.
          </p>
        )}
        {meetingMapMissingAddressCount > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            {meetingMapMissingAddressCount} client(s) have no address yet, so they are not on the map.
          </p>
        )}
      </div>

      {loading ? (
        <div className="min-h-[180px] flex items-center justify-center text-gray-400">
          <Loader2 className="animate-spin mr-2" size={18} /> Loading sales clients…
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-gray-400">
            Sorted by meeting date: closest upcoming first. Past meetings are grouped under <span className="text-red-300">Past due</span>. Secondary leads stay in the same timeline and are tagged.
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
            {orderedTimelineClients.map((client) => {
            const clientIsSsu = isSsuClient(client);
            const step0Done = Boolean(client.agreedTime && client.meetingAt);
            const timeline: { key: ProgressionKey; done: boolean }[] = [
              { key: 'step0AgreeMeetingTime', done: step0Done },
              { key: 'contractSigned', done: Boolean(client.progression?.contractSigned) },
              { key: 'paymentReceived', done: Boolean(client.progression?.paymentReceived) },
              ...(!clientIsSsu
                ? ([
                    { key: 'domainConnected', done: Boolean(client.progression?.domainConnected) },
                    { key: 'live', done: Boolean(client.progression?.live) },
                  ] as { key: ProgressionKey; done: boolean }[])
                : []),
            ];
            const importedPreviewUrl = client.websiteImport?.previewUrl || getSalesPreviewFallback(client.id);
            const clientOffers = offers.filter((entry) => entry.salesClientId === client.id);
            const makerRunId = String(client.makerRun?.runId || '').trim();
            const hasRun = Boolean(makerRunId);
            const storedDashboardUrl = normalizeMakerDashboardDraftUrl(String(client.makerRun?.dashboardUrl || '').trim());
            const storedPreviewUrl = String(client.makerRun?.previewUrl || '').trim();
            const makerDashboardUrl = resolveOpenInMakerUrl({
              baseUrl: websiteMakerBaseUrl,
              runId: makerRunId,
              storedDashboardUrl,
              intakeStatus: String(client.makerRun?.intakeStatus || ''),
              latestReadyStep: String(client.makerRun?.latestReadyStep || ''),
            });
            const makerPreviewUrl =
              remapMakerUrlToBase(healStaleLocalMakerBase(websiteMakerBaseUrl) || websiteMakerBaseUrl, storedPreviewUrl) ||
              buildMakerRunUrl(
                websiteMakerBaseUrl,
                makerRunId,
                'preview',
                String(client.makerRun?.latestReadyStep || '3'),
              );
            const expanded = expandedId === client.id;
            const meetingTimestamp = client.agreedTime ? parseMeetingTimestamp(client.meetingAt) : null;
            const isPastDueMeeting = meetingTimestamp !== null && meetingTimestamp < meetingNowMs;
            const showNoMeetingDateHeading = Boolean(firstNoMeetingDateClientId) && client.id === firstNoMeetingDateClientId;
            const showPastDueHeading = Boolean(firstPastDueClientId) && client.id === firstPastDueClientId;
            const contactAndAddress = [client.contactPerson, client.meetingPlace].filter(Boolean).join(' · ');
            return (
              <React.Fragment key={client.id}>
                {showNoMeetingDateHeading && (
                  <div className="lg:col-span-2 2xl:col-span-3 rounded-xl border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-sm text-amber-200">
                    No agreed meeting date
                  </div>
                )}
                {showPastDueHeading && (
                  <div className="lg:col-span-2 2xl:col-span-3 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
                    Past due
                  </div>
                )}
                <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-semibold truncate">{client.businessName || 'Unnamed business'}</h3>
                      <span className="shrink-0 px-2 py-0.5 rounded text-[11px] bg-black/20 border border-white/10 text-gray-300">
                        {client.meetingMode === 'in-person' ? 'In person' : 'Online'}
                      </span>
                      {clientIsSsu && (
                        <span className="shrink-0 px-2 py-0.5 rounded text-[11px] bg-sky-900/30 border border-sky-700/30 text-sky-300">
                          SSU
                        </span>
                      )}
                      {client.status === 'secondary' && (
                        <span className="shrink-0 px-2 py-0.5 rounded text-[11px] bg-amber-900/30 border border-amber-700/30 text-amber-300">
                          Secondary
                        </span>
                      )}
                      {isPastDueMeeting && (
                        <span className="shrink-0 px-2 py-0.5 rounded text-[11px] bg-red-900/30 border border-red-700/30 text-red-300">
                          Past due
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400 min-w-0">
                      <CalendarClock size={12} className="shrink-0" />
                      <span className="truncate">{client.agreedTime ? formatWhen(client.meetingAt) : 'Step 0 pending'}</span>
                    </div>
                    {contactAndAddress && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400 min-w-0">
                        <UserRound size={12} className="shrink-0" />
                        <span className="truncate">{contactAndAddress}</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(client)}
                    title="Edit client"
                    aria-label="Edit client"
                    className="shrink-0 p-2 rounded-lg bg-white/10 text-white hover:bg-white/15"
                  >
                    <Pencil size={14} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {timeline.map((step) => {
                    const stepDone = step.key === 'step0AgreeMeetingTime'
                      ? Boolean(client.agreedTime && client.meetingAt)
                      : step.done;
                    return (
                    <button
                      key={step.key}
                      type="button"
                      disabled={progressBusyKey === `${client.id}:${step.key}`}
                      onClick={() => void toggleProgress(client, step.key)}
                      title={step.key === 'step0AgreeMeetingTime' ? 'Set agreed meeting date/time in Edit client' : undefined}
                      className={`px-2 py-1 rounded-md text-[11px] border transition-colors hover:border-[#FF5B00]/40 disabled:opacity-60 ${
                        stepDone
                          ? 'bg-green-900/40 border-green-600/40 text-green-300'
                          : 'bg-black/20 border-white/10 text-gray-400'
                      }`}
                    >
                      {stepDone ? <CheckCircle2 size={11} className="inline mr-1" /> : null}
                      {formatStepLabel(step.key)}
                    </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2">
                  {!clientIsSsu && (
                    hasRun ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void openInMaker(client)}
                        disabled={!makerDashboardUrl || openingMakerId === client.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15 disabled:opacity-50"
                      >
                        {openingMakerId === client.id ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
                        Open in maker
                      </button>
                      <button
                        type="button"
                        onClick={() => window.open(makerPreviewUrl, '_blank')}
                        disabled={!makerPreviewUrl}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15 disabled:opacity-50"
                      >
                        <ExternalLink size={13} />
                        Maker preview
                      </button>
                      <button
                        type="button"
                        onClick={() => void createMakerRun(client, { forceNewRun: true })}
                        disabled={creatingRunId === client.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF5B00] text-white text-xs hover:bg-[#e55200] disabled:opacity-50"
                        title="Create a fresh draft run from current Sales data"
                      >
                        {creatingRunId === client.id ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                        Create new run
                      </button>
                      {IS_LAN_SALES_HOST ? (
                      <button
                        type="button"
                        onClick={() => void publishMakerRunToProd(client)}
                        disabled={publishingMakerId === client.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs hover:bg-emerald-600 disabled:opacity-50"
                        title="Copy only this website run onto asoldi.com/sales. Does not change production CRM fields."
                      >
                        {publishingMakerId === client.id ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        Publish website to asoldi.com
                      </button>
                      ) : null}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void createMakerRun(client)}
                      disabled={creatingRunId === client.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF5B00] text-white text-xs hover:bg-[#e55200] disabled:opacity-50"
                    >
                      {creatingRunId === client.id ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                      Create website run
                    </button>
                  )
                  )}
                  <button
                    type="button"
                    onClick={() => void sendWelcomeEmail(client)}
                    disabled={sendingWelcomeId === client.id || !client.contactEmail || !client.agreedTime || !client.meetingAt}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15 disabled:opacity-50"
                    title={!client.agreedTime || !client.meetingAt ? 'Set agreed meeting time first' : 'Send welcome email manually'}
                  >
                    {sendingWelcomeId === client.id ? <Loader2 size={13} className="animate-spin" /> : <MailPlus size={13} />}
                    Send welcome email
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendReminderEmail(client)}
                    disabled={sendingReminderId === client.id || !client.contactEmail || !client.agreedTime || !client.meetingAt}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15 disabled:opacity-50"
                    title={!client.agreedTime || !client.meetingAt ? 'Set agreed meeting time first' : 'Send reminder email manually'}
                  >
                    {sendingReminderId === client.id ? <Loader2 size={13} className="animate-spin" /> : <BellRing size={13} />}
                    Send reminder
                  </button>
                  {emailActionFeedback?.clientId === client.id && (
                    <p
                      className={`w-full text-xs mt-1 ${
                        emailActionFeedback.tone === 'ok' ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
                      {emailActionFeedback.text}
                    </p>
                  )}
                  {client.meetingMode === 'online' && client.calendar?.meetLink && (
                    <button
                      type="button"
                      onClick={() => window.open(client.calendar.meetLink, '_blank')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15"
                    >
                      <ExternalLink size={13} />
                      Meet link
                    </button>
                  )}
                  {client.myphoner?.latestRecordingUrl && (
                    <button
                      type="button"
                      onClick={() => void toggleInlineRecording(client)}
                      disabled={recordingLoadingClientId === client.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15 disabled:opacity-50"
                      title="Load and play latest synced call recording inline"
                    >
                      {recordingLoadingClientId === client.id ? <Loader2 size={13} className="animate-spin" /> : <Volume2 size={13} />}
                      {recordingOpenClientId === client.id ? 'Hide audio' : 'Listen here'}
                    </button>
                  )}
                  {!clientIsSsu && clientOffers.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#FF5B00]/15 text-[#ff8a4d] text-[11px]">
                      <Tag size={12} />
                      {clientOffers.length} tilbud
                    </span>
                  )}
                </div>

                {recordingOpenClientId === client.id && (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                    {recordingBlobUrlByClient[client.id] ? (
                      <>
                        <audio controls preload="metadata" src={recordingBlobUrlByClient[client.id]} className="w-full" />
                        <button
                          type="button"
                          onClick={() => window.open(client.myphoner?.latestRecordingUrl || '', '_blank')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15"
                        >
                          <ExternalLink size={12} />
                          Open source URL
                        </button>
                      </>
                    ) : (
                      <div className="text-xs text-amber-300">
                        {recordingErrorByClient[client.id] || 'Could not load audio in-app for this recording.'}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                  <button
                    type="button"
                    onClick={() => setExpandedId((prev) => (prev === client.id ? null : client.id))}
                    className="text-xs text-[#FF5B00] hover:underline"
                  >
                    {expanded ? 'Hide details' : 'Details & tools'}
                  </button>
                  <div className="flex items-center gap-2">
                    {!clientIsSsu && (
                      <button
                        type="button"
                        onClick={() => promoteClient(client)}
                        disabled={promotingId === client.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF5B00] text-white text-xs hover:bg-[#e55200] disabled:opacity-50"
                      >
                        {promotingId === client.id ? <Loader2 size={13} className="animate-spin" /> : null}
                        Got the client
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void markNotSold(client)}
                      disabled={statusBusyId === `not-sold:${client.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-gray-200 text-xs hover:bg-white/15 disabled:opacity-50"
                    >
                      {statusBusyId === `not-sold:${client.id}` ? <Loader2 size={13} className="animate-spin" /> : <ArchiveX size={13} />}
                      Not sold
                    </button>
                    {client.status === 'secondary' ? (
                      <button
                        type="button"
                        onClick={() => void restoreArchivedClient(client)}
                        disabled={statusBusyId === `restore:${client.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-gray-200 text-xs hover:bg-white/15 disabled:opacity-50"
                      >
                        {statusBusyId === `restore:${client.id}` ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
                        Restore active
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void markSecondary(client)}
                        disabled={statusBusyId === `secondary:${client.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-gray-200 text-xs hover:bg-white/15 disabled:opacity-50"
                      >
                        {statusBusyId === `secondary:${client.id}` ? <Loader2 size={13} className="animate-spin" /> : <ArchiveX size={13} />}
                        {clientIsSsu ? 'Secondary' : 'Ikke interresert i nettside'}
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="space-y-4 border-t border-white/10 pt-3">
                    <div className="grid sm:grid-cols-2 gap-4 rounded-xl bg-black/20 border border-white/10 p-4">
                      <details open className="text-sm text-gray-200">
                        <summary className="cursor-pointer text-white font-medium mb-2">Contact & meeting</summary>
                        <ul className="space-y-1 text-gray-300">
                          <li>Email: {client.contactEmail || '—'}</li>
                          <li>Phone: {client.contactPhone || '—'}</li>
                          <li>Meeting: {client.meetingMode === 'in-person' ? 'In person' : 'Online (Google Meet)'}</li>
                          <li>Address: {client.meetingPlace || '—'}</li>
                          <li>Industry: {client.industry || '—'}</li>
                          <li>Duration: {durationForMode(client.meetingMode)} min</li>
                          <li>Agreed time: {client.agreedTime ? 'Yes' : 'No'}</li>
                        </ul>
                      </details>
                      <details open className="text-sm text-gray-200">
                        <summary className="cursor-pointer text-white font-medium mb-2">
                          {clientIsSsu ? 'Calendar & reminders' : 'Website, calendar & reminders'}
                        </summary>
                        <ul className="space-y-1 text-gray-300">
                          {!clientIsSsu && <li>Website domain: {client.websiteDomain || '—'}</li>}
                          {!clientIsSsu && <li>Maker run: {client.makerRun?.runId || '—'}</li>}
                          {!clientIsSsu && <li>Maker latest ready step: {client.makerRun?.latestReadyStep || '—'}</li>}
                          {!clientIsSsu && <li>Maker step status: {client.makerRun?.latestStepStatus || '—'}</li>}
                          {!clientIsSsu && <li>Maker export path: {client.makerRun?.exportPath || '—'}</li>}
                          {!clientIsSsu && <li>Import source run: {client.websiteImport?.sourceRunId || '—'}</li>}
                          {!clientIsSsu && <li>Import step: {client.websiteImport?.sourceStep || '—'}</li>}
                          <li>Calendar event: {client.calendar?.eventId || '—'}</li>
                          <li>Calendar account: {client.calendar?.accountKey || '—'}</li>
                          <li>Meet link: {client.calendar?.meetLink || '—'}</li>
                          <li>Thank-you sent: {client.reminders?.thankYouSentAt ? formatWhen(client.reminders.thankYouSentAt) : 'No'}</li>
                          <li>24h reminder: {client.reminders?.reminder24hSentAt ? formatWhen(client.reminders.reminder24hSentAt) : 'Pending/Skipped'}</li>
                          <li>1h reminder: {client.reminders?.reminder1hSentAt ? formatWhen(client.reminders.reminder1hSentAt) : 'Pending/Skipped'}</li>
                        </ul>
                      </details>
                      <details open className="sm:col-span-2 text-sm text-gray-200">
                        <summary className="cursor-pointer text-white font-medium mb-2">Myphoner intake</summary>
                        <ul className="space-y-1 text-gray-300">
                          <li>Lead ID: {client.myphoner?.leadId || '—'}</li>
                          <li>List: {client.myphoner?.listName || client.myphoner?.listId || '—'}</li>
                          <li>Winner category: {client.myphoner?.winnerCategory || '—'}</li>
                          <li>Last winner sync: {client.myphoner?.lastWinnerWebhookAt ? formatWhen(client.myphoner.lastWinnerWebhookAt) : '—'}</li>
                          <li>Last recording sync: {client.myphoner?.lastRecordingWebhookAt ? formatWhen(client.myphoner.lastRecordingWebhookAt) : '—'}</li>
                          <li>Recording sync status: {client.myphoner?.latestRecordingSyncReason || '—'}</li>
                          <li>Call ID: {client.myphoner?.latestCallId || '—'}</li>
                          <li>Call started: {client.myphoner?.latestCallStartedAt ? formatWhen(client.myphoner.latestCallStartedAt) : '—'}</li>
                        </ul>
                        {client.myphoner?.latestRecordingUrl ? (
                          <div className="mt-3 space-y-2">
                            <button
                              type="button"
                              onClick={() => void toggleInlineRecording(client)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15"
                            >
                              {recordingLoadingClientId === client.id ? <Loader2 size={13} className="animate-spin" /> : <Volume2 size={13} />}
                              {recordingOpenClientId === client.id ? 'Hide inline audio' : 'Listen in Sales UI'}
                            </button>
                            {recordingOpenClientId === client.id ? (
                              recordingBlobUrlByClient[client.id] ? (
                                <audio controls preload="metadata" src={recordingBlobUrlByClient[client.id]} className="w-full" />
                              ) : (
                                <p className="text-xs text-amber-300">
                                  {recordingErrorByClient[client.id] || 'Could not load inline audio. Open source URL instead.'}
                                </p>
                              )
                            ) : null}
                            <button
                              type="button"
                              onClick={() => window.open(client.myphoner.latestRecordingUrl, '_blank')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15"
                            >
                              <ExternalLink size={12} />
                              Open source URL
                            </button>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-gray-500">
                            No call recording synced yet for this lead.
                            {client.myphoner?.latestRecordingSyncReason ? ` Last sync status: ${client.myphoner.latestRecordingSyncReason}.` : ''}
                          </p>
                        )}
                      </details>
                      <details open className="sm:col-span-2 text-sm text-gray-200">
                        <summary className="cursor-pointer text-white font-medium mb-2">QuickFill links</summary>
                        <div className="grid sm:grid-cols-2 gap-3 text-gray-300">
                          <div>
                            <div className="text-xs text-gray-500 uppercase mb-1">Instagram</div>
                            <p>{String(client.details?.instagramUrl || '—')}</p>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 uppercase mb-1">Facebook</div>
                            <p>{String(client.details?.facebookUrl || '—')}</p>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 uppercase mb-1">proff.no</div>
                            <p>{String(client.details?.proffUrl || '—')}</p>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 uppercase mb-1">Google business profile</div>
                            <p>{String(client.details?.googleBusinessProfile || '—')}</p>
                          </div>
                          <div className="sm:col-span-2">
                            <div className="text-xs text-gray-500 uppercase mb-1">Other links</div>
                            <p style={{ whiteSpace: 'pre-wrap' }}>{String(client.details?.otherLinks || '—')}</p>
                          </div>
                        </div>
                      </details>
                    </div>

                    {!clientIsSsu && (
                    <>
                    <div className="rounded-xl bg-black/20 border border-white/10 p-4 space-y-3">
                      <div className="text-sm text-white font-medium">Sync website preview from Maker</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={runIdByClient[client.id] || ''}
                          onChange={(e) => setRunIdByClient((prev) => ({ ...prev, [client.id]: e.target.value }))}
                          placeholder={client.makerRun?.runId ? `Linked run: ${client.makerRun.runId}` : 'Existing run ID (optional)'}
                          className="px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/10 text-white text-sm min-w-[220px] flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => void linkMakerRun(client)}
                          disabled={linkingRunId === client.id}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 disabled:opacity-50"
                        >
                          {linkingRunId === client.id ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                          Link run
                        </button>
                        <button
                          type="button"
                          onClick={() => void syncWebsiteFromMaker(client)}
                          disabled={syncingId === client.id}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 disabled:opacity-50"
                        >
                          {syncingId === client.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          Sync latest from Maker
                        </button>
                        <button
                          type="button"
                          onClick={() => window.open(importedPreviewUrl, '_blank')}
                          disabled={!client.websiteImport?.previewUrl}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 disabled:opacity-50"
                        >
                          <ExternalLink size={14} />
                          Preview website
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Sync is the preferred flow. ZIP export is only for manual hosting uploads when needed.
                      </p>
                    </div>

                    <div className="rounded-xl bg-black/20 border border-white/10 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm text-white font-medium">
                          <Tag size={14} className="text-[#FF5B00]" />
                          Tilbud (nettsidekode)
                        </div>
                        <button
                          type="button"
                          onClick={() => openOfferPanel(client)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FF5B00] text-white text-xs hover:bg-[#e55200]"
                        >
                          <Gift size={13} />
                          {offerOpenId === client.id ? 'Lukk' : 'Gi tilbud'}
                        </button>
                      </div>

                      {clientOffers.length > 0 && (
                        <div className="space-y-2">
                          {clientOffers.map((offer) => (
                            <div
                              key={offer.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#1a1a1a] border border-white/10 px-3 py-2"
                            >
                              <div className="flex items-center gap-3 text-sm">
                                <span className="px-2 py-1 rounded bg-[#FF5B00]/20 text-[#ff8a4d] font-mono tracking-widest text-base">{offer.code}</span>
                                <span className="text-gray-200">{offer.planName}</span>
                                <span className="text-gray-500">{offer.price}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-400">{offer.targetEmail || 'Ikke tildelt'}</span>
                                <span className={`px-2 py-0.5 rounded ${offer.claimed ? 'bg-green-900/40 text-green-300' : 'bg-amber-900/30 text-amber-300'}`}>
                                  {offer.claimed ? 'Innløst' : 'Aktiv'}
                                </span>
                                {offer.previewUrl && (
                                  <button
                                    type="button"
                                    onClick={() => window.open(offer.previewUrl, '_blank')}
                                    className="inline-flex items-center gap-1 text-gray-300 hover:text-white"
                                  >
                                    <ExternalLink size={12} />
                                    Forhåndsvis
                                  </button>
                                )}
                                <button type="button" onClick={() => void deleteOffer(offer.id)} className="text-gray-400 hover:text-red-400" aria-label="Slett tilbud">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {offerOpenId === client.id && (
                        <div className="rounded-lg bg-[#1a1a1a] border border-white/10 p-4 space-y-4">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Velg tier (anbefalt plan)</label>
                            <div className="grid sm:grid-cols-3 gap-2">
                              {OFFER_TIERS.map((tier) => (
                                <button
                                  key={tier.id}
                                  type="button"
                                  onClick={() => setOfferPlanId(tier.id)}
                                  className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                                    offerPlanId === tier.id ? 'border-[#FF5B00] bg-[#FF5B00]/10' : 'border-white/10 bg-black/20 hover:border-white/20'
                                  }`}
                                >
                                  <div className="text-sm text-white">{tier.name}</div>
                                  <div className="text-xs text-gray-400">{tier.price}</div>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Søk etter bruker (e-post, navn eller bedrift)</label>
                            {offerSelectedUser ? (
                              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                                <div className="text-sm">
                                  <div className="text-white">{offerSelectedUser.name || offerSelectedUser.email}</div>
                                  <div className="text-xs text-gray-400">
                                    {offerSelectedUser.email}
                                    {offerSelectedUser.businessName ? ` · ${offerSelectedUser.businessName}` : ''}
                                  </div>
                                </div>
                                <button type="button" onClick={() => setOfferSelectedUser(null)} className="text-gray-400 hover:text-white" aria-label="Fjern valgt bruker">
                                  <X size={15} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="relative">
                                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                  <input
                                    value={offerSearch}
                                    onChange={(e) => setOfferSearch(e.target.value)}
                                    placeholder="Søk på e-post, navn eller bedrift…"
                                    className="w-full pl-9 pr-9 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm"
                                  />
                                  {offerSearching && (
                                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                                  )}
                                </div>
                                {offerResults.length > 0 ? (
                                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
                                    {offerResults.map((result) => (
                                      <button
                                        key={result.userId}
                                        type="button"
                                        onClick={() => {
                                          setOfferSelectedUser(result);
                                          setOfferResults([]);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-white/5"
                                      >
                                        <div className="text-sm text-white">{result.name || result.email}</div>
                                        <div className="text-xs text-gray-400">
                                          {result.email}
                                          {result.businessName ? ` · ${result.businessName}` : ''}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                ) : !offerSearching ? (
                                  <p className="mt-2 text-xs text-gray-500">
                                    {offerSearch.trim()
                                      ? 'Ingen klientbrukere matcher søket.'
                                      : 'Ingen klientbrukere funnet ennå.'}
                                  </p>
                                ) : null}
                                <p className="mt-1 text-[11px] text-gray-500">
                                  Kun brukere med klient-innlogging vises her. Velg en bruker for å sende tilbudet rett i to-do-listen deres. Uten valgt bruker kan kunden løse inn tilbudet med nettsidekoden.
                                </p>
                              </>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Notat (valgfritt)</label>
                            <textarea
                              rows={2}
                              value={offerNote}
                              onChange={(e) => setOfferNote(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm resize-y"
                            />
                          </div>

                          {client.websiteImport?.previewUrl ? (
                            <p className="text-[11px] text-gray-400">Forhåndsvisning av importert nettside legges automatisk ved tilbudet.</p>
                          ) : (
                            <p className="text-[11px] text-gray-500">Tips: synkroniser nettstedet fra Maker over for å gi kunden forhåndsvisning i tilbudet.</p>
                          )}

                          {lastCreatedCode && (
                            <div className="rounded-lg border border-green-600/40 bg-green-900/20 px-3 py-2 text-sm text-green-200">
                              Tilbud opprettet. Nettsidekode:{' '}
                              <span className="font-mono tracking-widest text-base text-white">{lastCreatedCode}</span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => void createOffer(client)}
                            disabled={creatingOffer}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF5B00] text-white text-sm hover:bg-[#e55200] disabled:opacity-50"
                          >
                            {creatingOffer ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />}
                            Opprett tilbud
                          </button>
                        </div>
                      )}
                    </div>
                    </>
                    )}
                  </div>
                )}
                </div>
              </React.Fragment>
            );
          })}

          {timelineClients.length === 0 && (
            <div className="lg:col-span-2 2xl:col-span-3 rounded-2xl bg-[#2a2a2a] border border-white/10 p-8 text-center text-gray-400">
              {clientSearchQuery
                ? (
                  <>
                    No clients matched <strong className="text-white">"{clientSearchQuery}"</strong>.
                  </>
                )
                : (
                  <>
                    No {isSsuBracket ? 'SSU' : 'website'} sales clients in active/secondary timeline right now. Click <strong className="text-white">Add client</strong> to start.
                  </>
                )}
            </div>
          )}
        </div>
        </div>
      )}

      {archivedClients.length > 0 && (
        <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-white font-semibold">Archived (Not sold)</h3>
            <span className="text-xs px-2 py-1 rounded bg-black/20 border border-white/10 text-gray-300">
              {archivedClients.length} archived
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
            {archivedClients.map((client) => (
              <div key={client.id} className="rounded-xl bg-black/20 border border-white/10 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{client.businessName || 'Unnamed business'}</div>
                    <div className="text-xs text-gray-400 truncate">
                      {[client.contactPerson || 'No contact person', client.meetingPlace || 'No address']
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-700/30">
                    Not sold
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  Archived: {formatDateTime(client.archive?.archivedAt || client.updatedAt)}
                </div>
                {client.archive?.reason ? (
                  <div className="text-xs text-gray-300">
                    Reason: {client.archive.reason}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">No reason added.</div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void restoreArchivedClient(client)}
                    disabled={statusBusyId === `restore:${client.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15 disabled:opacity-50"
                  >
                    {statusBusyId === `restore:${client.id}` ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
                    Restore to active
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteArchivedClient(client)}
                    disabled={deletingArchivedId === client.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/30 text-red-200 text-xs hover:bg-red-900/40 disabled:opacity-50"
                  >
                    {deletingArchivedId === client.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Delete permanently
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-[#1f1f1f] border border-white/10 p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-white mb-4">{editingId ? 'Edit sales client' : 'Add sales client'}</h3>
            <form onSubmit={saveForm} className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Product</label>
                <select
                  value={form.product}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      product: e.target.value === 'ssu' ? 'ssu' : 'asoldi',
                      websiteDomain: e.target.value === 'ssu' ? '' : prev.websiteDomain,
                    }))
                  }
                  className="w-full px-4 py-3 rounded-lg bg-[#161616] border border-white/10 text-white"
                >
                  <option value="asoldi">Websites (Asoldi)</option>
                  <option value="ssu">SSU</option>
                </select>
              </div>
              <Field label="Business name" value={form.businessName} onChange={(value) => setForm((prev) => ({ ...prev, businessName: value }))} required />
              <Field label="Contact person" value={form.contactPerson} onChange={(value) => setForm((prev) => ({ ...prev, contactPerson: value }))} required />
              <Field label="Email (optional)" type="email" value={form.contactEmail} onChange={(value) => setForm((prev) => ({ ...prev, contactEmail: value }))} />
              <Field label="Phone number" value={form.contactPhone} onChange={(value) => setForm((prev) => ({ ...prev, contactPhone: value }))} />
              <Field label="Industry" value={form.industry} onChange={(value) => setForm((prev) => ({ ...prev, industry: value }))} />
              {form.product !== 'ssu' && (
                <Field label="Website domain (optional)" value={form.websiteDomain} onChange={(value) => setForm((prev) => ({ ...prev, websiteDomain: value }))} />
              )}
              <Field label="Instagram URL" value={form.instagramUrl} onChange={(value) => setForm((prev) => ({ ...prev, instagramUrl: value }))} />
              <Field label="Facebook URL" value={form.facebookUrl} onChange={(value) => setForm((prev) => ({ ...prev, facebookUrl: value }))} />
              <Field label="proff.no URL" value={form.proffUrl} onChange={(value) => setForm((prev) => ({ ...prev, proffUrl: value }))} />
              <Field
                label="Google business profile URL"
                value={form.googleBusinessProfile}
                onChange={(value) => setForm((prev) => ({ ...prev, googleBusinessProfile: value }))}
              />

              <div>
                <label className="block text-sm text-gray-300 mb-1">Meeting mode</label>
                <select
                  value={form.meetingMode}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      meetingMode: e.target.value as 'online' | 'in-person',
                    }))
                  }
                  className="w-full px-4 py-3 rounded-lg bg-[#161616] border border-white/10 text-white"
                >
                  <option value="online">Online (30 min)</option>
                  <option value="in-person">In person (60 min)</option>
                </select>
              </div>

              <Field
                label={form.meetingMode === 'in-person' ? 'Place to meet' : 'Business address (shown on map)'}
                value={form.meetingPlace}
                onChange={(value) => setForm((prev) => ({ ...prev, meetingPlace: value }))}
              />

              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#161616] px-4 py-3">
                <span className="text-sm text-gray-300">Agreed time</span>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, agreedTime: !prev.agreedTime, meetingAt: prev.agreedTime ? '' : prev.meetingAt }))}
                  className={`px-3 py-1 rounded text-xs ${form.agreedTime ? 'bg-[#FF5B00] text-white' : 'bg-white/10 text-gray-300'}`}
                >
                  {form.agreedTime ? 'On' : 'Off'}
                </button>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Agreed date & time</label>
                <input
                  type="datetime-local"
                  value={form.meetingAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, meetingAt: e.target.value }))}
                  disabled={!form.agreedTime}
                  className="w-full px-4 py-3 rounded-lg bg-[#161616] border border-white/10 text-white disabled:opacity-50"
                />
              </div>

              <div className="flex items-center text-sm text-gray-400">Meeting duration: <strong className="text-white ml-1">{formDuration} min</strong></div>

              <TextArea label="Other links (one per line)" value={form.otherLinks} onChange={(value) => setForm((prev) => ({ ...prev, otherLinks: value }))} />

              <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-white/10 text-white">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white disabled:opacity-50">
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create sales client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getSalesPreviewFallback(clientId: string) {
  return `/sales-preview/${encodeURIComponent(clientId)}/`;
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-300 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-lg bg-[#161616] border border-white/10 text-white"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="md:col-span-2">
      <label className="block text-sm text-gray-300 mb-1">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-lg bg-[#161616] border border-white/10 text-white resize-y"
      />
    </div>
  );
}
