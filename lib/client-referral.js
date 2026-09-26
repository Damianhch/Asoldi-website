export const REFERRAL_REWARD_LABEL = '2 000 kr';
export const REFERRAL_INBOX_EMAIL = 'damian@asoldi.com';

export const REFERRAL_SERVICES = [
  'Nettsideutvikling',
  'Sosiale Medier Marketing',
  'Innholdsproduksjon',
  'E-post Markedsføring',
  'Annet',
];

function clean(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase());
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function normalizeReferralLead(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const name = clean(source.name);
  const email = clean(source.email).toLowerCase();
  const phone = clean(source.phone);
  const businessNumber = clean(source.businessNumber || source.orgNumber).replace(/\s+/g, '');
  const service = clean(source.service);

  if (!name) return { ok: false, message: 'Navn kreves.' };
  if (!isEmail(email)) return { ok: false, message: 'Skriv inn en gyldig e-postadresse.' };
  if (phone.replace(/\D/g, '').length < 8) return { ok: false, message: 'Telefonnummer kreves.' };
  if (!/^\d{9}$/.test(businessNumber)) return { ok: false, message: 'Organisasjonsnummer må være 9 siffer.' };
  if (!REFERRAL_SERVICES.includes(service)) return { ok: false, message: 'Velg en tjeneste.' };

  return {
    ok: true,
    lead: { name, email, phone, businessNumber, service },
  };
}

export function buildReferralLeadEmail({ referrer = {}, lead = {} } = {}) {
  const who = referrer && typeof referrer === 'object' ? referrer : {};
  const lines = [
    'Referral lead',
    '',
    `Premie: ${REFERRAL_REWARD_LABEL} til bankkontoen på vervens profil, hvis personen blir kunde.`,
    '',
    'Vervet person:',
    `- Navn: ${lead.name || ''}`,
    `- E-post: ${lead.email || ''}`,
    `- Telefon: ${lead.phone || ''}`,
    `- Organisasjonsnummer: ${lead.businessNumber || ''}`,
    `- Tjeneste: ${lead.service || ''}`,
    '',
    'Verven (profilkort):',
    `- Navn: ${clean(who.name) || 'Ikke satt'}`,
    `- E-post: ${clean(who.email) || 'Ikke satt'}`,
    `- Bedrift: ${clean(who.businessName) || 'Ikke satt'}`,
    `- Organisasjonsnummer: ${clean(who.businessOrgNumber) || 'Ikke satt'}`,
    `- Bruker-ID: ${clean(who.userId) || 'Ikke satt'}`,
  ];
  const text = lines.join('\n');
  return {
    subject: `[Asoldi] Referral lead: ${lead.name || 'Ukjent'}`,
    text,
    html: `<pre style="font-family:sans-serif;white-space:pre-wrap;">${escapeHtml(text)}</pre>`,
  };
}
