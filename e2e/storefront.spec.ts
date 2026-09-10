import { expect, test } from '@playwright/test';

test('storefront loads successfully', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Flux Commerce');
  await expect(page.getByRole('heading', { name: 'Storefront' })).toBeVisible();
});

test.describe('Phase 3 verification matrix (Sub-Phase 3.12)', () => {
  test('theme switching applies data-theme and persists the choice', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Switch to dark theme' });
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
      .toBe('dark');
    await expect
      .poll(async () => page.evaluate(() => window.localStorage.getItem('fluxcommerce.theme.v1')))
      .toBe('dark');

    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
      .toBe('light');
  });

  for (const viewport of [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
  ]) {
    test(`no horizontal overflow on ${viewport.name} viewports`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');

      await expect(page.getByRole('heading', { name: 'Storefront' })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('RTL layout renders without overflow or missing landmarks', async ({ page }) => {
    await page.addInitScript(() => document.documentElement.setAttribute('dir', 'rtl'));
    await page.goto('/');

    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Storefront' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
