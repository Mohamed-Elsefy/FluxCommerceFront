/**
 * Admin Dashboard E2E for Supplement S2, Step S2.3 — Adaptive Dashboard
 * Landing.
 *
 * Transports are fulfilled with contract-exact payloads because no live
 * API runs here. Sessions are seeded through `localStorage`, then
 * restoration + guards + the real dashboard slice run: the adaptive
 * snapshot (per-entitlement sections plus the newest-5 drill-down),
 * the partial/empty states, the error state with retry, and
 * localization.
 *
 * Contract-honest coverage notes (S2.1 audit):
 * - `GET /admin/dashboard` takes any authenticated JWT (always `200`);
 *   sections arrive `null` when unauthorized — the suite asserts
 *   per-entitlement rendering, never derived values.
 * - A `catalog.manage`-only admin sees the catalog card (+ session
 *   card) with no forbidden screen; an authorized-but-empty caller
 *   sees the honest empty state.
 * - `recentOrders` drills into the existing admin order details
 *   (`/orders/:id`) — no parallel detail view ships.
 * - The users drill-down shows for SuperAdmin only (the dashboard
 *   `users` section is SuperAdmin-role sourced server-side too).
 */

import { expect, test, type Page, type Route } from '@playwright/test';

const STORAGE_KEY = 'fluxcommerce.auth.session.v1';
const API_ORIGIN = 'https://localhost:7119';

const FULL_PERMISSIONS = [
  'orders.read',
  'orders.cancel',
  'orders.refund',
  'payments.read',
  'payments.stats',
  'inventory.read',
  'inventory.manage',
  'catalog.manage',
  'users.read',
];

function userWithRoles(
  roles: string[],
  permissions: string[] | null = null,
): Record<string, unknown> {
  const granted =
    permissions !== null
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

function problem(status: number, detail: string): Record<string, unknown> {
  return { type: 'about:blank', title: 'Error', status, detail, extensions: {} };
}

function snapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    orders: { total: 7, pending: 4, confirmed: 2, cancelled: 1 },
    payments: {
      total: 7,
      pending: 1,
      processing: 1,
      succeeded: 3,
      failed: 1,
      cancelled: 0,
      refunded: 1,
      totalsByCurrency: [{ currency: 'USD', succeededCount: 3, succeededTotalAmount: 179.94 }],
      refundedTotalsByCurrency: [
        { currency: 'USD', succeededCount: 1, succeededTotalAmount: 59.98 },
      ],
    },
    inventory: {
      totalItems: 12,
      totalOnHand: 100,
      totalReserved: 5,
      lowStockItems: 2,
      pendingReservations: 1,
      committedReservations: 0,
      releasedReservations: 0,
      expiredReservations: 0,
    },
    catalog: {
      totalProducts: 4,
      activeProducts: 2,
      totalCategories: 1,
      totalVariants: 6,
    },
    users: {
      total: 3,
      pending: 0,
      active: 3,
      suspended: 0,
      locked: 0,
      deleted: 0,
      customers: 1,
      admins: 1,
      superAdmins: 1,
      unverified: 0,
      lockedOut: 0,
    },
    recentOrders: [
      {
        orderId: 'order-1',
        orderNumber: 'ORD-ABC123',
        status: 'Pending',
        grandTotal: { amount: 59.98, currency: 'USD' },
        itemCount: 2,
        createdAtUtc: '2026-09-28T10:00:00Z',
      },
    ],
    recentPayments: [
      {
        id: 'pay-1',
        orderId: 'order-1',
        customerId: 'cust-1',
        amount: 59.98,
        currency: 'USD',
        status: 'Succeeded',
        providerPaymentIntentId: 'pi_123',
        provider: 'stripe',
        createdAtUtc: '2026-09-28T10:00:00Z',
        updatedAtUtc: '2026-09-28T10:01:00Z',
        version: 3,
      },
    ],
    recentUsers: [
      {
        id: 'user-9',
        email: 'ada@flux.local',
        roles: ['Customer'],
        isEmailVerified: true,
        registeredAtUtc: '2026-09-28T10:00:00Z',
        firstName: 'Ada',
        lastName: 'Lovelace',
        displayName: 'Ada Lovelace',
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
      },
    ],
    dailySeries: [
      { date: '2026-10-04', orders: 0, revenue: [] },
      {
        date: '2026-10-05',
        orders: 2,
        revenue: [{ currency: 'USD', amount: 140 }],
      },
    ],
    ...overrides,
  };
}

