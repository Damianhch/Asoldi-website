import React from 'react';
import { ChevronDown } from 'lucide-react';
import { SEO } from '../components/SEO';
import { BUSINESS } from '../config';

/**
 * Bli ansatt page — recruitment section only (no referral embed), center-aligned.
 * Route: /bli-ansatt
 */
export const BliAnsatt = () => {
  return (
    <div className="min-h-screen bg-white text-[#050505]">
      <SEO
        title="Bli ansatt – Asoldi"
        description="Bli ansatt hos asoldi media. Kjenner du ikke bedriftseiere kan du fortsatt tjene penger med oss."
        path="/bli-ansatt"
      />

      <main className="site-main pt-24 md:pt-28 pb-16 overflow-x-hidden">
        <article className="ast-article-single w-full flex flex-col items-center">
          <div className="w-full max-w-[1440px] mx-auto px-6 md:px-10 flex flex-col items-center">
            {/* Gradient background wrapper — centered */}
            <div className="w-full bg-gradient-to-b from-orange-50/40 via-orange-50/20 to-white rounded-2xl py-8 md:py-12 px-6 md:px-10 flex flex-col items-center">
              {/* Section: Arrow + heading + text */}
              <section className="w-full flex flex-col items-center justify-center py-4 md:py-6 px-0">
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

              {/* Section: Two-column — form + image; centered */}
              <section className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pb-8 md:pb-12 flex flex-col items-center">
                <div className="w-full flex flex-col lg:flex-row gap-8 lg:gap-8 xl:gap-10 items-stretch justify-center">
                  {/* Left: Employment form — 40% width on desktop */}
                  <div className="hidden md:flex e-flex flex-[1_1_40%] min-w-0 flex-col min-h-[420px] md:min-h-[520px] max-w-xl">
                    <div className="w-full flex-1 min-h-0 flex flex-col">
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

                  {/* Right: Layered employee images — 60% width */}
                  <div className="e-flex flex-[1_1_60%] min-w-0 order-first lg:order-none overflow-visible max-w-2xl">
                    <div className="w-full min-w-0 overflow-visible h-full min-h-[200px] max-h-[220px] sm:min-h-[240px] sm:max-h-[280px] md:min-h-[320px] md:max-h-none aspect-[2404/1468] lg:aspect-auto lg:min-h-0 lg:max-h-none xl:aspect-[2404/1468]">
                      <div className="w-full h-full overflow-visible">
                        <div className="w-full h-full rounded-2xl shadow-lg overflow-visible relative">
                          <div
                            className="absolute inset-0 z-0 rounded-2xl bg-center bg-cover bg-no-repeat"
                            style={{ backgroundImage: 'url(/media/employee1.webp)' }}
                            aria-hidden
                          />
                          <div
                            className="absolute inset-0 z-[1] rounded-2xl bg-gradient-to-tr from-transparent to-[#ff5b00]"
                            aria-hidden
                          />
                          <div className="absolute inset-0 z-[2] flex items-center justify-start pointer-events-none">
                            <img
                              src="/media/employee2.webp"
                              alt=""
                              className="h-full w-auto max-w-full object-contain object-left"
                              loading="lazy"
                            />
                          </div>
                          <div className="absolute inset-0 z-[3] flex items-end justify-center pointer-events-none">
                            <img
                              src="/media/employee3.webp"
                              alt=""
                              className="max-h-full w-auto max-w-full object-contain object-center object-bottom self-end"
                              loading="lazy"
                            />
                          </div>
                          <div className="absolute inset-0 z-[4] flex items-end justify-end pointer-events-none -mt-6 -mr-4 lg:-mt-6 lg:-mr-4 xl:-mt-10 xl:-mr-8">
                            <img
                              src="/media/employee4.webp"
                              alt=""
                              className="h-full w-auto max-w-full object-contain object-right object-bottom flex-shrink-0"
                              loading="lazy"
                            />
                          </div>
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

                {/* Employment form — mobile/tablet */}
                <div className="w-full mt-8 md:hidden max-w-xl">
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
              </section>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
};
