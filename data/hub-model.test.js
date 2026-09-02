import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFeatures, publicClientAdmin, normalizeSite } from './hub-model.js';

test('hub features include email marketing and general', () => {
  const features = normalizeFeatures({ emailMarketing: 1, general: true, users: false });
  assert.equal(features.emailMarketing, true);
  assert.equal(features.general, true);
  assert.equal(features.users, false);
});

test('public client admin never returns the password hash', () => {
  const site = normalizeSite({
    id: '1',
    site_key: 'abc',
    name: 'Mong',
    clientAdmin: { name: 'Mong', email: 'a@b.no', passwordHash: 'secret-hash', pendingSync: true },
  });
  const pub = publicClientAdmin(site.clientAdmin);
  assert.equal(pub.passwordSet, true);
  assert.equal(pub.name, 'Mong');
  assert.equal('passwordHash' in pub, false);
});
