export type GeniusEntry = {
  id: number;
  title: string;
  url: string;
  primary_artist: { id: number; name: string };
  primary_artists: { id: number; name: string }[];
  featured_artists: { id: number; name: string }[];
  release_date: string | null;
  song_art_image_url: string | null;
  album: { id: number; name: string; url?: string; cover_art_url?: string } | null;
  media: { provider: string; url: string }[];
  apple_music_id: string | null;
  relationships: { type: string; songs: { id: number; title: string; artist: string }[] }[];
};
export function titleKey(title: string) {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u200b-\u200f\ufeff]/g, '')
    .toLowerCase()
    .replace(/f\*+g fans/g, 'fucking fans')
    .replace(/f\*+kin[’']? problems/g, 'fuckin problems')
    .replace(
      /\([^)]*\b(?:feat\.?|ft\.?|featuring|with)\s[^)]*\)|\[[^\]]*\b(?:feat\.?|ft\.?|featuring|with)\s[^\]]*\]/g,
      '',
    )
    .replace(/\s+(?:feat\.?|ft\.?|featuring)\s.*$/, '')
    .replace(/\((?:deluxe(?: edition)?|explicit|bonus track(?: version)?)\)/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
}
export function exclusion(song: GeniusEntry): string | null {
  if (
    ![song.primary_artist, ...song.primary_artists, ...song.featured_artists].some(
      (a) => a.id === 130,
    )
  )
    return 'No Drake performer credit';
  if (/genius|translations|apple music|spotify|saturday night live/i.test(song.primary_artist.name))
    return 'Editorial or translated page';
  if (
    /\b(clean(?: version)?|radio edit|censored|instrumental|acapella|a cappella|mixed|sped up|slowed|nightcore)\b/i.test(
      song.title,
    )
  )
    return 'Clean or alternate playback version';
  if (
    /track\s?list|setlists?|album credits|liner notes|editor.s note|thank you (?:letter|note)|interview|statement|apology|tweets|post-grammy|vanguard award|2011 juno awards|rolling stone|blackface response|new album titled|\bSNL:|conference call|music video|\(video\)|fashion|outfits?|voice mail box|drake speaks|please forgive me|TAYLOR vs|ESPYS|honorable mention|RapCaviar|don.t delete|resurgence and resilience/i.test(
      song.title,
    )
  )
    return 'Non-song page';
  if (song.relationships.some((r) => r.type === 'translation_of' && r.songs.length))
    return 'Translated version';
  if (!song.url.endsWith('-lyrics')) return 'Non-song annotation page';
  return null;
}
export function alternateKey(title: string) {
  return titleKey(
    title.replace(
      /\([^)]*\b(?:demo|original|extended|single version|album version|ready version|full length|early version|physical cd|leak|snippet|reference|live|remix verse|table for one)[^)]*\)|\[[^\]]*\b(?:demo|version|mixed)[^\]]*\]/gi,
      '',
    ),
  );
}

export function versionKey(title: string) {
  return titleKey(
    title
      .replace(
        /\([^)]*(?:remix|mix|edit|dub|version|verzuz|demo|original|reference|verse)[^)]*\)|\[[^\]]*(?:remix|mix|edit|dub|version|verzuz|demo|original|reference|verse)[^\]]*\]/gi,
        '',
      )
      .replace(/\s+(?:remix|rmx)$/i, ''),
  );
}
