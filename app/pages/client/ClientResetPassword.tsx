import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export const ClientResetPassword = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Ugyldig eller manglende token.');
      return;
    }
    if (password.length < 8) {
      setError('Passord må være minst 8 tegn.');
      return;
    }
    if (password !== confirm) {
      setError('Passordene må være like.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/client-auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || 'Kunne ikke tilbakestille passord.');
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch {
      setError('Noe gikk galt. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Sett nytt passord · Kundeportal</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <section className="min-h-screen bg-[#f3f4f6] grid place-items-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-white border border-[#e5e7eb] p-7">
          <h1 className="text-2xl font-semibold text-[#111827]">Sett nytt passord</h1>
          <p className="text-sm text-[#6b7280] mt-2 mb-6">
            Velg et nytt passord for kundeportalen din.
          </p>
          {success ? (
            <div className="rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3">
              Passord oppdatert. Du blir sendt tilbake til innlogging.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nytt passord"
                minLength={8}
                required
                className="w-full px-4 py-3 rounded-xl border border-[#d1d5db]"
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Bekreft passord"
                minLength={8}
                required
                className="w-full px-4 py-3 rounded-xl border border-[#d1d5db]"
              />
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#FF5B00] text-white disabled:opacity-50"
              >
                {loading ? 'Lagrer…' : 'Oppdater passord'}
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
