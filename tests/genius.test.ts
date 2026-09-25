import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGeniusClient, GeniusError } from '../src/lib/integrations/genius-client';
const song = {
  id: 123,
  title: 'Example',
  url: 'https://genius.com/example',
  primary_artist: { id: 9, name: 'Drake' },
};

test('Genius authenticates at the fixed API origin and validates search and song responses', async () => {
  const paths: string[] = [];
  const client = createGeniusClient('test-token', async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://api.genius.com');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-token');
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.cache, 'no-store');
    assert.ok(init?.signal);
    assert.equal(url.searchParams.get('access_token'), null);
    paths.push(url.pathname);
    if (url.pathname === '/search') {
      assert.equal(url.searchParams.get('q'), 'Drake & Future');
      return Response.json({
        response: {
          hits: [
            { type: 'song', result: song },
            { type: 'artist', result: {} },
          ],
        },
      });
    }
    return Response.json({ response: { song } });
  });
  assert.deepEqual(await client.search(' Drake & Future '), [song]);
  assert.deepEqual(await client.song(123), song);
  assert.deepEqual(paths, ['/search', '/songs/123']);
});

test('Genius rejects missing credentials and invalid inputs without making requests', async () => {
  assert.throws(() => createGeniusClient(' '), /GENIUS_ACCESS_TOKEN/);
  const client = createGeniusClient('test-token', async () => {
    throw new Error('Unexpected request');
  });
  await assert.rejects(() => client.search(' '), { name: 'ZodError' });
  await assert.rejects(() => client.search('a'.repeat(201)), { name: 'ZodError' });
  await assert.rejects(() => client.song(-1), { name: 'ZodError' });
  await assert.rejects(() => client.song(1.5), { name: 'ZodError' });
});

test('Genius handles empty results, upstream failures and invalid data without leaking tokens', async () => {
  const empty = createGeniusClient('test-token', async () =>
    Response.json({ response: { hits: [] } }),
  );
  assert.deepEqual(await empty.search('nothing'), []);
  for (const status of [401, 403, 404, 429, 500]) {
    const client = createGeniusClient(
      'test-token',
      async () => new Response('test-token', { status }),
    );
    await assert.rejects(
      () => client.search('Drake'),
      (error: unknown) =>
        error instanceof GeniusError &&
        error.status === status &&
        !error.message.includes('test-token'),
    );
  }
  for (const fetcher of [
    async () => {
      throw new Error('test-token');
    },
    async () => new Response('test-token'),
    async () =>
      Response.json({ response: { hits: [{ type: 'song', result: { id: 'test-token' } }] } }),
  ]) {
    await assert.rejects(
      () => createGeniusClient('test-token', fetcher).search('Drake'),
      (error: unknown) => error instanceof GeniusError && !error.message.includes('test-token'),
    );
  }
});
