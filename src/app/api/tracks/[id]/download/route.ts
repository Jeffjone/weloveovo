import { NextResponse } from 'next/server';
import { trackId } from '@/lib/catalog';
import { query } from '@/lib/db';
import { configured, storageClient } from '@/lib/supabase';
import { audioDownloadURL } from '@/lib/audio-storage';
import { failure } from '@/lib/http';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!trackId.safeParse(id).success)
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    const asset = (
      await query<{ object_path: string; title: string }>(
        "SELECT a.object_path,t.title FROM audio_assets a JOIN tracks t ON t.id=a.track_id WHERE a.track_id=$1 AND a.status='published'",
        [id],
      )
    )[0];
    if (!asset || !configured())
      return NextResponse.json(
        { error: 'An MP3 has not been published for this track.' },
        { status: 404 },
      );
    const url = await audioDownloadURL(asset, storageClient().storage.from('track-audio'));
    if (request.headers.get('accept')?.includes('application/json'))
      return NextResponse.json({ url }, { headers: { 'Cache-Control': 'private, no-store' } });
    return new NextResponse(null, {
      status: 307,
      headers: { Location: url, 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return failure(e);
  }
}
