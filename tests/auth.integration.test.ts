// @vitest-environment node
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { GET } from '@/app/auth/confirm/route';
import { curator } from '@/lib/supabase';
import { proxy } from '@/proxy';
import type { CookieMethodsServer } from '@supabase/ssr';

const state = vi.hoisted(() => ({
  cookies: [] as { name: string; value: string }[],
  fail: false,
  exchanges: [] as string[],
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => state.cookies,
    set: () => {
      throw new Error('Server component cookies are read-only');
    },
  }),
}));
vi.mock('@/lib/db', () => ({ query: async () => [{ user_id: 'curator-id' }] }));
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn() }));
beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgresql://fixture');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fixture.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'fixture-public-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture-server-key');
  vi.stubEnv('CURATOR_EMAILS', 'curator@example.test');
  state.cookies = [];
  state.fail = false;
  state.exchanges = [];
  vi.mocked(createServerClient).mockImplementation((_url, _key, options) => {
    const cookies = options!.cookies as CookieMethodsServer;
    const exchange = async (kind: string) => {
      state.exchanges.push(kind);
      if (state.fail) return { error: new Error('Expired token') };
      await cookies.setAll!(
        [
          {
            name: 'sb-fixture-auth-token.0',
            value: 'session-part-one',
            options: { path: '/', sameSite: 'lax', secure: true },
          },
          {
            name: 'sb-fixture-auth-token.1',
            value: 'session-part-two',
            options: { path: '/', sameSite: 'lax', secure: true },
          },
          {
            name: 'sb-fixture-auth-token-code-verifier',
            value: '',
            options: { path: '/', maxAge: 0 },
          },
        ],
        { 'Cache-Control': 'private, no-store', Expires: '0', Pragma: 'no-cache' },
      );
      return { error: null };
    };
    return {
      auth: {
        verifyOtp: async () => exchange('token'),
        exchangeCodeForSession: async () => {
          expect((await cookies.getAll!())?.some((c) => c.name.endsWith('code-verifier'))).toBe(
            true,
          );
          return exchange('code');
        },
        getUser: async () => {
          const jar = await cookies.getAll!();
          const signedIn =
            jar?.some((c) => c.value === 'session-part-one') &&
            jar?.some((c) => c.value === 'session-part-two');
          return {
            error: null,
            data: { user: signedIn ? { id: 'curator-id', email: 'curator@example.test' } : null },
          };
        },
        getClaims: vi.fn(),
      },
    } as unknown as ReturnType<typeof createServerClient>;
  });
});
afterEach(() => vi.unstubAllEnvs());

test.each(['token_hash=test-token&type=email', 'code=test-code'])(
  'callback persists session on redirect and authorizes the first studio request: %s',
  async (params) => {
    const request = new NextRequest('https://weloveovo.com/auth/confirm?' + params, {
      headers: { cookie: 'sb-fixture-auth-token-code-verifier=fixture-verifier' },
    });
    const response = await GET(request);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://weloveovo.com/admin');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.cookies.get('sb-fixture-auth-token.0')?.sameSite).toBe('lax');
    expect(response.cookies.get('sb-fixture-auth-token.0')?.secure).toBe(true);
    expect(response.cookies.get('sb-fixture-auth-token-code-verifier')?.maxAge).toBe(0);
    // Model the browser following Location with the response cookies, without a reload.
    state.cookies = response.cookies.getAll().filter((cookie) => cookie.maxAge !== 0);
    expect((await curator())?.id).toBe('curator-id');
    expect(state.exchanges).toHaveLength(1);
  },
);
test('expired links never create a session or grant curator access', async () => {
  state.fail = true;
  const response = await GET(
    new NextRequest('https://weloveovo.com/auth/confirm?token_hash=expired'),
  );
  expect(response.headers.get('location')).toBe('https://weloveovo.com/admin?error=expired');
  expect(response.cookies.getAll()).toHaveLength(0);
  expect(await curator()).toBeNull();
});
test('proxy leaves the callback exchange alone and prevents cached studio responses', async () => {
  await proxy(new NextRequest('https://weloveovo.com/auth/confirm?token_hash=test'));
  expect(createServerClient).not.toHaveBeenCalled();
  const response = await proxy(new NextRequest('https://weloveovo.com/admin'));
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('pragma')).toBe('no-cache');
});
