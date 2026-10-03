/**
 * Admin Payments E2E for Supplement S1, Step S1.9 — Payments: Mine +
 * Admin + Stats (admin scope).
 *
 * Same backend reality as `admin-orders.spec.ts`: transports are
 * fulfilled with contract-exact payloads because no live API runs here.
 * Sessions are seeded through `localStorage`, then restoration + guards
 * + the real feature slices run: payments landing (stats snapshot),
 * platform-wide payments list with server-side pagination + filters,
 * payment details with backend-issued facts, and the status badge
 * (loaded, failed, unknown-verbatim).
 *
 * Contract-honest coverage notes (S1.1 audit):
 * - `GET /admin/payments` exposes paging plus `status`/`orderId`/
 *   `customerId`/`from`/`to`, fixed newest-first — no `sortBy`, no
 *   other filters, no search.
 * - `GET /admin/payments/stats` drives the landing (totals plus
 *   per-currency succeeded rollups).
 * - No payment payload carries history fields — no history journey
 *   ships (`ADMIN_PAYMENT_HISTORY_SUPPORTED = false`).
 * - Failed payments assert the backend-supplied `Failed` status only;
 *   no failure reason is invented (none exists on the wire).
 * - The admin never confirms cards: no Stripe calls, no mutations, no
 *   webhook journey ships.
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

function paymentSummary(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'pay-1',
    orderId: 'order-1',
    customerId: 'cust-1',
    amount: 59.98,
    currency: 'USD',
    status: 'Succeeded',
    providerPaymentIntentId: 'pi_live',
    provider: 'stripe',
    createdAtUtc: '2026-09-28T10:00:00Z',
    updatedAtUtc: '2026-09-28T10:01:00Z',
    version: 2,
    ...overrides,
  };
}

function paymentStats(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    total: 7,
    pending: 1,
    processing: 1,
    succeeded: 3,
    failed: 1,
    cancelled: 0,
    refunded: 1,
    totalsByCurrency: [{ currency: 'USD', succeededCount: 3, succeededTotalAmount: 179.94 }],
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

async function mockPaymentDetails(page: Page, payment = paymentSummary()): Promise<void> {
  await mock(page, 'GET', '/admin/payments/pay-1', 200, ok(payment));
}

test.describe('admin payments journeys (S1.9)', () => {
  test('payments landing renders the backend-issued stats snapshot', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/admin/payments/stats', 200, ok(paymentStats()));
    await page.goto('/payments');

    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
    await expect(page.getByText('7 payments')).toBeVisible();
    await expect(page.getByText('Succeeded totals by currency')).toBeVisible();
  });

  test('payments list renders rows with pager and navigates to details', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(
      page,
      'GET',
      '/admin/payments',
      200,
      ok(
        paged(
          [
            paymentSummary(),
            paymentSummary({ id: 'pay-2', status: 'Failed', providerPaymentIntentId: 'pi_fail' }),
          ],
          25,
        ),
      ),
    );
    await mockPaymentDetails(page);
    await page.goto('/payments/list');

    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'pi_live' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Payment pages' })).toBeVisible();

    await page.getByRole('link', { name: 'pi_live' }).click();
    await expect(page).toHaveURL(/\/payments\/pay-1$/);
    await expect(page.getByRole('heading', { name: 'pi_live' })).toBeVisible();
  });

  test('payments list paginates through response-effective pages', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await page.route(
      (url) => url.origin === API_ORIGIN && url.pathname === '/admin/payments',
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
                paged(
                  [paymentSummary({ id: 'pay-3', providerPaymentIntentId: 'pi_page2' })],
                  25,
                  2,
                ),
              ),
            })
          : route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: ok(paged([paymentSummary()], 25, 1)),
            });
      },
    );
    await page.goto('/payments/list');
    await expect(page.getByRole('cell', { name: 'pi_live' })).toBeVisible();

    const next = page.locator('admin-pagination').getByRole('button', { name: 'Next' });
    await next.click();

    await expect(page.getByRole('cell', { name: 'pi_page2' })).toBeVisible();
  });

  test('payments list filters by status through the backend query', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await page.route(
      (url) => url.origin === API_ORIGIN && url.pathname === '/admin/payments',
      (route: Route) => {
        if (route.request().method() !== 'GET') {
          return route.fallback();
        }
        const status = new URL(route.request().url()).searchParams.get('status') ?? '';
        return status === 'Failed'
          ? route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: ok(
                paged(
                  [
                    paymentSummary({
                      id: 'pay-2',
                      status: 'Failed',
                      providerPaymentIntentId: 'pi_fail',
                    }),
                  ],
                  1,
                ),
              ),
            })
          : route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: ok(paged([paymentSummary()], 1)),
            });
      },
    );
    await page.goto('/payments/list');
    await expect(page.getByRole('cell', { name: 'pi_live' })).toBeVisible();

    await page.locator('#payments-filter-status').selectOption('Failed');
    await page.getByRole('button', { name: 'Apply filters' }).click();

    await expect(page.getByRole('cell', { name: 'pi_fail' })).toBeVisible();
  });

  test('payments list renders the empty state without rows', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/admin/payments', 200, ok(paged([], 0)));
    await page.goto('/payments/list');

    await expect(page.getByText('No payments found')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Payment pages' })).toHaveCount(0);
  });

  test('payments list renders the error state with retry recovery', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    let calls = 0;
    await page.route(
      (url) => url.origin === API_ORIGIN && url.pathname === '/admin/payments',
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
              body: ok(paged([paymentSummary()], 1)),
            });
      },
    );
    await page.goto('/payments/list');

    await expect(page.getByText('Could not load payments')).toBeVisible();
    await page.getByRole('button', { name: 'Retry' }).click();

    await expect(page.getByRole('cell', { name: 'pi_live' })).toBeVisible();
  });

  test('unknown payments render the error state', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/admin/payments/missing', 404, problem(404, 'Not found.'));
    await page.goto('/payments/missing');

    await expect(page.getByText('Could not load payment')).toBeVisible();
  });
});

test.describe('admin payment details journeys (S1.9)', () => {
  test('payment details renders backend-issued facts with the status badge', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mockPaymentDetails(page);
    await page.goto('/payments/pay-1');

    await expect(page.getByRole('heading', { name: 'pi_live' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to payments' })).toBeVisible();
    await expect(page.getByText('stripe').first()).toBeVisible();
    await expect(page.getByText('order-1').first()).toBeVisible();
    await expect(page.getByText('cust-1').first()).toBeVisible();

    await page.getByRole('link', { name: 'Back to payments' }).click();
    await expect(page).toHaveURL(/\/payments\/list$/);
  });

  test('failed payments render the backend-supplied status only', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mockPaymentDetails(page, paymentSummary({ status: 'Failed' }));
    await page.goto('/payments/pay-1');

    await expect(page.getByText('Failed').first()).toBeVisible();
    await expect(page.locator('section[aria-labelledby="payment-details-title"]')).toBeVisible();
  });
});

test.describe('admin payments authorization + localization (S1.9)', () => {
  test('customers land on forbidden for payments routes', async ({ page }) => {
    await seed(page, ['Customer']);
    await mockSession(page, ['Customer']);
    await page.goto('/payments/list');

    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test('French chrome localizes payments journeys', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/admin/payments', 200, ok(paged([paymentSummary()], 1)));
    await mockPaymentDetails(page);
    await page.addInitScript(() => window.localStorage.setItem('fluxcommerce.culture.v1', 'fr'));
    await page.goto('/payments/list');

    await expect(page.getByRole('heading', { name: 'Paiements' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Liste des paiements' })).toBeVisible();

    await page.goto('/payments/pay-1');
    await expect(page.getByText('Montant')).toBeVisible();
  });

  test('RTL chrome renders payments journeys without key leakage', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/admin/payments', 200, ok(paged([paymentSummary()], 1)));
    await mockPaymentDetails(page);
    await page.addInitScript(() => window.localStorage.setItem('fluxcommerce.culture.v1', 'ar'));
    await page.goto('/payments/list');

    await expect(page.getByRole('heading', { name: 'المدفوعات' })).toBeVisible();

    await page.goto('/payments/pay-1');
    await expect(page.getByText('المبلغ')).toBeVisible();
  });
});
