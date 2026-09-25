import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('hosted policies deny anonymous catalog writes, drafts and audio access', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`,
    );
    await db.exec(await readFile('supabase/migrations/001_catalog.sql', 'utf8'));
    await db.exec(await readFile('supabase/migrations/002_security.sql', 'utf8'));
    await db.exec('SET ROLE anon');
    for (const sql of [
      'SELECT * FROM editorial_drafts',
      'SELECT * FROM audio_assets',
      'SELECT * FROM curators',
      "INSERT INTO artists(id,name) VALUES('bad','bad')",
      "SELECT publish_audio('00000000-0000-0000-0000-000000000000')",
    ])
      await assert.rejects(() => db.query(sql));
    await db.exec('RESET ROLE');
    const uid = '00000000-0000-0000-0000-000000000001';
    await db.query('INSERT INTO curators VALUES($1)', [uid]);
    await db.exec('SET ROLE authenticated');
    assert.equal((await db.query('SELECT * FROM curators')).rows.length, 0);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid]);
    assert.equal((await db.query('SELECT * FROM curators')).rows.length, 1);
    await assert.rejects(() =>
      db.query("INSERT INTO curators VALUES('00000000-0000-0000-0000-000000000002')"),
    );
    await db.exec('RESET ROLE');
    assert.equal(
      (await db.query<{ public: boolean }>('SELECT public FROM storage.buckets')).rows[0].public,
      false,
    );
  } finally {
    await db.close();
  }
});
