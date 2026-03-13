import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SITE_URL, BUSINESS } from '../config';
import { IMAGES } from '../constants';

export interface SEOProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  imageAlt?: string;
  noIndex?: boolean;
  type?: 'website' | 'article';
  /** JSON-LD structured data object(s) - will be stringified */
  structuredData?: object | object[];
}

const defaultImage = SITE_URL + IMAGES.ogImage;

export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  path = '',
  image = defaultImage,
  imageAlt,
  noIndex = false,
  type = 'website',
  structuredData,
}) => {
  const canonical = path ? `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}` : SITE_URL + '/';
  const ogImage = image.startsWith('http') ? image : `${SITE_URL}${image.startsWith('/') ? '' : '/'}${image}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      <meta name="author" content={BUSINESS.name} />
      <meta name="geo.region" content="NO-50" />
      <meta name="geo.placename" content={BUSINESS.address.city} />
      {BUSINESS.geo && (
        <>
          <meta name="geo.position" content={`${BUSINESS.geo.latitude};${BUSINESS.geo.longitude}`} />
          <meta name="ICBM" content={`${BUSINESS.geo.latitude}, ${BUSINESS.geo.longitude}`} />
        </>
      )}
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      {imageAlt && <meta property="og:image:alt" content={imageAlt} />}
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={type} />
      <meta property="og:locale" content="nb_NO" />
      <meta property="og:site_name" content={BUSINESS.shortName} />
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(Array.isArray(structuredData) ? structuredData : structuredData)}
        </script>
      )}
    </Helmet>
  );
};
