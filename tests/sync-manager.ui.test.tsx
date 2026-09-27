import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncManager } from '@/components/sync-manager';
vi.mock('@/components/ui', () => ({ ui: {} }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
test('metadata changes require explicit field selection and only selected fields are submitted', async () => {
  const status = {
    settings: { automation_enabled: false },
    runs: [],
    pending: 1,
    dispatchConfigured: true,
    changes: [
      {
        id: 'change',
        kind: 'metadata',
        source_url: 'https://genius.com/Drake-test-lyrics',
        payload: {
          title: 'Test Song',
          reason: 'Review metadata',
          changes: {
            title: { before: 'Old', after: 'New' },
            source_release_date: { before: null, after: '2020' },
          },
          candidates: [],
          source: null,
        },
      },
    ],
  };
  const writes: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, init) => {
      if (init?.method === 'POST') {
        writes.push(JSON.parse(init.body));
        return { ok: true, json: async () => ({}) };
      }
      return { ok: true, json: async () => status };
    }),
  );
  render(<SyncManager />);
  await screen.findByText('Test Song');
  await userEvent.click(screen.getByText(/Catalog Sources & Review Queue/));
  const approve = screen.getByRole('button', { name: 'Publish Selected Changes' });
  expect((approve as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole('checkbox', { name: /title:/ }));
  await userEvent.click(approve);
  await waitFor(() =>
    expect(writes).toEqual([
      { action: 'review', review: { id: 'change', action: 'approve', fields: ['title'] } },
    ]),
  );
});
test('refresh follows checkpoint responses until completion and reports errors without publishing', async () => {
  let batches = 0;
  const status = {
    settings: { automation_enabled: false },
    runs: [],
    pending: 0,
    dispatchConfigured: true,
    changes: [],
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, init) => ({
      ok: true,
      json: async () =>
        init?.method === 'POST'
          ? {
              more: ++batches < 2,
              message: batches < 2 ? 'Checkpoint saved' : 'Catalog refresh complete.',
            }
          : status,
    })),
  );
  render(<SyncManager />);
  await screen.findByText('No changes awaiting review.');
  await userEvent.click(screen.getByText(/Catalog Sources & Review Queue/));
  await userEvent.click(screen.getByRole('button', { name: 'Refresh Catalog' }));
  await screen.findByText('Catalog refresh complete.');
  expect(batches).toBe(2);
});
