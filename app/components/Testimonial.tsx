import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Quote, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface TestimonialData {
  id: number;
  name: string;
  role: string;
  business: string;
  image: string;
  verified: string;
  quote: string;
  highlight: string;
}

const testimonials: TestimonialData[] = [
  {
    id: 1,
    name: "Christopher Vrioni",
    role: "Superhero Burger AS",
    business: "Superhero burger & superhero pizza",
    image: "/media/christopher.avif",
    verified: "Verifisert via Google",
    quote:
      "Super happy with the website these guys made for us at superhero burger & superhero pizza (superheroinvest.no). They really done a good job... the whole process was smooth from start to finish. The site is clean, easy to use, and does exactly what we need it to. They were quick to respond whenever we had questions and made sure everything worked perfectly.",
    highlight: "",
  },
  {
    id: 2,
    name: "Naing Zaw Win",
    role: "Mong Sushi",
    business: "",
    image: "/media/naing%20zaw%20win.jpg",
    verified: "Verifisert via Google",
    quote: "Veldig fornøyd, veldig glad.",
    highlight: "",
  },
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
    <section className="py-32 px-0 md:px-10 bg-[#050505]">
      <div className="max-w-[1440px] mx-auto w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-[#121212] rounded-none md:rounded-[48px] p-6 md:p-12 lg:p-20 border-0 md:border border-white/5 relative overflow-hidden min-h-[500px] md:min-h-[600px] flex flex-col justify-center"
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
              className="relative z-10 flex flex-col gap-10 md:gap-16 px-6 md:px-16"
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
                  <p className="text-xl text-gray-400 mb-4">
                    {current.role}
                    {current.business ? ', ' : ''}
                    {current.business ? <span className="text-white">{current.business}</span> : null}
                  </p>
                  
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                    <CheckCircle size={16} className="text-[#FF5B00]" />
                    <span className="text-sm text-gray-300">{current.verified}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Section: Testimonial Text */}
              <div className="border-t border-white/10 pt-8 md:pt-12 text-center">
                <p className="text-xl md:text-3xl lg:text-5xl xl:text-6xl font-serif italic text-white leading-[1.2] md:leading-[1.1]">
                  {"\""}
                  {current.quote}
                  {current.highlight ? (
                    <span className="text-[#FF5B00]">{current.highlight}</span>
                  ) : null}
                  {"\""}
                </p>
              </div>

            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
};
