import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stripWrappingQuotes,
  parseMailbox,
  resolveSmtpFrom,
  resolveBccHeader,
  splitAddressList,
  toResendAttachments,
  attachmentsForResend,
  canSendEmail,
  resolveMailTransport,
  resolveTransactionalFrom,
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

test('splitAddressList splits commas and strips quotes', () => {
  assert.deepEqual(splitAddressList('daracha777@gmail.com, "Asoldi <kontakt@asoldi.com>"'), [
    'daracha777@gmail.com',
    'Asoldi <kontakt@asoldi.com>',
  ]);
});

test('toResendAttachments encodes buffers and keeps content ids', () => {
  const [attachment] = toResendAttachments([
    {
      filename: 'logo.png',
      content: Buffer.from('abc'),
      contentType: 'image/png',
      cid: 'asoldi-logo-mark',
    },
  ]);
  assert.equal(attachment.filename, 'logo.png');
  assert.equal(attachment.content_type, 'image/png');
  assert.equal(attachment.content_id, 'asoldi-logo-mark');
  assert.equal(attachment.content_disposition, 'inline');
  assert.equal(attachment.content, Buffer.from('abc').toString('base64'));
});

test('Resend from keeps an asoldi.com sender and the salesperson name', () => {
  const previous = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
    SMTP_FROM: process.env.SMTP_FROM,
  };
  process.env.RESEND_API_KEY = 're_test';
  process.env.RESEND_FROM = 'Asoldi <contact@asoldi.com>';
  delete process.env.SMTP_FROM;
  assert.equal(
    resolveTransactionalFrom('Alexander fra Asoldi <alexander@asoldi.com>'),
    'Alexander fra Asoldi <alexander@asoldi.com>'
  );
  assert.equal(
    resolveTransactionalFrom('Damian fra Asoldi <daracha777@gmail.com>'),
    'Damian fra Asoldi <contact@asoldi.com>'
  );
  process.env.RESEND_API_KEY = previous.RESEND_API_KEY;
  process.env.RESEND_FROM = previous.RESEND_FROM;
  process.env.SMTP_FROM = previous.SMTP_FROM;
});

test('Resend is preferred over Hostinger SMTP when an API key is set', () => {
  const previous = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
  };
  process.env.RESEND_API_KEY = 're_test';
  process.env.SMTP_HOST = 'smtp.hostinger.com';
  process.env.SMTP_USER = 'kontakt@asoldi.com';
  process.env.SMTP_PASS = 'secret';
  assert.equal(resolveMailTransport(), 'resend');
  assert.equal(canSendEmail(), true);
  process.env.RESEND_API_KEY = previous.RESEND_API_KEY;
  process.env.SMTP_HOST = previous.SMTP_HOST;
  process.env.SMTP_USER = previous.SMTP_USER;
  process.env.SMTP_PASS = previous.SMTP_PASS;
});

test('Resend payload attaches only the calendar invite when no extra files are passed', () => {
  const attachments = toResendAttachments(attachmentsForResend({
    attachments: [],
    icalEvent: {
      filename: 'asoldi-online-mote.ics',
      method: 'REQUEST',
      content: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
    },
  }));
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].filename, 'asoldi-online-mote.ics');
  assert.match(attachments[0].content_type, /text\/calendar/);
});
