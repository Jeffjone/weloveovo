import { createGeniusSyncClient } from '../../src/lib/integrations/genius-sync-client';
import { runSync } from '../../src/lib/sync-worker';
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Hosted database required for catalog sync.');
  const result = await runSync(createGeniusSyncClient(process.env.GENIUS_ACCESS_TOKEN || ''), {
    mode: process.argv.includes('--review') ? 'review' : undefined,
    maxItems: process.env.SYNC_MAX_ITEMS ? Number(process.env.SYNC_MAX_ITEMS) : 10000,
    maxMilliseconds: 40 * 60 * 1000,
  });
  console.log(JSON.stringify(result));
}
main().catch(() => {
  console.error(
    'Catalog sync failed; inspect the studio run status. Credentials are never logged.',
  );
  process.exitCode = 1;
});
