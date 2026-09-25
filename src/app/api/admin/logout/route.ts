import { NextResponse } from 'next/server';
import { authClient, requireCurator } from '@/lib/supabase';
import { adminFailure } from '@/lib/admin';
export async function POST(request: Request) {
  try {
    await requireCurator(request);
    await (await authClient()).auth.signOut();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return adminFailure(e);
  }
}
