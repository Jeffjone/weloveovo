import { NextRequest, NextResponse } from 'next/server';
import { searchTracks } from '@/lib/catalog';
import { failure } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await searchTracks(Object.fromEntries(request.nextUrl.searchParams)));
  } catch (error) {
    return failure(error);
  }
}
