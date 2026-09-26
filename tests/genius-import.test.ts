import { test } from 'node:test';
import assert from 'node:assert/strict';
import additions from '../data/genius-catalog.json';
import report from '../data/genius-import-report.json';
import original from '../data/catalog.json';
import {
  titleKey,
  versionKey,
  alternateKey,
  exclusion,
  type GeniusEntry,
} from '../src/lib/genius-import';
import { trackId, spotifyId } from '../src/lib/track-identity';
import { getTrack, searchTracks, related, graph } from '../src/lib/catalog';
import { database, query } from '../src/lib/db';
import { seed } from '../src/lib/seed';

test('full Genius snapshot is accounted for and imports unique, source-attributed recordings', () => {
  assert.equal(report.source_entries, report.decisions.length);
  assert.equal(new Set(report.decisions.map((d) => d.genius_id)).size, report.source_entries);
  assert.equal(report.seed_tracks, additions.tracks.length);
  const names = new Set(original.tracks.map((t) => titleKey(t.title)));
  for (const t of additions.tracks) {
    assert.ok(trackId.safeParse(t.id).success);
    assert.equal(spotifyId({ id: t.id }), null);
    assert.ok(!names.has(titleKey(t.title)), t.title);
    names.add(titleKey(t.title));
    assert.match(t.raw.genius_url, /^https:\/\/genius.com\//);
    assert.equal(t.energy, null);
    assert.equal(t.explicit, null);
    assert.ok(t.artist_ids.includes('drake'), t.title);
    assert.ok(!/\b(clean version|instrumental|mixed|sped up)\b/i.test(t.title));
  }
  assert.equal(titleKey('Marvin’s Room (feat. Drake)'), titleKey("Marvin's Room"));
  assert.equal(versionKey('One Dance (Radio Edit)'), titleKey('One Dance'));
  assert.equal(titleKey('F*****g Fans'), titleKey('Fucking Fans'));
  assert.equal(titleKey("F**kin' Problems"), titleKey('Fuckin’ Problems'));
  assert.equal(versionKey('Trust Issues (Remix) [Demo]'), titleKey('Trust Issues'));
  assert.equal(alternateKey('Desires (Demo)'), titleKey('Desires'));
  const base: GeniusEntry = {
    id: 1,
    title: 'A song',
    url: 'https://genius.com/a-lyrics',
    primary_artist: { id: 130, name: 'Drake' },
    primary_artists: [],
    featured_artists: [],
    release_date: null,
    song_art_image_url: null,
    album: null,
    media: [],
    apple_music_id: null,
    relationships: [],
  };
  assert.equal(
    exclusion({ ...base, title: 'A song (Clean Version)' }),
    'Clean or alternate playback version',
  );
  assert.equal(
    exclusion({ ...base, primary_artist: { id: 2, name: 'Someone else' } }),
    'No Drake performer credit',
  );
});

test('new identifiers work in search, favorites, graphs, and recommendations without fabricated audio data', async () => {
  const t = await getTrack(additions.tracks[0].id);
  assert.ok(t);
  assert.equal(t.bpm, null);
  assert.ok(t.genius_url);
  const result = await searchTracks({ ids: t.id });
  assert.equal(result.tracks[0].id, t.id);
  assert.equal((await searchTracks({ ids: t.id, clean: 'true' })).total, 0);
  assert.equal((await searchTracks({ ids: t.id, mood: 'night' })).total, 0);
  const recs = await related(t.id);
  assert.ok(
    recs.every(
      (r) =>
        Number.isFinite(r.score) && !r.reason.includes('energy') && !r.reason.includes('rhythm'),
    ),
  );
  const last = additions.tracks.filter((t) => t.release_id === 'genius-unassigned').at(-1)!;
  const map = await graph('track:' + last.id);
  assert.ok(map.nodes.some((n) => n.id === 'track:' + last.id));
  assert.ok(
    map.edges.every(
      (e) => map.nodes.some((n) => n.id === e.source) && map.nodes.some((n) => n.id === e.target),
    ),
  );
  const before = await query<{ count: number }>('SELECT count(*)::int count FROM tracks');
  await seed(await database());
  assert.deepEqual(await query('SELECT count(*)::int count FROM tracks'), before);
});

test('Genius metadata repair unwraps only imported JSON and is repeatable', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { readFile } = await import('node:fs/promises');
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE tracks (id text PRIMARY KEY, raw jsonb NOT NULL)');
    const metadata = { genius_id: 123, genius_url: 'https://genius.com/example-lyrics' };
    const encoded = JSON.stringify(JSON.stringify(metadata));
    await db.query('INSERT INTO tracks VALUES ($1,$2::jsonb),($3,$2::jsonb)', [
      'genius-123',
      encoded,
      'original',
    ]);
    const migration = await readFile('supabase/migrations/004_genius_metadata.sql', 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    const rows = (
      await db.query<{ id: string; raw: unknown }>('SELECT id,raw FROM tracks ORDER BY id')
    ).rows;
    assert.deepEqual(rows[0].raw, metadata);
    assert.equal(rows[1].raw, JSON.stringify(metadata));
  } finally {
    await db.close();
  }
});
