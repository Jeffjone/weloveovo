import { NextResponse } from 'next/server';
import { requireCurator, storageClient } from '@/lib/supabase';
import { adminFailure } from '@/lib/admin';
import { uploadSchema } from '@/lib/audio';
import { getTrack } from '@/lib/catalog';
import { query } from '@/lib/db';
export async function POST(request: Request) {
  try {
    await requireCurator(request);
    const input = uploadSchema.parse(await request.json());
    if (!(await getTrack(input.trackId)))
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    const id = crypto.randomUUID();
    const path = `${input.trackId}/${id}.mp3`;
    const { data, error } = await storageClient()
      .storage.from('track-audio')
      .createSignedUploadUrl(path);
    if (error || !data) throw error;
    await query(
      'INSERT INTO audio_assets(id,track_id,object_path,filename,size_bytes) VALUES($1,$2,$3,$4,$5)',
      [id, input.trackId, path, input.filename, input.size],
    );
    return NextResponse.json({
      id,
      path,
      token: data.token,
      endpoint:
        process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('.supabase.co', '.storage.supabase.co') +
        '/storage/v1/upload/resumable',
    });
  } catch (e) {
    return adminFailure(e);
  }
}
