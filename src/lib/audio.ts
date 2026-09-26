import { z } from 'zod';
import { trackId } from './track-identity';
export const uploadSchema = z.object({
  trackId,
  filename: z
    .string()
    .min(5)
    .max(240)
    .regex(/\.mp3$/i),
  size: z
    .number()
    .int()
    .min(128)
    .max(100 * 1024 * 1024),
});
export function suggestTracks(
  filename: string,
  metadata: { title?: string; artist?: string },
  tracks: { id: string; title: string; artist_names?: string[] }[],
) {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
      .replace(/\.mp3$/, '')
      .replace(/^\d+[.\s_-]*/, '')
      .replace(/[^a-z0-9]/g, '');
  const id = filename.match(/genius-[1-9][0-9]*|[a-zA-Z0-9]{22}/)?.[0];
  const exact = tracks.filter((t) => t.id === id);
  if (exact.length) return exact;
  const title = normalize(metadata.title || filename.replace(/^drake\s*[-–]\s*/i, ''));
  return tracks.filter((t) => normalize(t.title) === title);
}
export function safeFilename(title: string) {
  return title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').slice(0, 160) + '.mp3';
}
export function looksLikeMP3(bytes: Uint8Array) {
  if (bytes.length < 4) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x06) === 0x02;
}
