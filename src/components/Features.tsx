import React from 'react';
import { Button } from './Button';
import { motion } from 'motion/react';
import { Clock, DollarSign, TrendingUp } from 'lucide-react';

export const Features = () => {
  const features = [
    {
      icon: <Clock className="w-6 h-6 text-[#FF5B00]" />,
      title: "Spar tid",
      description: "Automatiser dine kundeinteraksjoner, bookinger og salgsprosesser. La din digitale tilstedeværelse jobbe for deg 24/7."
    },
    {
      icon: <DollarSign className="w-6 h-6 text-[#FF5B00]" />,
      title: "Øk omsetningen",
      description: "Nå ut til et bredere publikum og konverter besøkende til betalende kunder med en optimalisert strategi for digital vekst."
    },
    {
      icon: <TrendingUp className="w-6 h-6 text-[#FF5B00]" />,
      title: "Styrk din merkevare",
      description: "Bygg tillit og troverdighet umiddelbart. Bli funnet der kundene dine leter og etabler din bedrift som en autoritet."
    }
  ];

  return (
    <section className="py-24 px-6 md:px-10 bg-[#050505] relative overflow-hidden">
      {/* Background Graph Animation */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <svg className="w-full h-full" viewBox="0 0 1440 800" preserveAspectRatio="none">
          <motion.path
            d="M0 800 C 300 700, 600 600, 1440 200"
            fill="none"
            stroke="#FF5B00"
            strokeWidth="2"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 0.5 }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
          <motion.path
            d="M0 800 L 1440 800 L 1440 200 C 600 600, 300 700, 0 800 Z"
            fill="url(#gradient)"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.1 }}
            transition={{ duration: 2, delay: 0.5 }}
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FF5B00" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#FF5B00" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="max-w-[1440px] mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div className="flex flex-col justify-center">
            <motion.h3 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl lg:text-6xl font-medium mb-8 leading-tight text-white"
            >
              Hvorfor din bedrift trenger <span className="text-[#FF5B00]">digital tilstedeværelse.</span>
            </motion.h3>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-gray-400 text-lg md:text-xl mb-10 max-w-lg leading-relaxed"
            >
              I dagens digitale verden er en profesjonell nettside og aktiv tilstedeværelse i sosiale medier ikke bare en luksus – det er en nødvendighet for vekst.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Button text="Start din vekst i dag" href="/booking" className="bg-[#FF5B00] text-white hover:bg-white hover:text-black" />
            </motion.div>
          </div>

          <div className="flex flex-col gap-6">
            {features.map((feature, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-6 p-8 rounded-3xl bg-[#121212] border border-white/5 hover:border-[#FF5B00]/30 transition-all duration-300 group"
              >
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-[#1a1a1a] flex items-center justify-center border border-white/5 group-hover:border-[#FF5B00]/50 transition-colors">
                  {feature.icon}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white mb-3 group-hover:text-[#FF5B00] transition-colors">{feature.title}</h4>
                  <p className="text-gray-400 leading-relaxed text-base">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
