import React from 'react';
import { motion } from 'motion/react';
import { Play } from 'lucide-react';

export const VideoIntro = () => {
  return (
    <section className="pt-32 pb-16 px-6 md:px-10 bg-[#050505]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-center gap-4 mb-4"
          >
            <div className="w-12 h-[2px] bg-[#FF5B00]" />
            <span className="text-[#FF5B00] font-medium tracking-wider uppercase">Introduksjonsvideo</span>
            <div className="w-12 h-[2px] bg-[#FF5B00]" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-medium text-white max-w-2xl leading-tight"
          >
            Velkommen til <span className="text-[#FF5B00] font-serif italic">Asoldi</span>
          </motion.h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative aspect-video rounded-[40px] overflow-hidden bg-[#121212] border border-white/10 group cursor-pointer"
        >
          <img 
            src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80" 
            alt="Video thumbnail" 
            className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity duration-500"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-[#FF5B00] rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-[#FF5B00]/20">
              <Play size={32} className="ml-2" fill="currentColor" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
