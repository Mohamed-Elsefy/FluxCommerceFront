/**
 * Admin Orders & Payments E2E for Supplement S1, Step S1.8 — Admin Orders
 * Upgrade + Storefront Status Filter (admin scope).
 *
 * Same backend reality as `admin-catalog.spec.ts`: transports are
 * fulfilled with contract-exact payloads because no live API runs here.
 * Sessions are seeded through `localStorage`, then restoration + guards
 * + the real feature slices run: orders landing (counts snapshot),
 * platform-wide orders list with server-side pagination + filters,
 * order details with addresses and line items, force-cancel + refund
 * actions, and the payment section (loaded, missing, unready-retry,
 * failed).
 *
 * Contract-honest coverage notes (S1.1 audit):
 * - `GET /admin/orders` exposes paging plus `status`/`customerId`/
 *   `search`/`from`/`to` (newest-first) — the suite asserts the
 *   PRESENCE of the filter bar and a status-filter journey.
 * - `GET /admin/orders/counts` drives the landing (replaces the old
 *   `pageSize=1` hack).
 * - `POST /admin/orders/{id}/cancel` (force-cancel any `Pending`) and
 *   `POST /admin/orders/{id}/refund {reason 1..500}` drive the details
 *   actions (page-local submissions, duplicate-submit locked).
 * - No order payload carries payment fields — payment assertions run
 *   against the by-order initialization read chained into the single
 *   payment read, the only supported linkage.
 * - No payment-history endpoint exists — no history journey ships.
 * - Failed payments assert the backend-supplied `Failed` status only;
 *   no failure reason is invented (none exists on the wire).
 */

import { expect, test, type Page, type Route } from '@playwright/test';

const STORAGE_KEY = 'fluxcommerce.auth.session.v1';
const API_ORIGIN = 'https://localhost:7119';

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

function problem(status: number, detail: string): Record<string, unknown> {
  return { type: 'about:blank', title: 'Error', status, detail, extensions: {} };
}

function address(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    recipientName: 'Ada Lovelace',
    line1: '1 Flux St',
    line2: null,
    city: 'Berlin',
    region: 'BE',
    postalCode: '10115',
    countryCode: 'DE',
    ...overrides,
  };
}

function orderSummary(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    orderId: 'order-1',
    orderNumber: 'ORD-ABC123',
    status: 'Pending',
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-28T10:00:00Z',
    ...overrides,
  };
}

function orderDetails(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    orderId: 'order-1',
    orderNumber: 'ORD-ABC123',
    status: 'Pending',
    subtotal: { amount: 59.98, currency: 'USD' },
    shippingCost: { amount: 0, currency: 'USD' },
    discount: { amount: 0, currency: 'USD' },
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-28T10:00:00Z',
    shippingAddress: address(),
    billingAddress: address(),
    lineItems: [
      {
        productName: 'Tee',
        sku: 'TEE-BLK-M',
        quantity: 2,
        unitPrice: 29.99,
        unitPriceCurrency: 'USD',
        lineTotal: 59.98,
        lineTotalCurrency: 'USD',
      },
    ],
    ...overrides,
  };
}

function paymentInit(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    paymentId: 'pay-1',
    orderId: 'order-1',
    clientSecret: 'secret-live',
    paymentReference: 'pi_live',
    status: 'Pending',
    ...overrides,
  };
}

function payment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'pay-1',
    orderId: 'order-1',
    customerId: 'cust-1',
    amount: 59.98,
    currency: 'USD',
    status: 'Processing',
    providerPaymentIntentId: 'pi_live',
    provider: 'stripe',
    createdAtUtc: '2026-09-28T10:00:00Z',
    updatedAtUtc: null,
    version: 2,
    ...overrides,
  };
}

