import { expect, test } from '@playwright/test';

test('admin loads successfully', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Admin');
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
});
