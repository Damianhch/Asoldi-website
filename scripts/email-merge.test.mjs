import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMerge, ensureSignerMergeTags, injectEmailPreheader, stripMarketingUnsubscribe, stripRetiredEmailPhrases } from '../lib/email-merge.js';

test('merge fields replace tokens without touching the rest of the HTML', () => {
  const html = '<p>Hei {{firstName}}, velkommen til {{businessName}}</p>';
  const out = applyMerge(html, { firstName: 'Ada', businessName: 'Asoldi & Co' }, { escapeHtml: true });
  assert.equal(out, '<p>Hei Ada, velkommen til Asoldi &amp; Co</p>');
});

test('retired “Se den her” link is stripped from stored HTML', () => {
  const html = '<p>SEO.</p> Se den her: <a href="https://asoldi.com">asoldi.com</a><p>Ferdig.</p>';
  assert.equal(stripRetiredEmailPhrases(html), '<p>SEO.</p><p>Ferdig.</p>');
});

test('marketing unsubscribe is stripped from transactional meeting mail', () => {
  const html = '<p>Hei.</p><p><a href="https://asoldi.com/email/avmeld?c=1">Avmeld e-postmarkedsføring</a></p>';
  assert.equal(stripMarketingUnsubscribe(html), '<p>Hei.</p>');
});

test('preheader is injected once and padded so inbox snippets do not repeat it', () => {
  const line = 'Her er tilbudet vi snakket om – hva som er inkludert, pris og veien videre.';
  const already = `<div style="display: none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${line}</div><h1>Tilbud fra Asoldi</h1>`;
  const out = injectEmailPreheader(already, line);
  assert.equal(out.split(line).length - 1, 1);
  assert.match(out, /&zwnj;&nbsp;/);
  assert.match(out, /<h1>Tilbud fra Asoldi<\/h1>/);
});

test('hardcoded Damian signer is turned into a merge tag', () => {
  assert.equal(
    ensureSignerMergeTags('<p>Mvh Damian fra Asoldi.com</p>'),
    '<p>Mvh {{signerName}} fra Asoldi.com</p>'
  );
});
