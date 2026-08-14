import dotenv from 'dotenv';
import * as myphonerSsuWins from '../lib/myphoner-ssu-wins.js';

dotenv.config();

const dryRun = process.argv.includes('--dry-run');

if (dryRun) {
  const lists = await myphonerSsuWins.resolveSsuWinsLists({ force: true });
  if (!lists.ok) {
    console.error(lists.error || 'Failed resolving SSU / SSU wins lists.');
    process.exit(1);
  }
  console.log(JSON.stringify({ dryRun: true, lists }, null, 2));
  process.exit(0);
}

const result = await myphonerSsuWins.backfillSsuWinnersToWinsList({ force: true });
console.log(JSON.stringify(result, null, 2));
if (!result?.ok && result?.error) process.exit(1);
