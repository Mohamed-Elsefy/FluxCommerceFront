/**
 * Orders & Customer Account E2E journeys for Sub-Phase 10.9 — Testing,
 * E2E & Phase Completion.
 *
 * Covers the critical customer post-purchase journeys through the real
 * storefront (routing, guards, lazy boundaries, pages, components,
 * feature state, real timers for bounded polling) with transport mocked
 * at the network boundary (`page.route`) and a small STATEFUL mock
 * backend (session, profile, paged order summaries, programmable order
 * reads with saga-lag status queues, checkout, payment initialization):
 *
 * ```text
 * Journey 1  Login → Account → Profile View
 * Journey 2  Login → Account → Orders List → Pagination
 * Journey 3  Orders List → Select Order → Order Details (backend data)
 * Journey 4  Checkout → Create Order → Payment → Payment Result
 *            (executable prefix; live-Stripe remainder skipped below)
 * Journey 5  Payment Success → Order Processing → Bounded Polling →
 *            Updated Order Terminal State
 * ```
 *
 * Contract scope: no live API runs in this environment — every price,
 * count, total, and status asserted below comes from a mock response,
 * and the suite fails if the UI ever computes them. Dataless envelopes,
 * `401` anonymous reads, and masked `404` foreign ids follow the
 * contract shapes (`ApiResponse`, `ProblemDetail`, wire casing).
 *
 * Backend-authoritative rule (pinned throughout): the failed-payment
 * result presents NO order link (no success is invented), and polling
 * stops on the backend terminal status (never a client-side verdict).
 */

import { expect, test, type Page } from '@playwright/test';

const API_ORIGIN = 'https://localhost:7119';
const AUTH_KEY = 'fluxcommerce.auth.session.v1';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const CART_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const ORDER_B = 'bbbbbbbb-2222-4222-8222-222222222222';

interface MockAddress {
  recipientName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
}

interface MockSummary {
  orderId: string;
  orderNumber: string;
  status: string;
  grandTotal: { amount: number; currency: string };
  itemCount: number;
  createdAtUtc: string;
}

/** Stateful mock backend: session, profile, pages, order reads, checkout. */
interface OrdersBackend {
  orderReads: string[];
  listQueries: Array<Record<string, string>>;
  orderCalls: number;
  /** Saga-lag simulation: status queue consumed per order read. */
  statusQueue: string[];
}

function address(): MockAddress {
  return {
    recipientName: 'Ada Lovelace',
    line1: '1 Flux St',
    line2: null,
    city: 'Berlin',
    region: 'BE',
    postalCode: '10115',
    countryCode: 'DE',
  };
}

function summary(orderId: string, orderNumber: string, status: string): MockSummary {
  return {
    orderId,
    orderNumber,
    status,
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-04T10:00:00Z',
  };
}

function details(orderId: string, orderNumber: string, status: string): Record<string, unknown> {
  return {
    orderId,
    orderNumber,
    status,
    subtotal: { amount: 59.98, currency: 'USD' },
    shippingCost: { amount: 0, currency: 'USD' },
    discount: { amount: 0, currency: 'USD' },
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-04T10:00:00Z',
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
  };
}

function userResponse(): Record<string, unknown> {
  return {
    id: USER_ID,
    email: 'ada@flux.local',
    roles: ['Customer'],
    isEmailVerified: true,
    registeredAtUtc: '2026-09-04T10:00:00Z',
    firstName: 'Ada',
    lastName: 'Lovelace',
    displayName: 'Ada Lovelace',
    phoneNumber: null,
    isPhoneVerified: false,
    avatarUrl: null,
    preferredLanguage: 'en',
    timeZone: 'UTC',
    status: 1,
  };
}

function envelope(data: unknown): Record<string, unknown> {
  return { isSuccess: true, message: 'Operation completed successfully.', data };
}

function problem(status: number, title: string, detail: string): Record<string, unknown> {
  return { type: 'about:blank', title, status, detail, extensions: {} };
}

