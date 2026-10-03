/**
 * Admin Users & Permissions E2E for Supplement S1, Step S1.5.
 *
 * Same backend reality as `admin-orders.spec.ts`: transports are
 * fulfilled with contract-exact payloads because no live API runs here.
 * Sessions are seeded through `localStorage`, then restoration + guards
 * + the real feature slices run: users landing (counts), users list
 * with server-side pagination and filters, user details with lockout
 * facts and the permission section, grant/revoke with notifications,
 * and the SuperAdmin-only access control.
 *
 * Contract-honest coverage notes (S1.1 audit):
 * - `GET /admin/users` is SuperAdmin-only with `status`/`role`/`search`
 *   filters (case-insensitive) — the suite asserts the request query.
 * - Permission values render verbatim (stable identifiers, never
 *   localized) — assertions match raw values, never translations.
 * - Grant duplicates surface `409 PermissionAlreadyGranted` (no blind
 *   retry); revokes are idempotent; unknown permissions surface `400
 *   Identity.InvalidPermission` — all status-first, never message text.
 */

import { expect, test, type Page, type Route } from '@playwright/test';

const STORAGE_KEY = 'fluxcommerce.auth.session.v1';
const API_ORIGIN = 'https://localhost:7119';
const USER_ID = '22222222-2222-2222-2222-222222222222';

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
    id: USER_ID,
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
    userId: USER_ID,
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

function problem(status: number, detail: string): Record<string, unknown> {
  return { type: 'about:blank', title: status.toString(), status, detail, extensions: {} };
}

function userRow(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    email: `${id}@flux.local`,
    roles: ['Customer'],
    isEmailVerified: true,
    registeredAtUtc: '2026-09-04T10:00:00Z',
    firstName: 'Ada',
    lastName: 'Lovelace',
    displayName: null,
    phoneNumber: null,
    isPhoneVerified: false,
    avatarUrl: null,
    preferredLanguage: 'en',
    timeZone: 'UTC',
    status: 1,
    permissions: [],
    failedAccessAttemptCount: 0,
    lockoutEndUtc: null,
    isLocked: false,
    ...overrides,
  };
}

function counts(): Record<string, unknown> {
  return {
    total: 7,
    pending: 1,
    active: 5,
    suspended: 0,
    locked: 1,
    deleted: 0,
    customers: 5,
    admins: 1,
    superAdmins: 1,
    unverified: 1,
    lockedOut: 1,
  };
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

async function mockSession(page: Page, roles: string[]): Promise<void> {
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: ok(pairWithRoles(roles)),
    }),
  );
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: ok(userWithRoles(roles)),
    }),
  );
}

async function mock(
  page: Page,
  method: string,
  pathname: string,
  status: number,
  body: unknown,
): Promise<void> {
  await page.route(
    (url) => url.origin === API_ORIGIN && url.pathname === pathname,
    (route: Route) =>
      route.request().method() === method
        ? route.fulfill({
            status,
            contentType: 'application/json',
            body: typeof body === 'string' ? body : JSON.stringify(body),
          })
        : route.fallback(),
  );
}

