import React from 'react';

const websiteCaptureImages = [
  '/media/Svelstad.PNG',
  '/media/swich website.PNG',
  '/media/værnesbar website capture.PNG',
  '/media/Fifth.PNG',
  '/media/superhero capture.PNG',
  '/media/mong sushi capture.PNG',
];

export const ImageMarquee = () => {
  return (
    <section className="py-12 overflow-hidden bg-[#050505]">
      <div className="flex w-full">
        <div className="flex animate-marquee gap-8 flex-shrink-0 items-center pr-8">
          {websiteCaptureImages.map((src, index) => (
            <div key={`1-${index}`} className="relative flex-shrink-0 w-[280px] md:w-[360px] aspect-[16/9] rounded-2xl overflow-hidden group bg-[#1a1a1a]">
              <img
                alt="Asoldi kunde – nettside"
                className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                src={src}
              />
            </div>
          ))}
        </div>
        <div className="flex animate-marquee gap-8 flex-shrink-0 items-center pr-8" aria-hidden="true">
          {websiteCaptureImages.map((src, index) => (
            <div key={`2-${index}`} className="relative flex-shrink-0 w-[280px] md:w-[360px] aspect-[16/9] rounded-2xl overflow-hidden group bg-[#1a1a1a]">
              <img
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                src={src}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
