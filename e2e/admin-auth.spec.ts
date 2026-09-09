/**
 * Admin access-control E2E for Sub-Phase 2.14.
 *
 * Same backend reality as `storefront-auth.spec.ts`: transports are
 * fulfilled with contract-exact payloads because no live API runs here.
 * Sessions are seeded through `localStorage` (the same entry the login
 * flow writes), then restoration + guards run for real: anonymous visits
 * leave the dashboard, customers land on `/forbidden`, admins enter, and
 * logout returns the shell to anonymous.
 */

import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'fluxcommerce.auth.session.v1';

function userWithRoles(roles: string[]): Record<string, unknown> {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'boss@flux.local',
    roles,
    isEmailVerified: true,
    registeredAtUtc: '2026-09-06T12:00:00Z',
    firstName: 'Boss',
    lastName: 'Admin',
    displayName: 'Boss Admin',
    phoneNumber: null,
    isPhoneVerified: false,
    avatarUrl: null,
    preferredLanguage: 'en',
    timeZone: 'UTC',
    status: 1,
  };
}

function pair(): Record<string, unknown> {
  return {
    userId: '22222222-2222-2222-2222-222222222222',
    email: 'boss@flux.local',
    roles: ['Admin'],
    accessToken: 'admin-access-2',
    refreshToken: 'admin-refresh-2',
    refreshTokenExpiresAtUtc: '2026-09-13T12:00:00Z',
  };
}

function ok(data: unknown): string {
  return JSON.stringify({ isSuccess: true, message: 'Operation completed successfully.', data });
}

async function seed(page: Page, roles: string[]): Promise<void> {
  await page.addInitScript(
    ({ key, session }) => window.localStorage.setItem(key, JSON.stringify(session)),
    {
      key: STORAGE_KEY,
      session: {
        refreshToken: 'admin-refresh-1',
        user: { ...userWithRoles(roles), displayName: null },
        authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
      },
    },
  );
}

test.describe('admin access control', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: ok(pair()),
      }),
    );
  });

  test('anonymous visits leave the protected dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // No login route exists in the Admin app yet: the guard chain redirects
    // to /login, which falls through to the not-found page. Either way the
    // protected entry never renders.
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Administration' })).toHaveCount(0);
  });

  test('customers without the admin role land on forbidden', async ({ page }) => {
    await seed(page, ['Customer']);
    await page.route('**/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: ok(userWithRoles(['Customer'])),
      }),
    );
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/forbidden$/);
    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  });

  test('admins enter the protected dashboard', async ({ page }) => {
    await seed(page, ['Admin']);
    await page.route('**/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: ok(userWithRoles(['Admin'])),
      }),
    );
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await expect(page.getByText('Boss Admin')).toBeVisible();
  });

  test('logout from the dashboard restores the anonymous shell', async ({ page }) => {
    await seed(page, ['Admin']);
    await page.route('**/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: ok(userWithRoles(['Admin'])),
      }),
    );
    await page.route('**/auth/logout', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: ok(null) }),
    );
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    await page.getByRole('button', { name: 'Logout' }).click();

    await expect(page.getByRole('button', { name: 'Logout' })).toHaveCount(0);
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toBeNull();
  });
});
