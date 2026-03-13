import React from 'react';
import { ChevronDown } from 'lucide-react';
import { SEO } from '../components/SEO';
import { BUSINESS } from '../config';

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

            {/* Transition + employment block: less gap, soft gradient so it doesn't feel cramped */}
            <div className="w-full bg-gradient-to-b from-orange-50/40 via-orange-50/20 to-white pt-4 md:pt-6">
              {/* Section 2: Arrow + heading + text */}
              <section className="w-full flex flex-col items-center justify-center py-4 md:py-6 px-6">
                <div className="flex justify-center mb-3">
                  <ChevronDown className="w-8 h-8 text-[#FF5B00]" aria-hidden />
                </div>
                <h2 className="text-2xl md:text-4xl font-medium text-[#050505] text-center mb-3">
                  Bli ansatt hos {BUSINESS.shortName.toLowerCase()} media
                </h2>
                <p className="text-gray-600 text-center max-w-xl">
                  Kjenner du ikke bedriftseiere kan du fortsatt tjene penger med oss
                </p>
              </section>

              {/* Section 3: Two-column — 40% contact form, 60% image container; no overflow, equal height on lg */}
            <section
              className="e-flex e-con-boxed w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pb-12 md:pb-16 box-border"
              data-id="583c880"
              data-element_type="container"
            >
              <div className="e-con-inner w-full min-w-0 flex flex-col lg:flex-row gap-8 lg:gap-8 xl:gap-10 items-stretch">
                {/* Left: Employment form — 40% width, can shrink to fix overflow */}
                <div
                  className="e-con-full hidden md:flex e-flex flex-[1_1_40%] min-w-0 flex-col min-h-[420px] md:min-h-[520px]"
                  data-id="1169ff7"
                  data-element_type="container"
                >
                  <div className="elementor-widget-container w-full flex-1 min-h-0 flex flex-col">
                    <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-gray-100 flex-1 min-h-0 flex flex-col">
                      <iframe
                        src="https://employment-paginated-asoldi-form.vercel.app/"
                        title="Asoldi - Søknad"
                        width="100%"
                        height={520}
                        style={{ minHeight: '460px', border: 'none' }}
                        loading="lazy"
                        className="w-full flex-1 min-h-0"
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Layered employee images — 60% width; aspect ratio on xl only, equal height on lg */}
                <div
                  className="e-con-full e-flex flex-[1_1_60%] min-w-0 order-first lg:order-none overflow-visible"
                  data-id="0d57232"
                  data-element_type="container"
                >
                  {/* xl: aspect ratio; lg: h-full; phone: shorter by default (max-height cap) */}
                  <div
                    className="e-con-full e-flex w-full min-w-0 overflow-visible h-full min-h-[200px] max-h-[220px] sm:min-h-[240px] sm:max-h-[280px] md:min-h-[320px] md:max-h-none aspect-[2404/1468] lg:aspect-auto lg:min-h-0 lg:max-h-none xl:aspect-[2404/1468]"
                    data-id="6569a01"
                    data-element_type="container"
                  >
                    <div
                      className="e-con-full e-flex w-full h-full overflow-visible"
                      data-id="d19297c"
                      data-element_type="container"
                    >
                      <div
                        className="e-con-full e-flex w-full h-full rounded-2xl shadow-lg overflow-visible relative"
                        data-id="8831719"
                        data-element_type="container"
                      >
                        {/* Layer 1 (back): background image — center, full size */}
                        <div
                          className="absolute inset-0 z-0 rounded-2xl bg-center bg-cover bg-no-repeat"
                          style={{ backgroundImage: 'url(/media/employee1.webp)' }}
                          aria-hidden
                        />
                        {/* Gradient overlay: ff5b00 100% bottom, 0% top right */}
                        <div
                          className="absolute inset-0 z-[1] rounded-2xl bg-gradient-to-tr from-transparent to-[#ff5b00]"
                          aria-hidden
                        />
                        {/* Rekkefølge: 2 → 3 → 4 → 5 (back to front) */}
                        {/* Layer 2: employee2 — align left */}
                        <div className="absolute inset-0 z-[2] flex items-center justify-start pointer-events-none">
                          <img
                            src="/media/employee2.webp"
                            alt=""
                            className="h-full w-auto max-w-full object-contain object-left"
                            loading="lazy"
                          />
                        </div>
                        {/* Layer 3: employee3 — center bottom, anchored so not floating */}
                        <div className="absolute inset-0 z-[3] flex items-end justify-center pointer-events-none">
                          <img
                            src="/media/employee3.webp"
                            alt=""
                            className="max-h-full w-auto max-w-full object-contain object-center object-bottom self-end"
                            loading="lazy"
                          />
                        </div>
                        {/* Layer 4: employee4 — bottom + right, pop out */}
                        <div className="absolute inset-0 z-[4] flex items-end justify-end pointer-events-none -mt-6 -mr-4 lg:-mt-6 lg:-mr-4 xl:-mt-10 xl:-mr-8">
                          <img
                            src="/media/employee4.webp"
                            alt=""
                            className="h-full w-auto max-w-full object-contain object-right object-bottom flex-shrink-0"
                            loading="lazy"
                          />
                        </div>
                        {/* Layer 5 (front): employee5 — bottom + left */}
                        <div className="absolute inset-0 z-[5] flex items-end justify-start pointer-events-none">
                          <img
                            src="/media/employee5.webp"
                            alt=""
                            className="h-full w-auto max-w-full object-contain object-left object-bottom"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Employment form — mobile/tablet: full width, tall enough to avoid squishing */}
              <div className="e-con-inner w-full mt-8 md:hidden">
                <div className="elementor-widget-container w-full">
                  <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 min-h-[420px]">
                    <iframe
                      src="https://employment-paginated-asoldi-form.vercel.app/"
                      title="Asoldi - Søknad"
                      width="100%"
                      height={520}
                      style={{ minHeight: '460px', border: 'none' }}
                      loading="lazy"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </section>

            </div>

          </div>
        </article>
      </main>
    </div>
  );
};
