import { CuratorInputError } from './curator-error';
import { bootstrapSync } from './sync-bootstrap';
import { randomUUID } from 'node:crypto';
import { query, transaction } from './db';
import { processSource, sourceMissing, refreshHeldSources } from './catalog-sync';
import type { GeniusSyncClient } from './integrations/genius-sync-client';
import { GeniusError } from './integrations/genius-client';
type Run = {
  id: string;
  mode: 'review' | 'mixed';
  next_page: number;
  discovery_complete: boolean;
  checked: number;
};
export async function runSync(
  client: GeniusSyncClient,
  options: { mode?: 'review' | 'mixed'; maxItems?: number; maxMilliseconds?: number } = {},
) {
  await bootstrapSync();
  const owner = randomUUID();
  const lease = await query<{ automation_enabled: boolean }>(
    "UPDATE sync_settings SET lease_owner=$1,lease_until=now()+interval '2 minutes' WHERE id=true AND (lease_until IS NULL OR lease_until<now()) RETURNING automation_enabled",
    [owner],
  );
  if (!lease.length) throw new CuratorInputError('A catalog sync is already running.');
  const mode =
    options.mode === 'review' ? 'review' : lease[0].automation_enabled ? 'mixed' : 'review';
  let run: Run | undefined;
  const began = Date.now();
  const maxItems = options.maxItems ?? 10000;
  const maxMilliseconds = options.maxMilliseconds ?? 40 * 60 * 1000;
  let processed = 0;
  async function heartbeat() {
    const renewed = await query(
      "UPDATE sync_settings SET lease_until=now()+interval '2 minutes' WHERE id=true AND lease_owner=$1 RETURNING id",
      [owner],
    );
    if (!renewed.length) throw new CuratorInputError('Catalog sync lease expired.');
  }
  try {
    run = (
      await query<Run>(
        "SELECT * FROM sync_runs WHERE status IN ('running','paused','failed') AND mode=$1 ORDER BY started_at DESC LIMIT 1",
        [mode],
      )
    )[0];
    if (!run)
      run = (await query<Run>('INSERT INTO sync_runs(mode) VALUES($1) RETURNING *', [mode]))[0];
    await query("UPDATE sync_runs SET status='running',error=NULL,updated_at=now() WHERE id=$1", [
      run.id,
    ]);
    while (!run.discovery_complete && Date.now() - began < maxMilliseconds) {
      await heartbeat();
      const page = await client.page(run.next_page);
      if (page.next !== null && page.next <= run.next_page)
        throw new CuratorInputError('Genius returned an invalid pagination cursor.');
      await transaction(async (db) => {
        await db.query(
          'INSERT INTO sync_items(run_id,genius_id) SELECT $1,unnest($2::bigint[]) ON CONFLICT DO NOTHING',
          [run!.id, page.ids],
        );
        await db.query(
          'UPDATE sync_runs SET next_page=$2,discovery_complete=$3,updated_at=now() WHERE id=$1',
          [run!.id, page.next ?? run!.next_page, !page.next],
        );
        if (!page.next)
          await db.query(
            'INSERT INTO sync_items(run_id,genius_id) SELECT $1,genius_id FROM source_songs WHERE track_id IS NOT NULL ON CONFLICT DO NOTHING',
            [run!.id],
          );
      });
      run.next_page = page.next ?? run.next_page;
      run.discovery_complete = !page.next;
    }
    while (run.discovery_complete && processed < maxItems && Date.now() - began < maxMilliseconds) {
      const items = await query<{ genius_id: number }>(
        'SELECT genius_id FROM sync_items WHERE run_id=$1 AND NOT done ORDER BY genius_id LIMIT 5',
        [run.id],
      );
      if (!items.length) {
        await query(
          "UPDATE sync_runs SET status='complete',updated_at=now(),completed_at=now(),error=NULL WHERE id=$1",
          [run.id],
        );
        return { id: run.id, status: 'complete', processed };
      }
      await heartbeat();
      const details = await Promise.allSettled(
        items.map((item) => client.detail(Number(item.genius_id))),
      );
      const available = details.slice(0, Math.min(items.length, maxItems - processed));
      const firstFailure = available.findIndex((detail) => detail.status === 'rejected');
      const prefix = firstFailure < 0 ? available : available.slice(0, firstFailure);
      const held = await refreshHeldSources(
        prefix.flatMap((detail) => (detail.status === 'fulfilled' ? [detail.value] : [])),
      );
      if (held.size) {
        await query(
          `WITH done AS (UPDATE sync_items SET done=true WHERE run_id=$1 AND genius_id=ANY($2::bigint[]) AND NOT done RETURNING genius_id)
          UPDATE sync_runs SET checked=checked+(SELECT count(*) FROM done),updated_at=now() WHERE id=$1`,
          [run.id, [...held]],
        );
        processed += held.size;
      }
      for (const [index, item] of items.entries()) {
        if (held.has(Number(item.genius_id))) continue;
        if (processed >= maxItems || Date.now() - began >= maxMilliseconds) break;
        await heartbeat();
        try {
          const detail = details[index];
          if (detail.status === 'rejected') throw detail.reason;
          await processSource(detail.value, run.mode);
        } catch (error) {
          if (error instanceof GeniusError && error.status === 404)
            await sourceMissing(Number(item.genius_id));
          else throw error;
        }
        await query(
          `WITH done AS (UPDATE sync_items SET done=true WHERE run_id=$1 AND genius_id=$2 AND NOT done RETURNING genius_id)
          UPDATE sync_runs SET checked=checked+(SELECT count(*) FROM done),updated_at=now() WHERE id=$1`,
          [run.id, item.genius_id],
        );
        processed++;
      }
    }
    await query(
      "UPDATE sync_runs SET status='paused',updated_at=now(),error='Paused at the worker time or item limit; the next run resumes this checkpoint.' WHERE id=$1",
      [run.id],
    );
    return { id: run.id, status: 'paused', processed };
  } catch (error) {
    if (run)
      await query("UPDATE sync_runs SET status='failed',updated_at=now(),error=$2 WHERE id=$1", [
        run.id,
        error instanceof GeniusError
          ? error.message
          : 'Sync interrupted. Retry to resume the saved checkpoint.',
      ]);
    throw new CuratorInputError(
      error instanceof GeniusError
        ? error.message
        : 'Catalog sync interrupted. Resume from the studio or workflow.',
    );
  } finally {
    await query(
      'UPDATE sync_settings SET lease_owner=NULL,lease_until=NULL WHERE id=true AND lease_owner=$1',
      [owner],
    );
  }
}
