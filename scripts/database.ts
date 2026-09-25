import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { seed, type Database } from '../src/lib/seed';
async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error('Set DATABASE_URL before running hosted migrations or imports.');
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  const db: Database = {
    query: async <T>(text: string, params: unknown[] = []) => ({
      rows: (await sql.unsafe(text, params as never[])) as unknown as T[],
    }),
    exec: async (text) => {
      await sql.unsafe(text);
    },
  };
  try {
    if (process.argv[2] === 'migrate') {
      for (const file of ['001_catalog.sql', '002_security.sql'])
        await db.exec(await readFile('supabase/migrations/' + file, 'utf8'));
      console.log('Schema and access policies applied.');
    } else if (process.argv[2] === 'seed') {
      await seed(db);
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
