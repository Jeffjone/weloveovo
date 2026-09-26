import { test, expect } from '@playwright/test';
import additions from '../../data/genius-catalog.json';
test('lobby and room routes support direct visits, history and refresh', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource'))
      errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('weloveovo');
  await expect(page).toHaveTitle('weloveovo');
  await expect(page.getByRole('link', { name: 'weloveovo home' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Choose a room' })).toBeVisible();
  await page.getByRole('region', { name: 'Choose a room' }).getByRole('link').first().click();
  await expect(page).toHaveURL(/\/records$/);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Every cover');
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  for (const route of ['/eras', '/legacy', '/records/take-care-deluxe', '/eras/the-blue-hour']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Rooms' })).toBeVisible();
  await page.getByRole('button', { name: 'Rooms' }).click();
  await expect(page.locator('#room-switcher')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#room-switcher')).not.toBeVisible();
  expect(errors).toEqual([]);
});
test('search, URL filters, pagination and favorites survive navigation', async ({ page }) => {
  await page.goto('/listening-room');
  await expect(page.getByRole('status').first()).toContainText(
    `${414 + additions.tracks.length} TRACKS`,
  );
  await page.getByRole('searchbox').fill('Marvins Room');
  await expect(page).toHaveURL(/q=Marvins/);
  await expect(page.getByRole('status').first()).toContainText('1 TRACKS');
  await page.getByRole('button', { name: 'Favorite Marvins Room', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Favorite Marvins Room', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Favorite Marvins Room', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Your collection' }).click();
  await expect(page.getByRole('status').first()).toContainText('1 TRACKS');
  await page.getByRole('button', { name: 'Favorite Marvins Room', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make this room yours.' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore the catalog' }).click();
  await expect(page.getByRole('status').first()).toContainText(
    `${414 + additions.tracks.length} TRACKS`,
  );
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('status').first()).toContainText('PAGE 2');
  await page.getByLabel('Sort tracks').selectOption('title');
  await expect(page).not.toHaveURL(/page=2/);
  await page.getByLabel('Hide explicit').check();
  await expect(page.getByRole('status').first()).toContainText('38 TRACKS');
  await page.getByRole('searchbox').fill('xyz-no-such-song');
  await expect(page.getByRole('heading', { name: 'A little too quiet in here.' })).toBeVisible();
});
test('all moods filter and clear without losing browser history', async ({ page }) => {
  await page.goto('/listening-room');
  for (const mood of ['After hours', 'The long way home', 'Headlines']) {
    await page.getByRole('button', { name: new RegExp(mood) }).click();
    await expect(page).toHaveURL(/mood=/);
    await expect(page.getByRole('button', { name: new RegExp(mood) })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page).toHaveURL(/\/listening-room$/);
});
test('Spotify is user initiated and its frame survives room navigation', async ({ page }) => {
  await page.route('https://open.spotify.com/embed/**', (route) =>
    route.fulfill({ body: '<!doctype html><title>Player fixture</title>' }),
  );
  await page.goto('/records/take-care-deluxe');
  await expect(page.locator('iframe')).toHaveCount(0);
  await page
    .getByRole('button', { name: /Listen to/ })
    .first()
    .click();
  const frame = page.locator('iframe');
  await expect(frame).toHaveCount(1);
  const source = await frame.getAttribute('src');
  await frame.evaluate((el) => el.setAttribute('data-test-persistent', 'yes'));
  await page.getByRole('button', { name: 'Rooms' }).click();
  await page
    .locator('#room-switcher')
    .getByRole('link', { name: /The eras/ })
    .click();
  await expect(page).toHaveURL(/\/eras$/);
  await expect(frame).toHaveAttribute('src', source!);
  await expect(frame).toHaveAttribute('data-test-persistent', 'yes');
  await page.getByRole('button', { name: 'Collapse player' }).click();
  await expect(frame).toBeHidden();
  await page.getByRole('button', { name: 'Expand player' }).click();
  await expect(frame).toBeVisible();
  await page.getByRole('button', { name: 'Close player' }).click();
  await expect(frame).toHaveCount(0);
});
test('map and list expose the same graph, with expandable nodes', async ({ page }) => {
  await page.goto('/connections');
  await expect(page.locator('.react-flow__node')).toHaveCount(6);
  await page.locator('.react-flow__node[data-id="era:the-blue-hour"]').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/root=era/);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(6);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.getByRole('button', { name: /era The blue hour/ }).click();
  await expect(page).toHaveURL(/root=era/);
  await expect(page.getByRole('button', { name: /release Take Care/ })).toBeVisible();
  await page.getByRole('button', { name: /release Take Care/ }).click();
  await expect(page).toHaveURL(/root=release/);
  await expect(page.getByRole('button', { name: /track Marvins Room/ })).toBeVisible();
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  const graph = await (await page.request.get('/api/graph?root=release:take-care-deluxe')).json();
  await expect(page.locator('.react-flow__node')).toHaveCount(graph.nodes.length);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(6);
});
test('anonymous admin mutations and unavailable downloads fail safely', async ({
  request,
  page,
}) => {
  for (const route of [
    '/api/admin/content',
    '/api/admin/audio/sign',
    '/api/admin/audio/finalize',
  ]) {
    const r = await request.post(route, { headers: { origin: 'http://127.0.0.1:3000' }, data: {} });
    expect(r.status()).toBe(401);
  }
  expect((await request.get('/api/admin/content')).status()).toBe(401);
  expect((await request.get('/api/tracks?limit=999')).status()).toBe(400);
  expect((await request.get('/api/tracks?ids=invalid')).status()).toBe(400);
  expect((await request.get('/api/graph?root=invalid')).status()).toBe(400);
  expect((await request.get('/api/tracks/1qIwin7JMVuX70qN6wD8ww/download')).status()).toBe(404);
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'Connect your curator workspace.' }),
  ).toBeVisible();
  await page.goto('/tracks/not-a-valid-track');
  await expect(page.getByRole('heading', { name: 'This room isn’t on the map.' })).toBeVisible();
});
test('mobile layouts, effects preference, reduced motion and local collection fallback', async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/listening-room', '/connections']) {
      await page.goto(route);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${route} width ${width}`,
      ).toBe(true);
    }
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'Turn ambient effects off' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Turn ambient effects on' })).toBeVisible();
  await expect(page.locator('[data-animated]')).toHaveAttribute('data-animated', 'false');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage disabled');
      },
    });
  });
  await page.goto('/listening-room');
  await page
    .getByRole('button', { name: /Favorite/ })
    .first()
    .click();
  await expect(page.getByRole('status').last()).toContainText('this visit only');
});
test('ambient and map effects respect the toggle, visibility and mobile screens', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/connections?root=era:the-blue-hour');
  await expect(page.locator('[data-animated]')).toHaveAttribute('data-animated', 'true');
  await expect(page.locator('.react-flow__edge.animated').first()).toBeAttached();
  await page.getByRole('button', { name: 'Turn ambient effects off' }).click();
  await expect(page.locator('[data-animated]')).toHaveAttribute('data-animated', 'false');
  await expect(page.locator('.react-flow__edge.animated')).toHaveCount(0);
  await page.getByRole('button', { name: 'Turn ambient effects on' }).click();
  await expect(page.locator('[data-animated]')).toHaveAttribute('data-animated', 'true');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('[data-animated]')).toHaveAttribute('data-animated', 'false');
  await expect(page.locator('.react-flow__edge.animated')).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('[data-animated]')).toHaveAttribute('data-animated', 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-animated]')).toHaveAttribute('data-animated', 'false');
});
test('capture visual review of home, record, listening room and map', async ({ page }) => {
  for (const [path, name] of [
    ['/', 'lobby'],
    ['/records/take-care-deluxe', 'record'],
    ['/listening-room', 'listening'],
    ['/connections?root=era:the-blue-hour', 'connections'],
  ]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('[data-page-transition]')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: `test-results/${name}-desktop.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('[data-page-transition]')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'test-results/lobby-mobile.png', fullPage: true });
});
