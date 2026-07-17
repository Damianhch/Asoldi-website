import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { ClientRouteGuard } from '../../components/client/ClientRouteGuard';
import { ClientPortalLayout } from '../../components/client/ClientPortalLayout';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import { CLIENT_WEBSITE_PLANS } from '../../data/clientWebsitePlans';

type SettingsSection = 'kundedata' | 'fakturering' | 'konto';

type OpeningDay = {
  day: string;
  opensAt: string;
  closesAt: string;
  closed: boolean;
};

type LinkItem = {
  name: string;
  url: string;
};

type AffiliationItem = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
};

type AffiliationCategory = {
  id: string;
  categoryName: string;
  items: AffiliationItem[];
};

type ProductItem = {
  id: string;
  title: string;
  description: string;
  price: string;
  contactInsteadOfPrice: boolean;
  imageUrl: string;
  included: boolean;
};

type ProductCategory = {
  id: string;
  categoryName: string;
  items: ProductItem[];
};

type ClientDataBank = {
  businessCard: {
    companyName: string;
    industry: string;
    websiteGoal: string;
  };
  generalInfo: {
    companyName: string;
    companyAddress: string;
    websiteLanguage: string;
    companyPhone: string;
    companyEmail: string;
    socialMediaLinks: string[];
    extraLinks: LinkItem[];
  };
  brandIdentity: {
    orgNumber: string;
    colors: {
      primary: string;
      secondary: string;
      accent: string;
    };
    logos: {
      normal: string;
      favicon: string;
    };
  };
  openingHours: {
    googleBusinessSyncUrl: string;
    days: OpeningDay[];
  };
  affiliations: AffiliationCategory[];
  products: ProductCategory[];
  media: {
    mainHeroImages: string[];
    galleryImages: string[];
    logos: string[];
    icons: string[];
    uncategorized: string[];
  };
  websiteCreatorQuestions: {
    targetAudience: string;
    keyMessage: string;
    toneOfVoice: string;
    primaryAction: string;
    importantKeywords: string[];
    competitorLinks: string[];
  };
};

type BillingSummary = {
  status: string;
  method: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  paidAt: string;
  updatedAt: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
  cancelAt: string;
  canceledAt: string;
};

type BillingInvoice = {
  id: string;
  number: string;
  status: string;
  paid: boolean;
  amountPaid: number;
  amountDue: number;
  currency: string;
  createdAt: string;
  dueAt: string;
  paidAt: string;
  hostedInvoiceUrl: string;
  invoicePdf: string;
};

type BillingOverview = {
  summary: BillingSummary;
  subscription: {
    id: string;
    status: string;
    planId: string;
    planName: string;
    priceId: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string;
    cancelAt: string;
    canceledAt: string;
  } | null;
  invoices: BillingInvoice[];
  stripePortalAvailable: boolean;
  warnings: string[];
  availablePlans: Array<{
    id: string;
    name: string;
    price: string;
    description: string;
    isCurrent: boolean;
    stripePriceConfigured: boolean;
  }>;
};

const DEFAULT_DAYS: OpeningDay[] = [
  { day: 'Mandag', opensAt: '08:00', closesAt: '16:00', closed: false },
  { day: 'Tirsdag', opensAt: '08:00', closesAt: '16:00', closed: false },
  { day: 'Onsdag', opensAt: '08:00', closesAt: '16:00', closed: false },
  { day: 'Torsdag', opensAt: '08:00', closesAt: '16:00', closed: false },
  { day: 'Fredag', opensAt: '08:00', closesAt: '16:00', closed: false },
  { day: 'Lørdag', opensAt: '10:00', closesAt: '14:00', closed: true },
  { day: 'Søndag', opensAt: '10:00', closesAt: '14:00', closed: true },
];

const LANGUAGE_OPTIONS = [
  'Norsk (Norge)',
  'English (US)',
  'English (UK)',
  'Svenska (Sverige)',
  'Dansk (Danmark)',
  'Deutsch (Deutschland)',
  'Français (France)',
  'Español (España)',
];

const BILLING_STATUS_LABELS: Record<string, string> = {
  none: 'Ingen aktiv betalingsavtale',
  processing: 'Under behandling',
  active: 'Aktiv',
  past_due: 'Forfalt',
  canceled: 'Avsluttet',
  invoice_requested: 'Faktura forespurt',
  paid: 'Betalt',
  open: 'Åpen',
  draft: 'Utkast',
  void: 'Annullert',
  uncollectible: 'Ikke innkrevbar',
  trialing: 'Prøveperiode',
  unpaid: 'Ubetalt',
  incomplete: 'Ufullstendig',
};

const MEDIA_BUCKETS: Array<{ key: keyof ClientDataBank['media']; label: string }> = [
  { key: 'mainHeroImages', label: 'Hovedbilde' },
  { key: 'galleryImages', label: 'Bildegalleri' },
  { key: 'logos', label: 'Logo' },
  { key: 'icons', label: 'Ikoner' },
  { key: 'uncategorized', label: 'Ukategorisert' },
];

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function toIsoDate(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('nb-NO');
}

