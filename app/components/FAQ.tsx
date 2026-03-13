import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "HVILKE TJENESTER TILBYR DERE?",
    answer: "Vi tilbyr omfattende nettsideutvikling og digitale markedsføringstjenester. Dette inkluderer tilpasset nettsidedesign, SEO-optimalisering, administrasjon av sosiale medier, innholdsproduksjon og betalte annonsekampanjer skreddersydd for dine forretningsmål."
  },
  {
    question: "HVORDAN VET JEG HVILKEN PAKKE SOM ER RIKTIG FOR MEG?",
    answer: "Hvis du ønsker å bygge en ny tilstedeværelse på nett eller fornye din eksisterende side, er vår pakke for nettsideutvikling ideell. Hvis du har en side, men trenger mer trafikk og engasjement, er markedsføring i sosiale medier veien å gå. Vi kan også lage tilpassede hybridplaner under vår oppstartssamtale."
  },
  {
    question: "HVOR RASKT KAN JEG FORVENTE RESULTATER?",
    answer: "For nettsideutvikling varierer tidslinjene etter kompleksitet, men ligger vanligvis mellom 2-4 uker. For markedsføring kan du se de første forbedringene i engasjement i løpet av den første måneden, med betydelig ROI som bygger seg opp over 3-6 måneder med konsekvent strategi."
  },
  {
    question: "TILBYR DERE SKREDDERSYDDE PAKKER?",
    answer: "Ja! Vi forstår at hver bedrift er unik. Selv om våre kjernepakker dekker det essensielle, skreddersyr vi ofte våre tjenester for å inkludere spesifikke tillegg som avansert analyse, traktoptimalisering eller utvidet support."
  },
  {
    question: "VIL JEG FÅ REGELMESSIGE OPPDATERINGER ELLER RAPPORTER?",
    answer: "Absolutt. Åpenhet er nøkkelen til vårt partnerskap. Vi leverer månedlige resultatrapporter for markedsføringskunder og ukentlige fremdriftsoppdateringer under nettsideprosjekter, slik at du alltid er oppdatert."
  }
];

export const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-24 px-6 md:px-10 bg-[#050505] overflow-hidden">
      <div className="max-w-[1440px] mx-auto flex flex-col lg:flex-row gap-16 lg:gap-24">
        
        {/* Left Side: Title */}
        <div className="lg:w-1/3">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[#FF5B00] font-medium tracking-wider uppercase text-sm">Faq</span>
          </div>
          <h2 className="text-5xl md:text-7xl font-bold text-white uppercase leading-[0.9] tracking-tight">
            Alt du<br />
            trenger å<br />
            vite
          </h2>
        </div>

        {/* Right Side: Accordion */}
        <div className="lg:w-2/3 flex flex-col gap-4">
          {faqs.map((faq, index) => (
            <div 
              key={index}
              className="bg-[#121212] rounded-2xl overflow-hidden border border-white/5 transition-colors duration-300 hover:border-white/10"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full p-6 md:p-8 flex items-center justify-between text-left group"
              >
                <span className="text-lg md:text-xl font-bold text-white uppercase tracking-wide pr-8">
                  {faq.question}
                </span>
                <div className={`w-10 h-10 rounded-full border border-white/20 flex items-center justify-center shrink-0 transition-colors duration-300 ${openIndex === index ? 'bg-[#FF5B00] border-[#FF5B00] text-white' : 'text-white group-hover:border-white'}`}>
                  {openIndex === index ? <Minus size={20} /> : <Plus size={20} />}
                </div>
              </button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div className="px-6 md:px-8 pb-8 text-gray-400 leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
