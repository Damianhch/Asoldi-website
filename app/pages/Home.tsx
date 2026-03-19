import React from 'react';
import { Hero } from '../components/Hero';
import { ImageMarquee } from '../components/ImageMarquee';
import { AllServicesMP4 } from '../components/AllServicesMP4';
import { Ticker } from '../components/Ticker';
import { Features } from '../components/Features';
import { WhyUs } from '../components/WhyUs';
import { VideoIntro } from '../components/VideoIntro';
import { CaseStudies } from '../components/CaseStudies';
import { OurProcess } from '../components/OurProcess';
import { SalesCTA } from '../components/SalesCTA';
import { Testimonial } from '../components/Testimonial';
import { FAQ } from '../components/FAQ';
import { PackageDeals } from '../components/PackageDeals';
import { SEO } from '../components/SEO';
import { getLocalBusinessSchema } from '../structuredData';
import { BUSINESS } from '../config';

export const Home = () => {
  return (
    <>
      <SEO
        title={`${BUSINESS.shortName} – Digitalt byrå Trondheim | Nettsider & Markedsføring`}
        description={BUSINESS.description}
        path="/"
        structuredData={getLocalBusinessSchema()}
      />
      <Hero />
      <ImageMarquee />
      <Features />
      <AllServicesMP4 />
      <VideoIntro />
      <CaseStudies />
      <OurProcess />
      <WhyUs />
      <PackageDeals />
      <SalesCTA />
      <Testimonial />
      <FAQ />
    </>
  );
};
