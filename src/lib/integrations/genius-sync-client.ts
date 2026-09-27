import { z } from 'zod';
import type { GeniusEntry } from '../genius-import';
import { GeniusError } from './genius-client';
const artist = z.object({ id: z.number().int().positive(), name: z.string().min(1).max(200) });
const song = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  url: z.string().url(),
  primary_artist: artist,
  primary_artists: z.array(artist).optional(),
  featured_artists: z.array(artist).optional(),
  release_date: z.string().nullable().optional(),
  release_date_components: z
    .object({
      year: z.number().int().nullable(),
      month: z.number().int().nullable(),
      day: z.number().int().nullable(),
    })
    .nullable()
    .optional(),
  song_art_image_url: z.string().nullable().optional(),
  album: z
    .object({
      id: z.number().int().positive(),
      name: z.string(),
      url: z.string().optional(),
      cover_art_url: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  media: z.array(z.object({ provider: z.string(), url: z.string() })).optional(),
  apple_music_id: z.union([z.string(), z.number()]).nullable().optional(),
  song_relationships: z
    .array(
      z.object({
        relationship_type: z.string(),
        songs: z.array(z.object({ id: z.number(), title: z.string(), primary_artist: artist })),
      }),
    )
    .optional(),
});
export function createGeniusSyncClient(token: string, fetcher: typeof fetch = fetch) {
  if (!token.trim()) throw new GeniusError('Genius is not configured.');
  async function request(path: string) {
    let response: Response;
    try {
      response = await fetcher('https://api.genius.com' + path, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
        cache: 'no-store',
      });
    } catch {
      throw new GeniusError('Genius connection failed.');
    }
    if (!response.ok)
      throw new GeniusError(
        response.status === 429
          ? 'Genius rate limit reached. Resume later.'
          : 'Genius request failed.',
        response.status,
      );
    try {
      return await response.json();
    } catch {
      throw new GeniusError('Genius returned invalid data.');
    }
  }
  return {
    async page(page: number) {
      const data = z
        .object({
          response: z.object({
            songs: z.array(z.object({ id: z.number().int().positive() })),
            next_page: z.number().int().positive().nullable(),
          }),
        })
        .parse(await request(`/artists/130/songs?per_page=50&sort=title&page=${page}`));
      return { ids: data.response.songs.map((s) => s.id), next: data.response.next_page };
    },
    async detail(id: number): Promise<GeniusEntry> {
      const raw = song.parse(
        z.object({ response: z.object({ song: z.unknown() }) }).parse(await request(`/songs/${id}`))
          .response.song,
      );
      const date = raw.release_date_components;
      const releaseDate =
        raw.release_date ||
        (date?.year
          ? [
              date.year,
              ...(date.month
                ? [
                    String(date.month).padStart(2, '0'),
                    ...(date.day ? [String(date.day).padStart(2, '0')] : []),
                  ]
                : []),
            ].join('-')
          : null);
      return {
        id: raw.id,
        title: raw.title,
        url: raw.url,
        primary_artist: raw.primary_artist,
        primary_artists: raw.primary_artists || [raw.primary_artist],
        featured_artists: raw.featured_artists || [],
        release_date: releaseDate,
        song_art_image_url: raw.song_art_image_url || null,
        album: raw.album
          ? { ...raw.album, cover_art_url: raw.album.cover_art_url || undefined }
          : null,
        media: raw.media || [],
        apple_music_id: raw.apple_music_id ? String(raw.apple_music_id) : null,
        relationships: (raw.song_relationships || []).map((r) => ({
          type: r.relationship_type,
          songs: r.songs.map((s) => ({ id: s.id, title: s.title, artist: s.primary_artist.name })),
        })),
      };
    },
  };
}
export type GeniusSyncClient = ReturnType<typeof createGeniusSyncClient>;
