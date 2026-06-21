import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import { ClientRouteGuard } from '../../components/client/ClientRouteGuard';

type FormState = {
  name: string;
  businessName: string;
  businessOrgNumber: string;
  position: string;
  discoveryChannel: string;
};

type BrregBusinessOption = {
  organizationNumber: string;
  name: string;
  address: string;
};

const DISCOVERY_OPTIONS = ['Fra sosiale medier', 'Referanse', 'Telefon salg', 'Annet'] as const;

const QUESTION_STEPS = [
  { key: 'name', title: 'Hva heter du?', placeholder: 'Fornavn og etternavn', type: 'text' },
  { key: 'businessName', title: 'Hva heter bedriften din?', placeholder: 'Bedriftsnavn', type: 'text' },
  { key: 'position', title: 'Hva er stillingen din?', placeholder: 'f.eks. Daglig leder', type: 'text' },
  {
    key: 'discoveryChannel',
    title: 'Hvordan fant du oss?',
    placeholder: 'Velg et alternativ',
    type: 'select',
    options: DISCOVERY_OPTIONS,
  },
] as const;

export const ClientOnboarding = () => {
  const navigate = useNavigate();
  const { profile, token, updateProfileState } = useClientAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [brregResults, setBrregResults] = useState<BrregBusinessOption[]>([]);
  const [brregLoading, setBrregLoading] = useState(false);
  const [brregError, setBrregError] = useState('');
  const [selectedBrreg, setSelectedBrreg] = useState<BrregBusinessOption | null>(null);
  const [form, setForm] = useState<FormState>({
    name: profile?.name || '',
    businessName: profile?.businessName || '',
    businessOrgNumber: profile?.businessOrgNumber || '',
    position: profile?.position || '',
    discoveryChannel: profile?.discoveryChannel || '',
  });

  const current = QUESTION_STEPS[step];
  const progress = useMemo(() => Math.round(((step + 1) / QUESTION_STEPS.length) * 100), [step]);
  const currentValue = form[current.key];
  const canProceed = Boolean(String(currentValue || '').trim());

  function setCurrentValue(value: string) {
    setForm((prev) => {
      if (current.key === 'businessName') {
        return { ...prev, businessName: value, businessOrgNumber: '' };
      }
      return { ...prev, [current.key]: value };
    });
    if (current.key === 'businessName') {
      setSelectedBrreg(null);
      setBrregError('');
    }
  }

  function selectBrregOption(option: BrregBusinessOption) {
    setSelectedBrreg(option);
    setForm((prev) => ({
      ...prev,
      businessName: option.name,
      businessOrgNumber: option.organizationNumber,
    }));
    setBrregResults([]);
    setBrregError('');
  }

  useEffect(() => {
    if (current.key !== 'businessName') return;
    const query = String(form.businessName || '').trim();
    if (query.length < 2) {
      setBrregResults([]);
      setBrregLoading(false);
      setBrregError('');
      return;
    }

    let active = true;
    setBrregLoading(true);
    setBrregError('');
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/client/brreg-search?q=${encodeURIComponent(query)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Kunne ikke hente bedriftsdata fra BRREG.');
        if (!active) return;
        setBrregResults(Array.isArray(data.results) ? data.results : []);
      } catch (err) {
        if (!active) return;
        setBrregResults([]);
        setBrregError(err instanceof Error ? err.message : 'Kunne ikke hente bedriftsdata fra BRREG.');
      } finally {
        if (active) setBrregLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [current.key, form.businessName, token]);

  async function completeOnboarding() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/client/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          businessOrgNumber: form.businessOrgNumber,
          onboardingCompleted: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Kunne ikke lagre onboarding.');
      updateProfileState(data.profile || null);
      navigate('/kunde/hjem', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre onboarding.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ClientRouteGuard>
      <Helmet>
        <title>Onboarding – Kundeportal</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <section className="min-h-screen bg-[#F8F9FB] px-6 py-10 flex items-center">
        <div className="max-w-3xl mx-auto w-full rounded-[28px] border border-[#E6E9EF] bg-white p-8 lg:p-10 shadow-[0_20px_50px_rgba(17,24,39,0.06)]">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-sm text-[#FF5B00] font-medium">Kunde onboarding</p>
              <h1 className="text-2xl font-semibold text-[#111827] mt-1">Før vi starter, noen raske spørsmål</h1>
            </div>
            <span className="text-sm text-[#6B7280]">{step + 1}/{QUESTION_STEPS.length}</span>
          </div>

          <div className="mb-8">
            <div className="h-2 rounded-full bg-[#EEF1F5] overflow-hidden">
              <div className="h-full bg-[#FF5B00]" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] p-6">
            <h2 className="text-xl font-semibold text-[#111827]">{current.title}</h2>
            {current.type === 'select' ? (
              <select
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                className="mt-4 w-full rounded-xl border border-[#DDE2EA] bg-white px-4 py-3 text-[#111827] outline-none focus:border-[#FF5B00]"
                autoFocus
              >
                <option value="" disabled>
                  {current.placeholder}
                </option>
                {current.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  type="text"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  placeholder={current.placeholder}
                  className="mt-4 w-full rounded-xl border border-[#DDE2EA] bg-white px-4 py-3 text-[#111827] outline-none focus:border-[#FF5B00]"
                  autoFocus
                />
                {current.key === 'businessName' ? (
                  <div className="mt-3">
                    <p className="text-xs text-[#6B7280]">
                      Søk i BRREG med bedriftsnavn eller organisasjonsnummer og velg riktig bedrift.
                    </p>
                    {form.businessOrgNumber ? (
                      <p className="mt-1 text-xs text-[#111827]">
                        Valgt org.nr: <strong>{form.businessOrgNumber}</strong>
                      </p>
                    ) : null}
                    {brregLoading ? (
                      <p className="mt-2 text-xs text-[#6B7280]">Søker i BRREG…</p>
                    ) : null}
                    {brregError ? (
                      <p className="mt-2 text-xs text-red-500">{brregError}</p>
                    ) : null}
                    {!brregLoading && brregResults.length > 0 ? (
                      <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-[#E5E7EB] bg-white divide-y divide-[#EEF1F5]">
                        {brregResults.map((option) => (
                          <button
                            key={`${option.organizationNumber}:${option.name}`}
                            type="button"
                            onClick={() => selectBrregOption(option)}
                            className="w-full text-left px-4 py-3 hover:bg-[#F8F9FB]"
                          >
                            <div className="text-sm font-medium text-[#111827]">{option.name}</div>
                            <div className="text-xs text-[#6B7280]">
                              Org.nr {option.organizationNumber}
                              {option.address ? ` · ${option.address}` : ''}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {!brregLoading && !brregError && String(form.businessName || '').trim().length >= 2 && brregResults.length === 0 ? (
                      <p className="mt-2 text-xs text-[#6B7280]">Ingen treff i BRREG for dette søket.</p>
                    ) : null}
                    {selectedBrreg ? (
                      <p className="mt-2 text-xs text-[#059669]">
                        {selectedBrreg.name} er valgt fra BRREG.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>

          {error ? <p className="mt-5 text-sm text-red-500">{error}</p> : null}

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((prev) => Math.max(0, prev - 1))}
              disabled={step === 0 || loading}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50"
            >
              <ArrowLeft size={14} />
              Tilbake
            </button>
            {step < QUESTION_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => Math.min(QUESTION_STEPS.length - 1, prev + 1))}
                disabled={!canProceed || loading}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FF5B00] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#E55200] disabled:opacity-50"
              >
                Neste
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={completeOnboarding}
                disabled={!canProceed || loading}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FF5B00] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#E55200] disabled:opacity-50"
              >
                {loading ? 'Lagrer…' : 'Fullfør onboarding'}
              </button>
            )}
          </div>
        </div>
      </section>
    </ClientRouteGuard>
  );
};
