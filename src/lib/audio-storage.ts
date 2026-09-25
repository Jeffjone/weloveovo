import { parseWebStream } from 'music-metadata';
import { safeFilename } from './audio';
export type AudioBucket = {
  info(path: string): Promise<{ data: { size?: number } | null; error: unknown }>;
  createSignedUrl(
    path: string,
    expires: number,
    options?: { download?: string },
  ): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
};
export async function verifyStoredAudio(
  asset: { object_path: string; size_bytes: number },
  bucket: AudioBucket,
  fetcher: typeof fetch = fetch,
) {
  const info = await bucket.info(asset.object_path);
  if (info.error || !info.data || Number(info.data.size) !== Number(asset.size_bytes))
    throw new Error('Uploaded file size does not match. Retry the upload.');
  const link = await bucket.createSignedUrl(asset.object_path, 60);
  if (link.error || !link.data) throw new Error('Could not inspect the uploaded file.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetcher(link.data.signedUrl, { signal: controller.signal });
    if (!response.ok || !response.body) throw new Error('Uploaded audio is unavailable.');
    // Parse as a stream so embedded artwork never requires buffering an entire song.
    const metadata = await parseWebStream(
      response.body,
      { path: asset.object_path, mimeType: 'audio/mpeg', size: Number(asset.size_bytes) },
      { duration: false, skipCovers: true },
    );
    if (!metadata.format.codec?.toLowerCase().includes('layer 3'))
      throw new Error('The file does not contain MP3 audio.');
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}
export async function audioDownloadURL(
  asset: { object_path: string; title: string },
  bucket: Pick<AudioBucket, 'createSignedUrl'>,
) {
  const { data, error } = await bucket.createSignedUrl(asset.object_path, 60, {
    download: safeFilename(asset.title),
  });
  if (error || !data) throw new Error('The download is temporarily unavailable.');
  return data.signedUrl;
}
