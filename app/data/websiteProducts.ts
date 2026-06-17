export type WebsiteProduct = {
  id: string;
  name: string;
  price: string;
  description: string;
  includedFeatures: string[];
  notIncludedFeatures: string[];
  popular?: boolean;
};

export const WEBSITE_PRODUCTS: WebsiteProduct[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '999,-/mnd',
    description: 'Simpel og funksjonell nettside.',
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
  },
  {
    id: 'seo',
    name: 'SEO',
    price: '1 499,-/mnd',
    description: 'Optimalisert nettside for økt synlighet og konvertering.',
    popular: true,
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
  },
  {
    id: 'nettbutikk',
    name: 'Nettbutikk',
    price: '1 999,-/mnd',
    description: 'Full nettbutikk-funksjonalitet og analyse.',
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
  },
  {
    id: 'skreddersydd',
    name: 'Skreddersydd',
    price: 'Etter avtale',
    description: 'Skreddersydde løsninger for avanserte behov.',
    includedFeatures: [
      'Full nettsideutvikling',
      'Hosting og vedlikehold',
      'Kontaktskjema & standard seksjoner',
      'Ubegrenset innholdsendringer',
      'SEO optimalisering',
      'Anmeldelser & sosiale medier synk',
      'E-postliste innsamling',
      'Innledende veiledningsmøte',
      'Nettbutikk-funksjonalitet',
      'Analyse-dashbord',
      'Gjennomgangsmøte',
      'Skreddersydde web-applikasjoner',
      'Avanserte API-integrasjoner',
      'Dedikert server & prioritert support',
    ],
    notIncludedFeatures: [],
  },
];

export const CLIENT_CHECKOUT_BENEFITS = [
  {
    id: 'money-back',
    title: '30 dager penger tilbake-garanti',
    description: 'Du kan avbryte innen 30 dager hvis løsningen ikke passer.',
  },
  {
    id: 'startup-fee',
    title: 'Ingen oppstartsgebyr',
    description: 'Vi holder oppstarten enkel uten skjulte etableringskostnader.',
  },
  {
    id: 'support',
    title: '24/7 support',
    description: 'Kundeservice hjelper deg når du trenger det.',
  },
];
