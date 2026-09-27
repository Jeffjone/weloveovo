import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGeniusSyncClient } from '../src/lib/integrations/genius-sync-client';
test('Genius sync validates pagination and keeps only metadata, not lyrics', async () => {
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(new URL(String(url)).origin, 'https://api.genius.com');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer fixture');
    return Response.json(
      String(url).includes('/artists/')
        ? { response: { songs: [{ id: 149 }], next_page: null } }
        : {
            response: {
              song: {
                id: 149,
                title: 'Example',
                url: 'https://genius.com/Drake-example-lyrics',
                primary_artist: { id: 130, name: 'Drake' },
                release_date_components: { year: 2006, month: null, day: null },
                lyrics: 'must not be stored',
              },
            },
          },
    );
  };
  const client = createGeniusSyncClient('fixture', fetcher);
  assert.deepEqual(await client.page(1), { ids: [149], next: null });
  const entry = await client.detail(149);
  assert.equal(entry.release_date, '2006');
  assert.ok(!('lyrics' in entry));
});
test('rate limits and malformed source responses never look like source deletions', async () => {
  await assert.rejects(
    () =>
      createGeniusSyncClient('fixture', async () => new Response('', { status: 429 })).detail(1),
    { status: 429 },
  );
  await assert.rejects(() =>
    createGeniusSyncClient('fixture', async () => Response.json({ response: { song: {} } })).detail(
      1,
    ),
  );
});
