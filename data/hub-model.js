export const WEBSITE_PLANS = [
  { id: 'tier-1-standard', name: 'Tier 1: Standard' },
  { id: 'tier-2-seo', name: 'Tier 2: SEO' },
  { id: 'tier-3-ecommerce', name: 'Tier 3: Nettbutikk' },
  { id: 'custom', name: 'Custom' },
];

export const CATALOG_TYPES = ['menu', 'tiers', 'normal'];

export const DEFAULT_FEATURES = {
  users: true,
  analytics: false,
  ecommerce: false,
  blog: false,
  socialSync: false,
};

export function normalizeWebsitePlan(planId) {
  const id = String(planId || '').trim();
  if (WEBSITE_PLANS.some((plan) => plan.id === id)) return id;
  return 'tier-1-standard';
}

export function normalizeCatalogType(value) {
  if (value === 'menu' || value === 'tiers' || value === 'normal') return value;
  return null;
}

export function normalizeFeatures(features) {
  return {
    users: features?.users !== false,
    analytics: !!features?.analytics,
    ecommerce: !!features?.ecommerce,
    blog: !!features?.blog,
    socialSync: !!features?.socialSync,
  };
}

export function featuresFromPlan(planId) {
  switch (normalizeWebsitePlan(planId)) {
    case 'tier-2-seo':
      return {
        users: true,
        analytics: false,
        ecommerce: false,
        blog: true,
        socialSync: true,
      };
    case 'tier-3-ecommerce':
      return {
        users: true,
        analytics: true,
        ecommerce: true,
        blog: true,
        socialSync: true,
      };
    case 'custom':
      return { ...DEFAULT_FEATURES };
    case 'tier-1-standard':
    default:
      return { ...DEFAULT_FEATURES };
  }
}

export function emptyCmsMeta() {
  return {
    githubRepo: '',
    lastSeenAt: '',
    packageVersion: '',
    adminUrl: '',
    desiredPackageVersion: '',
  };
}

export function normalizeCmsMeta(cms) {
  const base = emptyCmsMeta();
  if (!cms || typeof cms !== 'object') return base;
  return {
    githubRepo: String(cms.githubRepo || ''),
    lastSeenAt: String(cms.lastSeenAt || ''),
    packageVersion: String(cms.packageVersion || ''),
    adminUrl: String(cms.adminUrl || ''),
    desiredPackageVersion: String(cms.desiredPackageVersion || ''),
  };
}

export function resolveCatalogTypeForSite({ features, ecommerceCatalogType }) {
  const normalizedFeatures = normalizeFeatures(features);
  if (!normalizedFeatures.ecommerce) return null;
  return normalizeCatalogType(ecommerceCatalogType) || 'normal';
}

export function normalizeSite(site) {
  if (!site || typeof site !== 'object') return null;
  const websitePlan = normalizeWebsitePlan(site.websitePlan);
  const features = normalizeFeatures(site.features || featuresFromPlan(websitePlan));
  return {
    id: String(site.id || ''),
    site_key: String(site.site_key || ''),
    domain: String(site.domain || ''),
    name: String(site.name || 'Unnamed site'),
    websitePlan,
    features,
    ecommerceCatalogType: resolveCatalogTypeForSite({
      features,
      ecommerceCatalogType: site.ecommerceCatalogType,
    }),
    cms: normalizeCmsMeta(site.cms),
    createdAt: site.createdAt || new Date().toISOString(),
  };
}

export function desiredCmsVersion(site) {
  const fromSite = String(site?.cms?.desiredPackageVersion || '').trim();
  if (fromSite) return fromSite;
  const fromEnv = String(process.env.CMS_DESIRED_PACKAGE_VERSION || '').trim();
  return fromEnv || null;
}
