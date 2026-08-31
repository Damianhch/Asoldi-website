import fs from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import {
  allocatePreviewSlug,
  getPublicSalesPreviewUrl,
  ingestSalesPreviewZip,
  slugifyPreviewName,
} from '../lib/sales-preview-import.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sales-preview-'));
const importsRoot = path.join(tmp, 'imports');
await fs.mkdir(importsRoot, { recursive: true });

const siteDir = path.join(tmp, 'sitepack', 'byneset-bydelskafe');
await fs.mkdir(siteDir, { recursive: true });
await fs.writeFile(path.join(siteDir, 'index.html'), '<html><body>hello</body></html>', 'utf8');
await fs.writeFile(path.join(siteDir, 'about.html'), '<html><body>about</body></html>', 'utf8');

const zip = new AdmZip();
zip.addLocalFolder(siteDir, 'byneset-bydelskafe');
const zipBuffer = zip.toBuffer();

const store = {
  'client-1': {
    id: 'client-1',
    businessName: 'Byneset Bydelskafe',
    makerRun: { runId: 'run-1' },
    websiteImport: {},
  },
};

const sales = {
  getSalesClients() {
    return Object.values(store);
  },
  setSalesWebsiteImport(id, patch) {
    store[id] = { ...store[id], websiteImport: { ...(store[id].websiteImport || {}), ...patch } };
    return store[id];
  },
};

assert(slugifyPreviewName('Byneset Bydelskafe') === 'byneset-bydelskafe', 'slugify failed');
assert(allocatePreviewSlug(store['client-1'], []) === 'byneset-bydelskafe', 'allocate slug failed');

const ingested = await ingestSalesPreviewZip({
  client: store['client-1'],
  zipBuffer,
  runId: 'run-1',
  step: 'custom',
  siteFolder: 'byneset-bydelskafe',
  importsRoot,
  sales,
  offers: { listOffers: () => [], updateOffer: () => null },
});

assert(ingested.previewSlug === 'byneset-bydelskafe', `unexpected slug ${ingested.previewSlug}`);
assert(ingested.publicUrl === 'https://asoldi.com/sales-preview/client-1/', `unexpected public url ${ingested.publicUrl}`);
assert(store['client-1'].websiteImport.importRoot.includes('byneset-bydelskafe'), 'importRoot missing site folder');
const html = await fs.readFile(path.join(ingested.siteRoot, 'index.html'), 'utf8');
assert(html.includes('hello'), 'index.html not extracted');
assert(getPublicSalesPreviewUrl(store['client-1']) === ingested.publicUrl, 'public url helper mismatch');
assert(getPublicSalesPreviewUrl(store['client-1'], { pretty: true }).includes('byneset-bydelskafe'), 'pretty slug stays available as alias');
assert(getPublicSalesPreviewUrl(store['client-1'], { pretty: false }) === 'https://asoldi.com/sales-preview/client-1/', 'shared url must stay the id path');

const badZip = new AdmZip();
badZip.addFile(
  'index.html',
  Buffer.from('<html><head><link href="assets/theme.css" rel="stylesheet"></head><body>unstyled</body></html>')
);
store['client-2'] = {
  id: 'client-2',
  businessName: 'Missing CSS Cafe',
  makerRun: { runId: 'run-2' },
  websiteImport: {},
};
let rejectedIncomplete = false;
try {
  await ingestSalesPreviewZip({
    client: store['client-2'],
    zipBuffer: badZip.toBuffer(),
    runId: 'run-2',
    step: 'custom',
    siteFolder: 'missing-css-cafe',
    importsRoot,
    sales,
    offers: { listOffers: () => [], updateOffer: () => null },
  });
} catch (error) {
  rejectedIncomplete = /missing the website's CSS\/JS/.test(String(error.message || ''));
}
assert(rejectedIncomplete, 'ingest must refuse a ZIP that references CSS files it does not contain');

store['client-3'] = {
  id: 'client-3',
  businessName: 'Keep Me Cafe',
  makerRun: { runId: 'run-3' },
  websiteImport: {},
};
const keepZip = new AdmZip();
keepZip.addFile('index.html', Buffer.from('<html><body>keep-me</body></html>'));
await ingestSalesPreviewZip({
  client: store['client-3'],
  zipBuffer: keepZip.toBuffer(),
  runId: 'run-3',
  step: 'custom',
  siteFolder: 'keep-me-cafe',
  importsRoot,
  sales,
  offers: { listOffers: () => [], updateOffer: () => null },
});
let failedSecond = false;
try {
  await ingestSalesPreviewZip({
    client: store['client-3'],
    zipBuffer: badZip.toBuffer(),
    runId: 'run-3',
    step: 'custom',
    siteFolder: 'keep-me-cafe',
    importsRoot,
    sales,
    offers: { listOffers: () => [], updateOffer: () => null },
  });
} catch {
  failedSecond = true;
}
const kept = await fs.readFile(path.join(importsRoot, 'client-3', 'index.html'), 'utf8');
assert(failedSecond, 'second CSS-less import must fail');
assert(kept.includes('keep-me'), 'failed CSS-less import must not wipe a working preview');

store['client-4'] = {
  id: 'client-4',
  businessName: 'Animated Cafe',
  makerRun: { runId: 'run-4' },
  websiteImport: {},
};
const animatedZip = new AdmZip();
animatedZip.addFile(
  'index.html',
  Buffer.from(
    '<html><head></head><body><script src="/preview/run-4/custom/asset?id=webflow.js"></script><a href="/preview/run-4/custom?route=%2Fmeny">Meny</a></body></html>'
  )
);
animatedZip.addFile('assets/webflow.js', Buffer.from('window.Webflow=window.Webflow||[];'));
const animated = await ingestSalesPreviewZip({
  client: store['client-4'],
  zipBuffer: animatedZip.toBuffer(),
  runId: 'run-4',
  step: 'custom',
  siteFolder: 'animated-cafe',
  importsRoot,
  sales,
  offers: { listOffers: () => [], updateOffer: () => null },
});
const animatedHtml = await fs.readFile(path.join(animated.siteRoot, 'index.html'), 'utf8');
assert(animatedHtml.includes('src="assets/webflow.js"'), 'import must rewrite Maker preview JS URLs');
assert(animatedHtml.includes('href="./meny"'), 'import must rewrite Maker preview page routes');
assert(!animatedHtml.includes('/preview/'), 'imported HTML must not keep Maker /preview/ URLs');

await fs.rm(tmp, { recursive: true, force: true });
console.log('sales-preview-import tests passed');
