import React from 'react';
import { ChevronDown } from 'lucide-react';
import { SEO } from '../components/SEO';
import { BUSINESS } from '../config';

/**
 * 1000kr page — structure and Vercel embeds match the original asoldi.com/1000kr/ HTML.
 * Route: /1000kr
 */
export const Page1000kr = () => {
  return (
    <div className="bg-[#050505] min-h-screen text-white">
      <SEO
        title="1000kr – Asoldi"
        description="Bli ansatt hos asoldi media. Kjenner du ikke bedriftseiere kan du fortsatt tjene penger med oss."
        path="/1000kr"
      />

      <main className="site-main">
        <article className="ast-article-single">
          <div className="entry-content clear">

            {/* Section 1: Referral Vercel embed — full width, exact iframe attributes from original */}
            <section className="w-full overflow-hidden">
              <div className="w-full overflow-hidden">
                <iframe
                  src="https://asoldi-referal-section.vercel.app"
                  width="100%"
                  height={1510}
                  frameBorder={0}
                  scrolling="auto"
                  style={{ border: 'none', width: '100%', minHeight: '1000px' }}
                  title="Asoldi referal"
                />
              </div>
            </section>

            {/* Section 2: Arrow + heading + text (from original) */}
            <section className="w-full flex flex-col items-center justify-center py-8 md:py-12 px-6 bg-[#050505]">
              <div className="flex justify-center mb-4">
                <ChevronDown className="w-8 h-8 text-[#FF5B00]" aria-hidden />
              </div>
              <h2 className="text-2xl md:text-4xl font-medium text-white text-center mb-4">
                Bli ansatt hos {BUSINESS.shortName.toLowerCase()} media
              </h2>
              <p className="text-gray-400 text-center max-w-xl">
                Kjenner du ikke bedriftseiere kan du fortsatt tjene penger med oss
              </p>
            </section>

            {/* Section 3: Employment form — desktop (hidden on tablet/mobile in original) */}
            <section className="w-full max-w-4xl mx-auto px-6 pb-6 hidden md:block">
              <div className="w-full overflow-hidden">
                <iframe
                  src="https://employment-paginated-asoldi-form.vercel.app/"
                  title="Asoldi - Søknad"
                  width="100%"
                  height={440}
                  style={{ maxHeight: '430px', border: 'none' }}
                  loading="lazy"
                />
              </div>
            </section>

            {/* Section 4: Employment form — mobile/tablet (hidden on desktop in original) */}
            <section className="w-full max-w-4xl mx-auto px-6 pb-12 md:hidden">
              <div className="w-full overflow-hidden">
                <iframe
                  src="https://employment-paginated-asoldi-form.vercel.app/"
                  title="Asoldi - Søknad"
                  width="100%"
                  height={440}
                  style={{ maxHeight: '430px', border: 'none' }}
                  loading="lazy"
                />
              </div>
            </section>

          </div>
        </article>
      </main>
    </div>
  );
};