/** Seeds an authenticated session (mirrors the auth-suite storage shape). */
async function mockSession(page: Page): Promise<void> {
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      json: envelope({
        userId: USER_ID,
        email: 'ada@flux.local',
        roles: ['Customer'],
        accessToken: 'e2e-access-2',
        refreshToken: 'e2e-refresh-2',
        refreshTokenExpiresAtUtc: '2026-09-13T12:00:00Z',
      }),
    }),
  );
  await page.route('**/auth/me', (route) => route.fulfill({ json: envelope(userResponse()) }));
  await page.addInitScript(
    ({ key, user }) =>
      window.localStorage.setItem(
        key,
        JSON.stringify({
          refreshToken: 'e2e-refresh-1',
          user,
          authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
        }),
      ),
    { key: AUTH_KEY, user: userResponse() },
  );
}

/** Mocks the paged orders list (query-aware) and id-scoped order reads. */
async function mockOrdersApi(
  page: Page,
  backend: OrdersBackend,
  pages: Record<string, { items: MockSummary[]; totalCount: number }>,
): Promise<void> {
  await page.route(
    (url) => url.origin === API_ORIGIN && url.pathname === '/orders',
    async (route) => {
      const url = new URL(route.request().url());
      const query = Object.fromEntries(url.searchParams.entries());
      backend.listQueries.push(query);
      const key = query['pageNumber'] ?? '1';
      const pageData = pages[key] ?? { items: [], totalCount: 0 };
      await route.fulfill({
        json: envelope({ ...pageData, pageNumber: Number(key), pageSize: 20 }),
      });
    },
  );

  await page.route(
    (url) =>
      url.origin === API_ORIGIN &&
      url.pathname.startsWith('/orders/') &&
      url.pathname !== '/orders/checkout',
    async (route) => {
      const orderId = route.request().url().split('/orders/')[1] ?? 'unknown';
      backend.orderReads.push(orderId);
      const status = backend.statusQueue.length > 0 ? backend.statusQueue.shift() : 'Confirmed';
      const number = orderId === ORDER_B ? 'ORD-E2E-000002' : 'ORD-E2E-000001';
      await route.fulfill({ json: envelope(details(orderId, number, status ?? 'Confirmed')) });
    },
  );
}

/**
 * The dev server renders with SSR + hydration: navigation waits for the
 * shell to leave its `initializing` placeholder before touching anything.
 */
async function gotoStable(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(
    page.getByRole('link', { name: 'Login' }).first().or(page.getByText('Ada Lovelace')),
  ).toBeVisible();
}

/**
 * Hydration-safe fill: lazy page chunks can finish claiming their inputs
 * at any moment, so a value only counts once it survives an undisturbed
 * observation window.
 */
async function fillField(
  scope: Page | ReturnType<Page['locator']>,
  label: string,
  value: string,
): Promise<void> {
  const field = scope.getByLabel(label, { exact: label === 'Password' });
  await expect
    .poll(
      async () => {
        if ((await field.inputValue()) !== value) {
          await field.fill(value);
          return 'refilling';
        }
        await new Promise((resolve) => setTimeout(resolve, 750));
        return field.inputValue();
      },
      { timeout: 20000 },
    )
    .toBe(value);
}

const ADDRESS_LABELS = {
  recipientName: 'Full name',
  line1: 'Street address',
  city: 'City',
  region: 'State / Region',
  postalCode: 'Postal code',
  countryCode: 'Country code',
} as const;

/** Fills one checkout address section (scoped by its legend) field by field. */
async function fillAddress(page: Page, section: 'Shipping address' | 'Billing address') {
  const scope = page.locator('checkout-address-form', { hasText: section });
  await expect(scope.getByText(section)).toBeVisible();
  await fillField(scope, ADDRESS_LABELS.recipientName, 'Ada Lovelace');
  await fillField(scope, ADDRESS_LABELS.line1, '1 Flux St');
  await fillField(scope, ADDRESS_LABELS.city, 'Berlin');
  await fillField(scope, ADDRESS_LABELS.region, 'BE');
  await fillField(scope, ADDRESS_LABELS.postalCode, '10115');
  await fillField(scope, ADDRESS_LABELS.countryCode, 'DE');
}

let backend: OrdersBackend;

function createBackend(): OrdersBackend {
  return { orderReads: [], listQueries: [], orderCalls: 0, statusQueue: [] };
}

test.beforeEach(async ({ page }) => {
  backend = createBackend();
});

