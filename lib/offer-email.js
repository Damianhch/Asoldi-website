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

function placeholder(label) {
  return `<span style="background:#fff3ea;color:#b34300;border-radius:4px;padding:0 4px;">[${escapeHtml(label)}]</span>`;
}

/* ------------------------------------------------------------------ totals */

export function offerTotals(products = []) {
  const list = Array.isArray(products) ? products : [];
  const exMva = list.reduce((sum, item) => sum + (Number(item?.priceExMva) || 0), 0);
  const mva = Math.round(exMva * MVA_RATE);
  const deliveryWeeks = list.reduce((max, item) => Math.max(max, Number(item?.deliveryWeeks) || 0), 0) || DEFAULT_DELIVERY_WEEKS;
  return { exMva, mva, inclMva: exMva + mva, deliveryWeeks, count: list.length };
}

/* ---------------------------------------------------------- product blocks */

export function renderOfferProductHtml(product = {}) {
  const name = text(product.name) || 'Produkt';
  const pages = Number(product.pages) || 0;
  const includes = Array.isArray(product.includes) ? product.includes.map(text).filter(Boolean) : [];
  const note = text(product.note);
  const price = Number(product.priceExMva) || 0;
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
      <p style="margin:0;font-weight:bold;">Pris: ${escapeHtml(formatKr(price))} eks. mva per måned</p>
    </td>
  </tr>
</table>`;
}

export function renderOfferTotalsHtml(products = []) {
  const totals = offerTotals(products);
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" data-offer-totals="1" style="width:100%;margin:4px 0 6px;background:#fff7f2;border-radius:10px;">
  <tr>
    <td style="padding:14px 16px;font-size:15px;line-height:1.6;color:${TEXT};">
      <p style="margin:0 0 4px;">Pris eks. mva: <strong>${escapeHtml(formatKr(totals.exMva))}</strong> per måned</p>
      <p style="margin:0 0 4px;">MVA (25 %): ${escapeHtml(formatKr(totals.mva))}</p>
      <p style="margin:0 0 8px;font-size:17px;font-weight:bold;color:${ORANGE};">Totalt: ${escapeHtml(formatKr(totals.inclMva))} inkl. mva per måned</p>
      <p style="margin:0;font-size:13px;color:${MUTED};">Løpende månedlig tjeneste – nettside, hosting og vedlikehold faktureres månedlig så lenge avtalen løper.</p>
    </td>
  </tr>
</table>`;
}

export function renderOfferProductsSection(products = []) {
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
  return `${list.map(renderOfferProductHtml).join('')}${renderOfferTotalsHtml(list)}`;
}

// Attribute order may change after a round-trip through the visual editor, so match ids anywhere in the tag.
const PRODUCTS_RE = /(<div\b[^>]*\bid="offer-products"[^>]*>)[\s\S]*?(<div\b[^>]*\bid="offer-products-end"[^>]*>\s*<\/div>)/i;

