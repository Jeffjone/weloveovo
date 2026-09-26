import { NextResponse } from 'next/server';
import { matchSong, songGuess } from '@/lib/song-memory-server';
import { failure } from '@/lib/http';
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Enter a song title.' }, { status: 400 });
    }
    const { title } = songGuess.parse(body);
    return NextResponse.json(
      { song: await matchSong(title) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return failure(error);
  }
}
