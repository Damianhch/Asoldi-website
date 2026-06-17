import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export const ClientForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/client-auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || 'Noe gikk galt. Prøv igjen.');
        return;
      }
      setSuccess(true);
    } catch {
      setError('Noe gikk galt. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Glemt passord · Kundeportal</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <section className="min-h-screen bg-[#f3f4f6] grid place-items-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-white border border-[#e5e7eb] p-7">
          <h1 className="text-2xl font-semibold text-[#111827]">Glemt passord</h1>
          <p className="text-sm text-[#6b7280] mt-2 mb-6">
            Vi sender deg en lenke for å opprette nytt passord i kundeportalen.
          </p>

          {success ? (
            <div className="rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3">
              Hvis e-posten finnes i systemet har vi sendt deg en reset-lenke.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="din@epost.no"
                className="w-full px-4 py-3 rounded-xl border border-[#d1d5db]"
              />
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#FF5B00] text-white disabled:opacity-50"
              >
                {loading ? 'Sender…' : 'Send reset-lenke'}
              </button>
            </form>
          )}

          <Link to="/login" className="block mt-5 text-sm text-[#6b7280] hover:text-[#111827]">
            ← Tilbake til innlogging
          </Link>
        </div>
      </section>
    </>
  );
};