test('Journey 1 — login leads to the account shell with the backend profile', async ({ page }) => {
  await page.route('**/auth/login', (route) =>
    route.fulfill({
      json: envelope({
        userId: USER_ID,
        email: 'ada@flux.local',
        roles: ['Customer'],
        accessToken: 'e2e-access-1',
        refreshToken: 'e2e-refresh-1',
        refreshTokenExpiresAtUtc: '2026-09-13T12:00:00Z',
      }),
    }),
  );
  await page.route('**/auth/me', (route) => route.fulfill({ json: envelope(userResponse()) }));
  await gotoStable(page, '/login');

  await fillField(page, 'Email', 'ada@flux.local');
  await fillField(page, 'Password', 'Valid123!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Authenticated shell exposes the account entry (Sub-Phase 10.2 seam).
  await page.getByRole('link', { name: 'Account', exact: true }).click();
  await expect(page).toHaveURL(/\/account\/profile$/);

  // Profile rows echo the backend `/auth/me` payload — display only.
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('Ada Lovelace').first()).toBeVisible();
  await expect(page.getByText('ada@flux.local').first()).toBeVisible();
});

test('Journey 1b — profile edits round-trip through PUT /auth/profile', async ({ page }) => {
  await mockSession(page);
  await page.route('**/auth/profile', (route) =>
    route.fulfill({
      json: envelope({ ...userResponse(), phoneNumber: '+49 170 000001' }),
    }),
  );
  await gotoStable(page, '/account/profile');

  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await expect(page.getByRole('heading', { name: 'Edit profile' })).toBeVisible();

  await fillField(page, 'Phone', '+49 170 000001');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('Your profile was updated.')).toBeVisible();
  await expect(page.getByText('+49 170 000001').first()).toBeVisible();
});

test('Journey 2 — orders list paginates through backend pages', async ({ page }) => {
  await mockSession(page);
  await mockOrdersApi(page, backend, {
    '1': {
      items: [summary(ORDER_A, 'ORD-E2E-000001', 'Confirmed')],
      totalCount: 21,
    },
    '2': {
      items: [summary(ORDER_B, 'ORD-E2E-000002', 'Pending')],
      totalCount: 21,
    },
  });
  await gotoStable(page, '/account/orders');

  // Page one renders backend summaries with localized status badges.
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ORD-E2E-000001' })).toHaveAttribute(
    'href',
    `/account/orders/${ORDER_A}`,
  );
  await expect(page.getByRole('article').getByText('Confirmed')).toBeVisible();

  // The pager commits page moves through state — the backend sees the
  // committed page number, and rows update to the new backend page.
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('link', { name: 'ORD-E2E-000002' })).toBeVisible();
  expect(backend.listQueries.map((query) => query['pageNumber'])).toContain('2');
  await expect(page.getByRole('link', { name: 'ORD-E2E-000001' })).toHaveCount(0);
});

test('Journey 3 — selecting an order shows backend order data', async ({ page }) => {
  await mockSession(page);
  await mockOrdersApi(page, backend, {
    '1': {
      items: [summary(ORDER_A, 'ORD-E2E-000001', 'Confirmed')],
      totalCount: 1,
    },
  });
  await gotoStable(page, '/account/orders');

  await page.getByRole('link', { name: 'ORD-E2E-000001' }).click();
  await expect(page).toHaveURL(`/account/orders/${ORDER_A}`);

  // Header facts, addresses, items, and totals echo the backend payload.
  await expect(page.getByRole('heading', { name: 'Order ORD-E2E-000001' })).toBeVisible();
  await expect(page.getByText('TEE-BLK-M')).toBeVisible();
  await expect(page.getByText('1 Flux St').first()).toBeVisible();
  await expect(page.getByText('$59.98').first()).toBeVisible();
  await expect(page.getByText('Confirmed')).toBeVisible();
  expect(backend.orderReads).toContain(ORDER_A);
});

