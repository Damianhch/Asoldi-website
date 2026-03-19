import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowLeft, Mail, Megaphone, Search, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './Button';

interface Service {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  videoId: string;
  link: string;
}

const services: Service[] = [
  {
    id: 1,
    title: "Nettsideutvikling",
    description: "Vi bygger moderne, raske og konverteringsoptimaliserte nettsider som gjør besøkende til kunder.",
    icon: <Search size={48} strokeWidth={1.5} />,
    color: "bg-[#00E5FF]",
    videoId: "tMSAgjjxWrc",
    link: "/services/web-development"
  },
  {
    id: 2,
    title: "Sosiale Medier",
    description: "Vi hjelper deg med å dominere på Facebook og Instagram gjennom målrettet annonsering og innhold.",
    icon: <Megaphone size={48} strokeWidth={1.5} />,
    color: "bg-[#00C853]",
    videoId: "e228EHq40c0",
    link: "/services/social-media"
  },
  {
    id: 3,
    title: "Innholdsproduksjon",
    description: "Profesjonell foto, video og tekst som fanger oppmerksomheten og bygger din merkevare.",
    icon: <FileText size={48} strokeWidth={1.5} />,
    color: "bg-[#FFEA00]",
    videoId: "0oZOl2XlkrY",
    link: "/services/photo-video"
  },
  {
    id: 4,
    title: "E-post Markedsføring",
    description: "Konverter leads til lojale kunder med målrettede kampanjer og automatisering.",
    icon: <Mail size={48} strokeWidth={1.5} />,
    color: "bg-[#FF00FF]",
    videoId: "OcuyhOafDCA",
    link: "/services/email-marketing"
  }
];

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;
const loadYouTubeIframeAPI = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const existing = document.getElementById('youtube-iframe-api');
    if (!existing) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    // YouTube will call this once the API is ready.
    window.onYouTubeIframeAPIReady = () => resolve();

    // If the API was already ready (race condition), resolve immediately.
    if (window.YT?.Player) resolve();
  });

  return ytApiPromise;
};

const ServiceCard: React.FC<{ service: Service; cardsToShow: number }> = ({ service, cardsToShow }) => {
  const [hovered, setHovered] = useState(false);
  const playerRef = useRef<any>(null);

  const playerId = useRef(`yt-service-${service.id}`).current;

  useEffect(() => {
    let cancelled = false;

    loadYouTubeIframeAPI().then(() => {
      if (cancelled) return;
      const YT = window.YT;
      if (!YT?.Player) return;

      // Ensure we don't leak old players during hot-reload.
      try {
        playerRef.current?.destroy?.();
      } catch {
        // ignore
      }

      playerRef.current = new YT.Player(playerId, {
        videoId: service.videoId,
        playerVars: {
          // Start playing quickly so the UI doesn't show a big play overlay.
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          playsinline: 1,
          mute: 1,
          loop: 1,
          playlist: service.videoId,
          enablejsapi: 1,
          disablekb: 1,
          cc_load_policy: 0,
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
        events: {
          onReady: () => {
            // Ensure playback starts; we never pause, so YouTube doesn't show
            // the big play overlay/title on hover.
            playerRef.current?.playVideo?.();
          },
        }
      });
    });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, [service.videoId, playerId]);

  const handleEnter = () => {
    setHovered(true);
  };

  const handleLeave = () => {
    setHovered(false);
  };

  return (
    <div 
      className={`min-w-[100%] md:min-w-[calc(50%-12px)] lg:min-w-[calc(33.333%-16px)] relative group h-[520px]`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
    >
      <style>{`
        /* Prevent YouTube UI overlays from reacting to hover/click inside the iframe. */
        .service-card-video iframe { pointer-events: none; }
      `}</style>

      {/* Colored background */}
      <div className={`absolute inset-0 rounded-2xl transition-all duration-200 ease-out ${service.color} group-hover:-inset-2 -translate-x-3 translate-y-3 group-hover:translate-x-0 group-hover:translate-y-0 pointer-events-none`} />
      
      {/* White box */}
      <div className="relative bg-white rounded-2xl p-6 h-full flex flex-col">
        <h3 className="text-2xl font-medium text-black mb-4">{service.title}</h3>
        
        <div className="w-full aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4 relative">
          <div
            id={playerId}
            className="service-card-video absolute inset-0 w-full h-full transition-all duration-200"
            style={{ filter: hovered ? 'grayscale(0%)' : 'grayscale(100%)' }}
          />
        </div>

        <p className="text-gray-600 mb-6 flex-grow text-lg leading-relaxed">{service.description}</p>
        
        <Link 
          to={service.link} 
          className="block w-full text-center bg-[#FF5B00] text-white py-4 rounded-lg font-medium hover:bg-[#e65200] transition-colors"
        >
          Les om tjenesten
        </Link>
      </div>
    </div>
  );
};

export const AllServices = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsToShow, setCardsToShow] = useState(3);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setCardsToShow(1);
      } else if (window.innerWidth < 1024) {
        setCardsToShow(2);
      } else {
        setCardsToShow(3);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % services.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + services.length) % services.length);
  };

  return (
    <section className="py-32 px-6 md:px-10 bg-[#050505] overflow-hidden">
      <div className="max-w-[1440px] mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-[2px] bg-[#FF5B00]" />
              <span className="text-[#FF5B00] font-medium tracking-wider uppercase">Våre Tjenester</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-medium text-white max-w-2xl leading-tight">
              Tjenester som skaper <span className="text-[#FF5B00] font-serif italic">ekte vekst</span> for din bedrift
            </h2>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={prevSlide}
              className="w-14 h-14 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center text-white hover:bg-[#FF5B00] hover:text-white transition-all duration-300 group"
            >
              <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={nextSlide}
              className="w-14 h-14 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center text-white hover:bg-[#FF5B00] hover:text-white transition-all duration-300 group"
            >
              <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Slider */}
        <div className="relative -mx-6 md:-mx-10 px-6 md:px-10">
          <motion.div 
            className="flex gap-6 pb-8"
            animate={{ x: `calc(-${currentIndex * (100 / cardsToShow)}% - ${currentIndex * 24}px)` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} cardsToShow={cardsToShow} />
            ))}
          </motion.div>
        </div>

        <div className="flex justify-center mt-16">
          <Button text="Se alle tjenester" href="/services" className="bg-[#FF5B00] text-white hover:bg-white hover:text-black" />
        </div>

      </div>
    </section>
  );
};
