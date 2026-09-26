import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releases, getEra, searchTracks, graph } from '../src/lib/catalog';
import { vaultTracks } from '../src/lib/vault';
import { query } from '../src/lib/db';
import { releaseDate } from '../src/lib/release-date';
test('early records have the supplied dates, correct order, and only two featured additions', async () => {
  const records = await releases();
  const expected = {
    'genius-album-516437': '2006',
    'genius-album-2625': '2006-02-14',
    'genius-album-2622': '2007-09-01',
    'genius-album-31785': '2009-09-15',
    'genius-album-348688': '2010-09-17',
  };
  for (const [id, date] of Object.entries(expected)) {
    assert.equal(records.find((r) => r.id === id)?.release_date, date);
    assert.ok((await searchTracks({ release: id })).tracks.every((t) => t.release_date === date));
  }
  assert.ok(
    records.findIndex((r) => r.id === 'genius-album-516437') <
      records.findIndex((r) => r.id === 'genius-album-2625'),
  );
  const featured = (await releases(true)).map((r) => r.id);
  assert.ok(featured.includes('genius-album-2625') && featured.includes('genius-album-2622'));
  for (const id of ['genius-album-516437', 'genius-album-31785', 'genius-album-348688'])
    assert.ok(!featured.includes(id));
  assert.equal((await getEra('the-introduction'))?.start_year, 2006);
  const map = await graph('era:the-introduction');
  assert.ok(map.nodes.some((n) => n.id === 'release:genius-album-2625'));
  assert.ok(map.nodes.some((n) => n.id === 'release:genius-album-516437'));
  assert.equal(releaseDate('2006'), '2006');
  assert.equal(releaseDate('2006-02-14'), 'February 14, 2006');
});
test('vault starts empty and searches only explicitly classified entries', async () => {
  assert.equal((await vaultTracks({})).total, 0);
  const [track] = await query<{ id: string }>('SELECT id FROM tracks ORDER BY id LIMIT 1');
  try {
    await query(
      "INSERT INTO vault_entries VALUES ($1,'snippet','Test fixture','https://example.com')",
      [track.id],
    );
    assert.equal((await vaultTracks({ category: 'snippet' })).total, 1);
    assert.equal((await vaultTracks({ category: 'leaked' })).total, 0);
    assert.equal((await vaultTracks({ q: 'not a real title zz' })).total, 0);
  } finally {
    await query('DELETE FROM vault_entries WHERE track_id=$1', [track.id]);
  }
});
