/** Admin who manages MyPhoner clients until a sales rep is assigned. Not a sales-rep assignment. */
export const MYPHONER_ADMIN_OWNER_KEY = 'admin:damian@asoldi.com';
export const GENERAL_SALES_OWNER_EMAIL = 'damian@asoldi.com';

function text(value) {
  return String(value ?? '').trim();
}

function emailOf(value) {
  return text(value).toLowerCase();
}

export function salesOwnerKeyFromUser(user = {}) {
  const id = text(user?.id);
  return id ? `sales:${id}` : '';
}

function emailForSalesKey(accountKey, salesUsers = []) {
  const key = text(accountKey);
  if (!key.startsWith('sales:')) return '';
  const id = key.slice('sales:'.length);
  const user = (Array.isArray(salesUsers) ? salesUsers : []).find((entry) => {
    const userId = text(entry?.id);
    return userId === id || emailOf(entry?.username) === emailOf(id);
  });
  return emailOf(user?.username);
}

/**
 * True when this owner is the catch-all MyPhoner used (damian@asoldi.com, or the
 * configured default when that default is itself a sales account).
 */
export function isGeneralSalesOwnerKey(accountKey, { salesUsers = [], defaultOwnerKey = '' } = {}) {
  const key = text(accountKey);
  if (!key.startsWith('sales:')) return false;
  const configured = text(defaultOwnerKey);
  if (configured.startsWith('sales:') && key === configured) return true;
  const email = emailForSalesKey(key, salesUsers);
  if (email === GENERAL_SALES_OWNER_EMAIL) return true;
  if (configured && !configured.includes(':') && email && email === emailOf(configured)) return true;
  return false;
}

export function generalSalesOwnerKeys({ salesUsers = [], defaultOwnerKey = '' } = {}) {
  const keys = new Set();
  const configured = text(defaultOwnerKey);
  if (configured.startsWith('sales:')) keys.add(configured);
  for (const user of Array.isArray(salesUsers) ? salesUsers : []) {
    const key = salesOwnerKeyFromUser(user);
    if (!key) continue;
    if (isGeneralSalesOwnerKey(key, { salesUsers, defaultOwnerKey })) keys.add(key);
  }
  return keys;
}

/**
 * MyPhoner holds the client on the admin account (damian@asoldi.com) until
 * someone assigns a sales rep. That admin owner does not send the confirmation.
 * A rep already chosen in Sales is kept. The old sales:damian catch-all is moved
 * back to the admin account.
 */
export function resolveMyphonerSalesOwnerId({
  existingOwnerId = '',
  salesUsers = [],
  defaultOwnerKey = '',
} = {}) {
  const existing = text(existingOwnerId);
  if (existing.startsWith('sales:') && !isGeneralSalesOwnerKey(existing, { salesUsers, defaultOwnerKey })) {
    return existing;
  }
  return MYPHONER_ADMIN_OWNER_KEY;
}
