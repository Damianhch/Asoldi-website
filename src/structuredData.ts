import { SITE_URL, BUSINESS } from './config';

/** LocalBusiness + Organization JSON-LD for homepage and general use */
export function getLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: BUSINESS.name,
    description: BUSINESS.description,
    url: SITE_URL,
    telephone: BUSINESS.phone,
    email: BUSINESS.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS.address.street,
      addressLocality: BUSINESS.address.city,
      postalCode: BUSINESS.address.postalCode,
      addressCountry: BUSINESS.address.country,
    },
    geo: BUSINESS.geo
      ? {
          '@type': 'GeoCoordinates',
          latitude: BUSINESS.geo.latitude,
          longitude: BUSINESS.geo.longitude,
        }
      : undefined,
    openingHours: BUSINESS.openingHoursSchema.join(', '),
    sameAs: BUSINESS.sameAs,
    areaServed: {
      '@type': 'Country',
      name: 'Norway',
    },
  };
}

/** Service schema for a specific service page */
export function getServiceSchema(name: string, description: string, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    url,
    provider: {
      '@type': 'ProfessionalService',
      name: BUSINESS.name,
      url: SITE_URL,
    },
  };
}

/** WebPage schema for About */
export function getAboutPageSchema(title: string, description: string, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: title,
    description,
    url,
    mainEntity: {
      '@type': 'Organization',
      name: BUSINESS.name,
      url: SITE_URL,
      description: BUSINESS.description,
    },
  };
}

/** ContactPage / Service schema for Booking */
export function getContactPageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Book konsultasjon – ' + BUSINESS.name,
    description: 'Book en gratis konsultasjon med Asoldi. Vi hjelper bedrifter med nettsider og markedsføring i Trondheim.',
    url: SITE_URL + '/booking',
    mainEntity: {
      '@type': 'ProfessionalService',
      name: BUSINESS.name,
      telephone: BUSINESS.phone,
      email: BUSINESS.email,
      url: SITE_URL,
    },
  };
}
