import { z } from 'zod';

const songSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  url: z.string().url(),
  primary_artist: z.object({ id: z.number().int(), name: z.string() }),
  song_art_image_url: z.string().nullable().optional(),
  album: z.object({ id: z.number().int(), name: z.string() }).nullable().optional(),
});
export type GeniusSong = z.infer<typeof songSchema>;
export class GeniusError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'GeniusError';
  }
}

// Credentials are supplied only by the server-only entry point, never by browser code.
export function createGeniusClient(token: string, fetcher: typeof fetch = fetch) {
  if (!token.trim()) throw new GeniusError('Genius is not configured. Set GENIUS_ACCESS_TOKEN.');
  async function request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    try {
      const response = await fetcher(new URL(path, 'https://api.genius.com'), {
        headers: { Authorization: `Bearer ${token.trim()}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
        redirect: 'error',
      });
      if (!response.ok) {
        const message =
          response.status === 401 || response.status === 403
            ? 'Genius rejected the access token.'
            : response.status === 429
              ? 'Genius rate limit reached. Try again later.'
              : response.status === 404
                ? 'Genius song not found.'
                : 'Genius is temporarily unavailable.';
        throw new GeniusError(message, response.status);
      }
      const parsed = schema.safeParse(await response.json());
      if (!parsed.success) throw new GeniusError('Genius returned an unexpected response.');
      return parsed.data;
    } catch (error) {
      if (error instanceof GeniusError) throw error;
      // Never propagate upstream bodies, URLs, or fetch errors that might expose credentials.
      throw new GeniusError('Could not reach Genius or read its response. Try again.');
    }
  }
  return {
    async search(query: string): Promise<GeniusSong[]> {
      const q = z.string().trim().min(1).max(200).parse(query);
      const data = await request(
        '/search?' + new URLSearchParams({ q }),
        z.object({
          response: z.object({
            hits: z.array(z.object({ type: z.string(), result: z.unknown() })),
          }),
        }),
      );
      const songs = z
        .array(songSchema)
        .safeParse(
          data.response.hits.filter((hit) => hit.type === 'song').map((hit) => hit.result),
        );
      if (!songs.success) throw new GeniusError('Genius returned an unexpected response.');
      return songs.data;
    },
    async song(id: number): Promise<GeniusSong> {
      z.number().int().positive().safe().parse(id);
      const data = await request(
        `/songs/${id}`,
        z.object({ response: z.object({ song: songSchema }) }),
      );
      return data.response.song;
    },
  };
}
