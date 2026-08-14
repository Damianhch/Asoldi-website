import assert from 'node:assert/strict';
import {
  PUBLIC_SALES_ORIGIN,
  buildLaptopPreviewEntry,
  buildPublicSalesPreviewUrl,
  buildSalesPreviewPath,
  toPublicSalesPreviewUrl,
} from '../lib/laptop-preview.js';

assert.equal(buildSalesPreviewPath('abc 1'), '/sales-preview/abc%201/');
assert.equal(buildPublicSalesPreviewUrl('client-1'), `${PUBLIC_SALES_ORIGIN}/sales-preview/client-1/`);
assert.equal(
  toPublicSalesPreviewUrl('/sales-preview/client-1/', 'client-1'),
  `${PUBLIC_SALES_ORIGIN}/sales-preview/client-1/`
);
assert.equal(
  toPublicSalesPreviewUrl('http://192.168.68.92:3200/sales-preview/client-1/', 'client-1'),
  `${PUBLIC_SALES_ORIGIN}/sales-preview/client-1/`
);
assert.equal(
  toPublicSalesPreviewUrl('https://random.trycloudflare.com/preview/run-9/step/3/view?route=/', 'client-1'),
  `${PUBLIC_SALES_ORIGIN}/sales-preview/client-1/`
);

assert.equal(buildLaptopPreviewEntry({ id: 'x' }), null);
assert.equal(buildLaptopPreviewEntry({ id: 'client-1', makerRun: { runId: 'run-9' } }), null);

const entry = buildLaptopPreviewEntry({
  id: 'client-1',
  businessName: 'Mong Sushi',
  websiteImport: {
    previewUrl: '/sales-preview/client-1/',
    importedAt: '2026-08-14T12:00:00.000Z',
  },
  makerRun: { runId: 'run-9' },
});
assert.equal(entry.publicPreviewUrl, `${PUBLIC_SALES_ORIGIN}/sales-preview/client-1/`);
assert.equal(entry.laptopUrl, entry.publicPreviewUrl);

console.log('laptop-preview tests passed');