function paged(items: unknown[], totalCount: number, pageNumber = 1): Record<string, unknown> {
  return { items, totalCount, pageNumber, pageSize: 20 };
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

function orderCounts(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { total: 7, pending: 4, confirmed: 2, cancelled: 1, ...overrides };
}

async function mockOrderDetails(
  page: Page,
  options: {
    order?: Record<string, unknown>;
    init?: Record<string, unknown> | null;
    payment?: Record<string, unknown> | null;
  } = {},
): Promise<void> {
  await mock(page, 'GET', '/admin/orders/order-1', 200, ok(options.order ?? orderDetails()));
  if (options.init === null) {
    await mock(page, 'GET', '/api/payments/by-order/order-1', 404, problem(404, 'Not found.'));
  } else {
    await mock(
      page,
      'GET',
      '/api/payments/by-order/order-1',
      200,
      ok(options.init ?? paymentInit()),
    );
  }
  if (options.payment !== null && options.init !== null) {
    await mock(page, 'GET', '/api/payments/pay-1', 200, ok(options.payment ?? payment()));
  }
}

test.describe('admin orders journeys (S1.8)', () => {
  test('orders landing renders the backend-issued counts snapshot', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/admin/orders/counts', 200, ok(orderCounts()));
    await page.goto('/orders');

    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
    await expect(page.getByText('7 orders')).toBeVisible();
  });

  test('orders list renders rows with pager and navigates to details', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(
      page,
      'GET',
      '/admin/orders',
      200,
      ok(
        paged(
          [
            orderSummary(),
            orderSummary({ orderId: 'order-2', orderNumber: 'ORD-DEF456', status: 'Confirmed' }),
          ],
          25,
        ),
      ),
    );
    await mockOrderDetails(page);
    await page.goto('/orders/list');

    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ORD-ABC123' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Order pages' })).toBeVisible();

    await page.getByRole('link', { name: 'ORD-ABC123' }).click();
    await expect(page).toHaveURL(/\/orders\/order-1$/);
    await expect(page.getByRole('heading', { name: 'ORD-ABC123' })).toBeVisible();
  });

  test('orders list paginates through response-effective pages', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await page.route(
      (url) => url.origin === API_ORIGIN && url.pathname === '/admin/orders',
      (route: Route) => {
        if (route.request().method() !== 'GET') {
          return route.fallback();
        }
        const pageNumber = new URL(route.request().url()).searchParams.get('pageNumber') ?? '1';
        return pageNumber === '2'
          ? route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: ok(
                paged([orderSummary({ orderId: 'order-3', orderNumber: 'ORD-GHI789' })], 25, 2),
              ),
            })
          : route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: ok(paged([orderSummary()], 25, 1)),
            });
      },
    );
    await page.goto('/orders/list');
    await expect(page.getByRole('cell', { name: 'ORD-ABC123' })).toBeVisible();

    const next = page.locator('admin-pagination').getByRole('button', { name: 'Next' });
    await next.click();

    await expect(page.getByRole('cell', { name: 'ORD-GHI789' })).toBeVisible();
  });

  test('orders list renders the empty state without rows', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/admin/orders', 200, ok(paged([], 0)));
    await page.goto('/orders/list');

    await expect(page.getByText('No orders found')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Order pages' })).toHaveCount(0);
  });

  test('orders list renders the error state with retry recovery', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    let calls = 0;
    await page.route(
      (url) => url.origin === API_ORIGIN && url.pathname === '/admin/orders',
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
              body: ok(paged([orderSummary()], 1)),
            });
      },
    );
    await page.goto('/orders/list');

    await expect(page.getByText('Could not load orders')).toBeVisible();
    await page.getByRole('button', { name: 'Retry' }).click();

    await expect(page.getByRole('cell', { name: 'ORD-ABC123' })).toBeVisible();
  });

  test('orders list exposes the platform-wide filter bar (S1.8 contract)', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/admin/orders', 200, ok(paged([orderSummary()], 1)));
    await page.goto('/orders/list');

    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
    await expect(page.locator('admin-filter-bar')).toHaveCount(1);
    await expect(page.locator('#orders-filter-status')).toBeVisible();
    await expect(page.locator('#orders-filter-customer')).toBeVisible();
    await expect(page.locator('#orders-filter-search')).toBeVisible();
  });

  test('orders list filters by status through the backend query', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await page.route(
      (url) => url.origin === API_ORIGIN && url.pathname === '/admin/orders',
      (route: Route) => {
        if (route.request().method() !== 'GET') {
          return route.fallback();
        }
        const status = new URL(route.request().url()).searchParams.get('status') ?? '';
        return status === 'Confirmed'
          ? route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: ok(
                paged(
                  [
                    orderSummary({
                      orderId: 'order-2',
                      orderNumber: 'ORD-DEF456',
                      status: 'Confirmed',
                    }),
                  ],
                  1,
                ),
              ),
            })
          : route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: ok(paged([orderSummary()], 1)),
            });
      },
    );
    await page.goto('/orders/list');
    await expect(page.getByRole('cell', { name: 'ORD-ABC123' })).toBeVisible();

    await page.locator('#orders-filter-status').selectOption('Confirmed');
    await page.getByRole('button', { name: 'Apply filters' }).click();

    await expect(page.getByRole('cell', { name: 'ORD-DEF456' })).toBeVisible();
  });

  test('unknown orders render the error state', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/admin/orders/missing', 404, problem(404, 'Not found.'));
    await page.goto('/orders/missing');

    await expect(page.getByText('Could not load order')).toBeVisible();
  });
});

