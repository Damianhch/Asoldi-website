/**
 * Service agreement PDF (one per website tier, or a custom scope verified by admin).
 *
 * Text follows "Web utviklings kontrakt - template.pdf" with these updates:
 *  - only the chosen tier is described (Section 1), with price excl./incl. VAT and page count
 *  - Asoldi CMS instead of WordPress, "full export of the website files" instead of "SQL file"
 *  - parties block merged from the sales client card (blank placeholders for the template downloads)
 *
 * pdfkit's built-in Helvetica covers Norwegian characters (WinAnsi), checkboxes are drawn as rectangles.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { CUSTOM_TIER_ID, formatKr, tierById, withMva } from './website-tiers.js';
import { contractAddressFor } from './offer-readiness.js';

const ASOLDI_SIGNATURE_PNG = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'asoldi-contract-signature.png');

const ASOLDI = {
  legalName: 'CHAPANA (Asoldi Marketing)',
  orgNumber: '934 327 497',
  address: 'Østre Berg 10, Trondheim',
  email: 'damian@asoldi.com',
};

const MARGIN = 56;
const BODY_SIZE = 10.5;
const LINE_GAP = 2.5;

function text(value = '') {
  return String(value ?? '').trim();
}

function formatOrg(value = '') {
  const digits = text(value).replace(/\D+/g, '');
  if (digits.length !== 9) return text(value);
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function formatDateNo(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

function safeFileName(value = '') {
  return text(value).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'kunde';
}

/* --------------------------------------------------------------- content */

/**
 * Monthly fee sentence. Listed amounts are ex. VAT unless the rep absorbed the VAT (`mvaIncluded`), in which
 * case the listed amount is the all-in monthly price and the ex-VAT share is derived from it.
 */
function priceLineFor(listed, { mvaIncluded = false, total = false } = {}) {
  const label = total ? 'Monthly price (total)' : 'Monthly price';
  if (mvaIncluded) {
    const exMva = Math.round(listed / 1.25);
    return `${label}: ${formatKr(listed)} incl. VAT (${formatKr(exMva)} excl. VAT – VAT is included in the quoted price), billed monthly.`;
  }
  return `${label}: ${formatKr(listed)} excl. VAT (${formatKr(withMva(listed))} incl. VAT), billed monthly.`;
}

function scopeForTier(tier, { mvaIncluded = false } = {}) {
  return {
    heading: 'The Client has selected the following service tier:',
    title: tier.contract.title,
    priceLine: priceLineFor(tier.monthlyExMva, { mvaIncluded }),
    blocks: [{ lead: tier.contract.lead, bullets: tier.contract.includes }],
    deliveryWeeks: tier.deliveryWeeks,
    extraTerms: [],
    tierNumber: tier.tierNumber,
  };
}

function scopeForSummary(summary = {}, { mvaIncluded = false } = {}) {
  const products = Array.isArray(summary.products) ? summary.products : [];
  const listed = Number(summary.monthlyExMva) || products.reduce((sum, item) => sum + (Number(item.priceExMva) || 0), 0);
  const unit = mvaIncluded ? 'incl. VAT' : 'excl. VAT';
  const blocks = products.map((item) => ({
    lead: `${text(item.name) || 'Product'}${Number(item.pages) ? ` – up to ${item.pages} main pages` : ''}${Number(item.priceExMva) ? ` (${formatKr(item.priceExMva)} ${unit} / month)` : ''}`,
    bullets: Array.isArray(item.includes) ? item.includes.map(text).filter(Boolean) : [],
  }));
  if (text(summary.scopeSummary)) blocks.unshift({ lead: text(summary.scopeSummary), bullets: [] });
  const weeks = Number(summary.deliveryWeeks) || products.reduce((max, item) => Math.max(max, Number(item.deliveryWeeks) || 0), 0) || 4;
  return {
    heading: 'The Client has selected the following custom service scope (verified offer):',
    title: text(summary.title) || 'Custom scope – Website + agreed services',
    priceLine: priceLineFor(listed, { mvaIncluded, total: true }),
    blocks,
    deliveryWeeks: weeks,
    extraTerms: Array.isArray(summary.extraTerms) ? summary.extraTerms.map(text).filter(Boolean) : [],
    tierNumber: 0,
  };
}

