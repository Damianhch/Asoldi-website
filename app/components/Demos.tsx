import React from 'react';
import { motion } from 'motion/react';

interface DemoCardProps {
  title: string;
  image: string;
  href: string;
  delay?: number;
}

const DemoCard: React.FC<DemoCardProps> = ({ title, image, href, delay = 0 }) => {
  return (
    <motion.a 
      href={href}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="group block"
    >
      <div className="relative overflow-hidden rounded-2xl bg-[#111] mb-6 aspect-[1.4/1] border border-white/5">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="bg-[#FF5B00] text-white px-6 py-3 rounded-full font-medium transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            Se
          </div>
        </div>
      </div>
      <h3 className="text-xl font-medium text-center group-hover:text-[#FF5B00] transition-colors">{title}</h3>
    </motion.a>
  );
};

export const Demos = () => {
  const homeDemos = [
    {
      title: "Hjemmeside",
      image: "https://cdn.prod.website-files.com/6716051c7e279a14d3641f31/6738787f0a49bf6e4b18977c_home.jpg",
      href: "/home"
    }
  ];

  const utilityPages = [
    {
      title: "Stilguide",
      image: "https://cdn.prod.website-files.com/6716051c7e279a14d3641f31/67387880d57d47744759b49f_style-guide.jpg",
      href: "/template-pages/style-guide"
    },
    {
      title: "Lisens",
      image: "https://cdn.prod.website-files.com/6716051c7e279a14d3641f31/6738787f73b190ea1e2e7727_license.jpg",
      href: "/template-pages/license"
    },
    {
      title: "404",
      image: "https://cdn.prod.website-files.com/6716051c7e279a14d3641f31/6738787f667430263c805d78_404.jpg",
      href: "/404"
    },
    {
      title: "Endringslogg",
      image: "https://cdn.prod.website-files.com/6716051c7e279a14d3641f31/6738787f42b050bada61e64f_changelog.jpg",
      href: "/template-pages/changelog"
    }
  ];

  return (
    <>
      <section id="Demo" className="py-24 px-6 md:px-10 bg-[#050505]">
        <div className="max-w-[1440px] mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold tracking-wider text-gray-500 uppercase mb-4 block">HJEMMESIDE</span>
            <h2 className="text-4xl md:text-5xl font-medium">Hjemmeside</h2>
          </div>
          
          <div className="max-w-4xl mx-auto mb-32">
            {homeDemos.map((demo, index) => (
              <DemoCard key={index} {...demo} />
            ))}
          </div>
        </div>
      </section>

      <section id="Utility-pages" className="py-24 px-6 md:px-10 bg-[#050505]">
        <div className="max-w-[1440px] mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold tracking-wider text-gray-500 uppercase mb-4 block">VERKTØYSIDER</span>
            <h2 className="text-4xl md:text-5xl font-medium">Verktøysider</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-x-8 gap-y-12">
            {utilityPages.map((demo, index) => (
              <DemoCard key={index} {...demo} delay={index * 0.05} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
