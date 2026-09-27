import { readFile } from 'node:fs/promises';
import audit from '../../reports/genius/import-audit.json';
import { query, transaction } from './db';
import { materialHash } from './catalog-sync';
import type { GeniusEntry } from './genius-import';
export async function bootstrapSync() {
  if (
    (
      await query<{ initialized: boolean }>('SELECT initialized FROM sync_settings WHERE id=true')
    )[0]?.initialized
  )
    return;
  const entries: {
    genius_id: number;
    decision: string;
    decision_hash: string | null;
    decision_reason: string;
    snapshot: GeniusEntry | null;
  }[] = [];
  for (const decision of audit.decisions) {
    let snapshot: GeniusEntry | null = null;
    try {
      snapshot = JSON.parse(
        await readFile(`.data/genius/song-${decision.genius_id}.json`, 'utf8'),
      ) as GeniusEntry;
    } catch {
      /* Historical reports still preserve decisions without local snapshots. */
    }
    let hash: string | null = null;
    try {
      if (snapshot) hash = materialHash(snapshot);
    } catch {
      snapshot = null;
    }
    entries.push({
      genius_id: decision.genius_id,
      decision:
        decision.action === 'excluded'
          ? 'excluded'
          : decision.action === 'duplicate'
            ? 'duplicate'
            : 'review',
      decision_hash: hash,
      decision_reason: decision.reason,
      snapshot,
    });
  }
  await transaction(async (db) => {
    await db.query('SELECT id FROM catalog_write_lock WHERE id=true FOR UPDATE');
    if (
      (
        await db.query<{ initialized: boolean }>(
          'SELECT initialized FROM sync_settings WHERE id=true',
        )
      ).rows[0]?.initialized
    )
      return;
    for (let i = 0; i < entries.length; i += 100)
      await db.query(
        `INSERT INTO source_songs(genius_id,decision,decision_hash,decision_reason,snapshot)
   SELECT genius_id,decision,decision_hash,decision_reason,snapshot FROM jsonb_to_recordset($1::text::jsonb) AS x(genius_id bigint,decision text,decision_hash text,decision_reason text,snapshot jsonb)
   ON CONFLICT(genius_id) DO UPDATE SET snapshot=coalesce(source_songs.snapshot,EXCLUDED.snapshot),decision_reason=coalesce(source_songs.decision_reason,EXCLUDED.decision_reason)`,
        [JSON.stringify(entries.slice(i, i + 100))],
      );
    await db.query('UPDATE sync_settings SET initialized=true WHERE id=true');
  });
  console.log('Historical review decisions retained in PostgreSQL.');
}
