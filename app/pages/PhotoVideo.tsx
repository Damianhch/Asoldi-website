import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, PenTool, Code2, Rocket, Network } from 'lucide-react';
import { FAQ } from '../components/FAQ';
import { PricingCTA } from '../components/PricingCTA';
import { SEO } from '../components/SEO';
import { getServiceSchema } from '../structuredData';
import { BUSINESS, SITE_URL } from '../config';

const ServiceCard: React.FC<{ service: any }> = ({ service }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div 
      className="relative group h-full"
      onMouseEnter={() => {
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      }}
      onMouseLeave={() => {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }}
    >
      {/* Colored background */}
      <div className={`absolute inset-0 rounded-2xl transition-all duration-200 ease-out ${service.color} group-hover:-inset-2 -translate-x-3 translate-y-3 group-hover:translate-x-0 group-hover:translate-y-0 pointer-events-none`} />
      
      {/* White box */}
      <div className="relative bg-white rounded-2xl p-6 h-full flex flex-col">
        <h3 className="text-xl font-medium text-black mb-4">{service.name}</h3>
        
        <div className="w-full aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4 relative">
          <video 
            ref={videoRef}
            muted 
            playsInline
            loop
            className="w-full h-full object-cover"
          >
            <source src={service.video} type="video/mp4" />
          </video>
        </div>

        <p className="text-gray-600 mb-6 flex-grow">{service.desc}</p>
        
        <Link 
          to={service.link} 
          className="block w-full text-center bg-[#FF5B00] text-white py-3 rounded-lg font-medium hover:bg-[#e65200] transition-colors"
        >
          Les om tjenesten
        </Link>
      </div>
    </div>
  );
};

