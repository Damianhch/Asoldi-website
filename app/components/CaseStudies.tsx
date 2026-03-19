import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CaseStudy {
  id: number;
  slug: string;
  label: string;
  bigResult: string;
  businessName: string;
  resultDescription: string;
  services: string[];
  logo: string;
}

const caseStudies: CaseStudy[] = [
  {
    id: 1,
    slug: "superhero-burger",
    label: "Konverter flere kunder",
    bigResult: "9600",
    businessName: "Superhero Burger",
    resultDescription: "Vi håndterer gjennomsnittelig 320 unike besøkende hver dag gjennom utviklingen av nettsiden, uten dette vll disse kundene ikke fått den informasjonen de var ute etter.",
    services: ["Nettside utvikling", "Nettside opprettholdelse"],
    logo: "/media/logo.jpg"
  },
  {
    id: 2,
    slug: "svelstad-gardsbruk",
    label: "Ny begynnelse på nett",
    bigResult: "NYTT",
    businessName: "Svelstad gårdsbruk",
    resultDescription: "Mulighet til å bestille gjennom mailing system, samt opprettelse av email liste for fremtidige salgsnyheter. Dette prosjektet signaliserte en ny begynnelse for svelstad på nett.",
    services: ["Nettside utvikling", "Nettside opprettholdelse"],
    logo: "/media/Uten-navn-1000-x-500-px3.webp"
  },
  {
    id: 3,
    slug: "vaernes-bar",
    label: "Nr 1 på Google",
    bigResult: "#1",
    businessName: "Værnes bar",
    resultDescription: "Lar kunde bestille over nett, sende kunde henvendelser, og booke bord, en helhetlig og profesjonell restaurant løsning som lar kunden bestille det den vil.",
    services: ["Nettside utvikling", "Nettside opprettholdelse"],
    logo: "/media/Untitled_design__13_-removebg-preview.png"
  },
  {
    id: 4,
    slug: "mong-sushi",
    label: "Økt konversjonsrate",
    bigResult: "8%+",
    businessName: "Mong sushi",
    resultDescription: "Økte tilstedeværelse på nett ved å vise meny, bilder av lokasjon og gir kunder mulighet til å bestille takeaway og sende kunde henvendelser på en lett og enkel måte.",
    services: ["Nettside utvikling", "Nettside opprettholdelse"],
    logo: "/media/mong sushi logo.webp"
  },
  {
    id: 5,
    slug: "swich-restaurant",
    label: "Nr 3 på Google",
    bigResult: "#3",
    businessName: "S'wich restaurant",
    resultDescription: "Ranker nr 3 i søkeord “restaurant” i trondheim etter 1 uke med nettside. målet var mer eksponering på google og google maps, og det var noe vi klarte å oppnå.",
    services: ["Nettside utvikling", "Nettside opprettholdelse"],
    logo: "/media/7444a9e70b64378cb31902781eb700f98431feee.webp"
  }
];

const clients = [
  { name: "Arman Vestad", business: "Arman v", score: 4.9, image: "/media/arman vestad.webp" },
  { name: "Naing Zaw Win", business: "Mong Sushi", score: 5.0, image: "/media/naing zaw win.jpg" },
  { name: "Jan Peder", business: "Svelstad gård", score: 5.0, image: "/media/d42ca57d-b9ea-4792-81e2-31deb97b19ea.jpg" },
  { name: "Christopher Vrioni", business: "Superhero burger & pizza", score: 5.0, image: "/media/christopher.avif" },
  { name: "Moses", business: "Værnes bar", score: 5.0, image: "/media/moses.jpg" },
  { name: "Abdulnasser", business: "S'wich", score: 5.0, image: "/media/f6b843b5f8538fe4545df36ab22d5db40278e8a8-1024x768.jpg" },
  { name: "Ali Alnassry", business: "A.L.I Vision", score: 5.0, image: "/media/ali.PNG" },
  { name: "Peder Nåvik", business: "Ulvolden Productions", score: 5.0, image: "/media/avatars-llBdG1u5GiDnhdxL-5C8UGQ-t240x240.jpg" },
];

