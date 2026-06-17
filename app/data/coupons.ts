export type Coupon = {
  code: string;
  type: 'percent' | 'amount';
  value: number;
  label: string;
};

export const COUPONS: Coupon[] = [
  { code: 'ASOLDI10', type: 'percent', value: 10, label: '10% rabatt' },
  { code: 'VELKOMMEN', type: 'percent', value: 15, label: '15% velkomstrabatt' },
  { code: 'GRATISOPPSTART', type: 'amount', value: 999, label: 'Gratis oppstart (999,- avslag)' },
];

export function normalizeCouponCode(value: string) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function findCoupon(code: string): Coupon | null {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return null;
  return COUPONS.find((coupon) => coupon.code === normalized) || null;
}

/** Extract the leading numeric amount from a Norwegian price string like "1 499,-/mnd". */
export function parsePriceAmount(price: string): number {
  const digits = String(price || '').replace(/[^\d]/g, '');
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatPriceAmount(amount: number, suffix = ',-/mnd'): string {
  const safe = Math.max(0, Math.round(amount));
  const grouped = safe.toLocaleString('nb-NO').replace(/\u00A0/g, ' ');
  return `${grouped}${suffix}`;
}

export function computeDiscount(priceAmount: number, coupon: Coupon | null): number {
  if (!coupon || priceAmount <= 0) return 0;
  if (coupon.type === 'percent') {
    return Math.round((priceAmount * coupon.value) / 100);
  }
  return Math.min(priceAmount, coupon.value);
}

const COUPON_STORAGE_PREFIX = 'clientCoupon:';

export function getStoredCoupon(userId: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(`${COUPON_STORAGE_PREFIX}${userId || 'anon'}`) || '';
  } catch {
    return '';
  }
}

export function storeCoupon(userId: string, code: string) {
  if (typeof window === 'undefined') return;
  try {
    const key = `${COUPON_STORAGE_PREFIX}${userId || 'anon'}`;
    if (code) window.localStorage.setItem(key, code);
    else window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures (private mode, etc.).
  }
}
