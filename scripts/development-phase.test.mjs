import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDevelopmentItems,
  isLiveHubClient,
  isDevelopmentSalesClient,
  resolveSiteDeliveryPhase,
} from '../lib/development-phase.js';

const mong = {
  id: '1',
  site_key: 'mong-key',
  name: 'Mong Sushi',
  domain: 'mongsushi.no',
};

const neo = {
  id: '2',
  site_key: 'neo-key',
  name: 'NEOmål',
  domain: '',
};

const byneset = {
  id: '3',
  site_key: 'byneset-key',
  name: 'Byneset Bydelskafe',
  domain: 'bynesetbydelskafe.no',
};

const bynesetSales = {
  id: 'sales-byneset',
  product: 'asoldi',
  status: 'active',
  businessName: 'Byneset Bydelskafe',
  websiteDomain: 'bynesetbydelskafe.no',
  progression: { contractSigned: true },
  development: { nettsideFerdig: false },
  hubSite: { siteKey: 'byneset-key', id: '3', domain: 'bynesetbydelskafe.no' },
};

test('Byneset leaves Clients and appears in Development when contract is signed', () => {
  const sales = [bynesetSales];
  const sites = [mong, neo, byneset];
  assert.equal(resolveSiteDeliveryPhase(byneset, sales), 'development');
  assert.equal(isLiveHubClient(byneset, sales), false);
  assert.equal(isLiveHubClient(mong, sales), true);
  assert.equal(isLiveHubClient(neo, sales), true);

  const items = buildDevelopmentItems(sales, sites);
  assert.equal(items.length, 1);
  assert.equal(items[0].businessName, 'Byneset Bydelskafe');
  assert.equal(items[0].id, 'sales:sales-byneset');
});

test('Byneset hub site still appears in Development without a sales row', () => {
  const items = buildDevelopmentItems([], [mong, byneset]);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'site:3');
  assert.equal(isLiveHubClient(byneset, []), false);
});

test('finished website leaves Development and returns to Clients', () => {
  const finished = {
    ...bynesetSales,
    development: { nettsideFerdig: true },
  };
  const site = {
    ...byneset,
    development: { nettsideFerdig: true },
  };
  assert.equal(isDevelopmentSalesClient(finished), false);
  assert.equal(resolveSiteDeliveryPhase(site, [finished]), 'client');
  assert.equal(buildDevelopmentItems([finished], [site]).length, 0);
});

test('unsigned contract stays in sales and does not create a development card', () => {
  const unsigned = {
    ...bynesetSales,
    businessName: 'New Cafe',
    progression: { contractSigned: false },
    hubSite: {},
  };
  assert.equal(isDevelopmentSalesClient(unsigned), false);
  assert.equal(buildDevelopmentItems([unsigned], [mong]).length, 0);
});
