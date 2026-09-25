import { z } from 'zod';
import { query } from './db';
import { AccessError } from './supabase';
import { NextResponse } from 'next/server';
export const id = z.string().regex(/^[a-zA-Z0-9-]{1,160}$/);
const text = z.string().trim().min(1).max(200);
const source = z
  .string()
  .url()
  .refine((s) => new URL(s).protocol === 'https:', 'Use an HTTPS source');
const pct = z.coerce.number().int().min(0).max(100);
export const schemas = {
  tracks: z.object({
    id: z.string().regex(/^[a-zA-Z0-9]{22}$/),
    title: text,
    bpm: z.coerce.number().int().min(0).max(400),
    musical_key: z.string().max(30),
    energy: pct,
    dance: pct,
    valence: pct,
    acoustic: pct,
    popularity: pct,
    explicit: z.boolean(),
  }),
  releases: z.object({
    id,
    title: text,
    release_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    featured: z.boolean(),
  }),
  artists: z.object({ id, name: text }),
  eras: z
    .object({
      id,
      label: text,
      title: text,
      body: z.string().trim().min(1).max(12000),
      start_year: z.coerce.number().int().min(1900).max(2100),
      end_year: z.coerce.number().int().min(1900).max(2100),
      release_id: id,
      track_id: z
        .string()
        .regex(/^[a-zA-Z0-9]{22}$/)
        .nullable(),
      source_url: source,
      published: z.boolean(),
      position: z.coerce.number().int().min(0).max(100),
    })
    .refine((e) => e.end_year >= e.start_year),
  milestones: z.object({
    id,
    title: text,
    body: z.string().trim().min(1).max(12000),
    year: z.coerce.number().int().min(1900).max(2100),
    era_id: id,
    source_url: source,
    published: z.boolean(),
  }),
  connections: z
    .object({
      id: z.uuid().optional(),
      source: z.string().regex(/^(era|release|track|artist|milestone):[a-zA-Z0-9-]{1,160}$/),
      target: z.string().regex(/^(era|release|track|artist|milestone):[a-zA-Z0-9-]{1,160}$/),
      label: text,
      published: z.boolean(),
    })
    .refine((e) => e.source !== e.target),
};
export type ContentKind = keyof typeof schemas;
export const contentRequest = z.object({
  kind: z.enum(['tracks', 'releases', 'artists', 'eras', 'milestones', 'connections']),
  action: z.enum(['save', 'draft', 'publish', 'unpublish']),
  record: z.record(z.string(), z.unknown()),
});
export async function adminContent() {
  const tables = ['tracks', 'releases', 'artists', 'eras', 'milestones', 'connections'] as const;
  const result: Record<string, unknown> = {};
  for (const table of tables)
    result[table] = await query(
      table === 'tracks'
        ? 'SELECT id,title,bpm,musical_key,energy,dance,valence,acoustic,popularity,explicit FROM tracks ORDER BY rank'
        : `SELECT * FROM ${table} ORDER BY ${table === 'artists' ? 'name' : table === 'eras' ? 'position' : table === 'connections' ? 'source' : 'title'}`,
    );
  result.audio = await query(
    'SELECT a.*,t.title FROM audio_assets a JOIN tracks t ON t.id=a.track_id ORDER BY a.created_at DESC',
  );
  result.drafts = await query('SELECT * FROM editorial_drafts');
  return result;
}
export async function saveContent(body: unknown) {
  const { kind, action, record } = contentRequest.parse(body);
  const row = schemas[kind].parse(record) as Record<string, unknown>;
  const editorial = ['eras', 'milestones', 'connections'].includes(kind);
  if (kind === 'connections' && !row.id) row.id = crypto.randomUUID();
  if (action === 'draft') {
    if (!editorial) throw new Error('Only editorial content supports drafts');
    if (!row.id) row.id = crypto.randomUUID();
    await query(
      'INSERT INTO editorial_drafts(kind,entity_id,content) VALUES($1,$2,$3::jsonb) ON CONFLICT(kind,entity_id) DO UPDATE SET content=EXCLUDED.content,updated_at=now()',
      [kind, row.id, JSON.stringify(row)],
    );
    return { id: row.id };
  }
  if (editorial) {
    if (action !== 'publish' && action !== 'unpublish')
      throw new Error('Publish editorial changes explicitly');
    row.published = action === 'publish';
  }
  if (kind === 'connections') {
    for (const ref of [row.source, row.target] as string[]) {
      const [type, key] = ref.split(':');
      const table = {
        era: 'eras',
        release: 'releases',
        track: 'tracks',
        artist: 'artists',
        milestone: 'milestones',
      }[type];
      if (!table || !(await query(`SELECT id FROM ${table} WHERE id=$1`, [key])).length)
        throw new Error('Connection endpoint does not exist');
    }
  }
  const keys = Object.keys(row);
  if (!editorial) {
    const fields = keys.filter((k) => k !== 'id');
    const updated = await query(
      `UPDATE ${kind} SET ${fields.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1 RETURNING id`,
      [row.id, ...fields.map((k) => row[k])],
    );
    if (!updated.length) throw new Error('Record not found');
  } else
    await query(
      `INSERT INTO ${kind} (${keys.join(',')}) VALUES(${keys.map((_, i) => '$' + (i + 1)).join(',')}) ON CONFLICT(id) DO UPDATE SET ${keys
        .filter((k) => k !== 'id')
        .map((k) => `${k}=EXCLUDED.${k}`)
        .join(',')} RETURNING id`,
      keys.map((k) => row[k]),
    );
  if (editorial && row.id)
    await query('DELETE FROM editorial_drafts WHERE kind=$1 AND entity_id=$2', [kind, row.id]);
  if (['tracks', 'artists', 'releases'].includes(kind))
    await query(
      "UPDATE tracks t SET search_document=to_tsvector('simple',t.title || ' ' || (SELECT title FROM releases WHERE id=t.release_id) || ' ' || coalesce((SELECT string_agg(a.name,' ') FROM artists a JOIN track_artists ta ON a.id=ta.artist_id WHERE ta.track_id=t.id),''))",
    );
  return { id: row.id };
}
export function adminFailure(error: unknown) {
  if (error instanceof AccessError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError)
    return NextResponse.json(
      { error: error.issues.map((i) => i.message).join('; ') },
      { status: 400 },
    );
  console.error(
    'Curator operation failed',
    error instanceof Error ? error.message : 'Unknown error',
  );
  return NextResponse.json(
    { error: 'The change could not be saved. Check the values and retry.' },
    { status: 400 },
  );
}
