import { z } from 'zod';
import { query } from './db';
import { titleKey } from './genius-import';
import type { NamedSong } from './song-memory';
export const songGuess = z.object({ title: z.string().trim().min(1).max(200) });
export async function matchSong(title: string): Promise<NamedSong | null> {
  const key = titleKey(title);
  if (!key) return null;
  const songs = await query<{ id: string; title: string }>(
    'SELECT id,title FROM tracks ORDER BY id',
  );
  const song = songs.find((candidate) => titleKey(candidate.title) === key);
  return song ? { ...song, key } : null;
}
