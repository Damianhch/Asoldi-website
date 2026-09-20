/**
 * Single source of truth for the three Asoldi website tiers.
 *
 * Consumed by:
 *  - public /pricing cards (app/data/websiteProducts.ts)
 *  - home package deals (app/components/PackageDeals.tsx)
 *  - client portal plans + Stripe mapping (app/data/clientWebsitePlans.ts, server.js)
 *  - sales meeting calculator (app/pages/sales/websitePricing.ts)
 *  - offer email + contract PDF (lib/offer-email.js, lib/offer-contract-pdf.js)
 *
 * Prices are monthly and EXCLUDING MVA. Use withMva() for the incl. price.
 */

export const MVA_RATE = 0.25;
export const CUSTOM_TIER_ID = 'custom';

const COMMON_INCLUDES = [
  'Full nettsideutvikling',
  'Hosting og vedlikehold',
  'Kontaktskjema & standard seksjoner',
  'Opptil 4 innholdsendringer/mnd',
];

const SEO_INCLUDES = [
  'SEO optimalisering',
  'Rangering på Google, Google Maps og AI-søk',
  'Anmeldelser & sosiale medier synk',
  'E-postliste innsamling',
  'Innledende veiledningsmøte',
];

const ECOM_INCLUDES = [
  'Nettbutikk-funksjonalitet',
  'Flerspråklig funksjonalitet',
  'Analyse-dashbord',
  'Gjennomgangsmøte',
];

export function pagesLabel(pages) {
  return `Opp til ${pages} hovedsider`;
}

export function deliveryLabel(weeks) {
  return `Leveringstid: ${weeks} uker`;
}

function tierIncludes(pages, weeks, extra = []) {
  return [COMMON_INCLUDES[0], pagesLabel(pages), ...COMMON_INCLUDES.slice(1), ...extra, deliveryLabel(weeks)];
}

export const WEBSITE_TIERS = [
  {
    id: 'tier-1-standard',
    marketingId: 'starter',
    tierNumber: 1,
    name: 'Tier 1: Standard',
    shortName: 'Starter',
    offerName: 'Nettside – Standard',
    description: 'Simpel og funksjonell nettside.',
    monthlyExMva: 999,
    pages: 5,
    deliveryWeeks: 2,
    popular: false,
    includes: tierIncludes(5, 2),
    excludes: [...SEO_INCLUDES, ...ECOM_INCLUDES],
    planFeatures: ['Full nettsideutvikling', pagesLabel(5), 'Hosting og vedlikehold', 'Kontaktskjema & standard seksjoner'],
    dealFeatures: ['Full nettsideutvikling', pagesLabel(5), 'Hosting og vedlikehold', 'Kontaktskjema & standard seksjoner'],
    contract: {
      title: 'Tier 1 – Website Package',
      lead: 'Includes:',
      includes: [
        'Full website development (simple, non-ecommerce website), up to five (5) main pages',
        'Hosting and maintenance',
        'Contact form',
        'All sections required for a standard business website (excluding ecommerce and reviews display)',
        'Up to four (4) layout/visual content changes per month (images, videos, layout structure)',
        'No adding or removing sections',
        'No advanced functionality',
      ],
    },
  },
  {
    id: 'tier-2-seo',
    marketingId: 'seo',
    tierNumber: 2,
    name: 'Tier 2: SEO',
    shortName: 'SEO',
    offerName: 'Nettside – SEO',
    description: 'Optimalisert nettside for økt synlighet og konvertering.',
    monthlyExMva: 1499,
    pages: 7,
    deliveryWeeks: 2,
    popular: true,
    includes: tierIncludes(7, 2, SEO_INCLUDES),
    excludes: [...ECOM_INCLUDES],
    planFeatures: ['Alt i Tier 1', pagesLabel(7), 'SEO optimalisering', 'Rangering på Google, Google Maps og AI-søk', 'E-postliste innsamling'],
    dealFeatures: ['Full nettsideutvikling', pagesLabel(7), 'Hosting og vedlikehold', 'Rank høyere på Google, Google Maps og AI'],
    contract: {
      title: 'Tier 2 – Website + SEO + Email + Analytics',
      lead: 'Includes everything in Tier 1 plus:',
      includes: [
        'Up to seven (7) main pages',
        'SEO optimization for 1-3 keywords, including ranking work for Google Search, Google Maps (Google Business Profile) and AI search assistants',
        'Reviews showcase functionality',
        'Social media sync',
        'Email list gathering and storage for marketing purposes',
        'Initial guidance meeting on where to find email lists',
      ],
    },
  },
  {
    id: 'tier-3-ecommerce',
    marketingId: 'nettbutikk',
    tierNumber: 3,
    name: 'Tier 3: Nettbutikk',
    shortName: 'Nettbutikk',
    offerName: 'Nettside – Nettbutikk',
    description: 'Full nettbutikk-funksjonalitet og analyse.',
    monthlyExMva: 1999,
    pages: 10,
    deliveryWeeks: 3,
    popular: false,
    includes: tierIncludes(10, 3, [...SEO_INCLUDES, ...ECOM_INCLUDES]),
    excludes: [],
    planFeatures: ['Alt i Tier 2', pagesLabel(10), 'Nettbutikk-funksjonalitet', 'Flerspråklig funksjonalitet', 'Analyse-dashbord'],
    dealFeatures: ['Full nettsideutvikling', pagesLabel(10), 'Hosting og vedlikehold', 'Selg i nettbutikk – flerspråklig e-commerce'],
    contract: {
      title: 'Tier 3 – Website + Ecommerce',
      lead: 'Includes everything in Tier 2 plus:',
      includes: [
        'Up to ten (10) main pages',
        'Ecommerce functionality (store setup, product pages, checkout, user registration)',
        'Multilingual functionality (the website and store can be presented in several languages)',
        'Analytics dashboard available in the Asoldi CMS (bounce rates, visit rates, AOV)',
        'Initial guidance meeting + walkthrough of ecommerce and analytics functionality',
      ],
    },
  },
];

