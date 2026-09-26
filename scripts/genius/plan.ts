import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import catalog from '../../data/catalog/original.json';
import type { Release } from '../../src/lib/types';
import {
  titleKey,
  alternateKey,
  versionKey,
  exclusion,
  type GeniusEntry,
} from '../../src/lib/genius-import';
const directory = '.data/genius';
const list: GeniusEntry[] = JSON.parse(readFileSync(directory + '/list.json', 'utf8'));
const files = new Set(readdirSync(directory));
if (list.some((s) => !files.has(`song-${s.id}.json`)))
  throw new Error('Fetch all song details before planning the import.');
const songs: GeniusEntry[] = list.map((s) =>
  JSON.parse(readFileSync(`${directory}/song-${s.id}.json`, 'utf8')),
);
const existing = JSON.parse(readFileSync('.data/hosted-catalog-before.json', 'utf8')) as {
  id: string;
  title: string;
  artist_names: string[];
  raw: Record<string, unknown>;
}[];
const previous = existsSync('data/catalog/genius.json')
  ? (JSON.parse(readFileSync('data/catalog/genius.json', 'utf8')) as {
      tracks: Record<string, unknown>[];
      releases: Release[];
      artists: { id: string; name: string }[];
    })
  : { tracks: [], releases: [], artists: [] };
const existingIds = new Set(existing.map((t) => t.id));
const retained = previous.tracks.filter((t) => existingIds.has(String(t.id)));
const retainedReleases = new Set(retained.map((t) => t.release_id));
const retainedArtists = new Set(retained.flatMap((t) => t.artist_ids as string[]));
const reviewed: Record<
  string,
  { action: 'exclude' | 'include' | 'duplicate' | 'review'; reason: string; existingId?: string }
> = JSON.parse(readFileSync('data/review/genius-decisions.json', 'utf8'));
const trusted = new Set([
  ...catalog.artists.map((a) => titleKey(a.name)),
  ...[
    'French Montana',
    'Nipsey Hussle',
    'Belly',
    'Kidd Kidd',
    'Pimp C',
    'Snoop Lion',
    'Lorenzo Asher',
    'OB O’Brien',
    'Mike WiLL Made-It',
    'iLoveMakonnen',
    'Preme',
    'Rich Homie Quan',
    'Divine Brown',
    'Tinashe',
    'DJ ESCO',
    'Trouble',
    'Maejor',
    'Juicy J',
    'Soulja Boy',
    'USHER',
    'Yung Bleu',
    'Camila Cabello',
    'Gordo',
    'Roshana',
    'Jaye',
    'VERBAL',
    'Smoke Dawg',
    'Mally Mall',
    'Fetty Wap',
    'ScHoolboy Q',
    'dvsn',
    'Dave',
    'Bishop Brigante',
    'Bun B',
    'Jamie Foxx',
    'Trey Songz',
    'Fabolous',
    'Sean Garrett',
    'k-os',
    'Kevin Cossom',
    'Colin Munroe',
    'Mary J. Blige',
    'Young Artists For Haiti',
    'Tank',
    'Olivia',
    'Rebstar',
    'Benny the Butcher',
    'Big Page',
    'Slakah the Beatchild',
    'King Reign',
    'Promise',
    'Jae Millz',
    'Shanell',
    'Gudda Gudda',
    'Nickelus F',
    'JD Era',
    'Jeezy',
    'Omen (Producer)',
    'Aaliyah',
    'SBTRKT',
    'Jhené Aiko',
    'Rita Ora',
    'Dawn Richard',
    'Rich Boy',
    'Lenny Kravitz',
    'Tona',
    'Ill Kidz',
    'Riz',
    'Mannie Fresh',
    'MC Kevin O Chris',
    'N.E.R.D.',
    'Snowd4y',
    'Young Money',
    'Birdman',
    'Rich Gang',
    'Dr. Dre',
    'Cast of Ice Age: Continental Drift',
  ].map(titleKey),
]);
const known = new Map(existing.map((t) => [titleKey(t.title), t.id]));
for (const t of catalog.tracks) known.set(titleKey(t.title), t.id);
const artists = [...catalog.artists, ...previous.artists.filter((a) => retainedArtists.has(a.id))];
const records: Release[] = [
  ...catalog.releases,
  ...previous.releases.filter((r) => retainedReleases.has(r.id)),
];
const newArtists: typeof artists = [];
const newRecords: Release[] = [];
const tracks: Record<string, unknown>[] = [];
const decisions: {
  genius_id: number;
  title: string;
  url: string;
  action: string;
  reason: string;
  existing_id?: string;
}[] = [];
const note = (song: GeniusEntry, action: string, reason: string, existing_id?: string) =>
  decisions.push({
    genius_id: song.id,
    title: song.title,
    url: song.url,
    action,
    reason,
    ...(existing_id ? { existing_id } : {}),
  });
