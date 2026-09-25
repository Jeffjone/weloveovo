import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStoredAudio } from '@/lib/audio-storage';
import { requireCurator, storageClient } from '@/lib/supabase';
import { adminFailure } from '@/lib/admin';
import { query } from '@/lib/db';
export async function POST(request: Request) {
  try {
    await requireCurator(request);
    const { id, action } = z
      .object({ id: z.uuid(), action: z.enum(['verify', 'publish', 'unpublish']) })
      .parse(await request.json());
    const asset = (
      await query<{
        id: string;
        track_id: string;
        object_path: string;
        size_bytes: number;
        status: string;
      }>('SELECT * FROM audio_assets WHERE id=$1', [id])
    )[0];
    if (!asset) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    if (action === 'unpublish') {
      await query("UPDATE audio_assets SET status='ready' WHERE id=$1 AND status='published'", [
        id,
      ]);
      return NextResponse.json({ ok: true });
    }
    const bucket = storageClient().storage.from('track-audio');
    if (asset.status === 'pending') {
      await verifyStoredAudio(asset, bucket);
      await query("UPDATE audio_assets SET status='ready' WHERE id=$1", [id]);
    }
    if (action === 'publish') await query('SELECT publish_audio($1::uuid)', [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return adminFailure(e);
  }
}
