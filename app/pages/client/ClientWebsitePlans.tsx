import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { ClientPortalLayout } from '../../components/client/ClientPortalLayout';
import { ClientRouteGuard } from '../../components/client/ClientRouteGuard';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import { CHECKOUT_BENEFITS, CLIENT_WEBSITE_PLANS, type ClientWebsitePlan } from '../../data/clientWebsitePlans';

type PlanResponse = {
  customPlan: {
    title: string;
    subtitle: string;
    monthlyPrice: string;
    highlighted: boolean;
  } | null;
  plans: ClientWebsitePlan[];
};

export const ClientWebsitePlans = () => {
  const navigate = useNavigate();
  const { token, profile, updateProfileState } = useClientAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<PlanResponse | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState(profile?.websiteBuilder?.selectedPlanId || 'tier-1-standard');
  const [selectedPlanType, setSelectedPlanType] = useState(profile?.websiteBuilder?.selectedPlanType || 'standard');
  const [savingSelection, setSavingSelection] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/client/plans/website', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || 'Kunne ikke laste planer.');
        setData(payload as PlanResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kunne ikke laste planer.');
      } finally {
        setLoading(false);
      }
    }
    if (token) void load();
  }, [token]);

  const plans = data?.plans?.length ? data.plans : CLIENT_WEBSITE_PLANS;
  const selectedPlan = useMemo(() => {
    if (selectedPlanType === 'custom') {
      return {
        id: 'custom-website-plan',
        name: data?.customPlan?.title || 'Din nettside plan',
        price: data?.customPlan?.monthlyPrice || 'Etter avtale',
        description: data?.customPlan?.subtitle || 'Skreddersydd forslag tilpasset virksomheten din.',
        features: ['Skreddersydd struktur', 'Tilpasset levering', 'Direkte oppfølging fra teamet'],
      };
    }
    return plans.find((plan) => plan.id === selectedPlanId) || plans[0];
  }, [selectedPlanId, selectedPlanType, data, plans]);

  const planItems = selectedPlan?.features || [];

  async function saveSelection(type: 'custom' | 'standard', planId = '') {
    setSavingSelection(true);
    setError('');
    try {
      const response = await fetch('/api/client/plans/website/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type, planId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Kunne ikke lagre planvalg.');
      if (payload.profile) {
        updateProfileState(payload.profile);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre planvalg.');
    } finally {
      setSavingSelection(false);
    }
  }

  async function chooseCustomPlan() {
    setSelectedPlanType('custom');
    setSelectedPlanId('custom-website-plan');
    await saveSelection('custom');
  }

  async function chooseStandardPlan(planId: string) {
    setSelectedPlanType('standard');
    setSelectedPlanId(planId);
    await saveSelection('standard', planId);
  }

  async function goToCheckout() {
    if (selectedPlanType === 'custom') await saveSelection('custom');
    else await saveSelection('standard', selectedPlanId);
    navigate('/kunde/tjenester/nettside/checkout');
  }

  return (
    <ClientRouteGuard>
      <Helmet>
        <title>Kundeportal – Velg plan</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <ClientPortalLayout title="Bygger > Handlekurv" subtitle="Velg din nettsideplan">
        {loading ? (
          <div className="min-h-[280px] flex items-center justify-center text-[#6B7280]">
            <Loader2 className="animate-spin mr-2" size={18} /> Laster planer…
          </div>
        ) : (
          <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6">
            <div className="space-y-6">
              <div className="rounded-2xl border-2 border-[#FF5B00] bg-[#FFF7F2] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[#FF5B00] uppercase tracking-wider">Anbefalt for deg</p>
                    <h2 className="mt-1 text-2xl font-semibold text-[#111827]">{data?.customPlan?.title || 'Din nettside plan'}</h2>
                    <p className="mt-2 text-sm text-[#6B7280]">{data?.customPlan?.subtitle || 'Skreddersydd løsning basert på din bedrift.'}</p>
                  </div>
                  <span className="rounded-xl bg-white border border-[#FFD6C2] px-3 py-1 text-sm text-[#FF5B00]">{data?.customPlan?.monthlyPrice || 'Etter avtale'}</span>
                </div>
                <button
                  type="button"
                  onClick={chooseCustomPlan}
                  disabled={savingSelection}
                  className={`mt-4 rounded-xl px-4 py-2 text-sm font-medium ${
                    selectedPlanType === 'custom' ? 'bg-[#FF5B00] text-white' : 'bg-white border border-[#FFD2BC] text-[#111827]'
                  }`}
                >
                  {selectedPlanType === 'custom' ? 'Valgt' : 'Velg din plan'}
                </button>
              </div>

              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                <h3 className="text-2xl font-semibold text-[#111827]">Velg din nettside plan</h3>
                <p className="mt-2 text-sm text-[#6B7280]">Produktene under er basert på nettsideplanene i prisoversikten.</p>

                <div className="mt-5 space-y-4">
                  {plans.map((plan) => (
                    <div key={plan.id} className="rounded-xl border border-[#E5E7EB] bg-[#FCFCFD] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-[#111827]">{plan.name}</p>
                          <p className="text-sm text-[#6B7280]">{plan.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-[#111827]">{plan.price}</p>
                          <button
                            type="button"
                            onClick={() => chooseStandardPlan(plan.id)}
                            disabled={savingSelection}
                            className={`mt-2 rounded-full border px-4 py-1.5 text-sm ${
                              selectedPlanType === 'standard' && selectedPlanId === plan.id
                                ? 'bg-[#111827] text-white border-[#111827]'
                                : 'bg-white text-[#111827] border-[#D1D5DB]'
                            }`}
                          >
                            {selectedPlanType === 'standard' && selectedPlanId === plan.id ? 'Valgt' : 'Velg'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                <h4 className="text-2xl font-semibold text-[#111827]">Andre planer</h4>
                <p className="mt-2 text-sm text-[#6B7280]">E-post og sosiale medier låses opp etter at nettsideplan er aktiv.</p>
                <div className="mt-4 grid md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-4 text-sm text-[#9CA3AF]">Tier 2: SEO (låst)</div>
                  <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-4 text-sm text-[#9CA3AF]">Tier 3: Ecommerce (låst)</div>
                </div>
              </div>
            </div>

            <aside className="rounded-2xl border border-[#E5E7EB] bg-white p-5 h-fit">
              <h3 className="text-2xl font-semibold text-[#111827]">{selectedPlan?.name || 'Plan'}</h3>
              <ul className="mt-4 space-y-2">
                {planItems.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[#111827]">
                    <CheckCircle2 size={14} className="text-[#FF5B00] mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 border-t border-[#E5E7EB] pt-4 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><strong>{selectedPlan?.price || '—'}</strong></div>
                <div className="mt-1 flex justify-between"><span>Rabatt</span><strong>0,-</strong></div>
              </div>

              <div className="mt-5 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3 grid grid-cols-3 gap-2">
                {CHECKOUT_BENEFITS.map((benefit) => (
                  <div key={benefit.key} className="text-center">
                    <img src={benefit.illustration} alt={benefit.label} className="mx-auto h-10 w-10 object-contain" />
                    <p className="mt-2 text-[11px] text-[#4B5563] leading-4">{benefit.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2 text-xs text-[#6B7280]">
                <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" /> Jeg har lest produktdetaljene.</label>
                <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" /> Jeg godtar vilkår og personvern.</label>
              </div>

              {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

              <button
                type="button"
                onClick={goToCheckout}
                disabled={savingSelection}
                className="mt-5 w-full rounded-xl border border-[#111827] bg-white py-3 text-sm font-medium text-[#111827] hover:bg-[#F9FAFB] disabled:opacity-50"
              >
                {savingSelection ? 'Lagrer…' : 'Gå til checkout'}
              </button>
            </aside>
          </div>
        )}
      </ClientPortalLayout>
    </ClientRouteGuard>
  );
};
