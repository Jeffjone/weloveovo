import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import additions from '../data/genius-catalog.json';
import { seedCatalog, type Database } from '../src/lib/seed';
import { titleKey } from '../src/lib/genius-import';
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL.');
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 15 });
  try {
    const before = await sql`SELECT id,title,raw FROM tracks`;
    const ids = new Set(before.map((t) => t.id));
    const titles = new Map(before.map((t) => [titleKey(t.title), t.id]));
    const pending = additions.tracks.filter((t) => !ids.has(t.id));
    for (const t of pending) {
      if (titles.has(titleKey(t.title)))
        throw new Error(
          'Catalog changed since review: duplicate title found. Rebuild the import plan.',
        );
    }
    await sql.unsafe(await readFile('supabase/migrations/003_external_catalog.sql', 'utf8'));
    const db: Database = {
      query: async <T>(text: string, params: unknown[] = []) => ({
        rows: (await sql.unsafe(text, params as never[])) as unknown as T[],
      }),
      exec: async (text) => {
        await sql.unsafe(text);
      },
    };
    await seedCatalog(db, additions, console.log);
    const after = await sql`SELECT id,title,raw FROM tracks`;
    const index = new Map(after.map((t) => [t.id, t]));
    if (before.some((t) => JSON.stringify(index.get(t.id)) !== JSON.stringify(t)))
      throw new Error('Existing catalog comparison failed.');
    console.log(
      `Added ${pending.length} tracks. Total: ${after.length}. All ${before.length} existing titles and raw metadata preserved.`,
    );
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error(
    'Import failed. Inspect the reviewed plan and database connectivity before retrying.',
  );
  process.exitCode = 1;
});
