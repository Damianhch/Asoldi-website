import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2, X } from 'lucide-react';
import { ClientShell } from './ClientShell';
import { getClientToken, requestClientApi } from './auth';

export const ClientWebsiteBuilder = () => {
  const navigate = useNavigate();
  const [businessPrompt, setBusinessPrompt] = useState('');
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [websiteCode, setWebsiteCode] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [error, setError] = useState('');
  const [codeSaved, setCodeSaved] = useState(false);

  useEffect(() => {
    if (!getClientToken()) navigate('/login', { replace: true });
  }, [navigate]);

  async function saveWebsiteCode() {
    const code = websiteCode.trim();
    if (!/^\d{4}$/.test(code)) {
      setError('Koden må være 4 siffer.');
      return;
    }
    setSavingCode(true);
    setError('');
    try {
      await requestClientApi('/api/client-portal/state', {
        method: 'PATCH',
        body: JSON.stringify({ websiteCode: code }),
      });
      setCodeSaved(true);
      setCodeModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre kode.');
    } finally {
      setSavingCode(false);
    }
  }

  async function continueToCheckout() {
    setError('');
    try {
      await requestClientApi('/api/client-portal/state', {
        method: 'PATCH',
        body: JSON.stringify({
          latestBusinessPrompt: businessPrompt.trim(),
        }),
      });
      navigate('/kunde/services/website/checkout');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre før checkout.');
    }
  }

  return (
    <ClientShell
      active="website"
      title="Bygger"
      subtitle="Steg 1 · Sett opp nettside"
    >
      <div className="space-y-6">
        <div className="rounded-3xl border border-[#e5e7eb] bg-gradient-to-br from-[#ffe9dd] via-[#fff4ee] to-[#f8fbff] px-6 md:px-12 py-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 border border-[#f1d0bc] px-4 py-2 text-sm text-[#9a3412] mb-5">
              <span className="w-2 h-2 rounded-full bg-[#ff7a1a]" />
              10+ fornøyde kunder
            </div>
            <h2 className="text-4xl md:text-5xl font-semibold text-[#111827] leading-tight mb-4">
              Lag din egen <span className="text-[#FF5B00]">fantastiske</span> nettside på bare 5 minutter
            </h2>
            <p className="text-[#6b7280] mb-8">
              Få en unik business-klar nettside på få minutter som utpresterer dine konkurrenter på Google Maps og Google-rangering.
            </p>
            <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 flex items-center gap-3">
              <input
                value={businessPrompt}
                onChange={(e) => setBusinessPrompt(e.target.value)}
                placeholder="Fortell oss om din bedrift"
                className="flex-1 bg-transparent text-[#111827] placeholder:text-[#9ca3af] focus:outline-none"
              />
              <button
                type="button"
                onClick={continueToCheckout}
                className="w-10 h-10 rounded-full bg-[#FF5B00] text-white grid place-items-center hover:bg-[#e55200]"
              >
                <ArrowRight size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCodeModalOpen(true)}
              className="mt-5 text-sm text-[#111827] hover:text-[#f97316] underline"
            >
              Har allerede en nettside? klikk her
            </button>
            {codeSaved ? (
              <div className="mt-4 inline-flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                <CheckCircle2 size={14} />
                Nettsidekode lagret
              </div>
            ) : null}
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          </div>
        </div>

        <div className="text-sm text-[#6b7280]">
          <Link to="/kunde" className="hover:underline">← Tilbake til hjem</Link>
        </div>
      </div>

      {codeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 border border-[#e5e7eb] shadow-lg">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-lg font-semibold text-[#111827]">Legg inn nettsidekode</h3>
                <p className="text-sm text-[#6b7280]">Skriv inn 4-sifret kode du fikk fra teamet vårt.</p>
              </div>
              <button type="button" onClick={() => setCodeModalOpen(false)} className="text-[#6b7280] hover:text-[#111827]">
                <X size={18} />
              </button>
            </div>
            <input
              value={websiteCode}
              onChange={(e) => setWebsiteCode(e.target.value)}
              maxLength={4}
              inputMode="numeric"
              className="w-full px-4 py-3 rounded-xl border border-[#d1d5db] text-center text-2xl tracking-[0.35em]"
              placeholder="0000"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setCodeModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#d1d5db] text-[#374151]">
                Avbryt
              </button>
              <button
                type="button"
                onClick={saveWebsiteCode}
                disabled={savingCode}
                className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white disabled:opacity-50 inline-flex items-center gap-2"
              >
                {savingCode ? <Loader2 size={14} className="animate-spin" /> : null}
                Lagre kode
              </button>
            </div>
          </div>
        </div>
      )}
    </ClientShell>
  );
};
