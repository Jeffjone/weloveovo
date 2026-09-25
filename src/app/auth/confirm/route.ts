import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { configured } from '@/lib/supabase';
export async function GET(request: NextRequest) {
  // Return this same response so session cookies reach the browser before /admin loads.
  const response = NextResponse.redirect(new URL('/admin', request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  if (!configured()) return response;
  const token = request.nextUrl.searchParams.get('token_hash');
  const code = request.nextUrl.searchParams.get('code');
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items, headers) => {
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    },
  );
  if (token) {
    const { error } = await client.auth.verifyOtp({ token_hash: token, type: 'email' });
    if (!error) return response;
  } else if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }
  response.headers.set('Location', new URL('/admin?error=expired', request.url).toString());
  return response;
}
