import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMerge, stripRetiredEmailPhrases } from '../lib/email-merge.js';

test('merge fields replace tokens without touching the rest of the HTML', () => {
  const html = '<p>Hei {{firstName}}, velkommen til {{businessName}}</p>';
  const out = applyMerge(html, { firstName: 'Ada', businessName: 'Asoldi & Co' }, { escapeHtml: true });
  assert.equal(out, '<p>Hei Ada, velkommen til Asoldi &amp; Co</p>');
});

test('retired “Se den her” link is stripped from stored HTML', () => {
  const html = '<p>SEO.</p> Se den her: <a href="https://asoldi.com">asoldi.com</a><p>Ferdig.</p>';
  assert.equal(stripRetiredEmailPhrases(html), '<p>SEO.</p><p>Ferdig.</p>');
});
