import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const SalesCTA = () => {
  return (
    <section className="py-24 px-6 md:px-10 bg-[#050505]">
      <div className="max-w-[1440px] mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-[#FF5B00] rounded-[40px] py-24 px-6 md:px-20 relative overflow-hidden text-center"
        >
          {/* Decorative Elements */}
          <motion.div 
            initial={{ opacity: 0, x: -20, y: 20 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: 0.2 }}
            className="absolute top-12 left-12 md:top-20 md:left-20 hidden md:block"
          >
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 50L50 10M50 10H20M50 10V40" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute top-12 right-12 md:top-20 md:right-20 hidden md:block"
          >
            <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M25 0C38.8071 0 50 11.1929 50 25C50 38.8071 38.8071 50 25 50C11.1929 50 0 38.8071 0 25C0 11.1929 11.1929 0 25 0ZM25 48C37.7025 48 48 37.7025 48 25C48 12.2975 37.7025 2 25 2C12.2975 2 2 12.2975 2 25C2 37.7025 12.2975 48 25 48Z" fill="white" fillOpacity="0.1"/>
              <path d="M25 25C25 12.5 35 12.5 35 0" stroke="white" strokeWidth="1.5"/>
              <path d="M25 25C25 37.5 15 37.5 15 50" stroke="white" strokeWidth="1.5"/>
              <path d="M25 25C12.5 25 12.5 15 0 15" stroke="white" strokeWidth="1.5"/>
              <path d="M25 25C37.5 25 37.5 35 50 35" stroke="white" strokeWidth="1.5"/>
            </svg>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, rotate: -45 }}
            whileInView={{ opacity: 1, rotate: 0 }}
            transition={{ delay: 0.4 }}
            className="absolute bottom-12 left-20 md:bottom-20 md:left-40 hidden md:block"
          >
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="26" height="26" stroke="white" strokeWidth="1.5" transform="rotate(45 15 15)"/>
              <rect x="8" y="8" width="14" height="14" stroke="white" strokeWidth="1.5" transform="rotate(45 15 15)"/>
            </svg>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="absolute bottom-12 right-20 md:bottom-24 md:right-40 hidden md:block"
          >
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.5"/>
            </svg>
          </motion.div>

          <div className="relative z-10 max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-12 leading-[1.1] tracking-tight">
              Er du klar for å ta bedriftens omsetning til neste nivå?
            </h2>
            
            <Link to="/booking">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white text-black px-10 py-5 rounded-full font-medium text-lg hover:text-[#FF5B00] transition-colors inline-flex items-center gap-2"
              >
                Book en gratis konsultasjon
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
