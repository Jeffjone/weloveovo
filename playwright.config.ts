import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const chrome =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = Number(process.env.PLAYWRIGHT_PORT || 3000);
const fixture = process.env.PLAYWRIGHT_CATALOG_FIXTURE === 'true';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    launchOptions: existsSync(chrome) ? { executablePath: chrome } : {},
  },
  webServer: {
    command: process.env.PLAYWRIGHT_PRODUCTION
      ? `npm run start -- --port ${port}`
      : `npm run dev -- --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI && !process.env.PLAYWRIGHT_PRODUCTION && !fixture,
    env: fixture
      ? {
          DATABASE_URL: '',
          NEXT_PUBLIC_SUPABASE_URL: '',
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
          SUPABASE_SERVICE_ROLE_KEY: '',
          CURATOR_EMAILS: '',
          NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000',
        }
      : undefined,
    timeout: 120000,
  },
});
