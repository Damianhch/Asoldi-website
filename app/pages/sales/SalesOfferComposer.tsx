import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Eye, FileText, Loader2, Paperclip, RefreshCw, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import { EmailVisualEditor } from './EmailVisualEditor';
import {
  approveClientOfferPreview,
  fillClientOffer,
  getClientOffer,
  openAuthedPdf,
  previewClientOffer,
  requestClientOfferReview,
  saveClientOffer,
  sendClientOffer,
  startNewClientOffer,
  type MergeField,
  type OfferPreview,
  type OfferReadiness,
  type OfferTier,
} from './emailApi';
import { getSalesToken, type SalesOffer, type SalesSender } from '../Admin/shared';
import { ContractSummaryCard, HtmlPreview, OfferProductsCard, OfferStatusChip } from './offerUi';

type OfferClient = {
  id: string;
  businessName: string;
  contactPerson: string;
  contactEmail: string;
  orgNumber: string;
  businessAddress: string;
  meetingPlace: string;
};

type MeetingInfo = { meetingId: string; title: string; when: string; hasTranscript: boolean; hasSummary: boolean } | null;

type PreviewState = {
  preview: OfferPreview;
  placeholders: string[];
  blocker: string;
};

const AUTOSAVE_MS = 1500;

export function SalesOfferComposer() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const clientId = params.get('clientId') || '';

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'' | 'tier' | 'mva' | 'review-toggle' | 'fill' | 'review' | 'send' | 'contract' | 'new' | 'save' | 'preview' | 'approve'>('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [offer, setOffer] = useState<SalesOffer | null>(null);
  const [client, setClient] = useState<OfferClient | null>(null);
  const [readiness, setReadiness] = useState<OfferReadiness>({ ready: false, missing: [], message: '' });
  const [tiers, setTiers] = useState<OfferTier[]>([]);
  const [mergeFields, setMergeFields] = useState<MergeField[]>([]);
  const [meeting, setMeeting] = useState<MeetingInfo>(null);
  const [sender, setSender] = useState<SalesSender | null>(null);
  const [deepseek, setDeepseek] = useState(false);
  const [canSendEmail, setCanSendEmail] = useState(true);

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [html, setHtml] = useState('');
  const [htmlKey, setHtmlKey] = useState('');
  // Edits made since the last approved preview (before the autosave has told the server about them).
  const [editedSincePreview, setEditedSincePreview] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = offer?.status || 'draft';
  const locked = status === 'review-requested' || status === 'verified' || status === 'sent';
  const isCustom = offer?.tierId === 'custom';
  // Server is the source of truth: custom tier always needs admin, otherwise the rep's checkbox decides.
  const reviewChecked = isCustom || Boolean(offer?.reviewRequested);
  const needsReview = reviewChecked;
  const mvaIncluded = Boolean(offer?.mvaIncluded);
  const placeholders = offer?.placeholders || [];
  const previewApproved = Boolean(offer?.previewCurrent) && !editedSincePreview;

  const applyOffer = useCallback((next: SalesOffer, { resetHtml = true } = {}) => {
    setOffer(next);
    setSubject(next.email.subject || '');
    setPreheader(next.email.preheader || '');
    if (resetHtml) {
      setHtml(next.email.html || '');
      setHtmlKey(`${next.id}-${next.updatedAt}-${Date.now()}`);
    }
    dirtyRef.current = false;
    setEditedSincePreview(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getClientOffer(clientId) as {
        offer: SalesOffer;
        client: OfferClient;
        readiness: OfferReadiness;
        tiers: OfferTier[];
        mergeFields: MergeField[];
        meeting: MeetingInfo;
        sender: SalesSender;
        deepseek: boolean;
        canSendEmail: boolean;
      };
      setClient(data.client);
      setReadiness(data.readiness);
      setTiers(Array.isArray(data.tiers) ? data.tiers : []);
      setMergeFields(Array.isArray(data.mergeFields) ? data.mergeFields : []);
      setMeeting(data.meeting || null);
      setSender(data.sender || null);
      setDeepseek(Boolean(data.deepseek));
      setCanSendEmail(data.canSendEmail !== false);
      setTo(data.client?.contactEmail || '');
      applyOffer(data.offer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke åpne tilbudet');
    } finally {
      setLoading(false);
    }
  }, [clientId, applyOffer]);

  useEffect(() => {
    if (!getSalesToken()) {
      navigate('/login/ansatt', { replace: true });
      return;
    }
    if (!clientId) {
      setError('Mangler kunde.');
      setLoading(false);
      return;
    }
    void load();
  }, [clientId, navigate, load]);

  // Autosave the draft so the rep can leave and come back (and so admin review sees the latest content).
  const scheduleSave = useCallback((payload: Record<string, unknown>) => {
    if (!offer || locked) return;
    dirtyRef.current = true;
    setEditedSincePreview(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const data = await saveClientOffer(clientId, payload) as { offer: SalesOffer };
        setOffer(data.offer);
        dirtyRef.current = false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Autolagring feilet');
      }
    }, AUTOSAVE_MS);
  }, [clientId, offer, locked]);

  function onHtmlChange(next: string) {
    if (next === html) return;
    setHtml(next);
    scheduleSave({ html: next, subject, preheader });
  }

  function onSubjectChange(next: string) {
    setSubject(next);
    scheduleSave({ html, subject: next, preheader });
  }

  function onPreheaderChange(next: string) {
    setPreheader(next);
    scheduleSave({ html, subject, preheader: next });
  }

  async function flushSave() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!dirtyRef.current || locked) return offer;
    const data = await saveClientOffer(clientId, { html, subject, preheader }) as { offer: SalesOffer };
    setOffer(data.offer);
    dirtyRef.current = false;
    return data.offer;
  }

  async function chooseTier(tierId: string) {
    setBusy('tier');
    setError('');
    try {
      // No reviewRequested here: the server forces it on for custom and resets it when leaving custom.
      const data = await saveClientOffer(clientId, { tierId, html, subject, preheader }) as { offer: SalesOffer };
      applyOffer(data.offer);
      setNotice(tierId === 'custom'
        ? 'Skreddersydd valgt – tilbudet må kjøres via admin før det kan sendes.'
        : tierId ? 'Pakken er lagt inn under «Hva er inkludert».' : 'Pakke fjernet.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke velge tier');
    } finally {
      setBusy('');
    }
  }

  async function toggleReviewFirst(next: boolean) {
    if (!offer || locked || isCustom) return;
    setBusy('review-toggle');
    setError('');
    try {
      const data = await saveClientOffer(clientId, { reviewRequested: next }) as { offer: SalesOffer };
      setOffer(data.offer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre valget');
    } finally {
      setBusy('');
    }
  }

  async function toggleMvaIncluded(next: boolean) {
    if (!offer || locked) return;
    setBusy('mva');
    setError('');
    try {
      const data = await saveClientOffer(clientId, { mvaIncluded: next, html, subject, preheader }) as { offer: SalesOffer };
      applyOffer(data.offer);
      setNotice(next
        ? 'Mva er nå inkludert i prisen – oppgitt pris er det kunden betaler per måned.'
        : 'Mva legges til på toppen av oppgitt pris (standard).');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke endre mva-visning');
    } finally {
      setBusy('');
    }
  }

  async function handleFill() {
    setBusy('fill');
    setError('');
    setNotice('');
    try {
      const data = await fillClientOffer(clientId, { html, meetingId: meeting?.meetingId || '' }) as { offer: SalesOffer };
      applyOffer(data.offer);
      setNotice('E-posten er fylt ut med detaljer fra møtet. Les gjennom før du sender.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI-utfylling feilet');
    } finally {
      setBusy('');
    }
  }

  async function openContract() {
    setBusy('contract');
    setError('');
    try {
      await flushSave();
      await openAuthedPdf(`/admin/sales/${encodeURIComponent(clientId)}/offer/contract.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lage kontrakt');
    } finally {
      setBusy('');
    }
  }

  async function openPreview() {
    setBusy('preview');
    setError('');
    try {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const data = await previewClientOffer(clientId, locked ? { to } : { to, html, subject, preheader });
      setOffer(data.offer);
      dirtyRef.current = false;
      setPreviewState({ preview: data.preview, placeholders: data.placeholders || [], blocker: data.blocker || '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Forhåndsvisning feilet');
    } finally {
      setBusy('');
    }
  }

  async function approvePreview() {
    setBusy('approve');
    setError('');
    try {
      const data = await approveClientOfferPreview(clientId);
      setOffer(data.offer);
      setEditedSincePreview(false);
      setPreviewState(null);
      setNotice('Forhåndsvisningen er godkjent – du kan nå sende tilbudet.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke godkjenne forhåndsvisningen');
    } finally {
      setBusy('');
    }
  }

  async function handleRequestReview() {
    setBusy('review');
    setError('');
    setNotice('');
    try {
      const data = await requestClientOfferReview(clientId, { html, subject, preheader, reviewRequested: true }) as { offer: SalesOffer; notification?: { sent: boolean; to?: string } };
      applyOffer(data.offer);
      setNotice(data.notification?.sent ? `Sendt til admin for gjennomgang (${data.notification.to}).` : 'Sendt til admin for gjennomgang.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke sende til gjennomgang');
    } finally {
      setBusy('');
    }
  }

  async function handleSend() {
    setBusy('send');
    setError('');
    setNotice('');
    try {
      const payload = status === 'verified' ? { to } : { to, html, subject, preheader };
      const data = await sendClientOffer(clientId, payload) as { offer: SalesOffer; copyTo?: string; contractFileName?: string };
      applyOffer(data.offer);
      setNotice(`Tilbud sendt til ${to}${data.contractFileName ? ` med ${data.contractFileName}` : ''}${data.copyTo ? ` · Kopi: ${data.copyTo}` : ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sending feilet');
    } finally {
      setBusy('');
    }
  }

  async function handleNewOffer() {
    setBusy('new');
    setError('');
    try {
      const data = await startNewClientOffer(clientId) as { offer: SalesOffer };
      applyOffer(data.offer);
      setNotice('Nytt tilbudsutkast opprettet.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke starte nytt tilbud');
    } finally {
      setBusy('');
    }
  }

  const fillDisabledReason = useMemo(() => {
    if (!deepseek) return 'AI-utfylling er ikke aktivert på serveren enda (DeepSeek-nøkkel mangler). Du kan fylle ut feltene manuelt i editoren.';
    if (!meeting) return 'Ingen Fireflies-møte er koblet til kunden enda.';
    if (!meeting.hasTranscript && !meeting.hasSummary) return 'Møtet mangler transkript/sammendrag.';
    return '';
  }, [deepseek, meeting]);

  const sendDisabledReason = useMemo(() => {
    if (!offer) return '';
    if (!canSendEmail) return 'E-post er ikke konfigurert på serveren.';
    if (!readiness.ready) return readiness.message;
    if (!to) return 'Mangler e-postadresse.';
    if (!offer.products.length) return 'Velg en nettside-tier først.';
    if (status === 'review-requested') return 'Venter på gjennomgang hos admin.';
    if (needsReview && status !== 'verified') return 'Dette tilbudet må verifiseres av admin før det kan sendes.';
    if (placeholders.length) return `${placeholders.length} felt fra malen er ikke fylt ut enda.`;
    if (!previewApproved) return 'Forhåndsvis e-posten og godkjenn før du sender.';
    return '';
  }, [offer, canSendEmail, readiness, to, status, needsReview, placeholders.length, previewApproved]);

  const showSendButton = status !== 'sent' && (!needsReview || status === 'verified');
  const title = 'Send tilbud';

  return (
    <>
      <Helmet>
        <title>{title} – Asoldi</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="staff-light min-h-screen bg-[#1a1a1a] text-white">
        <header className="border-b border-white/10 bg-[#222]">
          <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">{title}</h1>
                {offer && <OfferStatusChip status={offer.status} />}
              </div>
              <p className="text-xs text-gray-400 truncate">
                {client?.businessName || 'Kunde'}{client?.contactPerson ? ` · ${client.contactPerson}` : ''} · tilbuds-e-post + kontrakt (PDF) sendes sammen
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/sales/email/templates" className="px-3 py-2 rounded-lg bg-white/10 text-sm hover:bg-white/15">Maler</Link>
              <Link to="/sales" className="px-3 py-2 rounded-lg bg-white/10 text-sm hover:bg-white/15">Tilbake</Link>
            </div>
          </div>
        </header>

        <main className="max-w-[1400px] mx-auto px-6 py-6 flex flex-col gap-4">
          {error && <p className="text-red-300 text-sm">{error}</p>}
          {notice && <p className="text-emerald-200 text-sm">{notice}</p>}

          {loading || !offer ? (
            <div className="flex items-center gap-2 text-gray-400"><Loader2 className="animate-spin" size={18} /> Åpner tilbudet…</div>
          ) : (
            <>
              {!readiness.ready && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Kundekortet mangler data som kontrakten trenger</div>
                    <div className="text-amber-200">{readiness.message} Rediger kunden i salgsterminalen (bruk «Hent fra Brønnøysund») før du sender.</div>
                  </div>
                </div>
              )}

              {sender && !sender.phone && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Telefonnummeret ditt mangler</div>
                    <div>E-posten signeres med navn, e-post og telefon fra brukeren din ({sender.fromEmail}). Be admin legge inn nummeret under Admin → Users, ellers vises kontornummeret.</div>
                  </div>
                </div>
              )}

              {status === 'review-requested' && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
                  Tilbudet ligger hos admin for gjennomgang. Du får e-post når det er verifisert – da kan du sende det herfra.
                </div>
              )}
              {status === 'verified' && (
                <div className="flex items-start gap-3 rounded-xl border border-sky-400/30 bg-sky-900/30 px-4 py-3 text-sm text-sky-300">
                  <ShieldCheck size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Verifisert av admin – klart til å sendes</div>
                    {offer.adminNote && <div className="text-sky-300">Melding fra admin: {offer.adminNote}</div>}
                    <div className="text-sky-300 text-xs mt-1">Innholdet er låst. Forhåndsvis e-posten, godkjenn, og send.</div>
                  </div>
                </div>
              )}
              {status === 'sent' && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-200">
                  <span>Sendt {offer.sentAt ? new Date(offer.sentAt).toLocaleString('nb-NO') : ''} til {offer.sentTo}.</span>
                  <button type="button" onClick={() => void handleNewOffer()} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-xs hover:bg-white/15 disabled:opacity-50">
                    {busy === 'new' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Nytt tilbud
                  </button>
                </div>
              )}

              <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
                <div className="flex flex-col gap-4 min-w-0">
                  <div className="grid md:grid-cols-4 gap-3">
                    <label className="text-xs text-gray-400">
                      Velg nettside tier
                      <select
                        value={offer.tierId || ''}
                        disabled={locked || busy === 'tier'}
                        onChange={(event) => void chooseTier(event.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg bg-[#111] border border-white/15 text-white text-sm disabled:opacity-50"
                      >
                        <option value="">— ikke valgt —</option>
                        {tiers.map((tier) => (
                          <option key={tier.id} value={tier.id}>{tier.name} · {tier.pages} sider · {tier.monthlyExMva} kr{mvaIncluded ? '' : ' eks. mva'}</option>
                        ))}
                        <option value="custom">Skreddersydd (kjøres via admin)</option>
                      </select>
                    </label>
                    <label className="text-xs text-gray-400">
                      Til
                      <input value={to} onChange={(e) => setTo(e.target.value)} disabled={status === 'sent'} className="mt-1 w-full px-3 py-2 rounded-lg bg-[#111] border border-white/15 text-white text-sm disabled:opacity-50" />
                    </label>
                    <label className="text-xs text-gray-400">
                      Emne
                      <input value={subject} onChange={(e) => onSubjectChange(e.target.value)} disabled={locked} className="mt-1 w-full px-3 py-2 rounded-lg bg-[#111] border border-white/15 text-white text-sm disabled:opacity-50" />
                    </label>
                    <label className="text-xs text-gray-400">
                      Preheader
                      <input value={preheader} onChange={(e) => onPreheaderChange(e.target.value)} disabled={locked} className="mt-1 w-full px-3 py-2 rounded-lg bg-[#111] border border-white/15 text-white text-sm disabled:opacity-50" />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button
                      type="button"
                      onClick={() => void handleFill()}
                      disabled={locked || busy === 'fill' || Boolean(fillDisabledReason)}
                      title={fillDisabledReason || 'Bruker møtedata fra Fireflies til å skrive de kundespesifikke delene'}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-sm hover:bg-white/15 disabled:opacity-50"
                    >
                      {busy === 'fill' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      Fyll ut med kundedetaljer
                    </button>
                    {fillDisabledReason && <span className="text-xs text-gray-500 max-w-[360px]">{fillDisabledReason}</span>}
                    {meeting && !fillDisabledReason && (
                      <span className="text-xs text-gray-500">Møte: {meeting.title}{meeting.when ? ` · ${meeting.when}` : ''}</span>
                    )}
                    <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
                      <label
                        className={`inline-flex items-center gap-2 text-xs ${locked ? 'text-gray-500' : 'text-gray-300'}`}
                        title="Standard: mva legges til på toppen av prisen. Slå på for å la oppgitt pris være det kunden betaler inkl. mva (for kunder med lavt budsjett)."
                      >
                        <input
                          type="checkbox"
                          checked={mvaIncluded}
                          disabled={locked || busy === 'mva'}
                          onChange={(e) => void toggleMvaIncluded(e.target.checked)}
                        />
                        Inkluder mva i prisen
                      </label>
                      <label
                        className={`inline-flex items-center gap-2 text-xs ${isCustom || locked ? 'text-gray-500' : 'text-gray-300'}`}
                        title={isCustom ? 'Skreddersydde tilbud må alltid via admin' : 'Valgfritt for tier 1–3: la admin se gjennom tilbudet før du sender'}
                      >
                        <input
                          type="checkbox"
                          checked={reviewChecked}
                          disabled={locked || isCustom || busy === 'review-toggle'}
                          onChange={(e) => void toggleReviewFirst(e.target.checked)}
                        />
                        Kjør via admin først{isCustom ? ' (påkrevd for skreddersydd)' : ''}
                      </label>
                    </div>
                  </div>

                  {placeholders.length > 0 && status !== 'sent' && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
                      <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">{placeholders.length} felt fra malen er ikke fylt ut enda</div>
                        <div className="text-xs mt-1">
                          {placeholders.map((label) => `«${label}»`).join(' · ')}
                        </div>
                        <div className="text-xs mt-1">Fyll ut (AI eller manuelt i editoren), velg tier, eller slett avsnittet. Tilbudet kan ikke sendes med tomme felt.</div>
                      </div>
                    </div>
                  )}

                  <div className="min-h-[620px]">
                    {locked ? (
                      <HtmlPreview html={html} className="min-h-[620px] h-[900px]" />
                    ) : (
                      <EmailVisualEditor html={html} htmlKey={htmlKey} mergeFields={mergeFields} onHtmlChange={onHtmlChange} />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void openContract()}
                      disabled={busy === 'contract' || !offer.contractAvailable}
                      title={offer.contractAvailable ? 'Åpner kontrakten som PDF' : isCustom ? 'Kontrakten for skreddersydd lages av admin ved verifisering' : 'Velg en tier først'}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-sm disabled:opacity-50"
                    >
                      {busy === 'contract' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Se kontrakt (PDF)
                    </button>

                    {status !== 'sent' && (
                      <button
                        type="button"
                        onClick={() => void openPreview()}
                        disabled={busy === 'preview'}
                        title="Viser e-posten slik kunden får den – med navn, priser og signatur fylt inn"
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm disabled:opacity-50 ${showSendButton && !previewApproved && !sendDisabledReason.startsWith('Kundekortet') ? 'bg-white text-black' : 'bg-white/10'}`}
                      >
                        {busy === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                        {previewApproved ? 'Forhåndsvis igjen' : 'Forhåndsvis e-post'}
                      </button>
                    )}

                    {status !== 'sent' && needsReview && status !== 'verified' && (
                      <button
                        type="button"
                        onClick={() => void handleRequestReview()}
                        disabled={busy === 'review' || status === 'review-requested' || !readiness.ready || (!offer.products.length && !isCustom)}
                        title={!readiness.ready ? readiness.message : (!offer.products.length && !isCustom) ? 'Velg en tier eller skreddersydd først' : ''}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-black text-sm font-medium disabled:opacity-50"
                      >
                        {busy === 'review' ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                        {status === 'review-requested' ? 'Sendt til admin' : 'Se gjennom tilbud (admin)'}
                      </button>
                    )}
                    {showSendButton && (
                      <button
                        type="button"
                        onClick={() => void handleSend()}
                        disabled={busy === 'send' || Boolean(sendDisabledReason)}
                        title={sendDisabledReason}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF5B00] text-white text-sm disabled:opacity-50"
                      >
                        {busy === 'send' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Send tilbud + kontrakt
                      </button>
                    )}
                    {sendDisabledReason && showSendButton && (
                      <span className="text-xs text-gray-500 self-center">{sendDisabledReason}</span>
                    )}
                    {!sendDisabledReason && showSendButton && previewApproved && (
                      <span className="text-xs text-emerald-300 self-center">Forhåndsvisning godkjent{offer.previewedAt ? ` ${new Date(offer.previewedAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}` : ''}.</span>
                    )}
                  </div>
                </div>

                <aside className="flex flex-col gap-4">
                  <OfferProductsCard products={offer.products} mvaIncluded={mvaIncluded} />
                  <ContractSummaryCard summary={offer.contract.summary} mvaIncluded={mvaIncluded} />
                  <div className="rounded-xl border border-white/10 bg-[#161616] p-4 text-xs text-gray-300 space-y-1">
                    <div className="font-medium text-white text-sm mb-1">Kontraktdata fra kundekortet</div>
                    <div>Bedrift: <span className="text-white">{client?.businessName || '—'}</span></div>
                    <div>Org. nr: <span className="text-white">{client?.orgNumber || '—'}</span></div>
                    <div>Adresse: <span className="text-white">{client?.businessAddress || client?.meetingPlace || '—'}</span></div>
                    <div>Innehaver: <span className="text-white">{client?.contactPerson || '—'}</span></div>
                    <div>E-post: <span className="text-white">{client?.contactEmail || '—'}</span></div>
                  </div>
                  {sender && (
                    <div className="rounded-xl border border-white/10 bg-[#161616] p-4 text-xs text-gray-300 space-y-1">
                      <div className="font-medium text-white text-sm mb-1">Signatur (fra brukeren din)</div>
                      <div>Navn: <span className="text-white">{sender.fullName || sender.name || '—'}</span></div>
                      <div>E-post: <span className="text-white">{sender.fromEmail || '—'}</span></div>
                      <div>Telefon: <span className={sender.phone ? 'text-white' : 'text-amber-300'}>{sender.phone || 'mangler – kontornummer brukes'}</span></div>
                    </div>
                  )}
                  {offer.history.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-[#161616] p-4 text-xs text-gray-400 space-y-1">
                      <div className="font-medium text-white text-sm mb-1">Historikk</div>
                      {offer.history.slice(-6).reverse().map((entry, index) => (
                        <div key={`${entry.at}-${index}`}>
                          {new Date(entry.at).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })} · {entry.action}{entry.note ? ` · ${entry.note}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </aside>
              </div>
            </>
          )}
        </main>

        {previewState && offer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-[860px] max-h-[94vh] flex flex-col rounded-2xl border border-white/10 bg-[#1f1f1f] shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-base font-semibold">Slik ser e-posten ut for kunden</div>
                  <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                    <div>Til: <span className="text-gray-200">{previewState.preview.to || to || '—'}</span> · Fra: <span className="text-gray-200">{previewState.preview.from}</span></div>
                    <div>Emne: <span className="text-gray-200">{previewState.preview.subject}</span></div>
                    <div className="inline-flex items-center gap-1">
                      <Paperclip size={12} />
                      {previewState.preview.contractAvailable
                        ? <span>Vedlegg: <span className="text-gray-200">{previewState.preview.contractFileName}</span></span>
                        : <span className="text-amber-300">Ingen kontrakt kan lages enda (velg tier, eller få tilbudet verifisert).</span>}
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => setPreviewState(null)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15" aria-label="Lukk">
                  <X size={16} />
                </button>
              </div>

              {(previewState.placeholders.length > 0 || previewState.blocker) && (
                <div className="mx-5 mt-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <div>
                    {previewState.placeholders.length > 0 && (
                      <div>
                        <div className="font-medium">{previewState.placeholders.length} felt fra malen mangler innhold</div>
                        <div className="text-xs mt-0.5">{previewState.placeholders.map((label) => `«${label}»`).join(' · ')}</div>
                      </div>
                    )}
                    {previewState.blocker && previewState.placeholders.length === 0 && <div>{previewState.blocker}</div>}
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0 p-5">
                <HtmlPreview html={previewState.preview.html} className="h-[60vh] min-h-[360px]" />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
                <div className="text-xs text-gray-400">
                  Signatur: {previewState.preview.sender.name} · {previewState.preview.sender.email}{previewState.preview.sender.phone ? ` · ${previewState.preview.sender.phone}` : ' · (telefon mangler)'}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPreviewState(null)} className="px-3 py-2 rounded-lg bg-white/10 text-sm">
                    {locked ? 'Lukk' : 'Rediger videre'}
                  </button>
                  {status !== 'sent' && (
                    <button
                      type="button"
                      onClick={() => void approvePreview()}
                      disabled={busy === 'approve' || previewState.placeholders.length > 0 || Boolean(previewState.blocker) || !readiness.ready}
                      title={!readiness.ready ? readiness.message : previewState.placeholders.length ? 'Fyll ut eller slett feltene fra malen først' : previewState.blocker || 'Bekreft at e-posten er riktig – da kan du sende'}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-black text-sm font-medium disabled:opacity-50"
                    >
                      {busy === 'approve' ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                      Ser riktig ut – klar til sending
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