/**
 * A plain tier offer uses the static tier text. A verified summary (custom tier, or a tier plus agreed
 * additions) wins when `preferSummary` is set; the tier checkbox still reflects the base tier.
 */
function resolveScope({ tierId = '', summary = null, preferSummary = false, mvaIncluded = false } = {}) {
  const tier = tierId && tierId !== CUSTOM_TIER_ID ? tierById(tierId) : null;
  if (summary && (preferSummary || !tier)) {
    const scope = scopeForSummary(summary, { mvaIncluded });
    if (tier) {
      scope.tierNumber = tier.tierNumber;
      scope.heading = 'The Client has selected the following service tier with agreed additions (verified offer):';
    }
    return scope;
  }
  if (tier) return scopeForTier(tier, { mvaIncluded });
  throw new Error('Contract needs a website tier or a verified custom summary.');
}

const PAYMENT_TERMS = [
  'Monthly payments are made on the 1st of each month.',
  'The first month is billed with pro-rated pricing, calculated as: (Monthly price ÷ days in month) × days remaining in the month after delivery.',
  'First-month invoice is due within 7 days of product delivery.',
  'All subsequent invoices are due within 7 days of issue.',
  'Accepted payment methods: Bank transfer and Stripe.',
  'There is no setup fee.',
  'Late payments will incur a fee of 100 kr after 14 days. Continued non-payment may result in service suspension and contract termination (see Section 13).',
];

const DURATION_TERMS = [
  'Minimum binding period: 6 months.',
  "Cancellation requires 15 days' notice, and the Client pays for the entire cancellation month.",
  'Clients cannot downgrade to a lower tier once higher-level functionality has been added.',
  'Upon cancellation: (a) the Client receives full access to the website design and any custom code (exception: see clause 3.5); (b) Asoldi can migrate hosting and domain for 1 400 kr, or assist the Client in opening hosting and domain for transfer free of charge.',
  'After 15 days post-cancellation, if the website has not been transferred to the Client, Asoldi archives the design and retains full ownership of it. To regain access to the design the Client pays the migration fee.',
];

/* ---------------------------------------------------------------- drawing */

function makeWriter(doc) {
  const width = doc.page.width - MARGIN * 2;
  const api = {
    h1(value) {
      doc.font('Helvetica-Bold').fontSize(18).text(value, { align: 'center' });
      doc.moveDown(0.6);
    },
    h2(value) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').fontSize(12.5).text(value);
      doc.moveDown(0.25);
    },
    p(value, options = {}) {
      doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(BODY_SIZE).text(value, { width, lineGap: LINE_GAP, ...options });
      doc.moveDown(options.gap ?? 0.35);
    },
    kv(label, value) {
      doc.font('Helvetica-Bold').fontSize(BODY_SIZE).text(`${label}: `, { continued: true, lineGap: LINE_GAP });
      doc.font('Helvetica').text(value || '');
    },
    bullets(items = [], indent = 16) {
      doc.font('Helvetica').fontSize(BODY_SIZE);
      for (const item of items) {
        doc.text(`•  ${item}`, MARGIN + indent, doc.y, { width: width - indent, lineGap: LINE_GAP });
      }
      doc.x = MARGIN;
      doc.moveDown(0.3);
    },
    numbered(items = []) {
      doc.font('Helvetica').fontSize(BODY_SIZE);
      items.forEach((item, index) => {
        doc.text(`${index + 1}.  ${item}`, MARGIN + 14, doc.y, { width: width - 14, lineGap: LINE_GAP });
      });
      doc.x = MARGIN;
      doc.moveDown(0.3);
    },
    checkbox(label, checked, x, y) {
      const size = 10;
      doc.save().lineWidth(0.8).rect(x, y, size, size).stroke('#222222');
      if (checked) {
        doc.moveTo(x + 2, y + 5).lineTo(x + 4.5, y + 8).lineTo(x + 8.5, y + 2).lineWidth(1.4).stroke('#222222');
      }
      doc.restore();
      doc.font('Helvetica').fontSize(BODY_SIZE).text(label, x + size + 6, y - 1, { lineBreak: false });
    },
    ensureSpace(height) {
      if (doc.y + height > doc.page.height - MARGIN) doc.addPage();
    },
  };
  return api;
}

