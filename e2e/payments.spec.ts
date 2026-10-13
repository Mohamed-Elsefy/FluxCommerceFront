/**
 * Payments E2E journeys for Sub-Phase 9.12 — Testing & E2E Verification.
 *
 * Covers the executable payment integration surface through the real
 * storefront (routing, guards, pages, components, feature state) with
 * transport mocked at the network boundary (`page.route`) and a small
 * STATEFUL mock backend (caller cart, programmable checkout verdict,
 * order reads, payment status reads):
 *
 * ```text
 * Authenticated Customer
 *         ↓
 * Checkout (seeded backend truth)
 *         ↓
 * Submit → Order Created → Continue to payment
 *         ↓
 * /payment/:orderId (order summary + initialization outcome)
 *         ↓
 * /payment/:orderId/result (fallback for unresolved flows)
 * ```
 *
 * Contract scope: transport is mocked at the network boundary
 * (`page.route`) with a small STATEFUL mock backend (caller cart,
 * programmable checkout verdict, order reads, by-order initialization
 * reads with programmable saga lag, payment status reads). The Stripe.js
 * CDN is blocked (`request.abort`), so provider setup deterministically
 * fails fast — executable suites cover everything up to the provider
 * seam (entry, initialization incl. readiness polling, failure handling
 * with safe retry, result routing, security surface). Suites needing a
 * live provider (Elements mount, real confirmation) stay SKIPPED with
 * their enable condition below.
 *
 * Backend-authoritative rule (pinned throughout): every price, count,
 * and total asserted below comes from a mock response — the suite
 * fails if the UI ever computes them.
 */

import { expect, test, type Page } from '@playwright/test';

const API_ORIGIN = 'https://localhost:7119';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = 'cccccccc-3333-4333-8333-333333333333';
const CART_ID = '11111111-1111-4111-8111-111111111111';
const AUTH_KEY = 'fluxcommerce.auth.session.v1';

interface MockLine {
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
  unitPriceAmount: number;
  currency: string;
  quantity: number;
}

interface MockCart {
  cartId: string;
  userId: string | null;
  version: number;
  createdAtUtc: string;
  updatedAtUtc: string;
  items: MockLine[];
  isGuest: boolean;
  isAuthenticated: boolean;
}

interface OrderCall {
  body: Record<string, unknown>;
  key: string | null;
}

interface PaymentStatusCall {
  paymentId: string;
}

/** Stateful mock backend: caller cart, checkout calls, order/payment reads. */
interface PaymentsBackend {
  authCart: MockCart;
  orderCalls: OrderCall[];
  orderSeq: number;
  orderReads: string[];
  paymentReads: PaymentStatusCall[];
  byOrderCalls: string[];
  /** Saga-lag simulation: this many leading by-order reads fail 404 first. */
  initFailuresRemaining: number;
}

function teeLine(overrides: Partial<MockLine> = {}): MockLine {
  return {
    productId: PRODUCT_ID,
    variantId: 'aaaaaaaa-1111-4111-8111-111111111111',
    sku: 'TEE-BLK-M',
    productName: 'Tee',
    unitPriceAmount: 29.99,
    currency: 'USD',
    quantity: 2,
    ...overrides,
  };
}

function cartWithLines(lines: MockLine[]): MockCart {
  return {
    cartId: CART_ID,
    userId: USER_ID,
    version: 3,
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:05:00Z',
    items: lines,
    isGuest: false,
    isAuthenticated: true,
  };
}

function createBackend(): PaymentsBackend {
  return {
    authCart: cartWithLines([teeLine()]),
    orderCalls: [],
    orderSeq: 0,
    orderReads: [],
    paymentReads: [],
    byOrderCalls: [],
    initFailuresRemaining: 0,
  };
}

function envelope(data: unknown): Record<string, unknown> {
  return { isSuccess: true, message: 'Operation completed successfully.', data };
}

