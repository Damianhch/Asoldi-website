import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Phone, Star, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { SEO } from '../components/SEO';
import { getContactPageSchema } from '../structuredData';

const ASOLDI_EMAIL = 'kontakt@asoldi.com';
const ASOLDI_PHONE = '+4748339191';

// TODO: Add your real Calendly inline event URL here.
const CALENDLY_URL = 'https://calendly.com/daracha777/30-min-meeting';

type BookingStep = 0 | 1 | 2 | 3;

export const Booking = () => {
  const [activeReview, setActiveReview] = useState(0);

  const reviews = [
    { 
      name: "Christopher Vrioni", 
      role: "Superhero Burger AS", 
      image: "/media/christopher.avif",
      text: "Super happy with the website these guys made for us at superhero burger & superhero pizza (superheroinvest.no). They really done a good job... the whole process was smooth from start to finish. The site is clean, easy to use, and does exactly what we need it to. They were quick to respond whenever we had questions and made sure everything worked perfectly.", 
      verified: "Google", 
      rating: 5 
    },
    { 
      name: "Naing Zaw Win", 
      role: "Mong Sushi", 
      image: "/media/naing%20zaw%20win.jpg",
      text: "Veldig fornøyd, veldig glad.", 
      verified: "Google", 
      rating: 5 
    }
  ];

  const nextReview = () => {
    setActiveReview((prev) => (prev + 1) % reviews.length);
  };

  const [step, setStep] = useState<BookingStep>(0);
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const [bedriftNavn, setBedriftNavn] = useState('');
  const [telefon, setTelefon] = useState('');

  const [bookingMode, setBookingMode] = useState<'none' | 'booked'>('none');
  const [clientEmail, setClientEmail] = useState<string | null>(null);

  const resetFlow = () => {
    setStep(0);
    setBedriftNavn('');
    setTelefon('');
    setBookingMode('none');
    setClientEmail(null);
  };

  // Listen for Calendly "event scheduled" when we are on step 1.
  useEffect(() => {
    if (!CALENDLY_URL || CALENDLY_URL.includes('PASTE_')) return;

    const handler = (e: MessageEvent) => {
      const data = e.data as any;
      if (data?.event !== 'calendly.event_scheduled') return;
      if (stepRef.current !== 1) return;

      const invitee = data?.payload?.invitee || {};
      const email = invitee?.email || data?.payload?.email || null;
      setBookingMode('booked');
      setClientEmail(email);
      setStep(3);
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Load Calendly widget JS when step 1 is visible.
  useEffect(() => {
    if (step !== 1) return;
    if (!CALENDLY_URL || CALENDLY_URL.includes('PASTE_')) return;

    const scriptId = 'calendly-widgetjs';
    if (document.getElementById(scriptId)) return;

    const s = document.createElement('script');
    s.id = scriptId;
    s.async = true;
    s.src = 'https://assets.calendly.com/assets/external/widget.js';
    document.body.appendChild(s);
  }, [step]);

  const progressIndex = step === 0 ? 0 : step === 1 ? 1 : 2;

  return (
    <div className="bg-[#050505] min-h-[100dvh] lg:h-[100dvh] w-full overflow-x-hidden overflow-y-auto hide-scrollbar lg:overflow-hidden flex flex-col relative">
      <SEO
        title="Book konsultasjon – Asoldi | Gratis rådgivning"
        description="Book en gratis konsultasjon med Asoldi. Vi hjelper bedrifter i Trondheim med nettsider, sosiale medier og markedsføring."
        path="/booking"
        structuredData={getContactPageSchema()}
      />
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Background glowing balls */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[10%] left-[-10%] w-[300px] md:w-[550px] h-[300px] md:h-[550px] bg-[#FF5B00] rounded-full blur-[100px] md:blur-[130px] opacity-30" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[300px] md:w-[650px] h-[300px] md:h-[650px] bg-[#FF5B00] rounded-full blur-[100px] md:blur-[130px] opacity-30" />
      </div>

      {/* Main content area - pt-24 accounts for navbar */}
      <div className="flex-grow pt-20 md:pt-24 pb-4 md:pb-6 px-6 md:px-10 max-w-[1600px] mx-auto w-full flex flex-col lg:flex-row gap-4 lg:gap-10 relative z-10 h-full lg:overflow-hidden">
        
        {/* Left Column (Text, Contact Card, Reviews) */}
        <div className="w-full lg:w-5/12 flex flex-col flex-none lg:flex-1 lg:h-full lg:overflow-hidden min-h-0">
          
          {/* Header Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-2 md:mb-4 flex-shrink-0"
          >
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-medium text-white mb-2 md:mb-4 tracking-tight">
              La oss bygge<br />noe stort sammen.
            </h1>
          </motion.div>

          {/* Reviews Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex-grow flex flex-col min-h-[220px] md:min-h-[240px] lg:min-h-0 relative mt-0"
          >
            <div className="flex justify-between items-end mb-3 md:mb-4 flex-shrink-0">
              <h3 className="text-sm md:text-base font-medium text-white/40 uppercase tracking-wider">Hva våre kunder sier</h3>
              <button 
                onClick={nextReview}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-colors flex-shrink-0 group"
                aria-label="Neste anmeldelse"
              >
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            
            <div className="relative flex-grow">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeReview}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex flex-col justify-start pt-2 pb-4"
                >
                  {/* Stars & Verified */}
                  <div className="flex items-center gap-4 mb-3 md:mb-4">
                    <div className="flex gap-1">
                      {[...Array(reviews[activeReview].rating)].map((_, i) => (
                        <Star key={i} size={16} className="fill-[#FF5B00] text-[#FF5B00]" />
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs md:text-sm text-white/40">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      Verifisert via {reviews[activeReview].verified}
                    </div>
                  </div>

                  {/* Quote */}
                  <p className="text-white/90 text-sm md:text-lg lg:text-2xl font-light leading-relaxed mb-3 md:mb-6">
                    "{reviews[activeReview].text}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-3 md:gap-4 pb-2">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-600 overflow-hidden flex-shrink-0">
                      <img src={reviews[activeReview].image} alt={reviews[activeReview].name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="text-white font-medium text-sm md:text-base">{reviews[activeReview].name}</div>
                      <div className="text-[#FF5B00] text-xs md:text-sm">{reviews[activeReview].role}</div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Contact Info (Desktop) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="hidden lg:flex flex-shrink-0 flex-row gap-6 md:gap-8 pt-4 md:pt-6 mt-2 border-t border-white/10"
          >
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-[#FF5B00]/20 rounded-full flex items-center justify-center text-[#FF5B00] flex-shrink-0">
                <Mail size={18} className="md:w-5 md:h-5" />
              </div>
              <div>
                <div className="text-xs md:text-sm text-white/50 mb-0.5 md:mb-1">E-post</div>
                <a href="mailto:kontakt@asoldi.com" className="text-sm md:text-base text-white font-medium hover:text-[#FF5B00] transition-colors">kontakt@asoldi.com</a>
              </div>
            </div>
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-[#FF5B00]/20 rounded-full flex items-center justify-center text-[#FF5B00] flex-shrink-0">
                <Phone size={18} className="md:w-5 md:h-5" />
              </div>
              <div>
                <div className="text-xs md:text-sm text-white/50 mb-0.5 md:mb-1">Ring oss</div>
                <a href="tel:+4748339191" className="text-sm md:text-base text-white font-medium hover:text-[#FF5B00] transition-colors">+47 48 33 91 91</a>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column (Contact Form) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full lg:w-7/12 flex-none lg:flex-1 min-h-[500px] lg:min-h-0 lg:h-full bg-white rounded-[24px] md:rounded-[40px] shadow-2xl overflow-hidden relative flex flex-col mb-4 lg:mb-0"
        >
          <div className="p-8 md:p-12 h-full flex flex-col">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-3xl font-bold text-black">Book en konsultasjon</h2>
                <div className="text-black/50 text-sm">
                  {step === 0 ? 'Bedriftsinfo' : step === 1 ? 'Booking (valgfritt)' : 'Bekreftelse'}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex-1">
                    <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progressIndex >= i ? 'bg-[#FF5B00]' : 'bg-black/10'}`}
                        style={{ width: progressIndex >= i ? '100%' : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {step === 0 && (
              <form
                className="space-y-6 flex-grow flex flex-col"
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep(1);
                }}
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-black/70 ml-1">Bedriftsnavn</label>
                  <input
                    required
                    type="text"
                    value={bedriftNavn}
                    onChange={(e) => setBedriftNavn(e.target.value)}
                    placeholder="F.eks. Superhero Burger AS"
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all text-black"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-black/70 ml-1">Telefon nummer</label>
                  <input
                    required
                    type="tel"
                    value={telefon}
                    onChange={(e) => setTelefon(e.target.value)}
                    placeholder="+47 123 45 678"
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all text-black"
                  />
                </div>

                <div className="flex-grow" />

                <button
                  type="submit"
                  className="w-full py-5 bg-[#FF5B00] text-white font-bold rounded-2xl hover:bg-[#e65200] transition-all shadow-lg shadow-[#FF5B00]/20 flex items-center justify-center gap-3"
                >
                  Fortsett
                  <ArrowRight size={20} />
                </button>
              </form>
            )}

            {step === 1 && (
              <div className="flex-grow flex flex-col space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-black">Book møte (valgfritt)</h3>
                  <p className="text-black/50">
                    Du kan booke direkte i Calendly. Hvis du ikke ønsker å booke nå, trykk “Fortsett uten booking”.
                  </p>
                </div>

                {CALENDLY_URL.includes('PASTE_') ? (
                  <div className="bg-black/5 border border-black/10 rounded-2xl p-5 text-black/70">
                    Sett riktig Calendly URL i `src/pages/Booking.tsx` under <code>CALENDLY_URL</code>.
                  </div>
                ) : (
                  <div className="flex-grow rounded-2xl overflow-hidden border border-black/10 bg-white">
                    <div className="w-full h-full">
                      <div
                        className="calendly-inline-widget"
                        data-url={CALENDLY_URL}
                        style={{ minWidth: '320px', height: 640 }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep(0)}
                    className="flex-1 py-5 bg-black/5 text-black font-bold rounded-2xl hover:bg-black/10 transition-all"
                    type="button"
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <ArrowLeft size={18} />
                      Tilbake
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setBookingMode('none');
                      setStep(2);
                    }}
                    className="flex-1 py-5 bg-black text-white font-bold rounded-2xl hover:bg-black/90 transition-all"
                    type="button"
                  >
                    Fortsett uten booking
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="flex-grow flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-6">
                  <CheckCircle2 size={40} />
                </div>
                <h2 className="text-3xl font-bold text-black mb-4">Takk for at du viser interesse</h2>
                <p className="text-black/60 text-lg max-w-md">
                  Vi vil kontakte deg innen <span className="font-semibold text-black/80">1-2 bedriftsdager</span>.
                </p>

                <div className="mt-8 w-full max-w-md bg-black/5 border border-black/10 rounded-2xl p-5 text-left">
                  <div className="font-bold text-black mb-3">Kontaktinfo</div>
                  <div className="flex items-center gap-3 mb-2">
                    <Mail size={18} className="text-[#FF5B00]" />
                    <a href={`mailto:${ASOLDI_EMAIL}`} className="text-black/80 hover:underline">
                      {ASOLDI_EMAIL}
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone size={18} className="text-[#FF5B00]" />
                    <a href={`tel:${ASOLDI_PHONE}`} className="text-black/80 hover:underline">
                      +47 48 33 91 91
                    </a>
                  </div>
                </div>

                <button onClick={resetFlow} className="mt-8 text-[#FF5B00] font-medium hover:underline" type="button">
                  Send ny forespørsel
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="flex-grow flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-[#FF5B00]/15 rounded-full flex items-center justify-center text-[#FF5B00] mb-6">
                  <CheckCircle2 size={40} />
                </div>
                <h2 className="text-3xl font-bold text-black mb-4">Du er booket!</h2>
                <p className="text-black/60 text-lg max-w-md">
                  Vi har sendt en bekreftelses e-post til <span className="font-semibold text-black/80">{clientEmail || 'client email'}</span>.
                </p>

                <div className="mt-8 w-full max-w-md bg-black/5 border border-black/10 rounded-2xl p-5 text-left">
                  <div className="font-bold text-black mb-3">Kvitteringsoppsummering</div>
                  <div className="space-y-2 text-black/80">
                    <div className="flex justify-between gap-4">
                      <span>Bedriftsnavn</span>
                      <span className="font-semibold text-black/90">{bedriftNavn || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Telefon</span>
                      <span className="font-semibold text-black/90">{telefon || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Client email</span>
                      <span className="font-semibold text-black/90">{clientEmail || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 w-full max-w-md bg-white border border-black/10 rounded-2xl p-5 text-left">
                  <div className="font-bold text-black mb-3">Kontaktinfo</div>
                  <div className="flex items-center gap-3 mb-2">
                    <Mail size={18} className="text-[#FF5B00]" />
                    <a href={`mailto:${ASOLDI_EMAIL}`} className="text-black/80 hover:underline">
                      {ASOLDI_EMAIL}
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone size={18} className="text-[#FF5B00]" />
                    <a href={`tel:${ASOLDI_PHONE}`} className="text-black/80 hover:underline">
                      +47 48 33 91 91
                    </a>
                  </div>
                </div>

                <button onClick={resetFlow} className="mt-8 text-[#FF5B00] font-medium hover:underline" type="button">
                  Send ny forespørsel
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Contact Info (Mobile) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex lg:hidden flex-shrink-0 flex-row flex-wrap gap-4 md:gap-6 pt-4 border-t border-white/10 pb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FF5B00]/20 rounded-full flex items-center justify-center text-[#FF5B00] flex-shrink-0">
              <Mail size={18} />
            </div>
            <div>
              <div className="text-xs text-white/50 mb-0.5">E-post</div>
              <a href="mailto:kontakt@asoldi.com" className="text-sm text-white font-medium hover:text-[#FF5B00] transition-colors">kontakt@asoldi.com</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FF5B00]/20 rounded-full flex items-center justify-center text-[#FF5B00] flex-shrink-0">
              <Phone size={18} />
            </div>
            <div>
              <div className="text-xs text-white/50 mb-0.5">Ring oss</div>
              <a href="tel:+4748339191" className="text-sm text-white font-medium hover:text-[#FF5B00] transition-colors">+47 48 33 91 91</a>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
};
