/**
 * Offer (tilbud) email: the Norwegian template from "Produkt tilbud email template - asoldi.pdf"
 * rendered inside the branded Asoldi sales shell.
 *
 * Structure (marker attributes let sales / admin / AI replace parts without touching the rest):
 *   data-offer-slot="intro"     short "takk for samtalen om ..." sentence
 *   data-offer-slot="project"   three paragraphs about what the project covers
 *   data-offer-slot="terms"     client terms: what we need from them, how involved they want to be
 *   #offer-products … #offer-products-end   "Hva er inkludert" product blocks + totals
 *   data-offer-slot="delivery"  delivery time
 *   data-offer-slot="benefits"  what they achieve / where it is built / why
 *
 * This module is imported by both the server (Node) and the browser (composer / admin review),
 * so it must stay free of Node-only APIs.
 */

import { CUSTOM_TIER_ID, MVA_RATE, formatKr, tierById, tierOfferProduct } from './website-tiers.js';

const ORANGE = '#FF5B00';
const TEXT = '#1a1a1a';
const MUTED = '#5b5b5b';
const DEFAULT_DELIVERY_WEEKS = 4;

export const OFFER_TEMPLATE_KEY = 'offer';

function text(value = '') {
  return String(value ?? '').trim();
}

export function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function p(content, extra = '') {
  return `<p style="margin:0 0 14px;${extra}">${content}</p>`;
}

function h2(content) {
  return `<h2 style="margin:22px 0 10px;font-size:18px;line-height:1.3;font-weight:bold;color:${TEXT};">${content}</h2>`;
}

/**
 * Template placeholder the rep/AI must replace before sending. The data attribute lets the server find
 * leftovers even after the visual editor has reshuffled the inline style.
 */
function placeholder(label) {
  return `<span data-offer-placeholder="1" style="background:#fff3ea;color:#b34300;border-radius:4px;padding:0 4px;">[${escapeHtml(label)}]</span>`;
}

/* ------------------------------------------------------------------ totals */

/**
 * Price maths for the product list.
 *
 * `mvaIncluded` = the rep chose to absorb the VAT: the listed product price is then what the client pays
 * per month *including* 25 % MVA, so the ex-MVA share is price / 1.25. Default (false) adds 25 % on top.
 */
export function offerTotals(products = [], { mvaIncluded = false } = {}) {
  const list = Array.isArray(products) ? products : [];
  const listed = list.reduce((sum, item) => sum + (Number(item?.priceExMva) || 0), 0);
  const deliveryWeeks = list.reduce((max, item) => Math.max(max, Number(item?.deliveryWeeks) || 0), 0) || DEFAULT_DELIVERY_WEEKS;
  if (mvaIncluded) {
    const inclMva = listed;
    const exMva = Math.round(inclMva / (1 + MVA_RATE));
    return { exMva, mva: inclMva - exMva, inclMva, deliveryWeeks, count: list.length, mvaIncluded: true, listed };
  }
  const exMva = listed;
  const mva = Math.round(exMva * MVA_RATE);
  return { exMva, mva, inclMva: exMva + mva, deliveryWeeks, count: list.length, mvaIncluded: false, listed };
}

/** Per-product price with the right VAT label for the offer's MVA mode. */
export function productPriceLabel(product = {}, { mvaIncluded = false } = {}) {
  const price = Number(product?.priceExMva) || 0;
  return `${formatKr(price)} ${mvaIncluded ? 'inkl. mva' : 'eks. mva'} per måned`;
}

/* ---------------------------------------------------------- product blocks */