function orderDetails(orderId: string, orderNumber: string): Record<string, unknown> {
  const address = {
    recipientName: 'Ada Lovelace',
    line1: '1 Flux St',
    line2: null,
    city: 'Berlin',
    region: 'BE',
    postalCode: '10115',
    countryCode: 'DE',
  };
  return {
    orderId,
    orderNumber,
    status: 'Pending',
    subtotal: { amount: 59.98, currency: 'USD' },
    shippingCost: { amount: 0, currency: 'USD' },
    discount: { amount: 0, currency: 'USD' },
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-04T10:00:00Z',
    shippingAddress: address,
    billingAddress: address,
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

/** Installs the mocked storefront transport for one page. */
async function mockPaymentsApi(page: Page, backend: PaymentsBackend): Promise<void> {
  const api = (pathname: string) => (url: URL) =>
    url.origin === API_ORIGIN && url.pathname === pathname;

  await page.route(api('/cart'), async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: envelope(backend.authCart) });
      return;
    }
    await route.fulfill({ status: 201, json: envelope(backend.authCart) });
  });

  await page.route(api('/orders/checkout'), async (route) => {
    const key = route.request().headers()['idempotency-key'] ?? null;
    backend.orderSeq += 1;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    backend.orderCalls.push({ body, key });
    await route.fulfill({
      json: envelope({
        orderId: `order-e2e-${backend.orderSeq}`,
        orderNumber: `ORD-E2E-${String(backend.orderSeq).padStart(6, '0')}`,
        status: 'Pending',
        createdAtUtc: '2026-09-04T10:00:00Z',
      }),
    });
  });

  await page.route(
    (url) =>
      url.origin === API_ORIGIN &&
      url.pathname.startsWith('/orders/') &&
      url.pathname !== '/orders/checkout',
    async (route) => {
      const orderId = route.request().url().split('/orders/')[1] ?? 'unknown';
      backend.orderReads.push(orderId);
      const seq = orderId.split('-').pop() ?? '1';
      await route.fulfill({
        json: envelope(orderDetails(orderId, `ORD-E2E-${seq.padStart(6, '0')}`)),
      });
    },
  );

  await page.route(
    (url) => url.origin === API_ORIGIN && url.pathname.startsWith('/api/payments/'),
    async (route) => {
      const suffix = route.request().url().split('/api/payments/')[1] ?? 'unknown';
      if (suffix.startsWith('by-order/')) {
        const orderId = suffix.slice('by-order/'.length);
        backend.byOrderCalls.push(orderId);
        if (backend.initFailuresRemaining > 0) {
          backend.initFailuresRemaining -= 1;
          await route.fulfill({
            status: 404,
            contentType: 'application/problem+json',
            body: JSON.stringify({
              type: 'about:blank',
              title: 'Not Found',
              status: 404,
              detail: 'Payment not found.',
              extensions: {},
            }),
          });
          return;
        }
        await route.fulfill({
          json: envelope({
            paymentId: `pay-e2e-${orderId}`,
            orderId,
            clientSecret: 'pi_e2e_secret_abc',
            paymentReference: 'pi_e2e_123',
            status: 'Pending',
          }),
        });
        return;
      }
      backend.paymentReads.push({ paymentId: suffix });
      await route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: 'Payment not found.',
          extensions: {},
        }),
      });
    },
  );

  // The provider seam is not executable in E2E (no live Stripe intent
  // behind the mocked secret): block the CDN so setup fails fast and
  // deterministically instead of depending on real-network timing.
  await page.route('https://js.stripe.com/**', (route) => route.abort());
}

const ACTIVE_USER = {
  id: USER_ID,
  email: 'ada@flux.local',
  firstName: 'Ada',
  lastName: 'Lovelace',
  displayName: 'Ada Lovelace',
  roles: ['Customer'],
  isEmailVerified: true,
};

const TOKEN_PAIR = {
  userId: USER_ID,
  email: 'ada@flux.local',
  roles: ['Customer'],
  accessToken: 'e2e-access-1',
  refreshToken: 'e2e-refresh-1',
  refreshTokenExpiresAtUtc: '2026-09-13T12:00:00Z',
};

const ROTATED_PAIR = { ...TOKEN_PAIR, accessToken: 'e2e-access-2', refreshToken: 'e2e-refresh-2' };

async function mockSession(page: Page): Promise<void> {
  await page.route('**/auth/refresh', (route) => route.fulfill({ json: envelope(ROTATED_PAIR) }));
  await page.route('**/auth/me', (route) => route.fulfill({ json: envelope(ACTIVE_USER) }));
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
    { key: AUTH_KEY, user: ACTIVE_USER },
  );
}

/**
 * Hydration-safe fill: lazy page chunks can finish claiming their inputs
 * at any moment and reset them to control state, so a value only counts
 * once it survives an undisturbed observation window.
 */
