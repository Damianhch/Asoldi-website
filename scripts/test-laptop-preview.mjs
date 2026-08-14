import assert from 'node:assert/strict';
import {
  LAN_ASOLDI_ORIGIN,
  PUBLIC_SALES_ORIGIN,
  buildLaptopPreviewEntry,
  buildMakerExportUrl,
  buildPreviewBundleUploadUrl,
  buildPublicSalesPreviewUrl,
  buildSalesPreviewPath,
  clientNeedsPublicPreviewSnapshot,
  injectPreviewBaseHref,
  isAllowedPreviewBridgeExportUrl,
  isAllowedPreviewBundleUploadUrl,
  isPrivateMakerUrl,
  lanAsoldiOriginFromMakerUrl,
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

assert.equal(isPrivateMakerUrl('http://192.168.68.92:3000'), true);
assert.equal(isPrivateMakerUrl('https://asoldi.com'), false);
assert.equal(
  lanAsoldiOriginFromMakerUrl('http://192.168.68.92:3000/preview/run-9'),
  'http://192.168.68.92:3200'
);
assert.equal(lanAsoldiOriginFromMakerUrl('https://asoldi.com'), LAN_ASOLDI_ORIGIN);

const exportUrl = buildMakerExportUrl({
  makerBaseUrl: 'http://192.168.68.92:3000',
  runId: 'run-9',
  clientId: '1785835834488-xz9wdd',
  siteFolder: 'Mong Sushi',
});
assert.equal(
  exportUrl.startsWith('http://192.168.68.92:3000/api/runs/run-9/export?'),
  true
);
assert.equal(
  decodeURIComponent(new URL(exportUrl).searchParams.get('baseUrl')),
  `${PUBLIC_SALES_ORIGIN}/sales-preview/1785835834488-xz9wdd/`
);

assert.equal(
  buildPreviewBundleUploadUrl('1785835834488-xz9wdd'),
  `${PUBLIC_SALES_ORIGIN}/api/admin/sales/1785835834488-xz9wdd/receive-preview-bundle`
);
assert.equal(
  isAllowedPreviewBridgeExportUrl(
    'http://192.168.68.92:3000/api/runs/run-9/export?step=latest'
  ),
  true
);
assert.equal(
  isAllowedPreviewBridgeExportUrl('https://evil.example/api/runs/run-9/export'),
  false
);
assert.equal(
  isAllowedPreviewBundleUploadUrl(
    `${PUBLIC_SALES_ORIGIN}/api/admin/sales/client-1/receive-preview-bundle`
  ),
  true
);
assert.equal(
  isAllowedPreviewBundleUploadUrl('https://evil.example/api/admin/sales/client-1/receive-preview-bundle'),
  false
);

assert.equal(
  clientNeedsPublicPreviewSnapshot({
    id: '1785835834488-xz9wdd',
    makerRun: { runId: 'run-9' },
  }),
  true
);
assert.equal(
  clientNeedsPublicPreviewSnapshot({
    id: '1785835834488-xz9wdd',
    makerRun: { runId: 'run-9' },
    websiteImport: { importRoot: '/data/sales-site-imports/1785835834488-xz9wdd' },
  }),
  false
);
assert.equal(
  injectPreviewBaseHref('<html><head><title>x</title></head></html>', 'client-1'),
  '<html><head><base href="/sales-preview/client-1/"><title>x</title></head></html>'
);

console.log('laptop-preview tests passed');
