import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import test from 'node:test';
import assert from 'node:assert/strict';

const dataDir = mkdtempSync(join(tmpdir(), 'asoldi-persistent-env-'));
process.env.APP_DATA_DIR = dataDir;
process.env.PERSIST_PRODUCTION_ENV = '1';

const persistentEnv = await import('../lib/persistent-env.js');

test('backup merge never drops a key that disappeared from process.env', () => {
  const existing = { MYPHONER_API_KEY: 'keep-me', SMTP_HOST: 'smtp.hostinger.com' };
  const live = { SMTP_HOST: 'smtp.hostinger.com' };
  const merged = persistentEnv.mergeProductionEnv(existing, live);
  assert.equal(merged.MYPHONER_API_KEY, 'keep-me');
  assert.equal(merged.SMTP_HOST, 'smtp.hostinger.com');
});

test('live values update the backup without removing other keys', () => {
  const existing = { MYPHONER_API_KEY: 'old', MYPHONER_SUBDOMAIN: 'asoldi' };
  const live = { MYPHONER_API_KEY: 'new-key' };
  const merged = persistentEnv.mergeProductionEnv(existing, live);
  assert.equal(merged.MYPHONER_API_KEY, 'new-key');
  assert.equal(merged.MYPHONER_SUBDOMAIN, 'asoldi');
});

test('applyPersistentProductionEnv loads backup into empty process.env then snapshots', () => {
  const filePath = persistentEnv.getProductionEnvBackupPath();
  writeFileSync(filePath, 'MYPHONER_WEBHOOK_SECRET=from-disk\nMYPHONER_SUBDOMAIN=asoldi\n');
  delete process.env.MYPHONER_WEBHOOK_SECRET;
  delete process.env.MYPHONER_SUBDOMAIN;
  const result = persistentEnv.applyPersistentProductionEnv({ filePath });
  assert.equal(result.applied, true);
  assert.equal(process.env.MYPHONER_WEBHOOK_SECRET, 'from-disk');
  assert.equal(process.env.MYPHONER_SUBDOMAIN, 'asoldi');
  const saved = persistentEnv.parseEnvFile(readFileSync(filePath, 'utf8'));
  assert.equal(saved.MYPHONER_WEBHOOK_SECRET, 'from-disk');
  assert.equal(saved.MYPHONER_SUBDOMAIN, 'asoldi');
});

test('existing process.env wins over backup (Hostinger tab stays source of truth)', () => {
  const filePath = join(dataDir, 'production-override.env');
  writeFileSync(filePath, 'MYPHONER_API_KEY=from-disk\n');
  process.env.MYPHONER_API_KEY = 'from-hostinger';
  persistentEnv.applyPersistentProductionEnv({ filePath });
  assert.equal(process.env.MYPHONER_API_KEY, 'from-hostinger');
  const saved = persistentEnv.parseEnvFile(readFileSync(filePath, 'utf8'));
  assert.equal(saved.MYPHONER_API_KEY, 'from-hostinger');
});

test.after(() => {
  rmSync(dataDir, { recursive: true, force: true });
});
