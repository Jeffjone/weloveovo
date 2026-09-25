import { z } from 'zod';
import { query } from './db';
import type { Track, Release, Era, Milestone, GraphData, GraphNode } from './types';
export const trackId = z.string().regex(/^[a-zA-Z0-9]{22}$/);
export const searchSchema = z.object({
  q: z.string().trim().max(120).default(''),
  release: z.string().max(160).default(''),
  artist: z.string().max(160).default(''),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  era: z.string().max(80).default(''),
  mood: z.enum(['', 'night', 'drive', 'energy']).default(''),
  sort: z.enum(['rank', 'title', 'newest', 'oldest', 'energy', 'popularity']).default('rank'),
  clean: z.enum(['true', 'false']).default('false'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  ids: z
    .string()
    .max(12000)
    .refine((value) => {
      const ids = value.split(',').filter(Boolean);
      return ids.length <= 414 && ids.every((id) => trackId.safeParse(id).success);
    }, 'Invalid favorite identifiers')
    .optional(),
});
export type Search = z.input<typeof searchSchema>;
const trackSelect = `SELECT t.id,t.title,t.release_id,t.duration,t.bpm,t.musical_key,t.energy,t.dance,t.valence,t.acoustic,t.popularity,t.explicit,t.rank,
 r.title release_title,r.release_date,r.cover_url,r.apple_url,
 coalesce((SELECT json_agg(a.name ORDER BY ta.position) FROM track_artists ta JOIN artists a ON a.id=ta.artist_id WHERE ta.track_id=t.id),'[]') artist_names,
 coalesce((SELECT json_agg(a.id ORDER BY ta.position) FROM track_artists ta JOIN artists a ON a.id=ta.artist_id WHERE ta.track_id=t.id),'[]') artist_ids,
 EXISTS(SELECT 1 FROM audio_assets aa WHERE aa.track_id=t.id AND aa.status='published') downloadable
 FROM tracks t JOIN releases r ON r.id=t.release_id`;
export async function searchTracks(input: Search = {}) {
  const f = searchSchema.parse(input);
  const params: unknown[] = [];
  const conditions: string[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return '$' + params.length;
  };
  if (f.q) {
    const q = add(f.q);
    const like = add('%' + f.q.replace(/[\\%_]/g, '\\$&') + '%');
    conditions.push(
      `(t.search_document @@ plainto_tsquery('simple',${q}) OR t.title ILIKE ${like} OR r.title ILIKE ${like} OR EXISTS(SELECT 1 FROM track_artists ta JOIN artists a ON a.id=ta.artist_id WHERE ta.track_id=t.id AND a.name ILIKE ${like}))`,
    );
  }
  if (f.release) conditions.push(`t.release_id=${add(f.release)}`);
  if (f.artist)
    conditions.push(
      `EXISTS(SELECT 1 FROM track_artists ta WHERE ta.track_id=t.id AND ta.artist_id=${add(f.artist)})`,
    );
  if (f.year) conditions.push(`left(r.release_date,4)::int=${add(f.year)}`);
  if (f.era)
    conditions.push(
      `EXISTS(SELECT 1 FROM eras e WHERE e.id=${add(f.era)} AND e.published AND left(r.release_date,4)::int BETWEEN e.start_year AND e.end_year)`,
    );
  if (f.clean === 'true') conditions.push('NOT t.explicit');
  if (f.ids !== undefined) {
    const ids = f.ids.split(',').filter(Boolean);
    conditions.push(ids.length ? `t.id=ANY(${add(ids)}::text[])` : 'false');
  }
  if (f.mood === 'night') conditions.push('t.energy<=50 AND t.valence<=50');
  if (f.mood === 'drive') conditions.push('t.dance>=65 AND t.energy BETWEEN 40 AND 75');
  if (f.mood === 'energy') conditions.push('t.energy>=70');
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const total = Number(
    (
      await query<{ count: string }>(
        `SELECT count(*) FROM tracks t JOIN releases r ON r.id=t.release_id${where}`,
        params,
      )
    )[0].count,
  );
  const page = Math.min(f.page, Math.max(1, Math.ceil(total / f.limit)));
  const sort = {
    rank: 't.rank',
    title: 't.title',
    newest: 'r.release_date DESC',
    oldest: 'r.release_date',
    energy: 't.energy DESC',
    popularity: 't.popularity DESC',
  }[f.sort];
  const tracks = await query<Track>(
    `${trackSelect}${where} ORDER BY ${sort},t.id LIMIT ${add(f.limit)} OFFSET ${add((page - 1) * f.limit)}`,
    params,
  );
  return { tracks, total, page, limit: f.limit, pages: Math.max(1, Math.ceil(total / f.limit)) };
}
export async function getTrack(id: string) {
  if (!trackId.safeParse(id).success) return null;
  return (await query<Track>(`${trackSelect} WHERE t.id=$1`, [id]))[0] || null;
}
export async function randomTracks(limit = 1, exclude?: string) {
  return query<Track>(
    `${trackSelect} WHERE ($1::text IS NULL OR t.id<>$1) ORDER BY random() LIMIT $2`,
    [exclude || null, Math.min(Math.max(limit, 1), 414)],
  );
}
export async function releases(featured = false) {
  return query<Release>(
    `SELECT r.*,count(t.id)::int track_count FROM releases r LEFT JOIN tracks t ON t.release_id=r.id ${featured ? 'WHERE r.featured' : ''} GROUP BY r.id ORDER BY r.release_date,r.title`,
  );
}
export async function getRelease(id: string) {
  return (await query<Release>('SELECT * FROM releases WHERE id=$1', [id]))[0] || null;
}
export async function eras(includeDrafts = false) {
  return query<Era>(
    `SELECT e.*,r.cover_url FROM eras e LEFT JOIN releases r ON r.id=e.release_id ${includeDrafts ? '' : 'WHERE e.published'} ORDER BY position`,
  );
}
export async function getEra(id: string) {
  return (await eras()).find((e) => e.id === id) || null;
}
export async function milestones(includeDrafts = false) {
  return query<Milestone>(
    `SELECT * FROM milestones ${includeDrafts ? '' : 'WHERE published'} ORDER BY year`,
  );
}
export async function statistics() {
  const rows = await query<{ tracks: number; releases: number; artists: number }>(
    `SELECT (SELECT count(*)::int FROM tracks) tracks,(SELECT count(*)::int FROM releases) releases,(SELECT count(*)::int FROM artists) artists`,
  );
  return rows[0];
}
export async function related(id: string) {
  const track = await getTrack(id);
  if (!track) return [];
  const candidates = await query<Track>(`${trackSelect} WHERE t.id<>$1`, [id]);
  return candidates
    .map((other) => {
      const collaborators = other.artist_ids.filter(
        (a) => a !== 'drake' && track.artist_ids.includes(a),
      );
      const distance =
        (Math.abs(track.energy - other.energy) +
          Math.abs(track.dance - other.dance) +
          Math.abs(track.valence - other.valence)) /
          300 +
        Math.abs(track.bpm - other.bpm) / 250;
      const score =
        distance -
        (collaborators.length ? 0.2 : 0) -
        (other.release_id === track.release_id ? 0.05 : 0);
      return {
        track: other,
        score,
        reason: collaborators.length
          ? 'Shared collaborator'
          : Math.abs(track.energy - other.energy) <= 10
            ? 'Similar energy'
            : Math.abs(track.dance - other.dance) <= 10
              ? 'A familiar rhythm'
              : 'A related sonic mood',
      };
    })
    .sort((a, b) => a.score - b.score || a.track.id.localeCompare(b.track.id))
    .slice(0, 6);
}
export async function graph(root: string | null = null): Promise<GraphData> {
  const chapters = await eras();
  const nodes: GraphNode[] = chapters.map((e, i) => ({
    id: 'era:' + e.id,
    kind: 'era',
    label: e.label,
    description: `${e.start_year}—${e.end_year}`,
    href: '/eras/' + e.id,
    x: i * 265,
    y: 0,
    image: e.cover_url,
  }));
  const edges: GraphData['edges'] = chapters.slice(1).map((e, i) => ({
    id: 'timeline-' + i,
    source: 'era:' + chapters[i].id,
    target: 'era:' + e.id,
    label: 'Next chapter',
  }));
  const addEdge = (source: string, target: string, label?: string) => {
    if (!edges.some((e) => e.source === source && e.target === target))
      edges.push({ id: source + '--' + target, source, target, label });
  };
  const append = (node: GraphNode) => {
    if (!nodes.some((n) => n.id === node.id)) nodes.push(node);
  };
  const [kind, id] = root?.split(':') || [];
  let selectedEra: Era | undefined;
  let release: Release | null = null;
  let track: Track | null = null;
  if (kind === 'era') selectedEra = chapters.find((e) => e.id === id);
  if (kind === 'release') release = await getRelease(id);
  if (kind === 'track') {
    track = await getTrack(id);
    if (track) release = await getRelease(track.release_id);
  }
  if (release)
    selectedEra = chapters.find(
      (e) =>
        Number(release!.release_date.slice(0, 4)) >= e.start_year &&
        Number(release!.release_date.slice(0, 4)) <= e.end_year,
    );
  if (selectedEra) {
    const albums = (await releases()).filter(
      (r) =>
        (r.featured || r.id === release?.id) &&
        Number(r.release_date.slice(0, 4)) >= selectedEra!.start_year &&
        Number(r.release_date.slice(0, 4)) <= selectedEra!.end_year,
    );
    albums.forEach((r, i) => {
      append({
        id: 'release:' + r.id,
        kind: 'release',
        label: r.title,
        description: r.release_date.slice(0, 4),
        href: '/records/' + r.id,
        x: i * 245,
        y: 200,
        image: r.cover_url,
      });
      addEdge('era:' + selectedEra!.id, 'release:' + r.id, 'Released in');
    });
    (await milestones())
      .filter((m) => m.era_id === selectedEra.id)
      .forEach((m, i) => {
        append({
          id: 'milestone:' + m.id,
          kind: 'milestone',
          label: m.title,
          description: String(m.year),
          href: '/legacy#' + m.id,
          x: (albums.length + i) * 245,
          y: 200,
        });
        addEdge('era:' + selectedEra!.id, 'milestone:' + m.id, 'Milestone');
      });
  }
  if (release) {
    const songs = (await searchTracks({ release: release.id, limit: 50 })).tracks;
    songs.forEach((t, i) => {
      append({
        id: 'track:' + t.id,
        kind: 'track',
        label: t.title,
        description: t.artist_names.join(', '),
        href: '/tracks/' + t.id,
        x: (i % 7) * 230,
        y: 410 + Math.floor(i / 7) * 150,
        image: t.cover_url,
      });
      addEdge('release:' + release!.id, 'track:' + t.id, 'On the record');
    });
  }
  if (track)
    track.artist_ids.forEach((artist, i) => {
      append({
        id: 'artist:' + artist,
        kind: 'artist',
        label: track!.artist_names[i],
        description: 'Artist credit',
        href: '/listening-room?artist=' + artist,
        x: i * 250,
        y: 1120,
      });
      addEdge('track:' + track!.id, 'artist:' + artist, 'Featuring');
    });
  const extra = await query<{ source: string; target: string; label: string }>(
    'SELECT source,target,label FROM connections WHERE published',
  );
  // Curated links can reveal a related node outside the standard album hierarchy.
  if (root) {
    const connections = extra.filter((e) => e.source === root || e.target === root).slice(0, 40);
    const rowY = Math.max(...nodes.map((n) => n.y)) + 190;
    let column = 0;
    for (const edge of connections) {
      const ref = edge.source === root ? edge.target : edge.source;
      if (nodes.some((n) => n.id === ref)) continue;
      const [type, key] = ref.split(':');
      let node: GraphNode | null = null;
      const base = { id: ref, x: (column % 6) * 245, y: rowY + Math.floor(column / 6) * 170 };
      if (type === 'release') {
        const r = await getRelease(key);
        if (r)
          node = {
            ...base,
            kind: 'release',
            label: r.title,
            description: r.release_date.slice(0, 4),
            href: '/records/' + r.id,
            image: r.cover_url,
          };
      }
      if (type === 'track') {
        const t = await getTrack(key);
        if (t)
          node = {
            ...base,
            kind: 'track',
            label: t.title,
            description: t.artist_names.join(', '),
            href: '/tracks/' + t.id,
            image: t.cover_url,
          };
      }
      if (type === 'artist') {
        const a = (
          await query<{ id: string; name: string }>('SELECT * FROM artists WHERE id=$1', [key])
        )[0];
        if (a)
          node = {
            ...base,
            kind: 'artist',
            label: a.name,
            description: 'Artist connection',
            href: '/listening-room?artist=' + a.id,
          };
      }
      if (type === 'milestone') {
        const m = (await milestones()).find((m) => m.id === key);
        if (m)
          node = {
            ...base,
            kind: 'milestone',
            label: m.title,
            description: String(m.year),
            href: '/legacy#' + m.id,
          };
      }
      if (node) {
        append(node);
        column++;
      }
    }
  }
  for (const e of extra) {
    if (nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target))
      addEdge(e.source, e.target, e.label);
  }
  return { nodes, edges, root };
}
