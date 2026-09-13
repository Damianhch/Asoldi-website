import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stripWrappingQuotes,
  parseMailbox,
  resolveSmtpFrom,
  resolveBccHeader,
} from '../lib/email.js';

test('strips Hostinger wrapping quotes from env values', () => {
  assert.equal(stripWrappingQuotes('"Asoldi <contact@asoldi.com>"'), 'Asoldi <contact@asoldi.com>');
  assert.equal(stripWrappingQuotes("'secret'"), 'secret');
});

test('parseMailbox reads name and address', () => {
  assert.deepEqual(parseMailbox('Asoldi <contact@asoldi.com>'), {
    name: 'Asoldi',
    address: 'contact@asoldi.com',
  });
});

test('resolveSmtpFrom keeps display name but uses the authenticated mailbox', () => {
  assert.equal(
    resolveSmtpFrom('"Asoldi <kontakt@asoldi.com>"', 'contact@asoldi.com'),
    'Asoldi <contact@asoldi.com>'
  );
  assert.equal(
    resolveSmtpFrom('Asoldi <contact@asoldi.com>', 'contact@asoldi.com'),
    'Asoldi <contact@asoldi.com>'
  );
  assert.equal(
    resolveSmtpFrom('', 'contact@asoldi.com'),
    'Asoldi <contact@asoldi.com>'
  );
});

test('skips BCC when it is the same mailbox as the recipient', () => {
  process.env.SMTP_USER = 'contact@asoldi.com';
  delete process.env.SMTP_BCC;
  assert.equal(resolveBccHeader(undefined, 'contact@asoldi.com'), '');
  assert.equal(resolveBccHeader(undefined, 'daracha777@gmail.com'), 'contact@asoldi.com');
});
