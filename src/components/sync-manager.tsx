'use client';
import { useEffect, useState, useRef } from 'react';
import { ui } from './ui';
import type { ChangePayload } from '@/lib/catalog-sync';
type Change = { id: string; kind: string; payload: ChangePayload; source_url: string | null };
type Status = {
  settings: { automation_enabled: boolean };
  pending: number;
  dispatchConfigured: boolean;
  changes: Change[];
  runs: {
    id: string;
    status: string;
    mode: string;
    checked: number;
    started_at: string;
    completed_at: string | null;
    error: string | null;
  }[];
};
async function request(init?: RequestInit) {
  const r = await fetch('/api/admin/sync', { cache: 'no-store', ...init });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Sync status unavailable.');
  return data;
}
export function SyncManager() {
  const stop = useRef(false);
  useEffect(
    () => () => {
      stop.current = true;
    },
    [],
  );
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function refresh() {
    try {
      setStatus(await request());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function act(body: unknown) {
    setBusy(true);
    setError('');
    try {
      stop.current = false;
      let more = true;
      while (more && !stop.current) {
        const result = await request({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        setMessage(result.message || 'Review saved.');
        await refresh();
        more = Boolean(result.more);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details style={{ margin: '24px 0' }}>
      <summary>Catalog Sources &amp; Review Queue {status ? `(${status.pending})` : ''}</summary>
      <p>
        Source checks run daily when the worker is connected. Public pages keep using the published
        catalog.
      </p>
      <div className={ui.actions}>
        <button className={ui.outlineButton} disabled={busy} onClick={() => void refresh()}>
          Reload Status
        </button>
        <button
          className={ui.primaryButton}
          disabled={busy || !status?.dispatchConfigured}
          onClick={() => void act({ action: 'refresh' })}
        >
          Refresh Catalog
        </button>
        {status && (
          <button
            disabled={busy}
            className={ui.outlineButton}
            onClick={() =>
              void act({ action: 'automation', enabled: !status.settings.automation_enabled })
            }
          >
            {status.settings.automation_enabled
              ? 'Pause Automatic Updates'
              : 'Enable Automatic Updates'}
          </button>
        )}
      </div>
      {status && !status.dispatchConfigured && (
        <p>The background worker connection has not been configured.</p>
      )}
      {busy && (
        <button
          className={ui.outlineButton}
          onClick={() => {
            stop.current = true;
            setMessage('Stopping after the current checkpoint.');
          }}
        >
          Stop Refresh
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      <p role="status">{message}</p>
      {status?.runs.map((run) => (
        <p key={run.id}>
          {run.mode} / {run.status} · {run.checked} checked · Started{' '}
          {new Date(run.started_at).toLocaleString()}
          {run.completed_at ? ` · Completed ${new Date(run.completed_at).toLocaleString()}` : ''}
          {run.error ? ` · ${run.error}` : ''}
        </p>
      ))}
      {status?.changes.map((change) => (
        <ChangeReview
          key={change.id}
          change={change}
          busy={busy}
          onReview={(review) => act({ action: 'review', review })}
        />
      ))}
      {status?.pending === 0 && <p>No changes awaiting review.</p>}
      {status && status.pending > status.changes.length && (
        <p>
          Showing the oldest {status.changes.length} of {status.pending} pending changes. More
          appear as you review these.
        </p>
      )}
    </details>
  );
}
function ChangeReview({
  change,
  busy,
  onReview,
}: {
  change: Change;
  busy: boolean;
  onReview: (value: unknown) => Promise<void>;
}) {
  const [target, setTarget] = useState(''),
    [fields, setFields] = useState<string[]>([]);
  return (
    <article style={{ borderTop: '1px solid #536f89', padding: '20px 0' }}>
      <h3>{change.payload.title}</h3>
      <p>
        {change.kind} · {change.payload.reason}
      </p>
      {change.source_url?.startsWith('https://genius.com/') && (
        <a href={change.source_url} target="_blank" rel="noopener noreferrer">
          Compare on Genius ↗
        </a>
      )}
      {change.kind === 'link' && (
        <label>
          Existing Recording
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose a verified match…</option>
            {change.payload.candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.id})
              </option>
            ))}
          </select>
        </label>
      )}
      {change.kind === 'new' && (
        <div>
          <p>Release: {change.payload.source?.album?.name || 'Unassigned'}</p>
          <p>
            Recording date: {change.payload.source?.release_date || 'Unknown'} (not the album
            release date)
          </p>
          <p>
            Credits:{' '}
            {[
              ...(change.payload.source?.primary_artists || []),
              ...(change.payload.source?.featured_artists || []),
            ]
              .map((a) => a.name)
              .join(', ')}
          </p>
        </div>
      )}
      {Object.entries(change.payload.changes).map(([key, value]) => (
        <label key={key} style={{ display: 'block', margin: '10px 0' }}>
          <input
            type="checkbox"
            checked={fields.includes(key)}
            onChange={(e) =>
              setFields(e.target.checked ? [...fields, key] : fields.filter((f) => f !== key))
            }
          />
          {key.replaceAll('_', ' ')}: {JSON.stringify(value.before)} → {JSON.stringify(value.after)}
        </label>
      ))}
      <div className={ui.actions}>
        <button
          className={ui.primaryButton}
          disabled={
            busy ||
            (change.kind === 'link' && !target) ||
            (['metadata', 'unavailable'].includes(change.kind) && !fields.length)
          }
          onClick={() =>
            void onReview({
              id: change.id,
              action: 'approve',
              ...(target ? { target } : {}),
              fields,
            })
          }
        >
          {change.kind === 'link'
            ? 'Confirm Match'
            : change.kind === 'new'
              ? 'Publish New Song'
              : 'Publish Selected Changes'}
        </button>
        <button
          className={ui.outlineButton}
          disabled={busy}
          onClick={() => void onReview({ id: change.id, action: 'reject' })}
        >
          Reject
        </button>
      </div>
    </article>
  );
}
