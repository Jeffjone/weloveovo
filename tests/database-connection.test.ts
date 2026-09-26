import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtimeDatabaseURL, queryQueue } from '../src/lib/database-connection';
test('web runtime selects transaction pooling while preserving credentials and options', () => {
  const connection =
    'postgresql://postgres.project:p%40ss%2Fword@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=require';
  const parsed = new URL(runtimeDatabaseURL(connection));
  assert.equal(parsed.port, '6543');
  assert.equal(parsed.password, 'p%40ss%2Fword');
  assert.equal(parsed.username, 'postgres.project');
  assert.equal(parsed.search, '?sslmode=require');
  assert.equal(
    new URL(runtimeDatabaseURL('postgres://u:p@aws-0-region.pooler.supabase.com/postgres')).port,
    '6543',
  );
});
test('direct, local, transaction and unrelated hosts are preserved; invalid URLs do not leak secrets', () => {
  for (const url of [
    'postgres://u:p@localhost:5432/db',
    'postgres://u:p@db.project.supabase.co:5432/postgres',
    'postgres://u:p@aws-0-region.pooler.supabase.com:6543/postgres',
    'postgres://u:p@pooler.supabase.com.example.org:5432/db',
  ])
    assert.equal(runtimeDatabaseURL(url), url);
  assert.throws(() => runtimeDatabaseURL('private-value'), {
    message: 'DATABASE_URL must be a valid PostgreSQL connection URL.',
  });
});

test('concurrent callers are serialized and a failed query does not block later requests', async () => {
  const run = queryQueue();
  const order: string[] = [];
  const first = run(async () => {
    order.push('first');
    await new Promise((resolve) => setTimeout(resolve, 5));
    order.push('done');
    return 1;
  });
  const failed = run(async () => {
    order.push('failed');
    throw new Error('fixture');
  });
  const last = run(async () => {
    order.push('last');
    return 3;
  });
  const results = await Promise.allSettled([first, failed, last]);
  assert.deepEqual(order, ['first', 'done', 'failed', 'last']);
  assert.equal(results[1].status, 'rejected');
  assert.deepEqual(results[2], { status: 'fulfilled', value: 3 });
});
