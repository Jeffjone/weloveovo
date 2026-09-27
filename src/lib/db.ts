import { runtimeDatabaseURL, queryQueue } from './database-connection';
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
    const sql = postgres(runtimeDatabaseURL(process.env.DATABASE_URL), {
      prepare: false,
      max: 1,
      idle_timeout: 5,
      max_lifetime: 60,
      connect_timeout: 10,
    });
    const run = queryQueue();
    return {
      transaction: async <T>(fn: (db: Database) => Promise<T>) =>
        run(async () => {
          const result = await sql.begin(async (tx) =>
            fn({
              query: async <R>(text: string, params: unknown[] = []) => ({
                rows: (await tx.unsafe(text, params as never[])) as unknown as R[],
              }),
              exec: async (text: string) => {
                await tx.unsafe(text);
              },
            }),
          );
          return result as T;
        }),
      query: async <T>(text: string, params: unknown[] = []) => ({
        rows: await run(async () => (await sql.unsafe(text, params as never[])) as unknown as T[]),
      }),
      exec: async (text) => {
        await run(async () => {
          await sql.unsafe(text);
        });
      },
    };
  }
  if (process.env.NODE_ENV === 'production')
    throw new Error('Production catalog requires DATABASE_URL.');
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
  await db.exec(
    await readFile(path.join(process.cwd(), 'supabase/migrations/006_editorial_sync.sql'), 'utf8'),
  );
  return {
    query: (text, params) => db.query(text, params),
    exec: (text) => db.exec(text),
    transaction: (fn) =>
      db.transaction((tx) =>
        fn({ query: (text, params) => tx.query(text, params), exec: (text) => tx.exec(text) }),
      ),
  };
}
export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await (await database()).query<T>(text, params)).rows;
}

export async function transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
  const db = await database();
  if (!db.transaction) throw new Error('Transactional database required.');
  return db.transaction(fn);
}
