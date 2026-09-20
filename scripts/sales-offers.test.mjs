import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dataDir = mkdtempSync(join(tmpdir(), 'asoldi-sales-offers-'));
process.env.APP_DATA_DIR = dataDir;

const tiers = await import('../lib/website-tiers.js');
const offerEmail = await import('../lib/offer-email.js');
const readiness = await import('../lib/offer-readiness.js');
const contractPdf = await import('../lib/offer-contract-pdf.js');
const matcher = await import('../lib/fireflies-client-match.js');
const offerAi = await import('../lib/offer-ai.js');
const store = await import('../data/sales-offers.js');

const CLIENT = {
  id: 'client-1',
  ownerId: 'sales-anna',
  businessName: 'Byneset Bydelskafé AS',
  contactPerson: 'Kari Nordmann',
  contactEmail: 'kari@byneset-kafe.no',
  orgNumber: '923 456 789',
  businessAddress: 'Bynesveien 1, 7070 Bosberg',
  meetingPlace: '',
  websiteDomain: 'byneset-kafe.no',
  meetingAt: '2026-09-18T10:00:00.000Z',
};

test('website tiers: 5/7/10 pages, SEO tier has Google/Maps/AI, only e-commerce is multilingual', () => {
  const [t1, t2, t3] = tiers.WEBSITE_TIERS;
  assert.deepEqual([t1.pages, t2.pages, t3.pages], [5, 7, 10]);
  const has = (tier, re) => tier.includes.some((line) => re.test(line));
  assert.ok(has(t2, /google maps/i), 'tier 2 lists Google Maps ranking');
  assert.ok(has(t2, /google/i) && has(t2, /\bAI\b/i), 'tier 2 lists Google ranking + AI');
  assert.ok(has(t3, /flerspråk|multilingual/i), 'tier 3 is multilingual');
  assert.ok(!has(t1, /flerspråk/i) && !has(t2, /flerspråk/i), 'tier 1/2 are not multilingual');
  assert.equal(tiers.withMva(1000), 1250);
});

test('offer email: tier block shows package, "opp til N sider", ex/incl mva per month, and is idempotent', () => {
  const products = offerEmail.productsWithTier([], tiers.WEBSITE_TIERS[1].id);
  assert.equal(products.length, 1);
  assert.equal(products[0].kind, 'tier');
  const email = offerEmail.buildOfferEmail({ client: CLIENT, products, mergeTags: false });
  assert.match(email.html, /Opp til 7 sider/);
  assert.match(email.html, /eks\. mva/i);
  assert.match(email.html, /inkl\. mva/i);
  assert.match(email.html, /per måned|\/ ?mnd/i);
  assert.match(email.subject, /Byneset/);

  // Swapping tier replaces the block instead of appending a second one.
  const swapped = offerEmail.applyOfferProducts(email.html, offerEmail.productsWithTier(products, tiers.WEBSITE_TIERS[2].id));
  assert.match(swapped, /Opp til 10 sider/);
  assert.doesNotMatch(swapped, /Opp til 7 sider/);
  assert.equal((swapped.match(/id="offer-products"/g) || []).length, 1);

  // Custom products survive a tier change.
  const custom = { id: 'c1', kind: 'custom', name: 'Bookingsystem', priceExMva: 500, pages: 0, includes: ['Online booking'], note: '', deliveryWeeks: 2 };
  const mixed = offerEmail.productsWithTier([...products, custom], tiers.WEBSITE_TIERS[2].id);
  assert.deepEqual(mixed.map((item) => item.kind), ['tier', 'custom']);
  const totals = offerEmail.offerTotals(mixed);
  assert.equal(totals.exMva, tiers.WEBSITE_TIERS[2].monthlyExMva + 500);
  assert.equal(totals.inclMva, Math.round(totals.exMva * 1.25));
});

test('offer email: attribute reordering from the visual editor does not break slot replacement', () => {
  const html = '<p style="x" data-offer-slot="terms">old</p><div style="a" id="offer-products"><b>x</b><div style="b" id="offer-products-end"></div></div>';
  const filled = offerEmail.fillOfferSlots(html, { terms: 'Vi trenger logo og bilder.' });
  assert.match(filled, /Kundebetingelser:<\/strong> Vi trenger logo og bilder\./);
  const replaced = offerEmail.replaceOfferProducts(filled, offerEmail.productsWithTier([], tiers.WEBSITE_TIERS[0].id));
  assert.match(replaced, /Opp til 5 sider/);
  assert.doesNotMatch(replaced, /<b>x<\/b>/);
});

