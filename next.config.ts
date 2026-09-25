import type { NextConfig } from 'next';
const config: NextConfig = {
  agentRules: false,
  turbopack: { root: process.cwd() },
  outputFileTracingIncludes: { '/*': ['./supabase/migrations/001_catalog.sql'] },
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};
export default config;