function toMoney(amount: number, currency = 'nok') {
  const normalizedCurrency = String(currency || 'nok').toUpperCase();
  try {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${Math.round(Number(amount || 0)).toLocaleString('nb-NO')},-`;
  }
}

function normalizeHex(value: string, fallback: string) {
  const upper = String(value || '').trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(upper)) return upper;
  const fallbackUpper = String(fallback || '').trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(fallbackUpper) ? fallbackUpper : '#FF5B00';
}

function defaultClientDataBank(profile: any): ClientDataBank {
  const businessName = String(profile?.businessName || '').trim();
  const businessEmail = String(profile?.email || '').trim();
  const businessOrg = String(profile?.businessOrgNumber || '').trim();
  return {
    businessCard: {
      companyName: businessName,
      industry: '',
      websiteGoal: '',
    },
    generalInfo: {
      companyName: businessName,
      companyAddress: '',
      websiteLanguage: 'Norsk (Norge)',
      companyPhone: '',
      companyEmail: businessEmail,
      socialMediaLinks: [''],
      extraLinks: [{ name: '', url: '' }],
    },
    brandIdentity: {
      orgNumber: businessOrg,
      colors: {
        primary: '#FF5B00',
        secondary: '#111827',
        accent: '#F9F9F8',
      },
      logos: {
        normal: '',
        favicon: '',
      },
    },
    openingHours: {
      googleBusinessSyncUrl: '',
      days: DEFAULT_DAYS,
    },
    affiliations: [],
    products: [],
    media: {
      mainHeroImages: [],
      galleryImages: [],
      logos: [],
      icons: [],
      uncategorized: [],
    },
    websiteCreatorQuestions: {
      targetAudience: '',
      keyMessage: '',
      toneOfVoice: '',
      primaryAction: '',
      importantKeywords: [],
      competitorLinks: [],
    },
  };
}

function ensureList(values: any, fallback: string[] = [], keepOneEmpty = false) {
  const source = Array.isArray(values) ? values : fallback;
  const normalized = source.map((entry) => String(entry || '').trim()).filter(Boolean);
  if (normalized.length) return normalized;
  return keepOneEmpty ? [''] : [];
}

function ensureClientDataBank(input: any, profile: any): ClientDataBank {
  const base = defaultClientDataBank(profile);
  const bank = input && typeof input === 'object' ? input : {};
  const openingDaysSource = Array.isArray(bank?.openingHours?.days) ? bank.openingHours.days : [];
  const openingDays = DEFAULT_DAYS.map((day, idx) => {
    const row = openingDaysSource[idx] || openingDaysSource.find((candidate: any) => String(candidate?.day || '').toLowerCase() === day.day.toLowerCase()) || {};
    return {
      day: String(row.day || day.day),
      opensAt: String(row.opensAt || row.open || day.opensAt),
      closesAt: String(row.closesAt || row.close || day.closesAt),
      closed: Boolean(row.closed ?? day.closed),
    };
  });

  const affiliations: AffiliationCategory[] = Array.isArray(bank?.affiliations)
    ? bank.affiliations.map((category: any, categoryIndex: number) => ({
      id: String(category?.id || randomId(`aff-cat-${categoryIndex + 1}`)),
      categoryName: String(category?.categoryName || category?.name || '').trim(),
      items: Array.isArray(category?.items)
        ? category.items.map((item: any, itemIndex: number) => ({
          id: String(item?.id || randomId(`aff-item-${itemIndex + 1}`)),
          title: String(item?.title || '').trim(),
          description: String(item?.description || item?.desc || '').trim(),
          imageUrl: String(item?.imageUrl || item?.image || '').trim(),
        }))
        : [],
    }))
    : [];

  const products: ProductCategory[] = Array.isArray(bank?.products)
    ? bank.products.map((category: any, categoryIndex: number) => ({
      id: String(category?.id || randomId(`prod-cat-${categoryIndex + 1}`)),
      categoryName: String(category?.categoryName || category?.name || '').trim(),
      items: Array.isArray(category?.items)
        ? category.items.map((item: any, itemIndex: number) => ({
          id: String(item?.id || randomId(`prod-item-${itemIndex + 1}`)),
          title: String(item?.title || '').trim(),
          description: String(item?.description || item?.desc || '').trim(),
          price: String(item?.price || '').trim(),
          contactInsteadOfPrice: Boolean(item?.contactInsteadOfPrice),
          imageUrl: String(item?.imageUrl || item?.image || '').trim(),
          included: item?.included !== undefined ? Boolean(item.included) : Boolean(item?.isSelected ?? true),
        }))
        : [],
    }))
    : [];

  const next: ClientDataBank = {
    businessCard: {
      companyName: String(bank?.businessCard?.companyName || bank?.generalInfo?.companyName || base.businessCard.companyName).trim(),
      industry: String(bank?.businessCard?.industry || base.businessCard.industry).trim(),
      websiteGoal: String(bank?.businessCard?.websiteGoal || bank?.businessCard?.goal || base.businessCard.websiteGoal).trim(),
    },
    generalInfo: {
      companyName: String(bank?.generalInfo?.companyName || base.generalInfo.companyName).trim(),
      companyAddress: String(bank?.generalInfo?.companyAddress || bank?.generalInfo?.address || base.generalInfo.companyAddress).trim(),
      websiteLanguage: String(bank?.generalInfo?.websiteLanguage || bank?.generalInfo?.language || base.generalInfo.websiteLanguage).trim(),
      companyPhone: String(bank?.generalInfo?.companyPhone || bank?.generalInfo?.phone || base.generalInfo.companyPhone).trim(),
      companyEmail: String(bank?.generalInfo?.companyEmail || bank?.generalInfo?.email || base.generalInfo.companyEmail).trim(),
      socialMediaLinks: ensureList(
        bank?.generalInfo?.socialMediaLinks || bank?.generalInfo?.socialLinks,
        base.generalInfo.socialMediaLinks,
        true
      ),
      extraLinks: Array.isArray(bank?.generalInfo?.extraLinks) && bank.generalInfo.extraLinks.length
        ? bank.generalInfo.extraLinks.map((entry: any) => ({
          name: String(entry?.name || '').trim(),
          url: String(entry?.url || '').trim(),
        }))
        : base.generalInfo.extraLinks,
    },
    brandIdentity: {
      orgNumber: String(bank?.brandIdentity?.orgNumber || bank?.brandIdentity?.organizationNumber || base.brandIdentity.orgNumber).trim(),
      colors: {
        primary: normalizeHex(String(bank?.brandIdentity?.colors?.primary || ''), base.brandIdentity.colors.primary),
        secondary: normalizeHex(String(bank?.brandIdentity?.colors?.secondary || ''), base.brandIdentity.colors.secondary),
        accent: normalizeHex(String(bank?.brandIdentity?.colors?.accent || ''), base.brandIdentity.colors.accent),
      },
      logos: {
        normal: String(bank?.brandIdentity?.logos?.normal || '').trim(),
        favicon: String(bank?.brandIdentity?.logos?.favicon || '').trim(),
      },
    },
    openingHours: {
      googleBusinessSyncUrl: String(bank?.openingHours?.googleBusinessSyncUrl || bank?.openingHours?.syncLink || '').trim(),
      days: openingDays,
    },
    affiliations,
    products,
    media: {
      mainHeroImages: ensureList(bank?.media?.mainHeroImages, []),
      galleryImages: ensureList(bank?.media?.galleryImages, []),
      logos: ensureList(bank?.media?.logos, []),
      icons: ensureList(bank?.media?.icons, []),
      uncategorized: ensureList(bank?.media?.uncategorized, []),
    },
    websiteCreatorQuestions: {
      targetAudience: String(bank?.websiteCreatorQuestions?.targetAudience || '').trim(),
      keyMessage: String(bank?.websiteCreatorQuestions?.keyMessage || '').trim(),
      toneOfVoice: String(bank?.websiteCreatorQuestions?.toneOfVoice || '').trim(),
      primaryAction: String(bank?.websiteCreatorQuestions?.primaryAction || '').trim(),
      importantKeywords: ensureList(bank?.websiteCreatorQuestions?.importantKeywords, []),
      competitorLinks: ensureList(bank?.websiteCreatorQuestions?.competitorLinks, []),
    },
  };

  return next;
}

function sectionPath(section: SettingsSection) {
  if (section === 'fakturering') return '/kunde/innstillinger/fakturering';
  if (section === 'konto') return '/kunde/innstillinger/konto';
  return '/kunde/innstillinger';
}

export const ClientSettings = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, profile, updateProfileState, clearClientSession } = useClientAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const [clientData, setClientData] = useState<ClientDataBank>(() => ensureClientDataBank(profile?.clientDataBank, profile));
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);

  const activeSection: SettingsSection = useMemo(() => {
    if (location.pathname.endsWith('/fakturering') || location.pathname.endsWith('/billing')) return 'fakturering';
    if (location.pathname.endsWith('/konto')) return 'konto';
    return 'kundedata';
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    async function loadSettings() {
      if (!token) return;
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/client/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || 'Kunne ikke laste innstillinger.');
        if (!active) return;
        if (payload.profile) updateProfileState(payload.profile);
        setClientData(ensureClientDataBank(payload.clientDataBank || payload.profile?.clientDataBank, payload.profile || profile));
        setBilling((payload.billing || null) as BillingOverview | null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Kunne ikke laste innstillinger.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadSettings();
    return () => {
      active = false;
    };
  }, [token, updateProfileState]);

  useEffect(() => {
    const query = clientData.generalInfo.companyAddress.trim();
    if (query.length < 3 || activeSection !== 'kundedata') {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }

    let ignore = false;
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
          {
            headers: { 'Accept-Language': 'nb' },
          }
        );
        const rows = await response.json().catch(() => []);
        if (ignore) return;
        if (Array.isArray(rows)) {
          setAddressSuggestions(rows.map((row) => String(row?.display_name || '').trim()).filter(Boolean));
          setShowAddressSuggestions(true);
        }
      } catch {
        if (!ignore) {
          setAddressSuggestions([]);
        }
      }
    }, 350);

    return () => {
      ignore = true;
      clearTimeout(timeout);
    };
  }, [clientData.generalInfo.companyAddress, activeSection]);

  async function refreshBillingOnly() {
    if (!token) return;
    const response = await fetch('/api/client/billing/overview', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Kunne ikke laste fakturering.');
    setBilling((payload.billing || null) as BillingOverview | null);
  }

  async function saveClientData() {
    if (!token) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/client/settings/client-data', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clientDataBank: clientData }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Kunne ikke lagre kundedata.');
      if (payload.profile) updateProfileState(payload.profile);
      setClientData(ensureClientDataBank(payload.clientDataBank || payload.profile?.clientDataBank, payload.profile || profile));
      setSuccess('Kundedata er lagret.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre kundedata.');
    } finally {
      setSaving(false);
    }
  }

  async function openStripePortal() {
    if (!token) return;
    setBusyAction('portal');
    setError('');
    try {
      const response = await fetch('/api/client/billing/portal-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Kunne ikke åpne Stripe-portalen.');
      if (!payload.url) throw new Error('Mangler portal-lenke.');
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke åpne Stripe-portalen.');
    } finally {
      setBusyAction('');
    }
  }

  async function upgradePlan(planId: string) {
    if (!token) return;
    setBusyAction(`upgrade:${planId}`);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/client/billing/upgrade-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Kunne ikke oppgradere abonnement.');
      if (payload.mode === 'checkout' && payload.redirect) {
        setSuccess(payload.message || 'Planen ble oppdatert. Fullfør i betaling.');
        navigate(payload.redirect);
        return;
      }
      await refreshBillingOnly();
      setSuccess(payload.message || 'Abonnementet er oppgradert.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke oppgradere abonnement.');
    } finally {
      setBusyAction('');
    }
  }

  async function cancelSubscription() {
    if (!token) return;
    setBusyAction('cancel');
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/client/billing/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ immediate: false }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Kunne ikke avslutte abonnementet.');
      if (payload.billing) setBilling(payload.billing as BillingOverview);
      setSuccess(payload.message || 'Abonnementet avsluttes ved periodens slutt.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke avslutte abonnementet.');
    } finally {
      setBusyAction('');
    }
  }

  async function resumeSubscription() {
    if (!token) return;
    setBusyAction('resume');
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/client/billing/resume-subscription', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Kunne ikke gjenoppta abonnementet.');
      if (payload.billing) setBilling(payload.billing as BillingOverview);
      setSuccess(payload.message || 'Abonnementet er aktivt igjen.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke gjenoppta abonnementet.');
    } finally {
      setBusyAction('');
    }
  }

  async function deleteAccount() {
    if (!token) return;
    if (deleteConfirm.trim().toUpperCase() !== 'SLETT') {
      setError('Skriv "SLETT" for å bekrefte kontoavslutning.');
      return;
    }
    setDeletingAccount(true);
    setError('');
    try {
      const response = await fetch('/api/client/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmText: deleteConfirm }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Kunne ikke avslutte kontoen.');
      clearClientSession();
      navigate('/login/kunde', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke avslutte kontoen.');
    } finally {
      setDeletingAccount(false);
    }
  }

  function updateSocialLink(index: number, value: string) {
    setClientData((prev) => {
      const next = [...prev.generalInfo.socialMediaLinks];
      next[index] = value;
      return {
        ...prev,
        generalInfo: {
          ...prev.generalInfo,
          socialMediaLinks: next,
        },
      };
    });
  }

  function updateExtraLink(index: number, key: 'name' | 'url', value: string) {
    setClientData((prev) => {
      const next = [...prev.generalInfo.extraLinks];
      next[index] = { ...next[index], [key]: value };
      return {
        ...prev,
        generalInfo: {
          ...prev.generalInfo,
          extraLinks: next,
        },
      };
    });
  }

  function updateAffiliationCategory(categoryIndex: number, field: 'categoryName', value: string) {
    setClientData((prev) => {
      const categories = [...prev.affiliations];
      categories[categoryIndex] = { ...categories[categoryIndex], [field]: value };
      return { ...prev, affiliations: categories };
    });
  }

  function updateAffiliationItem(categoryIndex: number, itemIndex: number, field: keyof AffiliationItem, value: string) {
    setClientData((prev) => {
      const categories = [...prev.affiliations];
      const category = categories[categoryIndex];
      const items = [...category.items];
      items[itemIndex] = { ...items[itemIndex], [field]: value };
      categories[categoryIndex] = { ...category, items };
      return { ...prev, affiliations: categories };
    });
  }

  function updateProductCategory(categoryIndex: number, field: 'categoryName', value: string) {
    setClientData((prev) => {
      const categories = [...prev.products];
      categories[categoryIndex] = { ...categories[categoryIndex], [field]: value };
      return { ...prev, products: categories };
    });
  }

  function updateProductItem(
    categoryIndex: number,
    itemIndex: number,
    field: keyof ProductItem,
    value: string | boolean,
  ) {
    setClientData((prev) => {
      const categories = [...prev.products];
      const category = categories[categoryIndex];
      const items = [...category.items];
      items[itemIndex] = { ...items[itemIndex], [field]: value } as ProductItem;
      categories[categoryIndex] = { ...category, items };
      return { ...prev, products: categories };
    });
  }

  const summary = billing?.summary;
  const invoices = billing?.invoices || [];

  return (
    <ClientRouteGuard>
      <Helmet>
        <title>Kundeportal – Innstillinger</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <ClientPortalLayout title="Innstillinger" subtitle="Administrer kundedata, fakturering og konto">
        {loading ? (
          <div className="min-h-[320px] flex items-center justify-center text-[#6B7280]">
            <Loader2 size={18} className="animate-spin mr-2" />
            Laster innstillinger...
          </div>
        ) : (
          <div className="mx-auto max-w-[1100px] space-y-6">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { id: 'kundedata', label: 'Kundedata' },
                  { id: 'fakturering', label: 'Fakturering' },
                  { id: 'konto', label: 'Konto' },
                ].map((entry) => {
                  const sectionId = entry.id as SettingsSection;
                  const active = activeSection === sectionId;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => navigate(sectionPath(sectionId))}
                      className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-[#111827] text-white'
                          : 'bg-[#F8FAFC] text-[#374151] hover:bg-[#EEF2F7]'
                      }`}
                    >
                      {entry.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}
            {success ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 inline-flex items-center gap-2">
                <CheckCircle2 size={14} />
                {success}
              </div>
            ) : null}

            {activeSection === 'kundedata' ? (
              <div className="space-y-5">
                <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <h2 className="text-lg font-semibold text-[#111827]">1) Bedriftskort og nettsidemål</h2>
                  <p className="mt-1 text-sm text-[#6B7280]">
                    Basert på «bedrifts info»-oppsettet i Nettsidebygger v2.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm">
                      <span className="block text-[#374151] mb-1">Bedriftsnavn</span>
                      <input
                        value={clientData.businessCard.companyName}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          businessCard: { ...prev.businessCard, companyName: e.target.value },
                          generalInfo: { ...prev.generalInfo, companyName: e.target.value },
                        }))}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="block text-[#374151] mb-1">Bransje</span>
                      <input
                        value={clientData.businessCard.industry}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          businessCard: { ...prev.businessCard, industry: e.target.value },
                        }))}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                      />
                    </label>
                    <label className="text-sm md:col-span-2">
                      <span className="block text-[#374151] mb-1">Nettsidens hovedmål</span>
                      <textarea
                        value={clientData.businessCard.websiteGoal}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          businessCard: { ...prev.businessCard, websiteGoal: e.target.value },
                        }))}
                        rows={3}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <h2 className="text-lg font-semibold text-[#111827]">2) Generell informasjon (identitet og kontakt)</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm">
                      <span className="block text-[#374151] mb-1">Bedriftsnavn</span>
                      <input
                        value={clientData.generalInfo.companyName}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          generalInfo: { ...prev.generalInfo, companyName: e.target.value },
                        }))}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="block text-[#374151] mb-1">Nettsidens språk</span>
                      <select
                        value={clientData.generalInfo.websiteLanguage}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          generalInfo: { ...prev.generalInfo, websiteLanguage: e.target.value },
                        }))}
                        className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 outline-none focus:border-[#FF5B00]"
                      >
                        {LANGUAGE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm md:col-span-2 relative">
                      <span className="block text-[#374151] mb-1">Bedriftsadresse (autofullfør)</span>
                      <input
                        value={clientData.generalInfo.companyAddress}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          generalInfo: { ...prev.generalInfo, companyAddress: e.target.value },
                        }))}
                        onFocus={() => setShowAddressSuggestions(true)}
                        onBlur={() => {
                          window.setTimeout(() => setShowAddressSuggestions(false), 150);
                        }}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                        placeholder="F.eks. Karl Johans gate 1, Oslo"
                      />
                      {showAddressSuggestions && addressSuggestions.length > 0 ? (
                        <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white shadow-md overflow-hidden">
                          {addressSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onMouseDown={() => setClientData((prev) => ({
                                ...prev,
                                generalInfo: { ...prev.generalInfo, companyAddress: suggestion },
                              }))}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-[#F8F9FB]"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </label>
                    <label className="text-sm">
                      <span className="block text-[#374151] mb-1">Bedriftstelefon</span>
                      <input
                        value={clientData.generalInfo.companyPhone}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          generalInfo: { ...prev.generalInfo, companyPhone: e.target.value },
                        }))}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="block text-[#374151] mb-1">Bedriftse-post</span>
                      <input
                        type="email"
                        value={clientData.generalInfo.companyEmail}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          generalInfo: { ...prev.generalInfo, companyEmail: e.target.value },
                        }))}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                      />
                    </label>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[#111827]">Sosiale medier</h3>
                      <button
                        type="button"
                        onClick={() => setClientData((prev) => ({
                          ...prev,
                          generalInfo: {
                            ...prev.generalInfo,
                            socialMediaLinks: [...prev.generalInfo.socialMediaLinks, ''],
                          },
                        }))}
                        className="inline-flex items-center gap-1 text-xs text-[#FF5B00]"
                      >
                        <Plus size={12} /> Legg til lenke
                      </button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {clientData.generalInfo.socialMediaLinks.map((link, index) => (
                        <div key={`social-${index}`} className="flex gap-2">
                          <input
                            value={link}
                            onChange={(e) => updateSocialLink(index, e.target.value)}
                            placeholder="https://facebook.com/..."
                            className="flex-1 rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm outline-none focus:border-[#FF5B00]"
                          />
                          <button
                            type="button"
                            onClick={() => setClientData((prev) => ({
                              ...prev,
                              generalInfo: {
                                ...prev.generalInfo,
                                socialMediaLinks: prev.generalInfo.socialMediaLinks.filter((_, current) => current !== index),
                              },
                            }))}
                            className="rounded-lg border border-[#FECACA] px-2 text-red-600"
                            aria-label="Fjern sosial lenke"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[#111827]">Ekstra lenker</h3>
                      <button
                        type="button"
                        onClick={() => setClientData((prev) => ({
                          ...prev,
                          generalInfo: {
                            ...prev.generalInfo,
                            extraLinks: [...prev.generalInfo.extraLinks, { name: '', url: '' }],
                          },
                        }))}
                        className="inline-flex items-center gap-1 text-xs text-[#FF5B00]"
                      >
                        <Plus size={12} /> Ny ekstra lenke
                      </button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {clientData.generalInfo.extraLinks.map((entry, index) => (
                        <div key={`extra-${index}`} className="grid grid-cols-[1fr_2fr_auto] gap-2">
                          <input
                            value={entry.name}
                            onChange={(e) => updateExtraLink(index, 'name', e.target.value)}
                            placeholder="Navn"
                            className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm outline-none focus:border-[#FF5B00]"
                          />
                          <input
                            value={entry.url}
                            onChange={(e) => updateExtraLink(index, 'url', e.target.value)}
                            placeholder="https://..."
                            className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm outline-none focus:border-[#FF5B00]"
                          />
                          <button
                            type="button"
                            onClick={() => setClientData((prev) => ({
                              ...prev,
                              generalInfo: {
                                ...prev.generalInfo,
                                extraLinks: prev.generalInfo.extraLinks.filter((_, current) => current !== index),
                              },
                            }))}
                            className="rounded-lg border border-[#FECACA] px-2 text-red-600"
                            aria-label="Fjern ekstra lenke"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <h2 className="text-lg font-semibold text-[#111827]">3) Brand og identitet</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm">
                      <span className="block text-[#374151] mb-1">Organisasjonsnummer</span>
                      <input
                        value={clientData.brandIdentity.orgNumber}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          brandIdentity: { ...prev.brandIdentity, orgNumber: e.target.value },
                        }))}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                      />
                    </label>
                    <div className="grid grid-cols-3 gap-3 md:col-span-2">
                      {([
                        ['primary', 'Primærfarge'],
                        ['secondary', 'Sekundærfarge'],
                        ['accent', 'Aksentfarge'],
                      ] as const).map(([key, label]) => (
                        <label key={key} className="text-sm">
                          <span className="block text-[#374151] mb-1">{label}</span>
                          <div className="flex items-center gap-2 rounded-lg border border-[#D1D5DB] px-2 py-1.5">
                            <input
                              type="color"
                              value={clientData.brandIdentity.colors[key]}
                              onChange={(e) => setClientData((prev) => ({
                                ...prev,
                                brandIdentity: {
                                  ...prev.brandIdentity,
                                  colors: { ...prev.brandIdentity.colors, [key]: e.target.value.toUpperCase() },
                                },
                              }))}
                              className="h-8 w-8 rounded border-none p-0"
                            />
                            <input
                              value={clientData.brandIdentity.colors[key]}
                              onChange={(e) => setClientData((prev) => ({
                                ...prev,
                                brandIdentity: {
                                  ...prev.brandIdentity,
                                  colors: {
                                    ...prev.brandIdentity.colors,
                                    [key]: normalizeHex(e.target.value, prev.brandIdentity.colors[key]),
                                  },
                                },
                              }))}
                              className="w-full bg-transparent text-xs font-mono uppercase outline-none"
                            />
                          </div>
                        </label>
                      ))}
                    </div>
                    <label className="text-sm">
                      <span className="block text-[#374151] mb-1">Logo (URL)</span>
                      <input
                        value={clientData.brandIdentity.logos.normal}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          brandIdentity: {
                            ...prev.brandIdentity,
                            logos: { ...prev.brandIdentity.logos, normal: e.target.value },
                          },
                        }))}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                        placeholder="https://..."
                      />
                    </label>
                    <label className="text-sm">
                      <span className="block text-[#374151] mb-1">Favicon (URL)</span>
                      <input
                        value={clientData.brandIdentity.logos.favicon}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          brandIdentity: {
                            ...prev.brandIdentity,
                            logos: { ...prev.brandIdentity.logos, favicon: e.target.value },
                          },
                        }))}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                        placeholder="https://..."
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <h2 className="text-lg font-semibold text-[#111827]">4) Åpningstider</h2>
                  <div className="mt-4">
                    <label className="text-sm block mb-3">
                      <span className="block text-[#374151] mb-1">Google Business Sync-lenke (valgfri)</span>
                      <input
                        value={clientData.openingHours.googleBusinessSyncUrl}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          openingHours: { ...prev.openingHours, googleBusinessSyncUrl: e.target.value },
                        }))}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                        placeholder="https://g.page/..."
                      />
                    </label>
                    <div className="space-y-2">
                      {clientData.openingHours.days.map((day, index) => (
                        <div key={day.day} className="rounded-xl border border-[#E5E7EB] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-sm">{day.day}</strong>
                            <label className="inline-flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={day.closed}
                                onChange={(e) => setClientData((prev) => {
                                  const nextDays = [...prev.openingHours.days];
                                  nextDays[index] = { ...nextDays[index], closed: e.target.checked };
                                  return {
                                    ...prev,
                                    openingHours: { ...prev.openingHours, days: nextDays },
                                  };
                                })}
                              />
                              Stengt
                            </label>
                          </div>
                          {!day.closed ? (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <label className="text-sm">
                                <span className="block text-[#6B7280] mb-1">Åpner</span>
                                <input
                                  type="time"
                                  value={day.opensAt}
                                  onChange={(e) => setClientData((prev) => {
                                    const nextDays = [...prev.openingHours.days];
                                    nextDays[index] = { ...nextDays[index], opensAt: e.target.value };
                                    return {
                                      ...prev,
                                      openingHours: { ...prev.openingHours, days: nextDays },
                                    };
                                  })}
                                  className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                                />
                              </label>
                              <label className="text-sm">
                                <span className="block text-[#6B7280] mb-1">Stenger</span>
                                <input
                                  type="time"
                                  value={day.closesAt}
                                  onChange={(e) => setClientData((prev) => {
                                    const nextDays = [...prev.openingHours.days];
                                    nextDays[index] = { ...nextDays[index], closesAt: e.target.value };
                                    return {
                                      ...prev,
                                      openingHours: { ...prev.openingHours, days: nextDays },
                                    };
                                  })}
                                  className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                                />
                              </label>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[#111827]">5) Affiliasjon og samarbeidspartnere</h2>
                    <button
                      type="button"
                      onClick={() => setClientData((prev) => ({
                        ...prev,
                        affiliations: [
                          ...prev.affiliations,
                          { id: randomId('aff-cat'), categoryName: '', items: [] },
                        ],
                      }))}
                      className="inline-flex items-center gap-1 text-sm text-[#FF5B00]"
                    >
                      <Plus size={14} /> Ny kategori
                    </button>
                  </div>
                  <div className="mt-4 space-y-4">
                    {clientData.affiliations.length === 0 ? (
                      <p className="text-sm text-[#6B7280]">Ingen kategorier enda.</p>
                    ) : null}
                    {clientData.affiliations.map((category, categoryIndex) => (
                      <div key={category.id} className="rounded-xl border border-[#E5E7EB] p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            value={category.categoryName}
                            onChange={(e) => updateAffiliationCategory(categoryIndex, 'categoryName', e.target.value)}
                            placeholder="Kategori-navn"
                            className="flex-1 rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm outline-none focus:border-[#FF5B00]"
                          />
                          <button
                            type="button"
                            onClick={() => setClientData((prev) => ({
                              ...prev,
                              affiliations: prev.affiliations.filter((_, current) => current !== categoryIndex),
                            }))}
                            className="rounded-lg border border-[#FECACA] px-2 py-2 text-red-600"
                            aria-label="Fjern kategori"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {category.items.map((item, itemIndex) => (
                            <div key={item.id} className="grid gap-2 md:grid-cols-4">
                              <input
                                value={item.title}
                                onChange={(e) => updateAffiliationItem(categoryIndex, itemIndex, 'title', e.target.value)}
                                placeholder="Tittel"
                                className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm outline-none focus:border-[#FF5B00]"
                              />
                              <input
                                value={item.description}
                                onChange={(e) => updateAffiliationItem(categoryIndex, itemIndex, 'description', e.target.value)}
                                placeholder="Beskrivelse"
                                className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm outline-none focus:border-[#FF5B00]"
                              />
                              <input
                                value={item.imageUrl}
                                onChange={(e) => updateAffiliationItem(categoryIndex, itemIndex, 'imageUrl', e.target.value)}
                                placeholder="Bilde/Logo URL"
                                className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm outline-none focus:border-[#FF5B00]"
                              />
                              <button
                                type="button"
                                onClick={() => setClientData((prev) => {
                                  const categories = [...prev.affiliations];
                                  const nextItems = categories[categoryIndex].items.filter((_, current) => current !== itemIndex);
                                  categories[categoryIndex] = { ...categories[categoryIndex], items: nextItems };
                                  return { ...prev, affiliations: categories };
                                })}
                                className="rounded-lg border border-[#FECACA] px-2 py-2 text-sm text-red-600"
                              >
                                Fjern
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setClientData((prev) => {
                            const categories = [...prev.affiliations];
                            categories[categoryIndex] = {
                              ...categories[categoryIndex],
                              items: [
                                ...categories[categoryIndex].items,
                                { id: randomId('aff-item'), title: '', description: '', imageUrl: '' },
                              ],
                            };
                            return { ...prev, affiliations: categories };
                          })}
                          className="inline-flex items-center gap-1 text-xs text-[#FF5B00]"
                        >
                          <Plus size={12} /> Legg til element
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[#111827]">6) Produkter og tjenester</h2>
                    <button
                      type="button"
                      onClick={() => setClientData((prev) => ({
                        ...prev,
                        products: [
                          ...prev.products,
                          { id: randomId('prod-cat'), categoryName: '', items: [] },
                        ],
                      }))}
                      className="inline-flex items-center gap-1 text-sm text-[#FF5B00]"
                    >
                      <Plus size={14} /> Ny kategori
                    </button>
                  </div>
                  <div className="mt-4 space-y-4">
                    {clientData.products.length === 0 ? (
                      <p className="text-sm text-[#6B7280]">Ingen produktkategorier enda.</p>
                    ) : null}
                    {clientData.products.map((category, categoryIndex) => (
                      <div key={category.id} className="rounded-xl border border-[#E5E7EB] p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            value={category.categoryName}
                            onChange={(e) => updateProductCategory(categoryIndex, 'categoryName', e.target.value)}
                            placeholder="Kategori-navn"
                            className="flex-1 rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm outline-none focus:border-[#FF5B00]"
                          />
                          <button
                            type="button"
                            onClick={() => setClientData((prev) => ({
                              ...prev,
                              products: prev.products.filter((_, current) => current !== categoryIndex),
                            }))}
                            className="rounded-lg border border-[#FECACA] px-2 py-2 text-red-600"
                            aria-label="Fjern produktkategori"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {category.items.map((item, itemIndex) => (
                            <div key={item.id} className="rounded-lg border border-[#EEF2F7] p-3 space-y-2">
                              <div className="grid gap-2 md:grid-cols-2">
                                <input
                                  value={item.title}
                                  onChange={(e) => updateProductItem(categoryIndex, itemIndex, 'title', e.target.value)}
                                  placeholder="Produktnavn"
                                  className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm outline-none focus:border-[#FF5B00]"
                                />
                                <input
                                  value={item.price}
                                  onChange={(e) => updateProductItem(categoryIndex, itemIndex, 'price', e.target.value)}
                                  placeholder="Pris (f.eks. 1 999,-)"
                                  className="rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm outline-none focus:border-[#FF5B00]"
                                />
                              </div>
                              <textarea
                                value={item.description}
                                onChange={(e) => updateProductItem(categoryIndex, itemIndex, 'description', e.target.value)}
                                placeholder="Beskrivelse"
                                rows={2}
                                className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm outline-none focus:border-[#FF5B00]"
                              />
                              <input
                                value={item.imageUrl}
                                onChange={(e) => updateProductItem(categoryIndex, itemIndex, 'imageUrl', e.target.value)}
                                placeholder="Produktbilde URL"
                                className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm outline-none focus:border-[#FF5B00]"
                              />
                              <div className="flex flex-wrap items-center gap-4">
                                <label className="inline-flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={item.contactInsteadOfPrice}
                                    onChange={(e) => updateProductItem(categoryIndex, itemIndex, 'contactInsteadOfPrice', e.target.checked)}
                                  />
                                  Kontakt oss i stedet for pris
                                </label>
                                <label className="inline-flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={item.included}
                                    onChange={(e) => updateProductItem(categoryIndex, itemIndex, 'included', e.target.checked)}
                                  />
                                  Produktet er valgt/inkludert
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setClientData((prev) => {
                                    const categories = [...prev.products];
                                    const nextItems = categories[categoryIndex].items.filter((_, current) => current !== itemIndex);
                                    categories[categoryIndex] = { ...categories[categoryIndex], items: nextItems };
                                    return { ...prev, products: categories };
                                  })}
                                  className="ml-auto rounded-lg border border-[#FECACA] px-2 py-1 text-xs text-red-600"
                                >
                                  Fjern produkt
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setClientData((prev) => {
                            const categories = [...prev.products];
                            categories[categoryIndex] = {
                              ...categories[categoryIndex],
                              items: [
                                ...categories[categoryIndex].items,
                                {
                                  id: randomId('prod-item'),
                                  title: '',
                                  description: '',
                                  price: '',
                                  contactInsteadOfPrice: false,
                                  imageUrl: '',
                                  included: true,
                                },
                              ],
                            };
                            return { ...prev, products: categories };
                          })}
                          className="inline-flex items-center gap-1 text-xs text-[#FF5B00]"
                        >
                          <Plus size={12} /> Legg til produkt
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <h2 className="text-lg font-semibold text-[#111827]">7) Media og filer</h2>
                  <div className="mt-4 space-y-4">
                    {MEDIA_BUCKETS.map((bucket) => (
                      <div key={bucket.key} className="rounded-xl border border-[#E5E7EB] p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-[#111827]">{bucket.label}</h3>
                          <button
                            type="button"
                            onClick={() => setClientData((prev) => ({
                              ...prev,
                              media: {
                                ...prev.media,
                                [bucket.key]: [...prev.media[bucket.key], ''],
                              },
                            }))}
                            className="inline-flex items-center gap-1 text-xs text-[#FF5B00]"
                          >
                            <Plus size={12} /> Legg til fil-URL
                          </button>
                        </div>
                        <div className="mt-2 space-y-2">
                          {clientData.media[bucket.key].map((fileUrl, index) => (
                            <div key={`${bucket.key}-${index}`} className="flex gap-2">
                              <input
                                value={fileUrl}
                                onChange={(e) => setClientData((prev) => {
                                  const bucketValues = [...prev.media[bucket.key]];
                                  bucketValues[index] = e.target.value;
                                  return {
                                    ...prev,
                                    media: { ...prev.media, [bucket.key]: bucketValues },
                                  };
                                })}
                                placeholder="https://..."
                                className="flex-1 rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm outline-none focus:border-[#FF5B00]"
                              />
                              <button
                                type="button"
                                onClick={() => setClientData((prev) => ({
                                  ...prev,
                                  media: {
                                    ...prev.media,
                                    [bucket.key]: prev.media[bucket.key].filter((_, current) => current !== index),
                                  },
                                }))}
                                className="rounded-lg border border-[#FECACA] px-2 text-red-600"
                                aria-label="Fjern fil-url"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <h2 className="text-lg font-semibold text-[#111827]">8) Nettsidebygger v2-spørsmål</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm">
                      <span className="block text-[#374151] mb-1">Målgruppe</span>
                      <input
                        value={clientData.websiteCreatorQuestions.targetAudience}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          websiteCreatorQuestions: { ...prev.websiteCreatorQuestions, targetAudience: e.target.value },
                        }))}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="block text-[#374151] mb-1">Kjernebudskap</span>
                      <input
                        value={clientData.websiteCreatorQuestions.keyMessage}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          websiteCreatorQuestions: { ...prev.websiteCreatorQuestions, keyMessage: e.target.value },
                        }))}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="block text-[#374151] mb-1">Tone og stil</span>
                      <input
                        value={clientData.websiteCreatorQuestions.toneOfVoice}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          websiteCreatorQuestions: { ...prev.websiteCreatorQuestions, toneOfVoice: e.target.value },
                        }))}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="block text-[#374151] mb-1">Primær CTA-handling</span>
                      <input
                        value={clientData.websiteCreatorQuestions.primaryAction}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          websiteCreatorQuestions: { ...prev.websiteCreatorQuestions, primaryAction: e.target.value },
                        }))}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                      />
                    </label>
                    <label className="text-sm md:col-span-2">
                      <span className="block text-[#374151] mb-1">Viktige nøkkelord (kommaseparert)</span>
                      <input
                        value={clientData.websiteCreatorQuestions.importantKeywords.join(', ')}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          websiteCreatorQuestions: {
                            ...prev.websiteCreatorQuestions,
                            importantKeywords: e.target.value.split(',').map((word) => word.trim()).filter(Boolean),
                          },
                        }))}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                      />
                    </label>
                    <label className="text-sm md:col-span-2">
                      <span className="block text-[#374151] mb-1">Konkurrentlenker (kommaseparert)</span>
                      <input
                        value={clientData.websiteCreatorQuestions.competitorLinks.join(', ')}
                        onChange={(e) => setClientData((prev) => ({
                          ...prev,
                          websiteCreatorQuestions: {
                            ...prev.websiteCreatorQuestions,
                            competitorLinks: e.target.value.split(',').map((word) => word.trim()).filter(Boolean),
                          },
                        }))}
                        className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 outline-none focus:border-[#FF5B00]"
                      />
                    </label>
                  </div>
                </section>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void saveClientData()}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#FF5B00] px-5 py-3 text-sm font-medium text-white hover:bg-[#E55200] disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                    Lagre kundedata
                  </button>
                </div>
              </div>
            ) : null}

            {activeSection === 'fakturering' ? (
              <div className="space-y-5">
                <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <h2 className="text-lg font-semibold text-[#111827]">Abonnement og fakturering</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-4">
                      <p className="text-xs text-[#6B7280]">Status</p>
                      <p className="mt-1 text-sm font-semibold text-[#111827]">
                        {BILLING_STATUS_LABELS[String(summary?.status || '')] || summary?.status || 'Ukjent'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-4">
                      <p className="text-xs text-[#6B7280]">Aktiv plan</p>
                      <p className="mt-1 text-sm font-semibold text-[#111827]">{summary?.planName || 'Ingen plan valgt'}</p>
                      <p className="mt-1 text-xs text-[#6B7280]">{toMoney(Number(summary?.amount || 0), summary?.currency || 'nok')}/mnd</p>
                    </div>
                    <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-4">
                      <p className="text-xs text-[#6B7280]">Neste periode-slutt</p>
                      <p className="mt-1 text-sm font-semibold text-[#111827]">
                        {summary?.currentPeriodEnd ? toIsoDate(summary.currentPeriodEnd) : 'Ikke tilgjengelig'}
                      </p>
                    </div>
                  </div>

                  {billing?.warnings?.length ? (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      {billing.warnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void openStripePortal()}
                      disabled={busyAction === 'portal' || !billing?.stripePortalAvailable}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#D1D5DB] px-4 py-2 text-sm text-[#111827] hover:bg-[#F9FAFB] disabled:opacity-50"
                    >
                      {busyAction === 'portal' ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                      Administrer i Stripe
                    </button>
                    {summary?.cancelAtPeriodEnd ? (
                      <button
                        type="button"
                        onClick={() => void resumeSubscription()}
                        disabled={busyAction === 'resume'}
                        className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {busyAction === 'resume' ? 'Gjenopptar...' : 'Gjenoppta abonnement'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void cancelSubscription()}
                        disabled={busyAction === 'cancel'}
                        className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        {busyAction === 'cancel' ? 'Avslutter...' : 'Avslutt abonnement ved periodens slutt'}
                      </button>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <h2 className="text-lg font-semibold text-[#111827]">Oppgrader abonnementstier</h2>
                  <p className="mt-1 text-sm text-[#6B7280]">
                    Velg ny plan. Dersom aktivt Stripe-abonnement finnes, oppdateres det direkte.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {(billing?.availablePlans?.length ? billing.availablePlans : CLIENT_WEBSITE_PLANS.map((plan) => ({
                      id: plan.id,
                      name: plan.name,
                      price: plan.price,
                      description: plan.description,
                      isCurrent: summary?.planId === plan.id,
                      stripePriceConfigured: true,
                    }))).map((plan) => (
                      <div key={plan.id} className={`rounded-xl border p-4 ${plan.isCurrent ? 'border-[#FF5B00] bg-[#FFF7F2]' : 'border-[#E5E7EB] bg-white'}`}>
                        <p className="text-sm font-semibold text-[#111827]">{plan.name}</p>
                        <p className="mt-1 text-sm text-[#6B7280]">{plan.price}</p>
                        <p className="mt-2 text-xs text-[#6B7280]">{plan.description}</p>
                        <button
                          type="button"
                          onClick={() => void upgradePlan(plan.id)}
                          disabled={plan.isCurrent || busyAction === `upgrade:${plan.id}`}
                          className="mt-4 w-full rounded-lg bg-[#111827] px-3 py-2 text-sm text-white hover:bg-[#1F2937] disabled:opacity-50"
                        >
                          {plan.isCurrent
                            ? 'Aktiv plan'
                            : busyAction === `upgrade:${plan.id}`
                              ? 'Oppgraderer...'
                              : 'Oppgrader til denne'}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <h2 className="text-lg font-semibold text-[#111827]">Fakturahistorikk og betalinger</h2>
                  {invoices.length === 0 ? (
                    <p className="mt-2 text-sm text-[#6B7280]">Ingen fakturaer eller betalinger registrert enda.</p>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[680px] text-sm">
                        <thead>
                          <tr className="text-left text-[#6B7280]">
                            <th className="pb-2 font-medium">Faktura</th>
                            <th className="pb-2 font-medium">Status</th>
                            <th className="pb-2 font-medium">Beløp</th>
                            <th className="pb-2 font-medium">Dato</th>
                            <th className="pb-2 font-medium">Handling</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map((invoice) => (
                            <tr key={invoice.id} className="border-t border-[#EEF1F5]">
                              <td className="py-3">{invoice.number || invoice.id}</td>
                              <td className="py-3">
                                {BILLING_STATUS_LABELS[invoice.status || (invoice.paid ? 'paid' : 'open')] || invoice.status || (invoice.paid ? 'paid' : 'open')}
                              </td>
                              <td className="py-3">
                                {toMoney(Number(invoice.amountPaid || invoice.amountDue || 0), invoice.currency || summary?.currency || 'nok')}
                              </td>
                              <td className="py-3">{toIsoDate(invoice.createdAt)}</td>
                              <td className="py-3">
                                {invoice.hostedInvoiceUrl ? (
                                  <a
                                    href={invoice.hostedInvoiceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[#FF5B00] hover:text-[#E55200]"
                                  >
                                    Åpne
                                  </a>
                                ) : (
                                  <span className="text-[#9CA3AF]">Ingen lenke</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            ) : null}

            {activeSection === 'konto' ? (
              <div className="space-y-5">
                <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <h2 className="text-lg font-semibold text-[#111827]">Kontoinformasjon</h2>
                  <div className="mt-3 space-y-2 text-sm">
                    <p><span className="text-[#6B7280]">E-post:</span> {profile?.email || '—'}</p>
                    <p><span className="text-[#6B7280]">Bedrift:</span> {profile?.businessName || clientData.generalInfo.companyName || '—'}</p>
                    <p><span className="text-[#6B7280]">Konto-ID:</span> {profile?.userId || '—'}</p>
                  </div>
                </section>

                <section className="rounded-2xl border border-red-200 bg-red-50/60 p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 text-red-500" size={18} />
                    <div>
                      <h2 className="text-lg font-semibold text-red-700">Slett bruker (data beholdes)</h2>
                      <p className="mt-1 text-sm text-red-700/90">
                        Når du avslutter kontoen, fjernes innloggingen din. Kundedata, historikk og leveransedata beholdes.
                      </p>
                      <p className="mt-2 text-xs text-red-700/90">
                        Skriv <strong>SLETT</strong> i feltet under for å bekrefte.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                      placeholder="Skriv SLETT"
                      className="flex-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500"
                    />
                    <button
                      type="button"
                      onClick={() => void deleteAccount()}
                      disabled={deletingAccount || deleteConfirm.trim().toUpperCase() !== 'SLETT'}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deletingAccount ? 'Avslutter konto...' : 'Avslutt konto'}
                    </button>
                  </div>
                </section>

                <p className="text-xs text-[#9CA3AF]">
                  Trenger du hjelp før avslutning? Kontakt oss i{' '}
                  <Link to="/kunde/hjem" className="text-[#FF5B00] hover:text-[#E55200]">
                    chatten i portalen
                  </Link>
                  .
                </p>
              </div>
            ) : null}
          </div>
        )}
      </ClientPortalLayout>
    </ClientRouteGuard>
  );
};