export function tierById(id = '') {
  const key = String(id || '').trim();
  return WEBSITE_TIERS.find((tier) => tier.id === key) || null;
}

export function tierByMarketingId(id = '') {
  const key = String(id || '').trim();
  return WEBSITE_TIERS.find((tier) => tier.marketingId === key) || null;
}

export function resolveTier(id = '') {
  return tierById(id) || tierByMarketingId(id);
}

export function isCustomTierId(id = '') {
  return String(id || '').trim() === CUSTOM_TIER_ID;
}

export function withMva(amountExMva) {
  const value = Number(amountExMva);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * (1 + MVA_RATE));
}

/** Deterministic "1 499 kr" (regular spaces) so emails/PDFs look the same in Node and browsers. */
export function formatKr(amount) {
  const value = Math.round(Number(amount) || 0);
  const sign = value < 0 ? '-' : '';
  const digits = String(Math.abs(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${digits} kr`;
}

/** "1 499,-/mnd" — the format used on /pricing and in the client portal. */
export function formatMonthlyPrice(amountExMva) {
  return `${formatKr(amountExMva).replace(/ kr$/, '')},-/mnd`;
}

/** Shape used by the client portal + Stripe plan selection (was duplicated in server.js and clientWebsitePlans.ts). */
export function toClientWebsitePlan(tier) {
  return {
    id: tier.id,
    name: tier.name,
    price: formatMonthlyPrice(tier.monthlyExMva),
    setupFee: '999,- /engang',
    domainPrice: '79,-/mnd',
    emailPrice: '49,-/mnd',
    description: tier.description,
    features: [...tier.planFeatures],
    includedFeatures: [...tier.includes],
    notIncludedFeatures: [...tier.excludes],
    popular: Boolean(tier.popular),
    category: 'website',
  };
}

export function clientWebsitePlans() {
  return WEBSITE_TIERS.map(toClientWebsitePlan);
}

/** Shape used by the public /pricing cards. */
export function toWebsiteProduct(tier) {
  return {
    id: tier.marketingId,
    name: tier.shortName,
    price: formatMonthlyPrice(tier.monthlyExMva),
    description: tier.description,
    includedFeatures: [...tier.includes],
    notIncludedFeatures: [...tier.excludes],
    popular: Boolean(tier.popular),
  };
}

/** Product block used by the offer email ("Hva er inkludert") and the contract summary. */
export function tierOfferProduct(tier) {
  return {
    kind: 'tier',
    tierId: tier.id,
    name: tier.offerName,
    pages: tier.pages,
    includes: tier.includes.filter((line) => !/^Opp til \d+ hovedsider$/.test(line) && !/^Leveringstid:/.test(line)),
    note: '',
    priceExMva: tier.monthlyExMva,
    deliveryWeeks: tier.deliveryWeeks,
  };
}