test('offer readiness: contract fields must be on the client card', () => {
  assert.deepEqual(readiness.offerMissingFields(CLIENT), []);
  const missing = readiness.offerMissingFields({ ...CLIENT, orgNumber: '123', contactEmail: 'nope' });
  assert.deepEqual(missing.map((item) => item.key), ['orgNumber', 'contactEmail']);
  assert.match(readiness.offerReadinessMessage(missing), /Org\. nr/);
  // meetingPlace is accepted as the address fallback
  assert.equal(readiness.offerIsReady({ ...CLIENT, businessAddress: '', meetingPlace: 'Gata 1' }), true);
});

test('contract pdf: tier contract and custom-summary contract both render a PDF', async () => {
  const tierBuffer = await contractPdf.buildContractPdf({ client: CLIENT, tierId: tiers.WEBSITE_TIERS[0].id });
  assert.ok(Buffer.isBuffer(tierBuffer));
  assert.equal(tierBuffer.subarray(0, 5).toString(), '%PDF-');
  assert.ok(tierBuffer.length > 2000);

  const summary = {
    title: 'Avtale om nettside og drift',
    products: [{ id: 'p1', kind: 'custom', name: 'Skreddersydd nettside', pages: 12, includes: ['Design', 'Booking'], note: '', priceExMva: 4000, deliveryWeeks: 6 }],
    monthlyExMva: 4000,
    deliveryWeeks: 6,
    extraTerms: ['Kunden leverer tekst innen 2 uker'],
    scopeSummary: 'Nettside med booking.',
  };
  const customBuffer = await contractPdf.buildContractPdf({ client: CLIENT, tierId: 'custom', summary, preferSummary: true });
  assert.equal(customBuffer.subarray(0, 5).toString(), '%PDF-');
  assert.match(contractPdf.contractFileName({ client: CLIENT, tierId: 'custom' }), /Skreddersydd/);
  assert.match(contractPdf.contractFileName({ client: CLIENT, tierId: tiers.WEBSITE_TIERS[1].id }), /Tier-2/);

  // A verified custom summary makes the contract available even without a fixed tier
  assert.equal(contractPdf.offerContractIsAvailable({ tierId: 'custom', products: summary.products, contract: { summary: null } }), false);
  assert.equal(contractPdf.offerContractIsAvailable({ tierId: 'custom', products: summary.products, contract: { summary } }), true);
});

test('fireflies matcher: attendee email wins, then host+time, then fuzzy name', () => {
  const clients = [
    CLIENT,
    { id: 'client-2', ownerId: 'sales-bob', businessName: 'Trondheim Tannlege', contactEmail: 'post@tannlege.no', meetingAt: '2026-09-18T12:00:00.000Z' },
  ];
  const ownerEmailById = { 'sales-anna': 'anna@asoldi.com', 'sales-bob': 'bob@asoldi.com' };

  const byEmail = matcher.matchMeetingToClients({
    title: 'Møte', attendeeEmails: ['kari@byneset-kafe.no'], hostEmail: 'anna@asoldi.com', startedAt: '2026-09-18T10:05:00.000Z',
  }, clients, { ownerEmailById });
  assert.equal(byEmail.best?.clientId, 'client-1');
  assert.equal(byEmail.best?.confidence, 'high');

  // No attendee email match: host + agreed meeting time + business name in the title → medium/high for client-2
  const byName = matcher.matchMeetingToClients({
    title: 'Asoldi x Trondheim Tannlege', attendeeEmails: ['someone@gmail.com'], hostEmail: 'bob@asoldi.com', startedAt: '2026-09-18T12:02:00.000Z',
  }, clients.map((client) => ({ ...client, agreedTime: true })), { ownerEmailById });
  assert.equal(byName.best?.clientId, 'client-2');
  assert.ok(byName.best.score >= 40);

  const nothing = matcher.matchMeetingToClients({ title: 'Internt møte', attendeeEmails: [], hostEmail: 'x@y.z' }, clients, { ownerEmailById });
  assert.equal(nothing.best, null);
  assert.deepEqual(nothing.candidates, []);
});

