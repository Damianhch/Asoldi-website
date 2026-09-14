import test from 'node:test';
import assert from 'node:assert/strict';
import { composeEmailForClient } from '../lib/email-templates-store.js';
import { buildSalesSender } from '../lib/sales-sender.js';
import {
  buildSalesCalendarInvite,
  embedInlineEmailAssets,
  getSalesEmailPreviewClient,
  rewriteSalesEmailAssetsToHosted,
} from '../lib/sales-email.js';

test('calendar invite organizer matches the branded From address', () => {
  const previous = process.env.RESEND_FROM;
  process.env.RESEND_FROM = 'Asoldi <contact@asoldi.com>';
  const invite = buildSalesCalendarInvite(getSalesEmailPreviewClient(), {
    meetLink: 'https://meet.google.com/aaa-bbbb-ccc',
    htmlLink: 'https://calendar.google.com/event?eid=test',
    eventId: 'evt-1',
  });
  process.env.RESEND_FROM = previous;
  assert.ok(invite);
  assert.equal(invite.method, 'REQUEST');
  assert.match(invite.content, /METHOD:REQUEST/);
  assert.match(invite.content, /ORGANIZER;CN=Asoldi:mailto:contact@asoldi.com/);
  assert.match(invite.content, /ATTENDEE;.*mailto:daracha777@gmail.com/);
  assert.match(invite.content, /LOCATION:https:\/\/meet\.google\.com\/aaa-bbbb-ccc/);
});

test('sales images stay in the HTML and are not file attachments', () => {
  const html = rewriteSalesEmailAssetsToHosted(`
    <img src="cid:asoldi-hero-desktop" />
    <img src="/email/sales/envelope.png" />
    <img src="https://asoldi.com/email/sales/icon-facebook.png" />
  `);
  const embedded = embedInlineEmailAssets('<img src="/email/sales/hero-desktop.jpg" />');
  assert.match(html, /https:\/\/asoldi\.com\/email\/sales\/hero-desktop\.jpg/);
  assert.match(html, /https:\/\/asoldi\.com\/email\/sales\/envelope\.png/);
  assert.match(html, /https:\/\/asoldi\.com\/email\/sales\/icon-facebook\.png/);
  assert.equal(html.includes('cid:'), false);
  assert.deepEqual(embedded.attachments, []);
});

test('composed welcome mail has hosted images and no extra file attachments', () => {
  const message = composeEmailForClient(getSalesEmailPreviewClient(), 'thank-you').message;
  assert.match(message.html, /https:\/\/asoldi\.com\/email\/sales\/hero-desktop\.jpg/);
  assert.equal(message.html.includes('cid:'), false);
  assert.deepEqual(message.attachments, []);
  assert.equal(message.icalEvent, undefined);
});

test('ICS is attached only when calendar invite fallback is requested', () => {
  const message = composeEmailForClient(getSalesEmailPreviewClient(), 'thank-you', null, {
    attachInvite: true,
  }).message;
  assert.equal(message.icalEvent?.filename, 'asoldi-online-mote.ics');
});

test('sales sender identity is Name fra Asoldi with an asoldi.com address', () => {
  const sender = buildSalesSender({
    name: 'Alexander Berg',
    fromEmail: 'alexander@asoldi.com',
  });
  assert.equal(sender.name, 'Alexander');
  assert.equal(sender.fromEmail, 'alexander@asoldi.com');
  assert.equal(sender.from, 'Alexander fra Asoldi <alexander@asoldi.com>');
});

test('personal Gmail is not used as From; the Asoldi mailbox is derived from the name', () => {
  const sender = buildSalesSender({
    name: 'Alexander',
    fromEmail: 'alexander.sales@gmail.com',
  });
  assert.equal(sender.fromEmail, 'alexander@asoldi.com');
  assert.equal(sender.from, 'Alexander fra Asoldi <alexander@asoldi.com>');
});

test('asoldi.com username becomes the From mailbox and display name', () => {
  const sender = buildSalesSender({ username: 'alexander@asoldi.com' });
  assert.equal(sender.name, 'Alexander');
  assert.equal(sender.from, 'Alexander fra Asoldi <alexander@asoldi.com>');
});

test('generic admin From is replaced by the connected Google name', () => {
  const sender = buildSalesSender({
    name: 'Asoldi.com',
    fromEmail: 'contact@asoldi.com',
    username: 'asoldi.com',
    googleName: 'Damian',
  });
  assert.equal(sender.name, 'Damian');
  assert.equal(sender.from, 'Damian fra Asoldi <damian@asoldi.com>');
});

test('welcome merge fills the salesperson name in the body and From line', () => {
  const sender = buildSalesSender({
    name: 'Alexander',
    fromEmail: 'alexander@asoldi.com',
  });
  const composed = composeEmailForClient(getSalesEmailPreviewClient(), 'thank-you', {
    html: '<p>Mvh {{signerName}} fra Asoldi.com</p>',
    subject: 'Hei {{signerName}}',
  }, { sender });
  assert.equal(composed.values.signerName, 'Alexander');
  assert.equal(composed.message.from, 'Alexander fra Asoldi <alexander@asoldi.com>');
  assert.equal(composed.message.subject, 'Hei Alexander');
  assert.match(composed.message.html, /Mvh Alexander fra Asoldi.com/);
  assert.equal(composed.message.icalEvent, undefined);
});
