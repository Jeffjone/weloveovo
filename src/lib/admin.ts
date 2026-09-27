import { z } from 'zod';
import { trackId } from './track-identity';
import { query, transaction } from './db';
import { CuratorInputError } from './curator-error';
import { editorialKinds } from './content-kinds';
import { AccessError } from './supabase';
import { NextResponse } from 'next/server';
export const id = z.string().regex(/^[a-zA-Z0-9-]{1,160}$/);
const text = z.string().trim().min(1).max(200);
const source = z
  .string()
  .url()
  .refine((s) => {
    try {
      return new URL(s).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Use an HTTPS source');
const pct = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.coerce.number().int().min(0).max(100).nullable(),
);
export const schemas = {
  tracks: z.object({
    id: trackId,
    title: text,
    bpm: z.preprocess(
      (v) => (v === '' || v == null ? null : v),
      z.coerce.number().int().min(0).max(400).nullable(),
    ),
    musical_key: z.string().max(30).nullable(),
    energy: pct,
    dance: pct,
    valence: pct,
    acoustic: pct,
    popularity: pct,
    explicit: z.boolean().nullable(),
  }),
  releases: z.object({
    id,
    title: text,
    release_date: z.string().regex(/^(?:\d{4}(?:-\d{2}(?:-\d{2})?)?)?$/),
    featured: z.boolean(),
    cover_url: z
      .union([
        z
          .string()
          .url()
          .refine((s) => s.startsWith('https:'), 'Use HTTPS artwork'),
        z.string().regex(/^\/assets\/[a-zA-Z0-9/_.-]+$/),
      ])
      .nullable()
      .optional(),
  }),
  artists: z.object({ id, name: text }),
  stories: z.object({
    id: z.enum(['home', 'legacy']),
    title: text,
    body: z.string().trim().min(1).max(12000),
    source_url: z.union([source, z.literal('')]),
    published: z.boolean(),
  }),
  song_notes: z.object({
    id: trackId,
    title: text,
    body: z.string().trim().min(1).max(12000),
    source_url: source,
    published: z.boolean(),
  }),
  homepage_features: z.object({
    id: z.enum(['records', 'eras', 'listening-room', 'legacy', 'vault']),
    release_id: id,
    published: z.boolean(),
  }),
  era_releases: z.object({
    id,
    era_id: id,
    release_id: id,
    position: z.coerce.number().int().min(0).max(10000),
    published: z.boolean(),
  }),
  vault_entries: z.object({
    id: trackId,
    category: z.enum(['unreleased', 'leaked', 'snippet', 'freestyle']),
    note: z.string().trim().min(1).max(4000),
    source_url: source,
    published: z.boolean(),
  }),
  eras: z
    .object({
      id,
      label: text,
      title: text,
      body: z.string().trim().min(1).max(12000),
      start_year: z.coerce.number().int().min(1900).max(2100),
      end_year: z.coerce.number().int().min(1900).max(2100),
      release_id: id,
      track_id: trackId.nullable(),
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
  kind: z.enum(['tracks', 'releases', 'artists', ...editorialKinds]),
  action: z.enum(['save', 'draft', 'publish', 'unpublish', 'restore']),
  record: z.record(z.string(), z.unknown()),
});
export async function adminContent() {
  const tables = ['tracks', 'releases', 'artists', ...editorialKinds] as const;
  const result: Record<string, unknown> = {};
  for (const table of tables)
    result[table] = await query(
      table === 'tracks'
        ? 'SELECT id,title,bpm,musical_key,energy,dance,valence,acoustic,popularity,explicit FROM tracks ORDER BY rank'
        : table === 'vault_entries'
          ? 'SELECT *,track_id AS id FROM vault_entries ORDER BY track_id'
          : `SELECT * FROM ${table} ORDER BY ${table === 'artists' ? 'name' : ['eras', 'era_releases'].includes(table) ? 'position' : table === 'connections' ? 'source' : table === 'homepage_features' ? 'id' : 'title'}`,
    );
  result.audio = await query(
    'SELECT a.*,t.title FROM audio_assets a JOIN tracks t ON t.id=a.track_id ORDER BY a.created_at DESC',
  );
  result.revisions = await query(
    'SELECT * FROM content_revisions ORDER BY created_at DESC LIMIT 500',
  );
  result.overrides = await query('SELECT * FROM field_overrides ORDER BY updated_at DESC');
  result.drafts = await query('SELECT * FROM editorial_drafts');
  return result;
}
export async function saveContent(body: unknown, actor = 'curator') {
  const { kind, action, record } = contentRequest.parse(body);
  const editorial = (editorialKinds as readonly string[]).includes(kind);
  const key = kind === 'vault_entries' ? 'track_id' : 'id';
  return transaction(async (db) => {
    await db.query('SELECT id FROM catalog_write_lock WHERE id=true FOR UPDATE');
    let input = record;
    if (action === 'restore') {
      const revisionId = z.uuid().parse(record.revision_id);
      const previous = (
        await db.query<{ content: Record<string, unknown> }>(
          'SELECT content FROM content_revisions WHERE id=$1 AND kind=$2',
          [revisionId, kind],
        )
      ).rows[0];
      if (!previous) throw new CuratorInputError('Revision not found');
      input = previous.content;
    }
    const row = schemas[kind].parse(input) as Record<string, unknown>;
    if (kind === 'connections' && !row.id) row.id = crypto.randomUUID();
    if (action === 'draft') {
      if (!editorial) throw new CuratorInputError('Only editorial content supports drafts');
      await db.query(
        'INSERT INTO editorial_drafts(kind,entity_id,content) VALUES($1,$2,$3::text::jsonb) ON CONFLICT(kind,entity_id) DO UPDATE SET content=EXCLUDED.content,updated_at=now()',
        [kind, row.id, JSON.stringify(row)],
      );
      return { id: row.id };
    }
    if (editorial) {
      if (!['publish', 'unpublish', 'restore'].includes(action))
        throw new CuratorInputError('Publish editorial changes explicitly');
      if (action !== 'restore') row.published = action === 'publish';
    }
    if (kind === 'connections') {
      for (const ref of [row.source, row.target] as string[]) {
        const [type, entity] = ref.split(':');
        const table = {
          era: 'eras',
          release: 'releases',
          track: 'tracks',
          artist: 'artists',
          milestone: 'milestones',
        }[type];
        if (
          !table ||
          !(await db.query(`SELECT id FROM ${table} WHERE id=$1`, [entity])).rows.length
        )
          throw new CuratorInputError('Connection endpoint does not exist');
      }
    }
    const entity = row.id;
    const old = (
      await db.query<Record<string, unknown>>(`SELECT * FROM ${kind} WHERE ${key}=$1`, [entity])
    ).rows[0];
    if (old) {
      const content = kind === 'vault_entries' ? { ...old, id: old.track_id } : old;
      // Capture the original before the first edit as well as every subsequent published state.
      await db.query(
        'INSERT INTO content_revisions(kind,entity_id,content,actor) SELECT $1,$2,$3::text::jsonb,$4 WHERE NOT EXISTS(SELECT 1 FROM content_revisions WHERE kind=$1 AND entity_id=$2)',
        [kind, entity, JSON.stringify(content), actor],
      );
    }
    const stored = { ...row };
    if (kind === 'vault_entries') {
      stored.track_id = entity;
      delete stored.id;
    }
    const keys = Object.keys(stored);
    if (!editorial) {
      const fields = keys.filter((k) => k !== 'id');
      const updated = await db.query(
        `UPDATE ${kind} SET ${fields.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1 RETURNING id`,
        [entity, ...fields.map((k) => row[k])],
      );
      if (!updated.rows.length) throw new CuratorInputError('Record not found');
      for (const field of fields) {
        if (JSON.stringify(old?.[field]) !== JSON.stringify(row[field]))
          await db.query(
            'INSERT INTO field_overrides(kind,entity_id,field,value) VALUES($1,$2,$3,$4::text::jsonb) ON CONFLICT(kind,entity_id,field) DO UPDATE SET value=EXCLUDED.value,updated_at=now()',
            [kind, entity, field, JSON.stringify(row[field])],
          );
      }
    } else {
      await db.query(
        `INSERT INTO ${kind} (${keys.join(',')}) VALUES(${keys.map((_, i) => '$' + (i + 1)).join(',')}) ON CONFLICT(${key}) DO UPDATE SET ${keys
          .filter((k) => k !== key)
          .map((k) => `${k}=EXCLUDED.${k}`)
          .join(',')}`,
        keys.map((k) => stored[k]),
      );
      await db.query('DELETE FROM editorial_drafts WHERE kind=$1 AND entity_id=$2', [kind, entity]);
    }
    await db.query(
      'INSERT INTO content_revisions(kind,entity_id,content,actor) VALUES($1,$2,$3::text::jsonb,$4)',
      [kind, entity, JSON.stringify(row), actor],
    );
    if (['tracks', 'artists', 'releases'].includes(kind))
      await db.exec(
        "UPDATE tracks t SET search_document=to_tsvector('simple',t.title || ' ' || (SELECT title FROM releases WHERE id=t.release_id) || ' ' || coalesce((SELECT string_agg(a.name,' ') FROM artists a JOIN track_artists ta ON a.id=ta.artist_id WHERE ta.track_id=t.id),''))",
      );
    return { id: entity };
  });
}
export function adminFailure(error: unknown) {
  if (error instanceof CuratorInputError)
    return NextResponse.json({ error: error.message }, { status: 400 });
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
