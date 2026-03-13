import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Globe, Share2, ArrowRight, Mail, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';

type PackageType = 'web' | 'social' | 'email' | 'photo';

interface ServicePackage {
  id: PackageType;
  title: string;
  description: string;
  price: string;
  period?: string;
  included: string[];
  icon: React.ReactNode;
  color: string;
}

export const Services = () => {
  const [activePackage, setActivePackage] = useState<PackageType>('web');

  const packages: Record<PackageType, ServicePackage> = {
    web: {
      id: 'web',
      title: "Nettsideutvikling",
      description: "Skreddersydde, høyytelses nettsider designet for å konvertere besøkende til kunder. Vi bygger løsninger som vokser med din bedrift.",
      price: "Fra 9 900,-",
      included: [
        "Skreddersydd UI/UX Design",
        "Responsivt mobil-design",
        "SEO Optimalisering",
        "CMS Integrasjon",
        "Hastighetsoptimalisering",
        "Analyse-oppsett",
        "1 måned support etter lansering"
      ],
      icon: <Globe size={32} />,
      color: "#00E5FF"
    },
    social: {
      id: 'social',
      title: "Sosiale Medier",
      description: "Strategiske kampanjer som bygger merkevare og skaper engasjement. Vi håndterer alt fra innhold til annonsestyring.",
      price: "Fra 4 900,-",
      period: "/mnd",
      included: [
        "Strategi for sosiale medier",
        "Innholdsproduksjon",
        "Community Management",
        "Annonsestyring (FB/IG)",
        "Månedlige rapporter",
        "Konkurrentanalyse",
        "Vekststrategi"
      ],
      icon: <Share2 size={32} />,
      color: "#00C853"
    },
    email: {
      id: 'email',
      title: "Email Markedsføring",
      description: "Øk kundelojalitet og salg gjennom målrettede e-postkampanjer og automatisering som fungerer.",
      price: "Fra 2 900,-",
      period: "/mnd",
      included: [
        "E-post strategi",
        "Design av nyhetsbrev",
        "Automatiseringsoppsett",
        "Segmentering av lister",
        "A/B testing",
        "Månedlig rapportering",
        "GDPR-samsvar"
      ],
      icon: <Mail size={32} />,
      color: "#FF00FF"
    },
    photo: {
      id: 'photo',
      title: "Video/Foto",
      description: "Profesjonelt visuelt innhold som forteller din historie. Vi leverer alt fra produktfoto til reklamefilm.",
      price: "Fra 5 900,-",
      included: [
        "Profesjonell filming",
        "Produktfotografering",
        "Drone-opptak",
        "Profesjonell redigering",
        "Fargekorrigering",
        "Lyddesign",
        "Klar til bruk på SoMe"
      ],
      icon: <Camera size={32} />,
      color: "#FFEA00"
    }
  };

  return (
    <section className="py-32 px-6 md:px-10 bg-[#050505] overflow-hidden">
      <div className="max-w-[1440px] mx-auto">
        
        {/* Toggle Switch */}
        <div className="flex justify-center mb-16 px-4">
          <div className="bg-[#121212] p-1 rounded-full border border-white/10 flex relative w-full max-w-2xl overflow-hidden">
            <motion.div 
              className="absolute top-1 bottom-1 rounded-full"
              style={{ backgroundColor: packages[activePackage].color }}
              initial={false}
              animate={{ 
                x: activePackage === 'web' ? 0 : 
                   activePackage === 'social' ? '100%' : 
                   activePackage === 'email' ? '200%' : '300%', 
                width: '25%' 
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
            <button 
              onClick={() => setActivePackage('web')}
              className={`relative z-10 flex-1 py-3 rounded-full text-[10px] md:text-xs font-medium transition-colors duration-300 ${activePackage === 'web' ? 'text-black' : 'text-gray-400 hover:text-white'}`}
            >
              NETTSIDE
            </button>
            <button 
              onClick={() => setActivePackage('social')}
              className={`relative z-10 flex-1 py-3 rounded-full text-[10px] md:text-xs font-medium transition-colors duration-300 ${activePackage === 'social' ? 'text-black' : 'text-gray-400 hover:text-white'}`}
            >
              SOSIALE MEDIER
            </button>
            <button 
              onClick={() => setActivePackage('email')}
              className={`relative z-10 flex-1 py-3 rounded-full text-[10px] md:text-xs font-medium transition-colors duration-300 ${activePackage === 'email' ? 'text-black' : 'text-gray-400 hover:text-white'}`}
            >
              EMAIL
            </button>
            <button 
              onClick={() => setActivePackage('photo')}
              className={`relative z-10 flex-1 py-3 rounded-full text-[10px] md:text-xs font-medium transition-colors duration-300 ${activePackage === 'photo' ? 'text-black' : 'text-gray-400 hover:text-white'}`}
            >
              VIDEO/FOTO
            </button>
          </div>
        </div>

        {/* Package Summary Card */}
        <div className="flex justify-center">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activePackage}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-5xl bg-[#121212] border border-white/5 rounded-[32px] md:rounded-[40px] overflow-hidden flex flex-col md:flex-row shadow-2xl"
            >
              {/* Left Side: Info & Pricing */}
              <div className="p-8 md:p-16 flex-1 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/5 bg-gradient-to-b from-[#1a1a1a] to-[#121212]">
                <div>
                  <div 
                    className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-black mb-6 md:mb-8 shadow-lg"
                    style={{ backgroundColor: packages[activePackage].color }}
                  >
                    {packages[activePackage].icon}
                  </div>
                  <h3 className="text-3xl md:text-5xl font-medium text-white mb-4 md:mb-6">
                    {packages[activePackage].title}
                  </h3>
                  <p className="text-gray-400 text-base md:text-lg leading-relaxed mb-8 md:mb-10">
                    {packages[activePackage].description}
                  </p>
                </div>
                
                <div>
                  <div className="flex items-baseline gap-2 mb-6 md:mb-8">
                    <span 
                      className="text-4xl md:text-6xl font-medium tracking-tight"
                      style={{ color: packages[activePackage].color }}
                    >
                      {packages[activePackage].price}
                    </span>
                    {packages[activePackage].period && (
                      <span className="text-lg md:text-xl text-gray-500 font-medium">
                        {packages[activePackage].period}
                      </span>
                    )}
                  </div>
                  
                  <Link 
                    to="/booking" 
                    className="w-full bg-white text-black py-3 md:py-4 rounded-full font-medium text-base md:text-lg transition-colors flex items-center justify-center gap-2 group/btn"
                    style={{ 
                      '--hover-bg': packages[activePackage].color 
                    } as React.CSSProperties}
                  >
                    <style dangerouslySetInnerHTML={{ __html: `
                      .group\\/btn:hover { background-color: ${packages[activePackage].color} !important; }
                    `}} />
                    Book konsultasjon
                    <ArrowRight size={20} className="group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Right Side: What's Included */}
              <div className="p-8 md:p-16 flex-1 bg-[#0a0a0a]/30">
                <h4 className="text-lg md:text-xl font-medium text-white mb-6 md:mb-8 flex items-center gap-3">
                  <span className="w-8 h-[1px]" style={{ backgroundColor: packages[activePackage].color }} />
                  Hva er inkludert
                </h4>
                
                <div className="space-y-4 md:space-y-6">
                  {packages[activePackage].included.map((item, index) => (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-4"
                    >
                      <div 
                        className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: `${packages[activePackage].color}20` }}
                      >
                        <Check size={12} style={{ color: packages[activePackage].color }} className="md:w-[14px] md:h-[14px]" strokeWidth={3} />
                      </div>
                      <span className="text-gray-300 text-base md:text-lg">{item}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </section>
  );
};
