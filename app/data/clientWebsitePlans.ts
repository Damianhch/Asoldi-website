export type ClientWebsitePlan = {
  id: string;
  name: string;
  price: string;
  setupFee: string;
  domainPrice: string;
  emailPrice: string;
  description: string;
  features: string[];
  includedFeatures: string[];
  notIncludedFeatures: string[];
  popular?: boolean;
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
    description: 'Simpel og funksjonell nettside.',
    features: ['Full nettsideutvikling', 'Hosting og vedlikehold', 'Kontaktskjema & standard seksjoner'],
    includedFeatures: [
      'Full nettsideutvikling',
      'Hosting og vedlikehold',
      'Kontaktskjema & standard seksjoner',
      'Opptil 4 innholdsendringer/mnd',
      'Leveringstid: 2 uker',
    ],
    notIncludedFeatures: [
      'SEO optimalisering',
      'Anmeldelser & sosiale medier synk',
      'E-postliste innsamling',
      'Innledende veiledningsmøte',
      'Nettbutikk-funksjonalitet',
      'Analyse-dashbord',
    ],
    category: 'website',
  },
  {
    id: 'tier-2-seo',
    name: 'Tier 2: SEO',
    price: '1 499,-/mnd',
    setupFee: '999,- /engang',
    domainPrice: '79,-/mnd',
    emailPrice: '49,-/mnd',
    description: 'Optimalisert nettside for økt synlighet og konvertering.',
    popular: true,
    features: ['Alt i Tier 1', 'SEO optimalisering', 'E-postliste innsamling'],
    includedFeatures: [
      'Full nettsideutvikling',
      'Hosting og vedlikehold',
      'Kontaktskjema & standard seksjoner',
      'Opptil 4 innholdsendringer/mnd',
      'SEO optimalisering',
      'Anmeldelser & sosiale medier synk',
      'E-postliste innsamling',
      'Innledende veiledningsmøte',
      'Leveringstid: 2 uker',
    ],
    notIncludedFeatures: ['Nettbutikk-funksjonalitet', 'Analyse-dashbord', 'Gjennomgangsmøte'],
    category: 'website',
  },
  {
    id: 'tier-3-ecommerce',
    name: 'Tier 3: Nettbutikk',
    price: '1 999,-/mnd',
    setupFee: '999,- /engang',
    domainPrice: '79,-/mnd',
    emailPrice: '49,-/mnd',
    description: 'Full nettbutikk-funksjonalitet og analyse.',
    features: ['Alt i Tier 2', 'Nettbutikk-funksjonalitet', 'Analyse-dashbord'],
    includedFeatures: [
      'Full nettsideutvikling',
      'Hosting og vedlikehold',
      'Kontaktskjema & standard seksjoner',
      'Opptil 4 innholdsendringer/mnd',
      'SEO optimalisering',
      'Anmeldelser & sosiale medier synk',
      'E-postliste innsamling',
      'Innledende veiledningsmøte',
      'Nettbutikk-funksjonalitet',
      'Analyse-dashbord',
      'Gjennomgangsmøte',
      'Leveringstid: 3 uker',
    ],
    notIncludedFeatures: [],
    category: 'website',
  },
];

export function findWebsitePlan(planId: string): ClientWebsitePlan | undefined {
  return CLIENT_WEBSITE_PLANS.find((plan) => plan.id === planId);
}

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