test.describe('admin order details journeys (S1.8)', () => {
  test('order details renders facts, addresses, and items', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mockOrderDetails(page);
    await page.goto('/orders/order-1');

    await expect(page.getByRole('heading', { name: 'ORD-ABC123' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to orders' })).toBeVisible();
    await expect(page.getByText('Ada Lovelace').first()).toBeVisible();
    await expect(page.getByText('Berlin').first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Tee', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'TEE-BLK-M' })).toBeVisible();

    await page.getByRole('link', { name: 'Back to orders' }).click();
    await expect(page).toHaveURL(/\/orders\/list$/);
  });

  test('order details renders the payment section', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mockOrderDetails(page);
    await page.goto('/orders/order-1');

    await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible();
    await expect(page.getByText('Processing').first()).toBeVisible();
    await expect(page.getByText('pi_live').first()).toBeVisible();
    await expect(page.getByText('stripe').first()).toBeVisible();
  });

  test('failed payments render the backend-supplied status only', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mockOrderDetails(page, { payment: payment({ status: 'Failed' }) });
    await page.goto('/orders/order-1');

    await expect(page.getByText('Failed').first()).toBeVisible();
    await expect(
      page.locator('section[aria-labelledby="order-details-payment-title"]'),
    ).toBeVisible();
  });

  test('missing payments render the empty notice', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mockOrderDetails(page, { init: null, payment: null });
    await page.goto('/orders/order-1');

    await expect(page.getByRole('heading', { name: 'ORD-ABC123' })).toBeVisible();
    await expect(page.getByText('No payment information')).toBeVisible();
  });

  test('unready payments render the retryable error with recovery', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    let calls = 0;
    await page.route(
      (url) => url.origin === API_ORIGIN && url.pathname === '/api/payments/by-order/order-1',
      (route: Route) => {
        if (route.request().method() !== 'GET') {
          return route.fallback();
        }
        calls += 1;
        return calls === 1
          ? route.fulfill({
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify(problem(409, 'Not ready.')),
            })
          : route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: ok(paymentInit()),
            });
      },
    );
    await mock(page, 'GET', '/api/payments/pay-1', 200, ok(payment()));
    await mock(page, 'GET', '/admin/orders/order-1', 200, ok(orderDetails()));
    await page.goto('/orders/order-1');

    await expect(page.getByText('Could not load payment')).toBeVisible();

    const section = page.locator('section[aria-labelledby="order-details-payment-title"]');
    await section.getByRole('button', { name: 'Retry' }).click();

    await expect(section.getByText('Processing')).toBeVisible();
  });

  test('force-cancel ends a Pending order behind the confirm dialog', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mockOrderDetails(page);
    await mock(
      page,
      'POST',
      '/admin/orders/order-1/cancel',
      200,
      ok(orderDetails({ status: 'Cancelled' })),
    );
    await page.goto('/orders/order-1');

    await page.getByRole('button', { name: 'Cancel order' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByText('Order cancelled')).toBeVisible();
  });

  test('refund starts for a Confirmed order with a reason', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mockOrderDetails(page, { order: orderDetails({ status: 'Confirmed' }) });
    await mock(
      page,
      'POST',
      '/admin/orders/order-1/refund',
      200,
      ok(orderDetails({ status: 'Confirmed' })),
    );
    await page.goto('/orders/order-1');

    await page.getByRole('button', { name: 'Refund order' }).click();
    await page.locator('#order-refund-reason').fill('Duplicate charge');
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByText('Refund started')).toBeVisible();
  });
});

test.describe('admin orders authorization + localization (S1.8)', () => {
  test('customers land on forbidden for orders routes', async ({ page }) => {
    await seed(page, ['Customer']);
    await mockSession(page, ['Customer']);
    await page.goto('/orders/list');

    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test('French chrome localizes orders journeys', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/admin/orders', 200, ok(paged([orderSummary()], 1)));
    await mockOrderDetails(page);
    await page.addInitScript(() => window.localStorage.setItem('fluxcommerce.culture.v1', 'fr'));
    await page.goto('/orders/list');

    await expect(page.getByRole('heading', { name: 'Commandes' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Liste des commandes' })).toBeVisible();

    await page.goto('/orders/order-1');
    await expect(page.getByText('Informations client')).toBeVisible();
  });

  test('RTL chrome renders orders journeys without key leakage', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/admin/orders', 200, ok(paged([orderSummary()], 1)));
    await mockOrderDetails(page);
    await page.addInitScript(() => window.localStorage.setItem('fluxcommerce.culture.v1', 'ar'));
    await page.goto('/orders/list');

    await expect(page.getByRole('heading', { name: 'الطلبات' })).toBeVisible();

    await page.goto('/orders/order-1');
    await expect(page.getByText('معلومات العميل')).toBeVisible();
    await expect(page.getByText('الدفع')).toBeVisible();
  });
});
