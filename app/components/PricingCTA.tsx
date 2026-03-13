import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';

interface PricingCTAProps {
  serviceName: string;
}

export const PricingCTA: React.FC<PricingCTAProps> = ({ serviceName }) => {
  return (
    <section className="py-24 md:py-32 bg-[#0a0a0a] border-y border-white/5 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FF5B00]/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 md:px-10 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#FF5B00]/10 flex items-center justify-center">
                <ShieldCheck className="text-[#FF5B00]" size={24} />
              </div>
              <span className="text-[#FF5B00] font-medium tracking-wider uppercase text-sm">Prisgjennomsiktighet</span>
            </div>
            
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-medium text-white mb-6 leading-tight">
              Ingen skjulte kostnader.<br />
              Bare <span className="text-[#FF5B00] font-serif italic">resultater.</span>
            </h2>
            
            <p className="text-lg md:text-xl text-white/60 font-light mb-10 leading-relaxed max-w-xl">
              Vi tror på full åpenhet. Derfor har vi faste priser og pakker som er skreddersydd for å gi deg mest mulig verdi for pengene, uten overraskelser på fakturaen.
            </p>
            
            <Link 
              to={`/pricing?service=${encodeURIComponent(serviceName)}`}
              className="inline-flex items-center gap-3 bg-[#FF5B00] text-white px-8 py-4 rounded-full font-medium hover:bg-white hover:text-black transition-all duration-300 group text-lg"
            >
              Se våre priser
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          {/* Right Image/Graphic */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 relative">
              <img 
                src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80" 
                alt="Transparency and Growth"
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
              
              {/* Floating Badge */}
              <div className="absolute bottom-8 left-8 right-8 p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl">
                <div className="text-[#FF5B00] font-bold text-2xl mb-1">100% Transparent</div>
                <div className="text-white/80 text-sm">Vi leverer det vi lover, til prisen vi avtaler.</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
