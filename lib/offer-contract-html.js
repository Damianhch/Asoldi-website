import { contractArticleModel, contractInputsForOffer, offerContractIsAvailable } from './offer-contract-pdf.js';

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraphs(items = []) {
  return items.filter(Boolean).map((item) => `<p>${escapeHtml(item)}</p>`).join('');
}

function bullets(items = []) {
  if (!items.length) return '';
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function numbered(items = []) {
  if (!items.length) return '';
  return `<ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`;
}

export function contractHtmlForOffer(offer, client = {}) {
  if (!offerContractIsAvailable(offer)) return '';
  const inputs = contractInputsForOffer(offer);
  const article = contractArticleModel({ client, ...inputs });
  const scopeBlocks = (article.scope.blocks || []).map((block) => (
    `${block.lead ? `<p>${escapeHtml(block.lead)}</p>` : ''}${bullets(block.bullets || [])}`
  )).join('');
  const later = (article.sections || []).map((section) => (
    `<h2>${escapeHtml(section.heading)}</h2>${paragraphs(section.paragraphs || [])}${bullets(section.bullets || [])}${numbered(section.numbered || [])}${paragraphs(section.after || [])}`
  )).join('');
  return [
    `<h1>${escapeHtml(article.title)}</h1>`,
    '<h2>Parties</h2>',
    `<p><strong>Service provider:</strong> ${escapeHtml(article.provider.legalName)}</p>`,
    `<p>Org. nr. ${escapeHtml(article.provider.orgNumber)} · ${escapeHtml(article.provider.address)} · ${escapeHtml(article.provider.email)}</p>`,
    `<p><strong>Client:</strong> ${escapeHtml(article.client.name)}</p>`,
    `<p>Org. nr. ${escapeHtml(article.client.orgNumber)} · ${escapeHtml(article.client.address)}</p>`,
    `<p>Signatory: ${escapeHtml(article.client.signatory)} · ${escapeHtml(article.client.email)}</p>`,
    paragraphs(article.intro),
    '<h2>1. Service scope</h2>',
    `<p>${escapeHtml(article.scope.heading)}</p>`,
    `<p><strong>${escapeHtml(article.scope.title)}</strong></p>`,
    `<p>${escapeHtml(article.scope.priceLine)}</p>`,
    scopeBlocks,
    `<p><strong>Delivery time: ${escapeHtml(String(article.scope.deliveryWeeks))} weeks from project start.</strong></p>`,
    bullets(article.scope.extraTerms || []),
    '<p>All prices are stated per month excluding VAT unless the offer says the price includes VAT. The service is a running monthly subscription covering development, hosting and maintenance.</p>',
    '<h2>2. Payment terms</h2>',
    numbered(article.paymentTerms),
    '<h2>3. Contract duration and cancellation</h2>',
    numbered(article.durationTerms),
    later,
    '<h2>Signature</h2>',
    `<p>Asoldi has signed this agreement (${escapeHtml(article.signedAtLabel)}). By clicking “Jeg aksepterer avtalen” the client signs the same agreement.</p>`,
  ].join('');
}
