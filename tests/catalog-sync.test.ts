import { test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../src/lib/db';
import {
  processSource,
  reviewChange,
  sourceMissing,
  materialHash,
  sourceURL,
  refreshHeldSources,
} from '../src/lib/catalog-sync';
import { setAutomation } from '../src/lib/sync-admin';
import { runSync } from '../src/lib/sync-worker';
import { GeniusError } from '../src/lib/integrations/genius-client';
import type { GeniusEntry } from '../src/lib/genius-import';
import { getTrack, searchTracks } from '../src/lib/catalog';
const song = (id: number, title = 'Fixture Midnight Song'): GeniusEntry => ({
  id,
  title,
  url: 'https://genius.com/Drake-fixture-lyrics',
  primary_artist: { id: 130, name: 'Drake' },
  primary_artists: [{ id: 130, name: 'Drake' }],
  featured_artists: [],
  release_date: '2020-04-03',
  song_art_image_url: 'https://images.genius.com/fixture.png',
  album: null,
  media: [],
  apple_music_id: null,
  relationships: [],
});
async function pending(id: number) {
  return query<{ id: string; kind: string; payload: { changes: Record<string, unknown> } }>(
    "SELECT * FROM source_changes WHERE genius_id=$1 AND status='pending' ORDER BY created_at",
    [id],
  );
}
test('new songs require approval, repeat imports stay unique, and search sees approved songs', async () => {
  const entry = song(990000001);
  await processSource(entry, 'review');
  await processSource(entry, 'review');
  assert.equal((await pending(entry.id)).length, 1);
  assert.equal(await getTrack('genius-' + entry.id), null);
  const [proposal] = await pending(entry.id);
  await reviewChange({ id: proposal.id, action: 'approve' }, 'fixture');
  assert.equal((await searchTracks({ q: entry.title })).total, 1);
  assert.equal((await getTrack('genius-' + entry.id))?.source_release_date, entry.release_date);
  await processSource(entry, 'mixed');
  assert.equal((await pending(entry.id)).length, 0);
  assert.equal(
    (await query<{ count: number }>('SELECT count(*)::int AS count FROM vault_entries'))[0].count,
    0,
  );
});
test('mixed updates only verified source links and artwork, preserving overrides and empty upstream values', async () => {
  const entry = song(990000002, 'Fixture Original Title');
  await processSource(entry, 'review');
  await reviewChange({ id: (await pending(entry.id))[0].id, action: 'approve' }, 'fixture');
  await assert.rejects(() => setAutomation(true));
  await query('UPDATE sync_settings SET automation_enabled=true');
  const trackId = 'genius-' + entry.id;
  await query(
    "INSERT INTO field_overrides VALUES('tracks',$1,'source_cover_url','\"https://images.genius.com/fixture.png\"'::jsonb,now())",
    [trackId],
  );
  const changed = {
    ...entry,
    title: 'Fixture Changed Title',
    release_date: '2021-01-01',
    song_art_image_url: 'https://images.genius.com/new.png',
    url: 'https://genius.com/Drake-new-fixture-lyrics',
  };
  await processSource(changed, 'mixed');
  const [track] = await query<{ title: string; raw: Record<string, unknown> }>(
    'SELECT title,raw FROM tracks WHERE id=$1',
    [trackId],
  );
  assert.equal(track.title, entry.title);
  assert.equal(track.raw.source_release_date, entry.release_date);
  assert.equal(track.raw.source_cover_url, entry.song_art_image_url);
  assert.equal(track.raw.genius_url, changed.url);
  await setAutomation(false);
  await processSource({ ...changed, url: 'https://genius.com/Paused-lyrics' }, 'mixed');
  assert.equal((await getTrack(trackId))?.genius_url, changed.url);
  const [change] = await pending(entry.id);
  assert.deepEqual(Object.keys(change.payload.changes).sort(), ['source_release_date', 'title']);
  await reviewChange({ id: change.id, action: 'approve', fields: ['title'] }, 'fixture');
  assert.equal((await getTrack(trackId))?.title, changed.title);
  assert.equal((await getTrack(trackId))?.source_release_date, entry.release_date);
  await processSource(
    { ...changed, release_date: null, url: 'javascript:alert(1)', song_art_image_url: null },
    'mixed',
  );
  assert.equal((await getTrack(trackId))?.source_release_date, entry.release_date);
  assert.equal(sourceURL('https://evil.test/art.png', true), null);
});
test('rejections only reopen for material changes; clean versions never create import proposals', async () => {
  const entry = song(990000003, 'Fixture Rejected');
  await processSource(entry, 'review');
  await reviewChange({ id: (await pending(entry.id))[0].id, action: 'reject' }, 'fixture');
  await processSource(
    { ...entry, song_art_image_url: 'https://images.genius.com/other.png' },
    'review',
  );
  assert.equal((await pending(entry.id)).length, 0);
  assert.ok((await refreshHeldSources([entry])).has(entry.id));
  assert.equal((await refreshHeldSources([{ ...entry, title: 'Changed Again' }])).size, 0);
  await processSource({ ...entry, title: 'Fixture Rejected Updated' }, 'review');
  assert.equal((await pending(entry.id)).length, 1);
  const clean = song(990000004, 'Fixture Rejected (Clean Version)');
  await processSource(clean, 'mixed');
  assert.equal((await pending(clean.id)).length, 0);
  assert.notEqual(materialHash(entry), materialHash({ ...entry, title: 'Other' }));
});
test('potential duplicates are linked only by review, and linking never changes stable song IDs', async () => {
  const [known] = await query<{ id: string; title: string }>(
    'SELECT id,title FROM tracks WHERE length(id)=22 ORDER BY id LIMIT 1',
  );
  const entry = song(990000005, known.title);
  await processSource(entry, 'review');
  const [change] = await pending(entry.id);
  assert.equal(change.kind, 'link');
  await assert.rejects(() => reviewChange({ id: change.id, action: 'approve' }, 'fixture'));
  await reviewChange({ id: change.id, action: 'approve', target: known.id }, 'fixture');
  assert.equal(
    (
      await query<{ track_id: string }>('SELECT track_id FROM source_songs WHERE genius_id=$1', [
        entry.id,
      ])
    )[0].track_id,
    known.id,
  );
  assert.equal(await getTrack('genius-' + entry.id), null);
  await processSource(entry, 'review');
  assert.equal((await pending(entry.id))[0]?.kind, 'metadata');
  const replacement = 'AAAAAAAAAAAAAAAAAAAAAA';
  await processSource(
    {
      ...entry,
      media: [{ provider: 'spotify', url: 'https://open.spotify.com/track/' + replacement }],
    },
    'review',
  );
  await reviewChange(
    { id: (await pending(entry.id))[0].id, action: 'approve', fields: ['spotify_id'] },
    'fixture',
  );
  assert.equal((await getTrack(known.id))?.spotify_id, replacement);
  assert.equal((await getTrack(known.id))?.id, known.id);
  await processSource(song(990000015, known.title), 'review');
  assert.equal((await pending(990000015)).length, 0);
});
test('curator edits invalidate stale proposals and missing sources do not remove songs', async () => {
  const entry = song(990000006, 'Fixture Stale');
  await processSource(entry, 'review');
  await reviewChange({ id: (await pending(entry.id))[0].id, action: 'approve' }, 'fixture');
  await processSource({ ...entry, title: 'Fixture Upstream' }, 'review');
  const [change] = await pending(entry.id);
  await query('UPDATE tracks SET title=$2 WHERE id=$1', ['genius-' + entry.id, 'Curator Title']);
  await assert.rejects(() =>
    reviewChange({ id: change.id, action: 'approve', fields: ['title'] }, 'fixture'),
  );
  await sourceMissing(entry.id);
  const [missing] = await pending(entry.id);
  assert.equal(missing.kind, 'unavailable');
  assert.ok(await getTrack('genius-' + entry.id));
  await reviewChange(
    { id: missing.id, action: 'approve', fields: ['source_available'] },
    'fixture',
  );
  assert.equal((await getTrack('genius-' + entry.id))?.source_available, false);
});
test('release title proposals require approval and refresh all affected search results', async () => {
  const entry = {
    ...song(990000020, 'Fixture Album Song'),
    album: { id: 990000020, name: 'Fixture First Release' },
  };
  await processSource(entry, 'review');
  await reviewChange({ id: (await pending(entry.id))[0].id, action: 'approve' }, 'fixture');
  const changed = { ...entry, album: { ...entry.album, name: 'Fixture Revised Release' } };
  await processSource(changed, 'review');
  assert.equal((await getTrack('genius-' + entry.id))?.release_title, entry.album.name);
  await reviewChange(
    { id: (await pending(entry.id))[0].id, action: 'approve', fields: ['release_title'] },
    'fixture',
  );
  assert.equal(
    (await searchTracks({ q: changed.album.name })).tracks[0]?.release_title,
    changed.album.name,
  );
});
test('worker resumes persisted checkpoints after a provider failure without replaying completed items', async () => {
  await query('UPDATE sync_settings SET automation_enabled=false');
  const ids = [990000010, 990000011];
  let failed = false;
  const visited: number[] = [];
  const client = {
    page: async () => ({ ids, next: null }),
    detail: async (id: number) => {
      visited.push(id);
      if (id === ids[1] && !failed) {
        failed = true;
        throw new GeniusError('Rate limited', 429);
      }
      return song(id, 'Worker ' + id);
    },
  };
  // Clear only fixture work items and pre-existing linked IDs for this isolated worker test.
  await query('UPDATE source_songs SET track_id=NULL');
  await assert.rejects(() => runSync(client));
  const [run] = await query<{ id: string; status: string; checked: number }>(
    'SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 1',
  );
  assert.equal(run.status, 'failed');
  assert.equal(run.checked, 1);
  const result = await runSync(client);
  assert.equal(result.id, run.id);
  assert.equal(result.status, 'complete');
  await setAutomation(true);
  await setAutomation(false);
  assert.equal(visited.filter((id) => id === ids[0]).length, 1);
});