export const PhotoVideo = () => {
  const processRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: processRef,
    offset: ["start center", "end center"]
  });
  
  const line1Progress = useTransform(scrollYProgress, [0, 0.33], [0, 1]);
  const line2Progress = useTransform(scrollYProgress, [0.33, 0.66], [0, 1]);
  const line3Progress = useTransform(scrollYProgress, [0.66, 1], [0, 1]);
  const lineProgresses = [line1Progress, line2Progress, line3Progress];

  const partners = ['Svelstad', 'Swich', 'Mong Sushi', 'Superhero Invest', 'Værnes Bar', 'Arman V'];

  const caseStudies = [
    { name: 'Svelstad.no', category: 'Nettsideutvikling', image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80' },
    { name: 'Swich.no', category: 'Sosiale Medier', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80' },
    { name: 'Mongsushi.no', category: 'Digital Markedsføring', image: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?auto=format&fit=crop&q=80' },
  ];

  const processSteps = [
    { 
      title: 'Konsept.', 
      description: 'Vi utvikler en kreativ retning som stemmer overens med din merkevareidentitet og dine mål for kampanjen.', 
      icon: <Network size={48} strokeWidth={1.5} className="text-[#FF5B00]" /> 
    },
    { 
      title: 'Produksjon.', 
      description: 'Vårt team av fotografer og videografer fanger innhold av høy kvalitet ved hjelp av profesjonelt utstyr og teknikker.', 
      icon: <PenTool size={48} strokeWidth={1.5} className="text-[#FF5B00]" /> 
    },
    { 
      title: 'Etterarbeid.', 
      description: 'Vi redigerer, fargekorrigerer og legger på lydeffekter for å skape et polert sluttprodukt som skiller seg ut.', 
      icon: <Code2 size={48} strokeWidth={1.5} className="text-[#FF5B00]" /> 
    },
    { 
      title: 'Levering.', 
      description: 'Vi leverer innholdet i alle formater du trenger for dine digitale kanaler, klare til å skape engasjement.', 
      icon: <Rocket size={48} strokeWidth={1.5} className="text-[#FF5B00]" /> 
    },
  ];

  const otherServices = [
    { 
      name: 'Nettsideutvikling', 
      desc: 'Vi bygger raske, moderne og konverteringsoptimaliserte nettsider.', 
      link: '/services/web-development',
      color: 'bg-[#00E5FF]',
      video: 'https://cdn.coverr.co/videos/coverr-typing-on-a-macbook-pro-2-5274/1080p.mp4'
    },
    { 
      name: 'Sosiale Medier', 
      desc: 'Engasjer dine følgere og få nye leads for din bedrift.', 
      link: '/services/social-media',
      color: 'bg-[#00C853]',
      video: 'https://cdn.coverr.co/videos/coverr-typing-on-a-macbook-pro-2-5274/1080p.mp4'
    },
    { 
      name: 'E-post Markedsføring', 
      desc: 'Konverter leads til lojale kunder med målrettede kampanjer.', 
      link: '/services/email-marketing',
      color: 'bg-[#FF00FF]',
      video: 'https://cdn.coverr.co/videos/coverr-typing-on-a-macbook-pro-2-5274/1080p.mp4'
    },
  ];

  return (
    <div className="bg-[#050505] min-h-screen">
      <SEO
        title={`Innholdsproduksjon & Foto/Video – ${BUSINESS.shortName} | Trondheim`}
        description="Profesjonell foto- og videoproduksjon for nettsider og sosiale medier. Kreativt innhold som fanger merkevaren din."
        path="/services/photo-video"
        structuredData={getServiceSchema('Innholdsproduksjon', 'Foto og videoproduksjon for bedrifter.', SITE_URL + '/services/photo-video')}
      />
      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-screen flex flex-col pt-24">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-[#050505] pointer-events-none">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#FF5B00]/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
        </div>
        
        <div className="flex-grow flex items-center max-w-7xl mx-auto w-full px-6 md:px-10 relative z-10 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center w-full">
            {/* Left Content */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-block px-4 py-2 rounded-full border border-white/10 bg-white/5 text-white/80 text-sm font-medium mb-6 uppercase tracking-wider">
                Innholdsproduksjon
              </div>
              <h1 className="text-5xl md:text-7xl lg:text-[80px] font-medium text-white mb-6 tracking-tight leading-[1.05]">
                Slående visuelt,<br /><span className="text-[#FF5B00]">sterke historier</span>
              </h1>
              <p className="text-lg md:text-xl lg:text-2xl text-white/60 font-light mb-10 max-w-lg leading-relaxed">
                Fang din merkevares historie. Oppdag hvorfor bedrifter stoler på oss med sin foto- og videoproduksjon.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                <Link to="/booking" className="w-full sm:w-auto bg-[#FF5B00] text-white px-8 py-4 rounded-full font-medium hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-2 text-lg">
                  Book et møte <ArrowRight size={20} />
                </Link>
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {[
                      { src: '/media/christopher.avif', alt: 'Christopher' },
                      { src: '/media/arman%20vestad.webp', alt: 'Arman' },
                      { src: '/media/ali.PNG', alt: 'Ali' },
                    ].map((img, i) => (
                      <div key={i} className="w-10 h-10 rounded-full border-2 border-[#050505] bg-gray-600 overflow-hidden">
                        <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-white">50+ Fornøyde Kunder</div>
                    <div className="text-[#FF5B00] text-xs font-medium">★ 5.0/5 Vurdering</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Video */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#111]"
            >
              <iframe
                title="Video/Foto video"
                src="https://www.youtube.com/embed/0oZOl2XlkrY?autoplay=1&mute=1&loop=1&playlist=0oZOl2XlkrY&controls=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1"
                frameBorder={0}
                allow="autoplay; encrypted-media"
                allowFullScreen
                className="w-full h-full"
              />
            </motion.div>
          </div>
        </div>

        {/* Partners Scroll */}
        <div className="w-full py-8 border-t border-white/5 bg-white/5 relative z-10 overflow-hidden">
          <div className="flex w-full opacity-50 grayscale">
            <div className="flex animate-marquee gap-8 md:gap-16 flex-shrink-0 items-center pr-8 md:pr-16">
              {[...partners, ...partners, ...partners].map((partner, i) => (
                <div key={`partner-1-${i}`} className="text-xl md:text-2xl font-bold text-white tracking-wider uppercase whitespace-nowrap">
                  {partner}
                </div>
              ))}
            </div>
            <div className="flex animate-marquee gap-8 md:gap-16 flex-shrink-0 items-center pr-8 md:pr-16" aria-hidden="true">
              {[...partners, ...partners, ...partners].map((partner, i) => (
                <div key={`partner-2-${i}`} className="text-xl md:text-2xl font-bold text-white tracking-wider uppercase whitespace-nowrap">
                  {partner}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Case Studies */}
      <section className="py-16 md:py-24 max-w-7xl mx-auto px-6 md:px-10">
        <div className="mb-12 md:mb-16 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="text-left">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium text-white mb-4">Case Studies</h2>
            <p className="text-lg md:text-xl text-white/60 font-light max-w-2xl">Se hvordan vi har hjulpet bedrifter med å transformere sin digitale tilstedeværelse.</p>
          </div>
          <Link to="/case-studies" className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 rounded-full border border-white/20 text-white hover:bg-white/10 transition-colors whitespace-nowrap">
            Se alle
          </Link>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {caseStudies.map((study, i) => (
            <Link to="/case-studies" key={i} className="group block">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-6 relative">
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10" />
                <img 
                  src={study.image} 
                  alt={study.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="text-sm text-[#FF5B00] mb-2">{study.category}</div>
              <h3 className="text-2xl font-medium text-white group-hover:text-[#FF5B00] transition-colors flex items-center justify-between">
                {study.name}
                <ArrowRight className="opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </h3>
            </Link>
          ))}
        </div>
      </section>

      {/* 3-Step Process */}
      <section ref={processRef} className="py-16 md:py-24 bg-[#050505] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center mb-16">
            <h2 className="text-[#FF5B00] font-bold tracking-widest uppercase text-sm mb-4">VÅR PROSESS</h2>
            
            {/* Summarized Icons Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:flex md:justify-center items-center gap-8 md:gap-24 mt-12 mb-16 md:mb-24">
              {processSteps.map((step, i) => (
                <div key={`summary-${i}`} className="flex flex-col items-center gap-4 text-center">
                  <div className="text-[#FF5B00]">
                    {React.cloneElement(step.icon as React.ReactElement, { size: 32 })}
                  </div>
                  <span className="text-white/80 text-sm font-medium">{step.title.replace('.', '')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative max-w-5xl mx-auto">
            <div className="space-y-20 md:space-y-32">
              {processSteps.map((step, i) => (
                <div key={i} className={`relative flex flex-col md:flex-row items-center gap-8 md:gap-24 ${i % 2 === 0 ? '' : 'md:flex-row-reverse'}`}>
                  
                  {/* Text Content */}
                  <div className="w-full md:w-1/2 text-center md:text-left">
                    <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6">{step.title}</h3>
                    <p className="text-base md:text-lg lg:text-xl text-white/60 font-light leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  {/* Icon Graphic */}
                  <div className="w-full md:w-1/2 flex justify-center relative">
                    <div className="relative z-10 text-[#FF5B00]">
                      {React.cloneElement(step.icon as React.ReactElement, { className: "text-[#FF5B00]" })}
                    </div>
                  </div>

                  {/* Connecting Lines (Desktop only) */}
                  {i < processSteps.length - 1 && (
                    <div className="hidden md:block absolute top-[100%] left-0 right-0 h-32 pointer-events-none z-0">
                      <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <defs>
                          <linearGradient id={`process-line-gradient-${i}`} x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="rgba(255,91,0,0.1)" />
                            <stop offset="100%" stopColor="rgba(255,91,0,0.8)" />
                          </linearGradient>
                        </defs>
                        {i % 2 === 0 ? (
                          // Line from left to right (rigid square)
                          <motion.path 
                            d="M 25 0 L 25 50 L 75 50 L 75 100" 
                            stroke={`url(#process-line-gradient-${i})`}
                            strokeWidth="2" 
                            fill="none" 
                            style={{ pathLength: lineProgresses[i] }}
                          />
                        ) : (
                          // Line from right to left (rigid square)
                          <motion.path 
                            d="M 75 0 L 75 50 L 25 50 L 25 100" 
                            stroke={`url(#process-line-gradient-${i})`}
                            strokeWidth="2" 
                            fill="none" 
                            style={{ pathLength: lineProgresses[i] }}
                          />
                        )}
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <PricingCTA serviceName="Innholdsproduksjon" />

      {/* Other Services */}
      <section className="py-16 md:py-32 relative overflow-hidden">
        {/* Floating balls background */}
        <div className="absolute inset-0 pointer-events-none">
           <div className="absolute top-[10%] left-[-10%] w-[400px] md:w-[550px] h-[400px] md:h-[550px] bg-[#FF5B00] rounded-full blur-[100px] md:blur-[130px] opacity-20" />
           <div className="absolute bottom-[-10%] right-[-10%] w-[500px] md:w-[650px] h-[500px] md:h-[650px] bg-[#FF5B00] rounded-full blur-[100px] md:blur-[130px] opacity-20" />
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-10 relative z-10">
          <div className="mb-12 md:mb-16 text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium text-white mb-4">Voks din bedrift</h2>
            <p className="text-lg md:text-xl text-white/60 font-light">Les om våre andre tjenester</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
            {otherServices.map((service, i) => (
              <ServiceCard key={i} service={service} />
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FAQ />
    </div>
  );
};
