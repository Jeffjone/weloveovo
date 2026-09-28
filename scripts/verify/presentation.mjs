import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.PRESENTATION_URL || 'http://127.0.0.1:3103';
const output = process.env.PRESENTATION_REPORT || 'test-results/presentation-performance.json';
const chrome =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  headless: true,
  ...(existsSync(chrome) ? { executablePath: chrome } : {}),
});
const results = [];
try {
  for (const width of [1440, 390]) {
    for (const route of [
      '/',
      '/records',
      '/eras',
      '/legacy',
      '/listening-room',
      '/games',
      '/connections',
      '/vault',
    ]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: 'no-preference',
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(() => {
        const metrics = (window.__presentationMetrics = { lcp: 0, cls: 0, interaction: 0 });
        let session = 0,
          first = 0,
          last = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) metrics.lcp = entry.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.hadRecentInput) continue;
            if (entry.startTime - last > 1000 || entry.startTime - first > 5000) {
              session = 0;
              first = entry.startTime;
            }
            session += entry.value;
            last = entry.startTime;
            metrics.cls = Math.max(metrics.cls, session);
          }
        }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            if (entry.interactionId)
              metrics.interaction = Math.max(metrics.interaction, entry.duration);
        }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
      });
      const session = await context.newCDPSession(page);
      await session.send('Network.enable');
      await session.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 60,
        downloadThroughput: (10 * 1024 * 1024) / 8,
        uploadThroughput: (2 * 1024 * 1024) / 8,
      });
      await session.send('Emulation.setCPUThrottlingRate', { rate: width === 390 ? 4 : 1 });
      await page.goto(base + route, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Rooms', exact: true }).click();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Turn ambient effects off' }).click();
      await page.getByRole('button', { name: 'Turn ambient effects on' }).click();
      await page.waitForTimeout(250);
      const metrics = await page.evaluate(() => window.__presentationMetrics);
      const frames = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const times = [];
            let previous = performance.now();
            let frame = 0;
            function step(now) {
              if (frame > 0) times.push(now - previous);
              previous = now;
              scrollTo(0, Math.min(1000, frame * 6));
              if (++frame < 120) requestAnimationFrame(step);
              else resolve(times.sort((a, b) => a - b));
            }
            requestAnimationFrame(step);
          }),
      );
      results.push({
        width,
        route,
        ...metrics,
        frameMedian: frames[Math.floor(frames.length * 0.5)],
        frameP95: frames[Math.floor(frames.length * 0.95)],
        errors,
      });
      console.log(JSON.stringify(results.at(-1)));
      await context.close();
    }
  }
} finally {
  await browser.close();
}
mkdirSync(output.slice(0, output.lastIndexOf('/')) || '.', { recursive: true });
writeFileSync(
  output,
  JSON.stringify(
    {
      profile: {
        latencyMs: 60,
        downloadMbps: 10,
        uploadMbps: 2,
        mobileCpuSlowdown: 4,
        cache: 'new browser context for each route',
        interaction:
          'maximum Event Timing duration from menu, Escape, and effects-toggle interactions; durations below 16ms may be omitted; lab proxy, not field INP',
      },
      results,
    },
    null,
    2,
  ),
);
