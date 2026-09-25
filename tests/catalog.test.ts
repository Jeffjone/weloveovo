import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { database, query } from '../src/lib/db';
import {
  searchTracks,
  getTrack,
  releases,
  eras,
  related,
  graph,
  searchSchema,
} from '../src/lib/catalog';
import { seed } from '../src/lib/seed';
import { saveContent } from '../src/lib/admin';
import { suggestTracks, uploadSchema, looksLikeMP3, safeFilename } from '../src/lib/audio';
import catalog from '../data/catalog.json';
const first = catalog.tracks[0];
test('all original music metadata is preserved in normalized PostgreSQL tables', async () => {
  const rows = await query<{ raw: unknown }>('SELECT raw FROM tracks ORDER BY rank');
  const original = JSON.parse(await readFile('data/tracks.json', 'utf8'));
  assert.deepEqual(
    rows.map((r) => r.raw),
    original,
  );
  assert.equal(rows.length, 414);
  assert.equal((await releases()).length, 117);
  assert.equal((await eras()).length, 6);
  assert.equal(
    Number((await query<{ count: string }>('SELECT count(*) FROM track_artists'))[0].count),
    catalog.tracks.reduce((n, t) => n + t.artist_ids.length, 0),
  );
});
test('search, partial matching, filtering, pagination and sorting are database backed', async () => {
  assert.equal((await searchTracks({ q: 'marvins roo' })).tracks[0].title, 'Marvins Room');
  const clean = await searchTracks({ clean: 'true', limit: 50 });
  assert.ok(clean.tracks.every((t) => !t.explicit));
  assert.equal(clean.total, 38);
  const all = await searchTracks();
  assert.equal(all.total, 414);
  assert.equal(all.tracks.length, 12);
  const second = await searchTracks({ page: 2 });
  assert.ok(!second.tracks.some((t) => all.tracks.some((a) => a.id === t.id)));
  const last = await searchTracks({ page: 999 });
  assert.equal(last.page, last.pages);
  assert.ok(last.tracks.length > 0);
  assert.equal((await searchTracks({ release: 'take-care-deluxe' })).total, 19);
  const combined = await searchTracks({
    release: 'take-care-deluxe',
    era: 'the-blue-hour',
    artist: 'drake',
    year: 2011,
    mood: 'night',
    sort: 'title',
    limit: 50,
  });
  assert.ok(combined.total > 0);
  assert.ok(
    combined.tracks.every(
      (t) =>
        t.release_id === 'take-care-deluxe' &&
        t.artist_ids.includes('drake') &&
        t.release_date.startsWith('2011') &&
        t.energy <= 50 &&
        t.valence <= 50,
    ),
  );
  assert.equal((await searchTracks({ ids: '' })).total, 0);
  assert.equal((await searchTracks({ ids: first.id })).total, 1);
  assert.ok(
    (await searchTracks({ artist: 'future' })).tracks.every((t) => t.artist_ids.includes('future')),
  );
  assert.ok(
    (await searchTracks({ era: 'the-blue-hour' })).tracks.every(
      (t) =>
        Number(t.release_date.slice(0, 4)) >= 2011 && Number(t.release_date.slice(0, 4)) <= 2013,
    ),
  );
  const sorted = await searchTracks({ sort: 'title', limit: 50 });
  assert.equal(sorted.tracks[0].title, '0 To 100 / The Catch Up');
  assert.equal((await searchTracks({ q: 'zzzz-no-such-song' })).total, 0);
  assert.equal((await searchTracks({ q: "' OR true; --" })).total, 0);
  for (const input of [
    { page: 0 },
    { page: 1.5 },
    { limit: 900 },
    { year: 100 },
    { sort: 'drop table' },
    { q: 'x'.repeat(121) },
    { ids: 'invalid-track-id' },
  ])
    assert.equal(searchSchema.safeParse(input).success, false);
});
test('mood queries and deterministic explanations produce relevant recommendations', async () => {
  assert.ok(
    (await searchTracks({ mood: 'night' })).tracks.every((t) => t.energy <= 50 && t.valence <= 50),
  );
  assert.ok(
    (await searchTracks({ mood: 'drive' })).tracks.every(
      (t) => t.dance >= 65 && t.energy >= 40 && t.energy <= 75,
    ),
  );
  assert.ok((await searchTracks({ mood: 'energy' })).tracks.every((t) => t.energy >= 70));
  const a = await related(first.id),
    b = await related(first.id);
  assert.deepEqual(a, b);
  assert.equal(a.length, 6);
  assert.ok(a.every((r) => r.track.id !== first.id && r.reason.length > 0));
  assert.equal(await getTrack('bad-id'), null);
});
test('connection graph expands chronologically through albums and credits', async () => {
  assert.equal((await graph()).nodes.length, 6);
  const chapter = await graph('era:the-blue-hour');
  assert.ok(chapter.nodes.some((n) => n.kind === 'release'));
  assert.ok(chapter.nodes.some((n) => n.kind === 'milestone'));
  const album = await graph('release:take-care-deluxe');
  assert.equal(album.nodes.filter((n) => n.kind === 'track').length, 19);
  const track = await graph('track:' + first.id);
  assert.ok(track.nodes.some((n) => n.kind === 'artist' && n.label === '21 Savage'));
  for (const map of [chapter, album, track])
    assert.ok(
      map.edges.every(
        (e) => map.nodes.some((n) => n.id === e.source) && map.nodes.some((n) => n.id === e.target),
      ),
    );
});
test('editorial drafts stay private and publication is explicit', async () => {
  const original = (await eras())[0];
  const changed = { ...original, title: 'A private draft title' };
  await saveContent({ kind: 'eras', action: 'draft', record: changed });
  assert.equal((await eras())[0].title, original.title);
  await saveContent({ kind: 'eras', action: 'publish', record: changed });
  assert.equal((await eras())[0].title, changed.title);
  await saveContent({ kind: 'eras', action: 'unpublish', record: changed });
  assert.ok(!(await eras()).some((e) => e.id === original.id));
  assert.ok(!(await graph()).nodes.some((n) => n.id === 'era:' + original.id));
  await saveContent({ kind: 'eras', action: 'publish', record: original });
  assert.equal((await eras())[0].title, original.title);
  const track = await getTrack(first.id);
  await saveContent({
    kind: 'tracks',
    action: 'save',
    record: { ...track, title: 'A test catalog edit' },
  });
  assert.equal((await getTrack(first.id))?.title, 'A test catalog edit');
  await seed(await database());
  assert.equal(
    (await getTrack(first.id))?.title,
    'A test catalog edit',
    'reimports preserve curator changes',
  );
  await saveContent({ kind: 'tracks', action: 'save', record: track });
  await assert.rejects(() =>
    saveContent({
      kind: 'milestones',
      action: 'publish',
      record: {
        id: 'invalid-source',
        title: 'x',
        body: 'x',
        year: 2020,
        era_id: original.id,
        source_url: 'javascript:alert(1)',
        published: true,
      },
    }),
  );
});
test('audio is never downloadable until verified and published', async () => {
  assert.equal((await getTrack(first.id))?.downloadable, false);
  const a = '9c4abf31-cdbe-44c6-aec9-8db773210001',
    b = '9c4abf31-cdbe-44c6-aec9-8db773210002';
  await query(
    "INSERT INTO audio_assets(id,track_id,object_path,filename,size_bytes) VALUES($1,$2,'test/a.mp3','a.mp3',1024)",
    [a, first.id],
  );
  await assert.rejects(() => query('SELECT publish_audio($1::uuid)', [a]));
  assert.equal((await getTrack(first.id))?.downloadable, false);
  await query("UPDATE audio_assets SET status='ready' WHERE id=$1", [a]);
  await query('SELECT publish_audio($1::uuid)', [a]);
  assert.equal((await getTrack(first.id))?.downloadable, true);
  await query(
    "INSERT INTO audio_assets(id,track_id,object_path,filename,size_bytes,status) VALUES($1,$2,'test/b.mp3','b.mp3',1024,'ready')",
    [b, first.id],
  );
  await query('SELECT publish_audio($1::uuid)', [b]);
  assert.equal(
    (
      await query("SELECT id FROM audio_assets WHERE track_id=$1 AND status='published'", [
        first.id,
      ])
    ).length,
    1,
  );
  await query('DELETE FROM audio_assets WHERE track_id=$1', [first.id]);
  assert.equal(
    uploadSchema.safeParse({ trackId: first.id, filename: 'fake.exe', size: 5000 }).success,
    false,
  );
  assert.equal(
    uploadSchema.safeParse({ trackId: first.id, filename: 'large.mp3', size: 200 * 1024 * 1024 })
      .success,
    false,
  );
  assert.equal(looksLikeMP3(new Uint8Array([73, 68, 51, 4])), true);
  assert.equal(looksLikeMP3(new TextEncoder().encode('<html>fake.mp3</html>')), false);
  assert.ok(!safeFilename('../unsafe:track').includes('/'));
  const tracks = [
    { id: first.id, title: 'Example' },
    { id: catalog.tracks[1].id, title: 'Example' },
  ];
  assert.equal(
    suggestTracks('Example.mp3', {}, tracks).length,
    2,
    'ambiguous matches require review',
  );
  assert.equal(suggestTracks(first.id + '.mp3', {}, tracks)[0].id, first.id);
  assert.equal(suggestTracks('unknown.mp3', {}, tracks).length, 0);
});

test('curated connections reveal related records but never draft milestones', async () => {
  const row = {
    source: 'era:the-introduction',
    target: 'release:scorpion',
    label: 'Follow the evolution',
    published: false,
  };
  const saved = await saveContent({ kind: 'connections', action: 'publish', record: row });
  const expanded = await graph(row.source);
  assert.ok(expanded.nodes.some((n) => n.id === row.target));
  assert.ok(expanded.edges.some((e) => e.source === row.source && e.target === row.target));
  await saveContent({ kind: 'connections', action: 'unpublish', record: { ...row, id: saved.id } });
  assert.ok(!(await graph(row.source)).nodes.some((n) => n.id === row.target));
  await query('DELETE FROM connections WHERE id=$1', [saved.id]);
});
