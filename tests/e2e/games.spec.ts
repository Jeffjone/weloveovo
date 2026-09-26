import { test, expect } from '@playwright/test';
import type { Question } from '../../src/lib/game-types';
test('song cards open song files and random discovery opens a different track without autoplay', async ({
  page,
}) => {
  await page.goto('/listening-room?q=Marvins');
  await page.getByRole('link', { name: 'Read about Marvins Room', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inside this song.' })).toBeVisible();
  const original = page.url();
  await page.getByRole('button', { name: 'Random song', exact: true }).click();
  await expect(page).not.toHaveURL(original);
  await expect(page).toHaveURL(/\/tracks\/(?:[a-zA-Z0-9]{22}|genius-[0-9]+)$/);
  await expect(page.getByRole('heading', { name: 'Inside this song.' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(original);
  await page.goto('/listening-room');
  await page.getByRole('button', { name: 'Track list', exact: true }).click();
  await expect(page).toHaveURL(/view=list/);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Track list', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
test('ten-question round teaches answers, reviews mistakes, and preserves browser progress', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/games');
  const deckResponse = page.waitForResponse((r) => r.url().includes('/api/games?mode=release'));
  await page.getByRole('button', { name: 'Start a round' }).click();
  const { questions } = (await (await deckResponse).json()) as { questions: Question[] };
  for (const [i, q] of questions.entries()) {
    await expect(page.getByText(`QUESTION ${i + 1} / 10`, { exact: true })).toBeVisible();
    const { tracks } = await (await request.get('/api/tracks?ids=' + q.id)).json();
    const chosen = q.choices.find((c) =>
      i === 1 ? c.id !== tracks[0].release_id : c.id === tracks[0].release_id,
    )!;
    await page
      .getByRole('button', {
        name: new RegExp(chosen.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      })
      .click();
    await expect(page.getByRole('link', { name: 'Read about this song' })).toBeVisible();
    await expect(
      page.getByText(i === 1 ? 'ONE TO REMEMBER' : 'RIGHT ON THE RECORD', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: i === 9 ? 'See results' : 'Next question' }).click();
  }
  await expect(page.getByText('ROUND COMPLETE', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review 1 missed answers' }).click();
  await expect(page.getByText('QUESTION 1 / 1', { exact: true })).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('weloveovo.learning.v1')!),
  );
  expect(saved.attempted).toBe(10);
  expect(saved.correct).toBe(9);
  expect(saved.tracks).toHaveLength(10);
  await page.reload();
  await expect(page.locator('aside').getByText('10', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('game modes, retry states and keyboard play work at mobile widths', async ({
  page,
  request,
}) => {
  for (const mode of ['cover', 'year', 'credits']) {
    await page.goto('/games?mode=' + mode);
    await page.getByRole('button', { name: 'Start a round' }).click();
    await expect(page.getByText('QUESTION 1 / 10', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to games' })).toBeVisible();
    if (mode === 'cover') await expect(page.getByAltText('Record cover to identify')).toBeVisible();
    await page.locator('[aria-label="Answer choices"] button').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Next question' })).toBeVisible();
  }
  await page.route('**/api/games?*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Connection interrupted. Try again.' }),
    }),
  );
  await page.goto('/games');
  await page.getByRole('button', { name: 'Start a round' }).click();
  await expect(
    page.getByRole('region', { name: 'Learning game' }).getByRole('alert'),
  ).toContainText('Connection interrupted');
  await page.unroute('**/api/games?*');
  await page.getByRole('button', { name: 'Start a round' }).click();
  await expect(page.getByText('QUESTION 1 / 10', { exact: true })).toBeVisible();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/games', '/listening-room']) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  }
  expect((await request.get('/api/games?mode=invalid')).status()).toBe(400);
  expect((await request.get('/api/tracks/random?exclude=invalid')).status()).toBe(400);
  expect((await request.post('/api/games/answer', { data: { id: 'invalid' } })).status()).toBe(400);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/games');
  await expect(page.locator('[data-page-transition]')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'test-results/game-room-desktop.png', fullPage: true });
  await page.goto('/listening-room');
  await expect(page.locator('[data-page-transition]')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'test-results/song-cards-desktop.png', fullPage: true });
});