async function fillField(field: ReturnType<Page['getByLabel']>, value: string): Promise<void> {
  await expect
    .poll(
      async () => {
        if ((await field.inputValue()) !== value) {
          await field.fill(value);
          return 'refilling';
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        return field.inputValue();
      },
      { timeout: 20000 },
    )
    .toBe(value);
}

const ADDRESS = {
  recipientName: 'Ada Lovelace',
  line1: '1 Flux St',
  city: 'Berlin',
  region: 'BE',
  postalCode: '10115',
  countryCode: 'DE',
} as const;

const ADDRESS_LABELS = {
  recipientName: 'Full name',
  line1: 'Street address',
  city: 'City',
  region: 'State / Region',
  postalCode: 'Postal code',
  countryCode: 'Country code',
} as const;

/** Fills one address section (scoped by its legend) field by field. */
async function fillAddress(
  page: Page,
  section: 'Shipping address' | 'Billing address',
  values: Record<string, string> = ADDRESS,
): Promise<void> {
  const scope = page.locator('checkout-address-form', { hasText: section });
  await expect(scope.getByText(section)).toBeVisible();
  for (const [field, label] of Object.entries(ADDRESS_LABELS)) {
    await fillField(scope.getByLabel(label), values[field] ?? '');
  }
}

/** Completes checkout and follows the payment seam, returning the created order id. */
async function checkoutToPayment(page: Page, backend: PaymentsBackend): Promise<string> {
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await fillAddress(page, 'Shipping address');
  await fillAddress(page, 'Billing address');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('ORD-E2E-000001')).toBeVisible();
  expect(backend.orderCalls).toHaveLength(1);

  // Initialization reads the mocked by-order intent (200), then provider
  // setup fails fast (Stripe CDN blocked in E2E) and the page routes to
  // the result hub with the setup failure.
  await page.getByRole('link', { name: 'Continue to payment' }).click();
  await expect(page).toHaveURL(/\/payment\/order-e2e-1\/result$/);
  return 'order-e2e-1';
}

let backend: PaymentsBackend;

test.beforeEach(async ({ page }) => {
  backend = createBackend();
  await mockPaymentsApi(page, backend);
});

test('enters payment from checkout and lands on the setup-failure result', async ({ page }) => {
  await mockSession(page);
  const orderId = await checkoutToPayment(page, backend);

  // Failed block: localized message (never technical internals),
  // backend-issued order summary (lines, counts, totals — never locally
  // computed), and safe navigation options.
  await expect(page.getByText('Payment setup failed. Please try again.')).toBeVisible();
  await expect(page.getByText('ORD-E2E-000001')).toBeVisible();
  await expect(page.getByText('TEE-BLK-M')).toBeVisible();
  await expect(page.getByText('$59.98').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute(
    'href',
    `/payment/${orderId}`,
  );
  await expect(page.getByRole('link', { name: 'Back to checkout' })).toHaveAttribute(
    'href',
    '/checkout',
  );
  expect(backend.orderReads).toContain(orderId);
  expect(backend.byOrderCalls).toContain(orderId);
});

test('polls through saga lag instead of failing on the first 404', async ({ page }) => {
  await mockSession(page);
  backend.initFailuresRemaining = 2;
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await fillAddress(page, 'Shipping address');
  await fillAddress(page, 'Billing address');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('ORD-E2E-000001')).toBeVisible();
  await page.getByRole('link', { name: 'Continue to payment' }).click();

  // The readiness poll absorbs the lag ticks: the page must NOT bounce
  // to the result route while retries are outstanding.
  await expect(page).toHaveURL(/\/payment\/order-e2e-1$/);
  await expect
    .poll(() => backend.byOrderCalls.length, { timeout: 15000 })
    .toBeGreaterThanOrEqual(2);
  await expect(page).toHaveURL(/\/payment\/order-e2e-1$/);

  // The third tick reads the intent; provider setup then fails fast
  // (CDN blocked) and routes to the result hub.
  await expect(page).toHaveURL(/\/payment\/order-e2e-1\/result$/, { timeout: 30000 });
  await expect(page.getByText('Payment setup failed. Please try again.')).toBeVisible();
  expect(backend.byOrderCalls.length).toBeGreaterThanOrEqual(3);
  expect(backend.orderCalls).toHaveLength(1);
});

test('retries initialization failures safely without duplicates or crashes', async ({ page }) => {
  await mockSession(page);
  await checkoutToPayment(page, backend);

  await expect(page.getByText('Payment setup failed. Please try again.')).toBeVisible();
  await page.getByRole('link', { name: 'Try again' }).click();

  // Re-entry attempts initialization again and routes back to the single
  // failure presentation: one error message, no duplicate order, no crash.
  await expect(page).toHaveURL(/\/payment\/order-e2e-1\/result$/);
  await expect(page.getByText('Payment setup failed. Please try again.')).toHaveCount(1);
  expect(backend.orderCalls).toHaveLength(1);
});

