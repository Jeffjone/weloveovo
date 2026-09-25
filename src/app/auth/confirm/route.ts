import { NextRequest, NextResponse } from 'next/server';
import { authClient, configured } from '@/lib/supabase';
export async function GET(request: NextRequest) {
  if (!configured()) return NextResponse.redirect(new URL('/admin', request.url));
  const token = request.nextUrl.searchParams.get('token_hash');
  const code = request.nextUrl.searchParams.get('code');
  const client = await authClient();
  if (token) {
    const { error } = await client.auth.verifyOtp({ token_hash: token, type: 'email' });
    if (!error) return NextResponse.redirect(new URL('/admin', request.url));
  } else if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/admin', request.url));
  }
  return NextResponse.redirect(new URL('/admin?error=expired', request.url));
}
