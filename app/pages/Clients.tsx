import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { BUSINESS } from '../config';

interface ClientData {
  id: string;
  name: string;
  logoUrl: string;
  serviceProvided: string;
  backgroundImageUrl: string;
  description: string;
  dashboardImageUrl: string;
  stats: {
    value: string;
    label: string;
  }[];
  websiteUrl: string;
}

const clients: ClientData[] = [
  {
    id: 'superhero-burger',
    name: 'SUPERHERO\nBURGER',
    logoUrl: '/media/logo.jpg',
    serviceProvided: 'Nettside utvikling',
    backgroundImageUrl: '/media/superhero capture.PNG',
    description: 'VI HÅNDTERER GJENNOMSNITTELIG 320 UNIKE BESØKENDE HVER DAG GJENNOM UTVIKLINGEN AV NETTSIDEN, UTEN DETTE VIL DISSE KUNDENE IKKE FÅTT DEN INFORMASJONEN DE VAR UTE ETTER.',
    dashboardImageUrl: '/media/superhero capture.PNG',
    stats: [
      { value: '9600', label: 'besøkende / mnd' },
      { value: '3%+', label: 'konversjon' }
    ],
    websiteUrl: '#'
  },
  {
    id: 'svelstad-gardsbruk',
    name: 'SVELSTAD\nGÅRDSBRUK',
    logoUrl: '/media/Uten-navn-1000-x-500-px3.webp',
    serviceProvided: 'Nettside utvikling',
    backgroundImageUrl: '/media/Svelstad.PNG',
    description: 'MULIGHET TIL Å BESTILLE GJENNOM MAILING SYSTEM, SAMT OPPRETTELSE AV EMAIL LISTE FOR FREMTIDIGE SALGSNYHETER. DETTE PROSJEKTET SIGNALISERTE EN NY BEGYNNELSE FOR SVELSTAD PÅ NETT.',
    dashboardImageUrl: '/media/Svelstad.PNG',
    stats: [
      { value: '4', label: 'bestillinger etter 1 uke' },
      { value: '20', label: 'nye kunde emails' }
    ],
    websiteUrl: '#'
  },
  {
    id: 'vaernes-bar',
    name: 'VÆRNES\nBAR',
    logoUrl: '/media/Untitled_design__13_-removebg-preview.png',
    serviceProvided: 'Nettside utvikling',
    backgroundImageUrl: '/media/værnesbar website capture.PNG',
    description: 'LAR KUNDE BESTILLE OVER NETT, SENDE KUNDE HENVENDELSER, OG BOOKE BORD, EN HELHETLIG OG PROFESJONELL RESTAURANT LØSNING SOM LAR KUNDEN BESTILLE DET DEN VIL.',
    dashboardImageUrl: '/media/værnesbar website capture.PNG',
    stats: [
      { value: '#1', label: 'ranking på google' },
      { value: '800', label: 'besøkende første mnd' }
    ],
    websiteUrl: '#'
  },
  {
    id: 'mong-sushi',
    name: 'MONG\nSUSHI',
    logoUrl: '/media/mong sushi logo.webp',
    serviceProvided: 'Nettside utvikling',
    backgroundImageUrl: '/media/mong sushi capture.PNG',
    description: 'ØKTE TILSTEDEVÆRELSE PÅ NETT VED Å VISE MENY, BILDER AV LOKASJON OG GIR KUNDER MULIGHET TIL Å BESTILLE TAKEAWAY OG SENDE KUNDE HENVENDELSER PÅ EN LETT OG ENKEL MÅTE.',
    dashboardImageUrl: '/media/mong sushi capture.PNG',
    stats: [
      { value: '8%+', label: 'konversjonsrate' },
      { value: '1200', label: 'besøkende / mnd' }
    ],
    websiteUrl: '#'
  },
  {
    id: 'swich-restaurant',
    name: 'S\'WICH\nRESTAURANT',
    logoUrl: '/media/7444a9e70b64378cb31902781eb700f98431feee.webp',
    serviceProvided: 'Nettside utvikling',
    backgroundImageUrl: '/media/swich website.PNG',
    description: 'RANKER NR 3 I SØKEORD “RESTAURANT” I TRONDHEIM ETTER 1 UKE MED NETTSIDE. MÅLET VAR MER EKSPONERING PÅ GOOGLE OG GOOGLE MAPS, OG DET VAR NOE VI KLARTE Å OPPNÅ.',
    dashboardImageUrl: '/media/swich website.PNG',
    stats: [
      { value: '#3', label: 'ranking på google' },
      { value: '1400', label: 'besøkende / mnd' }
    ],
    websiteUrl: '#'
  }
];