/** Handwritten Asoldi signature, sitting just above the signature line. Returns drawn height. */
function drawAsoldiSignature(doc, x, y, maxWidth, maxHeight) {
  if (!existsSync(ASOLDI_SIGNATURE_PNG)) return 0;
  const img = doc.openImage(ASOLDI_SIGNATURE_PNG);
  const ratio = img.width / img.height;
  let width = maxWidth;
  let height = width / ratio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }
  doc.image(img, x, y, { width, height });
  return height;
}

/**
 * Build the agreement. Returns a Buffer.
 *  - tierId: 'tier-1-standard' | 'tier-2-seo' | 'tier-3-ecommerce' | 'custom'
 *  - summary: admin-verified contract summary (required when tierId is custom)
 *  - blank: true for the downloadable template (client fields left as placeholders)
 */
export async function buildContractPdf({ client = {}, tierId = '', summary = null, preferSummary = false, mvaIncluded = false, date = new Date(), blank = false } = {}) {
  const scope = resolveScope({ tierId, summary, preferSummary, mvaIncluded });
  const partyName = blank ? '[Business name]' : text(client.businessName) || '[Business name]';
  const partyOrg = blank ? '[Org. number]' : formatOrg(client.orgNumber) || '[Org. number]';
  const partyAddress = blank ? '[Business address]' : contractAddressFor(client) || '[Business address]';
  const partyOwner = blank ? '[Contact person]' : text(client.contactPerson) || '[Contact person]';
  const partyEmail = blank ? '[Email]' : text(client.contactEmail) || '[Email]';

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: `Service Agreement – ${scope.title}`,
      Author: ASOLDI.legalName,
      Subject: `Website service agreement for ${partyName}`,
    },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const w = makeWriter(doc);

  w.h1('SERVICE AGREEMENT');
  w.p('Between', { bold: true, gap: 0.1 });
  w.kv('Service Provider', ASOLDI.legalName);
  w.kv('Org. nr.', ASOLDI.orgNumber);
  w.kv('Address', ASOLDI.address);
  w.kv('Email', ASOLDI.email);
  doc.moveDown(0.4);
  w.p('And', { bold: true, gap: 0.1 });
  w.kv('Client', partyName);
  w.kv('Org. nr.', partyOrg);
  w.kv('Address', partyAddress);
  w.kv('Innehaver / signatory', partyOwner);
  w.kv('Email', partyEmail);
  doc.moveDown(0.6);

  w.p(`This Service Agreement ("Agreement") is entered into between ${ASOLDI.legalName} ("Service Provider" or "Asoldi") and the above-named client ("Client").`);
  w.p('The purpose of this Agreement is to define the terms under which Asoldi provides website development, hosting, maintenance and digital services to the Client under the service scope described in Section 1. The project starts the day the contract is signed by both parties.');

  w.h2('1. SERVICE SCOPE');
  w.p(scope.heading);
  w.p(scope.title, { bold: true, gap: 0.1 });
  w.p(scope.priceLine, { gap: 0.2 });
  for (const block of scope.blocks) {
    if (block.lead) w.p(block.lead, { gap: 0.1 });
    if (block.bullets.length) w.bullets(block.bullets);
  }
  w.p(`Delivery time: ${scope.deliveryWeeks} weeks from project start.`, { bold: true });
  if (scope.extraTerms.length) {
    w.p('Additional terms for this scope:', { gap: 0.1 });
    w.bullets(scope.extraTerms);
  }
  w.p('All prices are stated per month excluding VAT (25 % VAT is added on the invoice). The service is a running monthly subscription covering development, hosting and maintenance.');

  w.h2('2. PAYMENT TERMS');
  w.numbered(PAYMENT_TERMS);

  w.h2('3. CONTRACT DURATION & CANCELLATION');
  w.numbered(DURATION_TERMS);

  w.h2('4. SCOPE OF WORK');
  w.p('Asoldi will provide:', { gap: 0.1 });
  w.bullets([
    'Professional website design and development according to the chosen scope',
    'Hosting during active subscription',
    'Maintenance during active subscription',
    'Reasonable monthly updates (up to four changes per month, flexible depending on complexity)',
    'No training in website editing; basic questions are allowed as part of management',
  ]);
  w.p('Revisions include: text iteration, adding a section, or adding functionality. Fixing typos or correcting factual errors is not considered a revision.');
  w.p('Redesigns or work outside the plan will incur additional costs agreed upon by both parties.');

  w.h2('5. DELIVERY GUARANTEE');
  w.p('If Asoldi fails to deliver the website within the timeframe stated in Section 1, the Client receives one (1) month of service free of charge.');

  w.h2('6. HOSTING FAILURE');
  w.p('If Asoldi becomes unable to host the website for any reason for a prolonged amount of time:', { gap: 0.1 });
  w.bullets([
    'The Client will receive a full export of the website files and content free of charge',
    'Full migration setup to a new domain or hosting service is optional',
  ]);

  w.h2('7. INTELLECTUAL PROPERTY & OWNERSHIP');
  w.numbered([
    'During the subscription period, the Client has full rights to use the website.',
    'Upon cancellation, the Client retains ownership of the website design and any custom code developed specifically for them.',
    'After 15 days post-cancellation, ownership reverts entirely to Asoldi unless the Client has exported or migrated the site.',
    'The hosting environment, DNS records, themes, plugins, the Asoldi CMS and third-party licenses remain exclusively owned by Asoldi.',
  ]);

  w.h2('8. SUPPORT & MAINTENANCE');
  w.p('Support hours: 09:00–16:00 (CET).', { gap: 0.1 });
  w.p('Response times:', { gap: 0.1 });
  w.bullets(['Standard requests: 1–3 days', 'Urgent issues: within 1 day']);

  w.h2('9. CLIENT RESPONSIBILITIES');
  w.p('The Client must provide:', { gap: 0.1 });
  w.bullets(['Logo(s)', 'Images and/or videos', 'Any other desired material required for the website']);

  w.h2('10. GDPR & DATA PROCESSING AGREEMENT (DPA)');
  w.numbered([
    'The Client is the Data Controller.',
    'Asoldi is the Data Processor.',
    'Asoldi may access data for the purpose of maintenance, security, and ensuring proper functionality.',
    'The Client is responsible for GDPR compliance related to customer data collected via forms, ecommerce, or email lists.',
  ]);

  w.h2('11. LIMITATION OF LIABILITY');
  w.p('Asoldi is not liable for:', { gap: 0.1 });
  w.bullets(['Indirect, incidental, or consequential damages', 'Loss of revenue, business, or data']);
  w.p('Liability is limited to the amount paid by the Client in the last monthly payment.');
  w.p('The person that signs confirms that they have the authority to make marketing decisions within the business this contract refers to. If not, this contract is invalid.');

  w.h2('12. PORTFOLIO RIGHTS');
  w.p("Asoldi may display the Client's website in portfolios, advertisements, and promotional materials unless the Client opts out.");

  w.h2('13. PAYMENT DEFAULT & SUSPENSION');
  w.p('If payment is not received within 7 days of the due date:', { gap: 0.1 });
  w.bullets(['A reminder will be sent to the Client']);
  w.p('If payment is not received within 14 days of the due date:', { gap: 0.1 });
  w.bullets([
    'The website will be temporarily suspended (taken offline) until payment is received',
    'A late payment fee of NOK 100,- will be added in addition to the website cost for every day that passes after the initial 14 days',
  ]);
  w.p('If payment is not received within 30 days:', { gap: 0.1 });
  w.bullets([
    'Outstanding amounts may be sent to debt collection (inkasso)',
    'The late payment fee will be added to this claim every 14 days in installments until paid in full or an internal agreement has been made',
    'The Client remains liable for all unpaid invoices',
  ]);
  w.p('Asoldi reserves the right to suspend services immediately if fraudulent payment activity is detected.');

  w.h2('14. GOVERNING LAW');
  w.p('This Agreement is governed by the laws of Norway.');

  w.ensureSpace(280);
  w.h2('CONTRACT & SCOPE SIGNING');
  w.p('By signing below, both parties agree to all terms stated in this Agreement.');
  w.p('Chosen scope:', { gap: 0.15 });
  const rowY = doc.y;
  w.checkbox('Tier 1', scope.tierNumber === 1, MARGIN, rowY);
  w.checkbox('Tier 2', scope.tierNumber === 2, MARGIN + 90, rowY);
  w.checkbox('Tier 3', scope.tierNumber === 3, MARGIN + 180, rowY);
  w.checkbox('Custom scope (Section 1)', scope.tierNumber === 0, MARGIN + 270, rowY);
  doc.x = MARGIN;
  doc.y = rowY + 26;

  const colWidth = (doc.page.width - MARGIN * 2 - 30) / 2;
  const sigY = doc.y;
  const imageTop = sigY + 34;
  const rightX = MARGIN + colWidth + 30;

  doc.font('Helvetica-Bold').fontSize(BODY_SIZE).text(`For ${ASOLDI.legalName}:`, MARGIN, sigY, { width: colWidth });
  doc.font('Helvetica').text('Signature:', MARGIN, sigY + 16, { width: colWidth });
  doc.font('Helvetica-Bold').text(`For Client (${partyName}):`, rightX, sigY, { width: colWidth });
  doc.font('Helvetica').text(`Signature (${partyOwner}):`, rightX, sigY + 16, { width: colWidth });

  const imageHeight = drawAsoldiSignature(doc, MARGIN, imageTop, colWidth - 4, 46);
  const lineY = imageTop + Math.max(imageHeight, 36) + 3;
  doc.moveTo(MARGIN, lineY).lineTo(MARGIN + colWidth, lineY).lineWidth(0.8).stroke('#222222');
  doc.font('Helvetica').fontSize(BODY_SIZE).text(`Date: ${blank ? '____________' : formatDateNo(date)}`, MARGIN, lineY + 8, { width: colWidth });
  doc.moveTo(rightX, lineY).lineTo(rightX + colWidth, lineY).lineWidth(0.8).stroke('#222222');
  doc.text('Date: ____________', rightX, lineY + 8, { width: colWidth });

  doc.end();
  return done;
}

