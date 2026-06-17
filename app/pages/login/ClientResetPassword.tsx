import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export const ClientResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('Lenken mangler token.');
      return;
    }
    if (password.length < 8) {
      setError('Passordet må være minst 8 tegn.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passordene er ikke like.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/client/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Kunne ikke oppdatere passord.');
      setSuccess(data.message || 'Passord oppdatert.');
      setTimeout(() => navigate('/login/kunde', { replace: true }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Nytt passord – Kundeportal</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <section className="min-h-screen bg-[#F8F9FB] px-6 py-12 flex items-center">
        <div className="max-w-lg mx-auto w-full rounded-3xl border border-[#E6E9EF] bg-white p-8 shadow-[0_20px_50px_rgba(17,24,39,0.06)]">
          <h1 className="text-2xl font-semibold text-[#111827]">Velg nytt passord</h1>
          <p className="mt-2 text-sm text-[#6B7280]">Skriv inn nytt passord for kundeportalen.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs text-[#6B7280]">Nytt passord</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[#111827] outline-none"
                minLength={8}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs text-[#6B7280]">Bekreft passord</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[#111827] outline-none"
                minLength={8}
                required
              />
            </label>
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#FF5B00] py-3 font-medium text-white hover:bg-[#E55200] disabled:opacity-50">
              {loading ? 'Oppdaterer…' : 'Oppdater passord'}
            </button>
          </form>
          <Link to="/login/kunde" className="mt-6 inline-block text-sm text-[#6B7280] hover:text-[#111827]">← Tilbake</Link>
        </div>
      </section>
    </>
  );
};
