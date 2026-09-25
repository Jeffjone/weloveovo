import { NextRequest, NextResponse } from 'next/server';
import { graph } from '@/lib/catalog';
import { failure } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const root = request.nextUrl.searchParams.get('root');
    if (root && !/^(era|release|track):[a-zA-Z0-9-]{1,160}$/.test(root))
      return NextResponse.json({ error: 'Invalid map location' }, { status: 400 });
    return NextResponse.json(await graph(root));
  } catch (error) {
    return failure(error);
  }
}
