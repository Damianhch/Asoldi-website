import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export const LoginResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) setError('Manglende eller ugyldig lenke.');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) return;
    if (password.length < 8) {
      setError('Passordet må være minst 8 tegn');
      return;
    }
    if (password !== confirm) {
      setError('Passordene stemmer ikke overens');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Noe gikk galt.');
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch {
      setError('Noe gikk galt. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <>
        <Helmet>
          <title>Ugyldig lenke – Asoldi</title>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
        <section className="min-h-screen bg-[#f3f4f6] grid place-items-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-white border border-[#e5e7eb] p-7 text-center">
            <h1 className="text-2xl font-bold text-[#111827] mb-4">Ugyldig lenke</h1>
            <p className="text-[#6b7280] mb-6">
              Lenken for å tilbakestille passord er ugyldig eller utløpt. Be om en ny lenke.
            </p>
            <Link to="/login/forgot-password" className="text-[#FF5B00] hover:underline">
              Be om ny lenke
            </Link>
            <span className="text-[#9ca3af] mx-2">|</span>
            <Link to="/login" className="text-[#FF5B00] hover:underline">
              Tilbake til innlogging
            </Link>
          </div>
        </section>
      </>
    );
  }

  if (success) {
    return (
      <>
        <Helmet>
          <title>Passord tilbakestilt – Asoldi</title>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
        <section className="min-h-screen bg-[#f3f4f6] grid place-items-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-white border border-[#e5e7eb] p-7 text-center">
            <h1 className="text-2xl font-bold text-[#111827] mb-4">Passord tilbakestilt</h1>
            <p className="text-emerald-400 mb-6">
              Passordet ditt er oppdatert. Du blir omdirigert til innlogging...
            </p>
            <Link to="/login" className="text-[#FF5B00] hover:underline">
              Gå til innlogging nå
            </Link>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Velg nytt passord – Asoldi</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <section className="min-h-screen bg-[#f3f4f6] grid place-items-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-[#e5e7eb] p-7">
          <h1 className="text-2xl font-bold text-[#111827] mb-1">Velg nytt passord</h1>
          <p className="text-[#6b7280] text-sm mb-8">Skriv inn ditt nye passord nedenfor.</p>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="sr-only">Nytt passord</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Nytt passord (min. 8 tegn)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#d1d5db] text-[#111827] placeholder-[#9ca3af] focus:outline-none focus:border-[#FF5B00]"
                required
                minLength={8}
              />
            </div>
            <div>
              <label htmlFor="confirm" className="sr-only">Bekreft passord</label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Bekreft passord"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              {loading ? 'Oppdaterer…' : 'Tilbakestill passord'}
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
