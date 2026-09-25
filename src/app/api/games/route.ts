import { NextRequest, NextResponse } from 'next/server';
import { gameDeck, gameMode } from '@/lib/game-server';
import { failure } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const mode = gameMode.parse(request.nextUrl.searchParams.get('mode') || 'release');
    return NextResponse.json(
      { questions: await gameDeck(mode) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return failure(error);
  }
}