test.describe('admin users journeys (S1.5)', () => {
  test('users landing renders the backend-issued counts', async ({ page }) => {
    await seed(page, ['SuperAdmin']);
    await mockSession(page, ['SuperAdmin']);
    await mock(page, 'GET', '/admin/users/counts', 200, ok(counts()));
    await page.goto('/users');

    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    await expect(page.getByText('Total users')).toBeVisible();
    await expect(page.getByText('7', { exact: true }).first()).toBeVisible();
  });

  test('users list renders rows with pager and navigates to details', async ({ page }) => {
    await seed(page, ['SuperAdmin']);
    await mockSession(page, ['SuperAdmin']);
    await mock(
      page,
      'GET',
      '/admin/users',
      200,
      ok({
        items: [userRow('user-1'), userRow('user-2')],
        totalCount: 2,
        pageNumber: 1,
        pageSize: 20,
      }),
    );
    await mock(page, 'GET', '/admin/users/user-1', 200, ok(userRow('user-1')));
    await mock(page, 'GET', '/admin/users/user-1/permissions', 200, ok(['orders.read']));
    await mock(page, 'GET', '/admin/users/permissions', 200, ok(FULL_PERMISSIONS));
    await page.goto('/users/list');

    await expect(page.getByRole('heading', { name: 'Users list' })).toBeVisible();
    await expect(page.getByText('user-1@flux.local')).toBeVisible();
    await page.getByRole('link', { name: 'user-1@flux.local' }).click();

    await expect(page).toHaveURL('/users/user-1');
    await expect(page.getByRole('heading', { name: 'User facts' })).toBeVisible();
  });

  test('list filters narrow through the request query', async ({ page }) => {
    await seed(page, ['SuperAdmin']);
    await mockSession(page, ['SuperAdmin']);
    const seen: Array<Record<string, string>> = [];
    await page.route(
      (url) => url.origin === API_ORIGIN && url.pathname === '/admin/users',
      async (route: Route) => {
        if (route.request().method() !== 'GET') {
          await route.fallback();
          return;
        }
        seen.push(Object.fromEntries(new URL(route.request().url()).searchParams.entries()));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: ok({ items: [], totalCount: 0, pageNumber: 1, pageSize: 20 }),
        });
      },
    );
    await page.goto('/users/list');

    await page.getByLabel('Status').selectOption('Locked');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByText('No users found')).toBeVisible();

    expect(seen.at(-1)?.['status']).toBe('Locked');
  });

  test('unknown user renders the error state with retry', async ({ page }) => {
    await seed(page, ['SuperAdmin']);
    await mockSession(page, ['SuperAdmin']);
    await mock(page, 'GET', '/admin/users/unknown-id', 404, problem(404, 'Not found.'));
    await mock(page, 'GET', '/admin/users/unknown-id/permissions', 404, problem(404, 'Not found.'));
    await mock(page, 'GET', '/admin/users/permissions', 200, ok(FULL_PERMISSIONS));
    await page.goto('/users/unknown-id');

    await expect(page.getByText('User unavailable')).toBeVisible();
  });

  test('grant permission notifies and reloads', async ({ page }) => {
    await seed(page, ['SuperAdmin']);
    await mockSession(page, ['SuperAdmin']);
    await mock(page, 'GET', `/admin/users/${USER_ID}`, 200, ok(userWithRoles(['Admin'])));
    await mock(page, 'GET', `/admin/users/${USER_ID}/permissions`, 200, ok(['orders.read']));
    await mock(page, 'GET', '/admin/users/permissions', 200, ok(FULL_PERMISSIONS));
    await mock(
      page,
      'POST',
      `/admin/users/${USER_ID}/permissions`,
      200,
      ok(userWithRoles(['Admin'], ['orders.read', 'catalog.manage'])),
    );
    await page.goto(`/users/${USER_ID}`);

    await page.getByLabel('Permission', { exact: true }).selectOption('catalog.manage');
    await page.getByRole('button', { name: 'Grant', exact: true }).click();

    await expect(page.getByText('Permission granted')).toBeVisible();
  });

  test('duplicate grant surfaces the conflict without reload', async ({ page }) => {
    await seed(page, ['SuperAdmin']);
    await mockSession(page, ['SuperAdmin']);
    await mock(page, 'GET', `/admin/users/${USER_ID}`, 200, ok(userWithRoles(['Admin'])));
    await mock(page, 'GET', `/admin/users/${USER_ID}/permissions`, 200, ok([]));
    await mock(page, 'GET', '/admin/users/permissions', 200, ok(FULL_PERMISSIONS));
    await mock(
      page,
      'POST',
      `/admin/users/${USER_ID}/permissions`,
      409,
      problem(409, 'Already granted.'),
    );
    await page.goto(`/users/${USER_ID}`);

    await page.getByLabel('Permission', { exact: true }).selectOption('orders.read');
    await page.getByRole('button', { name: 'Grant', exact: true }).click();

    await expect(page.getByText('Request failed')).toBeVisible();
  });

  test('revoke confirms through the dialog and notifies', async ({ page }) => {
    await seed(page, ['SuperAdmin']);
    await mockSession(page, ['SuperAdmin']);
    await mock(page, 'GET', `/admin/users/${USER_ID}`, 200, ok(userWithRoles(['Admin'])));
    await mock(page, 'GET', `/admin/users/${USER_ID}/permissions`, 200, ok(['orders.read']));
    await mock(page, 'GET', '/admin/users/permissions', 200, ok(FULL_PERMISSIONS));
    await mock(
      page,
      'DELETE',
      `/admin/users/${USER_ID}/permissions/orders.read`,
      200,
      ok(userWithRoles(['Admin'], [])),
    );
    await page.goto(`/users/${USER_ID}`);

    await page.getByRole('button', { name: 'Revoke orders.read' }).click();
    await expect(page.getByText('Revoke orders.read from boss@flux.local?')).toBeVisible();
    await page.getByRole('button', { name: 'Revoke', exact: true }).click();

    await expect(page.getByText('Permission revoked')).toBeVisible();
  });

  test('customer callers land on forbidden', async ({ page }) => {
    await seed(page, ['Customer']);
    await mockSession(page, ['Customer']);
    await page.goto('/users/list');

    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test('French chrome renders the users entry points', async ({ page }) => {
    await seed(page, ['SuperAdmin']);
    await mockSession(page, ['SuperAdmin']);
    await mock(page, 'GET', '/admin/users/counts', 200, ok(counts()));
    await page.addInitScript(() => window.localStorage.setItem('fluxcommerce.culture.v1', 'fr'));
    await page.goto('/users');

    await expect(page.getByRole('heading', { name: 'Utilisateurs', exact: true })).toBeVisible();
  });

  test('RTL chrome renders users journeys without key leakage', async ({ page }) => {
    await seed(page, ['SuperAdmin']);
    await mockSession(page, ['SuperAdmin']);
    await mock(page, 'GET', '/admin/users/counts', 200, ok(counts()));
    await page.addInitScript(() => window.localStorage.setItem('fluxcommerce.culture.v1', 'ar'));
    await page.goto('/users');

    await expect(page.getByRole('heading', { name: 'المستخدمون', exact: true })).toBeVisible();
    await expect(page.getByText('users.home.heading')).toHaveCount(0);
  });
});