const artistId = (a: { id: number; name: string }) => {
  const found = artists.find((b) => titleKey(b.name) === titleKey(a.name));
  if (found) return found.id;
  const row = { id: a.id === 130 ? 'drake' : `genius-artist-${a.id}`, name: a.name };
  artists.push(row);
  newArtists.push(row);
  return row.id;
};
const releaseKey = (name: string) =>
  titleKey(name.replace(/\((?:deluxe|bonus|expanded|special|collector)[^)]*\)/gi, ''));
// Canonical entries precede alternate editions. Favor records with release context.
const priority = (s: GeniusEntry) =>
  Number(alternateKey(s.title) !== titleKey(s.title)) * 100 +
  Number(!s.album) * 10 +
  Number(!s.media.length) * 5;
songs.sort((a, b) => priority(a) - priority(b) || a.id - b.id);
for (const song of songs) {
  const review = reviewed[song.id];
  if (review?.action === 'exclude' || review?.action === 'review') {
    note(song, review.action === 'exclude' ? 'excluded' : 'review', review.reason);
    continue;
  }
  if (review?.action === 'duplicate') {
    note(song, 'duplicate', review.reason, review.existingId);
    continue;
  }
  const excluded = exclusion(song);
  if (excluded) {
    note(song, 'excluded', excluded);
    continue;
  }
  const key = titleKey(song.title);
  const match =
    known.get(key) || known.get(alternateKey(song.title)) || known.get(versionKey(song.title));
  if (match) {
    note(song, 'duplicate', 'Title or alternate-edition match', match);
    continue;
  }
  if (review?.action !== 'include' && !song.album && !song.media.length) {
    note(song, 'review', 'Insufficient recording context; unverified Genius entry');
    continue;
  }
  if (review?.action !== 'include' && !trusted.has(titleKey(song.primary_artist.name))) {
    note(song, 'review', 'Performer attribution needs verification');
    continue;
  }
  let release = song.album
    ? records.find((r) => releaseKey(r.title) === releaseKey(song.album!.name))
    : undefined;
  if (!release) {
    const id = song.album ? `genius-album-${song.album.id}` : 'genius-unassigned';
    release = records.find((r) => r.id === id);
    if (!release) {
      release = {
        id,
        title: song.album?.name || 'Singles & unassigned recordings',
        release_date: '',
        cover_url: song.album?.cover_art_url || null,
        apple_url: null,
        featured: false,
      };
      records.push(release);
      newRecords.push(release);
    }
  }
  const id = `genius-${song.id}`;
  const spotify =
    song.media
      .find(
        (m) =>
          m.provider === 'spotify' &&
          /^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]{22}(?:\?|$)/.test(m.url),
      )
      ?.url.match(/track\/([A-Za-z0-9]{22})/)?.[1] || null;
  const bySpotify =
    spotify && existing.find((t) => t.id === spotify || t.raw.spotify_id === spotify);
  if (bySpotify) {
    note(song, 'duplicate', 'Spotify identity match', bySpotify.id);
    continue;
  }
  tracks.push({
    id,
    title: song.title.replace(/\*$/, '').trim(),
    release_id: release.id,
    duration: null,
    bpm: null,
    musical_key: null,
    energy: null,
    dance: null,
    valence: null,
    acoustic: null,
    popularity: null,
    explicit: null,
    rank: 10000 + retained.length + tracks.length,
    raw: {
      source: 'genius',
      genius_id: song.id,
      genius_url: song.url,
      spotify_id: spotify,
      source_release_date: song.release_date,
      source_cover_url: song.song_art_image_url,
      source_album: song.album,
      media: song.media,
      imported_at: new Date().toISOString().slice(0, 10),
    },
    artist_ids: [
      ...new Set(
        [
          ...(song.primary_artists.length ? song.primary_artists : [song.primary_artist]),
          ...song.featured_artists,
        ].map(artistId),
      ),
    ],
  });
  known.set(key, id);
  known.set(versionKey(song.title), id);
  note(song, 'added', 'New Drake performance with recording context', id);
}
const used = new Set(tracks.map((t) => t.release_id));
const result = { releases: newRecords.filter((r) => used.has(r.id)), artists: newArtists, tracks };
writeFileSync('data/catalog/genius.json', JSON.stringify(result, null, 2) + '\n');
writeFileSync(
  'reports/genius/import-audit.json',
  JSON.stringify(
    {
      artist_id: 130,
      retrieved_at: new Date().toISOString(),
      pages: readdirSync(directory).filter((f) => /^page-\d+\.json$/.test(f)).length,
      source_entries: songs.length,
      seed_tracks: result.tracks.length,
      existing_tracks: existing.length,
      summary: decisions.reduce(
        (a, d) => ((a[d.action] = (a[d.action] || 0) + 1), a),
        {} as Record<string, number>,
      ),
      decisions,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    tracks: tracks.length,
    releases: result.releases.length,
    artists: newArtists.length,
    decisions: decisions.reduce(
      (a, d) => ((a[d.action] = (a[d.action] || 0) + 1), a),
      {} as Record<string, number>,
    ),
  }),
);
