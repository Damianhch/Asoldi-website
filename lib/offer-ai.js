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
import { offerLetterAlreadyWritten, offerTotals } from './offer-email.js';

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

function offerNeedPhrase(value = '') {
  return text(value).replace(/[.!?]+$/, '').trim().slice(0, 140);
}

function paragraphsFrom(value, count = 3) {
  const items = Array.isArray(value)
    ? value.map(text).filter(Boolean)
    : text(value).split(/\n\s*\n/).map(text).filter(Boolean);
  return items.slice(0, count);
}


function contextPieces(meeting = {}) {
  const transcript = text(meeting.transcript);
  const source = transcript || text(meeting.summary);
  const lines = source.split(/\n/).map((line) => line.trim()).filter((line) => line.length > 1);
  const sentences = source.split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter((line) => line.length > 8);
  return { lines, sentences };
}

/** Noise or an empty room: under 10 lines of speech and no sales notes, so the offer slots stay untouched. */
export function meetingContextIsTooThin(meeting = {}, extra = {}) {
  if (text(extra?.notes).length >= 15) return false;
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

const FILL_SYSTEM = `Du skriver fire felt i en tilbuds-e-post fra oss til kunden, på norsk bokmål.
Transkriptet er kilden. E-posten er et tilbud om hva vi gjør for kunden, ikke et referat.

Stemme:
- Kall mottakeren "kunden", ikke "dere".
- Si hva vi vil gjøre, i vanlige setninger som flyter. Ikke la hver setning starte likt.
- Ikke skriv som et møtereferat.

Regler:
- Sannhet: transkriptet og produktnotatene veier likt. Bruk begge. Ikke legg til noe som ikke står i en av dem.
- Ikke gjenta noe som allerede står i brevet, og ikke gjenta det samme på tvers av feltene.
- Ikke nevn pakke, sidetall eller pris.
- need: bare ordene som fyller {{need}} i setningen som allerede står. Kort, små bokstaver, uten punktum.
- project: tre avsnitt om hva nettsiden skal være for kunden. Passe langt. Ikke hva de skal sende, og ikke hva vi fokuserer på til slutt.
- terms: noen få setninger om hva kunden skal sende inn og hvor mye de vil være med. Uten overskrift. Ikke nevn workshop.
- benefits: ett avsnitt, ikke to. Dekk hva kunden vil oppnå, hvor nettsiden bygges (vårt eget CMS, med mindre kildene sier Shopify, Wix eller noe annet), og hvorfor det er en fordel. Ikke gjenta prosjektet. Ikke skriv et eget CMS-avsnitt i tillegg.
- workshopStart: bare hvis kildene nevner en konkret startdato for workshop. Skriv datoen på norsk, for eksempel "15. oktober 2026". Tom streng hvis datoen ikke er nevnt. Ikke finn på en dato.
- Ikke skriv hilsen eller signatur.

Returner JSON:
{
  "need": "",
  "project": ["", "", ""],
  "terms": "",
  "benefits": "",
  "workshopStart": ""
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
    text(client.notes) ? `\nProduktnotater (samme vekt som transkriptet):\n${clip(client.notes, 3000)}` : '',
    'Spørsmål som ble stilt i møtet, og som transkriptet skal svare på:',
    '- Hvilke egne seksjoner trenger siden? For eksempel meny, booking, blogg eller galleri.',
    '- Hva er hovedproduktet, og hva er målet med nettsiden?',
    '- Identitet: farger, stil og språk.',
    '- Er media, logo, bilder og lenker sendt?',
    '',
    'Brevet som allerede står, med feltene du skal fylle:',
    offerLetterAlreadyWritten(),
    '',
    describeMeeting(meeting),
  ].filter((line) => line !== '').join('\n');

  const result = await chat({ system: FILL_SYSTEM, user, temperature: 0.5, maxTokens: 1800 });
  return {
    need: offerNeedPhrase(result.need),
    project: paragraphsFrom(result.project, 3),
    terms: text(result.terms).slice(0, 1200),
    benefits: paragraphsFrom(result.benefits, 2).join('\n\n').slice(0, 1600),
    workshopStart: text(result.workshopStart).slice(0, 120),
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
