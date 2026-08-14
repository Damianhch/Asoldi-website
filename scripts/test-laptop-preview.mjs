import assert from 'node:assert/strict';
import {
  LAN_ASOLDI_ORIGIN,
  LAN_MAKER_ORIGIN,
  buildLaptopMakerPreviewUrl,
  buildLaptopPreviewEntry,
  buildLivePreviewPath,
  buildMakerPreviewPath,
  pickLanAsoldiOrigin,
  pickLanMakerOrigin,
  rebaseMakerUrl,
} from '../lib/laptop-preview.js';

assert.equal(buildMakerPreviewPath('run-1', '4'), '/preview/run-1/step/4/view?route=/');
assert.equal(buildLivePreviewPath('abc 1'), '/live-preview/abc%201');

assert.equal(
  pickLanMakerOrigin(['http://localhost:3000', 'https://trycloudflare.example', LAN_MAKER_ORIGIN]),
  LAN_MAKER_ORIGIN
);
assert.equal(
  pickLanMakerOrigin(['http://127.0.0.1:3000', 'http://192.168.68.92:3000']),
  'http://192.168.68.92:3000'
);
assert.equal(pickLanAsoldiOrigin(['https://asoldi.com', 'http://192.168.68.92:3200']), LAN_ASOLDI_ORIGIN);

assert.equal(
  rebaseMakerUrl(
    LAN_MAKER_ORIGIN,
    'http://localhost:3000/preview/run-9/step/3/view?route=/'
  ),
  'http://192.168.68.92:3000/preview/run-9/step/3/view?route=/'
);

assert.equal(
  buildLaptopMakerPreviewUrl({
    runId: 'run-9',
    storedPreviewUrl: 'http://localhost:3000/preview/run-9/step/5/view?route=/about',
    lanMakerOrigin: 'http://localhost:3000',
  }),
  'http://192.168.68.92:3000/preview/run-9/step/5/view?route=/about'
);

const entry = buildLaptopPreviewEntry(
  {
    id: 'client-1',
    businessName: 'Mong Sushi',
    makerRun: {
      runId: 'run-9',
      previewUrl: 'https://random.trycloudflare.com/preview/run-9/step/3/view?route=/',
      latestReadyStep: '3',
    },
  },
  { lanMakerOrigin: LAN_MAKER_ORIGIN, lanAsoldiOrigin: LAN_ASOLDI_ORIGIN }
);

assert.equal(entry.laptopUrl, `${LAN_ASOLDI_ORIGIN}/live-preview/client-1`);
assert.equal(entry.makerPreviewUrl, `${LAN_MAKER_ORIGIN}/preview/run-9/step/3/view?route=/`);
assert.equal(buildLaptopPreviewEntry({ id: 'x' }), null);

console.log('laptop-preview tests passed');
