import React from 'react';
import { ChevronDown } from 'lucide-react';
import { SEO } from '../components/SEO';
import { BUSINESS } from '../config';

/** Step cards for the right column — structure matches img 1 (stacked with margin) */
const STEPS = [
  { number: 1, title: 'Kontakt oss', description: 'Send inn referansen din via skjemaet.' },
  { number: 2, title: 'Kontakt bedriftseier', description: 'Vi tar kontakt med bedriften du har referert.' },
  { number: 3, title: 'Kunden betaler', description: 'Når kunden inngår avtale starter utbetalingen.' },
  { number: 4, title: 'Du blir betalt', description: 'Du mottar din kommisjon i henhold til avtalen.' },
];

/**
 * 1000kr page — white background, centered embeds with header padding,
 * employment form in white container, stacked step section (HTML structure).
 * Route: /1000kr
 */
export const Page1000kr = () => {
  return (
    <div className="min-h-screen bg-white text-[#050505]">
      <SEO
        title="1000kr – Asoldi"
        description="Bli ansatt hos asoldi media. Kjenner du ikke bedriftseiere kan du fortsatt tjene penger med oss."
        path="/1000kr"
      />

      {/* Main: top padding so content is never under fixed header on any viewport */}
      <main className="site-main pt-24 md:pt-28">
        <article className="ast-article-single">
          <div className="entry-content clear max-w-[1440px] mx-auto px-6 md:px-10">

            {/* Section 1: Referral Vercel embed — centered, full width within container */}
            <section className="w-full overflow-hidden mb-0">
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

            {/* Section 2: Arrow + heading + text */}
            <section className="w-full flex flex-col items-center justify-center py-8 md:py-12 px-6 bg-white">
              <div className="flex justify-center mb-4">
                <ChevronDown className="w-8 h-8 text-[#FF5B00]" aria-hidden />
              </div>
              <h2 className="text-2xl md:text-4xl font-medium text-[#050505] text-center mb-4">
                Bli ansatt hos {BUSINESS.shortName.toLowerCase()} media
              </h2>
              <p className="text-gray-600 text-center max-w-xl">
                Kjenner du ikke bedriftseiere kan du fortsatt tjene penger med oss
              </p>
            </section>

            {/* Section 3: Two-column — left = employment form in white container, right = stacked cards (HTML structure) */}
            <section
              className="e-flex e-con-boxed w-full max-w-6xl mx-auto pb-12 md:pb-16"
              data-id="583c880"
              data-element_type="container"
            >
              <div className="e-con-inner w-full flex flex-col lg:flex-row gap-8 lg:gap-12">
                {/* Left: Employment form in white background container — desktop */}
                <div
                  className="e-con-full hidden md:block e-flex flex-1 min-w-0"
                  data-id="1169ff7"
                  data-element_type="container"
                >
                  <div className="elementor-widget-container w-full">
                    <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-gray-100">
                      <iframe
                        src="https://employment-paginated-asoldi-form.vercel.app/"
                        title="Asoldi - Søknad"
                        width="100%"
                        height={440}
                        style={{ maxHeight: '430px', border: 'none' }}
                        loading="lazy"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Stacked cards (images-like section with margin) — exact structure */}
                <div className="e-con-full flex flex-col gap-6 flex-1 min-w-0 order-first lg:order-none">
                  {STEPS.map((step) => (
                    <div
                      key={step.number}
                      className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex gap-4 items-start"
                      style={{ marginBottom: 0 }}
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-[#050505] font-semibold">
                        {step.number}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-[#050505] mb-1">{step.title}</h3>
                        <p className="text-gray-600 text-sm">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Spacer containers matching HTML (empty nested divs for structure) */}
                <div className="e-con-full e-flex hidden" data-id="0d57232" aria-hidden="true">
                  <div className="e-con-full" data-id="6569a01">
                    <div className="e-con-full" data-id="d19297c">
                      <div className="e-con-full" data-id="8831719" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Employment form — mobile/tablet: same white container, full width */}
              <div className="e-con-inner w-full mt-8 md:hidden">
                <div className="elementor-widget-container w-full">
                  <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                    <iframe
                      src="https://employment-paginated-asoldi-form.vercel.app/"
                      title="Asoldi - Søknad"
                      width="100%"
                      height={440}
                      style={{ maxHeight: '430px', border: 'none' }}
                      loading="lazy"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </section>

          </div>
        </article>
      </main>
    </div>
  );
};
