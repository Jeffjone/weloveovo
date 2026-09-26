import { test, expect } from '@playwright/test';
import additions from '../../data/catalog/genius.json';
test('Genius-only songs support direct pages, favorites, and source links without fake playback', async ({
  page,
}) => {
  const song = additions.tracks.find((t) => t.raw.spotify_id === null)!;
  await page.goto('/tracks/' + song.id);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(song.title);
  await expect(page.getByRole('link', { name: `View ${song.title} on Genius` })).toHaveAttribute(
    'href',
    song.raw.genius_url,
  );
  await expect(page.getByRole('button', { name: `Listen to ${song.title}` })).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByText('Audio profile unavailable.')).toBeVisible();
  await page.getByRole('button', { name: `Favorite ${song.title}`, exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: `Favorite ${song.title}`, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/listening-room?favorites=true');
  // Select the collection tab through the public UI; it supplies browser-local IDs.
  await page.getByRole('button', { name: 'Your collection' }).click();
  await expect(
    page.getByRole('link', { name: `Read about ${song.title}`, exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tracks/' + song.id);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('[data-page-transition]')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'test-results/genius-song-mobile.png', fullPage: true });
});

test('large collections expose all tracks through shareable record pages', async ({ page }) => {
  await page.goto('/records/genius-unassigned');
  await page.getByRole('link', { name: 'Next tracks', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('navigation', { name: 'Record track pages' })).toContainText(
    'Page 2',
  );
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Record track pages' })).toContainText(
    'Page 2',
  );
  await page.goBack();
  await expect(page.getByRole('navigation', { name: 'Record track pages' })).toContainText(
    'Page 1',
  );
});
