/**
 * One-shot Hostinger / local cleanup for unbounded JSON snapshots.
 *
 * Live CRM / hub data is the sibling *.json files in the data dir.
 * This folder is only historical copies and is never read by the app.
 *
 *   node scripts/prune-data-backups.mjs
 *   node scripts/prune-data-backups.mjs --dir /home/u439392007/domains/asoldi.com/.asoldi-website-data
 *   node scripts/prune-data-backups.mjs --wipe-stamped
 */
const args = process.argv.slice(2);

function argValue(flag, fallback = '') {
  const idx = args.indexOf(flag);
  if (idx === -1 || !args[idx + 1]) return fallback;
  return args[idx + 1];
}

const dir = argValue('--dir');
if (dir) process.env.APP_DATA_DIR = dir;

const keepArg = argValue('--keep');
if (keepArg) process.env.DATA_BACKUP_KEEP = keepArg;
if (args.includes('--wipe-stamped')) process.env.DATA_BACKUP_KEEP = '0';

const { pruneAllDataBackups, getPersistentDataDir } = await import('../data/storage-path.js');
const result = pruneAllDataBackups();
console.log(
  JSON.stringify(
    {
      dataDir: getPersistentDataDir(),
      ...result,
    },
    null,
    2
  )
);