export const Clients = () => {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const element = document.getElementById(hash.replace('#', ''));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [hash]);

  return (
    <div className="bg-[#050505] min-h-screen">
      <SEO
        title={`Kundecaser – ${BUSINESS.shortName} | Suksesshistorier fra våre kunder`}
        description="Se hvordan vi har hjulpet Superhero Burger, Svelstad, Mong Sushi og andre med nettsider og markedsføring. Kundecaser fra Asoldi."
        path="/clients"
      />
      {/* Hero Section */}
      <section className="relative h-screen w-full pt-20 overflow-hidden">
        {/* Floating balls background */}
        <div className="absolute inset-0 pointer-events-none">
           <div className="absolute top-[10%] left-[-10%] w-[400px] md:w-[550px] h-[400px] md:h-[550px] bg-[#FF5B00] rounded-full blur-[100px] md:blur-[130px] opacity-40" />
           <div className="absolute bottom-[-10%] right-[-10%] w-[500px] md:w-[650px] h-[500px] md:h-[650px] bg-[#FF5B00] rounded-full blur-[100px] md:blur-[130px] opacity-40" />
        </div>

        <div className="relative z-10 h-full max-w-[1600px] mx-auto px-6 md:px-12 flex flex-col items-start justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-white/70 text-lg md:text-xl mb-2 font-light tracking-wide">
              Utforsk vårt kreative landskap
            </p>
            <h1 
              className="text-6xl md:text-8xl lg:text-[120px] text-white uppercase tracking-tight mb-12 leading-none" 
              style={{ fontFamily: '"Anton", sans-serif' }}
            >
              ASOLDI ARKIVET
            </h1>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8">
              <div className="border border-white/30 rounded-2xl p-4 md:p-6 flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-xl md:text-2xl font-medium text-white">Scroll for å</span>
                  <span className="text-xl md:text-2xl font-medium text-white">fortsette</span>
                </div>
                <div className="w-8 h-12 rounded-[16px] border-2 border-white flex justify-center p-1.5 shrink-0">
                  <motion.div 
                    animate={{ y: [0, 12, 0] }} 
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    className="w-1 h-2.5 bg-white rounded-full"
                  />
                </div>
              </div>
              
              <div className="text-white/60 text-lg md:text-xl font-light">
                <span className="text-white font-medium">10+</span> partnere så langt
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Client Sections */}
      {clients.map((client, index) => (
        <section 
          key={client.id} 
          id={client.id}
          className="relative h-screen w-full flex items-center justify-center overflow-hidden pt-24 pb-8"
        >
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 z-0">
            <img 
              src={client.backgroundImageUrl} 
              alt="Background" 
              className="w-full h-full object-cover" 
            />
            <div className="absolute inset-0 bg-black/80" /> {/* Dark overlay */}
          </div>

          {/* Top Separator & Number */}
          <div className="absolute top-0 left-0 w-full z-20">
            <div className="w-full h-[1px] bg-white/20" />
            <div className="w-full max-w-[1600px] mx-auto px-6 md:px-12">
              <div className="pt-4 text-white/40 text-sm md:text-base font-mono tracking-widest">
                {String(index + 1).padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* Content Container */}
          <div className="relative z-10 w-full h-full max-w-[1600px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            
            {/* Left Column */}
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="flex flex-col text-white"
            >
              {/* Top Row: Logo & Service */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 bg-black/50 flex items-center justify-center shrink-0">
                  <img src={client.logoUrl} alt={`${client.name} logo`} className="w-full h-full object-cover" />
                </div>
                <div className="flex items-center gap-3 text-lg md:text-xl font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                  <span>{client.serviceProvided}</span>
                </div>
              </div>

              {/* Main Title */}
              <h2 
                className="text-5xl md:text-7xl lg:text-[90px] leading-[0.9] tracking-tight mb-6 whitespace-pre-line uppercase"
                style={{ fontFamily: '"Anton", sans-serif' }}
              >
                {client.name}
              </h2>

              {/* Description */}
              <p className="text-sm md:text-base font-medium uppercase tracking-wide leading-relaxed max-w-xl text-white/80 mb-8">
                {client.description}
              </p>

              {/* Button */}
              <div className="flex justify-start mt-2">
                <a 
                  href={client.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-white text-black px-10 py-4 rounded-2xl text-center hover:bg-gray-200 transition-colors uppercase tracking-wide text-xl md:text-2xl"
                  style={{ fontFamily: '"Anton", sans-serif' }}
                >
                  SE NETTSIDE
                </a>
              </div>
            </motion.div>

            {/* Right Column */}
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex flex-col gap-4 w-full h-full justify-center max-w-2xl mx-auto lg:mx-0 lg:ml-auto"
            >
              {/* Dashboard Image */}
              <div className="w-full h-[35vh] lg:h-[45vh] rounded-2xl overflow-hidden shadow-2xl bg-white/5 border border-white/10 shrink-0">
                <img src={client.dashboardImageUrl} alt="Analytics Dashboard" className="w-full h-full object-cover" />
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-4 shrink-0">
                {client.stats.map((stat, idx) => (
                  <div key={idx} className="bg-white rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center text-center shadow-xl">
                    <div 
                      className="text-5xl md:text-6xl text-black leading-none mb-2"
                      style={{ fontFamily: '"Anton", sans-serif' }}
                    >
                      {stat.value}
                    </div>
                    <div className="text-black/80 font-medium text-xs md:text-sm uppercase tracking-wider">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

          </div>
        </section>
      ))}
    </div>
  );
};
