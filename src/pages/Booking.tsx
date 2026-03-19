import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Phone, Star, ArrowRight, CheckCircle2, ArrowLeft } from 'lucide-react';
import { SEO } from '../components/SEO';
import { getContactPageSchema } from '../structuredData';

export const Booking = () => {
  const [activeReview, setActiveReview] = useState(0);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [wantsCalendly, setWantsCalendly] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    service: 'Nettsideutvikling',
    message: '',
  });

  const reviews = [
    {
      name: 'Christopher Vrioni',
      role: 'Superhero Burger AS',
      image: '/media/christopher.avif',
      text: 'Super happy with the website these guys made for us at superhero burger & superhero pizza (superheroinvest.no). They really done a good job... the whole process was smooth from start to finish. The site is clean, easy to use, and does exactly what we need it to. They were quick to respond whenever we had questions and made sure everything worked perfectly.',
      verified: 'Google',
      rating: 5,
    },
    {
      name: 'Naing Zaw Win',
      role: 'Mong Sushi',
      image: '/media/naing%20zaw%20win.jpg',
      text: 'Veldig fornøyd, veldig glad.',
      verified: 'Google',
      rating: 5,
    },
  ];

  const nextReview = () => setActiveReview((prev) => (prev + 1) % reviews.length);
  const progressPercent = (step / 3) * 100;
  const stepTitle =
    step === 1
      ? 'Steg 1 av 3: Bedriftsinformasjon'
      : step === 2
        ? 'Steg 2 av 3: Book møte nå? (valgfritt)'
        : 'Steg 3 av 3: Bekreftelse';

  const updateField = (field: keyof typeof formData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleFirstStepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

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

      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[10%] left-[-10%] w-[300px] md:w-[550px] h-[300px] md:h-[550px] bg-[#FF5B00] rounded-full blur-[100px] md:blur-[130px] opacity-30" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[300px] md:w-[650px] h-[300px] md:h-[650px] bg-[#FF5B00] rounded-full blur-[100px] md:blur-[130px] opacity-30" />
      </div>

      <div className="flex-grow pt-20 md:pt-24 pb-4 md:pb-6 px-6 md:px-10 max-w-[1600px] mx-auto w-full flex flex-col lg:flex-row gap-4 lg:gap-10 relative z-10 h-full lg:overflow-hidden">
        <div className="w-full lg:w-5/12 flex flex-col flex-none lg:flex-1 lg:h-full lg:overflow-hidden min-h-0">
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

                  <p className="text-white/90 text-sm md:text-lg lg:text-2xl font-light leading-relaxed mb-3 md:mb-6">
                    "{reviews[activeReview].text}"
                  </p>

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

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full lg:w-7/12 flex-none lg:flex-1 min-h-[500px] lg:min-h-0 lg:h-full bg-white rounded-[24px] md:rounded-[40px] shadow-2xl overflow-hidden relative flex flex-col mb-4 lg:mb-0"
        >
          <div className="p-8 md:p-12 h-full flex flex-col">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2 gap-3">
                <h2 className="text-2xl md:text-3xl font-bold text-black">Book en konsultasjon</h2>
                <span className="text-xs md:text-sm text-black/50 text-right">{stepTitle}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#FF5B00] transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            {step === 1 && (
              <form onSubmit={handleFirstStepSubmit} className="space-y-6 flex-grow flex flex-col">
                <p className="text-black/50">Fortell oss litt om bedriften din, så tar vi kontakt.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-black/70 ml-1">Navn</label>
                    <input required type="text" value={formData.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Ditt navn" className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all text-black" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-black/70 ml-1">E-post</label>
                    <input required type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} placeholder="navn@bedrift.no" className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all text-black" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-black/70 ml-1">Bedriftsnavn</label>
                    <input required type="text" value={formData.company} onChange={(e) => updateField('company', e.target.value)} placeholder="Navn på bedrift" className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all text-black" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-black/70 ml-1">Telefonnummer</label>
                    <input required type="tel" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="+47 00 00 00 00" className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all text-black" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-black/70 ml-1">Tjeneste</label>
                  <select value={formData.service} onChange={(e) => updateField('service', e.target.value)} className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all text-black appearance-none">
                    <option>Nettsideutvikling</option>
                    <option>Sosiale Medier Marketing</option>
                    <option>Innholdsproduksjon</option>
                    <option>E-post Markedsføring</option>
                    <option>Annet</option>
                  </select>
                </div>

                <div className="space-y-2 flex-grow flex flex-col">
                  <label className="text-sm font-medium text-black/70 ml-1">Melding</label>
                  <textarea required value={formData.message} onChange={(e) => updateField('message', e.target.value)} placeholder="Fortell oss litt om hva du trenger hjelp med..." className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all text-black flex-grow min-h-[120px] resize-none" />
                </div>

                <button type="submit" className="w-full py-5 bg-[#FF5B00] text-white font-bold rounded-2xl hover:bg-[#e65200] transition-all shadow-lg shadow-[#FF5B00]/20 flex items-center justify-center gap-3">
                  Neste
                  <ArrowRight size={20} />
                </button>
              </form>
            )}

            {step === 2 && (
              <div className="flex-grow flex flex-col min-h-0">
                <p className="text-black/75 text-lg mb-4">Ønsker du å booke møte nå? (valgfritt)</p>
                <div className="flex flex-wrap gap-3 mb-4">
                  <button onClick={() => setWantsCalendly(true)} className={`px-5 py-3 rounded-xl border text-sm font-semibold transition-colors ${wantsCalendly === true ? 'bg-[#FF5B00] text-white border-[#FF5B00]' : 'bg-white text-black border-gray-300 hover:border-[#FF5B00]'}`}>
                    Ja, jeg vil booke nå
                  </button>
                  <button
                    onClick={() => {
                      setWantsCalendly(false);
                      setStep(3);
                    }}
                    className={`px-5 py-3 rounded-xl border text-sm font-semibold transition-colors ${wantsCalendly === false ? 'bg-black text-white border-black' : 'bg-white text-black border-gray-300 hover:border-black'}`}
                  >
                    Nei, kontakt meg senere
                  </button>
                </div>

                {wantsCalendly === true ? (
                  <div className="flex-grow min-h-0 flex flex-col">
                    <div className="rounded-2xl border border-gray-200 overflow-hidden flex-grow min-h-[320px]">
                      <iframe src="https://calendly.com/daracha777/30-min-meeting?hide_gdpr_banner=1" title="Calendly booking" className="w-full h-full min-h-[320px]" />
                    </div>
                    <div className="mt-4 flex gap-3">
                      <button onClick={() => setStep(1)} className="px-5 py-3 rounded-xl border border-gray-300 text-black hover:bg-gray-50 flex items-center gap-2"><ArrowLeft size={16} />Tilbake</button>
                      <button onClick={() => setStep(3)} className="ml-auto px-5 py-3 rounded-xl bg-[#FF5B00] text-white font-semibold hover:bg-[#e65200] flex items-center gap-2">Gå til bekreftelse <ArrowRight size={16} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-auto">
                    <button onClick={() => setStep(1)} className="px-5 py-3 rounded-xl border border-gray-300 text-black hover:bg-gray-50 flex items-center gap-2"><ArrowLeft size={16} />Tilbake</button>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="flex-grow flex flex-col">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-6">
                  <CheckCircle2 size={40} />
                </div>
                {wantsCalendly ? (
                  <>
                    <h3 className="text-3xl font-bold text-black mb-3">Takk for bookingen!</h3>
                    <p className="text-black/65 mb-5">Vi har sendt en bekreftelsesmail til <strong>{formData.email}</strong>.</p>
                    <div className="rounded-2xl border border-gray-200 p-5 mb-5">
                      <h4 className="font-semibold text-black mb-3">Kvittering / Oppsummering</h4>
                      <div className="text-sm text-black/75 space-y-1">
                        <p><strong>Navn:</strong> {formData.name}</p>
                        <p><strong>E-post:</strong> {formData.email}</p>
                        <p><strong>Telefon:</strong> {formData.phone}</p>
                        <p><strong>Bedrift:</strong> {formData.company}</p>
                        <p><strong>Tjeneste:</strong> {formData.service}</p>
                        <p><strong>Melding:</strong> {formData.message}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-3xl font-bold text-black mb-3">Takk for interessen!</h3>
                    <p className="text-black/65 mb-5">Vi vil kontakte deg innen 1-2 bedriftsdager.</p>
                  </>
                )}

                <div className="rounded-2xl bg-gray-50 border border-gray-200 p-5">
                  <h4 className="font-semibold text-black mb-3">Kontaktinfo</h4>
                  <div className="flex flex-col gap-2 text-sm">
                    <a href="mailto:kontakt@asoldi.com" className="text-black/80 hover:text-[#FF5B00]">kontakt@asoldi.com</a>
                    <a href="tel:+4748339191" className="text-black/80 hover:text-[#FF5B00]">+47 48 33 91 91</a>
                  </div>
                </div>

                <div className="mt-auto pt-6 flex gap-3">
                  <button onClick={() => setStep(2)} className="px-5 py-3 rounded-xl border border-gray-300 text-black hover:bg-gray-50 flex items-center gap-2"><ArrowLeft size={16} />Tilbake</button>
                  <button
                    onClick={() => {
                      setStep(1);
                      setWantsCalendly(null);
                      setFormData({
                        name: '',
                        email: '',
                        phone: '',
                        company: '',
                        service: 'Nettsideutvikling',
                        message: '',
                      });
                    }}
                    className="ml-auto px-5 py-3 rounded-xl bg-[#FF5B00] text-white font-semibold hover:bg-[#e65200]"
                  >
                    Send ny henvendelse
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

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

