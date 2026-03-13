import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Phone, Star, ArrowRight, CheckCircle2 } from 'lucide-react';
import { SEO } from '../components/SEO';
import { getContactPageSchema } from '../structuredData';

export const Booking = () => {
  const [activeReview, setActiveReview] = useState(0);

  const reviews = [
    { 
      name: "Christopher Vrioni", 
      role: "Superhero Burger AS", 
      text: "Super happy with the website these guys made for us at superhero burger & superhero pizza (superheroinvest.no). They really done a good job... the whole process was smooth from start to finish. The site is clean, easy to use, and does exactly what we need it to. They were quick to respond whenever we had questions and made sure everything worked perfectly.", 
      verified: "Google", 
      rating: 5 
    },
    { 
      name: "Naing Zaw Win", 
      role: "Mong Sushi", 
      text: "Veldig fornøyd, veldig glad.", 
      verified: "Google", 
      rating: 5 
    }
  ];

  const nextReview = () => {
    setActiveReview((prev) => (prev + 1) % reviews.length);
  };

  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('submitting');
    setTimeout(() => setFormStatus('success'), 1500);
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
                      <img src={`https://i.pravatar.cc/100?img=${activeReview + 20}`} alt={reviews[activeReview].name} className="w-full h-full object-cover" />
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
            {formStatus === 'success' ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-6">
                  <CheckCircle2 size={40} />
                </div>
                <h2 className="text-3xl font-bold text-black mb-4">Takk for din henvendelse!</h2>
                <p className="text-black/60 text-lg max-w-md">
                  Vi har mottatt din melding og vil kontakte deg så snart som mulig for å avtale en uforpliktende konsultasjon.
                </p>
                <button 
                  onClick={() => setFormStatus('idle')}
                  className="mt-8 text-[#FF5B00] font-medium hover:underline"
                >
                  Send en ny melding
                </button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-black mb-2">Book en konsultasjon</h2>
                  <p className="text-black/50">Fortell oss litt om din bedrift, så tar vi kontakt.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 flex-grow">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-black/70 ml-1">Navn</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ditt navn"
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all text-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-black/70 ml-1">E-post</label>
                      <input 
                        required
                        type="email" 
                        placeholder="navn@bedrift.no"
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all text-black"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-black/70 ml-1">Tjeneste</label>
                    <select className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all text-black appearance-none">
                      <option>Nettsideutvikling</option>
                      <option>Sosiale Medier Marketing</option>
                      <option>Innholdsproduksjon</option>
                      <option>E-post Markedsføring</option>
                      <option>Annet</option>
                    </select>
                  </div>

                  <div className="space-y-2 flex-grow flex flex-col">
                    <label className="text-sm font-medium text-black/70 ml-1">Melding</label>
                    <textarea 
                      required
                      placeholder="Fortell oss litt om hva du trenger hjelp med..."
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20 focus:border-[#FF5B00] transition-all text-black flex-grow min-h-[120px] resize-none"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={formStatus === 'submitting'}
                    className="w-full py-5 bg-[#FF5B00] text-white font-bold rounded-2xl hover:bg-[#e65200] transition-all shadow-lg shadow-[#FF5B00]/20 flex items-center justify-center gap-3 disabled:opacity-70"
                  >
                    {formStatus === 'submitting' ? (
                      <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Send henvendelse
                        <ArrowRight size={20} />
                      </>
                    )}
                  </button>
                </form>
              </>
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
