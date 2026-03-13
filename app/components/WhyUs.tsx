import React from 'react';
import { Button } from './Button';
import { motion } from 'motion/react';
import { CheckCircle2, TrendingUp, Search } from 'lucide-react';

export const WhyUs = () => {
  return (
    <section className="py-24 px-6 md:px-10 bg-[#050505]">
      <div className="max-w-[1440px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Text Content */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-2 lg:order-1"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-12 uppercase leading-none tracking-tight">
              Hvorfor velge <br />
              <span className="text-[#FF5B00]">å samarbeide med oss?</span>
            </h2>

            <div className="space-y-10">
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <CheckCircle2 className="text-[#FF5B00]" size={20} />
                  Resultater
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  Vi er ikke ferdige før du er fornøyd med resultatene. Vår forpliktelse er å fortsette å forbedre og iterere helt til du er 100% tilfreds.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <TrendingUp className="text-[#FF5B00]" size={20} />
                  Nye Muligheter
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  Som et studentdrevet byrå tilbyr vi premium tjenester til en lavere pris. Du får eksepsjonell verdi uten de høye kostnadene hos større byråer.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <Search className="text-[#FF5B00]" size={20} />
                  Transparens
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  Vi tror på full åpenhet. Du vet nøyaktig hva du betaler for, uten skjulte avgifter eller uventede kostnader. Vi er transparente med priser, tidslinjer og forventninger.
                </p>
              </div>
            </div>

            <div className="mt-12">
              <Button text="Lær mer om oss" href="/about" className="bg-[#FF5B00] text-white hover:bg-white hover:text-black" />
            </div>
          </motion.div>

          {/* Image */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-1 lg:order-2 relative"
          >
            <div className="relative rounded-[40px] overflow-hidden border border-white/10 aspect-[4/5] lg:aspect-square">
              <img 
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop" 
                alt="Asoldi Team" 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
            
            {/* Decorative Element */}
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#FF5B00]/10 rounded-full blur-3xl -z-10" />
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#FF5B00]/10 rounded-full blur-3xl -z-10" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};