export function renderOfferProductHtml(product = {}, options = {}) {
  const name = text(product.name) || 'Produkt';
  const pages = Number(product.pages) || 0;
  const includes = Array.isArray(product.includes) ? product.includes.map(text).filter(Boolean) : [];
  const note = text(product.note);
  const items = [
    pages > 0 ? `<li style="margin:0 0 4px;">Opp til ${pages} sider</li>` : '',
    ...includes.map((line) => `<li style="margin:0 0 4px;">${escapeHtml(line)}</li>`),
  ].filter(Boolean).join('');
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" data-offer-product="1" data-product-id="${escapeHtml(text(product.id))}" data-tier-id="${escapeHtml(text(product.tierId))}" style="width:100%;margin:0 0 14px;border:1px solid #ececec;border-radius:10px;">
  <tr>
    <td style="padding:14px 16px;font-size:15px;line-height:1.6;color:${TEXT};">
      <p style="margin:0 0 6px;font-size:16px;font-weight:bold;">${escapeHtml(name)}</p>
      <p style="margin:0 0 4px;">Inkluderer:</p>
      <ul style="margin:0 0 10px;padding-left:20px;">${items || '<li style="margin:0 0 4px;">Etter avtale</li>'}</ul>
      ${note ? `<p style="margin:0 0 10px;color:${MUTED};"><em>Notat:</em> ${escapeHtml(note)}</p>` : ''}
      <p style="margin:0;font-weight:bold;">Pris: ${escapeHtml(productPriceLabel(product, options))}</p>
    </td>
  </tr>
</table>`;
}

export function renderOfferTotalsHtml(products = [], options = {}) {
  const totals = offerTotals(products, options);
  const breakdown = totals.mvaIncluded
    ? `<p style="margin:0 0 4px;">Pris inkl. mva: <strong>${escapeHtml(formatKr(totals.inclMva))}</strong> per måned</p>
      <p style="margin:0 0 4px;">Herav MVA (25 %): ${escapeHtml(formatKr(totals.mva))} · eks. mva: ${escapeHtml(formatKr(totals.exMva))}</p>`
    : `<p style="margin:0 0 4px;">Pris eks. mva: <strong>${escapeHtml(formatKr(totals.exMva))}</strong> per måned</p>
      <p style="margin:0 0 4px;">MVA (25 %): ${escapeHtml(formatKr(totals.mva))}</p>`;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" data-offer-totals="1" data-mva-included="${totals.mvaIncluded ? '1' : '0'}" style="width:100%;margin:4px 0 6px;background:#fff7f2;border-radius:10px;">
  <tr>
    <td style="padding:14px 16px;font-size:15px;line-height:1.6;color:${TEXT};">
      ${breakdown}
      <p style="margin:0 0 8px;font-size:17px;font-weight:bold;color:${ORANGE};">Totalt: ${escapeHtml(formatKr(totals.inclMva))} inkl. mva per måned</p>
      <p style="margin:0;font-size:13px;color:${MUTED};">Løpende månedlig tjeneste – nettside, hosting og vedlikehold faktureres månedlig så lenge avtalen løper.</p>
    </td>
  </tr>
</table>`;
}

