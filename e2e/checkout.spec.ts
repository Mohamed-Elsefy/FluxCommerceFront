/**
 * Checkout E2E journeys for Sub-Phase 8.10 — Checkout E2E & Integration
 * Verification.
 *
 * Covers the primary customer journey plus the critical failure and
 * edge suites through the real storefront (routing, guards, pages,
 * components, session lifecycle, feature state):
 *
 * ```text
 * Authenticated Customer
 *         ↓
 * Cart (seeded backend truth, reviewed on the cart page)
 *         ↓
 * Navigate to Checkout (cart → checkout navigation boundary)
 *         ↓
 * Enter Customer Information + Shipping/Billing Addresses
 *         ↓
 * Review Order Summary (backend facts only)
 *         ↓
 * Submit → Create Order API → Order Created Result
 * ```
 *
 * Transport is mocked at the network boundary (`page.route`) with a
 * small STATEFUL orders backend (caller cart with OCC versioning plus
 * a programmable `POST /orders/checkout` verdict) and contract-exact
 * auth fixtures: no live backend runs in this environment. The
 * handlers stay isolated in `mockCheckoutApi` so the same journeys run
 * live by dropping them once seed data allows it.
 *
 * Backend-authoritative rule (pinned throughout): every price, count,
 * and total asserted below comes from a mock response — the suite
 * fails if the UI ever computes them (the primary journey asserts the
 * `59.98` product of `2 × 29.99` appears nowhere).
 *
 * Phase boundary pins (Definition of Done): after a created order the
 * page exposes no payment UI of any kind (no Stripe, card, or gateway
 * surface), and no client-side totals exist anywhere in the flow.
 */

import { expect, test, type Page, type Route } from '@playwright/test';

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

type OrderVerdict =
  | { kind: 'success' }
  | { kind: 'failure'; status: number; detail: string }
  | { kind: 'abort' }
  | { kind: 'unauthorizedOnce' }
  | { kind: 'delay'; ms: number };

/** Stateful mock backend: one caller cart plus a programmable checkout verdict. */
interface CheckoutBackend {
  authCart: MockCart;
  orderCalls: OrderCall[];
  orderVerdict: OrderVerdict;
  orderSeq: number;
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

function createBackend(): CheckoutBackend {
  return {
    authCart: cartWithLines([teeLine()]),
    orderCalls: [],
    orderVerdict: { kind: 'success' },
    orderSeq: 0,
  };
}

function envelope(data: unknown): Record<string, unknown> {
  return { isSuccess: true, message: 'Operation completed successfully.', data };
}

async function fulfillProblem(route: Route, status: number, detail: string): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/problem+json',
    body: JSON.stringify({
      type: 'about:blank',
      title: 'Error',
      status,
      detail,
      extensions: {},
    }),
  });
}

