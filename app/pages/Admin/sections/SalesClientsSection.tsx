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
  UserRound,
  Wand2,
  X,
} from 'lucide-react';
import { API, salesAuthHeaders, type SalesClient } from '../shared';
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
const SALES_MAP_DEFAULT_CENTER: [number, number] = [63.4305, 10.3951];
const SALES_MAP_DEFAULT_ZOOM = 5;

type CalendarStatus = {
  configured: boolean;
  connected: boolean;
  calendarId: string;
  redirectUri: string;
  tokenUpdatedAt: string;
};

type MeetingMapPin = {
  clientId: string;
  businessName: string;
  contactPerson: string;
  meetingPlace: string;
  meetingAt: string;
  latitude: number;
  longitude: number;
};

type Props = {
  onPromotedToClient?: () => void;
};

type SalesFormState = {
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

function parseMeetingTimestamp(value = '') {
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return null;
  return time;
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
    const cleanPath = String(parsed.pathname || '').replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host}${cleanPath}`;
  } catch {
    return '';
  }
}

function buildMakerRunUrl(baseUrl = '', runId = '', mode: 'dashboard' | 'preview' = 'dashboard') {
  const base = normalizeHttpBaseUrl(baseUrl);
  const id = String(runId || '').trim();
  if (!base || !id) return '';
  if (mode === 'preview') return `${base}/preview/${encodeURIComponent(id)}/step/3/view?route=/`;
  return `${base}/run/${encodeURIComponent(id)}`;
}

function toOrigin(baseUrl = '') {
  const normalized = normalizeHttpBaseUrl(baseUrl);
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
}

export function SalesClientsSection({ onPromotedToClient }: Props) {
  const [clients, setClients] = useState<SalesClient[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
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
  const [startingMakerTunnel, setStartingMakerTunnel] = useState(false);
  const [progressBusyKey, setProgressBusyKey] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [websiteMakerBaseUrl, setWebsiteMakerBaseUrl] = useState('http://localhost:3000');
  const [runIdByClient, setRunIdByClient] = useState<Record<string, string>>({});
  const [meetingNowMs, setMeetingNowMs] = useState(() => Date.now());
  const [meetingMapPins, setMeetingMapPins] = useState<MeetingMapPin[]>([]);
  const [meetingMapLoading, setMeetingMapLoading] = useState(false);
  const [meetingMapError, setMeetingMapError] = useState('');
  const [meetingMapUnresolvedCount, setMeetingMapUnresolvedCount] = useState(0);
  const meetingMapContainerRef = useRef<HTMLDivElement | null>(null);
  const meetingMapRef = useRef<any>(null);
  const meetingMapMarkerLayerRef = useRef<any>(null);

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
  const activeClients = useMemo(
    () => clients.filter((client) => client.status === 'active'),
    [clients]
  );
  const archivedClients = useMemo(
    () => clients.filter((client) => client.status === 'not-sold'),
    [clients]
  );
  const secondaryClients = useMemo(
    () => clients.filter((client) => client.status === 'secondary'),
    [clients]
  );
  const activeMeetingGroups = useMemo(() => {
    const upcoming: SalesClient[] = [];
    const pastDue: SalesClient[] = [];
    const noMeetingDate: SalesClient[] = [];

    for (const client of activeClients) {
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
  }, [activeClients, meetingNowMs]);
  const orderedActiveClients = useMemo(
    () => [...activeMeetingGroups.upcoming, ...activeMeetingGroups.noMeetingDate, ...activeMeetingGroups.pastDue],
    [activeMeetingGroups]
  );
  const firstNoMeetingDateClientId = activeMeetingGroups.noMeetingDate[0]?.id || '';
  const firstPastDueClientId = activeMeetingGroups.pastDue[0]?.id || '';

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
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || 'Request failed');
    return data;
  }

  async function loadMeetingMap() {
    setMeetingMapLoading(true);
    setMeetingMapError('');
    try {
      const data = await request('/admin/sales/meeting-map');
      const pins = Array.isArray(data.pins) ? data.pins : [];
      setMeetingMapPins(pins as MeetingMapPin[]);
      setMeetingMapUnresolvedCount(Number.isFinite(Number(data.unresolvedCount)) ? Number(data.unresolvedCount) : 0);
    } catch (err) {
      setMeetingMapError(err instanceof Error ? err.message : 'Failed loading in-person visit map');
      setMeetingMapPins([]);
      setMeetingMapUnresolvedCount(0);
    } finally {
      setMeetingMapLoading(false);
    }
  }

  async function loadSales() {
    setLoading(true);
    setError('');
    try {
      const data = await request('/admin/sales');
      setClients(Array.isArray(data.clients) ? data.clients : []);
      setCalendarStatus((data.calendar || null) as CalendarStatus | null);
      void loadMeetingMap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales clients');
    } finally {
      setLoading(false);
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

  useEffect(() => {
    let cancelled = false;
    async function syncMeetingMap() {
      if (!meetingMapContainerRef.current) return;
      const L = await import('leaflet');
      if (cancelled || !meetingMapContainerRef.current) return;

      if (!meetingMapRef.current) {
        const map = L.map(meetingMapContainerRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);
        map.setView(SALES_MAP_DEFAULT_CENTER, SALES_MAP_DEFAULT_ZOOM);
        meetingMapRef.current = map;
        meetingMapMarkerLayerRef.current = L.layerGroup().addTo(map);
      }

      const map = meetingMapRef.current;
      if (!map) return;
      const markerLayer = meetingMapMarkerLayerRef.current || L.layerGroup().addTo(map);
      markerLayer.clearLayers();

      if (!meetingMapPins.length) {
        map.setView(SALES_MAP_DEFAULT_CENTER, SALES_MAP_DEFAULT_ZOOM);
        return;
      }

      const bounds = L.latLngBounds([]);
      for (const pin of meetingMapPins) {
        const lat = Number(pin.latitude);
        const lng = Number(pin.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const marker = L.circleMarker([lat, lng], {
          radius: 8,
          color: '#ff7a2f',
          weight: 2,
          fillColor: '#FF5B00',
          fillOpacity: 0.85,
        });
        const popupHtml = [
          `<div style="min-width:180px;line-height:1.35;font-size:12px;">`,
          `<div style="font-weight:600;margin-bottom:4px;">${escapeHtml(pin.businessName || 'Client')}</div>`,
          pin.contactPerson ? `<div style="margin-bottom:2px;">${escapeHtml(pin.contactPerson)}</div>` : '',
          `<div style="margin-bottom:2px;">${escapeHtml(pin.meetingPlace || '')}</div>`,
          pin.meetingAt ? `<div style="color:#6b7280;">${escapeHtml(formatWhen(pin.meetingAt))}</div>` : '',
          '</div>',
        ].join('');
        marker.bindPopup(popupHtml);
        marker.addTo(markerLayer);
        bounds.extend([lat, lng]);
      }

      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2), { maxZoom: 13 });
      }
    }
    void syncMeetingMap();
    return () => {
      cancelled = true;
    };
  }, [meetingMapPins]);

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
      const normalized = normalizeHttpBaseUrl(stored);
      if (normalized) setWebsiteMakerBaseUrl(normalized);
    } catch {
      // Ignore storage access issues.
    }
  }, []);

  useEffect(() => {
    const normalized = normalizeHttpBaseUrl(websiteMakerBaseUrl);
    if (!normalized) return;
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
    setForm(INITIAL_FORM);
    setShowForm(true);
  }

  function openEdit(client: SalesClient) {
    const details = parseDetails(client.details);
    setEditingId(client.id);
    setForm({
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
        businessName: form.businessName,
        contactPerson: form.contactPerson,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        meetingPlace: form.meetingMode === 'in-person' ? form.meetingPlace : '',
        industry: form.industry,
        meetingMode: form.meetingMode,
        agreedTime: form.agreedTime,
        meetingAt: form.agreedTime ? toIsoDateTime(form.meetingAt) : '',
        websiteDomain: form.websiteDomain,
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

  async function createMakerRun(client: SalesClient) {
    setCreatingRunId(client.id);
    setError('');
    try {
      await request(`/admin/sales/${client.id}/create-maker-run`, {
        method: 'POST',
        body: JSON.stringify({ websiteMakerBaseUrl }),
      });
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed creating website run');
    } finally {
      setCreatingRunId(null);
    }
  }

  async function sendWelcomeEmail(client: SalesClient) {
    setSendingWelcomeId(client.id);
    setError('');
    try {
      await request(`/admin/sales/${client.id}/send-welcome-email`, { method: 'POST' });
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed sending welcome email');
    } finally {
      setSendingWelcomeId(null);
    }
  }

  async function sendReminderEmail(client: SalesClient) {
    setSendingReminderId(client.id);
    setError('');
    try {
      await request(`/admin/sales/${client.id}/send-reminder`, {
        method: 'POST',
        body: JSON.stringify({ kind: '24h' }),
      });
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed sending reminder email');
    } finally {
      setSendingReminderId(null);
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

  async function startMakerTunnel() {
    setStartingMakerTunnel(true);
    setError('');
    try {
      const normalizedCurrent = normalizeHttpBaseUrl(websiteMakerBaseUrl);
      const localTarget = normalizedCurrent && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(normalizedCurrent)
        ? normalizedCurrent
        : 'http://localhost:3000';
      const localOrigin = toOrigin(localTarget) || 'http://localhost:3000';
      const popupUrl = new URL('/local-tunnel', localOrigin);
      popupUrl.searchParams.set('returnOrigin', window.location.origin);
      popupUrl.searchParams.set('targetUrl', localTarget);

      const popup = window.open(
        popupUrl.toString(),
        'asoldi-maker-local-tunnel',
        'width=620,height=740'
      );
      if (!popup) {
        throw new Error('Popup blocked. Please allow popups and try again.');
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
                'Timed out waiting for local tunnel setup. Ensure Website Maker is running locally on localhost:3000 and try again.'
              )
            )
          );
        }, 45_000);
        const closeWatcherId = window.setInterval(() => {
          if (!popup.closed) return;
          finish(() =>
            reject(
              new Error(
                'Tunnel popup was closed before completion. Re-open it with "New tunnel URL" and let it finish.'
              )
            )
          );
        }, 450);

        const onMessage = (event: MessageEvent) => {
          if (event.origin !== localOrigin) return;
          const payload = event.data && typeof event.data === 'object' ? (event.data as Record<string, unknown>) : null;
          if (!payload) return;
          if (payload.type === 'asoldi-maker-tunnel-error') {
            const message = String(payload.message || 'Failed starting local tunnel.');
            finish(() => reject(new Error(message)));
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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Sales clients</h2>
            <p className="text-sm text-gray-400 mt-1">Add meetings, sync Google Calendar, sync previews from Website Maker, and move won clients to the Clients tab.</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium hover:bg-[#e55200]">
              <Plus size={16} />
              Add client
            </button>
          </div>
        </div>

        <div className="mt-4 grid md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className="text-xs text-gray-500">Website Maker URL</label>
            <div className="mt-1 flex flex-col sm:flex-row gap-2">
              <input
                value={websiteMakerBaseUrl}
                onChange={(e) => setWebsiteMakerBaseUrl(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/10 text-white"
                placeholder="http://localhost:3000"
              />
              <button
                type="button"
                onClick={() => void startMakerTunnel()}
                disabled={startingMakerTunnel}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 disabled:opacity-50"
                title="Start a new local cloudflared tunnel and auto-fill this URL"
              >
                <RefreshCw size={14} className={startingMakerTunnel ? 'animate-spin' : ''} />
                New tunnel URL
              </button>
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              Automatic welcome/reminder emails are currently disabled. Use the manual send buttons on each client card.
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <span className={`text-xs px-2 py-1 rounded ${calendarStatus?.connected ? 'bg-green-900/40 text-green-300' : 'bg-amber-900/40 text-amber-300'}`}>
              Google Calendar: {calendarStatus?.connected ? 'Connected' : calendarStatus?.configured ? 'Not connected' : 'Not configured'}
            </span>
            {calendarStatus?.configured && !calendarStatus.connected && (
              <button type="button" onClick={connectGoogleCalendar} className="px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15">
                Connect Google Calendar
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 px-4 py-3">{error}</div>}

      <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">In-person visit map (OpenStreetMap)</h3>
            <p className="text-xs text-gray-400 mt-1">
              Shows only clients with in-person meeting mode and a meeting place.
            </p>
          </div>
          <span className="text-xs px-2 py-1 rounded bg-black/20 border border-white/10 text-gray-300">
            {meetingMapPins.length} pins
          </span>
        </div>
        {meetingMapError && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 px-3 py-2 text-xs">
            {meetingMapError}
          </div>
        )}
        <div className="mt-3 h-[340px] rounded-xl border border-white/10 overflow-hidden relative">
          <div ref={meetingMapContainerRef} className="h-full w-full" />
          {meetingMapLoading && (
            <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-gray-200 text-sm">
              <Loader2 size={16} className="animate-spin mr-2" />
              Loading map pins…
            </div>
          )}
        </div>
        {!meetingMapLoading && meetingMapPins.length === 0 && (
          <p className="mt-2 text-xs text-gray-500">No in-person meeting places to show yet.</p>
        )}
        {meetingMapUnresolvedCount > 0 && (
          <p className="mt-2 text-xs text-amber-300">
            {meetingMapUnresolvedCount} in-person place(s) could not be geocoded automatically.
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
            Sorted by meeting date: closest upcoming first. Past meetings are grouped under <span className="text-red-300">Past due</span>.
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
            {orderedActiveClients.map((client) => {
            const step0Done = Boolean(client.progression?.step0AgreeMeetingTime);
            const timeline: { key: ProgressionKey; done: boolean }[] = [
              { key: 'step0AgreeMeetingTime', done: step0Done },
              { key: 'contractSigned', done: Boolean(client.progression?.contractSigned) },
              { key: 'paymentReceived', done: Boolean(client.progression?.paymentReceived) },
              { key: 'domainConnected', done: Boolean(client.progression?.domainConnected) },
              { key: 'live', done: Boolean(client.progression?.live) },
            ];
            const importedPreviewUrl = client.websiteImport?.previewUrl || getSalesPreviewFallback(client.id);
            const clientOffers = offers.filter((entry) => entry.salesClientId === client.id);
            const makerRunId = String(client.makerRun?.runId || '').trim();
            const hasRun = Boolean(makerRunId);
            const dynamicDashboardUrl = buildMakerRunUrl(websiteMakerBaseUrl, makerRunId, 'dashboard');
            const dynamicPreviewUrl = buildMakerRunUrl(websiteMakerBaseUrl, makerRunId, 'preview');
            const makerDashboardUrl = dynamicDashboardUrl || String(client.makerRun?.dashboardUrl || '').trim();
            const makerPreviewUrl = dynamicPreviewUrl || String(client.makerRun?.previewUrl || '').trim();
            const expanded = expandedId === client.id;
            const meetingTimestamp = client.agreedTime ? parseMeetingTimestamp(client.meetingAt) : null;
            const isPastDueMeeting = meetingTimestamp !== null && meetingTimestamp < meetingNowMs;
            const showNoMeetingDateHeading = Boolean(firstNoMeetingDateClientId) && client.id === firstNoMeetingDateClientId;
            const showPastDueHeading = Boolean(firstPastDueClientId) && client.id === firstPastDueClientId;
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
                    {client.contactPerson && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400 min-w-0">
                        <UserRound size={12} className="shrink-0" />
                        <span className="truncate">{client.contactPerson}</span>
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
                  {timeline.map((step) => (
                    <button
                      key={step.key}
                      type="button"
                      disabled={progressBusyKey === `${client.id}:${step.key}`}
                      onClick={() => void toggleProgress(client, step.key)}
                      className={`px-2 py-1 rounded-md text-[11px] border transition-colors hover:border-[#FF5B00]/40 disabled:opacity-60 ${
                        step.done
                          ? 'bg-green-900/40 border-green-600/40 text-green-300'
                          : 'bg-black/20 border-white/10 text-gray-400'
                      }`}
                    >
                      {step.done ? <CheckCircle2 size={11} className="inline mr-1" /> : null}
                      {formatStepLabel(step.key)}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {hasRun ? (
                    <>
                      <button
                        type="button"
                        onClick={() => window.open(makerDashboardUrl, '_blank')}
                        disabled={!makerDashboardUrl}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15 disabled:opacity-50"
                      >
                        <ExternalLink size={13} />
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
                  )}
                  <button
                    type="button"
                    onClick={() => void sendWelcomeEmail(client)}
                    disabled={sendingWelcomeId === client.id || !client.contactEmail || !client.agreedTime}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15 disabled:opacity-50"
                    title={!client.agreedTime ? 'Set agreed meeting time first' : 'Send welcome email manually'}
                  >
                    {sendingWelcomeId === client.id ? <Loader2 size={13} className="animate-spin" /> : <MailPlus size={13} />}
                    Send welcome email
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendReminderEmail(client)}
                    disabled={sendingReminderId === client.id || !client.contactEmail || !client.agreedTime}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15 disabled:opacity-50"
                    title={!client.agreedTime ? 'Set agreed meeting time first' : 'Send reminder email manually'}
                  >
                    {sendingReminderId === client.id ? <Loader2 size={13} className="animate-spin" /> : <BellRing size={13} />}
                    Send reminder
                  </button>
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
                  {clientOffers.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#FF5B00]/15 text-[#ff8a4d] text-[11px]">
                      <Tag size={12} />
                      {clientOffers.length} tilbud
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                  <button
                    type="button"
                    onClick={() => setExpandedId((prev) => (prev === client.id ? null : client.id))}
                    className="text-xs text-[#FF5B00] hover:underline"
                  >
                    {expanded ? 'Hide details' : 'Details & tools'}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => promoteClient(client)}
                      disabled={promotingId === client.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF5B00] text-white text-xs hover:bg-[#e55200] disabled:opacity-50"
                    >
                      {promotingId === client.id ? <Loader2 size={13} className="animate-spin" /> : null}
                      Got the client
                    </button>
                    <button
                      type="button"
                      onClick={() => void markNotSold(client)}
                      disabled={statusBusyId === `not-sold:${client.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-gray-200 text-xs hover:bg-white/15 disabled:opacity-50"
                    >
                      {statusBusyId === `not-sold:${client.id}` ? <Loader2 size={13} className="animate-spin" /> : <ArchiveX size={13} />}
                      Not sold
                    </button>
                    <button
                      type="button"
                      onClick={() => void markSecondary(client)}
                      disabled={statusBusyId === `secondary:${client.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-gray-200 text-xs hover:bg-white/15 disabled:opacity-50"
                    >
                      {statusBusyId === `secondary:${client.id}` ? <Loader2 size={13} className="animate-spin" /> : <ArchiveX size={13} />}
                      Ikke interresert i nettside
                    </button>
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
                          {client.meetingMode === 'in-person' ? (
                            <li>Meeting place: {client.meetingPlace || '—'}</li>
                          ) : (
                            <li>Meeting place: Online (Google Meet)</li>
                          )}
                          <li>Industry: {client.industry || '—'}</li>
                          <li>Duration: {durationForMode(client.meetingMode)} min</li>
                          <li>Agreed time: {client.agreedTime ? 'Yes' : 'No'}</li>
                        </ul>
                      </details>
                      <details open className="text-sm text-gray-200">
                        <summary className="cursor-pointer text-white font-medium mb-2">Website, calendar & reminders</summary>
                        <ul className="space-y-1 text-gray-300">
                          <li>Website domain: {client.websiteDomain || '—'}</li>
                          <li>Maker run: {client.makerRun?.runId || '—'}</li>
                          <li>Import source run: {client.websiteImport?.sourceRunId || '—'}</li>
                          <li>Import step: {client.websiteImport?.sourceStep || '—'}</li>
                          <li>Calendar event: {client.calendar?.eventId || '—'}</li>
                          <li>Meet link: {client.calendar?.meetLink || '—'}</li>
                          <li>Thank-you sent: {client.reminders?.thankYouSentAt ? formatWhen(client.reminders.thankYouSentAt) : 'No'}</li>
                          <li>24h reminder: {client.reminders?.reminder24hSentAt ? formatWhen(client.reminders.reminder24hSentAt) : 'Pending/Skipped'}</li>
                          <li>1h reminder: {client.reminders?.reminder1hSentAt ? formatWhen(client.reminders.reminder1hSentAt) : 'Pending/Skipped'}</li>
                        </ul>
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
                        ZIP upload is removed from this flow. Sync pulls the latest exported site directly from the linked run.
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
                  </div>
                )}
                </div>
              </React.Fragment>
            );
          })}

          {activeClients.length === 0 && (
            <div className="lg:col-span-2 2xl:col-span-3 rounded-2xl bg-[#2a2a2a] border border-white/10 p-8 text-center text-gray-400">
              No active sales clients right now. Click <strong className="text-white">Add client</strong> to start.
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
                    <div className="text-xs text-gray-400 truncate">{client.contactPerson || 'No contact person'}</div>
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

      {secondaryClients.length > 0 && (
        <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-white font-semibold">Sekundært (Ikke interresert i nettside)</h3>
            <span className="text-xs px-2 py-1 rounded bg-black/20 border border-white/10 text-gray-300">
              {secondaryClients.length} clients
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
            {secondaryClients.map((client) => (
              <div key={client.id} className="rounded-xl bg-black/20 border border-white/10 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{client.businessName || 'Unnamed business'}</div>
                    <div className="text-xs text-gray-400 truncate">{client.contactPerson || 'No contact person'}</div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-amber-900/30 text-amber-300 border border-amber-700/30">
                    Sekundært
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  Moved: {formatDateTime(client.archive?.archivedAt || client.updatedAt)}
                </div>
                {client.archive?.reason ? (
                  <div className="text-xs text-gray-300">
                    Note: {client.archive.reason}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">No note added.</div>
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
              <Field label="Business name" value={form.businessName} onChange={(value) => setForm((prev) => ({ ...prev, businessName: value }))} required />
              <Field label="Contact person" value={form.contactPerson} onChange={(value) => setForm((prev) => ({ ...prev, contactPerson: value }))} required />
              <Field label="Email" type="email" value={form.contactEmail} onChange={(value) => setForm((prev) => ({ ...prev, contactEmail: value }))} required />
              <Field label="Phone number" value={form.contactPhone} onChange={(value) => setForm((prev) => ({ ...prev, contactPhone: value }))} />
              <Field label="Industry" value={form.industry} onChange={(value) => setForm((prev) => ({ ...prev, industry: value }))} />
              <Field label="Website domain (optional)" value={form.websiteDomain} onChange={(value) => setForm((prev) => ({ ...prev, websiteDomain: value }))} />
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
                      meetingPlace: e.target.value === 'online' ? '' : prev.meetingPlace,
                    }))
                  }
                  className="w-full px-4 py-3 rounded-lg bg-[#161616] border border-white/10 text-white"
                >
                  <option value="online">Online (30 min)</option>
                  <option value="in-person">In person (60 min)</option>
                </select>
              </div>

              {form.meetingMode === 'in-person' ? (
                <Field label="Place to meet" value={form.meetingPlace} onChange={(value) => setForm((prev) => ({ ...prev, meetingPlace: value }))} />
              ) : (
                <div className="rounded-lg border border-white/10 bg-[#161616] px-4 py-3 text-sm text-gray-400">
                  Meeting place is hidden for online mode (Google Meet).
                </div>
              )}

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
