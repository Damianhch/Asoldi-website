/**
 * DeepSeek-backed helpers for the offer flow.
 *
 *  fillOfferFromTranscript  – Fireflies transcript -> the nuance slots of the offer email (Norwegian)
 *  reflectContractFromEmail – edited offer email -> contract scope summary (English, matches the PDF)
 *
 * Both take `deps.chat` so tests can stub the model.
 */

import { deepseekChatJson } from './deepseek.js';
import { htmlToPlainText } from './sales-email.js';
import { offerTotals } from './offer-email.js';
import { CUSTOM_TIER_ID, tierById } from './website-tiers.js';

const MAX_TRANSCRIPT_CHARS = 28_000;
/** Fewer speaker lines than this is treated as noise, not a sales conversation. */
export const MIN_MEETING_CONTEXT_LINES = 10;
const MAX_EMAIL_CHARS = 12_000;

function text(value = '') {
  return String(value ?? '').trim();
}

function clip(value = '', max = 1000) {
  const source = String(value || '');
  if (source.length <= max) return source;
  return `${source.slice(0, max)}\n[... forkortet ...]`;
}

function list(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const single = text(value);
  return single ? [single] : [];
}

function paragraphsFrom(value, count = 3) {
  const items = Array.isArray(value)
    ? value.map(text).filter(Boolean)
    : text(value).split(/\n\s*\n/).map(text).filter(Boolean);
  return items.slice(0, count);
}

/** Name and page count only. Feature bullets stay in the product block, not in the prose. */
function describeTierFrame(products = [], tierId = '') {
  const tier = tierById(tierId);
  if (tier) return `${tier.name}, opp til ${tier.pages} sider`;
  if (tierId === CUSTOM_TIER_ID) return 'Skreddersydd';
  const names = (Array.isArray(products) ? products : []).map((item) => text(item?.name)).filter(Boolean);
  return names.length ? names.join(', ') : 'ikke valgt enda';
}

function contextPieces(meeting = {}) {
  const transcript = text(meeting.transcript);
  const source = transcript || text(meeting.summary);
  const lines = source.split(/\n/).map((line) => line.trim()).filter((line) => line.length > 1);
  const sentences = source.split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter((line) => line.length > 8);
  return { lines, sentences };
}

/** Noise or an empty room: under 10 lines of speech, so the offer slots stay untouched. */
export function meetingContextIsTooThin(meeting = {}) {
  const { lines, sentences } = contextPieces(meeting);
  return Math.max(lines.length, sentences.length) < MIN_MEETING_CONTEXT_LINES;
}

function describeMeeting(meeting = {}) {
  return [
    `Møte: ${text(meeting.title) || 'ukjent tittel'}`,
    meeting.when ? `Tid: ${meeting.when}` : '',
    Array.isArray(meeting.attendees) && meeting.attendees.length ? `Deltakere: ${meeting.attendees.join(', ')}` : '',
    text(meeting.summary) ? `\nSammendrag fra Fireflies:\n${clip(meeting.summary, 4000)}` : '',
    Array.isArray(meeting.actionItems) && meeting.actionItems.length ? `\nAction items:\n${meeting.actionItems.map((item) => `- ${item}`).join('\n')}` : '',
    text(meeting.transcript) ? `\nTranskript:\n${clip(meeting.transcript, MAX_TRANSCRIPT_CHARS)}` : '\n(Ingen transkript tilgjengelig – bruk sammendraget.)',
  ].filter(Boolean).join('\n');
}

const FILL_SYSTEM = `Du skriver de kundespesifikke avsnittene i en tilbuds-e-post på norsk bokmål.
Kilden er transkriptet fra salgsmøtet. Skriv bare det som faktisk ble sagt der.

Regler:
- Varm og konkret. Skriv til kunden som "dere".
- Ikke finn på sider, funksjoner eller en liste over materiell som ikke ble nevnt i møtet.
- Valgt pakke er bare en ramme (navn og sidetall). Nevn den høyst én gang, i prosjektteksten, som pakken de valgte. Ikke gjenta pakkens funksjoner. De står allerede i produktblokken.
- Hvert felt har én jobb. Et faktum skrives i bare én seksjon. Ikke gjenta det samme i need, project, terms og benefits.
- need: kort frase, maks 10 ord, små bokstaver, som fullfører "Takk for samtalen om ...". Det de vil ha. Ikke en setning.
- project: hva de ba nettstedet inneholde, og hvem det er for, fra samtalen. Ikke resultatet, ikke hva vi trenger fra dem, ikke pris.
- terms: bare det de ble enige om å levere eller avgjøre. Hvis møtet ikke tok opp materiell eller medvirkning, skriv én kort setning om at det ikke ble avtalt. Ikke finn på en sjekkliste.
- benefits: resultatet de sa at de ville ha, i deres situasjon. Ikke en ny beskrivelse av prosjektet. Ikke plattform, CMS, hosting eller vedlikehold.
- Ikke skriv hilsen, signatur eller overskrifter. Ikke nevn priser, mva eller rabatter.
- Selgerens notater er bare et hint og overstyrer aldri transkriptet.

Returner et JSON-objekt med nøyaktig disse feltene:
{
  "need": "",
  "project": ["ett eller to avsnitt, uten å gjenta need eller benefits"],
  "terms": "",
  "benefits": ""
}`;

