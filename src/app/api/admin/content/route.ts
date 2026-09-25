import { NextResponse } from 'next/server';
import { requireCurator } from '@/lib/supabase';
import { adminContent, adminFailure, saveContent } from '@/lib/admin';
export async function GET(request: Request) {
  try {
    await requireCurator(request);
    return NextResponse.json(await adminContent(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return adminFailure(e);
  }
}
export async function POST(request: Request) {
  try {
    await requireCurator(request);
    return NextResponse.json(await saveContent(await request.json()));
  } catch (e) {
    return adminFailure(e);
  }
}
