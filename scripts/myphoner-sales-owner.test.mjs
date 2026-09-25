import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MYPHONER_ADMIN_OWNER_KEY,
  generalSalesOwnerKeys,
  isGeneralSalesOwnerKey,
  resolveMyphonerSalesOwnerId,
} from '../lib/myphoner-sales-owner.js';

const salesUsers = [
  { id: 'damian-id', username: 'damian@asoldi.com', role: 'sales' },
  { id: 'kari-id', username: 'kari@asoldi.com', role: 'sales' },
];

test('a new MyPhoner client is held by the admin, not the first sales user', () => {
  assert.equal(resolveMyphonerSalesOwnerId({
    existingOwnerId: '',
    salesUsers,
    defaultOwnerKey: 'admin:daracha777@gmail.com',
  }), MYPHONER_ADMIN_OWNER_KEY);
  assert.equal(MYPHONER_ADMIN_OWNER_KEY, 'admin:damian@asoldi.com');
});

test('the sales:damian catch-all is moved back to the admin account', () => {
  assert.equal(isGeneralSalesOwnerKey('sales:damian-id', { salesUsers }), true);
  assert.equal(resolveMyphonerSalesOwnerId({
    existingOwnerId: 'sales:damian-id',
    salesUsers,
    defaultOwnerKey: 'admin:daracha777@gmail.com',
  }), MYPHONER_ADMIN_OWNER_KEY);
});

test('a configured default sales owner is treated as the general bucket', () => {
  assert.equal(isGeneralSalesOwnerKey('sales:damian-id', {
    salesUsers,
    defaultOwnerKey: 'damian@asoldi.com',
  }), true);
  assert.equal(resolveMyphonerSalesOwnerId({
    existingOwnerId: 'sales:pool',
    salesUsers,
    defaultOwnerKey: 'sales:pool',
  }), MYPHONER_ADMIN_OWNER_KEY);
  assert.ok(generalSalesOwnerKeys({ salesUsers, defaultOwnerKey: 'sales:pool' }).has('sales:pool'));
});

test('a rep someone already assigned is kept', () => {
  assert.equal(resolveMyphonerSalesOwnerId({
    existingOwnerId: 'sales:kari-id',
    salesUsers,
    defaultOwnerKey: 'admin:daracha777@gmail.com',
  }), 'sales:kari-id');
});

test('an admin owner stays with damian@asoldi.com so he can assign a rep', () => {
  assert.equal(resolveMyphonerSalesOwnerId({
    existingOwnerId: 'admin:daracha777@gmail.com',
    salesUsers,
  }), MYPHONER_ADMIN_OWNER_KEY);
});
