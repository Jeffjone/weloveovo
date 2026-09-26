import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { seed, type Database } from './seed';
const scope = globalThis as typeof globalThis & { catalogDatabase?: Promise<Database> };
export function hosted() {
  return Boolean(process.env.DATABASE_URL);
}
export async function database(): Promise<Database> {
  if (!scope.catalogDatabase)
    scope.catalogDatabase = initialize().catch((error) => {
      scope.catalogDatabase = undefined;
      throw error;
    });
  return scope.catalogDatabase;
}
async function initialize(): Promise<Database> {
  if (process.env.DATABASE_URL) {
    const postgres = (await import('postgres')).default;
    const sql = postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    return {
      query: async <T>(text: string, params: unknown[] = []) => ({
        rows: (await sql.unsafe(text, params as never[])) as unknown as T[],
      }),
      exec: async (text) => {
        await sql.unsafe(text);
      },
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(
    await readFile(path.join(process.cwd(), 'supabase/migrations/001_catalog.sql'), 'utf8'),
  );
  await db.exec(
    await readFile(
      path.join(process.cwd(), 'supabase/migrations/003_external_catalog.sql'),
      'utf8',
    ),
  );
  await seed(db);
  await db.exec(
    await readFile(
      path.join(process.cwd(), 'supabase/migrations/005_early_records_vault.sql'),
      'utf8',
    ),
  );
  return db;
}
export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await (await database()).query<T>(text, params)).rows;
}
