import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStoredWebsiteEmail, resolveWebsiteEmail } from '../lib/sales-website-email.js';

test('website email is stored only when it differs from the contact email', () => {
  assert.equal(normalizeStoredWebsiteEmail('post@kafe.no', 'kari@kafe.no'), 'post@kafe.no');
  assert.equal(normalizeStoredWebsiteEmail('kari@kafe.no', 'kari@kafe.no'), '');
  assert.equal(normalizeStoredWebsiteEmail('Kari@Kafe.no', 'kari@kafe.no'), '');
  assert.equal(normalizeStoredWebsiteEmail('', 'kari@kafe.no'), '');
});

test('website email falls back to the development card contact email', () => {
  assert.equal(resolveWebsiteEmail({ websiteEmail: 'post@kafe.no', contactEmail: 'kari@kafe.no' }), 'post@kafe.no');
  assert.equal(resolveWebsiteEmail({ websiteEmail: '', contactEmail: 'kari@kafe.no' }), 'kari@kafe.no');
  assert.equal(resolveWebsiteEmail({ contactEmail: 'kari@kafe.no' }), 'kari@kafe.no');
  assert.equal(resolveWebsiteEmail({}), '');
});
