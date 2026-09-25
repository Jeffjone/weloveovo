import { NextResponse } from 'next/server';
import { related, getTrack } from '@/lib/catalog';
import { failure } from '@/lib/http';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await getTrack(id)))
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    return NextResponse.json(await related(id));
  } catch (error) {
    return failure(error);
  }
}
