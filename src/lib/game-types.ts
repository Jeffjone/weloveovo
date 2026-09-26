import { trackIdPattern } from '@/lib/track-identity';
import type { Track } from './types';
export const gameModes = [
  {
    id: 'release',
    title: 'Find the record',
    description: 'You know the song. Can you place it on the shelf?',
    label: 'SONGS → RECORDS',
  },
  {
    id: 'cover',
    title: 'Cover to cover',
    description: 'Recognize the artwork. Remember the world inside.',
    label: 'THE VISUAL MEMORY',
  },
  {
    id: 'year',
    title: 'Place the moment',
    description: 'Put a release on the timeline. Build the bigger picture.',
    label: 'THE DISCOGRAPHY',
  },
  {
    id: 'credits',
    title: 'Who’s on the track?',
    description: 'Get to know the voices sharing the record.',
    label: 'THE COLLABORATORS',
  },
] as const;
export type GameMode = (typeof gameModes)[number]['id'];
export type Question = {
  id: string;
  mode: GameMode;
  prompt: string;
  subject: string;
  image: string | null;
  choices: { id: string; label: string }[];
};
export type Answer = { correct: boolean; answer: string; explanation: string; track: Track };
export type GameProgress = { attempted: number; correct: number; tracks: string[] };
export const emptyProgress: GameProgress = { attempted: 0, correct: 0, tracks: [] };
export function readProgress(raw: string | null): GameProgress {
  try {
    const value = JSON.parse(raw || 'null');
    if (
      !value ||
      !Number.isSafeInteger(value.attempted) ||
      !Number.isSafeInteger(value.correct) ||
      value.correct < 0 ||
      value.attempted < value.correct ||
      !Array.isArray(value.tracks)
    )
      return emptyProgress;
    return {
      attempted: value.attempted,
      correct: value.correct,
      tracks: [
        ...new Set<string>(
          value.tracks.filter((id: unknown) => typeof id === 'string' && trackIdPattern.test(id)),
        ),
      ],
    };
  } catch {
    return emptyProgress;
  }
}
