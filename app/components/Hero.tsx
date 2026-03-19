import React from 'react';
import { motion } from 'motion/react';
import { Star } from 'lucide-react';
import { Button } from './Button';

export const Hero = () => {
  const services = [
    "Nettsideutvikling",
    "Sosiale Medier",
    "Email markedsføring",
    "Innholdsproduksjon"
  ];

  return (
    <section id="Home" className="relative pt-20 pb-10 md:pt-32 md:pb-20 px-6 md:px-10 overflow-hidden bg-[#050505] min-h-[100dvh] lg:min-h-0 flex flex-col justify-center">
      {/* Decorative Line SVG */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <svg width="100%" height="100%" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute top-0 left-0 w-full h-full opacity-30">
          <path d="M-100 700 C 200 600, 400 650, 600 400 C 800 150, 1200 100, 1350 50 L 1320 80 M 1350 50 L 1300 40" stroke="#FF5B00" strokeWidth="1" fill="none" />
        </svg>
      </div>

      <div className="max-w-[1440px] mx-auto relative z-10 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-12 items-center">
          
          {/* Left Column - Text & Services (no CTA on mobile) */}
          <div className="lg:col-span-5 flex flex-col justify-center items-center text-center md:items-start md:text-left">
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl xl:text-[100px] leading-[0.9] font-medium tracking-tight mb-6 md:mb-12 text-[#FF5B00]"
            >
              Vi er din ekspert på <span className="font-serif italic font-normal block text-white">digital vekst</span>
            </motion.h1>
            
            <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-3 max-w-md justify-center md:justify-start mb-4 md:mb-10">
              {services.map((service, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 + (index * 0.1) }}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 md:px-6 md:py-3 rounded-full border border-[#FF5B00]/20 bg-[#1a1a1a] text-xs sm:text-sm md:text-base text-white hover:bg-[#FF5B00] hover:text-white transition-colors cursor-default"
                >
                  {service}
                </motion.div>
              ))}
            </div>

            {/* CTA - desktop only (mobile CTA is under image) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="hidden lg:flex w-full justify-center md:justify-start"
            >
              <Button text="Book konsultasjon" href="/booking" className="bg-[#FF5B00] text-white hover:bg-white hover:text-black" />
            </motion.div>
          </div>

          {/* Middle Column - Image */}
          <div className="lg:col-span-4 relative flex flex-col items-center justify-center gap-4 lg:gap-0">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="relative w-full max-w-[220px] md:max-w-[400px] aspect-[5/6] md:aspect-[3/4] rounded-t-[24px] md:rounded-t-[200px] overflow-hidden border-x border-t border-white/10 mx-auto"
            >
              <img 
                src="/media/asoldi%20capture%202.PNG"
                alt="Asoldi"
                className="w-full h-full object-cover object-center"
              />
            </motion.div>
            {/* CTA - mobile only, under image */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="lg:hidden w-full flex justify-center"
            >
              <Button text="Book konsultasjon" href="/booking" className="bg-[#FF5B00] text-white hover:bg-white hover:text-black" />
            </motion.div>
          </div>

          {/* Right Column - Stats (never shown on hero) */}
          <div className="hidden">
            {/* Stat 1 */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex flex-col gap-2 md:gap-3"
            >
              <a
                href="https://www.google.com/maps/place//data=!4m7!3m6!1s0x8901df3b83305551:0x8a381599611f20d1!8m2!3d63.4339857!4d10.3978324!9m1!1b1"
                target="_blank"
                rel="noreferrer"
                className="relative block hover:opacity-95 transition-opacity"
              >
                <div className="relative flex items-center justify-center md:justify-start gap-3">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                      <img src="/media/christopher.avif" alt="Christopher" className="w-full h-full object-cover" />
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                      <img src="/media/arman%20vestad.webp" alt="Arman" className="w-full h-full object-cover" />
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                      <img src="/media/ali.PNG" alt="Ali" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 text-[#FF5B00]">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={12} fill="#FF5B00" strokeWidth={0} />
                        ))}
                      </div>
                    </div>
                    <div className="text-white font-semibold text-sm leading-tight mt-1">
                      10+ fornøyde kunder
                    </div>
                  </div>
                  <div className="ml-auto">
                    <svg width="26" height="26" viewBox="0 0 256 262" aria-hidden="true">
                      <path fill="#4285F4" d="M255.9 133.5c0-10.7-.9-18.5-2.9-26.6H130.6v48.4h72.9c-1.5 12-9.6 30.2-27.5 42.3l-.3 1.6 38.7 30 2.7.3c25.1-23.2 39.8-57.3 39.8-96.3"/>
                      <path fill="#34A853" d="M130.6 261.1c35.2 0 64.8-11.6 86.4-31.6l-41.2-31.9c-11 7.7-25.9 13.1-45.2 13.1-34.5 0-63.7-23.2-74.1-55.2l-1.5.1-40.2 31.2-.5 1.4c21.5 42.7 65.7 72.9 116.3 72.9"/>
                      <path fill="#FBBC05" d="M56.5 155.5c-2.7-8-4.2-16.6-4.2-25.5s1.5-17.5 4.1-25.5l-.1-1.7-40.7-31.7-1.3.6C5.5 89.6 0 109.4 0 130c0 20.5 5.5 40.4 14.3 58.2l42.2-32.7"/>
                      <path fill="#EB4335" d="M130.6 49.3c24.4 0 40.8 10.5 50.2 19.3l36.7-35.8C195.3 11.6 165.8 0 130.6 0 80 0 35.8 30.2 14.3 71.8l42.1 32.7c10.5-32 39.6-55.2 74.2-55.2"/>
                    </svg>
                  </div>
                </div>

                {/* Title + text: match bottom card sizing */}
                <div className="mt-3 md:mt-4">
                  <h5 className="text-xl md:text-3xl text-white font-serif italic font-normal mb-1 md:mb-2">100% fornøyd garanti</h5>
                  <p className="text-gray-400 text-xs md:text-sm leading-relaxed max-w-[260px] mx-auto md:mx-0">
                    Vi leverer resultater som skaper ekte verdi for våre kunder.
                  </p>
                </div>
              </a>
            </motion.div>

            {/* Stat 2 */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col gap-2 md:gap-3"
            >
              <div>
                <span className="text-[#FF5B00] text-3xl md:text-5xl font-serif italic font-bold">nr 1</span>
              </div>
              <div>
                <h5 className="text-xl md:text-3xl text-white font-serif italic font-normal mb-1 md:mb-2">Rank på google</h5>
                <p className="text-gray-400 text-xs md:text-sm leading-relaxed max-w-[200px] mx-auto md:mx-0">
                  Få flere kunder ved å ranke høyere på google maps.
                </p>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
};
