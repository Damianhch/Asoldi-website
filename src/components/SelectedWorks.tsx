import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';

interface Work {
  id: number;
  title: string;
  subtitle?: string;
  category?: string;
  image: string;
  tags?: string[];
  meta?: { label: string; value: string }[];
  author?: { name: string; avatar: string; readTime: string };
  type: 'project' | 'blog' | 'case-study';
}

const works: Work[] = [
  {
    id: 1,
    title: "Svelstad.no",
    subtitle: "Moderne nettside for Svelstad",
    type: 'project',
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop",
    tags: ["Nettsideutvikling", "Design"]
  },
  {
    id: 2,
    title: "Swich.no",
    subtitle: "Konverteringsfokusert design",
    type: 'case-study',
    image: "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?q=80&w=2070&auto=format&fit=crop",
    meta: [
      { label: "Tjeneste", value: "Webutvikling & Design" },
      { label: "Kunde", value: "Swich" }
    ]
  },
  {
    id: 3,
    title: "Mong Sushi",
    subtitle: "Digital vekst for lokal restaurant",
    type: 'project',
    image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=2070&auto=format&fit=crop",
    tags: ["Sosiale Medier", "Webutvikling"],
    meta: [
      { label: "Markedsføring", value: "Meta Ads" },
      { label: "Analyse", value: "Vekststrategi" }
    ]
  },
  {
    id: 4,
    title: "Superhero Invest",
    subtitle: "Profesjonell profil for investeringsselskap",
    type: 'project',
    image: "https://images.unsplash.com/photo-1454165833767-0274b24f67a7?q=80&w=2070&auto=format&fit=crop",
    tags: ["Webutvikling", "Analyse"]
  }
];

export const SelectedWorks = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <section className="py-24 bg-[#050505] overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 md:px-10 mb-12 flex justify-between items-end">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl md:text-5xl font-medium text-white"
        >
          Utvalgte Prosjekter
        </motion.h2>
      </div>

      <div 
        ref={containerRef}
        className="flex overflow-x-auto gap-8 px-6 md:px-10 pb-12 snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {works.map((work, index) => (
          <motion.div
            key={work.id}
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="min-w-[85vw] md:min-w-[600px] lg:min-w-[800px] snap-center"
          >
            <div className="group relative rounded-[32px] overflow-hidden bg-[#111] border border-white/10 aspect-[16/10] md:aspect-[16/9]">
              {/* Image & Overlay */}
              <img 
                src={work.image} 
                alt={work.title} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 grayscale hover:grayscale-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-90" />
              
              {/* Content */}
              <div className="absolute inset-0 p-8 md:p-12 flex flex-col justify-between">
                
                {/* Top Area */}
                <div className="flex justify-between items-start">
                  <div className="max-w-2xl">
                    <h3 className="text-3xl md:text-5xl font-medium text-white mb-4 leading-tight">
                      {work.title}
                    </h3>
                    {work.subtitle && (
                      <p className="text-gray-400 text-sm md:text-base uppercase tracking-wider">
                        {work.subtitle}
                      </p>
                    )}
                  </div>
                  
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center group-hover:bg-[#FF5B00] transition-colors duration-300">
                    <ArrowUpRight className="w-6 h-6 md:w-8 md:h-8 text-white group-hover:text-white transition-colors" />
                  </div>
                </div>

                {/* Bottom Area */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                  
                  {/* Tags */}
                  {work.tags && (
                    <div className="flex flex-wrap gap-2">
                      {work.tags.map((tag, i) => (
                        <span key={i} className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md text-sm text-white border border-white/10">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Meta Info */}
                  {work.meta && (
                    <div className="flex gap-8 md:gap-16 text-sm">
                      {work.meta.map((item, i) => (
                        <div key={i}>
                          <span className="block text-gray-500 mb-1">{item.label}</span>
                          <span className="text-white font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
