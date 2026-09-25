function sanitizeEmail(value = '') {
  return String(value ?? '').trim();
}

/**
 * Persist a website email only when it differs from the client contact email.
 * Contact email stays the sales/development card address; website email is a
 * temporary public-site address until the Maker draft adds another one.
 */
export function normalizeStoredWebsiteEmail(websiteEmail = '', contactEmail = '') {
  const website = sanitizeEmail(websiteEmail);
  const contact = sanitizeEmail(contactEmail);
  if (!website) return '';
  if (contact && website.toLowerCase() === contact.toLowerCase()) return '';
  return website;
}

/** Website email if set, otherwise the development/sales contact email. */
export function resolveWebsiteEmail(client = {}) {
  return (
    sanitizeEmail(client.websiteEmail) ||
    sanitizeEmail(client.contactEmail)
  );
}
