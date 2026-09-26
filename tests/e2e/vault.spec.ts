import { test, expect } from '@playwright/test';
test('early releases display corrected dates and only two additions in the era', async ({
  page,
}) => {
  await page.goto('/listening-room?release=genius-album-2625');
  await expect(page.getByRole('combobox', { name: 'Release', exact: true })).toContainText(
    'Room for Improvement — February 14, 2006',
  );
  await expect(page.getByRole('combobox', { name: 'Release', exact: true })).toContainText(
    'Drake Demo Disc — 2006',
  );
  await page.goto('/eras/the-introduction');
  await expect(
    page.getByRole('heading', { name: 'Room for Improvement', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Comeback Season', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Drake Demo Disc', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'So Far Gone (EP)', exact: true })).toHaveCount(0);
});
test('vault is an empty mobile-accessible room with shareable filters', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/vault');
  await expect(page.getByRole('heading', { name: 'Nothing filed here yet.' })).toBeVisible();
  await page.getByLabel('Material type').selectOption('snippet');
  await page.getByRole('button', { name: 'Search vault' }).click();
  await expect(page).toHaveURL(/category=snippet/);
  await page.reload();
  await expect(page.getByLabel('Material type')).toHaveValue('snippet');
  await page.getByRole('link', { name: 'Reset', exact: true }).click();
  await expect(page).toHaveURL(/\/vault$/);
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
  await expect(page.getByRole('link', { name: /The vault/ })).toBeVisible();
});
