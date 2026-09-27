import { CuratorInputError } from './curator-error';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { query, transaction } from './db';
import type { Database } from './seed';
import { titleKey, alternateKey, versionKey, exclusion, type GeniusEntry } from './genius-import';
import { trackId } from './track-identity';
export function sourceURL(value: string | null | undefined, artwork = false): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      (artwork
        ? ['images.genius.com', 'images.rapgenius.com'].includes(u.hostname)
        : u.hostname === 'genius.com')
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function spotifyMedia(entry: GeniusEntry) {
  for (const media of entry.media) {
    try {
      const u = new URL(media.url);
      const id = u.pathname.match(/^\/track\/([a-zA-Z0-9]{22})\/?$/)?.[1];
      if (
        media.provider === 'spotify' &&
        u.protocol === 'https:' &&
        u.hostname === 'open.spotify.com' &&
        id
      )
        return id;
    } catch {
      /* Invalid metadata is never published. */
    }
  }
  return null;
}
export function performers(entry: GeniusEntry) {
  return [
    ...new Map(
      [...entry.primary_artists, entry.primary_artist, ...entry.featured_artists].map((a) => [
        a.id,
        a,
      ]),
    ).values(),
  ].sort((a, b) => a.id - b.id);
}
export function materialHash(entry: GeniusEntry) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        title: entry.title,
        artists: performers(entry),
        date: entry.release_date,
        album: entry.album ? { id: entry.album.id, name: entry.album.name } : null,
        spotify: spotifyMedia(entry),
        relationships: entry.relationships.filter((r) => r.type === 'translation_of'),
      }),
    )
    .digest('hex');
}
export type ChangePayload = {
  title: string;
  source: GeniusEntry | null;
  changes: Record<string, { before: unknown; after: unknown }>;
  candidates: { id: string; title: string }[];
  reason: string;
};
type SourceRow = {
  genius_id: number;
  track_id: string | null;
  content_hash: string | null;
  decision: string;
  decision_hash: string | null;
  snapshot: GeniusEntry | null;
};
async function lock(db: Database) {
  await db.query('SELECT id FROM catalog_write_lock WHERE id=true FOR UPDATE');
}
async function proposal(
  db: Database,
  id: number,
  hash: string,
  kind: string,
  track: string | null,
  payload: ChangePayload,
) {
  await db.query(
    "UPDATE source_changes SET status='superseded',decided_at=now() WHERE genius_id=$1 AND status='pending' AND content_hash<>$2",
    [id, hash],
  );
  await db.query(
    "INSERT INTO source_changes(genius_id,content_hash,kind,track_id,payload) VALUES($1,$2,$3,$4,$5::text::jsonb) ON CONFLICT(genius_id,content_hash,kind) DO UPDATE SET payload=EXCLUDED.payload,track_id=EXCLUDED.track_id,status='pending',decided_at=NULL,decided_by=NULL WHERE source_changes.status IN ('pending','superseded')",
    [id, hash, kind, track, JSON.stringify(payload)],
  );
}
// Refresh unchanged, unlinked exclusions in one transaction. No public fields are touched.
// Duplicates with Spotify IDs still take the full review path so identity links can be proposed.
export async function refreshHeldSources(entries: GeniusEntry[]) {
  if (!entries.length) return new Set<number>();
  return transaction(async (db) => {
    await lock(db);
    const rows = await db.query<{ genius_id: number }>(
      `
      UPDATE source_songs s SET snapshot=x.snapshot, content_hash=x.hash, checked_at=now(), missing=false
      FROM jsonb_to_recordset($1::text::jsonb) AS x(id bigint,hash text,snapshot jsonb,spotify boolean)
      WHERE s.genius_id=x.id AND s.track_id IS NULL AND s.decision_hash=x.hash
        AND (s.decision IN ('excluded','rejected') OR (s.decision='duplicate' AND NOT x.spotify))
      RETURNING s.genius_id`,
      [
        JSON.stringify(
          entries.map((entry) => ({
            id: entry.id,
            hash: materialHash(entry),
            snapshot: entry,
            spotify: Boolean(spotifyMedia(entry)),
          })),
        ),
      ],
    );
    return new Set(rows.rows.map((row) => Number(row.genius_id)));
  });
}
export async function processSource(entry: GeniusEntry, mode: 'review' | 'mixed') {
  const hash = materialHash(entry);
  return transaction(async (db) => {
    await lock(db);
    await db.query('INSERT INTO source_songs(genius_id) VALUES($1) ON CONFLICT DO NOTHING', [
      entry.id,
    ]);
    const previous = (
      await db.query<SourceRow>('SELECT * FROM source_songs WHERE genius_id=$1 FOR UPDATE', [
        entry.id,
      ])
    ).rows[0];
    await db.query(
      'UPDATE source_songs SET snapshot=$2::text::jsonb,content_hash=$3,checked_at=now(),missing=false WHERE genius_id=$1',
      [entry.id, JSON.stringify(entry), hash],
    );
    const excluded = exclusion(entry);
    if (!previous.track_id && excluded) {
      await db.query(
        "UPDATE source_songs SET decision='excluded',decision_hash=$2,decision_reason=$3 WHERE genius_id=$1",
        [entry.id, hash, excluded],
      );
      await db.query(
        "UPDATE source_changes SET status='superseded',decided_at=now() WHERE genius_id=$1 AND status='pending'",
        [entry.id],
      );
      return 'excluded';
    }
    if (!previous.track_id) {
      // Historical duplicates stay excluded from import, but exact Spotify identifiers can
      // propose a source link for a still-unlinked original recording. Approval remains required.
      const externalSpotify = spotifyMedia(entry);
      if (previous.decision === 'duplicate' && externalSpotify) {
        const matches = (
          await db.query<{ id: string; title: string }>(
            `SELECT t.id,t.title FROM tracks t WHERE (t.id=$1 OR t.raw->>'spotify_id'=$1) AND NOT EXISTS(SELECT 1 FROM source_songs s WHERE s.track_id=t.id)`,
            [externalSpotify],
          )
        ).rows;
        if (matches.length) {
          await proposal(db, entry.id, hash, 'link', null, {
            title: entry.title,
            source: entry,
            changes: {},
            candidates: matches,
            reason:
              'Existing duplicate recording with the same Spotify identifier. Confirm the source link; no new song will be added.',
          });
          return 'proposed';
        }
      }
      // A historical exclusion adopts its first available baseline; unchanged rejected entries stay closed.
      if (
        ['excluded', 'rejected', 'duplicate'].includes(previous.decision) &&
        !previous.decision_hash
      ) {
        await db.query('UPDATE source_songs SET decision_hash=$2 WHERE genius_id=$1', [
          entry.id,
          hash,
        ]);
        return 'held';
      }
      if (
        ['excluded', 'rejected', 'duplicate'].includes(previous.decision) &&
        previous.decision_hash === hash
      )
        return 'held';
      const tracks = (
        await db.query<{
          id: string;
          title: string;
          raw: Record<string, unknown>;
          linked: boolean;
        }>(
          'SELECT t.id,t.title,t.raw,EXISTS(SELECT 1 FROM source_songs s WHERE s.track_id=t.id) AS linked FROM tracks t',
        )
      ).rows;
      const spotify = spotifyMedia(entry);
      const matches = tracks.filter(
        (t) =>
          [titleKey(entry.title), alternateKey(entry.title), versionKey(entry.title)].includes(
            titleKey(t.title),
          ) || Boolean(spotify && (t.id === spotify || t.raw.spotify_id === spotify)),
      );
      const candidates = matches.filter((t) => !t.linked).map(({ id, title }) => ({ id, title }));
      if (matches.length && !candidates.length) {
        await db.query(
          "UPDATE source_songs SET decision='duplicate',decision_hash=$2,decision_reason='Matching recordings already have linked Genius sources.' WHERE genius_id=$1",
          [entry.id, hash],
        );
        await db.query(
          "UPDATE source_changes SET status='superseded',decided_at=now() WHERE genius_id=$1 AND status='pending'",
          [entry.id],
        );
        return 'held';
      }
      await proposal(db, entry.id, hash, candidates.length ? 'link' : 'new', null, {
        title: entry.title,
        source: entry,
        changes: {},
        candidates,
        reason: candidates.length
          ? 'Possible duplicate or source match. Confirm the recording identity before linking.'
          : 'New source entry; confirm that it is a Drake performance and review its recording context.',
      });
      return 'proposed';
    }
    const track = (
      await db.query<{
        id: string;
        title: string;
        release_id: string;
        raw: Record<string, unknown>;
      }>('SELECT id,title,release_id,raw FROM tracks WHERE id=$1', [previous.track_id])
    ).rows[0];
    if (!track) return 'held';
    if (excluded) {
      await proposal(db, entry.id, hash, 'unavailable', track.id, {
        title: track.title,
        source: entry,
        changes: { source_available: { before: track.raw.source_available ?? true, after: false } },
        candidates: [],
        reason: excluded,
      });
      return 'proposed';
    }
    const overrides = (
      await db.query<{ kind: string; entity_id: string; field: string }>(
        'SELECT kind,entity_id,field FROM field_overrides WHERE (kind=$1 AND entity_id=$2) OR (kind=$3 AND entity_id=$4)',
        ['tracks', track.id, 'releases', track.release_id],
      )
    ).rows;
    const blocked = (kind: string, entity: string, field: string) =>
      overrides.some((o) => o.kind === kind && o.entity_id === entity && o.field === field);
    const automation = (
      await db.query<{ automation_enabled: boolean }>(
        'SELECT automation_enabled FROM sync_settings WHERE id=true',
      )
    ).rows[0]?.automation_enabled;
    if (mode === 'mixed' && automation) {
      const raw = { ...track.raw };
      const url = sourceURL(entry.url);
      const artwork = sourceURL(entry.song_art_image_url, true);
      if (url && !blocked('tracks', track.id, 'genius_url')) raw.genius_url = url;
      if (artwork && !blocked('tracks', track.id, 'source_cover_url'))
        raw.source_cover_url = artwork;
      if (JSON.stringify(raw) !== JSON.stringify(track.raw))
        await db.query('UPDATE tracks SET raw=$2::text::jsonb WHERE id=$1', [
          track.id,
          JSON.stringify(raw),
        ]);
      // Only exact Genius album IDs establish automatic artwork ownership.
      const cover = sourceURL(entry.album?.cover_art_url, true);
      if (
        cover &&
        entry.album &&
        track.release_id === `genius-album-${entry.album.id}` &&
        !blocked('releases', track.release_id, 'cover_url')
      )
        await db.query('UPDATE releases SET cover_url=$2 WHERE id=$1', [track.release_id, cover]);
    }
    if (previous.decision_hash === hash && ['rejected', 'accepted'].includes(previous.decision))
      return 'unchanged';
    const changes: ChangePayload['changes'] = {};
    if (entry.album?.name && track.release_id === `genius-album-${entry.album.id}`) {
      const release = (
        await db.query<{ title: string }>('SELECT title FROM releases WHERE id=$1', [
          track.release_id,
        ])
      ).rows[0];
      if (release && release.title !== entry.album.name)
        changes.release_title = { before: release.title, after: entry.album.name };
    }
    if (track.title !== entry.title) changes.title = { before: track.title, after: entry.title };
    if (entry.release_date && entry.release_date !== track.raw.source_release_date)
      changes.source_release_date = {
        before: track.raw.source_release_date ?? null,
        after: entry.release_date,
      };
    const spotify = spotifyMedia(entry);
    const oldSpotify =
      track.raw.spotify_id || (/^[a-zA-Z0-9]{22}$/.test(track.id) ? track.id : null);
    if (spotify && spotify !== oldSpotify)
      changes.spotify_id = { before: oldSpotify ?? null, after: spotify };
    if (
      entry.album &&
      track.release_id !== `genius-album-${entry.album.id}` &&
      (!previous.snapshot || entry.album.id !== previous.snapshot.album?.id)
    )
      changes.release_id = { before: track.release_id, after: `genius-album-${entry.album.id}` };
    const credits = (
      await db.query<{ name: string }>(
        'SELECT a.name FROM artists a JOIN track_artists ta ON ta.artist_id=a.id WHERE ta.track_id=$1 ORDER BY a.name',
        [track.id],
      )
    ).rows.map((a) => a.name);
    const names = performers(entry).map((a) => a.name);
    if (JSON.stringify(credits.map(titleKey).sort()) !== JSON.stringify(names.map(titleKey).sort()))
      changes.credits = { before: credits, after: names };
    if (track.raw.source_available === false)
      changes.source_available = { before: false, after: true };
    if (Object.keys(changes).length)
      await proposal(db, entry.id, hash, 'metadata', track.id, {
        title: track.title,
        source: entry,
        changes,
        candidates: [],
        reason:
          'Review changes against the current published recording. Curator overrides are never overwritten automatically.',
      });
    else
      await db.query(
        "UPDATE source_changes SET status='superseded',decided_at=now() WHERE genius_id=$1 AND status='pending'",
        [entry.id],
      );
    return Object.keys(changes).length ? 'proposed' : 'unchanged';
  });
}
export async function sourceMissing(id: number) {
  return transaction(async (db) => {
    await lock(db);
    const source = (
      await db.query<SourceRow>('SELECT * FROM source_songs WHERE genius_id=$1', [id])
    ).rows[0];
    if (!source?.track_id) return;
    await db.query('UPDATE source_songs SET checked_at=now(),missing=true WHERE genius_id=$1', [
      id,
    ]);
    await proposal(
      db,
      id,
      'missing-' + (source.content_hash || 'unknown'),
      'unavailable',
      source.track_id,
      {
        title: source.snapshot?.title || source.track_id,
        source: null,
        changes: { source_available: { before: true, after: false } },
        candidates: [],
        reason:
          'Genius returned 404. The recording is retained; approval marks its source unavailable.',
      },
    );
  });
}
async function ensureRelease(db: Database, entry: GeniusEntry) {
  const id = entry.album ? `genius-album-${entry.album.id}` : 'genius-unassigned';
  await db.query(
    "INSERT INTO releases(id,title,release_date,cover_url,featured) VALUES($1,$2,'',$3,false) ON CONFLICT DO NOTHING",
    [
      id,
      entry.album?.name || 'Singles & unassigned recordings',
      sourceURL(entry.album?.cover_art_url, true),
    ],
  );
  return id;
}
async function writeCredits(db: Database, track: string, entry: GeniusEntry) {
  const existing = (await db.query<{ id: string; name: string }>('SELECT id,name FROM artists'))
    .rows;
  await db.query('DELETE FROM track_artists WHERE track_id=$1', [track]);
  for (const [position, a] of performers(entry).entries()) {
    const id =
      a.id === 130
        ? 'drake'
        : existing.find((e) => titleKey(e.name) === titleKey(a.name))?.id ||
          `genius-artist-${a.id}`;
    await db.query('INSERT INTO artists(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING', [
      id,
      a.name,
    ]);
    await db.query(
      'INSERT INTO track_artists(track_id,artist_id,position) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [track, id, position],
    );
  }
}
export const reviewRequest = z.object({
  id: z.uuid(),
  action: z.enum(['approve', 'reject']),
  target: trackId.optional(),
  fields: z
    .array(
      z.enum([
        'title',
        'source_release_date',
        'release_id',
        'release_title',
        'spotify_id',
        'credits',
        'source_available',
      ]),
    )
    .max(7)
    .default([]),
});
export async function reviewChange(input: unknown, actor: string) {
  const request = reviewRequest.parse(input);
  return transaction(async (db) => {
    await lock(db);
    const row = (
      await db.query<{
        id: string;
        genius_id: number;
        content_hash: string;
        track_id: string | null;
        kind: string;
        status: string;
        payload: ChangePayload;
      }>('SELECT * FROM source_changes WHERE id=$1 FOR UPDATE', [request.id])
    ).rows[0];
    if (!row || row.status !== 'pending')
      throw new CuratorInputError('This change is no longer pending. Refresh the queue.');
    const source = (
      await db.query<SourceRow & { missing: boolean }>(
        'SELECT * FROM source_songs WHERE genius_id=$1',
        [row.genius_id],
      )
    ).rows[0];
    if (
      row.kind === 'unavailable' && !row.payload.source
        ? !source.missing
        : source.content_hash !== row.content_hash
    )
      throw new CuratorInputError('Source changed. Refresh the queue.');
    if (request.action === 'reject') {
      await db.query(
        "UPDATE source_songs SET decision='rejected',decision_hash=$2 WHERE genius_id=$1",
        [row.genius_id, row.content_hash],
      );
    } else {
      const entry = row.payload.source;
      let target = row.track_id;
      if (row.kind === 'link') {
        if (!request.target || !row.payload.candidates.some((c) => c.id === request.target))
          throw new CuratorInputError('Choose a reviewed candidate.');
        target = request.target;
        if (
          (
            await db.query(
              'SELECT genius_id FROM source_songs WHERE track_id=$1 AND genius_id<>$2',
              [target, row.genius_id],
            )
          ).rows.length
        )
          throw new CuratorInputError(
            'This recording already has a linked Genius source. Reject this duplicate proposal.',
          );
        if (!(await db.query('SELECT id FROM tracks WHERE id=$1', [target])).rows.length)
          throw new CuratorInputError('Recording no longer exists');
        await db.query('UPDATE source_songs SET track_id=$2 WHERE genius_id=$1', [
          row.genius_id,
          target,
        ]);
        // Linking establishes identity only. Metadata changes are reviewed on the next refresh.
      } else if (row.kind === 'new') {
        if (!entry || exclusion(entry))
          throw new CuratorInputError('Excluded source cannot be imported.');
        const all = (await db.query<{ id: string; title: string }>('SELECT id,title FROM tracks'))
          .rows;
        if (
          all.some((t) =>
            [titleKey(entry.title), alternateKey(entry.title), versionKey(entry.title)].includes(
              titleKey(t.title),
            ),
          )
        )
          throw new CuratorInputError(
            'A matching title has since been added. Refresh before importing.',
          );
        const release = await ensureRelease(db, entry);
        target = `genius-${entry.id}`;
        const raw = {
          source: 'genius',
          genius_id: entry.id,
          genius_url: sourceURL(entry.url),
          source_cover_url: sourceURL(entry.song_art_image_url, true),
          source_album: entry.album,
          source_release_date: entry.release_date,
          spotify_id: spotifyMedia(entry),
        };
        await db.query(
          'INSERT INTO tracks(id,title,release_id,rank,raw) VALUES($1,$2,$3,(SELECT coalesce(max(rank),0)+1 FROM tracks),$4::text::jsonb)',
          [target, entry.title, release, JSON.stringify(raw)],
        );
        await writeCredits(db, target, entry);
        await db.query('UPDATE source_songs SET track_id=$2 WHERE genius_id=$1', [
          row.genius_id,
          target,
        ]);
      } else {
        if (
          !target ||
          !request.fields.length ||
          request.fields.some((f) => !row.payload.changes[f])
        )
          throw new CuratorInputError('Select the proposed fields to publish.');
        const track = (
          await db.query<{ title: string; release_id: string; raw: Record<string, unknown> }>(
            'SELECT title,release_id,raw FROM tracks WHERE id=$1',
            [target],
          )
        ).rows[0];
        if (!track) throw new CuratorInputError('Recording no longer exists');
        const raw = { ...track.raw };
        for (const field of request.fields) {
          const change = row.payload.changes[field];
          let current: unknown =
            field === 'title'
              ? track.title
              : field === 'release_id'
                ? track.release_id
                : field === 'spotify_id'
                  ? raw.spotify_id || (/^[a-zA-Z0-9]{22}$/.test(target) ? target : null)
                  : field === 'source_available'
                    ? (raw.source_available ?? true)
                    : (raw[field] ?? null);
          if (field === 'release_title')
            current = (
              await db.query<{ title: string }>('SELECT title FROM releases WHERE id=$1', [
                track.release_id,
              ])
            ).rows[0]?.title;
          if (field === 'credits')
            current = (
              await db.query<{ name: string }>(
                'SELECT a.name FROM artists a JOIN track_artists ta ON ta.artist_id=a.id WHERE ta.track_id=$1 ORDER BY a.name',
                [target],
              )
            ).rows.map((a) => a.name);
          if (JSON.stringify(current) !== JSON.stringify(change.before))
            throw new CuratorInputError(
              'Published metadata changed since this proposal. Refresh before approving.',
            );
          if (field === 'title')
            await db.query('UPDATE tracks SET title=$2 WHERE id=$1', [target, change.after]);
          else if (field === 'release_id' && entry)
            await db.query('UPDATE tracks SET release_id=$2 WHERE id=$1', [
              target,
              await ensureRelease(db, entry),
            ]);
          else if (field === 'release_title')
            await db.query('UPDATE releases SET title=$2 WHERE id=$1', [
              track.release_id,
              change.after,
            ]);
          else if (field === 'credits' && entry) await writeCredits(db, target, entry);
          else raw[field] = change.after;
          await db.query(
            'INSERT INTO field_overrides(kind,entity_id,field,value) VALUES($1,$2,$3,$4::text::jsonb) ON CONFLICT(kind,entity_id,field) DO UPDATE SET value=EXCLUDED.value,updated_at=now()',
            [
              field === 'release_title' ? 'releases' : 'tracks',
              field === 'release_title' ? track.release_id : target,
              field === 'release_title' ? 'title' : field,
              JSON.stringify(change.after),
            ],
          );
        }
        await db.query('UPDATE tracks SET raw=$2::text::jsonb WHERE id=$1', [
          target,
          JSON.stringify(raw),
        ]);
      }
      // A newly linked source must still propose its metadata differences on the next run.
      await db.query('UPDATE source_songs SET decision=$2,decision_hash=$3 WHERE genius_id=$1', [
        row.genius_id,
        row.kind === 'link' ? 'linked' : 'accepted',
        row.kind === 'link' ? null : row.content_hash,
      ]);
      if (target)
        await db.query(
          "UPDATE tracks t SET search_document=to_tsvector('simple',t.title || ' ' || (SELECT title FROM releases WHERE id=t.release_id) || ' ' || coalesce((SELECT string_agg(a.name,' ') FROM artists a JOIN track_artists ta ON a.id=ta.artist_id WHERE ta.track_id=t.id),'')) WHERE t.id=$1 OR t.release_id=(SELECT release_id FROM tracks WHERE id=$1)",
          [target],
        );
    }
    await db.query(
      'UPDATE source_changes SET status=$2,decided_by=$3,decided_at=now() WHERE id=$1',
      [row.id, request.action === 'approve' ? 'approved' : 'rejected', actor],
    );
    return { id: row.id };
  });
}
