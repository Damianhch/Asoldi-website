import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.APP_DATA_DIR = mkdtempSync(join(tmpdir(), 'asoldi-media-'));

const lib = await import('../lib/hub-media-library.js');

test('sanitizeMediaFileName keeps the extension and produces URL-safe ASCII', () => {
  assert.equal(lib.sanitizeMediaFileName('Nettside sevice animasjon.MP4'), 'Nettside-sevice-animasjon.mp4');
  assert.equal(lib.sanitizeMediaFileName('Blåbær & Øl på fjellet.wav'), 'Blabaer-Ol-pa-fjellet.wav');
  assert.equal(lib.sanitizeMediaFileName('../../etc/passwd.png'), 'passwd.png');
  assert.match(lib.sanitizeMediaFileName('***.mp4'), /^file-\d+\.mp4$/);
});

test('mediaKindForName / isAllowedMediaName whitelist', () => {
  assert.equal(lib.mediaKindForName('a.webp'), 'image');
  assert.equal(lib.mediaKindForName('a.mov'), 'video');
  assert.equal(lib.mediaKindForName('a.WAV'), 'audio');
  assert.equal(lib.mediaKindForName('a.pdf'), 'document');
  assert.equal(lib.isAllowedMediaName('evil.html'), false);
  assert.equal(lib.isAllowedMediaName('evil.js'), false);
  assert.equal(lib.isAllowedMediaName('evil.php'), false);
});

test('resolveMediaPath refuses traversal', () => {
  const root = lib.hubMediaDir();
  assert.ok(lib.resolveMediaPath(root, 'client-flow/x.png').startsWith(root));
  assert.equal(lib.resolveMediaPath(root, '../x.png'), '');
  assert.equal(lib.resolveMediaPath(root, 'a/../../x.png'), '');
  assert.equal(lib.resolveMediaPath(root, ''), '');
});

test('listHubMedia merges disk + git copies and tracks source', () => {
  const disk = lib.hubMediaDir();
  const git = mkdtempSync(join(tmpdir(), 'asoldi-public-media-'));
  writeFileSync(join(disk, 'video.mp4'), 'x'.repeat(10));
  mkdirSync(join(disk, 'client-flow'), { recursive: true });
  writeFileSync(join(disk, 'client-flow', 'shot.png'), 'y');
  writeFileSync(join(git, 'video.mp4'), 'x'.repeat(10));
  writeFileSync(join(git, 'logo.svg'), '<svg/>');
  writeFileSync(join(git, 'readme.txt'), 'ignored');

  const items = lib.listHubMedia({ publicMediaDir: git });
  const byName = Object.fromEntries(items.map((i) => [i.name, i]));
  assert.equal(byName['video.mp4'].source, 'both');
  assert.equal(byName['client-flow/shot.png'].source, 'disk');
  assert.equal(byName['client-flow/shot.png'].url, '/media/client-flow/shot.png');
  assert.equal(byName['logo.svg'].source, 'git');
  assert.equal(byName['readme.txt'], undefined);
});

test('meta index, rename and delete', () => {
  const disk = lib.hubMediaDir();
  writeFileSync(join(disk, 'clip.wav'), 'audio');
  lib.registerHubMediaUpload({ name: 'clip.wav', uploadedBy: 'admin', tags: ['Lydklipp', 'Sales Call'] });
  let item = lib.getHubMediaItem('clip.wav');
  assert.deepEqual(item.tags, ['lydklipp', 'sales-call']);
  assert.equal(item.uploadedBy, 'admin');

  lib.updateHubMediaMeta('clip.wav', { alt: 'Sando close call' });
  assert.equal(lib.getHubMediaItem('clip.wav').alt, 'Sando close call');

  const renamed = lib.renameHubMedia('clip.wav', 'sando close call.wav');
  assert.equal(renamed.ok, true);
  assert.equal(renamed.name, 'sando-close-call.wav');
  assert.equal(lib.getHubMediaItem('sando-close-call.wav').alt, 'Sando close call');
  assert.equal(lib.renameHubMedia('sando-close-call.wav', 'x.mp3').ok, false, 'extension must not change');

  assert.equal(lib.deleteHubMedia('missing.mp4').reason, 'git-only');
  assert.equal(lib.deleteHubMedia('../x').reason, 'invalid-name');
  assert.equal(lib.deleteHubMedia('sando-close-call.wav').ok, true);
  assert.equal(existsSync(join(disk, 'sando-close-call.wav')), false);
});

test('pickUploadTarget never overwrites unless asked', () => {
  const disk = lib.hubMediaDir();
  writeFileSync(join(disk, 'hero.png'), 'a');
  assert.equal(lib.pickUploadTarget(disk, 'hero.png'), 'hero-2.png');
  assert.equal(lib.pickUploadTarget(disk, 'hero.png', { override: true }), 'hero.png');
  assert.equal(lib.pickUploadTarget(disk, 'new.png'), 'new.png');
});
