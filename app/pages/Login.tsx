import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Helmet } from 'react-helmet-async';

type View = 'choice' | 'ansatt' | 'kunde';

export const Login = () => {
  const [view, setView] = useState<View>('choice');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Innlogging feilet. Sjekk brukernavn og passord.');
        return;
      }
      if (data.token) localStorage.setItem('employeeToken', data.token);
      window.location.href = '/ansatt';
    } catch {
      setError('Noe gikk galt. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Logg inn – Asoldi</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <section className="min-h-screen pt-28 pb-20 px-6 bg-[#050505]">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {view === 'choice' && (
              <motion.div
                key="choice"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <button
                  type="button"
                  onClick={() => setView('ansatt')}
                  className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-8 text-left hover:border-[#FF5B00]/50 hover:bg-[#1f1f1f] transition-all shadow-lg"
                >
                  <div className="w-14 h-14 rounded-full bg-pink-500/20 flex items-center justify-center mb-6">
                    <User className="w-7 h-7 text-blue-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-2">Er du ansatt?</h2>
                  <p className="text-sm text-gray-400">Klikk her for å logge inn som ansatt</p>
                </button>
                <button
                  type="button"
                  onClick={() => setView('kunde')}
                  className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-8 text-left hover:border-[#FF5B00]/50 hover:bg-[#1f1f1f] transition-all shadow-lg"
                >
                  <div className="w-14 h-14 rounded-full bg-[#FF5B00]/20 flex items-center justify-center mb-6">
                    <Building2 className="w-7 h-7 text-blue-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-2">Er du kunde?</h2>
                  <p className="text-sm text-gray-400">Klikk her for kundeportal</p>
                </button>
              </motion.div>
            )}

            {view === 'kunde' && (
              <motion.div
                key="kunde"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-12 text-center"
              >
                <p className="text-3xl font-semibold text-white mb-2">Kommer snart</p>
                <p className="text-gray-400 mb-8">Kundeportalen er under utvikling.</p>
                <button
                  type="button"
                  onClick={() => setView('choice')}
                  className="text-[#FF5B00] hover:underline"
                >
                  ← Tilbake
                </button>
              </motion.div>
            )}

            {view === 'ansatt' && (
              <motion.div
                key="ansatt"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-8 md:p-12"
              >
                <h1 className="text-2xl font-bold text-white mb-1">Ansatt Login</h1>
                <p className="text-gray-400 text-sm mb-8">Skriv inn dine legitimasjoner</p>
                <form onSubmit={handleEmployeeLogin} className="space-y-6">
                  <div>
                    <label htmlFor="email" className="sr-only">E-post</label>
                    <input
                      id="email"
                      type="text"
                      autoComplete="username"
                      placeholder="E-post"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF5B00]"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="sr-only">Passord</label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Passord"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF5B00]"
                      required
                    />
                  </div>
                  <div className="text-center">
                    <Link to="/login/forgot-password" className="text-sm text-gray-400 hover:text-[#FF5B00] underline">
                      Glemt passord?
                    </Link>
                  </div>
                  {error && (
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-[#FF5B00] to-[#e55200] hover:from-[#ff6b14] hover:to-[#FF5B00] transition-all disabled:opacity-50"
                  >
                    {loading ? 'Logger inn…' : 'Logg inn'}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setView('choice')}
                  className="mt-6 text-gray-400 hover:text-white text-sm"
                >
                  ← Tilbake
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </>
  );
};
