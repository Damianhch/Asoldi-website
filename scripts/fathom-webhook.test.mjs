import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import {
  authorizeFathomWebhook,
  buildFathomNotifyEmail,
  formatFathomTranscript,
  verifyFathomSignature,
} from '../lib/fathom-webhook.js';

const SAMPLE = {
  title: 'Asoldi møte med Testbedrift',
  recording_id: 123456789,
  url: 'https://fathom.video/xyz123',
  share_url: 'https://fathom.video/share/xyz123',
  recording_start_time: '2026-03-01T16:01:12Z',
  recorded_by: { name: 'Alexander', email: 'alexander@asoldi.com' },
  calendar_invitees: [{ name: 'Kunde', email: 'kunde@example.com' }],
  summary: { markdown_formatted: 'Vi gikk gjennom nettsiden.' },
  action_items: [{ description: 'Send tilbud' }],
  transcript: [
    { speaker: { display_name: 'Alexander' }, text: 'Hei, takk for møtet.' },
    { speaker: { display_name: 'Kunde' }, text: 'Takk selv.' },
  ],
};

test('Fathom email includes a video link, not a video file', () => {
  const email = buildFathomNotifyEmail(SAMPLE, 'ansatte@asoldi.com');
  assert.equal(email.to, 'ansatte@asoldi.com');
  assert.equal(email.videoUrl, 'https://fathom.video/share/xyz123');
  assert.match(email.text, /Video: https:\/\/fathom\.video\/share\/xyz123/);
  assert.match(email.html, /href="https:\/\/fathom\.video\/share\/xyz123"/);
  assert.match(email.html, /Åpne video/);
  assert.equal(email.attachments.length, 1);
  assert.equal(email.attachments[0].filename, 'fathom-transcript-123456789.txt');
  assert.equal(email.attachments.some((item) => /\.(mp4|webm|mov)$/i.test(item.filename || '')), false);
});

test('transcript lines keep speaker names', () => {
  assert.equal(
    formatFathomTranscript(SAMPLE),
    'Alexander: Hei, takk for møtet.\nKunde: Takk selv.'
  );
});

test('webhook token in the URL is enough to authorize', () => {
  const config = { token: 'team-token', secrets: [], notifyEmail: 'ansatte@asoldi.com' };
  const ok = authorizeFathomWebhook({ query: { token: 'team-token' }, headers: {}, rawBody: '{}' }, config);
  const bad = authorizeFathomWebhook({ query: { token: 'nope' }, headers: {}, rawBody: '{}' }, config);
  assert.deepEqual(ok, { ok: true, via: 'token' });
  assert.equal(bad.ok, false);
  assert.equal(bad.status, 401);
});

test('Fathom Standard Webhooks signature verifies', () => {
  const key = Buffer.from('0123456789abcdef0123456789abcdef');
  const secret = `whsec_${key.toString('base64')}`;
  const rawBody = '{"recording_id":1}';
  const webhookId = 'msg_1';
  const webhookTimestamp = String(Math.floor(Date.now() / 1000));
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const signature = createHmac('sha256', key).update(signedContent).digest('base64');
  const headers = {
    'webhook-id': webhookId,
    'webhook-timestamp': webhookTimestamp,
    'webhook-signature': `v1,${signature}`,
  };
  assert.equal(verifyFathomSignature(secret, headers, rawBody), true);
  const authorized = authorizeFathomWebhook({ headers, query: {}, rawBody }, {
    token: '',
    secrets: [secret],
    notifyEmail: 'ansatte@asoldi.com',
  });
  assert.equal(authorized.ok, true);
  assert.equal(authorized.via, 'signature');
});