export const CaseStudies = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % caseStudies.length);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + caseStudies.length) % caseStudies.length);
  };

  const currentStudy = caseStudies[currentIndex];

  return (
    <section className="pt-16 pb-32 px-0 md:px-10 bg-[#050505]">
      <div className="w-full max-w-5xl mx-auto md:px-0">
        
        {/* Clients Header Section */}
        <div className="mb-20 text-center px-6 md:px-0">
          <motion.h3 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl md:text-3xl font-medium text-white mb-12"
          >
            samarbeid med 10+ bedrifter så langt
          </motion.h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 justify-items-center gap-6 md:gap-8">
            {clients.map((client, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="flex flex-col items-center gap-2 max-w-[140px]"
              >
                <img
                  src={client.image}
                  alt={client.name}
                  className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full object-cover hover:scale-105 transition-transform duration-300 border border-white/10 flex-shrink-0"
                />
                <div className="text-center min-w-0">
                  <p className="text-white font-medium text-xs sm:text-sm truncate" title={client.name}>{client.name}</p>
                  <p className="text-white/70 text-[10px] sm:text-xs truncate" title={client.business}>{client.business}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-none md:rounded-[40px] overflow-hidden shadow-2xl min-h-[580px] flex flex-col">
          
          {/* Top Tabs / Logos */}
          <div className="flex w-full border-b border-gray-100">
            {caseStudies.map((study, index) => (
              <button 
                key={index}
                onClick={() => {
                  setDirection(index > currentIndex ? 1 : -1);
                  setCurrentIndex(index);
                }}
                className={`h-20 flex-1 flex items-center justify-center border-r border-gray-100 last:border-r-0 transition-colors duration-300 relative ${
                  index === currentIndex ? 'bg-white' : 'bg-gray-100 hover:bg-gray-50'
                }`}
              >
                <img 
                  src={study.logo} 
                  alt={study.businessName} 
                  className={`w-20 h-auto max-h-12 object-contain transition-opacity duration-300 ${
                    index === currentIndex ? 'opacity-100' : 'opacity-50 grayscale'
                  }`} 
                />
                {index === currentIndex && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute top-0 left-0 right-0 h-1 bg-[#FF5B00]" 
                  />
                )}
              </button>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="relative flex-1 flex flex-col items-center justify-center p-12 md:p-20">
            
            {/* Navigation Buttons */}
            <button 
              onClick={handlePrev}
              className="absolute left-6 md:left-10 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors z-10"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>

            <button 
              onClick={handleNext}
              className="absolute right-6 md:right-10 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors z-10"
            >
              <ChevronRight className="w-6 h-6 text-gray-600" />
            </button>

            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentIndex}
                custom={direction}
                initial={{ opacity: 0, x: direction * 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -50 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="w-full max-w-3xl flex flex-col items-center"
              >
                {/* Big Result - Centered */}
                <div className="text-center mb-8 md:mb-16">
                  <p className="text-gray-400 font-medium text-sm md:text-lg uppercase tracking-wider mb-2 md:mb-4">
                    {currentStudy.label}
                  </p>
                  <h2 className="text-6xl md:text-8xl lg:text-[120px] font-serif italic font-medium text-[#050505] leading-none">
                    {currentStudy.bigResult}
                  </h2>
                </div>

                {/* Content Block - Left Aligned Text, Centered Block */}
                <div className="w-full max-w-2xl text-left mb-8 md:mb-16">
                  <h3 className="text-2xl md:text-3xl lg:text-4xl font-medium text-[#050505] mb-4 md:mb-6">
                    {currentStudy.businessName}
                  </h3>
                  
                  <p className="text-gray-500 text-base md:text-lg lg:text-xl leading-relaxed mb-6 md:mb-8">
                    {currentStudy.resultDescription}
                  </p>

                  <div className="flex flex-wrap gap-3">
                    {currentStudy.services.map((service, i) => (
                      <span 
                        key={i}
                        className={`px-6 py-2 rounded-full text-sm font-medium ${
                          i % 2 === 0 
                            ? 'bg-[#FF5B00] text-white' 
                            : 'bg-[#050505] text-white'
                        }`}
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>

                {/* CTA Button - Centered */}
                <Link 
                  to={`/clients#${currentStudy.slug}`}
                  className="group bg-[#050505] text-white px-10 py-5 rounded-full font-medium inline-flex items-center gap-2 hover:bg-[#FF5B00] transition-colors text-lg"
                >
                  Se Case Study
                  <ArrowUpRight className="w-5 h-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                </Link>

              </motion.div>
            </AnimatePresence>

          </div>
        </div>
      </div>
    </section>
  );
};
