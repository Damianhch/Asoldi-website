import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';
import { ClientRouteGuard } from '../../components/client/ClientRouteGuard';
import { ClientPortalLayout } from '../../components/client/ClientPortalLayout';
import { useClientAuth } from '../../contexts/ClientAuthContext';

type OfferDocument = {
  id: string;
  planName: string;
  price: string;
  letterHtml: string;
  contractHtml: string;
  accepted: boolean;
  acceptedAt: string;
};

export const ClientOfferReview = () => {
  const navigate = useNavigate();
  const { token } = useClientAuth();
  const scroller = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offer, setOffer] = useState<OfferDocument | null>(null);
  const [atBottom, setAtBottom] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/client/offer', { headers: { Authorization: `Bearer ${token}` } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || 'Kunne ikke laste tilbudet.');
        setOffer((payload.offer as OfferDocument) || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kunne ikke laste tilbudet.');
      } finally {
        setLoading(false);
      }
    }
    if (token) void load();
  }, [token]);

  function syncBottom() {
    const node = scroller.current;
    if (!node) return;
    const reached = node.scrollTop + node.clientHeight >= node.scrollHeight - 24;
    setAtBottom(reached || node.scrollHeight <= node.clientHeight + 8);
  }

  useEffect(() => {
    syncBottom();
  }, [offer]);

  async function accept() {
    if (!offer || offer.accepted || !atBottom) return;
    setAccepting(true);
    setError('');
    try {
      const response = await fetch('/api/client/offer/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          platform: navigator.platform,
          screen: { width: window.screen.width, height: window.screen.height },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Kunne ikke lagre aksepten.');
      navigate('/kunde/hjem', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre aksepten.');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <ClientRouteGuard>
      <Helmet>
        <title>Tilbud – Kundeportal</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <ClientPortalLayout>
        {loading ? (
          <div className="min-h-[280px] flex items-center justify-center text-[#6B7280]">
            <Loader2 className="animate-spin mr-2" size={18} /> Laster tilbudet…
          </div>
        ) : error && !offer ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-600 text-sm">{error}</div>
        ) : !offer ? (
          <div className="rounded-2xl border border-[#E7E9EE] bg-white px-5 py-8 text-sm text-[#6B7280]">
            Det ligger ingen tilbud på denne kontoen.
          </div>
        ) : (
          <div className="mx-auto max-w-[760px]">
            <p className="text-sm text-[#FF5B00] font-medium">Tilbud</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#111827]">{offer.planName || 'Tilbud fra Asoldi'}</h1>
            <p className="mt-2 text-sm text-[#6B7280]">
              Les gjennom tilbudet og kontrakten. Knappen nederst blir tilgjengelig når du har kommet til bunnen.
            </p>
            <div
              ref={scroller}
              onScroll={syncBottom}
              className="mt-5 max-h-[70vh] overflow-y-auto rounded-2xl border border-[#E7E9EE] bg-white"
            >
              <article className="px-6 py-6 text-sm leading-relaxed text-[#111827] [&_a]:text-[#FF5B00]">
                {offer.letterHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: offer.letterHtml }} />
                ) : (
                  <p>{offer.planName} · {offer.price}</p>
                )}
              </article>
              <article className="border-t border-[#E7E9EE] px-6 py-6 text-sm leading-relaxed text-[#1F2937] [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5">
                {offer.contractHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: offer.contractHtml }} />
                ) : (
                  <p>Kontraktteksten følger med når tilbudet er sendt til kontoen din.</p>
                )}
              </article>
              <div className="border-t border-[#E7E9EE] bg-[#FAFBFC] px-6 py-5">
                {offer.accepted ? (
                  <p className="text-sm text-emerald-700">
                    Avtalen er akseptert {offer.acceptedAt ? new Date(offer.acceptedAt).toLocaleString('nb-NO') : ''}.
                  </p>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={!atBottom || accepting || !offer.contractHtml}
                      onClick={() => void accept()}
                      className="w-full rounded-xl bg-[#FF5B00] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      {accepting ? 'Lagrer…' : 'Jeg aksepterer avtalen'}
                    </button>
                    {!atBottom ? (
                      <p className="mt-2 text-center text-xs text-[#9CA3AF]">Bla til bunnen av kontrakten for å akseptere.</p>
                    ) : null}
                  </>
                )}
                {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
              </div>
            </div>
          </div>
        )}
      </ClientPortalLayout>
    </ClientRouteGuard>
  );
};