/** Installs the mocked storefront transport (auth session, caller cart, checkout) for one page. */
async function mockCheckoutApi(page: Page, backend: CheckoutBackend): Promise<void> {
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
    const verdict = backend.orderVerdict;
    const key = route.request().headers()['idempotency-key'] ?? null;
    if (verdict.kind === 'abort') {
      backend.orderVerdict = { kind: 'success' };
      await route.abort('failed');
      return;
    }
    if (verdict.kind === 'unauthorizedOnce') {
      backend.orderVerdict = { kind: 'success' };
      await fulfillProblem(route, 401, 'Authentication required.');
      return;
    }
    if (verdict.kind === 'delay') {
      backend.orderVerdict = { kind: 'success' };
      await new Promise((resolve) => setTimeout(resolve, verdict.ms));
    }
    if (verdict.kind === 'failure') {
      backend.orderCalls.push({ body: route.request().postDataJSON(), key });
      await fulfillProblem(route, verdict.status, verdict.detail);
      return;
    }
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

async function gotoCheckout(page: Page): Promise<void> {
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
}

let backend: CheckoutBackend;

test.beforeEach(async ({ page }) => {
  backend = createBackend();
  await mockCheckoutApi(page, backend);
});

test('completes the authenticated cart-to-order primary journey', async ({ page }) => {
  await mockSession(page);

  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
  await expect(page.getByText('TEE-BLK-M')).toBeVisible();
  await page.getByRole('link', { name: 'Proceed to checkout' }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  // Review renders backend facts only: the 59.98 product of 2 × 29.99
  // must appear nowhere (the contract exposes no lineTotal).
  await expect(page.getByText('Order summary')).toBeVisible();
  await expect(page.getByText('TEE-BLK-M')).toBeVisible();
  await expect(page.getByText('$29.99')).toBeVisible();
  await expect(page.locator('.checkout-page')).not.toContainText('59.98');
  await expect(page.getByText('Totals are finalized when your order is created.')).toBeVisible();

  await fillAddress(page, 'Shipping address');
  await page.getByLabel('Billing address is the same as shipping').check();
  await expect(page.locator('#billing-city')).toBeDisabled();

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('ORD-E2E-000001')).toBeVisible();
  await expect(page.getByText('Pending')).toBeVisible();

  // Exactly one Create Order call: snapshot cart id, verbatim addresses
  // (billing copied from shipping), key travelling as a header.
  expect(backend.orderCalls).toHaveLength(1);
  const call = backend.orderCalls[0];
  expect(call?.body['cartId']).toBe(CART_ID);
  expect(call?.body['shippingAddress']).toEqual({ ...ADDRESS, line2: null });
  expect(call?.body['billingAddress']).toEqual({ ...ADDRESS, line2: null });
  expect(typeof call?.key).toBe('string');
  expect((call?.key ?? '').length).toBeGreaterThan(0);

  // Phase boundary: no payment surface of any kind after order creation.
  await expect(page.locator('text=/stripe/i')).toHaveCount(0);
  await expect(page.locator('text=/card number/i')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('blocks empty-cart checkout with back-to-cart recovery and no order call', async ({
  page,
}) => {
  await mockSession(page);
  backend.authCart = cartWithLines([]);

  await gotoCheckout(page);
  await expect(page.getByText('Your cart is empty')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to cart' })).toHaveAttribute('href', '/cart');
  expect(backend.orderCalls).toHaveLength(0);
});

test('prevents invalid submits with flagged fields and no order call', async ({ page }) => {
  await mockSession(page);
  await gotoCheckout(page);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.locator('.checkout-field-errors').first()).toBeVisible();
  expect(backend.orderCalls).toHaveLength(0);
});

test('surfaces backend validation failures with the form preserved', async ({ page }) => {
  await mockSession(page);
  backend.orderVerdict = { kind: 'failure', status: 400, detail: 'Invalid address.' };
  await gotoCheckout(page);
  await fillAddress(page, 'Shipping address');
  await fillAddress(page, 'Billing address');

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Order creation failed')).toBeVisible();
  await expect(page.locator('#shipping-city')).toHaveValue('Berlin');
  expect(backend.orderCalls).toHaveLength(1);
});

test('mints a fresh key when resubmitting after a business rejection', async ({ page }) => {
  await mockSession(page);
  backend.orderVerdict = { kind: 'failure', status: 409, detail: 'Idempotency conflict.' };
  await gotoCheckout(page);
  await fillAddress(page, 'Shipping address');
  await fillAddress(page, 'Billing address');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Order creation failed')).toBeVisible();
  const rejectedKey = backend.orderCalls[0]?.key;

  backend.orderVerdict = { kind: 'success' };
  await page.getByRole('button', { name: 'Retry' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('ORD-E2E-000001')).toBeVisible();

  expect(backend.orderCalls).toHaveLength(2);
  expect(backend.orderCalls[1]?.key).not.toBe(rejectedKey);
});

test('retries transport failures with the same idempotency key', async ({ page }) => {
  await mockSession(page);
  backend.orderVerdict = { kind: 'abort' };
  await gotoCheckout(page);
  await fillAddress(page, 'Shipping address');
  await fillAddress(page, 'Billing address');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Order creation failed')).toBeVisible();
  expect(backend.orderCalls).toHaveLength(0);

  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('ORD-E2E-000001')).toBeVisible();

  // Replay-or-create-once: the retry reuses the failed attempt's key.
  expect(backend.orderCalls).toHaveLength(1);
  const key = backend.orderCalls[0]?.key;
  expect(typeof key).toBe('string');
  expect((key ?? '').length).toBeGreaterThan(0);
});

test('locks the submit action while a submission is in flight', async ({ page }) => {
  await mockSession(page);
  backend.orderVerdict = { kind: 'delay', ms: 1500 };
  await gotoCheckout(page);
  await fillAddress(page, 'Shipping address');
  await fillAddress(page, 'Billing address');

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await expect(page.getByText('ORD-E2E-000001')).toBeVisible();

  expect(backend.orderCalls).toHaveLength(1);
});

test('guides back to Cart when the cart is gone at submission', async ({ page }) => {
  await mockSession(page);
  backend.orderVerdict = { kind: 'failure', status: 404, detail: 'Cart not found.' };
  await gotoCheckout(page);
  await fillAddress(page, 'Shipping address');
  await fillAddress(page, 'Billing address');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Order creation failed')).toBeVisible();

  // Background re-validation finds nothing left to order: the stale
  // snapshot is abandoned and the empty shell guides back to Cart.
  backend.authCart = cartWithLines([]);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Your cart is empty')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to cart' })).toHaveAttribute('href', '/cart');
  expect(backend.orderCalls).toHaveLength(1);
});

test('tracks underlying cart modifications across a reload', async ({ page }) => {
  await mockSession(page);
  await gotoCheckout(page);
  await expect(page.getByText('TEE-BLK-M')).toBeVisible();

  backend.authCart.items.push({
    productId: PRODUCT_ID,
    variantId: 'bbbbbbbb-2222-4222-8222-222222222222',
    sku: 'TEE-WHT-M',
    productName: 'Tee',
    unitPriceAmount: 24.5,
    currency: 'USD',
    quantity: 1,
  });
  backend.authCart.version += 1;
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();

  await expect(page.getByText('TEE-WHT-M')).toBeVisible();
  await expect(page.getByText('$24.50')).toBeVisible();
  expect(backend.orderCalls).toHaveLength(0);
});

test('redirects unauthenticated checkout access to login with a return URL', async ({ page }) => {
  await page.goto('/checkout');

  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fcheckout$/);
  expect(backend.orderCalls).toHaveLength(0);
});

test('recovers expired sessions through refresh and completes the order', async ({ page }) => {
  await mockSession(page);
  backend.orderVerdict = { kind: 'unauthorizedOnce' };
  await gotoCheckout(page);
  await fillAddress(page, 'Shipping address');
  await fillAddress(page, 'Billing address');

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('ORD-E2E-000001')).toBeVisible();

  // The expired attempt was answered 401 and transparently retried
  // after refresh: exactly one order exists server-side.
  expect(backend.orderCalls).toHaveLength(1);
});

test('recovers a refresh with an intact summary and no phantom order', async ({ page }) => {
  await mockSession(page);
  await gotoCheckout(page);
  const shipping = page.locator('checkout-address-form', { hasText: 'Shipping address' });
  await fillField(shipping.getByLabel('City'), 'Berlin');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();

  // Route-scoped form state resets, but the live summary re-projects
  // from the re-established cart and no order was created.
  await expect(page.locator('#shipping-city')).toHaveValue('');
  await expect(page.getByText('TEE-BLK-M')).toBeVisible();
  expect(backend.orderCalls).toHaveLength(0);
});