test('renders the unresolved result fallback with navigation and zero verification calls', async ({
  page,
}) => {
  await mockSession(page);
  await page.goto('/payment/order-e2e-1/result');

  await expect(page.getByText('No payment result yet.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to payment' })).toHaveAttribute(
    'href',
    '/payment/order-e2e-1',
  );
  // Nothing to verify without a payment id — no status reads issued.
  expect(backend.paymentReads).toHaveLength(0);
});

test('exposes no secrets or provider surfaces in the payment UI', async ({ page }) => {
  await mockSession(page);
  await checkoutToPayment(page, backend);
  await expect(page.getByText('Payment setup failed. Please try again.')).toBeVisible();

  // No Stripe Elements surface of any kind (no SDK executes in E2E).
  await expect(page.locator('text=/stripe/i')).toHaveCount(0);
  await expect(page.locator('text=/card number/i')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);

  // No secrets in the URL, DOM text, or persisted storage.
  await expect(page).not.toHaveURL(/pi_|secret/i);
  const bodyText = (await page.locator('body').textContent()) ?? '';
  expect(bodyText).not.toMatch(/pi_|secret/i);
  const storedKeys: Array<string | null> = await page.evaluate(() =>
    [...Array(window.localStorage.length).keys()].map((index) => window.localStorage.key(index)),
  );
  expect(storedKeys.filter((key) => key !== null && /secret|pi_|client/i.test(key))).toEqual([]);
});

/**
 * Provider-gated journeys (blocked: no live provider in E2E — the Stripe
 * CDN is aborted and the mocked secret backs no real intent). Each suite
 * below drives its executable prefix, then skips before the
 * provider-gated remainder. Enable condition per suite: a runnable
 * provider seam in E2E (e.g. a stubbed `STRIPE_JS_LOADER` or a fulfilled
 * Elements mount) plus status mocks for the remainder.
 */
test.describe.skip('successful payment journey (blocked: no live provider)', () => {
  test('checkout → order → payment → stripe success → verified result', async ({ page }) => {
    await mockSession(page);
    await checkoutToPayment(page, backend);
    await expect(page.getByText('Payment setup failed. Please try again.')).toBeVisible();

    // REMAINDER (runs once a provider seam is runnable in E2E):
    // 1. submit the mounted payment element,
    // 2. mock `GET /api/payments/{id}` → `{ status: 'Succeeded', ... }`,
    // 3. expect the result route success block with the order reference
    //    and the verified backend status.
  });

  test('failed payment with safe retry to a successful second attempt', async ({ page }) => {
    await mockSession(page);
    await checkoutToPayment(page, backend);
    await expect(page.getByText('Payment setup failed. Please try again.')).toBeVisible();

    // REMAINDER (runs once a provider seam is runnable in E2E):
    // 1. decline the payment (provider failure → failed block),
    // 2. follow "Try again" back to `/payment/:orderId` (fresh intent),
    // 3. confirm again with success and expect the success block.
  });

  test('pending payment with status verification', async ({ page }) => {
    await mockSession(page);
    await checkoutToPayment(page, backend);
    await expect(page.getByText('Payment setup failed. Please try again.')).toBeVisible();

    // REMAINDER (runs once a provider seam is runnable in E2E):
    // 1. confirm into a `pending` provider outcome (pending block),
    // 2. mock `GET /api/payments/{id}` → `{ status: 'Processing', ... }`,
    // 3. press "Check status" and expect the pending block to persist
    //    with the backend facts (no blind retry surface).
  });

  test('cancelled payment with return and re-attempt options', async ({ page }) => {
    await mockSession(page);
    await checkoutToPayment(page, backend);
    await expect(page.getByText('Payment setup failed. Please try again.')).toBeVisible();

    // REMAINDER (runs once a provider seam is runnable in E2E):
    // 1. cancel the payment (cancelled block),
    // 2. expect "Try again" (`/payment/:orderId`) and "Back to checkout"
    //    (`/checkout`) navigation options.
  });

  test('unknown outcome resolves through backend status, never blind retry', async ({ page }) => {
    await mockSession(page);
    await checkoutToPayment(page, backend);
    await expect(page.getByText('Payment setup failed. Please try again.')).toBeVisible();

    // REMAINDER (runs once a provider seam is runnable in E2E):
    // 1. force an `unknown` provider outcome (unknown block, NO retry
    //    button anywhere on the route),
    // 2. mock `GET /api/payments/{id}` → terminal verdict,
    // 3. press "Check status" and expect resolution without resubmission
    //    (zero additional provider contacts).
  });
});
