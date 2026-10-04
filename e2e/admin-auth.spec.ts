/**
 * Admin access-control E2E for Sub-Phases 12.1 + 12.10 — Admin Route &
 * Authorization Integration and Admin Testing & End-to-End Verification.
 *
 * Same backend reality as `storefront-auth.spec.ts`: transports are
 * fulfilled with contract-exact payloads because no live API runs here.
 * Sessions are seeded through `localStorage` (the same entry the login
 * flow writes), then restoration + guards run for real: anonymous visits
 * land on the admin login, customers land on `/forbidden`, admins and
 * super-admins enter, and logout returns the shell to anonymous.
 *
 * Sub-Phase 12.10 adds the integrated journeys: the real login form
 * flow (anonymous → login → dashboard), sidebar navigation with active
 * state, deep links, the mobile drawer, RTL/localization switching, and
 * theme behavior.
 */

import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'fluxcommerce.auth.session.v1';

/**
 * Full permission bundle the backend stores when the `Admin` role is
 * assigned (`API_CONTRACT.md` §0.5). Mirrors the contract so admin
 * journeys exercise the permission-gated shell like production.
 */
const FULL_PERMISSIONS = [
  'orders.read',
  'orders.cancel',
  'orders.refund',
  'payments.read',
  'payments.stats',
  'inventory.read',
  'inventory.manage',
  'catalog.manage',
  'dashboard.read',
];

function userWithRoles(roles: string[], permissions: string[] = []): Record<string, unknown> {
  const granted =
    permissions.length > 0
      ? permissions
      : roles.some((role) => role === 'Admin' || role === 'SuperAdmin')
        ? [...FULL_PERMISSIONS]
        : [];
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
    permissions: granted,
  };
}

function pairWithRoles(roles: string[]): Record<string, unknown> {
  return {
    userId: '22222222-2222-2222-2222-222222222222',
    email: 'boss@flux.local',
    roles,
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

async function mockRefresh(page: Page, roles: string[]): Promise<void> {
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: ok(pairWithRoles(roles)),
    }),
  );
}

async function mockMe(page: Page, roles: string[]): Promise<void> {
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: ok(userWithRoles(roles)),
    }),
  );
}

test.describe('admin access control', () => {
  test('anonymous visits land on the admin login with the return URL', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fdashboard$/);
    await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
  });

  test('anonymous visits to the portal root land on the admin login', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fdashboard$/);
    await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
  });

  test('customers without the admin role land on forbidden', async ({ page }) => {
    await seed(page, ['Customer']);
    await mockRefresh(page, ['Customer']);
    await mockMe(page, ['Customer']);
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/forbidden$/);
    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  });

  test('admins enter the protected dashboard', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockRefresh(page, ['Admin']);
    await mockMe(page, ['Admin']);
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.locator('.dashboard-session').getByText('Boss Admin')).toBeVisible();
  });

  test('super-admins enter the protected dashboard', async ({ page }) => {
    await seed(page, ['SuperAdmin']);
    await mockRefresh(page, ['SuperAdmin']);
    await mockMe(page, ['SuperAdmin']);
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.locator('.dashboard-session').getByText('Boss Admin')).toBeVisible();
  });

  test('direct navigation and browser refresh keep the admin session', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockRefresh(page, ['Admin']);
    await mockMe(page, ['Admin']);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('expired sessions fall back to the admin login', async ({ page }) => {
    await seed(page, ['Admin']);
    await page.route('**/auth/refresh', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ isSuccess: false, message: 'Invalid token.' }),
      }),
    );
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fdashboard$/);
    await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
  });

  test('logout from the dashboard restores the anonymous shell', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockRefresh(page, ['Admin']);
    await mockMe(page, ['Admin']);
    await page.route('**/auth/logout', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: ok(null) }),
    );
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.getByRole('button', { name: 'Logout' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toHaveCount(0);
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toBeNull();
  });
});

test.describe('admin integrated journeys (12.10)', () => {
  test('anonymous login flow lands on the dashboard', async ({ page }) => {
    await page.route('**/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: ok(pairWithRoles(['Admin'])),
      }),
    );
    await page.route('**/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: ok(userWithRoles(['Admin'])),
      }),
    );
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fdashboard$/);

    await page.getByLabel('Email').fill('boss@flux.local');
    await page.getByLabel('Password').fill('Secret123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.locator('.dashboard-session').getByText('Boss Admin')).toBeVisible();
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(stored).not.toBeNull();
  });

  test('portal root redirects to the dashboard', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockRefresh(page, ['Admin']);
    await mockMe(page, ['Admin']);
    await page.goto('/');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.locator('app-layout')).toBeVisible();
  });

  test('sidebar navigation swaps features with active state', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockRefresh(page, ['Admin']);
    await mockMe(page, ['Admin']);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.getByRole('link', { name: 'Orders', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Orders', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('deep links render inside the shell', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockRefresh(page, ['Admin']);
    await mockMe(page, ['Admin']);
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.locator('app-layout')).toBeVisible();
  });

  test('mobile drawer opens, navigates, and closes', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockRefresh(page, ['Admin']);
    await mockMe(page, ['Admin']);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const sidebar = page.locator('admin-sidebar');
    await expect(sidebar).toBeHidden();

    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await expect(sidebar).toBeVisible();

    await page.getByRole('link', { name: 'Orders', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
    await expect(sidebar).toBeHidden();
  });

  test('persisted French culture localizes shell chrome', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockRefresh(page, ['Admin']);
    await mockMe(page, ['Admin']);
    await page.addInitScript(() => window.localStorage.setItem('fluxcommerce.culture.v1', 'fr'));
    await page.goto('/dashboard');

    await expect(page.getByRole('link', { name: 'Tableau de bord' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Commandes', exact: true })).toBeVisible();
  });

  test('language switch drives RTL rendering', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockRefresh(page, ['Admin']);
    await mockMe(page, ['Admin']);
    await page.goto('/dashboard');
    await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('ltr');

    await page.locator('admin-culture-switch select').selectOption('ar');

    await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl');
    await expect(page.getByRole('link', { name: 'لوحة التحكم' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'لوحة التحكم' })).toBeVisible();
  });

  test('theme toggle switches and persists across reload', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockRefresh(page, ['Admin']);
    await mockMe(page, ['Admin']);
    await page.goto('/dashboard');

    const theme = () => page.evaluate(() => document.documentElement.dataset['theme']);
    await expect.poll(theme).toBe('light');

    await page.locator('flux-theme-toggle button').click();
    await expect.poll(theme).toBe('dark');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect.poll(theme).toBe('dark');
  });
});
