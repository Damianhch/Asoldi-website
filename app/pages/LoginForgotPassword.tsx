import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export const LoginForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Noe gikk galt. Prøv igjen senere.');
        return;
      }
      setSuccess(true);
    } catch {
      setError('Noe gikk galt. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <Helmet>
          <title>E-post sendt – Asoldi</title>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
        <section className="min-h-screen bg-[#f3f4f6] grid place-items-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-white border border-[#e5e7eb] p-7 text-center">
            <h1 className="text-2xl font-bold text-[#111827] mb-4">Sjekk e-posten din</h1>
            <p className="text-[#6b7280] mb-6">
              Hvis e-posten finnes i systemet, har du fått en lenke for å tilbakestille passordet. Sjekk også søppelpost.
            </p>
            <Link to="/login" className="text-[#FF5B00] hover:underline">
              ← Tilbake til innlogging
            </Link>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Glemt passord – Asoldi</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <section className="min-h-screen bg-[#f3f4f6] grid place-items-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-[#e5e7eb] p-7">
          <h1 className="text-2xl font-bold text-[#111827] mb-1">Glemt passord?</h1>
          <p className="text-[#6b7280] text-sm mb-8">
            Skriv inn e-posten din (brukernavn) så sender vi deg en lenke for å tilbakestille passordet.
          </p>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="sr-only">E-post</label>
              <input
                id="email"
                type="text"
                autoComplete="username"
                placeholder="E-post (brukernavn)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#d1d5db] text-[#111827] placeholder-[#9ca3af] focus:outline-none focus:border-[#FF5B00]"
                required
              />
            </div>
            {error && <p className="text-red-600 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-semibold text-white bg-[#FF5B00] hover:bg-[#e55200] transition-all disabled:opacity-50"
            >
              {loading ? 'Sender…' : 'Send tilbakestillingslenke'}
            </button>
          </form>
          <Link to="/login" className="mt-6 block text-center text-[#6b7280] hover:text-[#111827] text-sm">
            ← Tilbake til innlogging
          </Link>
        </div>
      </section>
    </>
  );
};
