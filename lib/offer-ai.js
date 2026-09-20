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

function describeProducts(products = []) {
  const rows = (Array.isArray(products) ? products : []).map((item) => {
    const includes = list(item.includes).join('; ');
    return `- ${text(item.name) || 'Produkt'} | sider: ${Number(item.pages) || 'ikke oppgitt'} | pris eks. mva/mnd: ${Number(item.priceExMva) || 0} | inkluderer: ${includes || 'ikke oppgitt'}${text(item.note) ? ` | notat: ${text(item.note)}` : ''}`;
  });
  return rows.join('\n') || '(ingen produkter valgt enda)';
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

const FILL_SYSTEM = `Du er salgsassistent for Asoldi, et norsk byrå som lager nettsider på abonnement (nettside, hosting og vedlikehold per måned).
Du får transkript/sammendrag fra et salgsmøte mellom en selger hos Asoldi og en kunde, og skal skrive de kundespesifikke delene av tilbuds-e-posten på norsk bokmål.

Regler:
- Varm, profesjonell og konkret tone. Skriv til kunden som "dere". Bruk bedriftsnavnet der det passer.
- Bygg KUN på det som faktisk ble sagt i møtet og den valgte pakken. Ikke lov funksjoner som ikke er nevnt.
- Ikke nevn priser, mva eller rabatter – prisene står i en egen produktblokk.
- Ikke skriv hilsen, signatur eller overskrifter.

Returner et JSON-objekt med nøyaktig disse feltene:
{
  "need": "kort frase (maks 10 ord, små bokstaver) som fullfører setningen 'Takk for samtalen om ...'",
  "project": ["avsnitt 1 (2-4 setninger): hva prosjektet omfatter", "avsnitt 2: hva som ble snakket om, målgruppe og innhold", "avsnitt 3: hvordan vi løser det og hva kunden kan forvente"],
  "terms": "1-3 setninger om hva vi trenger av informasjon/materiell fra kunden, og hvor mye de ønsker å påvirke underveis (basert på møtet)",
  "benefits": "1 avsnitt om hva de vil oppnå, at nettsiden bygges på Asoldis egen plattform med enkelt CMS og løpende vedlikehold, og hvorfor det passer dem"
}`;

/**
 * @returns {{ need: string, project: string[], terms: string, benefits: string }}
 */
export async function fillOfferFromTranscript({ client = {}, meeting = {}, products = [], tierId = '', deps = {} } = {}) {
  const chat = deps.chat || deepseekChatJson;
  const tier = tierById(tierId);
  const user = [
    `Kunde: ${text(client.businessName) || 'ukjent bedrift'}${text(client.industry) ? ` (${client.industry})` : ''}`,
    `Kontaktperson: ${text(client.contactPerson) || 'ukjent'}`,
    text(client.websiteDomain) ? `Dagens nettside: ${client.websiteDomain}` : '',
    text(client.notes) ? `\nSelgerens notater:\n${clip(client.notes, 3000)}` : '',
    `\nValgt pakke: ${tier ? `${tier.name} – ${tier.pages} sider` : tierId === CUSTOM_TIER_ID ? 'Skreddersydd (custom)' : 'ikke valgt enda'}`,
    `Produkter i tilbudet:\n${describeProducts(products)}`,
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
