import { clientWebsitePlans } from '../../lib/website-tiers.js';

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

// Derived from the shared tier catalog (lib/website-tiers.js); server.js uses the same helper.
export const CLIENT_WEBSITE_PLANS: ClientWebsitePlan[] = clientWebsitePlans() as ClientWebsitePlan[];

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