/**
 * @returns {{ need: string, project: string[], terms: string, benefits: string }}
 */
export async function fillOfferFromTranscript({ client = {}, meeting = {}, products = [], tierId = '', deps = {} } = {}) {
  const chat = deps.chat || deepseekChatJson;
  const user = [
    `Kunde: ${text(client.businessName) || 'ukjent bedrift'}${text(client.industry) ? ` (${client.industry})` : ''}`,
    `Kontaktperson: ${text(client.contactPerson) || 'ukjent'}`,
    text(client.websiteDomain) ? `Dagens nettside: ${client.websiteDomain}` : '',
    text(client.notes) ? `\nSelgerens notater (hint, overstyrer ikke transkriptet):\n${clip(client.notes, 3000)}` : '',
    `\nValgt pakke (bare ramme, ikke funksjonsliste): ${describeTierFrame(products, tierId)}`,
    '',
    describeMeeting(meeting),
  ].filter((line) => line !== '').join('\n');

  const result = await chat({ system: FILL_SYSTEM, user, temperature: 0.5, maxTokens: 1800 });
  return {
    need: text(result.need).replace(/[.!?]+$/, '').slice(0, 140),
    project: paragraphsFrom(result.project, 3),
    terms: text(result.terms).slice(0, 1200),
    benefits: paragraphsFrom(result.benefits, 2).join('\n\n').slice(0, 1600),
  };
}

const REFLECT_SYSTEM = `You turn an Asoldi website offer email (Norwegian) into the scope section of a service agreement (English).
The structured product list you receive is the source of truth for names, page counts and prices – never change or invent prices.

Rules:
- Concise, neutral contract language. No marketing phrases, no client-specific storytelling.
- For each product: keep the name, page count and price; write up to 8 short "includes" bullets that summarize what the email promises for that product (deliverables and functionality only).
- extraTerms: short bullets for commitments in the email that are not covered by the product bullets (e.g. "Client supplies product photos", "Booking module requires client SMS account"). Empty array if none.
- deliveryWeeks: the delivery time stated in the email, as an integer number of weeks.

Return a JSON object with exactly these fields:
{
  "title": "short scope title, e.g. 'Tier 3 website with booking module'",
  "scopeSummary": "1-2 sentences describing the agreed scope",
  "products": [{ "name": "", "pages": 0, "priceExMva": 0, "includes": ["", ""] }],
  "monthlyExMva": 0,
  "deliveryWeeks": 4,
  "extraTerms": [""]
}`;

/**
 * @returns {{ title: string, scopeSummary: string, products: object[], monthlyExMva: number, deliveryWeeks: number, extraTerms: string[] }}
 */
export async function reflectContractFromEmail({ emailHtml = '', products = [], deps = {} } = {}) {
  const chat = deps.chat || deepseekChatJson;
  const source = Array.isArray(products) ? products : [];
  const totals = offerTotals(source);
  const emailText = clip(htmlToPlainText(emailHtml), MAX_EMAIL_CHARS);
  const user = [
    'Structured products (source of truth):',
    JSON.stringify(source.map((item) => ({
      id: item.id,
      name: item.name,
      pages: Number(item.pages) || 0,
      priceExMva: Number(item.priceExMva) || 0,
      includes: list(item.includes),
      note: text(item.note),
      deliveryWeeks: Number(item.deliveryWeeks) || 0,
    })), null, 1),
    `Total monthly price excl. VAT: ${totals.exMva}. Default delivery weeks: ${totals.deliveryWeeks}.`,
    '',
    'Offer email (plain text):',
    emailText || '(empty)',
  ].join('\n');

  const result = await chat({ system: REFLECT_SYSTEM, user, temperature: 0.2, maxTokens: 1800 });
  const byId = new Map(source.map((item) => [text(item.id), item]));
  const byName = new Map(source.map((item) => [text(item.name).toLowerCase(), item]));
  const modelProducts = Array.isArray(result.products) ? result.products : [];

  // Re-anchor every product on the structured source so prices/pages can't drift.
  const merged = source.map((item, index) => {
    const candidate = modelProducts.find((row) => text(row?.id) && byId.get(text(row.id)) === item)
      || modelProducts.find((row) => byName.get(text(row?.name).toLowerCase()) === item)
      || modelProducts[index]
      || {};
    const includes = list(candidate.includes).slice(0, 8);
    return {
      id: item.id,
      kind: item.kind,
      tierId: item.tierId,
      name: text(item.name),
      pages: Number(item.pages) || 0,
      priceExMva: Number(item.priceExMva) || 0,
      deliveryWeeks: Number(item.deliveryWeeks) || 0,
      includes: includes.length ? includes : list(item.includes).slice(0, 8),
      note: '',
    };
  });

  const weeks = Number(result.deliveryWeeks);
  return {
    title: text(result.title).slice(0, 160) || (merged.length === 1 ? merged[0].name : 'Custom scope – Website + agreed services'),
    scopeSummary: text(result.scopeSummary).slice(0, 2000),
    products: merged,
    monthlyExMva: totals.exMva,
    deliveryWeeks: Number.isFinite(weeks) && weeks > 0 ? Math.round(weeks) : totals.deliveryWeeks,
    extraTerms: list(result.extraTerms).slice(0, 20),
  };
}
