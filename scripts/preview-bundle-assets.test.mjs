import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import {
  collectRelativeAssetRefs,
  fillExportZipWithMakerAssets,
  makerAssetFetchUrls,
  rewriteCssForStaticPreview,
} from '../lib/preview-bundle-assets.js';

const htmlRefs = collectRelativeAssetRefs(
  '<link href="localasset://theme.css" rel="stylesheet"><script src="assets/app.js"></script>'
);
assert.deepEqual([...htmlRefs].sort(), ['assets/app.js', 'assets/theme.css']);

assert.equal(
  rewriteCssForStaticPreview('src:url(localasset://brand.woff)'),
  'src:url(brand.woff)'
);
assert.equal(
  rewriteCssForStaticPreview('src:url(/preview/run-1/step/1/asset?id=brand.woff)'),
  'src:url(brand.woff)'
);

const urls = makerAssetFetchUrls({
  makerBase: 'http://192.168.68.92:3000',
  runId: 'run-1',
  exportStep: 'custom',
  assetPath: 'assets/theme.css',
});
assert.ok(urls[0].includes('/preview/run-1/custom/asset?id=theme.css'));
assert.ok(urls.some((url) => url.includes('/preview/run-1/step/1/asset?id=theme.css')));

const zip = new AdmZip();
zip.addFile(
  'index.html',
  Buffer.from('<html><head><link href="assets/theme.css" rel="stylesheet"></head><body>ok</body></html>')
);
const files = new Map([
  [
    'http://maker.test/preview/run-1/custom/asset?id=theme.css',
    {
      ok: true,
      contentType: 'text/css',
      body: 'body{color:red} @font-face{src:url(localasset://brand.woff)}',
    },
  ],
  [
    'http://maker.test/preview/run-1/custom/asset?id=brand.woff',
    { ok: true, contentType: 'font/woff', body: 'wOFF' },
  ],
]);
const filled = await fillExportZipWithMakerAssets({
  makerBase: 'http://maker.test',
  runId: 'run-1',
  exportStep: 'custom',
  zipBuffer: zip.toBuffer(),
  fetchImpl: async (url) => {
    const hit = files.get(String(url));
    if (!hit) return { ok: false, headers: { get: () => '' }, arrayBuffer: async () => new ArrayBuffer(0) };
    return {
      ok: true,
      headers: { get: () => hit.contentType },
      arrayBuffer: async () => Buffer.from(hit.body),
    };
  },
});
assert.equal(filled.added, 2);
const out = new AdmZip(filled.buffer);
assert.ok(out.getEntry('assets/theme.css'));
assert.ok(out.getEntry('assets/brand.woff'));
assert.match(out.getEntry('assets/theme.css').getData().toString('utf8'), /url\(brand\.woff\)/);

const emptyCssZip = new AdmZip();
emptyCssZip.addFile(
  'index.html',
  Buffer.from('<html><head><link href="assets/missing.css" rel="stylesheet"></head><body>x</body></html>')
);
await assert.rejects(
  () =>
    fillExportZipWithMakerAssets({
      makerBase: 'http://maker.test',
      runId: 'run-1',
      exportStep: 'custom',
      zipBuffer: emptyCssZip.toBuffer(),
      fetchImpl: async () => ({ ok: false, headers: { get: () => '' }, arrayBuffer: async () => new ArrayBuffer(0) }),
    }),
  /missing CSS\/JS/
);

console.log('preview-bundle-assets tests passed');
