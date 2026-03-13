import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Search, PenTool, Rocket, TrendingUp } from 'lucide-react';
import { Button } from './Button';

interface ProcessStep {
  id: number;
  title: string;
  description: string;
  illustration: React.ReactNode;
}

const steps: ProcessStep[] = [
  {
    id: 1,
    title: "Oppdagelse",
    description: "Vi starter med å dykke dypt inn i dine forretningsmål, målgruppe og konkurranselandskap for å bygge et solid fundament for suksess.",
    illustration: (
      <div className="relative w-48 h-48 md:w-64 md:h-64">
        <svg viewBox="0 0 200 200" className="w-full h-full text-[#050505]">
          <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M60 100 Q 100 60 140 100 T 180 100" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="100" cy="100" r="10" fill="currentColor" />
          <path d="M140 40 L 160 60 M 150 50 L 170 30" stroke="currentColor" strokeWidth="2" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Search size={48} className="text-[#050505]" strokeWidth={1.5} />
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: "Gjennomføring",
    description: "Vårt team av eksperter bringer strategien til live, og skaper design og kode av høy kvalitet som samsvarer perfekt med din merkevare.",
    illustration: (
      <div className="relative w-48 h-48 md:w-64 md:h-64">
        <svg viewBox="0 0 200 200" className="w-full h-full text-[#050505]">
          <circle cx="100" cy="100" r="80" fill="white" stroke="currentColor" strokeWidth="3" />
          <path d="M100 100 L 100 20 A 80 80 0 0 1 180 100 Z" fill="#FF5B00" stroke="currentColor" strokeWidth="3" />
          <path d="M100 100 L 180 100 A 80 80 0 0 1 100 180 Z" fill="#050505" />
          <path d="M40 60 L 60 40 M 50 50 L 30 30" stroke="currentColor" strokeWidth="2" />
          <circle cx="40" cy="160" r="15" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M160 40 L 170 50" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
    )
  },
  {
    id: 3,
    title: "Lansering",
    description: "Vi håndterer de tekniske detaljene ved utrulling, og sikrer en smidig lansering som gir umiddelbar effekt i markedet.",
    illustration: (
      <div className="relative w-48 h-48 md:w-64 md:h-64">
        <svg viewBox="0 0 200 200" className="w-full h-full text-[#050505]">
          <rect x="40" y="40" width="120" height="120" rx="20" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M40 80 L 160 80" stroke="currentColor" strokeWidth="2" />
          <circle cx="70" cy="60" r="5" fill="currentColor" />
          <circle cx="90" cy="60" r="5" fill="currentColor" />
          <circle cx="110" cy="60" r="5" fill="currentColor" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pt-8">
          <Rocket size={48} className="text-[#050505]" strokeWidth={1.5} />
        </div>
      </div>
    )
  },
  {
    id: 4,
    title: "Vekst",
    description: "Etter lansering overvåker vi kontinuerlig ytelsen og optimaliserer strategier for å sikre bærekraftig vekst og ROI.",
    illustration: (
      <div className="relative w-48 h-48 md:w-64 md:h-64">
        <svg viewBox="0 0 200 200" className="w-full h-full text-[#050505]">
          <path d="M40 160 L 160 160" stroke="currentColor" strokeWidth="2" />
          <path d="M40 160 L 40 40" stroke="currentColor" strokeWidth="2" />
          <path d="M40 160 L 80 120 L 110 140 L 160 60" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="80" cy="120" r="6" fill="#FF5B00" />
          <circle cx="110" cy="140" r="6" fill="#FF5B00" />
          <circle cx="160" cy="60" r="8" fill="#050505" />
        </svg>
      </div>
    )
  }
];

export const OurProcess = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % steps.length);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + steps.length) % steps.length);
  };

  const currentStep = steps[currentIndex];

  return (
    <section className="py-32 px-6 md:px-10 bg-[#050505]">
      <div className="max-w-[1440px] mx-auto">
        
        {/* Header */}
        <div className="text-center mb-20">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-[1px] bg-[#FF5B00]" />
            <span className="text-[#FF5B00] font-medium tracking-widest text-sm uppercase">Vår Prosess</span>
            <div className="w-8 h-[1px] bg-[#FF5B00]" />
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-medium text-white max-w-3xl mx-auto leading-tight">
            En enkel, men kraftfull og effektiv prosess
          </h2>
          <p className="text-gray-400 mt-6 max-w-2xl mx-auto text-lg">
            Vi veileder deg gjennom hvert trinn på reisen, og sikrer klarhet og kvalitet fra start til slutt.
          </p>
        </div>

        {/* Carousel Section */}
        <div className="flex items-center justify-center gap-4 md:gap-12">
          
          {/* Prev Button */}
          <button 
            onClick={handlePrev}
            className="hidden md:flex w-14 h-14 rounded-full bg-[#121212] border border-white/10 items-center justify-center text-white hover:bg-[#FF5B00] hover:text-white transition-all duration-300 group shrink-0"
          >
            <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
          </button>

          {/* Card */}
          <div className="w-full max-w-4xl relative">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentIndex}
                custom={direction}
                initial={{ opacity: 0, x: direction * 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -50 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="bg-white rounded-[40px] p-8 md:p-16 flex flex-col md:flex-row items-center gap-12 md:gap-20 min-h-[400px]"
              >
                {/* Illustration Side */}
                <div className="flex-1 flex items-center justify-center">
                  {currentStep.illustration}
                </div>

                {/* Content Side */}
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-3xl md:text-4xl font-medium text-[#050505] mb-6">
                    {currentStep.id}. {currentStep.title}
                  </h3>
                  <p className="text-[#050505]/80 text-lg leading-relaxed">
                    {currentStep.description}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
            
            {/* Mobile Navigation */}
            <div className="flex md:hidden justify-center gap-4 mt-8">
              <button 
                onClick={handlePrev}
                className="w-12 h-12 rounded-full bg-[#121212] border border-white/10 flex items-center justify-center text-white hover:bg-[#FF5B00] hover:text-white transition-all duration-300"
              >
                <ArrowLeft size={20} />
              </button>
              <button 
                onClick={handleNext}
                className="w-12 h-12 rounded-full bg-[#121212] border border-white/10 flex items-center justify-center text-white hover:bg-[#FF5B00] hover:text-white transition-all duration-300"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </div>

          {/* Next Button */}
          <button 
            onClick={handleNext}
            className="hidden md:flex w-14 h-14 rounded-full bg-[#121212] border border-white/10 items-center justify-center text-white hover:bg-[#FF5B00] hover:text-white transition-all duration-300 group shrink-0"
          >
            <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
          </button>

        </div>

      </div>
    </section>
  );
};
