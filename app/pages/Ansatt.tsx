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
    return () => {
      // Remove chat when leaving /ansatt so it never appears on public pages.
      const script = document.getElementById('tawk-script');
      script?.parentNode?.removeChild(script);
      // Common Tawk containers/iframes.
      document.querySelectorAll('iframe[src*="tawk.to"]').forEach((el) => el.parentNode?.removeChild(el));
      const container = document.getElementById('tawkchat-container');
      container?.parentNode?.removeChild(container);
      const root = document.getElementById('tawkchat');
      root?.parentNode?.removeChild(root);
      // Best-effort cleanup of globals.
      try {
        // @ts-expect-error - best-effort global cleanup
        delete window.Tawk_API;
        // @ts-expect-error - best-effort global cleanup
        delete window.Tawk_LoadStart;
      } catch {
        // ignore
      }
    };
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
          className="checklist-button cursor-pointer inline-block bg-white text-black py-3 px-4 rounded-full text-sm shadow-lg hover:bg-gray-100 border border-black/10"
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
                  <source src="/media/lydklipp%201.wav" type="audio/wav" />
                  Din nettleser støtter ikke lydspiller.
                </audio>
              </div>
              <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-4">
                <audio controls className="w-full" style={{ maxWidth: '100%' }}>
                  <source src="/media/lydklipp%202.wav" type="audio/wav" />
                  Din nettleser støtter ikke lydspiller.
                </audio>
              </div>
              <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-4">
                <audio controls className="w-full" style={{ maxWidth: '100%' }}>
                  <source src="/media/lydklipp%203.wav" type="audio/wav" />
                  Din nettleser støtter ikke lydspiller.
                </audio>
              </div>
              <div className="rounded-xl bg-[#1a1a1a] border border-white/10 p-4">
                <audio controls className="w-full" style={{ maxWidth: '100%' }}>
                  <source src="/media/lydklipp%204.wav" type="audio/wav" />
                  Din nettleser støtter ikke lydspiller.
                </audio>
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-white mb-4">Nettside tjenester</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  title: 'Nettside utvikling',
                  body: 'Lager selve nettsiden med ønskede tjenester og tillegg, raskt, gunstig pris, og fantastisk kvalitet.',
                },
                {
                  title: 'Nettside hosting',
                  body: 'Holder nettsiden online, viktig for de med Ecommerce behov samt avlaster ansvaret for de bedriftene som har lyst på en mer “hands of” opplevelse',
                },
                {
                  title: 'Opprettholdelse',
                  body: 'Oppdateringer, bilde-oppdateringer, og andre lav investerende endringer i nettsiden inngår i dette. Hvis dette og hosting er noe kunden har lyst på.',
                },
                {
                  title: 'Nettside migrasjon',
                  body: 'Vi overfører en gammel eller ny nettside til en valgfri hosting tjeneste for kunden, samt kan skifte domene hvis ønskelig.',
                },
                {
                  title: 'Nettside redesign',
                  body: 'Har bedriften en nettside fra før av kan vi redesigne den med nye funksjoner i allerede eksisterende CMS (WordPress, Shopify, Wix etc).',
                },
                {
                  title: 'Copywriting',
                  body: 'Dette er teksten som står på nettsiden: optimalisert til å få kunden til å kjøpe, samt Google til å ranke – all tekst er intensjonell og forteller en historie.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-xl bg-[#1a1a1a] border border-white/10 p-6">
                  <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-4">Nettside utviklings tjenester</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  title: 'SEO/google maps ranking',
                  body: 'En av de største fordelene med å ha en nettside er å ranke høyt på Google/Google Maps. For de som vil ha mer organisk trafikk fra spesifikke søkeord som “restaurant i Trondheim”, “frisørsalong i Trondheim” etc.',
                },
                {
                  title: 'Nettside analystikk',
                  body: 'Lar bedriften se hvor lenge hver kunde er på nettsiden, view count og generell statistikk – viktig for de med høye besøkstall og generelt alle.',
                },
                {
                  title: 'Email markedsføring',
                  body: 'Funksjon som lar bedriften se og sende meldinger til folk sine e-poster og er høyt verdsatt av nettbutikker.',
                },
                {
                  title: 'Ecommerce',
                  body: 'Lar bedriften selge ting på nettsiden, og lar kundene lage kontoer (samle inn info). Passer bra med email marketing.',
                },
                {
                  title: 'Multi-språklig',
                  body: 'Lar nettsiden være på flere språk enn bare 1 – perfekt for bedrifter som har flerspråklige kunder og vil appellere til flere.',
                },
                {
                  title: 'Blog integrering',
                  body: 'Lar kunden skrive blogginnlegg som automatisk blir posted til nettsiden – øker SEO og Google Maps ranking, samt forsterker posisjon i markedet.',
                },
                {
                  title: 'Booking og kontakt skjema',
                  body: 'Lar kunden sende en melding eller bestille. Et billigere alternativ til ecommerce – for de som “bare vil ha en simpel nettside”.',
                },
                {
                  title: 'Business info sync',
                  body: 'Lar reviews, åpningstider, samt sosiale medier vises i sanntid i nettsiden. Øker konvertering og social proof.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-xl bg-[#1a1a1a] border border-white/10 p-6">
                  <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Partnere og resultater</h2>
            <div className="space-y-6">
              <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Superhero burger og pizza</h3>
                    <p className="text-gray-400 text-sm">Restaurant</p>
                  </div>
                  <img
                    src="https://asoldi.com/wp-content/uploads/2025/12/logo.webp"
                    alt="Superhero burger og pizza"
                    className="h-12 w-auto opacity-90"
                    loading="lazy"
                  />
                </div>
                <div className="mt-5">
                  <p className="text-white font-semibold mb-3">Resultater:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-black/20 border border-white/10 p-4">
                      <p className="text-white font-medium">Lagde en simpel nettside</p>
                      <p className="text-gray-400 text-sm">SEO/maps ranking, synced SoMe posts</p>
                    </div>
                    <div className="rounded-xl bg-black/20 border border-white/10 p-4">
                      <p className="text-white font-medium">Analystikk</p>
                      <p className="text-gray-400 text-sm">Vi kan se over 10 000 nye månedlige besøkende og når de bouncer</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">S'wich restaurant</h3>
                    <p className="text-gray-400 text-sm">Restaurant</p>
                  </div>
                  <img
                    src="https://asoldi.com/wp-content/uploads/2025/12/images.png"
                    alt="S'wich restaurant"
                    className="h-12 w-auto opacity-90"
                    loading="lazy"
                  />
                </div>
                <div className="mt-5">
                  <p className="text-white font-semibold mb-3">Resultater:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-black/20 border border-white/10 p-4">
                      <p className="text-white font-medium">Lagde en simpel nettside</p>
                      <p className="text-gray-400 text-sm">SEO/maps ranking, synced reviews/SoMe posts</p>
                    </div>
                    <div className="rounded-xl bg-black/20 border border-white/10 p-4">
                      <p className="text-white font-medium">Google maps ranking</p>
                      <p className="text-gray-400 text-sm">Gikk fra nr 10 til nr 6 på ranking for “restaurant” i Trondheim</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Svelstad gård</h3>
                    <p className="text-gray-400 text-sm">Gård</p>
                  </div>
                  <img
                    src="https://asoldi.com/wp-content/uploads/2025/12/Uten-navn-1000-x-500-px3.png"
                    alt="Svelstad gård"
                    className="h-16 w-auto rounded-lg opacity-90"
                    loading="lazy"
                  />
                </div>
                <div className="mt-5">
                  <p className="text-white font-semibold mb-3">Resultater:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-black/20 border border-white/10 p-4">
                      <p className="text-white font-medium">Lagde en simpel nettside</p>
                      <p className="text-gray-400 text-sm">Branded med 1 Kontakt skjema</p>
                    </div>
                    <div className="rounded-xl bg-black/20 border border-white/10 p-4">
                      <p className="text-white font-medium">Kontakt skjema</p>
                      <p className="text-gray-400 text-sm">10 nye bestillinger gjennom kontakt skjema, og 400 nye besøkende første uka</p>
                    </div>
                  </div>
                </div>
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
