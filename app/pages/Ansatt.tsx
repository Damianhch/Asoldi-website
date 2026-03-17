import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { LogOut } from 'lucide-react';

const CALENDAR_EMBED =
  'https://calendar.google.com/calendar/embed?src=daracha777%40gmail.com&ctz=Europe%2FOslo&mode=WEEK';
const TAWK_SCRIPT_SRC = 'https://embed.tawk.to/69540cdf143421197fdc9ee5/1jdo54im0';

function getEmployeeToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('employeeToken') : null;
}

function clearEmployeeToken() {
  localStorage.removeItem('employeeToken');
}

export const Ansatt = () => {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const t = getEmployeeToken();
    if (!t) {
      navigate('/login', { replace: true });
      return;
    }
    let cancelled = false;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          clearEmployeeToken();
          navigate('/login', { replace: true });
          return;
        }
        if (res.ok) setAllowed(true);
        else setAllowed(false);
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      });
    return () => { cancelled = true; };
  }, [navigate]);

  useEffect(() => {
    if (!allowed) return;
    if (document.getElementById('tawk-script')) return;
    const s1 = document.createElement('script');
    const s0 = document.getElementsByTagName('script')[0];
    s1.id = 'tawk-script';
    s1.async = true;
    s1.src = TAWK_SCRIPT_SRC;
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    if (s0?.parentNode) s0.parentNode.insertBefore(s1, s0);
  }, [allowed]);

  const handleLogout = () => {
    clearEmployeeToken();
    navigate('/login', { replace: true });
  };

  if (allowed === null) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <p className="text-gray-400">Laster…</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Ansatt – Asoldi</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      {/* Checklist widget: fixed bottom left; chat (Tawk) is bottom right by default */}
      <div
        className="checklist-widget"
        style={{
          position: 'fixed',
          bottom: 20,
          left: 20,
          zIndex: 9999,
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <input type="checkbox" id="ansatt-checklist-toggle" className="sr-only" aria-hidden="true" />
        <label
          htmlFor="ansatt-checklist-toggle"
          className="checklist-button cursor-pointer inline-block bg-black text-white py-3 px-4 rounded-full text-sm shadow-lg hover:opacity-90"
        >
          📋 Møte-sjekkliste
        </label>
        <div className="ansatt-checklist-box mt-2 w-80 p-4 bg-white rounded-xl shadow-xl text-sm text-gray-800">
          <h4 className="m-0 mb-3 text-base font-semibold">Husk å skaffe før møtet</h4>
          <ol className="pl-5 m-0 space-y-2 list-decimal">
            <li>Skaff e-post til kunde</li>
            <li>Riktig telefonnummer til kunde</li>
            <li>Navn til møteperson</li>
            <li>Adresse for møtested</li>
            <li>Informer om at vi sender e-post: 1 dag før møtet for å verifisere</li>
          </ol>
        </div>
      </div>

      {/* Tawk chat is injected by script — appears bottom right by default */}

      <div className="min-h-screen bg-[#050505] text-white">
        {/* Simple header */}
        <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between bg-[#0a0a0a]">
          <Link to="/" className="flex items-center gap-2 text-white font-semibold">
            <span className="text-[#FF5B00]">Asoldi</span>
            <span className="text-gray-400">|</span>
            <span>Ansatt</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} /> Logg ut
          </button>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8 pb-24">
          <section className="mb-10">
            <h1 className="text-2xl font-bold text-white mb-2">
              Velkommen som telefonselger hos Asoldi
            </h1>
            <p className="text-gray-400 mb-6">
              Under finner du all informasjon du trenger for å booke møter
            </p>
            <a
              href="https://asoldi.myphoner.com/work"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#FF5B00] text-white font-medium hover:bg-[#e55200] transition-colors"
            >
              Gå til ringesystem
            </a>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-white mb-4">Booking informasjon</h2>
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#1a1a1a]">
              <iframe
                title="Kalender"
                src={CALENDAR_EMBED}
                style={{ border: 0, width: '100%', minHeight: 400 }}
                width="800"
                height="600"
              />
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-3">Gjentagende kunde</h2>
              <p className="text-gray-400 text-sm mb-2">Ofte kategorisert som</p>
              <ul className="list-disc pl-5 text-gray-300 text-sm space-y-1 mb-4">
                <li>En som vil ha en hands off approach</li>
                <li>Bryr seg ikke så mye om bedriftsidentitet</li>
                <li>Trenger nettsiden fort</li>
                <li>Virker likegyldig og vil “bare ha en” nettside</li>
                <li>Ønsker ikke investere mye tid og penger i nettsiden</li>
              </ul>
              <p className="text-gray-400 text-sm">
                Pris mellom: 1 000,- til 2 000,-/måned. Utviklingsperiode: mellom 2–3 uker
              </p>
            </div>
            <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-3">En-gangs kunde</h2>
              <p className="text-gray-400 text-sm mb-2">Ofte kategorisert som</p>
              <ul className="list-disc pl-5 text-gray-300 text-sm space-y-1 mb-4">
                <li>En som vil ha en hands on approach</li>
                <li>Bryr seg mye om bedriftsidentitet</li>
                <li>Trenger ikke nettsiden fort</li>
                <li>Har ideer og virker interessert i å være med på utviklingen</li>
                <li>Ønsker å investere mye tid og penger i nettsiden</li>
              </ul>
              <p className="text-gray-400 text-sm">
                Pris mellom: 8 000,- til 20 000,-. Utviklingsperiode: mellom 3–8 uker
              </p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-white mb-4">Lydklipp</h2>
            <div className="space-y-4">
              <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-4">
                <audio controls className="w-full" style={{ maxWidth: '100%' }}>
                  <source
                    src="https://asoldi.com/wp-content/uploads/2026/03/c95f88c1dc54.wav"
                    type="audio/wav"
                  />
                  <source
                    src="https://asoldi.com/wp-content/uploads/2026/03/c95f88c1dc54.wav"
                    type="audio/mpeg"
                  />
                  Din nettleser støtter ikke lydspiller.
                </audio>
              </div>
              <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-4">
                <audio controls className="w-full" style={{ maxWidth: '100%' }}>
                  <source
                    src="https://asoldi.com/wp-content/uploads/2026/03/2a78bfe865fe.wav"
                    type="audio/wav"
                  />
                  <source
                    src="https://asoldi.com/wp-content/uploads/2026/03/2a78bfe865fe.wav"
                    type="audio/mpeg"
                  />
                  Din nettleser støtter ikke lydspiller.
                </audio>
              </div>
            </div>
          </section>
        </main>
      </div>

      <style>{`
        .ansatt-checklist-box { display: none; }
        #ansatt-checklist-toggle:checked ~ .ansatt-checklist-box { display: block; }
      `}</style>
    </>
  );
};
