export type ClientWebsitePlan = {
  id: string;
  name: string;
  price: string;
  setupFee: string;
  domainPrice: string;
  emailPrice: string;
  description: string;
  features: string[];
  category: 'website';
};

export const CLIENT_WEBSITE_PLANS: ClientWebsitePlan[] = [
  {
    id: 'tier-1-standard',
    name: 'Tier 1: Standard',
    price: '999,-/mnd',
    setupFee: '999,- /engang',
    domainPrice: '79,-/mnd',
    emailPrice: '49,-/mnd',
    description: 'Inkluderer nettside, hosting, opprettelse, domene og e-post.',
    features: ['Nettsideutvikling', 'Hosting', 'Opprettelse', 'Domene', 'E-post'],
    category: 'website',
  },
  {
    id: 'tier-2-seo',
    name: 'Tier 2: SEO',
    price: '1499,-/mnd',
    setupFee: '999,- /engang',
    domainPrice: '79,-/mnd',
    emailPrice: '49,-/mnd',
    description: 'Inkluderer Tier 1 + SEO-optimalisering og synlighetstiltak.',
    features: [
      'Alt i Tier 1',
      'SEO optimalisering',
      'Anmeldelser & sosiale medier sync',
      'E-postliste innsamling',
    ],
    category: 'website',
  },
  {
    id: 'tier-3-ecommerce',
    name: 'Tier 3: Ecommerce',
    price: '1999,-/mnd',
    setupFee: '999,- /engang',
    domainPrice: '79,-/mnd',
    emailPrice: '49,-/mnd',
    description: 'Inkluderer Tier 2 + nettbutikk og utvidet analyse.',
    features: ['Alt i Tier 2', 'Nettbutikk-funksjonalitet', 'Analyse-dashboard', 'Gjennomgangsmøte'],
    category: 'website',
  },
];

export const CHECKOUT_BENEFITS = [
  {
    key: 'money-back',
    label: '30 dager penger tilbake garanti',
    illustration: '/media/client-flow/benefit-money-back.svg',
  },
  {
    key: 'no-setup-fee',
    label: 'Ingen oppstartsgebyr',
    illustration: '/media/client-flow/benefit-no-setup-fee.svg',
  },
  {
    key: 'support',
    label: '24/7 support',
    illustration: '/media/client-flow/benefit-support-247.svg',
  },
] as const;
