import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { REFERRAL_REWARD_LABEL, REFERRAL_SERVICES } from '../../../lib/client-referral.js';
import { useClientAuth } from '../../contexts/ClientAuthContext';

type Props = {
  open: boolean;
  onClose: () => void;
};

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  businessNumber: '',
  service: REFERRAL_SERVICES[0],
};

export function ClientReferralModal({ open, onClose }: Props) {
  const { token } = useClientAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setError('');
    setSent(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function update(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/client/referrals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Kunne ikke sende vervingen.');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke sende vervingen.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="referral-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="referral-title" className="text-lg font-semibold text-[#111827]">Verv og tjen {REFERRAL_REWARD_LABEL}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-[#6B7280] hover:bg-[#F3F4F6]" aria-label="Lukk">
            <X size={16} />
          </button>
        </div>

        {sent ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-[#374151]">Takk. Vervingen er sendt.</p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-medium text-white"
            >
              Lukk
            </button>
          </div>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-3">
            <p className="text-sm leading-relaxed text-[#4B5563]">
              Send oss en melding med kontaktinformasjonen ved å fylle ut dette skjemaet. Blir personen kunde, får profilkortet ditt {REFERRAL_REWARD_LABEL} utbetalt til bankkontoen vi har på hånden.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block text-[#374151]">Navn</span>
              <input
                required
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 outline-none focus:border-[#FF5B00]"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[#374151]">E-post</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => update('email', event.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 outline-none focus:border-[#FF5B00]"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[#374151]">Telefon</span>
              <input
                required
                type="tel"
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 outline-none focus:border-[#FF5B00]"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[#374151]">Organisasjonsnummer</span>
              <input
                required
                inputMode="numeric"
                value={form.businessNumber}
                onChange={(event) => update('businessNumber', event.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 outline-none focus:border-[#FF5B00]"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[#374151]">Tjeneste</span>
              <select
                value={form.service}
                onChange={(event) => update('service', event.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 outline-none focus:border-[#FF5B00]"
              >
                {REFERRAL_SERVICES.map((service) => (
                  <option key={service}>{service}</option>
                ))}
              </select>
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={sending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF5B00] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#E55200] disabled:opacity-60"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : null}
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
