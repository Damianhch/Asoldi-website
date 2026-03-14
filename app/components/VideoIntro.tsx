import React from 'react';
import { motion } from 'motion/react';

const YOUTUBE_EMBED_URL = 'https://www.youtube.com/embed/623B9L_icyk?autoplay=0';

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
          className="relative aspect-video rounded-[40px] overflow-hidden bg-[#121212] border border-white/10"
        >
          <iframe
            src={YOUTUBE_EMBED_URL}
            title="Introduksjonsvideo – Velkommen til Asoldi"
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="mt-10 text-center text-white/70 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
        >
          Som et 4 år gammelt markedsføringsbyrå med erfaring innen web utvikling og sosiale medier markedsføring er vi et trygt valg du kan forvente resultater av.
        </motion.p>
      </div>
    </section>
  );
};
