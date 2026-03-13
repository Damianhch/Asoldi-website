import React from 'react';

const marqueeImages = [
  "https://cdn.prod.website-files.com/6716051c7e279a14d3641f31/6738787f0a49bf6e4b18977c_home.jpg",
  "https://cdn.prod.website-files.com/6716051c7e279a14d3641f31/6738787f73b190ea1e2e76fd_about.jpg",
  "https://cdn.prod.website-files.com/6716051c7e279a14d3641f31/6738788081d888807ba243df_service.jpg",
  "https://cdn.prod.website-files.com/6716051c7e279a14d3641f31/67160d46adab88ed905bcfa9_solition-icon-04.svg",
  "https://cdn.prod.website-files.com/6716051c7e279a14d3641f31/6738787f4da80eda38568980_project.jpg",
  "https://cdn.prod.website-files.com/6716051c7e279a14d3641f31/673878b4548fcf4356a1484c_project-single.jpg",
  "https://cdn.prod.website-files.com/6716051c7e279a14d3641f31/6738787fe460f410acde8b80_blog.jpg",
  "https://cdn.prod.website-files.com/6716051c7e279a14d3641f31/6738787f14e6e06d839ba78f_blog-single.jpg",
  "https://cdn.prod.website-files.com/6716051c7e279a14d3641f31/6738787f42b050bada61e66c_contact.jpg"
];

export const Ticker = () => {
  return (
    <section className="py-20 overflow-hidden bg-[#050505]">
      <div className="flex w-full">
        <div className="flex animate-marquee gap-8 flex-shrink-0 items-center pr-8">
          {marqueeImages.map((url, index) => (
            <div 
              key={`1-${index}`} 
              className={`relative flex-shrink-0 w-[300px] md:w-[400px] aspect-[4/3] rounded-2xl overflow-hidden group ${url.endsWith('.svg') ? 'bg-[#1a1a1a]' : ''}`}
            >
              <img 
                src={url} 
                alt={url.endsWith('.svg') ? 'Asoldi ikon' : 'Asoldi prosjekter og tjenester'}
                className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${url.endsWith('.svg') ? 'object-contain p-10' : ''}`}
                referrerPolicy="no-referrer"
              />
            </div>
          ))}
        </div>
        <div className="flex animate-marquee gap-8 flex-shrink-0 items-center pr-8" aria-hidden="true">
          {marqueeImages.map((url, index) => (
            <div 
              key={`2-${index}`} 
              className={`relative flex-shrink-0 w-[300px] md:w-[400px] aspect-[4/3] rounded-2xl overflow-hidden group ${url.endsWith('.svg') ? 'bg-[#1a1a1a]' : ''}`}
            >
              <img 
                src={url} 
                alt=""
                aria-hidden="true" 
                className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${url.endsWith('.svg') ? 'object-contain p-10' : ''}`}
                referrerPolicy="no-referrer"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
