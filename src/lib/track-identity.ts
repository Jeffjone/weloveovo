import { z } from 'zod';
export const trackIdPattern = /^(?:[a-zA-Z0-9]{22}|genius-[1-9][0-9]*)$/;
export const trackId = z.string().max(80).regex(trackIdPattern);
export function spotifyId(track: { id: string; spotify_id?: string | null }) {
  return track.spotify_id || (/^[a-zA-Z0-9]{22}$/.test(track.id) ? track.id : null);
}