/** Swap the whole "Hva er inkludert" block. Works on the raw HTML so it can run in Node or the browser. */
export function replaceOfferProducts(html = '', products = []) {
  const section = renderOfferProductsSection(products);
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

export function applyOfferProducts(html = '', products = []) {
  return replaceOfferDelivery(replaceOfferProducts(html, products), products);
}

/* ------------------------------------------------------------ AI slot fill */

function paragraphs(list = []) {
  return (Array.isArray(list) ? list : [list]).map(text).filter(Boolean).map((line) => p(escapeHtml(line))).join('');
}

/**
 * Fill the nuance slots (from Fireflies + DeepSeek or from a human). Only slots with content are touched.
 * `need` is the short "[veldig kort om prosjekt / behov]" phrase in the intro sentence.
 */
export function fillOfferSlots(html = '', { need = '', project = [], terms = '', benefits = '' } = {}) {
  let next = String(html || '');
  if (text(need)) next = replaceOfferSlot(next, 'need', escapeHtml(text(need)));
  if (Array.isArray(project) ? project.some(text) : text(project)) next = replaceOfferSlot(next, 'project', paragraphs(project));
  if (text(terms)) {
    next = replaceOfferSlot(next, 'terms', p(`<strong>Kundebetingelser:</strong> ${escapeHtml(text(terms))}`));
  }
  if (text(benefits)) next = replaceOfferSlot(next, 'benefits', paragraphs(benefits));
  return next;
}

/* -------------------------------------------------------------- template */

function offerSignerHtml({ mergeTags = true, sender = {} } = {}) {
  const name = mergeTags ? '{{signerName}}' : escapeHtml(text(sender.fullName || sender.name) || 'Damian');
  const email = mergeTags ? '{{signerEmail}}' : escapeHtml(text(sender.fromEmail) || 'damian@asoldi.com');
  const phone = mergeTags ? '{{signerPhone}}' : '+47 48 33 91 91';
  return `
    <p style="margin:0 0 8px;">Med vennlig hilsen<br/><strong>${name} fra Asoldi</strong></p>
    <p style="margin:0 0 10px;color:${MUTED};">P.S: Har du spørsmål om våre priser, referanser eller tjenester kan du sjekke nettsiden vår på <a href="https://asoldi.com" target="_blank" style="color:${ORANGE};text-decoration:underline;">asoldi.com</a>.</p>
    <p style="margin:0;color:${MUTED};font-size:13px;">Kontor: Østre berg 10, Trondheim<br/>${phone} &nbsp;|&nbsp; <a href="mailto:${mergeTags ? '{{signerEmail}}' : email}" style="color:${TEXT};text-decoration:none;">${email}</a> &nbsp;|&nbsp; asoldi.com</p>`;
}

/**
 * Body of the offer email with merge tags. `products` may be empty (placeholder shown until a tier is chosen).
 */
export function buildOfferBodyHtml({ products = [], nuances = {} } = {}) {
  const totals = offerTotals(products);
  const projectHtml = paragraphs(nuances.project) || [
    p(placeholder('Hva prosjektet omfatter og hva som ble snakket om – avsnitt 1')),
    p(placeholder('Avsnitt 2')),
    p(placeholder('Avsnitt 3')),
  ].join('');
  const termsHtml = text(nuances.terms)
    ? p(`<strong>Kundebetingelser:</strong> ${escapeHtml(text(nuances.terms))}`)
    : p(`<strong>Kundebetingelser:</strong> ${placeholder('Hva vi trenger av informasjon fra dere, og hvor mye dere ønsker å påvirke underveis i prosjektet')}`);
  const benefitsHtml = paragraphs(nuances.benefits)
    || p(placeholder('Hva dere vil oppnå / fordeler, hvor nettsiden bygges og hvorfor'));
  const need = text(nuances.need) ? escapeHtml(text(nuances.need)) : '{{need}}';

  return `
    <p style="margin:0 0 14px;">Hei {{firstName}},</p>
    <p data-offer-slot="intro" style="margin:0 0 14px;">Takk for samtalen om <span data-offer-slot="need">${need}</span> – veldig fint å høre mer om hva dere ønsker å få til. Basert på det vi diskuterte har jeg satt sammen et tilbud under, med en oversikt over hva som er inkludert og hva det vil koste.</p>
    <div data-offer-slot="project">${projectHtml}</div>
    <div data-offer-slot="terms">${termsHtml}</div>
    ${h2('Hva er inkludert')}
    <div id="offer-products">${renderOfferProductsSection(products)}<div id="offer-products-end"></div></div>
    <p style="margin:0 0 14px;"><strong>Leveringsdato:</strong> <span data-offer-slot="delivery">${totals.deliveryWeeks} uker fra oppstart</span></p>
    <div data-offer-slot="benefits">${benefitsHtml}</div>
    <p style="margin:0 0 14px;color:${MUTED};">Vedlagt ligger kontrakten for valgt pakke. Den signeres først når dere har bestemt dere – ingenting betales før nettsiden er levert.</p>
    ${h2('Hva som skjer fremover')}
    <p style="margin:0 0 14px;">Etter at dere har sett på tilbudet og vi har mottatt svar, avtaler vi oppstartstid, har en workshop og gir deg tilgang til våre terminaler så du kan følge fremgangen i prosjektet. Ta gjerne kontakt om dere har spørsmål til tilbudet, eller ønsker å justere noe underveis – jeg hjelper gjerne til.</p>
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
export function buildOfferEmail({ client = {}, products = [], nuances = {}, sender = {}, mergeTags = true, layout, layoutOptions = {} } = {}) {
  const view = {
    preheader: OFFER_PREHEADER,
    title: 'Tilbud fra Asoldi',
    mobileTitle: 'Tilbud fra Asoldi',
    bodyHtml: buildOfferBodyHtml({ products, nuances }),
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
export function summarizeOfferProducts(products = []) {
  const list = Array.isArray(products) ? products : [];
  const totals = offerTotals(list);
  const lines = list.map((item) => `- ${text(item.name) || 'Produkt'}${Number(item.pages) ? ` (opp til ${item.pages} sider)` : ''}: ${formatKr(item.priceExMva || 0)} eks. mva/mnd`);
  lines.push(`Totalt: ${formatKr(totals.exMva)} eks. mva (${formatKr(totals.inclMva)} inkl. mva) per måned`);
  return lines.join('\n');
}
