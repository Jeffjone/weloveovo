import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyStoredAudio, audioDownloadURL, type AudioBucket } from '../src/lib/audio-storage';
function mpegFrames() {
  const bytes = new Uint8Array(417 * 5);
  for (let i = 0; i < 5; i++) bytes.set([0xff, 0xfb, 0x90, 0x64], i * 417);
  return bytes;
}
function bucket(size: number): AudioBucket {
  return {
    info: async () => ({ data: { size }, error: null }),
    createSignedUrl: async () => ({
      data: { signedUrl: 'https://storage.example/test.mp3' },
      error: null,
    }),
  };
}
test('MP3 verification parses a stream and rejects disguised or incomplete uploads', async () => {
  const bytes = mpegFrames(),
    asset = { object_path: 'test.mp3', size_bytes: bytes.length };
  await verifyStoredAudio(asset, bucket(bytes.length), async () => new Response(bytes));
  await assert.rejects(
    () => verifyStoredAudio(asset, bucket(1), async () => new Response(bytes)),
    /size/,
  );
  await assert.rejects(() =>
    verifyStoredAudio(
      asset,
      bucket(bytes.length),
      async () => new Response('<html>not audio</html>'),
    ),
  );
  await assert.rejects(
    () =>
      verifyStoredAudio(
        asset,
        bucket(bytes.length),
        async () => new Response(null, { status: 404 }),
      ),
    /unavailable/,
  );
});
test('temporary storage failure can retry without publishing a bad attachment', async () => {
  const bytes = mpegFrames(),
    asset = { object_path: 'test.mp3', size_bytes: bytes.length };
  let attempts = 0;
  const unstable: typeof fetch = async () => {
    if (++attempts === 1) throw new Error('Connection interrupted');
    return new Response(bytes);
  };
  await assert.rejects(
    () => verifyStoredAudio(asset, bucket(bytes.length), unstable),
    /interrupted/,
  );
  await verifyStoredAudio(asset, bucket(bytes.length), unstable);
  assert.equal(attempts, 2);
});
test('downloads receive expiring attachment links and recoverable provider errors', async () => {
  let options: unknown;
  const provider = {
    createSignedUrl: async (path: string, expiry: number, input?: { download?: string }) => {
      assert.equal(path, 'versioned/test.mp3');
      assert.equal(expiry, 60);
      options = input;
      return { data: { signedUrl: 'https://storage.example/signed-download' }, error: null };
    },
  };
  const url = await audioDownloadURL(
    { object_path: 'versioned/test.mp3', title: 'Track / title' },
    provider,
  );
  assert.equal(url, 'https://storage.example/signed-download');
  assert.deepEqual(options, { download: 'Track  title.mp3' });
  await assert.rejects(
    () =>
      audioDownloadURL(
        { object_path: 'x', title: 'x' },
        { createSignedUrl: async () => ({ data: null, error: new Error('Offline') }) },
      ),
    /temporarily unavailable/,
  );
});