test('Journey 4 — checkout creates the order and reaches the payment result hub', async ({
  page,
}) => {
  await mockSession(page);
  await page.route(
    (url) => url.origin === API_ORIGIN && url.pathname === '/cart',
    async (route) => {
      await route.fulfill({
        json: envelope({
          cartId: CART_ID,
          userId: USER_ID,
          version: 3,
          createdAtUtc: '2026-09-04T10:00:00Z',
          updatedAtUtc: '2026-09-04T10:05:00Z',
          items: [
            {
              productId: '22222222-2222-4222-8222-222222222222',
              variantId: 'aaaaaaaa-1111-4111-8111-111111111111',
              sku: 'TEE-BLK-M',
              productName: 'Tee',
              unitPriceAmount: 29.99,
              currency: 'USD',
              quantity: 2,
            },
          ],
          isGuest: false,
          isAuthenticated: true,
        }),
      });
    },
  );
  await page.route(
    (url) => url.origin === API_ORIGIN && url.pathname === '/orders/checkout',
    async (route) => {
      backend.orderCalls += 1;
      await route.fulfill({
        json: envelope({
          orderId: ORDER_A,
          orderNumber: 'ORD-E2E-000001',
          status: 'Pending',
          createdAtUtc: '2026-09-04T10:00:00Z',
        }),
      });
    },
  );
  await page.route(
    (url) => url.origin === API_ORIGIN && url.pathname.startsWith('/api/payments/'),
    async (route) => {
      const suffix = route.request().url().split('/api/payments/')[1] ?? '';
      if (suffix.startsWith('by-order/')) {
        await route.fulfill({
          json: envelope({
            paymentId: 'pay-e2e-1',
            orderId: ORDER_A,
            clientSecret: 'pi_e2e_secret_abc',
            paymentReference: 'pi_e2e_123',
            status: 'Pending',
          }),
        });
        return;
      }
      await route.fulfill({ status: 404, json: problem(404, 'Not Found', 'Missing.') });
    },
  );
  await page.route('https://js.stripe.com/**', (route) => route.abort());
  await mockOrdersApi(page, backend, {
    '1': { items: [summary(ORDER_A, 'ORD-E2E-000001', 'Pending')], totalCount: 1 },
  });

  await gotoStable(page, '/checkout');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await fillAddress(page, 'Shipping address');
  await fillAddress(page, 'Billing address');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('ORD-E2E-000001')).toBeVisible();
  expect(backend.orderCalls).toBe(1);

  // Payment initializes from the created order, provider setup fails
  // fast (CDN blocked), and the result hub keeps the order reference —
  // the same created order the account area will display.
  await page.getByRole('link', { name: 'Continue to payment' }).click();
  await expect(page).toHaveURL(new RegExp(`/payment/${ORDER_A}/result$`));
  await expect(page.getByText('ORD-E2E-000001')).toBeVisible();

  // No success is invented on the failure path: the order link renders
  // only on backend-verified success.
  await expect(page.getByRole('link', { name: 'View order' })).toHaveCount(0);
});

test('Journey 5 — bounded polling converges a processing order to terminal', async ({ page }) => {
  await mockSession(page);
  backend.statusQueue = ['Pending', 'Pending', 'Confirmed'];
  await mockOrdersApi(page, backend, {
    '1': { items: [summary(ORDER_A, 'ORD-E2E-000001', 'Pending')], totalCount: 1 },
  });
  await gotoStable(page, `/account/orders/${ORDER_A}`);

  // While non-terminal, the pending/processing indicator shows.
  await expect(page.getByText('Waiting for the final order status…')).toBeVisible();

  // Saga-lag ticks resolve to the backend terminal state (bounded by
  // the 30-tick budget — converges here after two pending reads).
  await expect(page.getByRole('heading', { name: 'Order ORD-E2E-000001' })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText('Confirmed')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Waiting for the final order status…')).toHaveCount(0);
  expect(backend.orderReads.length).toBeLessThanOrEqual(31);
});

/**
 * Provider-gated remainder (blocked: no live provider in E2E — the
 * Stripe CDN is aborted and the mocked secret backs no real intent).
 * Enable condition: a runnable provider seam in E2E (e.g. a stubbed
 * `STRIPE_JS_LOADER`) plus status mocks for the remainder, at which
 * point the skipped suite below drives success → View order →
 * `/account/orders/:orderId` with the backend terminal order.
 */
test.describe.skip('successful payment to order details (blocked: no live provider)', () => {
  test('success result links onward to the customer order', async ({ page }) => {
    await mockSession(page);

    // REMAINDER (runs once a provider seam is runnable in E2E):
    // 1. confirm into provider success (success block),
    // 2. expect the "View order" link with href `/account/orders/:orderId`,
    // 3. follow it and expect the order details page with backend facts.
  });
});
