import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ArrowRight, Facebook, Loader2, Lock, Mail, User } from 'lucide-react';
import { useClientAuth } from '../../contexts/ClientAuthContext';

type Stage = 'email' | 'password' | 'signup';

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export const ClientAuth = () => {
  const navigate = useNavigate();
  const { setClientSession } = useClientAuth();
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [providers, setProviders] = useState<{ google: boolean; facebook: boolean }>({ google: false, facebook: false });

  const emailNormalized = useMemo(() => normalizeEmail(email), [email]);
  const hasSocial = providers.google || providers.facebook;

  useEffect(() => {
    let active = true;
    fetch('/api/client/auth/providers')
      .then((r) => r.json())
      .then((data) => {
        if (active) setProviders({ google: Boolean(data?.google), facebook: Boolean(data?.facebook) });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function finalizeSession(data: any) {
    if (!data?.token) throw new Error('Mangler token fra server.');
    await setClientSession(data.token);
    const completed = Boolean(data?.profile?.onboardingCompleted);
    navigate(completed ? '/kunde/hjem' : '/kunde/onboarding', { replace: true });
  }

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!isEmail(email)) {
      setError('Skriv inn en gyldig e-post.');
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const response = await fetch('/api/client/auth/email-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailNormalized }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Kunne ikke sjekke e-post.');
      if (data.exists) {
        setStage('password');
        setInfo('Konto funnet. Skriv inn passord for å fortsette.');
      } else {
        setStage('signup');
        setInfo('Ny e-post oppdaget. Opprett konto for å fortsette.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke sjekke e-post.');
    } finally {
      setLoading(false);
    }
  }

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!password) {
      setError('Skriv inn passord.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/client/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailNormalized, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Innlogging feilet.');
      await finalizeSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Innlogging feilet.');
    } finally {
      setLoading(false);
    }
  }

  async function submitSignup(event: React.FormEvent) {
    event.preventDefault();
    if (!password || password.length < 8) {
      setError('Passord må være minst 8 tegn.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/client/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailNormalized, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Kunne ikke opprette konto.');
      if (name.trim()) {
        await fetch('/api/client/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
          body: JSON.stringify({ name: name.trim(), onboardingCompleted: false }),
        }).catch(() => {});
      }
      await finalizeSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke opprette konto.');
    } finally {
      setLoading(false);
    }
  }

  async function socialSignIn(provider: 'google' | 'facebook') {
    if (provider === 'google') {
      setError('');
      window.location.href = '/api/client/auth/google';
      return;
    }
    if (!isEmail(email)) {
      setError('Skriv inn e-post først for å fortsette med sosial innlogging.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/client/auth/social-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, email: emailNormalized, name: name.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Sosial innlogging feilet.');
      await finalizeSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sosial innlogging feilet.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Kundeinnlogging – Asoldi</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <section className="min-h-screen bg-[#F8F9FB] px-6 py-10 flex items-center">
        <div className="w-full max-w-[1140px] mx-auto grid lg:grid-cols-[1.1fr_1fr] rounded-[28px] overflow-hidden border border-[#E6E9EF] bg-white shadow-[0_20px_50px_rgba(17,24,39,0.06)]">
          <div className="p-10 lg:p-12 bg-gradient-to-br from-[#FFF3EC] via-[#FFF8F5] to-white border-b lg:border-b-0 lg:border-r border-[#F1DACC]">
            <img src="/media/client-flow/login-hero.svg" alt="Kundeportal illustrasjon" className="w-full rounded-2xl border border-[#F5D8C8]" />
            <h1 className="mt-6 text-3xl font-semibold text-[#111827]">Velkommen tilbake</h1>
            <p className="mt-3 text-sm text-[#6B7280]">
              Logg inn for å se to-do liste, planstatus og fremdrift for dine tjenester.
            </p>
            <div className="mt-6 space-y-2 text-sm text-[#4B5563]">
              <p>• Håndter nettsideplan og checkout</p>
              <p>• Følg oppgaver og fremdrift i sanntid</p>
              <p>• Kommuniser med teamet i kundeportalen</p>
            </div>
            <Link to="/login" className="mt-7 inline-flex items-center gap-2 text-sm text-[#374151] hover:text-[#111827]">
              <ArrowLeft size={14} />
              Tilbake til rollevalg
            </Link>
          </div>

          <div className="p-10 lg:p-12">
            <p className="text-sm font-medium text-[#FF5B00]">Kundeportal</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#111827]">
              {stage === 'email' ? 'Start med e-post' : stage === 'password' ? 'Logg inn' : 'Opprett konto'}
            </h2>
            <p className="mt-2 text-sm text-[#6B7280]">
              {stage === 'email'
                ? 'Skriv inn e-postadressen din for å finne kontoen din.'
                : stage === 'password'
                  ? 'Vi fant kontoen din. Skriv inn passord.'
                  : 'Opprett ny konto med passord eller sosial innlogging.'}
            </p>

            {hasSocial && (
              <>
                <div className="mt-6 space-y-3">
                  {providers.google && (
                    <button
                      type="button"
                      onClick={() => socialSignIn('google')}
                      disabled={loading}
                      className="w-full rounded-xl border border-[#D7DCE5] bg-white px-4 py-3 text-sm font-medium text-[#111827] hover:bg-[#F9FAFB] disabled:opacity-50 inline-flex justify-center items-center gap-3"
                    >
                      <GoogleLogo size={18} />
                      Fortsett med Google
                    </button>
                  )}
                  {providers.facebook && (
                    <button
                      type="button"
                      onClick={() => socialSignIn('facebook')}
                      disabled={loading}
                      className="w-full rounded-xl border border-[#D7DCE5] bg-white px-4 py-3 text-sm font-medium text-[#111827] hover:bg-[#F9FAFB] disabled:opacity-50 inline-flex justify-center items-center gap-2"
                    >
                      <Facebook size={16} />
                      Fortsett med Facebook
                    </button>
                  )}
                </div>

                <div className="my-6 flex items-center gap-3 text-xs text-[#9CA3AF]">
                  <div className="h-px flex-1 bg-[#E5E7EB]" />
                  <span>ELLER</span>
                  <div className="h-px flex-1 bg-[#E5E7EB]" />
                </div>
              </>
            )}

            {stage === 'email' && (
              <form onSubmit={submitEmail} className="space-y-4">
                <label className="block">
                  <span className="text-xs text-[#6B7280]">E-post</span>
                  <span className="mt-1 flex items-center rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-3">
                    <Mail size={16} className="text-[#9CA3AF]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="ml-2 w-full bg-transparent outline-none text-[#111827]"
                      placeholder="hei@bedrift.no"
                      required
                    />
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#FF5B00] py-3 font-medium text-white hover:bg-[#E55200] disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  Neste
                </button>
              </form>
            )}

            {stage === 'password' && (
              <form onSubmit={submitPassword} className="space-y-4">
                <label className="block">
                  <span className="text-xs text-[#6B7280]">E-post</span>
                  <input value={emailNormalized} disabled className="mt-1 w-full rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-4 py-3 text-[#6B7280]" />
                </label>
                <label className="block">
                  <span className="text-xs text-[#6B7280]">Passord</span>
                  <span className="mt-1 flex items-center rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-3">
                    <Lock size={16} className="text-[#9CA3AF]" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="ml-2 w-full bg-transparent outline-none text-[#111827]"
                      placeholder="********"
                      required
                    />
                  </span>
                </label>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => { setStage('email'); setPassword(''); }} className="text-[#6B7280] hover:text-[#111827]">
                    Endre e-post
                  </button>
                  <Link to={`/login/kunde/forgot-password?email=${encodeURIComponent(emailNormalized)}`} className="text-[#6B7280] hover:text-[#111827] underline">
                    Glemt passord?
                  </Link>
                </div>
                <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#FF5B00] py-3 font-medium text-white hover:bg-[#E55200] disabled:opacity-50">
                  {loading ? 'Logger inn…' : 'Logg inn'}
                </button>
              </form>
            )}

            {stage === 'signup' && (
              <form onSubmit={submitSignup} className="space-y-4">
                <label className="block">
                  <span className="text-xs text-[#6B7280]">E-post</span>
                  <input value={emailNormalized} disabled className="mt-1 w-full rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-4 py-3 text-[#6B7280]" />
                </label>
                <label className="block">
                  <span className="text-xs text-[#6B7280]">Navn (valgfritt)</span>
                  <span className="mt-1 flex items-center rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-3">
                    <User size={16} className="text-[#9CA3AF]" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="ml-2 w-full bg-transparent outline-none text-[#111827]"
                      placeholder="Fornavn Etternavn"
                    />
                  </span>
                </label>
                <label className="block">
                  <span className="text-xs text-[#6B7280]">Opprett passord</span>
                  <span className="mt-1 flex items-center rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-3">
                    <Lock size={16} className="text-[#9CA3AF]" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="ml-2 w-full bg-transparent outline-none text-[#111827]"
                      placeholder="Minst 8 tegn"
                      required
                    />
                  </span>
                </label>
                <div className="text-sm">
                  <button type="button" onClick={() => { setStage('password'); setPassword(''); }} className="text-[#6B7280] hover:text-[#111827]">
                    Har du allerede konto?
                  </button>
                </div>
                <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#FF5B00] py-3 font-medium text-white hover:bg-[#E55200] disabled:opacity-50">
                  {loading ? 'Oppretter konto…' : 'Opprett konto'}
                </button>
              </form>
            )}

            {info ? <p className="mt-4 text-sm text-[#4B5563]">{info}</p> : null}
            {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}
          </div>
        </div>
      </section>
    </>
  );
};
