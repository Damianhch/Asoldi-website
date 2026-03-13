/**
 * Site and business configuration.
 * Update domain URL and verify business info before deployment.
 */

export const SITE_URL = 'https://asoldi.com';
export const DOMAIN_NAME = 'asoldi.com';

export const BUSINESS = {
  name: 'Asoldi Markedsføring',
  shortName: 'Asoldi',
  description: 'Studentdrevet digitalt byrå i Trondheim. Vi hjelper bedrifter med å vokse på nett gjennom høykvalitets nettsider og målrettet markedsføring.',
  address: {
    street: 'Østre berg 10',
    postalCode: '7051',
    city: 'Trondheim',
    country: 'Norway',
    full: 'Østre berg 10, 7051 Trondheim',
  },
  phone: '+47 48 33 91 91',
  email: 'kontakt@asoldi.com',
  /** Latitude/longitude for Trondheim (optional for local SEO) */
  geo: {
    latitude: 63.4305,
    longitude: 10.3954,
  },
  openingHours: [
    { days: 'Monday', hours: '16:00 – 19:00' },
    { days: 'Tuesday – Friday', hours: '14:00 – 20:30' },
    { days: 'Saturday – Sunday', hours: '08:00 – 20:30' },
  ],
  /** Schema.org openingHours format */
  openingHoursSchema: ['Mo 16:00-19:00', 'Tu-Fr 14:00-20:30', 'Sa-Su 08:00-20:30'],
  sameAs: [
    'https://www.facebook.com/people/Asoldi-markedsf%C3%B8ring/61568284364048/',
    'https://www.instagram.com/asoldimedia/',
  ],
} as const;
