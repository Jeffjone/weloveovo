import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { seed, type Database } from '../../src/lib/seed';
async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error('Set DATABASE_URL before running hosted migrations or imports.');
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 15 });
  const db: Database = {
    query: async <T>(text: string, params: unknown[] = []) => ({
      rows: (await sql.unsafe(text, params as never[])) as unknown as T[],
    }),
    exec: async (text) => {
      await sql.unsafe(text);
    },
  };
  try {
    console.log('Connecting to PostgreSQL…');
    await sql`SELECT 1`;
    console.log('Connected.');
    if (process.argv[2] === 'migrate') {
      await db.exec(
        'CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())',
      );
      for (const file of [
        '001_catalog.sql',
        '002_security.sql',
        '003_external_catalog.sql',
        '004_genius_metadata.sql',
        '005_early_records_vault.sql',
        '006_editorial_sync.sql',
      ]) {
        if (
          (await db.query('SELECT name FROM schema_migrations WHERE name=$1', [file])).rows.length
        )
          continue;
        await db.exec(await readFile('supabase/migrations/' + file, 'utf8'));
        await db.query('INSERT INTO schema_migrations(name) VALUES($1) ON CONFLICT DO NOTHING', [
          file,
        ]);
      }
      console.log('Schema and access policies applied.');
    } else if (process.argv[2] === 'seed') {
      const empty = !(await db.query('SELECT id FROM tracks LIMIT 1')).rows.length;
      await seed(db, console.log);
      if (empty) {
        await db.exec(await readFile('supabase/migrations/005_early_records_vault.sql', 'utf8'));
        await db.exec(await readFile('supabase/migrations/006_editorial_sync.sql', 'utf8'));
      }
      console.log('Catalog imported. Existing curator edits were retained.');
    } else throw new Error('Use migrate or seed.');
  } finally {
    await sql.end();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Database command failed.');
  process.exitCode = 1;
});
