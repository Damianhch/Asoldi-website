import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';
import { ClientRouteGuard } from '../../components/client/ClientRouteGuard';
import { ClientPortalLayout } from '../../components/client/ClientPortalLayout';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import { CHECKOUT_BENEFITS, CLIENT_WEBSITE_PLANS } from '../../data/clientWebsitePlans';

type PaymentMethod = 'faktura' | 'vipps' | 'kort';

function formatPrice(value: unknown) {
  if (typeof value === 'number') return `${value},-/mnd`;
  const text = String(value || '').trim();
  return text || 'Etter avtale';
}

function formatPlanFromProfile(profile: any) {
  if (!profile) return null;
  const type = profile?.websiteBuilder?.selectedPlanType;
  if (type === 'custom') {
    return {
      name: profile?.customWebsitePlan?.title || 'Din nettside plan',
      price: formatPrice(profile?.customWebsitePlan?.monthlyPrice),
      features: ['Skreddersydd struktur', 'Tilpasset levering', 'Direkte oppfølging'],
    };
  }
  const selectedId = String(profile?.websiteBuilder?.selectedPlanId || '');
  const found = CLIENT_WEBSITE_PLANS.find((plan) => plan.id === selectedId) || CLIENT_WEBSITE_PLANS[0];
  return {
    name: found.name,
    price: found.price,
    features: found.features,
  };
}

export const ClientWebsiteCheckout = () => {
  const { token, profile, updateProfileState } = useClientAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('kort');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [saveCard, setSaveCard] = useState(true);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    async function refreshProfile() {
      if (!token) return;
      try {
        const response = await fetch('/api/client/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.profile) {
          updateProfileState(data.profile);
        }
      } catch {
        // Ignore refresh errors.
      }
    }
    void refreshProfile();
  }, [token, updateProfileState]);

  const selectedPlan = useMemo(() => formatPlanFromProfile(profile), [profile]);

  async function completePayment(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!selectedPlan) {
      setError('Ingen plan valgt. Gå tilbake og velg plan først.');
      return;
    }
    if (method === 'kort') {
      if (!cardName || cardNumber.replace(/\s+/g, '').length < 12 || !expiry || !cvc) {
        setError('Fyll ut kortdetaljer for å fortsette.');
        return;
      }
    }
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setLoading(false);
    setPaid(true);
  }

  return (
    <ClientRouteGuard>
      <Helmet>
        <title>Kundeportal – Checkout</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <ClientPortalLayout title="Bygger > Handlekurv > Checkout" subtitle="Betaling">
        {paid ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <h2 className="text-2xl font-semibold text-emerald-700">Betaling registrert</h2>
            <p className="mt-2 text-sm text-emerald-700/90">Tusen takk! Teamet vårt starter oppsettet av nettsiden din nå.</p>
          </div>
        ) : (
          <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6">
            <form onSubmit={completePayment} className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
              <h2 className="text-4xl font-semibold text-[#111827]">Betalingsmåte</h2>
              <div className="mt-6 space-y-4">
                <PaymentOption
                  checked={method === 'faktura'}
                  onClick={() => setMethod('faktura')}
                  label="Faktura"
                  badge="Faktura"
                />
                <PaymentOption
                  checked={method === 'vipps'}
                  onClick={() => setMethod('vipps')}
                  label="Vipps"
                  badge="Vipps"
                />
                <PaymentOption
                  checked={method === 'kort'}
                  onClick={() => setMethod('kort')}
                  label="Kortbetaling"
                  badge="Visa / Mastercard / AmEx"
                />
              </div>

              {method === 'kort' && (
                <div className="mt-6 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-4 space-y-3">
                  <label className="block">
                    <span className="text-xs text-[#6B7280]">Navn på kort</span>
                    <input
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#DDE2EA] bg-white px-3 py-2 outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-[#6B7280]">Kortnummer</span>
                    <input
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#DDE2EA] bg-white px-3 py-2 outline-none"
                      placeholder="0000 0000 0000 0000"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs text-[#6B7280]">Utløpsdato</span>
                      <input
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#DDE2EA] bg-white px-3 py-2 outline-none"
                        placeholder="MM/ÅÅ"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-[#6B7280]">CVC</span>
                      <input
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#DDE2EA] bg-white px-3 py-2 outline-none"
                        placeholder="000"
                      />
                    </label>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-[#4B5563]">
                    <input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)} />
                    Lagre dette kortet til neste gang
                  </label>
                </div>
              )}

              {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full rounded-xl bg-[#FF5B00] py-3 text-white font-medium hover:bg-[#E55200] disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Betaler…</span>
                ) : (
                  'Betal'
                )}
              </button>
            </form>

            <aside className="rounded-2xl border border-[#E5E7EB] bg-white p-5 h-fit">
              <h3 className="text-3xl font-semibold text-[#111827]">{selectedPlan?.name || 'Plan ikke valgt'}</h3>
              <ul className="mt-4 space-y-2 text-sm text-[#111827]">
                {(selectedPlan?.features || []).map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <div className="mt-6 border-t border-[#E5E7EB] pt-4 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <strong>{selectedPlan?.price || '—'}</strong>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Rabatt</span>
                  <strong>0,-</strong>
                </div>
              </div>
              <div className="mt-5 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3 grid grid-cols-3 gap-2">
                {CHECKOUT_BENEFITS.map((benefit) => (
                  <div key={benefit.key} className="text-center">
                    <img src={benefit.illustration} alt={benefit.label} className="mx-auto h-10 w-10 object-contain" />
                    <p className="mt-2 text-[11px] text-[#4B5563] leading-4">{benefit.label}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}
      </ClientPortalLayout>
    </ClientRouteGuard>
  );
};

function PaymentOption({
  checked,
  onClick,
  label,
  badge,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
  badge: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3 flex items-center justify-between text-left ${
        checked ? 'border-[#FF5B00] bg-[#FFF7F2]' : 'border-[#E5E7EB] bg-white'
      }`}
    >
      <span className="inline-flex items-center gap-2">
        <span className={`h-4 w-4 rounded-full border ${checked ? 'border-[#FF5B00] bg-[#FF5B00]' : 'border-[#D1D5DB]'}`} />
        <span className="text-sm font-medium text-[#111827]">{label}</span>
      </span>
      <span className="text-xs text-[#6B7280]">{badge}</span>
    </button>
  );
}
