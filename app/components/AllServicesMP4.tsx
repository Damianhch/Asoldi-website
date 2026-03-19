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
  videoSrc: string;
  link: string;
}

const services: Service[] = [
  {
    id: 1,
    title: 'Nettsideutvikling',
    description: 'Vi bygger moderne, raske og konverteringsoptimaliserte nettsider som gjør besøkende til kunder.',
    icon: <Search size={48} strokeWidth={1.5} />,
    color: 'bg-[#00E5FF]',
    videoSrc: '/media/website%20sevice%20animation.mp4',
    link: '/services/web-development',
  },
  {
    id: 2,
    title: 'Sosiale Medier',
    description: 'Vi hjelper deg med å dominere på Facebook og Instagram gjennom målrettet annonsering og innhold.',
    icon: <Megaphone size={48} strokeWidth={1.5} />,
    color: 'bg-[#00C853]',
    videoSrc: '/media/social%20media%20video.mp4',
    link: '/services/social-media',
  },
  {
    id: 3,
    title: 'Innholdsproduksjon',
    description: 'Profesjonell foto, video og tekst som fanger oppmerksomheten og bygger din merkevare.',
    icon: <FileText size={48} strokeWidth={1.5} />,
    color: 'bg-[#FFEA00]',
    videoSrc: '/media/video%20%26%20bilde%20produksjon.mp4',
    link: '/services/photo-video',
  },
  {
    id: 4,
    title: 'E-post Markedsføring',
    description: 'Konverter leads til lojale kunder med målrettede kampanjer og automatisering.',
    icon: <Mail size={48} strokeWidth={1.5} />,
    color: 'bg-[#FF00FF]',
    videoSrc: '/media/Email%20marketing%20video.mp4',
    link: '/services/email-marketing',
  },
];

const ServiceCard: React.FC<{
  service: Service;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}> = ({ service, isActive, onActivate, onDeactivate }) => {
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const play = () => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  };

  const pause = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    // IMPORTANT: do not reset currentTime; we want resume from the same spot.
  };

  useEffect(() => {
    if (!isActive) {
      pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return (
    <div
      className="min-w-[100%] md:min-w-[calc(50%-12px)] lg:min-w-[calc(33.333%-16px)] relative group h-[520px]"
      onMouseEnter={() => {
        setHovered(true);
        onActivate();
        play();
      }}
      onMouseLeave={() => {
        setHovered(false);
        onDeactivate();
        pause();
      }}
    >
      <div
        className={`absolute inset-0 rounded-2xl transition-all duration-200 ease-out ${service.color} group-hover:-inset-2 -translate-x-3 translate-y-3 group-hover:translate-x-0 group-hover:translate-y-0 pointer-events-none`}
      />

      <div className="relative bg-white rounded-2xl p-6 h-full flex flex-col">
        <h3 className="text-2xl font-medium text-black mb-4">{service.title}</h3>

        <div className="w-full aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4 relative">
          <video
            ref={videoRef}
            src={service.videoSrc}
            muted
            playsInline
            preload="auto"
            loop
            className="w-full h-full object-cover transition-all duration-200"
            style={{
              filter: hovered ? 'grayscale(0%)' : 'grayscale(100%)',
            }}
            onLoadedMetadata={() => {
              // Ensure we show the first frame immediately (paused).
              pause();
              const v = videoRef.current;
              if (v) v.currentTime = 0;
            }}
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

export const AllServicesMP4 = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsToShow, setCardsToShow] = useState(3);
  const [activeServiceId, setActiveServiceId] = useState<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setCardsToShow(1);
      else if (window.innerWidth < 1024) setCardsToShow(2);
      else setCardsToShow(3);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % services.length);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + services.length) % services.length);

  return (
    <section className="py-32 px-6 md:px-10 bg-[#050505] overflow-hidden">
      <div className="max-w-[1440px] mx-auto">
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

        <div className="relative -mx-6 md:-mx-10 px-6 md:px-10">
          <motion.div
            className="flex gap-6 pb-8"
            animate={{ x: `calc(-${currentIndex * (100 / cardsToShow)}% - ${currentIndex * 24}px)` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                isActive={activeServiceId === service.id}
                onActivate={() => setActiveServiceId(service.id)}
                onDeactivate={() => setActiveServiceId(null)}
              />
            ))}
          </motion.div>
        </div>

        <div className="flex justify-center mt-16">
          <Button
            text="Se alle tjenester"
            href="/services"
            className="bg-[#FF5B00] text-white hover:bg-white hover:text-black"
          />
        </div>
      </div>
    </section>
  );
};

