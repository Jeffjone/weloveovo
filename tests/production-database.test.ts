import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
test('production refuses a missing database instead of serving fixture data', () => {
  const result = execFileSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      `
    import { database } from './src/lib/db.ts';
    try { await database(); process.exit(2); }
    catch (error) { if (error.message !== 'Production catalog requires DATABASE_URL.') process.exit(3); }
  `,
    ],
    { env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: '' }, encoding: 'utf8' },
  );
  assert.equal(result, '');
});
