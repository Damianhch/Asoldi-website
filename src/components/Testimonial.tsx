import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Quote, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface TestimonialData {
  id: number;
  name: string;
  role: string;
  business: string;
  image: string;
  quote: string;
  highlight: string;
}

const testimonials: TestimonialData[] = [
  {
    id: 1,
    name: "Sarah Jenkins",
    role: "Grunnlegger",
    business: "ArtSpace Gallery",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1000&auto=format&fit=crop",
    quote: "Vi trengte en partner som forsto vår visjon, ikke bare en tjenesteleverandør. Asoldi leverte over all forventning, og økte vårt salg på nett med",
    highlight: "200% på bare 3 måneder."
  },
  {
    id: 2,
    name: "Michael Chen",
    role: "Daglig leder",
    business: "TechFlow Solutions",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=1000&auto=format&fit=crop",
    quote: "Teamets oppmerksomhet på detaljer og strategiske tilnærming transformerte vår digitale tilstedeværelse fullstendig. Vi har sett en massiv økning i brukerengasjement og",
    highlight: "doblet vår lead-generering."
  },
  {
    id: 3,
    name: "Emma Davis",
    role: "Markedsdirektør",
    business: "GreenLeaf Organics",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=1000&auto=format&fit=crop",
    quote: "Å jobbe med Asoldi var en game-changer. Deres innovative kampanjer hjalp oss med å nå en yngre målgruppe og etablerte oss som en",
    highlight: "markedsleder innen bærekraft."
  }
];

export const Testimonial = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const current = testimonials[currentIndex];

  return (
    <section className="py-32 px-6 md:px-10 bg-[#050505]">
      <div className="max-w-[1440px] mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-[#121212] rounded-[48px] p-8 md:p-20 border border-white/5 relative overflow-hidden min-h-[600px] flex flex-col justify-center"
        >
          {/* Background Decoration */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#FF5B00]/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          {/* Navigation Buttons */}
          <div className="absolute top-1/2 -translate-y-1/2 left-4 md:left-8 z-20">
            <button 
              onClick={handlePrev}
              className="w-12 h-12 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/10 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          </div>
          <div className="absolute top-1/2 -translate-y-1/2 right-4 md:right-8 z-20">
            <button 
              onClick={handleNext}
              className="w-12 h-12 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/10 transition-colors"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div 
              key={currentIndex}
              custom={direction}
              initial={{ opacity: 0, x: direction * 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -50 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="relative z-10 flex flex-col gap-16 px-8 md:px-16"
            >
              
              {/* Top Section: Owner Info & Image */}
              <div className="flex flex-col md:flex-row items-center md:items-end gap-8 md:gap-12 mx-auto">
                
                {/* Big Image */}
                <div className="relative group">
                  <div className="w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden border-4 border-[#FF5B00]/20">
                    <img 
                      src={current.image} 
                      alt={current.name} 
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                    />
                  </div>
                  <div className="absolute bottom-2 right-2 bg-[#FF5B00] text-white p-3 rounded-full">
                    <Quote size={24} fill="currentColor" />
                  </div>
                </div>

                {/* Details */}
                <div className="text-center md:text-left mb-4">
                  <h3 className="text-3xl md:text-4xl font-medium text-white mb-2">{current.name}</h3>
                  <p className="text-xl text-gray-400 mb-4">{current.role}, <span className="text-white">{current.business}</span></p>
                  
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                    <CheckCircle size={16} className="text-[#FF5B00]" />
                    <span className="text-sm text-gray-300">Verifisert fra LinkedIn</span>
                  </div>
                </div>
              </div>

              {/* Bottom Section: Testimonial Text */}
              <div className="border-t border-white/10 pt-12 text-center">
                <p className="text-3xl md:text-5xl lg:text-6xl font-serif italic text-white leading-[1.2] md:leading-[1.1]">
                  "{current.quote} <span className="text-[#FF5B00]">{current.highlight}</span>"
                </p>
              </div>

            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
};
