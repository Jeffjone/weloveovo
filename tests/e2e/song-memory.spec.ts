import { test, expect } from '@playwright/test';
test('untimed naming counts unique songs, handles retries, and advances fan levels', async ({
  page,
}) => {
  await page.goto('/games');
  await page.getByRole('button', { name: 'Name Drake songs', exact: true }).click();
  await page.getByRole('button', { name: 'Start naming songs' }).click();
  const input = page.getByLabel('Song title', { exact: true });
  async function name(title: string) {
    await input.fill(title);
    await page.getByRole('button', { name: 'Add song', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Add song', exact: true })).toBeVisible();
  }
  await name("God's Plan");
  await expect(page.getByText('1 songs named', { exact: true })).toBeVisible();
  await name('GODS PLAN');
  await expect(page.getByText('Already named! Try another song.')).toBeVisible();
  await name('This song does not exist in the archive');
  await expect(page.getByText('No match in this collection.', { exact: false })).toBeVisible();
  await page.route('**/api/games/name-song', (route) =>
    route.fulfill({ status: 503, json: { error: 'Try again shortly.' } }),
  );
  await name('Hotline Bling');
  await expect(page.getByText('Try again shortly.')).toBeVisible();
  await page.unroute('**/api/games/name-song');
  for (const title of ['Hotline Bling', 'One Dance', 'Passionfruit', 'Headlines'])
    await name(title);
  await expect(page.getByText('5 songs named', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'In rotation', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Finish session' }).click();
  await expect(
    page.getByRole('heading', { name: 'Session complete — 5 songs named.' }),
  ).toBeFocused();
  await expect(page.getByRole('link', { name: "God's Plan ↗" })).toBeVisible();
});
test('timed mobile session expires, rejects late responses, and shows no fan level', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await page.goto('/games');
  await page.getByRole('button', { name: 'Name Drake songs', exact: true }).click();
  await page.getByLabel('Time limit').selectOption('60');
  await page.getByRole('button', { name: 'Start naming songs' }).click();
  await expect(page.getByRole('timer')).toHaveText('1:00');
  await expect(page.getByText('YOUR FAN LEVEL')).toHaveCount(0);
  await page.route('**/api/games/name-song', async (route) => {
    await page.clock.fastForward(61_000);
    await route
      .fulfill({ json: { song: { id: 'test', title: 'Late answer', key: 'lateanswer' } } })
      .catch(() => {});
  });
  await page.getByLabel('Song title', { exact: true }).fill('Late answer');
  await page.getByRole('button', { name: 'Add song', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Session complete — 0 songs named.' }),
  ).toBeVisible();
  await expect(page.getByLabel('Song title', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Play again' }).click();
  await page.getByLabel('Time limit').selectOption('0');
  await page.getByRole('button', { name: 'Start naming songs' }).click();
  await expect(page.getByText('YOUR FAN LEVEL')).toBeVisible();
});
