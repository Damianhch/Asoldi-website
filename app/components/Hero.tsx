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
                className="relative block rounded-2xl bg-[#0f0f0f] border border-white/10 p-6 hover:border-[#FF5B00]/40 hover:bg-[#111] transition-colors"
              >
                {/* Google logo */}
                <div className="absolute top-4 right-4">
                  <svg width="26" height="26" viewBox="0 0 256 262" aria-hidden="true">
                    <path fill="#4285F4" d="M255.9 133.5c0-10.7-.9-18.5-2.9-26.6H130.6v48.4h72.9c-1.5 12-9.6 30.2-27.5 42.3l-.3 1.6 38.7 30 2.7.3c25.1-23.2 39.8-57.3 39.8-96.3"/>
                    <path fill="#34A853" d="M130.6 261.1c35.2 0 64.8-11.6 86.4-31.6l-41.2-31.9c-11 7.7-25.9 13.1-45.2 13.1-34.5 0-63.7-23.2-74.1-55.2l-1.5.1-40.2 31.2-.5 1.4c21.5 42.7 65.7 72.9 116.3 72.9"/>
                    <path fill="#FBBC05" d="M56.5 155.5c-2.7-8-4.2-16.6-4.2-25.5s1.5-17.5 4.1-25.5l-.1-1.7-40.7-31.7-1.3.6C5.5 89.6 0 109.4 0 130c0 20.5 5.5 40.4 14.3 58.2l42.2-32.7"/>
                    <path fill="#EB4335" d="M130.6 49.3c24.4 0 40.8 10.5 50.2 19.3l36.7-35.8C195.3 11.6 165.8 0 130.6 0 80 0 35.8 30.2 14.3 71.8l42.1 32.7c10.5-32 39.6-55.2 74.2-55.2"/>
                  </svg>
                </div>

                {/* Top row: avatars + rating */}
                <div className="flex items-center gap-4 mb-5">
                  <div className="flex -space-x-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-10 h-10 rounded-full border-2 border-[#0f0f0f] bg-gray-700 overflow-hidden">
                        <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="Kunde" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex gap-1 text-[#FF5B00] mb-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={14} fill="#FF5B00" strokeWidth={0} />
                      ))}
                    </div>
                    <div className="text-white font-semibold text-base leading-tight">10+ fornøyde kunder</div>
                  </div>
                </div>

                {/* Title + text: match bottom card typography */}
                <h5 className="text-4xl text-white font-semibold leading-tight mb-3">
                  100% fornøyd garanti
                </h5>
                <p className="text-gray-400 text-sm leading-relaxed max-w-[260px]">
                  Vi leverer resultater som skaper ekte verdi for våre kunder.
                </p>
              </a>
            </motion.div>

            {/* Stat 2 */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col gap-3"
            >
              <div>
                <span className="text-[#FF5B00] text-5xl font-serif italic font-bold">nr 1</span>
              </div>
              <div>
                <h5 className="text-3xl text-white font-serif italic font-normal mb-2">Rank på google</h5>
                <p className="text-gray-400 text-sm leading-relaxed max-w-[200px]">
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
