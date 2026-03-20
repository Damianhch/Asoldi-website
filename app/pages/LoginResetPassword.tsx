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
        <section className="min-h-screen pt-28 pb-20 px-6 bg-[#050505]">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Ugyldig lenke</h1>
            <p className="text-gray-400 mb-6">
              Lenken for å tilbakestille passord er ugyldig eller utløpt. Be om en ny lenke.
            </p>
            <Link to="/login/forgot-password" className="text-[#FF5B00] hover:underline">
              Be om ny lenke
            </Link>
            <span className="text-gray-500 mx-2">|</span>
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
        <section className="min-h-screen pt-28 pb-20 px-6 bg-[#050505]">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Passord tilbakestilt</h1>
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
      <section className="min-h-screen pt-28 pb-20 px-6 bg-[#050505]">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-white mb-1">Velg nytt passord</h1>
          <p className="text-gray-400 text-sm mb-8">Skriv inn ditt nye passord nedenfor.</p>
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
                className="w-full px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF5B00]"
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
                className="w-full px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF5B00]"
                required
              />
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-[#FF5B00] to-[#e55200] hover:from-[#ff6b14] hover:to-[#FF5B00] transition-all disabled:opacity-50"
            >
              {loading ? 'Oppdaterer…' : 'Tilbakestill passord'}
            </button>
          </form>
          <Link to="/login" className="mt-6 block text-center text-gray-400 hover:text-white text-sm">
            ← Tilbake til innlogging
          </Link>
        </div>
      </section>
    </>
  );
};
