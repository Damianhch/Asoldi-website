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

                {/* Right: Layered employee images (img-2 style) — rounded panel with gradient + stacked images */}
                <div
                  className="e-con-full e-flex flex-1 min-w-0 order-first lg:order-none overflow-visible"
                  data-id="0d57232"
                  data-element_type="container"
                >
                  <div
                    className="e-con-full e-flex w-full overflow-visible"
                    data-id="6569a01"
                    data-element_type="container"
                  >
                    <div
                      className="e-con-full e-flex w-full overflow-visible"
                      data-id="d19297c"
                      data-element_type="container"
                    >
                      <div
                        className="e-con-full e-flex w-full rounded-2xl shadow-lg overflow-visible relative min-h-[380px] md:min-h-[420px] lg:min-h-[460px]"
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
                        {/* Layer 5 (low): employee5 — align left, full size, moves right when section shrinks */}
                        <div className="absolute inset-0 z-[2] flex items-center justify-start pointer-events-none">
                          <img
                            src="/media/employee5.webp"
                            alt=""
                            className="h-full w-auto max-w-full object-contain object-left"
                            loading="lazy"
                          />
                        </div>
                        {/* Layer 3: employee3 — center, full size, both sides shrink */}
                        <div className="absolute inset-0 z-[3] flex items-center justify-center pointer-events-none">
                          <img
                            src="/media/employee3.webp"
                            alt=""
                            className="h-full w-auto max-w-full object-contain object-center"
                            loading="lazy"
                          />
                        </div>
                        {/* Layer 2: employee2 — align left, full size */}
                        <div className="absolute inset-0 z-[4] flex items-center justify-start pointer-events-none">
                          <img
                            src="/media/employee2.webp"
                            alt=""
                            className="h-full w-auto max-w-full object-contain object-left"
                            loading="lazy"
                          />
                        </div>
                        {/* Layer 4 (top): employee4 — align right, pop out -margin top/right, full size */}
                        <div className="absolute inset-0 z-[5] flex items-end justify-end pointer-events-none -mt-8 -mr-6 md:-mt-10 md:-mr-8">
                          <img
                            src="/media/employee4.webp"
                            alt=""
                            className="h-full w-auto max-w-full object-contain object-right flex-shrink-0"
                            loading="lazy"
                          />
                        </div>
                      </div>
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
