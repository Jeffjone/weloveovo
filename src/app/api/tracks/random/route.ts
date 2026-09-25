import { NextRequest, NextResponse } from 'next/server';
import { randomTracks, trackId } from '@/lib/catalog';
import { failure } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const exclude = trackId
      .optional()
      .parse(request.nextUrl.searchParams.get('exclude') || undefined);
    const track = (await randomTracks(1, exclude))[0];
    return NextResponse.json(
      track ? { id: track.id } : { error: 'No songs are available right now.' },
      { status: track ? 200 : 404, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return failure(error);
  }
}
