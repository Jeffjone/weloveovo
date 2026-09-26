import original from '../../data/catalog.json';
import additions from '../../data/genius-catalog.json';
const catalog = {
  ...original,
  releases: [...original.releases, ...additions.releases],
  artists: [...original.artists, ...additions.artists],
  tracks: [...original.tracks, ...additions.tracks],
};
export type Database = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(text: string): Promise<unknown>;
};
export async function seed(db: Database, progress: (message: string) => void = () => {}) {
  return seedCatalog(db, catalog, progress);
}
export async function seedCatalog(
  db: Database,
  data: {
    releases: object[];
    artists: object[];
    tracks: object[];
    eras?: object[];
    milestones?: object[];
  },
  progress: (message: string) => void = () => {},
) {
  await db.exec('BEGIN');
  try {
    for (const table of ['releases', 'artists', 'tracks', 'eras', 'milestones'] as const) {
      let completed = 0;
      progress(`Importing ${(data[table] || []).length} ${table}…`);
      for (const record of data[table] || []) {
        const row = { ...record } as Record<string, unknown>;
        const artistIds = row.artist_ids as string[] | undefined;
        delete row.artist_ids;
        const keys = Object.keys(row);
        await db.query(
          `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')}) ON CONFLICT (id) DO NOTHING`,
          keys.map((k) => (k === 'raw' ? JSON.stringify(row[k]) : row[k])),
        );
        if (artistIds)
          for (let i = 0; i < artistIds.length; i++)
            await db.query(
              'INSERT INTO track_artists(track_id,artist_id,position) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
              [row.id, artistIds[i], i],
            );
        completed++;
        if (completed % 25 === 0 || completed === (data[table] || []).length)
          progress(`${table}: ${completed}/${(data[table] || []).length}`);
      }
    }
    progress('Updating search index…');
    await db.exec(
      "UPDATE tracks t SET search_document=to_tsvector('simple',t.title || ' ' || (SELECT title FROM releases WHERE id=t.release_id) || ' ' || coalesce((SELECT string_agg(a.name,' ') FROM artists a JOIN track_artists ta ON a.id=ta.artist_id WHERE ta.track_id=t.id),''))",
    );
    progress('Committing catalog…');
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}