export function renderOfferProductsSection(products = [], options = {}) {
  const list = Array.isArray(products) ? products : [];
  if (!list.length) {
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" data-offer-empty="1" style="width:100%;margin:0 0 14px;border:1px dashed #d9d9d9;border-radius:10px;">
  <tr>
    <td style="padding:14px 16px;font-size:15px;line-height:1.6;color:${MUTED};">
      ${placeholder('Velg nettside tier for å fylle inn pakke, innhold og pris')}
    </td>
  </tr>
</table>`;
  }
  return `${list.map((item) => renderOfferProductHtml(item, options)).join('')}${renderOfferTotalsHtml(list, options)}`;
}

// Attribute order may change after a round-trip through the visual editor, so match ids anywhere in the tag.
const PRODUCTS_RE = /(<div\b[^>]*\bid="offer-products"[^>]*>)[\s\S]*?(<div\b[^>]*\bid="offer-products-end"[^>]*>\s*<\/div>)/i;

/** Swap the whole "Hva er inkludert" block. Works on the raw HTML so it can run in Node or the browser. */
export function replaceOfferProducts(html = '', products = [], options = {}) {
  const section = renderOfferProductsSection(products, options);
  const source = String(html || '');
  if (PRODUCTS_RE.test(source)) {
    return source.replace(PRODUCTS_RE, (_match, open, close) => `${open}${section}${close}`);
  }
  // Markers were removed in the editor: re-insert before "Hva som skjer fremover", else append.
  const block = `${h2('Hva er inkludert')}<div id="offer-products">${section}<div id="offer-products-end"></div></div>`;
  const anchor = source.search(/<h2[^>]*>\s*Hva som skjer fremover/i);
  if (anchor >= 0) return `${source.slice(0, anchor)}${block}${source.slice(anchor)}`;
  return `${source}${block}`;
}

/* ------------------------------------------------------- template hygiene */

// Envelope illustration + centered heading from the confirmation shell (any attribute order).
const ENVELOPE_IMG_RE = /<img\b(?=[^>]*\bwidth="160")(?=[^>]*\balt="")[^>]*>/gi;
const CENTERED_TITLE_TD_RE = /(<td\b[^>]*style="[^"]*)text-align:center;([^"]*"[^>]*>\s*<h1\b[^>]*>\s*Tilbud fra Asoldi\s*<\/h1>)/i;

/**
 * Bring an already-stored offer draft up to the current shell: no envelope icon, heading left-aligned.
 * Idempotent, so it is safe to run on every read of a non-sent offer.
 */
export function unboldOfferTermsLabel(html = '') {
  return String(html || '')
    .replace(/<strong>\s*Kundebetingelser:\s*<\/strong>\s*/gi, '')
    .replace(/\bKundebetingelser:\s*/gi, '');
}

/** The contract line belongs in "Hva som skjer fremover", not as its own paragraph. */
export function foldContractSentence(html = '') {
  const source = String(html || '');
  const standalone = /<p\b[^>]*>\s*Vedlagt ligger kontrakten[\s\S]*?<\/p>\s*/i;
  if (!standalone.test(source)) return source;
  const sentence = 'Vedlagt ligger kontrakten for pakken. Den signeres først når dere har bestemt dere, og ingenting betales før nettsiden er levert. ';
  const stripped = source.replace(standalone, '');
  if (/Hva som skjer fremover[\s\S]{0,400}Vedlagt ligger kontrakten/i.test(stripped)) return stripped;
  return stripped.replace(
    /(<h2\b[^>]*>\s*Hva som skjer fremover\s*<\/h2>\s*<p\b[^>]*>)/i,
    `$1${sentence}`
  );
}

export function ensurePlatformParagraph(html = '') {
  const source = String(html || '');
  if (/eget CMS/i.test(source)) return source;
  const paragraph = `<p style="margin:0 0 14px;">${OFFER_PLATFORM}</p>`;
  const anchor = source.search(/<h2\b[^>]*>\s*Hva er inkludert/i);
  if (anchor < 0) return `${source}${paragraph}`;
  return `${source.slice(0, anchor)}${paragraph}${source.slice(anchor)}`;
}

export function refreshOfferShell(html = '') {
  return ensurePlatformParagraph(foldContractSentence(unboldOfferTermsLabel(String(html || '')
    .replace(ENVELOPE_IMG_RE, '')
    .replace(CENTERED_TITLE_TD_RE, (_match, open, rest) => `${open}text-align:left;${rest}`))));
}

const OFFER_IDENTITY_TOKENS = new Set(['firstName', 'fullName', 'businessName', 'signerName', 'signerEmail', 'signerPhone']);

/** Replace only the client and sales-rep tokens. Other tokens, including {{need}}, stay for later. */
export function resolveOfferIdentityTags(template = '', values = {}, { escape = true } = {}) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (!OFFER_IDENTITY_TOKENS.has(key)) return match;
    const raw = values?.[key];
    if (raw == null || String(raw).trim() === '') return match;
    return escape ? escapeHtml(String(raw)) : String(raw);
  });
}

const PLACEHOLDER_TAG_RE = /<span\b[^>]*data-offer-placeholder="1"[^>]*>([\s\S]*?)<\/span>/gi;
const LEGACY_PLACEHOLDER_RE = /<span\b(?=[^>]*background:\s*#fff3ea)[^>]*>\s*\[([\s\S]*?)\]\s*<\/span>/gi;

function decodeEntities(value = '') {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ');
}

/** Template placeholders still present in the email — these must be filled or deleted before sending. */
export function findOfferPlaceholders(html = '') {
  const source = String(html || '');
  const found = [];
  const seen = new Set();
  for (const re of [PLACEHOLDER_TAG_RE, LEGACY_PLACEHOLDER_RE]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(source))) {
      const label = decodeEntities(match[1].replace(/<[^>]+>/g, '')).replace(/^\s*\[|\]\s*$/g, '').trim();
      if (!label || seen.has(label)) continue;
      seen.add(label);
      found.push(label);
    }
  }
  return found;
}

export function replaceOfferSlot(html = '', slot = '', innerHtml = '') {
  const name = text(slot);
  if (!name) return String(html || '');
  const re = new RegExp(`(<(span|div|p)\\b[^>]*\\bdata-offer-slot="${name}"[^>]*>)[\\s\\S]*?(<\\/\\2>)`, 'i');
  const source = String(html || '');
  if (!re.test(source)) return source;
  return source.replace(re, (_match, open, _tag, close) => `${open}${innerHtml}${close}`);
}

export function replaceOfferDelivery(html = '', products = []) {
  const totals = offerTotals(products);
  return replaceOfferSlot(html, 'delivery', `${totals.deliveryWeeks} uker fra oppstart`);
}

/** Tier selection from the composer: one tier product replaces any previous tier product, custom products stay. */
export function productsWithTier(products = [], tierId = '') {
  const list = Array.isArray(products) ? products.filter((item) => item?.kind !== 'tier') : [];
  if (!tierId || tierId === CUSTOM_TIER_ID) return list;
  const tier = tierById(tierId);
  if (!tier) return list;
  return [{ ...tierOfferProduct(tier), id: `prod-${tier.id}` }, ...list];
}

export function applyOfferProducts(html = '', products = [], options = {}) {
  return replaceOfferDelivery(replaceOfferProducts(html, products, options), products);
}

/* ------------------------------------------------------------ AI slot fill */

function paragraphs(list = []) {
  return (Array.isArray(list) ? list : [list]).map(text).filter(Boolean).map((line) => p(escapeHtml(line))).join('');
}

/**
 * Fill the nuance slots (from Fireflies + DeepSeek or from a human). Only slots with content are touched.
 * `need` is the short "[veldig kort om prosjekt / behov]" phrase in the intro sentence.
 */
function slotInner(html = '', slot = '') {
  const re = new RegExp(`<(span|div|p)\\b[^>]*\\bdata-offer-slot="${slot}"[^>]*>([\\s\\S]*?)<\\/\\1>`, 'i');
  const match = String(html || '').match(re);
  return match ? match[2] : '';
}

/** A slot still has the template blank, so meeting copy may be written there. */
export function offerSlotIsOpen(html = '', slot = '') {
  const inner = slotInner(html, slot);
  if (!inner) return false;
  if (/\{\{need\}\}/.test(inner)) return true;
  return /data-offer-placeholder\s*=\s*"1"/.test(inner);
}

export function fillOfferSlots(html = '', { need = '', project = [], terms = '', benefits = '' } = {}, { onlyOpen = false } = {}) {
  let next = String(html || '');
  const open = (slot) => !onlyOpen || offerSlotIsOpen(next, slot);
  if (text(need) && open('need')) next = replaceOfferSlot(next, 'need', escapeHtml(text(need)));
  if ((Array.isArray(project) ? project.some(text) : text(project)) && open('project')) {
    next = replaceOfferSlot(next, 'project', paragraphs(project));
  }
  if (text(terms) && open('terms')) {
    next = replaceOfferSlot(next, 'terms', p(escapeHtml(text(terms))));
  }
  if (text(benefits) && open('benefits')) next = replaceOfferSlot(next, 'benefits', paragraphs(benefits));
  return next;
}

/* -------------------------------------------------------------- template */

function offerSignerHtml({ mergeTags = true, sender = {} } = {}) {
  const name = mergeTags ? '{{signerName}}' : escapeHtml(text(sender.name) || String(text(sender.fullName) || '').split(/\s+/)[0] || 'Damian');
  const email = mergeTags ? '{{signerEmail}}' : escapeHtml(text(sender.fromEmail) || 'damian@asoldi.com');
  // The rep's own number comes from their user profile (admin → Users → Telefon) via {{signerPhone}}.
  const phone = mergeTags ? '{{signerPhone}}' : escapeHtml(text(sender.phone) || '+47 48 33 91 91');
  return `
    <p style="margin:0 0 8px;">Med vennlig hilsen<br/><strong>${name} fra Asoldi</strong></p>
    <p style="margin:0 0 10px;color:${MUTED};">P.S: Har du spørsmål om våre priser, referanser eller tjenester kan du sjekke nettsiden vår på <a href="https://asoldi.com" target="_blank" style="color:${ORANGE};text-decoration:underline;">asoldi.com</a>.</p>
    <p style="margin:0;color:${MUTED};font-size:13px;">Kontor: Østre berg 10, Trondheim<br/>${phone} &nbsp;|&nbsp; <a href="mailto:${mergeTags ? '{{signerEmail}}' : email}" style="color:${TEXT};text-decoration:none;">${email}</a> &nbsp;|&nbsp; asoldi.com</p>`;
}

const OFFER_INTRO_BEFORE_NEED = 'Takk for samtalen om ';
const OFFER_INTRO_AFTER_NEED = 'Her er tilbudet, med hva som er inkludert og hva det vil koste.';
const OFFER_WORKSHOP = 'Vi tar en workshop der vi går gjennom dette og spør etter det som eventuelt mangler i tillegg.';
const OFFER_PLATFORM = 'Nettsiden bygges i vårt eget CMS. Der ligger automatiserte prosesser som hjelper bedriften å rangere på Google, Google Maps og i AI-søk.';
const OFFER_NEXT = 'Vedlagt ligger kontrakten for pakken. Den signeres først når dere har bestemt dere, og ingenting betales før nettsiden er levert. Når den er på plass avtaler vi oppstart og gir deg tilgang så du kan følge fremgangen. Ta gjerne kontakt om noe i tilbudet skal justeres.';

/** The letter the customer already sees, with {{slots}} for the only parts the model may write. */
export function offerLetterAlreadyWritten() {
  return [
    'Hei {{firstName}},',
    `${OFFER_INTRO_BEFORE_NEED}{{need}}. ${OFFER_INTRO_AFTER_NEED}`,
    '{{project}}',
    '{{benefits}}',
    OFFER_PLATFORM,
    'Hva er inkludert',
    '{{produktblokk med pakke, innhold og pris}}',
    'Leveringsdato: {{delivery}}',
    '{{terms}}',
    OFFER_WORKSHOP,
    'Hva som skjer fremover',
    OFFER_NEXT,
    'Ser frem til å høre fra dere!',
  ].join('\n');
}
export function buildOfferBodyHtml({ products = [], nuances = {}, mvaIncluded = false } = {}) {
  const totals = offerTotals(products, { mvaIncluded });
  const projectHtml = paragraphs(nuances.project) || [
    p(placeholder('Hva prosjektet omfatter, og hva som ble snakket om')),
    p(placeholder('Mer om innholdet og hvem siden er for')),
    p(placeholder('Hvordan vi går videre med det dere beskrev')),
  ].join('');
  const termsHtml = text(nuances.terms)
    ? p(escapeHtml(text(nuances.terms)))
    : p(placeholder('Hva dere sender inn, og hvor mye dere vil være med underveis'));
  const benefitsHtml = paragraphs(nuances.benefits)
    || p(placeholder('Vi kommer til å fokusere på det kunden vil oppnå'));
  const need = text(nuances.need) ? escapeHtml(text(nuances.need)) : '{{need}}';

  return `
    <p style="margin:0 0 14px;">Hei {{firstName}},</p>
    <p data-offer-slot="intro" style="margin:0 0 14px;">${OFFER_INTRO_BEFORE_NEED}<span data-offer-slot="need">${need}</span>. ${OFFER_INTRO_AFTER_NEED}</p>
    <div data-offer-slot="project">${projectHtml}</div>
    <div data-offer-slot="benefits">${benefitsHtml}</div>
    <p style="margin:0 0 14px;">${OFFER_PLATFORM}</p>
    ${h2('Hva er inkludert')}
    <div id="offer-products">${renderOfferProductsSection(products, { mvaIncluded })}<div id="offer-products-end"></div></div>
    <p style="margin:0 0 14px;"><strong>Leveringsdato:</strong> <span data-offer-slot="delivery">${totals.deliveryWeeks} uker fra oppstart</span></p>
    <div data-offer-slot="terms">${termsHtml}</div>
    <p style="margin:0 0 14px;">${OFFER_WORKSHOP}</p>
    ${h2('Hva som skjer fremover')}
    <p style="margin:0 0 14px;">${OFFER_NEXT}</p>
    <p style="margin:0 0 6px;">Ser frem til å høre fra dere!</p>`;
}

export function offerSubject({ mergeTags = true, businessName = '' } = {}) {
  return `Tilbud til ${mergeTags ? '{{businessName}}' : text(businessName) || 'dere'} fra Asoldi`;
}

export const OFFER_PREHEADER = 'Her er tilbudet vi snakket om – hva som er inkludert, pris og veien videre.';

/**
 * Full branded email. `layout(client, view, options)` is injected so this module has no Node-only imports
 * (the server passes buildSalesLayoutEmail from lib/sales-email.js).
 */
export function buildOfferEmail({ client = {}, products = [], nuances = {}, mvaIncluded = false, sender = {}, mergeTags = true, layout, layoutOptions = {} } = {}) {
  const view = {
    preheader: OFFER_PREHEADER,
    title: 'Tilbud fra Asoldi',
    mobileTitle: 'Tilbud fra Asoldi',
    // Plain left-aligned heading, no envelope illustration (that belongs to the meeting confirmations).
    titleAlign: 'left',
    hideIllustration: true,
    bodyHtml: buildOfferBodyHtml({ products, nuances, mvaIncluded }),
    agendaHtml: '',
    closingHtml: '',
    ctaLabel: '',
    ctaUrl: '',
    showTestimonial: false,
    signerHtml: offerSignerHtml({ mergeTags, sender }),
  };
  const subject = offerSubject({ mergeTags, businessName: client?.businessName });
  if (typeof layout !== 'function') {
    return { subject, preheader: OFFER_PREHEADER, html: view.bodyHtml };
  }
  const rendered = layout(client, view, { mergeTags, sender, ...layoutOptions });
  return { subject, preheader: OFFER_PREHEADER, html: rendered.html, from: rendered.from, replyTo: rendered.replyTo };
}

/* ------------------------------------------------------- plain summaries */

/** One-line-per-product summary used in notifications and history. */
export function summarizeOfferProducts(products = [], options = {}) {
  const list = Array.isArray(products) ? products : [];
  const totals = offerTotals(list, options);
  const unit = totals.mvaIncluded ? 'inkl. mva/mnd' : 'eks. mva/mnd';
  const lines = list.map((item) => `- ${text(item.name) || 'Produkt'}${Number(item.pages) ? ` (opp til ${item.pages} sider)` : ''}: ${formatKr(item.priceExMva || 0)} ${unit}`);
  lines.push(`Totalt: ${formatKr(totals.exMva)} eks. mva (${formatKr(totals.inclMva)} inkl. mva) per måned${totals.mvaIncluded ? ' – mva er inkludert i oppgitt pris' : ''}`);
  return lines.join('\n');
}