/** Contract inputs for a stored offer: verified summary wins over the plain tier text. */
export function contractInputsForOffer(offer = {}) {
  const summary = offer?.contract?.summary || null;
  const tierId = String(offer?.tierId || '');
  const hasCustomProducts = Array.isArray(offer?.products) && offer.products.some((item) => item?.kind !== 'tier');
  return {
    tierId,
    summary,
    preferSummary: Boolean(summary) && (tierId === CUSTOM_TIER_ID || hasCustomProducts || !tierById(tierId)),
    mvaIncluded: Boolean(offer?.mvaIncluded),
  };
}

export function offerContractIsAvailable(offer = {}) {
  const inputs = contractInputsForOffer(offer);
  if (inputs.summary) return true;
  return Boolean(inputs.tierId && inputs.tierId !== CUSTOM_TIER_ID && tierById(inputs.tierId));
}

export function contractFileName({ client = {}, tierId = '', blank = false } = {}) {
  const tier = tierById(tierId);
  const tierPart = tier ? `Tier-${tier.tierNumber}-${safeFileName(tier.shortName)}` : 'Skreddersydd';
  if (blank) return `Asoldi-kontrakt-${tierPart}-mal.pdf`;
  return `Asoldi-kontrakt-${tierPart}-${safeFileName(client.businessName)}.pdf`;
}