test('offer AI: transcript fill and contract reflection go through the injected chat', async () => {
  const seen = [];
  const chat = async ({ system, user }) => {
    seen.push({ system, user });
    if (/source of truth/i.test(user)) {
      return {
        title: 'Avtale om nettside og drift',
        scopeSummary: 'Nettside for kafé med meny og booking.',
        products: [{ name: 'Nettside – SEO', pages: 7, includes: ['Design', 'SEO'], priceExMva: 2500 }],
        extraTerms: ['Kunden leverer bilder'],
        deliveryWeeks: 4,
      };
    }
    return { need: 'ny nettside for kafeen', project: ['Vi snakket om meny og åpningstider.'], terms: 'Dere sender logo.', benefits: 'Flere gjester via Google.' };
  };
  const filled = await offerAi.fillOfferFromTranscript({
    client: CLIENT,
    meeting: { title: 'Møte', transcript: 'Kunde: vi vil ha ny nettside for kafeen.', summary: 'Ny nettside.' },
    products: offerEmail.productsWithTier([], tiers.WEBSITE_TIERS[1].id),
    tierId: tiers.WEBSITE_TIERS[1].id,
    deps: { chat },
  });
  assert.equal(filled.need, 'ny nettside for kafeen');
  assert.ok(Array.isArray(filled.project) && filled.project.length === 1);

  const products = offerEmail.productsWithTier([], tiers.WEBSITE_TIERS[1].id);
  const summary = await offerAi.reflectContractFromEmail({ emailHtml: '<p>Tilbud</p>', products, deps: { chat } });
  assert.equal(summary.products.length, 1);
  assert.equal(summary.deliveryWeeks, 4);
  assert.ok(summary.monthlyExMva > 0);
  assert.equal(seen.length, 2);
});

test('sales offers store: draft → review → verify → send lifecycle with locks', () => {
  const created = store.createSalesOffer({
    salesClientId: CLIENT.id,
    ownerId: CLIENT.ownerId,
    email: { subject: 'Tilbud', preheader: '', html: '<p>hei</p>' },
    tierId: 'custom',
    products: [{ id: 'c1', kind: 'custom', name: 'Skreddersydd', priceExMva: 3000, pages: 8, includes: ['A'], note: '', deliveryWeeks: 5 }],
  }, { actor: 'anna' });
  assert.equal(created.status, 'draft');
  assert.equal(store.offerNeedsVerification(created), true, 'custom tier must go through admin');
  assert.equal(store.offerCanBeSentBySales(created), false);

  const reviewed = store.requestOfferReview(created.id, { actor: 'anna' });
  assert.equal(reviewed.status, 'review-requested');
  assert.equal(store.getOfferForClient(CLIENT.id)?.id, created.id);
  assert.equal(store.countOffersByStatus()['review-requested'], 1);

  const verified = store.verifySalesOffer(created.id, { actor: 'damian', adminNote: 'Send som avtalt' });
  assert.equal(verified.status, 'verified');
  assert.equal(verified.adminNote, 'Send som avtalt');
  assert.equal(store.offerCanBeSentBySales(verified), true);

  const reopened = store.reopenSalesOffer(created.id, { actor: 'damian' });
  assert.equal(reopened.status, 'review-requested', 'default reopen keeps it in the admin queue');
  assert.equal(reopened.verifiedAt, '');
  const returned = store.reopenSalesOffer(created.id, { actor: 'damian', toDraft: true });
  assert.equal(returned.status, 'draft');
  store.verifySalesOffer(created.id, { actor: 'damian' });

  const sent = store.markSalesOfferSent(created.id, { actor: 'anna', to: CLIENT.contactEmail });
  assert.equal(sent.status, 'sent');
  assert.equal(sent.sentTo, CLIENT.contactEmail);
  assert.ok(sent.history.some((entry) => entry.action === 'sent'));

  // A standard tier without review flag can be sent directly
  const standard = store.createSalesOffer({ salesClientId: 'client-9', ownerId: 'x', tierId: tiers.WEBSITE_TIERS[0].id, products: offerEmail.productsWithTier([], tiers.WEBSITE_TIERS[0].id) });
  assert.equal(store.offerNeedsVerification(standard), false);
  assert.equal(store.offerCanBeSentBySales(standard), true);
  const flagged = store.updateSalesOffer(standard.id, { reviewRequested: true });
  assert.equal(store.offerNeedsVerification(flagged), true);
});
