import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { SalesCTA } from '../components/SalesCTA';
import { FAQ } from '../components/FAQ';
import { SEO } from '../components/SEO';
import { getAboutPageSchema } from '../structuredData';
import { BUSINESS, SITE_URL } from '../config';

export const AboutUs = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // The container is 1000vh tall to accommodate 5 distinct sections smoothly.
  
  // 1. Image & Velkommen
  const imageOpacity = useTransform(scrollYProgress, [0, 0.1, 0.15], [1, 1, 0]);
  const imageScale = useTransform(scrollYProgress, [0, 0.15], [1, 1.05]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.1, 0.15], [0, 0.8, 1]);
  
  const text1Opacity = useTransform(scrollYProgress, [0, 0.1, 0.15], [1, 1, 0]);
  const text1Y = useTransform(scrollYProgress, [0, 0.1, 0.15], [0, 0, -50]);
  const text1Scale = useTransform(scrollYProgress, [0, 0.1, 0.15], [1, 1, 1.05]);

  // 2. We help businesses grow
  const section2Opacity = useTransform(scrollYProgress, [0.1, 0.15, 0.3, 0.35], [0, 1, 1, 0]);
  const section2Y = useTransform(scrollYProgress, [0.1, 0.15, 0.3, 0.35], [50, 0, 0, -50]);

  // 3. Founded in 2023
  const section3Opacity = useTransform(scrollYProgress, [0.3, 0.35, 0.5, 0.55], [0, 1, 1, 0]);
  const section3Y = useTransform(scrollYProgress, [0.3, 0.35, 0.5, 0.55], [50, 0, 0, -50]);

  // 4. Services blocks & text
  const section4BlocksOpacity = useTransform(scrollYProgress, [0.5, 0.55, 0.95, 1], [0, 1, 1, 0]);
  const section4BlocksY = useTransform(scrollYProgress, [0.5, 0.55, 0.95, 1], [50, 0, 0, -50]);
  
  const section4TextOpacity = useTransform(scrollYProgress, [0.5, 0.55, 0.65, 0.7], [0, 1, 1, 0]);
  const section4TextY = useTransform(scrollYProgress, [0.5, 0.55, 0.65, 0.7], [50, 0, 0, 50]);

  // 5. Lines drawing
  const linesProgress = useTransform(scrollYProgress, [0.65, 0.75], [0, 1]);
  const linesOpacity = useTransform(scrollYProgress, [0.65, 0.7, 0.95, 1], [0, 1, 1, 0]);

  // 6. A more cohesive brand
  const section5Opacity = useTransform(scrollYProgress, [0.75, 0.8, 0.95, 1], [0, 1, 1, 0]);
  const section5Y = useTransform(scrollYProgress, [0.75, 0.8, 0.95, 1], [50, 0, 0, -50]);
  
  const glassHighlight = useTransform(scrollYProgress, [0.75, 0.85], [0, 1]);

  return (
    <div className="bg-[#050505] min-h-screen">
      <SEO
        title={`Om oss – ${BUSINESS.shortName} | Studentdrevet byrå i Trondheim`}
        description="Asoldi er et studentdrevet digitalt byrå i Trondheim. Vi tilbyr premium markedsføringstjenester og hjelper bedrifter med å vokse på nett."
        path="/about"
        structuredData={getAboutPageSchema('Om Asoldi', BUSINESS.description, SITE_URL + '/about')}
      />
      {/* Scroll Sequence Container */}
      <div ref={containerRef} className="h-[1000vh] relative">
        {/* Sticky Container */}
        <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center">
          
          {/* Background Image Container */}
          <motion.div 
            style={{ opacity: imageOpacity, scale: imageScale }}
            className="absolute inset-0 pt-20 pb-2 px-2 md:pt-24 md:pb-4 md:px-4 flex items-center justify-center"
          >
            <div className="w-full h-full rounded-[20px] md:rounded-[40px] overflow-hidden relative">
              <img 
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80" 
                alt="Our Team" 
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>

          {/* Dark Overlay (covers the whole screen eventually) */}
          <motion.div 
            style={{ opacity: overlayOpacity }}
            className="absolute inset-0 bg-[#050505]"
          />

          {/* Text 1: Velkommen til Asoldi */}
          <motion.div 
            style={{ opacity: text1Opacity, y: text1Y, scale: text1Scale }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <h1 className="text-5xl md:text-7xl lg:text-9xl font-medium text-white tracking-tight text-center px-4">
              Dette er Asoldi
            </h1>
          </motion.div>

          {/* Section 2: We help businesses grow */}
          <motion.div 
            style={{ opacity: section2Opacity, y: section2Y }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none px-6 md:px-20"
          >
            <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-20 items-center">
              <div className="rounded-[20px] md:rounded-[40px] overflow-hidden aspect-video md:aspect-[4/5] relative">
                <img 
                  src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&q=80" 
                  alt="Vekst for bedrifter" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center md:text-left">
                <h2 className="text-3xl md:text-6xl lg:text-7xl font-medium text-white mb-4 md:mb-6 tracking-tight leading-[1.1]">
                  Vi hjelper bedrifter å vokse.
                </h2>
                <p className="text-base md:text-xl text-white/60 font-light leading-relaxed">
                  Gjennom strategisk design og moderne teknologi forvandler vi ideer til digitale opplevelser som skaper ekte resultater. Vår tilnærming er rotet i å forstå dine unike utfordringer og skape skreddersydde løsninger som løfter din merkevare.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Section 3: Founded in 2023 */}
          <motion.div 
            style={{ opacity: section3Opacity, y: section3Y }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none px-6 md:px-20"
          >
            <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-20 items-center">
              <div className="order-2 md:order-1 text-center md:text-left">
                <div className="inline-block px-4 py-2 rounded-full border border-white/10 bg-white/5 text-white/80 text-xs md:text-sm font-medium mb-4 md:mb-6">
                  Vår Historie
                </div>
                <h2 className="text-3xl md:text-6xl lg:text-7xl font-medium text-white mb-4 md:mb-6 tracking-tight leading-[1.1]">
                  Studentdrevet innovasjon
                </h2>
                <p className="text-base md:text-xl text-white/60 font-light leading-relaxed">
                  Asoldi startet som en visjon om å tilby premium markedsføringstjenester til en rettferdig pris. Som et studentdrevet byrå i Trondheim, bringer vi med oss en unik energi, oppdatert kunnskap og en brennende lidenskap for å skape vekst for våre kunder.
                </p>
              </div>
              <div className="order-1 md:order-2 relative">
                <div className="aspect-video md:aspect-square relative w-full max-w-md mx-auto">
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#FF5B00]/20 to-transparent rounded-2xl transform translate-x-2 translate-y-2 md:translate-x-4 md:translate-y-4"></div>
                  <img 
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80" 
                    alt="Grunnlegger" 
                    className="w-full h-full object-cover rounded-2xl relative z-10 grayscale hover:grayscale-0 transition-all duration-500"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Section 4, Lines, and Section 5 Container */}
          <motion.div 
            style={{ opacity: section4BlocksOpacity, y: section4BlocksY }}
            className="absolute inset-0 flex flex-col items-center justify-start pt-[10vh] md:pt-[15vh] pointer-events-none px-6"
          >
            {/* 3 Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-6 w-full max-w-5xl relative z-20">
              {['Nettsideutvikling', 'Sosiale Medier', 'Digital Strategi'].map((service, i) => (
                <div key={i} className="bg-[#111] border border-white/10 p-3 md:p-8 rounded-2xl flex flex-col items-center text-center relative">
                  <h3 className="text-base md:text-xl font-medium text-white mb-1 md:mb-2">{service}</h3>
                  <p className="text-xs md:text-sm text-white/50">Digital ekspertise</p>
                </div>
              ))}
            </div>

            {/* Text that fades out early */}
            <motion.div 
              style={{ opacity: section4TextOpacity, y: section4TextY }} 
              className="absolute top-[50vh] md:top-[40vh] text-center max-w-3xl px-6"
            >
              <h2 className="text-2xl md:text-5xl font-medium text-white mb-2 md:mb-4 tracking-tight">
                Våre Kjerntjenester
              </h2>
              <p className="text-sm md:text-lg text-white/60 font-light">
                Vi fokuserer på utvalgte tjenester for å sikre at vi leverer eksepsjonell kvalitet og målbare resultater for hver eneste kunde vi samarbeider med.
              </p>
            </motion.div>

            {/* Lines (Desktop) */}
            <div className="hidden md:block w-full max-w-5xl h-[15vh] relative z-10 -mt-2">
              <svg viewBox="0 0 1024 200" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="line-gradient" x1="0" y1="0" x2="0" y2="200" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="rgba(255,91,0,0.2)" />
                    <stop offset="100%" stopColor="rgba(255,91,0,1)" />
                  </linearGradient>
                </defs>
                <motion.path 
                  d="M 170 0 C 170 100, 512 100, 512 200" 
                  stroke="url(#line-gradient)" 
                  strokeWidth="4" 
                  fill="none" 
                  style={{ pathLength: linesProgress, opacity: linesOpacity }} 
                />
                <motion.path 
                  d="M 512 0 L 512 200" 
                  stroke="url(#line-gradient)" 
                  strokeWidth="4" 
                  fill="none" 
                  style={{ pathLength: linesProgress, opacity: linesOpacity }} 
                />
                <motion.path 
                  d="M 854 0 C 854 100, 512 100, 512 200" 
                  stroke="url(#line-gradient)" 
                  strokeWidth="4" 
                  fill="none" 
                  style={{ pathLength: linesProgress, opacity: linesOpacity }} 
                />
              </svg>
            </div>

            {/* Lines (Mobile) */}
            <div className="md:hidden w-full h-[8vh] relative flex justify-center z-10 -mt-1">
              <svg viewBox="0 0 2 150" className="w-[2px] h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="line-gradient-mobile" x1="0" y1="0" x2="0" y2="150" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="rgba(255,91,0,0.2)" />
                    <stop offset="100%" stopColor="rgba(255,91,0,1)" />
                  </linearGradient>
                </defs>
                <motion.path 
                  d="M 1 0 L 1 150" 
                  stroke="url(#line-gradient-mobile)" 
                  strokeWidth="4" 
                  fill="none" 
                  style={{ pathLength: linesProgress, opacity: linesOpacity }} 
                />
              </svg>
            </div>

            {/* Section 5: A more cohesive brand */}
            <motion.div 
              style={{ opacity: section5Opacity, y: section5Y }}
              className="w-full max-w-4xl relative z-20 -mt-1 md:-mt-2"
            >
              <motion.div 
                style={{ 
                  backgroundColor: useTransform(glassHighlight, [0, 1], ['rgba(255,91,0,0)', 'rgba(255,91,0,0.15)']),
                  borderColor: useTransform(glassHighlight, [0, 1], ['rgba(255,91,0,0)', 'rgba(255,91,0,0.4)']),
                  backdropFilter: useTransform(glassHighlight, [0, 1], ['blur(0px)', 'blur(16px)']),
                  boxShadow: useTransform(glassHighlight, [0, 1], ['0 0 0px rgba(255,91,0,0)', '0 20px 40px rgba(255,91,0,0.2)'])
                }}
                className="text-center p-5 md:p-12 rounded-[24px] md:rounded-[40px] border"
              >
                <h2 className="text-2xl md:text-6xl lg:text-7xl font-medium text-white mb-3 md:mb-6 tracking-tight">
                  En helhetlig merkevare
                </h2>
                <p className="text-sm md:text-2xl text-white/60 font-light leading-relaxed">
                  Vær der kundene dine er. Vi har valgt ut disse tjenestene fordi de danner grunnlaget for en moderne og robust merkevare. Det handler ikke om å selge deg alt, men om å bygge det som faktisk betyr noe for din vekst.
                </p>
              </motion.div>
            </motion.div>
          </motion.div>

        </div>
      </div>

      {/* Logos Section */}
      <section className="py-32 bg-[#050505] relative z-10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-10 mb-20 text-center">
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-medium text-white mb-6 tracking-tight">
            Uttrykk din merkevare
          </h2>
          <p className="text-xl text-white/50 max-w-2xl mx-auto font-light">
            Bli en del av listen over fremtidsrettede bedrifter som har stolt på oss for å løfte sin digitale tilstedeværelse og skape meningsfull vekst.
          </p>
        </div>
        
        {/* Ticker for logos */}
        <div className="opacity-40 grayscale flex w-full">
          <div className="flex animate-marquee gap-16 flex-shrink-0 items-center pr-16">
            {['Svelstad', 'Swich', 'Mong Sushi', 'Superhero Invest', 'Værnes Bar', 'Arman V', 'Asoldi', 'Vekst'].map((name, i) => (
              <div key={`logo-1-${i}`} className="text-4xl md:text-5xl font-bold text-white tracking-tighter uppercase">
                {name}
              </div>
            ))}
          </div>
          <div className="flex animate-marquee gap-16 flex-shrink-0 items-center pr-16" aria-hidden="true">
            {['Svelstad', 'Swich', 'Mong Sushi', 'Superhero Invest', 'Værnes Bar', 'Arman V', 'Asoldi', 'Vekst'].map((name, i) => (
              <div key={`logo-2-${i}`} className="text-4xl md:text-5xl font-bold text-white tracking-tighter uppercase">
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA, FAQ */}
      <div className="relative z-10 bg-[#050505]">
        <SalesCTA />
        <FAQ />
      </div>
    </div>
  );
};
