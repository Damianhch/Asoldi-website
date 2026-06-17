import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, X } from 'lucide-react';
import { ClientPortalLayout } from '../../components/client/ClientPortalLayout';
import { ClientRouteGuard } from '../../components/client/ClientRouteGuard';
import { useClientAuth } from '../../contexts/ClientAuthContext';

export const ClientWebsiteStart = () => {
  const navigate = useNavigate();
  const { token, profile, updateProfileState } = useClientAuth();
  const [businessPrompt, setBusinessPrompt] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [code, setCode] = useState(profile?.websiteBuilder?.existingWebsiteCode || '');
  const [savingCode, setSavingCode] = useState(false);
  const [error, setError] = useState('');

  async function saveExistingCode() {
    setSavingCode(true);
    setError('');
    try {
      const response = await fetch('/api/client/website/existing-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Kunne ikke lagre kode.');
      updateProfileState(data.profile || null);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre kode.');
    } finally {
      setSavingCode(false);
    }
  }

  return (
    <ClientRouteGuard>
      <Helmet>
        <title>Kundeportal – Sett opp nettside</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <ClientPortalLayout title="Bygger" subtitle="Steg 1: Sett opp nettside">
        <div className="rounded-2xl border border-[#E5E7EB] bg-gradient-to-br from-[#FFF4EC] via-[#FFF8F5] to-white p-8 md:p-12 min-h-[520px] flex flex-col items-center justify-center text-center">
          <span className="inline-flex items-center rounded-full border border-[#FFD6C2] bg-white px-4 py-1.5 text-xs text-[#FF5B00]">
            10+ fornøyde kunder
          </span>
          <h1 className="mt-7 text-4xl md:text-5xl font-semibold leading-tight text-[#111827] max-w-3xl">
            Lag din egen <span className="text-[#FF5B00]">fantastiske</span> nettside på bare 5 minutter
          </h1>
          <p className="mt-4 max-w-2xl text-[#6B7280]">
            Få en unik business-klar nettside som gjør deg synlig på Google og klar for vekst.
          </p>

          <div className="mt-8 w-full max-w-2xl rounded-2xl border border-[#E5E7EB] bg-white p-3 flex items-center gap-3">
            <input
              value={businessPrompt}
              onChange={(e) => setBusinessPrompt(e.target.value)}
              placeholder="Fortell oss om din bedrift"
              className="flex-1 bg-transparent px-3 py-2 text-[#111827] outline-none"
            />
            <button
              type="button"
              onClick={() => navigate('/kunde/tjenester/nettside/planer')}
              className="rounded-full bg-[#FF5B00] p-2 text-white hover:bg-[#E55200]"
              aria-label="Fortsett"
            >
              <ArrowRight size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-6 text-sm text-[#6B7280] hover:text-[#111827]"
          >
            Har allerede en nettside? <span className="font-semibold underline">Klikk her</span>
          </button>

          {profile?.websiteBuilder?.existingWebsiteCode ? (
            <p className="mt-3 text-xs text-[#4B5563]">Lagrert nettsidekode: {profile.websiteBuilder.existingWebsiteCode}</p>
          ) : null}
        </div>

        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[#111827]">Legg inn nettsidekode</h3>
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-1 text-[#6B7280] hover:bg-[#F3F4F6]">
                  <X size={16} />
                </button>
              </div>
              <p className="mt-2 text-sm text-[#6B7280]">Skriv inn den 4-sifrede koden du har fått.</p>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D+/g, '').slice(0, 4))}
                inputMode="numeric"
                className="mt-4 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[#111827] tracking-[0.35em] text-center text-2xl outline-none"
                placeholder="0000"
              />
              {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm text-[#374151]">
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={saveExistingCode}
                  disabled={savingCode || code.length !== 4}
                  className="rounded-xl bg-[#FF5B00] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {savingCode ? 'Lagrer…' : 'Lagre kode'}
                </button>
              </div>
            </div>
          </div>
        )}
      </ClientPortalLayout>
    </ClientRouteGuard>
  );
};
