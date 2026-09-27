// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';
import { GET, POST } from '@/app/api/admin/sync/route';
import { requireCurator, AccessError } from '@/lib/supabase';
import { syncStatus, dispatchSync, setAutomation } from '@/lib/sync-admin';
import { reviewChange } from '@/lib/catalog-sync';
vi.mock('@/lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase')>()),
  requireCurator: vi.fn(),
}));
vi.mock('@/lib/sync-admin', () => ({
  syncStatus: vi.fn(),
  dispatchSync: vi.fn(),
  setAutomation: vi.fn(),
}));
vi.mock('@/lib/catalog-sync', () => ({ reviewChange: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
});
test('every sync read or mutation is authorized before touching source data', async () => {
  vi.mocked(requireCurator).mockRejectedValue(new AccessError('Curator sign-in required', 401));
  expect((await GET(new Request('https://site.test/api/admin/sync'))).status).toBe(401);
  for (const action of ['refresh', 'automation', 'review'])
    expect(
      (
        await POST(
          new Request('https://site.test/api/admin/sync', {
            method: 'POST',
            body: JSON.stringify({ action, enabled: true }),
          }),
        )
      ).status,
    ).toBe(401);
  expect(syncStatus).not.toHaveBeenCalled();
  expect(dispatchSync).not.toHaveBeenCalled();
  expect(setAutomation).not.toHaveBeenCalled();
  expect(reviewChange).not.toHaveBeenCalled();
});
test('curator identity is forwarded to reviewed changes and invalid actions are rejected', async () => {
  vi.mocked(requireCurator).mockResolvedValue({ id: 'curator-1' } as Awaited<
    ReturnType<typeof requireCurator>
  >);
  vi.mocked(reviewChange).mockResolvedValue({ id: 'change-1' });
  const review = { id: 'change-1', action: 'reject' };
  const response = await POST(
    new Request('https://site.test/api/admin/sync', {
      method: 'POST',
      body: JSON.stringify({ action: 'review', review }),
    }),
  );
  expect(response.status).toBe(200);
  expect(reviewChange).toHaveBeenCalledWith(review, 'curator-1');
  expect(
    (
      await POST(
        new Request('https://site.test/api/admin/sync', {
          method: 'POST',
          body: JSON.stringify({ action: 'delete' }),
        }),
      )
    ).status,
  ).toBe(400);
});
