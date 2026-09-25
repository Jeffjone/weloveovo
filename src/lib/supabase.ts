import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { query } from './db';
export function configured() {
  return Boolean(
    process.env.DATABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
export function allowedEmail(email: string) {
  return (process.env.CURATOR_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
export async function authClient() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            /* Server component refresh is handled by the proxy. */
          }
        },
      },
    },
  );
}
export function storageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
export async function curator() {
  if (!configured()) return null;
  const {
    data: { user },
    error,
  } = await (await authClient()).auth.getUser();
  if (error || !user?.email || !allowedEmail(user.email)) return null;
  return (await query('SELECT user_id FROM curators WHERE user_id=$1', [user.id])).length
    ? user
    : null;
}
export class AccessError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}
export async function requireCurator(request?: Request) {
  if (request && request.method !== 'GET') {
    const origin = request.headers.get('origin');
    const expected = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000').origin;
    if (!origin || origin !== expected) throw new AccessError('Invalid request origin');
  }
  const user = await curator();
  if (!user) throw new AccessError('Curator sign-in required', 401);
  return user;
}
