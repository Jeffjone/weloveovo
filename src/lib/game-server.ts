import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { getTrack, randomTracks, releases, trackId } from './catalog';
import { query } from './db';
import type { Track } from './types';
import type { Answer, GameMode, Question } from './game-types';
export const gameMode = z.enum(['release', 'cover', 'year', 'credits']);
export const answerInput = z.object({
  id: trackId,
  mode: gameMode,
  choice: z.string().min(1).max(200),
});
function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function correctChoice(track: Track, mode: GameMode) {
  if (mode === 'year')
    return { id: track.release_date.slice(0, 4), label: track.release_date.slice(0, 4) };
  if (mode === 'credits') {
    const index = track.artist_ids.findIndex((id) => id !== 'drake');
    return index < 0 ? null : { id: track.artist_ids[index], label: track.artist_names[index] };
  }
  return { id: track.release_id, label: track.release_title };
}
export async function gameDeck(mode: GameMode): Promise<Question[]> {
  const [tracks, records, artists] = await Promise.all([
    randomTracks(414),
    releases(),
    query<{ id: string; name: string }>('SELECT id,name FROM artists WHERE id<>$1', ['drake']),
  ]);
  const years = [...new Set(records.map((r) => r.release_date.slice(0, 4)))];
  const deck: Question[] = [];
  const seen = new Set<string>();
  for (const track of tracks) {
    const answer = correctChoice(track, mode);
    if (!answer || (mode === 'cover' && !track.cover_url)) continue;
    const identity =
      mode === 'cover' ? track.cover_url! : mode === 'year' ? track.release_id : track.id;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const pool =
      mode === 'year'
        ? years.map((year) => ({ id: year, label: year }))
        : mode === 'credits'
          ? artists
              .filter((a) => !track.artist_ids.includes(a.id))
              .map((a) => ({ id: a.id, label: a.name }))
          : records
              .filter((r) => mode !== 'cover' || r.cover_url !== track.cover_url)
              .map((r) => ({ id: r.id, label: r.title }));
    const labels = new Set([answer.label.toLowerCase()]);
    const alternatives = shuffled(pool)
      .filter((item) => {
        if (item.id === answer.id || labels.has(item.label.toLowerCase())) return false;
        labels.add(item.label.toLowerCase());
        return true;
      })
      .slice(0, 3);
    if (alternatives.length < 3) continue;
    deck.push({
      id: track.id,
      mode,
      prompt:
        mode === 'year'
          ? 'When was this edition released?'
          : mode === 'credits'
            ? 'Who is credited alongside Drake?'
            : mode === 'cover'
              ? 'Which record is this?'
              : 'Which release includes this song in the collection?',
      subject:
        mode === 'cover' ? 'Read the cover.' : mode === 'year' ? track.release_title : track.title,
      image: mode === 'cover' ? track.cover_url : null,
      choices: shuffled([answer, ...alternatives]),
    });
    if (deck.length === 10) break;
  }
  return deck;
}
export async function checkAnswer(input: z.input<typeof answerInput>): Promise<Answer | null> {
  const { id, mode, choice } = answerInput.parse(input);
  const track = await getTrack(id);
  if (!track) return null;
  const answer = correctChoice(track, mode);
  if (!answer) return null;
  const explanation =
    mode === 'credits'
      ? `The catalog credits ${track.artist_names.join(', ')} on “${track.title}”.`
      : `“${track.title}” appears on ${track.release_title}. This edition is dated ${track.release_date} in the collection.`;
  return { correct: choice === answer.id, answer: answer.id, explanation, track };
}
