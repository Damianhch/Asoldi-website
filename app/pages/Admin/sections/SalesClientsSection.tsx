import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Gift,
  Loader2,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  UploadCloud,
  UserRound,
  X,
} from 'lucide-react';
import { API, salesAuthHeaders, type SalesClient } from '../shared';

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

type CalendarStatus = {
  configured: boolean;
  connected: boolean;
  calendarId: string;
  redirectUri: string;
  tokenUpdatedAt: string;
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
  businessAddress: string;
  industry: string;
  meetingMode: 'online' | 'in-person';
  agreedTime: boolean;
  meetingAt: string;
  websiteDomain: string;
  websiteGoals: string;
  packageNotes: string;
  additionalInfo: string;
};

const INITIAL_FORM: SalesFormState = {
  businessName: '',
  contactPerson: '',
  contactEmail: '',
  contactPhone: '',
  meetingPlace: '',
  businessAddress: '',
  industry: '',
  meetingMode: 'online',
  agreedTime: false,
  meetingAt: '',
  websiteDomain: '',
  websiteGoals: '',
  packageNotes: '',
  additionalInfo: '',
};

function parseDetails(details: Record<string, unknown> | undefined) {
  const safe = details && typeof details === 'object' ? details : {};
  return {
    websiteGoals: String(safe.websiteGoals || ''),
    packageNotes: String(safe.packageNotes || ''),
    additionalInfo: String(safe.additionalInfo || ''),
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

function formatStepLabel(value: string) {
  if (value === 'step0AgreeMeetingTime') return 'Step 0: Agree meeting time';
  if (value === 'paymentReceived') return 'Payment received';
  if (value === 'domainConnected') return 'Domain connected';
  return 'Live';
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
  const [importingId, setImportingId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [progressBusyKey, setProgressBusyKey] = useState<string | null>(null);
  const [websiteMakerBaseUrl, setWebsiteMakerBaseUrl] = useState('http://localhost:3000');
  const [runIdByClient, setRunIdByClient] = useState<Record<string, string>>({});

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

  async function loadSales() {
    setLoading(true);
    setError('');
    try {
      const data = await request('/admin/sales');
      setClients(Array.isArray(data.clients) ? data.clients : []);
      setCalendarStatus((data.calendar || null) as CalendarStatus | null);
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

  async function searchOfferUsers() {
    setOfferSearching(true);
    try {
      const data = await request(`/admin/sales/client-search?q=${encodeURIComponent(offerSearch.trim())}`);
      setOfferResults(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed searching users');
    } finally {
      setOfferSearching(false);
    }
  }

  async function createOffer(client: SalesClient) {
    setCreatingOffer(true);
    setError('');
    try {
      const data = await request('/admin/sales/offers', {
        method: 'POST',
        body: JSON.stringify({
          planId: offerPlanId,
          note: offerNote,
          salesClientId: client.id,
          targetUserId: offerSelectedUser?.userId || '',
          targetEmail: offerSelectedUser?.email || '',
        }),
      });
      setLastCreatedCode(data.offer?.code || null);
      setOfferNote('');
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
      businessAddress: client.businessAddress || '',
      industry: client.industry || '',
      meetingMode: client.meetingMode === 'in-person' ? 'in-person' : 'online',
      agreedTime: Boolean(client.agreedTime),
      meetingAt: toDateTimeLocal(client.meetingAt),
      websiteDomain: client.websiteDomain || '',
      websiteGoals: details.websiteGoals,
      packageNotes: details.packageNotes,
      additionalInfo: details.additionalInfo,
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
        meetingPlace: form.meetingPlace,
        businessAddress: form.businessAddress,
        industry: form.industry,
        meetingMode: form.meetingMode,
        agreedTime: form.agreedTime,
        meetingAt: form.agreedTime ? toIsoDateTime(form.meetingAt) : '',
        websiteDomain: form.websiteDomain,
        details: {
          websiteGoals: form.websiteGoals,
          packageNotes: form.packageNotes,
          additionalInfo: form.additionalInfo,
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

  async function toggleProgress(client: SalesClient, key: 'paymentReceived' | 'domainConnected' | 'live') {
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

  async function importWebsite(client: SalesClient) {
    const runId = String(runIdByClient[client.id] || '').trim();
    if (!runId) {
      setError('Enter Website Maker run ID before importing.');
      return;
    }
    setImportingId(client.id);
    setError('');
    try {
      await request(`/admin/sales/${client.id}/import-website`, {
        method: 'POST',
        body: JSON.stringify({
          runId,
          websiteMakerBaseUrl,
          siteFolder: client.businessName || 'site',
        }),
      });
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed importing website');
    } finally {
      setImportingId(null);
    }
  }

  async function uploadWebsiteZip(client: SalesClient, file: File) {
    setImportingId(client.id);
    setError('');
    try {
      const siteFolder = encodeURIComponent(client.businessName || 'site');
      await request(`/admin/sales/${client.id}/import-website-upload?siteFolder=${siteFolder}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body: file,
      });
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed uploading website ZIP');
    } finally {
      setImportingId(null);
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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Sales clients</h2>
            <p className="text-sm text-gray-400 mt-1">Add meetings, sync Google Calendar, import website bundles, and move won clients to the Clients tab.</p>
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
            <input
              value={websiteMakerBaseUrl}
              onChange={(e) => setWebsiteMakerBaseUrl(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/10 text-white"
              placeholder="http://localhost:3000"
            />
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

      {loading ? (
        <div className="min-h-[180px] flex items-center justify-center text-gray-400">
          <Loader2 className="animate-spin mr-2" size={18} /> Loading sales clients…
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => {
            const step0Done = Boolean(client.progression?.step0AgreeMeetingTime);
            const timeline = [
              { key: 'step0AgreeMeetingTime', done: step0Done, editable: false },
              { key: 'paymentReceived', done: Boolean(client.progression?.paymentReceived), editable: true as const },
              { key: 'domainConnected', done: Boolean(client.progression?.domainConnected), editable: true as const },
              { key: 'live', done: Boolean(client.progression?.live), editable: true as const },
            ];
            const previewUrl = client.websiteImport?.previewUrl || getSalesPreviewFallback(client.id);
            const clientOffers = offers.filter((entry) => entry.salesClientId === client.id);
            return (
              <div key={client.id} className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-5 space-y-4">
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-white text-lg font-semibold">{client.businessName || 'Unnamed business'}</h3>
                      <span className="px-2 py-1 rounded text-xs bg-black/20 border border-white/10 text-gray-300">{client.meetingMode === 'in-person' ? 'In person' : 'Online'}</span>
                    </div>
                    <div className="mt-2 grid md:grid-cols-3 gap-3 text-sm">
                      <InfoChip icon={<UserRound size={14} />} label="Meeting person" value={client.contactPerson || '—'} />
                      <InfoChip icon={<CalendarClock size={14} />} label="Meeting time" value={client.agreedTime ? formatWhen(client.meetingAt) : 'Step 0 pending'} />
                      <InfoChip icon={<Clock3 size={14} />} label="Duration" value={`${durationForMode(client.meetingMode)} min`} />
                    </div>
                    <div className="mt-2 text-xs text-gray-400">Business address: {client.businessAddress || '—'}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => openEdit(client)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15">
                      <Pencil size={14} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(previewUrl, '_blank')}
                      disabled={!client.websiteImport?.importRoot}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:opacity-50"
                    >
                      <ExternalLink size={14} />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => promoteClient(client)}
                      disabled={promotingId === client.id}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FF5B00] text-white hover:bg-[#e55200] disabled:opacity-50"
                    >
                      {promotingId === client.id ? <Loader2 size={14} className="animate-spin" /> : null}
                      Got the client
                    </button>
                  </div>
                </div>

                <div className="grid xl:grid-cols-[1fr_auto] gap-3 items-center">
                  <div className="flex flex-wrap gap-2">
                    {timeline.map((step) => (
                      <button
                        key={step.key}
                        type="button"
                        disabled={!step.editable || progressBusyKey === `${client.id}:${step.key}`}
                        onClick={() => step.editable && void toggleProgress(client, step.key as 'paymentReceived' | 'domainConnected' | 'live')}
                        className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                          step.done
                            ? 'bg-green-900/40 border-green-600/40 text-green-300'
                            : 'bg-black/20 border-white/10 text-gray-400'
                        } ${step.editable ? 'hover:border-[#FF5B00]/40' : ''}`}
                      >
                        {step.done ? <CheckCircle2 size={12} className="inline mr-1" /> : null}
                        {formatStepLabel(step.key)}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={runIdByClient[client.id] || ''}
                      onChange={(e) => setRunIdByClient((prev) => ({ ...prev, [client.id]: e.target.value }))}
                      placeholder="Run ID for import"
                      className="px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/10 text-white text-sm min-w-[220px]"
                    />
                    <button
                      type="button"
                      onClick={() => importWebsite(client)}
                      disabled={importingId === client.id}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:opacity-50"
                    >
                      {importingId === client.id ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                      Import site
                    </button>
                    <label
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 cursor-pointer ${importingId === client.id ? 'opacity-50 pointer-events-none' : ''}`}
                      title="Upload an exported site .zip from the Website Maker"
                    >
                      <UploadCloud size={14} />
                      Upload ZIP
                      <input
                        type="file"
                        accept=".zip,application/zip,application/x-zip-compressed"
                        className="hidden"
                        disabled={importingId === client.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) void uploadWebsiteZip(client, file);
                        }}
                      />
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedId((prev) => (prev === client.id ? null : client.id))}
                  className="text-sm text-[#FF5B00] hover:underline"
                >
                  {expandedId === client.id ? 'Hide details' : 'View more details'}
                </button>

                {expandedId === client.id && (
                  <div className="grid md:grid-cols-2 gap-4 rounded-xl bg-black/20 border border-white/10 p-4">
                    <details open className="text-sm text-gray-200">
                      <summary className="cursor-pointer text-white font-medium mb-2">Contact & meeting</summary>
                      <ul className="space-y-1 text-gray-300">
                        <li>Email: {client.contactEmail || '—'}</li>
                        <li>Phone: {client.contactPhone || '—'}</li>
                        <li>Meeting place: {client.meetingPlace || '—'}</li>
                        <li>Address: {client.businessAddress || '—'}</li>
                        <li>Industry: {client.industry || '—'}</li>
                        <li>Agreed time: {client.agreedTime ? 'Yes' : 'No'}</li>
                      </ul>
                    </details>
                    <details open className="text-sm text-gray-200">
                      <summary className="cursor-pointer text-white font-medium mb-2">Website, calendar & reminders</summary>
                      <ul className="space-y-1 text-gray-300">
                        <li>Website domain: {client.websiteDomain || '—'}</li>
                        <li>Import source run: {client.websiteImport?.sourceRunId || '—'}</li>
                        <li>Import step: {client.websiteImport?.sourceStep || '—'}</li>
                        <li>Calendar event: {client.calendar?.eventId || '—'}</li>
                        <li>Meet link: {client.calendar?.meetLink || '—'}</li>
                        <li>Thank-you sent: {client.reminders?.thankYouSentAt ? formatWhen(client.reminders.thankYouSentAt) : 'No'}</li>
                        <li>24h reminder: {client.reminders?.reminder24hSentAt ? formatWhen(client.reminders.reminder24hSentAt) : 'Pending/Skipped'}</li>
                        <li>1h reminder: {client.reminders?.reminder1hSentAt ? formatWhen(client.reminders.reminder1hSentAt) : 'Pending/Skipped'}</li>
                      </ul>
                    </details>
                    <details open className="md:col-span-2 text-sm text-gray-200">
                      <summary className="cursor-pointer text-white font-medium mb-2">Additional details</summary>
                      <div className="grid md:grid-cols-3 gap-3 text-gray-300">
                        <div>
                          <div className="text-xs text-gray-500 uppercase mb-1">Website goals</div>
                          <p>{String(client.details?.websiteGoals || '—')}</p>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 uppercase mb-1">Package notes</div>
                          <p>{String(client.details?.packageNotes || '—')}</p>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 uppercase mb-1">Other info</div>
                          <p>{String(client.details?.additionalInfo || '—')}</p>
                        </div>
                      </div>
                    </details>
                  </div>
                )}

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
                            <div className="flex gap-2">
                              <input
                                value={offerSearch}
                                onChange={(e) => setOfferSearch(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void searchOfferUsers();
                                  }
                                }}
                                placeholder="Søk…"
                                className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => void searchOfferUsers()}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15"
                              >
                                {offerSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                Søk
                              </button>
                            </div>
                            {offerResults.length > 0 && (
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
                            )}
                            <p className="mt-1 text-[11px] text-gray-500">
                              Valgfritt – uten valgt bruker kan kunden løse inn tilbudet med nettsidekoden.
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
                        <p className="text-[11px] text-gray-500">Tips: importer en nettside over for å gi kunden forhåndsvisning i tilbudet.</p>
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
            );
          })}

          {clients.length === 0 && (
            <div className="rounded-2xl bg-[#2a2a2a] border border-white/10 p-8 text-center text-gray-400">
              No sales clients yet. Click <strong className="text-white">Add client</strong> to start.
            </div>
          )}
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
              <Field label="Place to meet" value={form.meetingPlace} onChange={(value) => setForm((prev) => ({ ...prev, meetingPlace: value }))} />
              <Field label="Address" value={form.businessAddress} onChange={(value) => setForm((prev) => ({ ...prev, businessAddress: value }))} />
              <Field label="Industry" value={form.industry} onChange={(value) => setForm((prev) => ({ ...prev, industry: value }))} />
              <Field label="Website domain (optional)" value={form.websiteDomain} onChange={(value) => setForm((prev) => ({ ...prev, websiteDomain: value }))} />

              <div>
                <label className="block text-sm text-gray-300 mb-1">Meeting mode</label>
                <select
                  value={form.meetingMode}
                  onChange={(e) => setForm((prev) => ({ ...prev, meetingMode: e.target.value as 'online' | 'in-person' }))}
                  className="w-full px-4 py-3 rounded-lg bg-[#161616] border border-white/10 text-white"
                >
                  <option value="online">Online (30 min)</option>
                  <option value="in-person">In person (60 min)</option>
                </select>
              </div>

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

              <TextArea label="Website goals" value={form.websiteGoals} onChange={(value) => setForm((prev) => ({ ...prev, websiteGoals: value }))} />
              <TextArea label="Package notes" value={form.packageNotes} onChange={(value) => setForm((prev) => ({ ...prev, packageNotes: value }))} />
              <TextArea label="Additional info" value={form.additionalInfo} onChange={(value) => setForm((prev) => ({ ...prev, additionalInfo: value }))} />

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

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/20 border border-white/10 px-3 py-2 min-w-0">
      <div className="flex items-center gap-2 text-xs text-gray-500">{icon}{label}</div>
      <div className="text-sm text-white mt-1 truncate">{value}</div>
    </div>
  );
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