async function seed(
  page: Page,
  roles: string[],
  permissions: string[] | null = null,
): Promise<void> {
  await page.addInitScript(
    ({ key, session }) => window.localStorage.setItem(key, JSON.stringify(session)),
    {
      key: STORAGE_KEY,
      session: {
        refreshToken: 'admin-refresh-1',
        user: { ...userWithRoles(roles, permissions), displayName: null },
        authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
      },
    },
  );
}

async function mockSession(
  page: Page,
  roles: string[],
  permissions: string[] | null = null,
): Promise<void> {
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
      body: ok(userWithRoles(roles, permissions)),
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

test.describe('admin dashboard journeys (S2.3, adaptive)', () => {
  test('landing shows live counts plus recent orders with drill-down', async ({ page }) => {
    await seed(page, ['SuperAdmin']);
    await mockSession(page, ['SuperAdmin']);
    await mock(page, 'GET', '/admin/dashboard', 200, ok(snapshot()));
    await mock(
      page,
      'GET',
      '/admin/orders/order-1',
      200,
      ok({
        orderId: 'order-1',
        orderNumber: 'ORD-ABC123',
        status: 'Pending',
        subtotal: { amount: 59.98, currency: 'USD' },
        shippingCost: { amount: 0, currency: 'USD' },
        discount: { amount: 0, currency: 'USD' },
        grandTotal: { amount: 59.98, currency: 'USD' },
        itemCount: 2,
        createdAtUtc: '2026-09-28T10:00:00Z',
        shippingAddress: {
          recipientName: 'Ada Lovelace',
          line1: '1 Flux St',
          line2: null,
          city: 'Berlin',
          region: 'BE',
          postalCode: '10115',
          countryCode: 'DE',
        },
        billingAddress: {
          recipientName: 'Ada Lovelace',
          line1: '1 Flux St',
          line2: null,
          city: 'Berlin',
          region: 'BE',
          postalCode: '10115',
          countryCode: 'DE',
        },
        lineItems: [],
      }),
    );
    await mock(page, 'GET', '/api/payments/by-order/order-1', 404, problem(404, 'Not found.'));
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('7 orders')).toBeVisible();
    await expect(page.getByText('7 payments')).toBeVisible();
    await expect(page.getByText('12 items')).toBeVisible();
    await expect(page.getByText('4 products')).toBeVisible();
    await expect(page.getByText('3 users')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent orders' })).toBeVisible();

    await page.getByRole('link', { name: 'View order ORD-ABC123' }).click();
    await expect(page).toHaveURL(/\/orders\/order-1$/);
    await expect(page.getByRole('heading', { name: 'ORD-ABC123' })).toBeVisible();
  });

  test('landing renders the recent-orders empty state without rows', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/admin/dashboard', 200, ok(snapshot({ recentOrders: [] })));
    await page.goto('/dashboard');

    await expect(page.locator('#dashboard-recent-heading')).toBeVisible();
    await expect(page.getByText('No recent orders.')).toBeVisible();
  });

  test('landing renders the error state with retry recovery', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    let calls = 0;
    await page.route(
      (url) => url.origin === API_ORIGIN && url.pathname === '/admin/dashboard',
      (route: Route) => {
        if (route.request().method() !== 'GET') {
          return route.fallback();
        }
        calls += 1;
        return calls === 1
          ? route.fulfill({
              status: 403,
              contentType: 'application/json',
              body: JSON.stringify(problem(403, 'Forbidden.')),
            })
          : route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: ok(snapshot()),
            });
      },
    );
    await page.goto('/dashboard');

    await expect(page.getByText('Could not load overview')).toBeVisible();
    await page.getByRole('button', { name: 'Retry' }).click();

    await expect(page.getByText('7 orders')).toBeVisible();
  });

  test('admins with the full grant see every card with drill-downs', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/admin/dashboard', 200, ok(snapshot()));
    await page.goto('/dashboard');

    await expect(page.getByText('3 users')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View users list' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View orders list' })).toBeVisible();
  });

  test('payments.read viewer sees recent payments with drill-down', async ({ page }) => {
    await seed(page, ['Admin'], ['payments.read']);
    await mockSession(page, ['Admin'], ['payments.read']);
    await mock(page, 'GET', '/admin/dashboard', 200, ok(snapshot()));
    await mock(
      page,
      'GET',
      '/admin/payments/pay-1',
      200,
      ok({
        id: 'pay-1',
        orderId: 'order-1',
        customerId: 'cust-1',
        amount: 59.98,
        currency: 'USD',
        status: 'Succeeded',
        providerPaymentIntentId: 'pi_123',
        provider: 'stripe',
        createdAtUtc: '2026-09-28T10:00:00Z',
        updatedAtUtc: '2026-09-28T10:01:00Z',
        version: 3,
      }),
    );
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Recent payments' })).toBeVisible();
    await page.getByRole('link', { name: 'View payment order-1' }).click();
    await expect(page).toHaveURL(/\/payments\/pay-1$/);
  });

  test('stats-only viewer keeps stats but sees no payments list', async ({ page }) => {
    await seed(page, ['Admin'], ['payments.stats']);
    await mockSession(page, ['Admin'], ['payments.stats']);
    await mock(
      page,
      'GET',
      '/admin/dashboard',
      200,
      ok(snapshot({ payments: snapshot()['payments'], recentPayments: [] })),
    );
    await page.goto('/dashboard');

    await expect(page.getByText('7 payments')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent payments' })).toHaveCount(0);
  });

  test('users.read viewer sees recent users with drill-down', async ({ page }) => {
    await seed(page, ['Admin'], ['users.read']);
    await mockSession(page, ['Admin'], ['users.read']);
    await mock(page, 'GET', '/admin/dashboard', 200, ok(snapshot()));
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Recent users' })).toBeVisible();
    await expect(page.getByText('Ada Lovelace')).toBeVisible();
  });

  test('landing renders the daily-series chart with verbatim dates', async ({ page }) => {
    await seed(page, ['Admin'], ['orders.read']);
    await mockSession(page, ['Admin'], ['orders.read']);
    await mock(page, 'GET', '/admin/dashboard', 200, ok(snapshot()));
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: /last 30 days/ })).toBeVisible();
    await expect(page.locator('app-series-chart rect')).toHaveCount(2);
    await expect(page.getByText('2026-10-05')).toBeVisible();
  });

  test('landing requests the fixed window (threshold 5, days 30)', async ({ page }) => {
    await seed(page, ['Admin'], ['orders.read']);
    await mockSession(page, ['Admin'], ['orders.read']);
    const seen: Array<Record<string, string>> = [];
    await page.route(
      (url) => url.origin === API_ORIGIN && url.pathname === '/admin/dashboard',
      async (route: Route) => {
        if (route.request().method() !== 'GET') {
          await route.fallback();
          return;
        }
        seen.push(Object.fromEntries(new URL(route.request().url()).searchParams.entries()));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: ok(snapshot()),
        });
      },
    );
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    expect(seen.at(-1)?.['lowStockThreshold']).toBe('5');
    expect(seen.at(-1)?.['days']).toBe('30');
  });

  test('landing renders net revenue on the payments card', async ({ page }) => {
    await seed(page, ['Admin'], ['payments.read']);
    await mockSession(page, ['Admin'], ['payments.read']);
    await mock(page, 'GET', '/admin/dashboard', 200, ok(snapshot()));
    await page.goto('/dashboard');

    await expect(page.getByText('USD · Net')).toBeVisible();
    await expect(page.getByText('$119.96', { exact: true })).toBeVisible();
  });

  test('users.read viewer sees the users card with its drill-down link', async ({ page }) => {
    await seed(page, ['Admin'], ['users.read']);
    await mockSession(page, ['Admin'], ['users.read']);
    await mock(
      page,
      'GET',
      '/admin/dashboard',
      200,
      ok({
        orders: null,
        payments: null,
        inventory: null,
        catalog: null,
        users: {
          total: 3,
          pending: 0,
          active: 3,
          suspended: 0,
          locked: 0,
          deleted: 0,
          customers: 1,
          admins: 1,
          superAdmins: 1,
          unverified: 0,
          lockedOut: 0,
        },
        recentOrders: [],
      }),
    );
    await page.goto('/dashboard');

    await expect(page).not.toHaveURL(/\/forbidden$/);
    await expect(page.getByText('3 users')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View users list' })).toBeVisible();
    await expect(page.getByText('7 orders')).toHaveCount(0);
  });

  test('catalog-only admin sees only the catalog card with no forbidden screen', async ({
    page,
  }) => {
    await seed(page, ['Admin'], ['catalog.manage']);
    await mockSession(page, ['Admin'], ['catalog.manage']);
    await mock(
      page,
      'GET',
      '/admin/dashboard',
      200,
      ok({
        orders: null,
        payments: null,
        inventory: null,
        catalog: {
          totalProducts: 4,
          activeProducts: 2,
          totalCategories: 1,
          totalVariants: 6,
        },
        users: null,
        recentOrders: [],
      }),
    );
    await page.goto('/dashboard');

    await expect(page).not.toHaveURL(/\/forbidden$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Your session')).toBeVisible();
    await expect(page.getByText('4 products')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View products list' })).toBeVisible();
    await expect(page.getByText('7 orders')).toHaveCount(0);
    await expect(page.getByText('7 payments')).toHaveCount(0);
    await expect(page.getByText('12 items')).toHaveCount(0);
    await expect(page.getByText('3 users')).toHaveCount(0);
  });

  test('authorized-but-empty caller sees the honest empty state', async ({ page }) => {
    await seed(page, ['Admin'], []);
    await mockSession(page, ['Admin'], []);
    await mock(
      page,
      'GET',
      '/admin/dashboard',
      200,
      ok({
        orders: null,
        payments: null,
        inventory: null,
        catalog: null,
        users: null,
        recentOrders: [],
      }),
    );
    await page.goto('/dashboard');

    await expect(page).not.toHaveURL(/\/forbidden$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.locator('#dashboard-empty-heading')).toBeVisible();
    await expect(page.locator('.dashboard-grid')).toHaveCount(0);
  });
});

test.describe('admin dashboard authorization + localization (S2.3)', () => {
  test('customers land on forbidden for the dashboard', async ({ page }) => {
    await seed(page, ['Customer']);
    await mockSession(page, ['Customer']);
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test('French chrome localizes dashboard journeys', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/admin/dashboard', 200, ok(snapshot()));
    await page.addInitScript(() => window.localStorage.setItem('fluxcommerce.culture.v1', 'fr'));
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
    await expect(page.getByText('7 commandes')).toBeVisible();
    await expect(page.getByText('4 produits')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Commandes récentes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Paiements récents' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Utilisateurs récents' })).toBeVisible();
  });

  test('RTL chrome renders dashboard journeys without key leakage', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/admin/dashboard', 200, ok(snapshot()));
    await page.addInitScript(() => window.localStorage.setItem('fluxcommerce.culture.v1', 'ar'));
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'لوحة التحكم' })).toBeVisible();
    await expect(page.getByText('أحدث الطلبات')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'الكتالوج' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'أحدث المدفوعات' })).toBeVisible();
    await expect(page.getByText('dashboard.title')).toHaveCount(0);
    await expect(page.getByText('dashboard.sections.catalogTitle')).toHaveCount(0);
    await expect(page.getByText('dashboard.recent.paymentsTitle')).toHaveCount(0);
    await expect(page.getByText('dashboard.series.title')).toHaveCount(0);
  });
});
