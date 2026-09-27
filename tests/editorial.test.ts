import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveContent } from '../src/lib/admin';
import { story, songNote, homepageFeatures } from '../src/lib/editorial';
import { query } from '../src/lib/db';
import { eraReleases, releases, graph } from '../src/lib/catalog';
import { vaultTracks } from '../src/lib/vault';
test('story drafts remain private, publishing changes public content, and historical versions restore', async () => {
  const before = (await story('home'))!;
  const row = { ...before, title: 'A Curated Welcome', body: 'New introduction' };
  await saveContent({ kind: 'stories', action: 'draft', record: row }, 'fixture');
  assert.equal((await story('home'))?.title, before.title);
  await saveContent({ kind: 'stories', action: 'publish', record: row }, 'fixture');
  assert.equal((await story('home'))?.title, row.title);
  const [old] = await query<{ id: string }>(
    "SELECT id FROM content_revisions WHERE kind='stories' AND entity_id='home' ORDER BY created_at LIMIT 1",
  );
  await saveContent(
    { kind: 'stories', action: 'restore', record: { revision_id: old.id } },
    'fixture',
  );
  assert.equal((await story('home'))?.body, before.body);
});
test('era membership is independent of records featuring and updates connections', async () => {
  const before = await eraReleases('the-introduction');
  assert.equal(before[0].id, 'genius-album-516437');
  const [membership] = await query<Record<string, unknown>>(
    "SELECT * FROM era_releases WHERE release_id='genius-album-516437'",
  );
  await saveContent({ kind: 'era_releases', action: 'unpublish', record: membership });
  assert.ok(!(await eraReleases('the-introduction')).some((r) => r.id === 'genius-album-516437'));
  assert.ok(
    !(await graph('era:the-introduction')).nodes.some(
      (n) => n.id === 'release:genius-album-516437',
    ),
  );
  assert.ok(!(await releases(true)).some((r) => r.id === 'genius-album-516437'));
  await saveContent({ kind: 'era_releases', action: 'publish', record: membership });
});
test('song notes, featured artwork and vault entries have draft/publish/unpublish controls', async () => {
  const [track] = await query<{ id: string }>('SELECT id FROM tracks ORDER BY id LIMIT 1');
  const note = {
    id: track.id,
    title: 'Recording Notes',
    body: 'Reviewed context.',
    source_url: 'https://genius.com/Drake-fixture-lyrics',
    published: false,
  };
  await saveContent({ kind: 'song_notes', action: 'draft', record: note });
  assert.equal(await songNote(track.id), null);
  await saveContent({ kind: 'song_notes', action: 'publish', record: note });
  assert.equal((await songNote(track.id))?.body, note.body);
  const feature = { id: 'records', release_id: 'views', published: false };
  await saveContent({ kind: 'homepage_features', action: 'draft', record: feature });
  assert.notEqual((await homepageFeatures()).find((f) => f.id === 'records')?.release_id, 'views');
  await saveContent({ kind: 'homepage_features', action: 'publish', record: feature });
  assert.equal((await homepageFeatures()).find((f) => f.id === 'records')?.release_id, 'views');
  const vault = {
    id: track.id,
    category: 'snippet',
    note: 'Fixture only',
    source_url: note.source_url,
    published: false,
  };
  await saveContent({ kind: 'vault_entries', action: 'draft', record: vault });
  assert.equal((await vaultTracks({})).total, 0);
  await saveContent({ kind: 'vault_entries', action: 'publish', record: vault });
  assert.equal((await vaultTracks({})).total, 1);
  await saveContent({ kind: 'vault_entries', action: 'unpublish', record: vault });
  assert.equal((await vaultTracks({})).total, 0);
});
