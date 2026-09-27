import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCurator } from '@/lib/supabase';
import { adminFailure } from '@/lib/admin';
import { reviewChange } from '@/lib/catalog-sync';
import { syncStatus, dispatchSync, setAutomation } from '@/lib/sync-admin';
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    await requireCurator(request);
    return NextResponse.json(await syncStatus(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return adminFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await requireCurator(request);
    const input = z
      .object({
        action: z.enum(['refresh', 'automation', 'review']),
        enabled: z.boolean().optional(),
        review: z.unknown().optional(),
      })
      .parse(await request.json());
    const result =
      input.action === 'refresh'
        ? await dispatchSync()
        : input.action === 'automation'
          ? await setAutomation(z.boolean().parse(input.enabled))
          : await reviewChange(input.review, user.id);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return adminFailure(error);
  }
}
