import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export const ClientForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/client/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Kunne ikke sende lenke.');
      setSuccess(data.message || 'Hvis e-posten finnes, sender vi en lenke.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Tilbakestill passord – Kundeportal</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <section className="min-h-screen bg-[#F8F9FB] px-6 py-12 flex items-center">
        <div className="max-w-lg mx-auto w-full rounded-3xl border border-[#E6E9EF] bg-white p-8 shadow-[0_20px_50px_rgba(17,24,39,0.06)]">
          <h1 className="text-2xl font-semibold text-[#111827]">Glemt passord?</h1>
          <p className="mt-2 text-sm text-[#6B7280]">Vi sender deg en lenke for å velge nytt passord.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs text-[#6B7280]">E-post</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[#111827] outline-none"
                required
              />
            </label>
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#FF5B00] py-3 font-medium text-white hover:bg-[#E55200] disabled:opacity-50">
              {loading ? 'Sender…' : 'Send lenke'}
            </button>
          </form>
          <Link to="/login/kunde" className="mt-6 inline-block text-sm text-[#6B7280] hover:text-[#111827]">← Tilbake</Link>
        </div>
      </section>
    </>
  );
};
