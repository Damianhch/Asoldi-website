import { WEBSITE_TIERS, toWebsiteProduct } from '../../lib/website-tiers.js';

export type WebsiteProduct = {
  id: string;
  name: string;
  price: string;
  description: string;
  includedFeatures: string[];
  notIncludedFeatures: string[];
  popular?: boolean;
};

// Tiers 1-3 come from the shared catalog (lib/website-tiers.js) so /pricing,
// the client portal, the sales calculator, offers and contracts always agree.
export const WEBSITE_PRODUCTS: WebsiteProduct[] = [
  ...WEBSITE_TIERS.map((tier) => toWebsiteProduct(tier) as WebsiteProduct),
  {
    id: 'skreddersydd',
    name: 'Skreddersydd',
    price: 'Etter avtale',
    description: 'Skreddersydde løsninger for avanserte behov.',
    includedFeatures: [
      'Full nettsideutvikling',
      'Valgfri mengde sider',
      'Hosting og vedlikehold',
      'Kontaktskjema & standard seksjoner',
      'Ubegrenset innholdsendringer',
      'SEO optimalisering',
      'Rangering på Google, Google Maps og AI-søk',
      'Anmeldelser & sosiale medier synk',
      'E-postliste innsamling',
      'Innledende veiledningsmøte',
      'Nettbutikk-funksjonalitet',
      'Flerspråklig funksjonalitet',
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
