import React from 'react';

const websiteCaptureImages = [
  '/media/Svelstad.PNG',
  '/media/swich website.PNG',
  '/media/værnesbar website capture.PNG',
  '/media/Fifth.PNG',
  '/media/superhero capture.PNG',
  '/media/mong sushi capture.PNG',
];

type ImageMarqueeProps = {
  className?: string;
  /** Fills a parent frame (hero portrait slot) instead of a full-width section. */
  compact?: boolean;
};

const MarqueeTrack = ({
  copy,
  compact,
}: {
  copy: '1' | '2';
  compact: boolean;
}) => (
  <div
    className={
      compact
        ? 'flex h-full animate-marquee gap-3 flex-shrink-0 items-stretch pr-3'
        : 'flex animate-marquee gap-8 flex-shrink-0 items-center pr-8'
    }
    aria-hidden={copy === '2' ? true : undefined}
  >
    {websiteCaptureImages.map((src, index) => (
      <div
        key={`${copy}-${index}`}
        className={
          compact
            ? 'relative h-full aspect-[5/4] md:aspect-[3/4] flex-shrink-0 overflow-hidden bg-[#1a1a1a]'
            : 'relative flex-shrink-0 w-[280px] md:w-[360px] aspect-[16/9] rounded-2xl overflow-hidden group bg-[#1a1a1a]'
        }
      >
        <img
          alt={copy === '1' ? 'Asoldi kunde – nettside' : ''}
          aria-hidden={copy === '2' ? true : undefined}
          className={
            compact
              ? 'w-full h-full object-cover object-top'
              : 'w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105'
          }
          src={src}
        />
      </div>
    ))}
  </div>
);

export const ImageMarquee = ({ className = '', compact = false }: ImageMarqueeProps) => {
  if (compact) {
    return (
      <div className={`h-full w-full overflow-hidden ${className}`.trim()}>
        <div className="flex h-full w-max">
          <MarqueeTrack copy="1" compact />
          <MarqueeTrack copy="2" compact />
        </div>
      </div>
    );
  }

  return (
    <section className={`py-12 overflow-hidden bg-[#050505] ${className}`.trim()}>
      <div className="flex w-full">
        <MarqueeTrack copy="1" compact={false} />
        <MarqueeTrack copy="2" compact={false} />
      </div>
    </section>
  );
};
