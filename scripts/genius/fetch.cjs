const fs = require('node:fs');
const root = '.data/genius';
if (process.argv.includes('--refresh')) fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(root, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch('https://api.genius.com' + path, {
      headers: { Authorization: 'Bearer ' + process.env.GENIUS_ACCESS_TOKEN },
      signal: AbortSignal.timeout(20000),
    });
    if (r.ok) return (await r.json()).response;
    if (r.status !== 429 && r.status < 500) throw new Error('Genius ' + r.status);
    await sleep((i + 1) * 2000);
  }
  throw new Error('Genius retry exhausted');
}
const artist = (a) => ({ id: a.id, name: a.name });
function select(s) {
  return {
    id: s.id,
    title: s.title,
    url: s.url,
    primary_artist: artist(s.primary_artist),
    primary_artists: s.primary_artists?.map(artist) || [],
    featured_artists: s.featured_artists?.map(artist) || [],
    release_date: s.release_date || null,
    release_date_components: s.release_date_components || null,
    song_art_image_url: s.song_art_image_url,
    album: s.album
      ? {
          id: s.album.id,
          name: s.album.name,
          url: s.album.url,
          cover_art_url: s.album.cover_art_url,
        }
      : null,
    media: s.media || [],
    apple_music_id: s.apple_music_id || null,
    apple_music_player_url: s.apple_music_player_url || null,
    language: s.language,
    relationships:
      s.song_relationships
        ?.filter((r) =>
          ['remix_of', 'live_version_of', 'translation_of', 'cover_of'].includes(
            r.relationship_type,
          ),
        )
        .map((r) => ({
          type: r.relationship_type,
          songs: r.songs.map((t) => ({ id: t.id, title: t.title, artist: t.primary_artist.name })),
        })) || [],
  };
}
(async () => {
  if (!process.env.GENIUS_ACCESS_TOKEN) throw new Error('Set GENIUS_ACCESS_TOKEN.');
  if (!process.env.DATABASE_URL)
    throw new Error('Set DATABASE_URL to compare with the live catalog.');
  const sql = require('postgres')(process.env.DATABASE_URL, {
    prepare: false,
    max: 1,
    connect_timeout: 15,
  });
  try {
    const tracks =
      await sql`SELECT t.*,coalesce((select json_agg(a.name order by ta.position) from track_artists ta join artists a on a.id=ta.artist_id where ta.track_id=t.id),'[]') artist_names FROM tracks t`;
    fs.writeFileSync('.data/hosted-catalog-before.json', JSON.stringify(tracks, null, 2));
    console.log('Hosted tracks:', tracks.length);
  } finally {
    await sql.end();
  }
  const all = new Map();
  let page = 1;
  const seen = new Set();
  while (page) {
    if (seen.has(page)) throw new Error('Pagination loop');
    seen.add(page);
    const p = root + '/page-' + page + '.json';
    let data;
    if (fs.existsSync(p)) data = JSON.parse(fs.readFileSync(p));
    else {
      const r = await get('/artists/130/songs?per_page=50&sort=title&page=' + page);
      data = { songs: r.songs.map(select), next_page: r.next_page };
      fs.writeFileSync(p, JSON.stringify(data));
    }
    for (const s of data.songs) all.set(s.id, s);
    console.log('Page', page, 'total', all.size);
    page = data.next_page;
  }
  fs.writeFileSync(root + '/list.json', JSON.stringify([...all.values()], null, 2));
  console.log('All pages complete:', all.size);
  const queue = [...all.values()];
  let n = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (queue.length) {
        const s = queue.shift();
        const p = root + '/song-' + s.id + '.json';
        if (!fs.existsSync(p)) {
          const data = select((await get('/songs/' + s.id)).song);
          fs.writeFileSync(p, JSON.stringify(data));
        }
        if (++n % 50 === 0) console.log('Details', n, '/', all.size);
      }
    }),
  );
  fs.writeFileSync(
    root + '/manifest.json',
    JSON.stringify({
      artist_id: 130,
      pages: seen.size,
      entries: all.size,
      retrieved_at: new Date().toISOString(),
    }),
  );
  console.log('Metadata complete');
})().catch((e) => {
  console.error(
    'Catalog fetch failed. Cached pages can be resumed; no database changes were made.',
  );
  process.exitCode = 1;
});
