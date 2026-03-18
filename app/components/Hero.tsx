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
    <section id="Home" className="relative pt-32 pb-20 px-6 md:px-10 overflow-hidden bg-[#050505]">
      {/* Decorative Line SVG */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <svg width="100%" height="100%" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute top-0 left-0 w-full h-full opacity-30">
          <path d="M-100 700 C 200 600, 400 650, 600 400 C 800 150, 1200 100, 1350 50 L 1320 80 M 1350 50 L 1300 40" stroke="#FF5B00" strokeWidth="1" fill="none" />
        </svg>
      </div>

      <div className="max-w-[1440px] mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column - Text & Services */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-7xl md:text-8xl lg:text-[100px] leading-[0.9] font-medium tracking-tight mb-12 text-[#FF5B00]"
            >
              Vi er din ekspert på <span className="font-serif italic font-normal block text-white">digital vekst</span>
            </motion.h1>
            
            <div className="flex flex-wrap gap-3 max-w-md mb-10">
              {services.map((service, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 + (index * 0.1) }}
                  className="px-6 py-3 rounded-full border border-[#FF5B00]/20 bg-[#1a1a1a] text-sm md:text-base text-white hover:bg-[#FF5B00] hover:text-white transition-colors cursor-default"
                >
                  {service}
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <Button text="Book konsultasjon" href="/booking" className="bg-[#FF5B00] text-white hover:bg-white hover:text-black" />
            </motion.div>
          </div>

          {/* Middle Column - Image */}
          <div className="lg:col-span-4 relative flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="relative w-full max-w-[400px] aspect-[3/4] rounded-t-[200px] overflow-hidden border-x border-t border-white/10"
            >
              <img 
                src="/media/asoldi%20capture%202.PNG"
                alt="Asoldi"
                className="w-full h-full object-cover object-center"
              />
            </motion.div>
          </div>

          {/* Right Column - Stats */}
          <div className="lg:col-span-3 lg:col-start-10 flex flex-col gap-12 pl-8">
            {/* Stat 1 */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex flex-col gap-3"
            >
              <a
                href="https://www.google.com/maps/place/Asoldi/@63.4339857,10.3978324,12z/data=!3m1!4b1!4m8!3m7!1s0x8901df3b83305551:0x8a381599611f20d1!8m2!3d63.4339857!4d10.3978324!9m1!1b1!16s%2Fg%2F11wn5bswhk?entry=ttu&g_ep=EgoyMDI2MDMxNS4wIKXMDSoASAFQAw%3D%3D"
                target="_blank"
                rel="noreferrer"
                className="group relative block rounded-2xl bg-[#0f0f0f] border border-white/10 p-6 hover:border-[#FF5B00]/40 hover:bg-[#111] transition-colors"
              >
                <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/80 text-xs font-semibold">
                  G
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex -space-x-2">
                    {['A', 'S', 'O'].map((ch, i) => (
                      <div
                        key={i}
                        className="w-9 h-9 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-white text-xs"
                      >
                        {ch}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-white font-semibold leading-tight">10+ fornøyde kunder</div>
                    <div className="flex items-center gap-1 text-[#FF5B00]">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={14} fill="#FF5B00" strokeWidth={0} />
                      ))}
                      <span className="text-gray-400 text-xs ml-1">5.0</span>
                    </div>
                  </div>
                </div>

                <h5 className="text-4xl md:text-5xl text-white font-semibold leading-tight">
                  100% fornøyd<br />garanti
                </h5>
                <p className="text-gray-400 text-sm leading-relaxed mt-3">
                  Vi leverer resultater som skaper ekte verdi for våre kunder.
                </p>
                <div className="mt-4 text-sm text-[#FF5B00] opacity-0 group-hover:opacity-100 transition-opacity">
                  Se Google anmeldelser →
                </div>
              </a>
            </motion.div>

            {/* Stat 2 */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col gap-3"
            >
              <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-6">
                <div className="text-[#FF5B00] text-sm font-semibold">nr 1</div>
                <h5 className="text-3xl text-[#FF5B00] font-semibold mt-2 mb-3">Rank på google</h5>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Få flere kunder ved å ranke høyere på google maps
                </p>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
};
