import { test, expect } from '@playwright/test';
import axe from 'axe-core';
const routes = [
  '/',
  '/records',
  '/records/take-care-deluxe',
  '/eras',
  '/eras/the-blue-hour',
  '/legacy',
  '/listening-room',
  '/tracks/genius-149',
  '/games',
  '/connections',
  '/vault',
  '/admin',
];
for (const width of [1440, 1024, 768, 390]) {
  test(`all room layouts retain visible primary content at ${width}px`, async ({ page }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('Failed to load resource'))
        errors.push(message.text());
    });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const failures = await page.evaluate(() => {
        const results: string[] = [];
        if (document.documentElement.scrollWidth > innerWidth + 1)
          results.push('Document overflows');
        for (const element of document.querySelectorAll(
          'main h1, main h2, main input, main select, main button',
        )) {
          if (
            element.closest('.react-flow') ||
            !(element instanceof HTMLElement) ||
            !element.checkVisibility()
          )
            continue;
          const box = element.getBoundingClientRect();
          if (box.left < -1 || box.right > innerWidth + 1)
            results.push(
              element.tagName +
                ': ' +
                (element.textContent?.slice(0, 60) || element.getAttribute('aria-label')),
            );
        }
        return results;
      });
      expect(failures, route).toEqual([]);
      if (route === '/' || route === '/games')
        await page.screenshot({
          path: info.outputPath(`${width}-${route === '/' ? 'lobby' : 'games'}.png`),
        });
    }
    expect(errors).toEqual([]);
    await page.getByRole('button', { name: 'Rooms', exact: true }).click();
    const menu = page.locator('#room-switcher');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link')).toHaveCount(6);
    expect(
      await menu.evaluate((element) => element.getBoundingClientRect().right <= innerWidth),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Rooms', exact: true })).toBeFocused();
  });
}
test('public rooms and expanded navigation meet automated WCAG AA checks', async ({ page }) => {
  test.setTimeout(120000);
  const findings: unknown[] = [];
  for (const route of routes) {
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    await page.addScriptTag({ content: axe.source });
    const violations = await page.evaluate(async () => {
      const engine = (window as typeof window & { axe: typeof axe }).axe;
      const result = await engine.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
      });
      return result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      }));
    });
    if (violations.length) findings.push({ route, violations });
  }
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
  const menuViolations = await page.evaluate(
    async () =>
      (
        await (window as typeof window & { axe: typeof axe }).axe.run('#room-switcher', {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
        })
      ).violations,
  );
  if (menuViolations.length) findings.push({ route: 'room menu', violations: menuViolations });
  expect(findings).toEqual([]);
});
test('scroll choreography responds to progress and simplifies with effects off and reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const [route, variant] of [
    ['/records', 'sleeves'],
    ['/eras', 'chronology'],
    ['/legacy', 'city'],
  ]) {
    await page.goto(route);
    const scene = page.locator(`[data-scroll-scene="${variant}"]`).first();
    await expect(scene).toHaveAttribute('data-motion', 'true');
    const before = await scene.evaluate((el) =>
      getComputedStyle(el).getPropertyValue('--scene-progress'),
    );
    await page.evaluate(() => scrollTo(0, 700));
    await expect
      .poll(() => scene.evaluate((el) => getComputedStyle(el).getPropertyValue('--scene-progress')))
      .not.toBe(before);
    await page.getByRole('button', { name: 'Turn ambient effects off' }).click();
    await expect(scene).toHaveAttribute('data-motion', 'false');
    await page.getByRole('button', { name: 'Turn ambient effects on' }).click();
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('[data-scroll-scene]').first()).toHaveAttribute('data-motion', 'false');
  await expect(page.locator('[data-page-transition]')).toHaveCSS('animation-name', 'none');
});
