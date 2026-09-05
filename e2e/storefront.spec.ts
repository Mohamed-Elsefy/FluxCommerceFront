import { expect, test } from '@playwright/test';

test('storefront loads successfully', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Storefront');
  await expect(page.getByRole('heading', { name: 'Storefront' })).toBeVisible();
});
