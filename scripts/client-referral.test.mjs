import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REFERRAL_INBOX_EMAIL,
  REFERRAL_SERVICES,
  buildReferralLeadEmail,
  normalizeReferralLead,
} from '../lib/client-referral.js';

const validLead = {
  name: 'Kari Nordmann',
  email: 'kari@example.no',
  phone: '+47 900 00 000',
  businessNumber: '123 456 789',
  service: 'Nettsideutvikling',
};

test('referral services match the booking dropdown', () => {
  assert.deepEqual(REFERRAL_SERVICES, [
    'Nettsideutvikling',
    'Sosiale Medier Marketing',
    'Innholdsproduksjon',
    'E-post Markedsføring',
    'Annet',
  ]);
});

test('referral inbox is damian@asoldi.com', () => {
  assert.equal(REFERRAL_INBOX_EMAIL, 'damian@asoldi.com');
});

test('a complete referral lead is accepted and the org number is digits only', () => {
  const result = normalizeReferralLead(validLead);
  assert.equal(result.ok, true);
  assert.equal(result.lead.businessNumber, '123456789');
  assert.equal(result.lead.email, 'kari@example.no');
});

test('missing or unknown service is rejected', () => {
  const missing = normalizeReferralLead({ ...validLead, service: 'Regnskap' });
  assert.equal(missing.ok, false);
});

test('referral email names the lead and the referring profile', () => {
  const result = normalizeReferralLead(validLead);
  const email = buildReferralLeadEmail({
    referrer: {
      name: 'Ola Verv',
      email: 'ola@bedrift.no',
      businessName: 'Ola AS',
      businessOrgNumber: '999888777',
      userId: 'user-1',
    },
    lead: result.lead,
  });
  assert.match(email.subject, /Referral lead: Kari Nordmann/);
  assert.match(email.text, /2 000 kr/);
  assert.match(email.text, /ola@bedrift\.no/);
  assert.match(email.text, /123456789/);
  assert.match(email.html, /Referral lead/);
  assert.doesNotMatch(email.html, /<script/);
});
