import { expect, test } from '@playwright/test';

test('anonymous visits to the portal land on the admin login', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Admin');
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
});
