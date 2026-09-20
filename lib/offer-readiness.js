/**
 * Which sales-client fields must be filled before an offer (tilbud) + contract can be sent.
 * Used by the composer banner (frontend) and enforced on the send / request-review routes (server).
 */

const REQUIRED_FIELDS = [
  { key: 'businessName', label: 'Bedriftsnavn' },
  { key: 'orgNumber', label: 'Org. nr (9 siffer)' },
  { key: 'businessAddress', label: 'Forretningsadresse' },
  { key: 'contactPerson', label: 'Kontaktperson (innehaver)' },
  { key: 'contactEmail', label: 'E-post til kontaktperson' },
];

function text(value) {
  return String(value ?? '').trim();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
}

/** Registered address for the contract; falls back to the meeting/business address on the card. */
export function contractAddressFor(client = {}) {
  return text(client.businessAddress) || text(client.meetingPlace);
}

export function offerMissingFields(client = {}) {
  const missing = [];
  for (const field of REQUIRED_FIELDS) {
    let value = text(client[field.key]);
    if (field.key === 'businessAddress') value = contractAddressFor(client);
    if (field.key === 'orgNumber') value = value.replace(/\D+/g, '').length === 9 ? value : '';
    if (field.key === 'contactEmail') value = isEmail(value) ? value : '';
    if (!value) missing.push({ key: field.key, label: field.label });
  }
  return missing;
}

export function offerIsReady(client = {}) {
  return offerMissingFields(client).length === 0;
}

export function offerReadinessMessage(missing = []) {
  if (!missing.length) return '';
  return `Mangler på kundekortet: ${missing.map((item) => item.label).join(', ')}.`;
}

export { REQUIRED_FIELDS as OFFER_REQUIRED_FIELDS };
