import { CuratorInputError } from './curator-error';
import { runSync } from './sync-worker';
import { createGeniusSyncClient } from './integrations/genius-sync-client';
import { query } from './db';
export async function syncStatus() {
  const [settings, runs, counts] = await Promise.all([
    query<{ automation_enabled: boolean }>(
      'SELECT automation_enabled FROM sync_settings WHERE id=true',
    ),
    query(
      'SELECT id,mode,status,started_at,updated_at,completed_at,checked,error FROM sync_runs ORDER BY started_at DESC LIMIT 12',
    ),
    query<{ count: number }>(
      "SELECT count(*)::int AS count FROM source_changes WHERE status='pending'",
    ),
  ]);
  const changes = await query(
    "SELECT c.*,s.snapshot->>'url' AS source_url FROM source_changes c JOIN source_songs s USING(genius_id) WHERE c.status='pending' ORDER BY c.created_at,c.id LIMIT 50",
  );
  return {
    settings: settings[0],
    runs,
    changes,
    pending: counts[0].count,
    dispatchConfigured: Boolean(
      process.env.GITHUB_ACTIONS_TOKEN || process.env.GENIUS_ACCESS_TOKEN,
    ),
  };
}
export async function dispatchSync() {
  const token = process.env.GITHUB_ACTIONS_TOKEN;
  if (!token) {
    const run = await runSync(createGeniusSyncClient(process.env.GENIUS_ACCESS_TOKEN || ''), {
      maxItems: 25,
      maxMilliseconds: 20_000,
    });
    return {
      message:
        run.status === 'complete'
          ? 'Catalog refresh complete.'
          : 'Checkpoint saved. Continuing the catalog refresh…',
      more: run.status === 'paused',
    };
  }
  const response = await fetch(
    'https://api.github.com/repos/Jeffjone/weloveovo/actions/workflows/catalog-sync.yml/dispatches',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: 'main', inputs: { review_only: 'false' } }),
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    },
  );
  if (!response.ok)
    throw new CuratorInputError(
      'Could not start the workflow. Check the server-side workflow connection.',
    );
  return {
    message:
      'Refresh requested. GitHub will queue the worker; run status appears here when it starts.',
  };
}
export async function setAutomation(enabled: boolean) {
  if (
    enabled &&
    !(await query("SELECT id FROM sync_runs WHERE mode='review' AND status='complete' LIMIT 1"))
      .length
  )
    throw new CuratorInputError(
      'Complete and inspect an initial review-only sync before enabling automation.',
    );
  await query('UPDATE sync_settings SET automation_enabled=$1 WHERE id=true', [enabled]);
  return {
    message: enabled
      ? 'Daily artwork and source-link updates enabled. Other changes still require review.'
      : 'Automatic publishing disabled; future runs propose changes only.',
  };
}
