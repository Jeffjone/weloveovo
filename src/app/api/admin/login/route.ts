import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authClient, allowedEmail, configured, AccessError } from '@/lib/supabase';
import { adminFailure } from '@/lib/admin';
export async function POST(request: Request) {
  try {
    if (!configured()) throw new AccessError('Hosted curator access is not configured.', 503);
    const site = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000').origin;
    if (request.headers.get('origin') !== site) throw new AccessError('Invalid request origin');
    const { email } = z.object({ email: z.email() }).parse(await request.json());
    if (!allowedEmail(email)) throw new AccessError('This area is for invited curators.');
    const { error } = await (
      await authClient()
    ).auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: site + '/auth/confirm' },
    });
    if (error) throw error;
    return NextResponse.json({ message: 'Check your email for a sign-in link.' });
  } catch (e) {
    return adminFailure(e);
  }
}
