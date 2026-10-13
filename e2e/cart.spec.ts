/**
 * Cart E2E journeys for Sub-Phase 7.9 — Testing & Phase Verification.
 *
 * Covers the mandatory critical journey plus edge suites through the
 * real storefront (routing, pages, components, session lifecycle):
 *
 * ```text
 * Home → Catalog → Product → Select Variant → backend price →
 * Add to Cart → Open Cart → Login → Cart Merge → Authenticated Cart
 * ```
 *
 * Transport is mocked at the network boundary (`page.route`) with a
 * small STATEFUL cart backend (guest carts keyed by id, one caller
 * cart, Lua-style merge consolidation of duplicate variants) plus
 * contract-exact catalog and auth fixtures: no live backend runs in
 * this environment. The handlers stay isolated in `mockStorefrontApi`
 * so the same journeys run live by dropping them once seed data allows
 * it.
 *
 * Backend-authoritative rule (pinned throughout): every total,
 * quantity consolidation, and merge result asserted below comes from a
 * mock response — the suite fails if the UI ever computes them (the
 * duplicate-variant merge test asserts the consolidated quantity
 * verbatim).
 */

import { expect, test, type Page, type Route } from '@playwright/test';

const API_ORIGIN = 'https://localhost:7119';
const APPAREL_ID = '22222222-2222-2222-2222-222222222222';
const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';
const ACTIVE_VARIANT_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const INACTIVE_VARIANT_ID = 'bbbbbbbb-2222-4222-8222-222222222222';
const USER_ID = 'cccccccc-3333-4333-8333-333333333333';
const GUEST_KEY = 'fluxcommerce.cart.guest-cart-id.v1';
const AUTH_KEY = 'fluxcommerce.auth.session.v1';
const CULTURE_KEY = 'fluxcommerce.culture.v1';

const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

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

/** Stateful mock backend: guest carts by id, one caller cart, merge log. */
interface CartBackend {
  guests: Map<string, MockCart>;
  authCart: MockCart | null;
  guestSeq: number;
  mergeCalls: unknown[];
  mergeBehavior: 'success' | 'failOnce' | 'fail';
  calls: string[];
}

function createBackend(): CartBackend {
  return {
    guests: new Map(),
    authCart: null,
    guestSeq: 0,
    mergeCalls: [],
    mergeBehavior: 'success',
    calls: [],
  };
}

const VARIANT_CATALOG: Record<string, { sku: string; name: string }> = {
  [ACTIVE_VARIANT_ID]: { sku: 'TEE-RED-M', name: 'Red / M' },
  [INACTIVE_VARIANT_ID]: { sku: 'TEE-BLUE-M', name: 'Blue / M' },
};

function envelope(data: unknown): Record<string, unknown> {
  return { isSuccess: true, message: 'Operation completed successfully.', data };
}

function problem(
  status: number,
  detail: string,
  code?: string,
): { body: string; contentType: string } {
  return {
    contentType: 'application/problem+json',
    body: JSON.stringify({
      type: 'about:blank',
      title: status === 404 ? 'Not Found' : 'Error',
      status,
      detail,
      extensions: code === undefined ? {} : { code },
    }),
  };
}

async function fulfill(route: Route, data: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', json: envelope(data) });
}

async function fulfillProblem(
  route: Route,
  status: number,
  detail: string,
  code?: string,
): Promise<void> {
  const failure = problem(status, detail, code);
  await route.fulfill({
    status,
    contentType: failure.contentType,
    body: failure.body,
  });
}

function freshGuestCart(backend: CartBackend): MockCart {
  backend.guestSeq += 1;
  return {
    cartId: `guest-cart-${backend.guestSeq}`,
    userId: null,
    version: 1,
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:00:00Z',
    items: [],
    isGuest: true,
    isAuthenticated: false,
  };
}

function freshAuthCart(): MockCart {
  return {
    cartId: 'auth-cart-1',
    userId: USER_ID,
    version: 1,
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:00:00Z',
    items: [],
    isGuest: false,
    isAuthenticated: true,
  };
}

function upsertLine(cart: MockCart, body: Record<string, unknown>): void {
  const variantId = body['variantId'] as string;
  const existing = cart.items.find((line) => line.variantId === variantId);
  if (existing !== undefined) {
    existing.quantity += body['quantity'] as number;
  } else {
    const meta = VARIANT_CATALOG[variantId] ?? { sku: 'UNKNOWN', name: 'Unknown' };
    cart.items.push({
      productId: PRODUCT_ID,
      variantId,
      sku: meta.sku,
      productName: 'Tee',
      unitPriceAmount: body['unitPriceAmount'] as number,
      currency: body['currency'] as string,
      quantity: body['quantity'] as number,
    });
  }
  cart.version += 1;
}

/** Installs the mocked storefront transport (catalog, product, cart) for one journey page. */
async function mockStorefrontApi(page: Page, backend: CartBackend): Promise<void> {
  const api = (pathname: string) => (url: URL) =>
    url.origin === API_ORIGIN && url.pathname === pathname;
  const log = (route: Route): string => {
    const entry = `${route.request().method()} ${new URL(route.request().url()).pathname}`;
    backend.calls.push(entry);
    return entry;
  };

  await page.route(api('/catalog/categories'), (route) =>
    route.fulfill({
      json: envelope({
        items: [
          {
            id: APPAREL_ID,
            name: 'Apparel',
            slug: 'apparel',
            description: null,
            parentId: null,
            status: 0,
            isDeleted: false,
            createdAtUtc: '2026-09-04T10:00:00Z',
            deletedAtUtc: null,
          },
        ],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 100,
      }),
    }),
  );
  await page.route(api('/catalog'), (route) =>
    route.fulfill({
      json: envelope({
        items: [
          {
            id: PRODUCT_ID,
            name: 'Tee',
            slug: 'tee',
            description: null,
            categoryId: APPAREL_ID,
            primaryImage: null,
          },
        ],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 20,
      }),
    }),
  );
  await page.route(api(`/catalog/products/${PRODUCT_ID}`), (route) =>
    route.fulfill({
      json: envelope({
        id: PRODUCT_ID,
        name: 'Tee',
        slug: 'tee',
        description: 'A comfortable cotton tee.',
        seo: null,
        status: 1,
        visibility: 0,
        categoryId: APPAREL_ID,
        isDeleted: false,
        createdAtUtc: '2026-09-04T10:00:00Z',
        deletedAtUtc: null,
      }),
    }),
  );
  await page.route(api(`/catalog/products/${PRODUCT_ID}/specifications`), (route) =>
    route.fulfill({ json: envelope([]) }),
  );
  await page.route(api(`/catalog/products/${PRODUCT_ID}/images`), (route) =>
    route.fulfill({ json: envelope([]) }),
  );
  await page.route(api(`/catalog/products/${PRODUCT_ID}/variants`), (route) =>
    route.fulfill({
      json: envelope([
        {
          id: ACTIVE_VARIANT_ID,
          productId: PRODUCT_ID,
          sku: 'TEE-RED-M',
          name: 'Red / M',
          unitPriceAmount: 29.99,
          currency: 'USD',
          status: 0,
          isDeleted: false,
          createdAtUtc: '2026-09-04T10:00:00Z',
          deletedAtUtc: null,
        },
        {
          id: INACTIVE_VARIANT_ID,
          productId: PRODUCT_ID,
          sku: 'TEE-BLUE-M',
          name: 'Blue / M',
          unitPriceAmount: 14.5,
          currency: 'USD',
          status: 1,
          isDeleted: false,
          createdAtUtc: '2026-09-04T10:00:00Z',
          deletedAtUtc: null,
        },
      ]),
    }),
  );
  await page.route(
    (url) => url.pathname.startsWith('/images/'),
    (route: Route) => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL_PNG }),
  );

  await page.route(api('/cart/guest'), async (route) => {
    log(route);
    const cart = freshGuestCart(backend);
    backend.guests.set(cart.cartId, cart);
    await route.fulfill({ status: 201, contentType: 'application/json', json: envelope(cart) });
  });
  await page.route(
    (url) =>
      url.origin === API_ORIGIN &&
      url.pathname.startsWith('/cart/guest/') &&
      url.pathname.split('/').filter(Boolean).length === 3,
    async (route) => {
      const entry = log(route);
      const cartId = new URL(route.request().url()).pathname.split('/').filter(Boolean)[2] ?? '';
      const cart = backend.guests.get(cartId);
      if (route.request().method() === 'GET') {
        if (cart === undefined) {
          await fulfillProblem(route, 404, 'Cart not found.', 'Cart.CartNotFound');
        } else {
          await fulfill(route, cart);
        }
        return;
      }
      if (route.request().method() === 'DELETE') {
        if (cart === undefined) {
          await fulfillProblem(route, 404, 'Cart not found.', 'Cart.CartNotFound');
        } else {
          cart.items = [];
          cart.version += 1;
          await fulfill(route, cart);
        }
        return;
      }
      throw new Error(`Unexpected guest cart call: ${entry}`);
    },
  );
  await page.route(
    (url) =>
      url.origin === API_ORIGIN &&
      url.pathname.startsWith('/cart/guest/') &&
      url.pathname.endsWith('/items') &&
      url.pathname.split('/').filter(Boolean).length === 4,
    async (route) => {
      log(route);
      const cartId = new URL(route.request().url()).pathname.split('/').filter(Boolean)[2] ?? '';
      const cart = backend.guests.get(cartId);
      if (cart === undefined) {
        await fulfillProblem(route, 404, 'Cart not found.', 'Cart.CartNotFound');
        return;
      }
      upsertLine(cart, route.request().postDataJSON() as Record<string, unknown>);
      await fulfill(route, cart);
    },
  );
  await page.route(
    (url) =>
      url.origin === API_ORIGIN &&
      url.pathname.startsWith('/cart/guest/') &&
      url.pathname.split('/').filter(Boolean).length === 5,
    async (route) => {
      const entry = log(route);
      const segments = new URL(route.request().url()).pathname.split('/').filter(Boolean);
      const cart = backend.guests.get(segments[2] ?? '');
      const line = cart?.items.find((item) => item.variantId === segments[4]);
      if (cart === undefined) {
        await fulfillProblem(route, 404, 'Cart not found.', 'Cart.CartNotFound');
        return;
      }
      if (line === undefined) {
        await fulfillProblem(route, 404, 'Cart item not found.', 'Cart.CartItemNotFound');
        return;
      }
      if (route.request().method() === 'PUT') {
        line.quantity = (route.request().postDataJSON() as Record<string, unknown>)[
          'quantity'
        ] as number;
        cart.version += 1;
        await fulfill(route, cart);
        return;
      }
      if (route.request().method() === 'DELETE') {
        cart.items = cart.items.filter((item) => item.variantId !== segments[4]);
        cart.version += 1;
        await fulfill(route, cart);
        return;
      }
      throw new Error(`Unexpected guest line call: ${entry}`);
    },
  );

  await page.route(api('/cart'), async (route) => {
    log(route);
    if (route.request().method() === 'POST') {
      backend.authCart ??= freshAuthCart();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        json: envelope(backend.authCart),
      });
      return;
    }
    if (route.request().method() === 'GET') {
      if (backend.authCart === null) {
        await fulfillProblem(route, 404, 'Cart not found.', 'Cart.CartNotFound');
      } else {
        await fulfill(route, backend.authCart);
      }
      return;
    }
    if (route.request().method() === 'DELETE') {
      if (backend.authCart === null) {
        await fulfillProblem(route, 404, 'Cart not found.', 'Cart.CartNotFound');
      } else {
        backend.authCart.items = [];
        backend.authCart.version += 1;
        await fulfill(route, backend.authCart);
      }
      return;
    }
    throw new Error(`Unexpected caller cart call: ${route.request().method()}`);
  });
  await page.route(api('/cart/items'), async (route) => {
    log(route);
    if (backend.authCart === null) {
      await fulfillProblem(route, 404, 'Cart not found.', 'Cart.CartNotFound');
      return;
    }
    upsertLine(backend.authCart, route.request().postDataJSON() as Record<string, unknown>);
    await fulfill(route, backend.authCart);
  });
  await page.route(
    (url) =>
      url.origin === API_ORIGIN &&
      url.pathname.startsWith('/cart/items/') &&
      url.pathname.split('/').filter(Boolean).length === 3,
    async (route) => {
      const entry = log(route);
      const variantId = new URL(route.request().url()).pathname.split('/').filter(Boolean)[2];
      const line = backend.authCart?.items.find((item) => item.variantId === variantId);
      if (backend.authCart === null || line === undefined) {
        await fulfillProblem(route, 404, 'Cart item not found.', 'Cart.CartItemNotFound');
        return;
      }
      if (route.request().method() === 'PUT') {
        line.quantity = (route.request().postDataJSON() as Record<string, unknown>)[
          'quantity'
        ] as number;
        backend.authCart.version += 1;
        await fulfill(route, backend.authCart);
        return;
      }
      if (route.request().method() === 'DELETE') {
        backend.authCart.items = backend.authCart.items.filter(
          (item) => item.variantId !== variantId,
        );
        backend.authCart.version += 1;
        await fulfill(route, backend.authCart);
        return;
      }
      throw new Error(`Unexpected caller line call: ${entry}`);
    },
  );
  await page.route(api('/cart/merge'), async (route) => {
    log(route);
    const body = route.request().postDataJSON() as Record<string, unknown>;
    backend.mergeCalls.push(body);
    if (backend.mergeBehavior === 'fail' || backend.mergeBehavior === 'failOnce') {
      if (backend.mergeBehavior === 'failOnce') {
        backend.mergeBehavior = 'success';
      }
      await fulfillProblem(route, 500, 'Server error.');
      return;
    }
    const guest = backend.guests.get(body['guestCartId'] as string);
    if (guest === undefined) {
      await fulfillProblem(route, 404, 'Cart not found.', 'Cart.CartNotFound');
      return;
    }
    backend.authCart ??= freshAuthCart();
    for (const line of guest.items) {
      const existing = backend.authCart.items.find((item) => item.variantId === line.variantId);
      if (existing !== undefined) {
        existing.quantity += line.quantity;
      } else {
        backend.authCart.items.push({ ...line });
      }
    }
    backend.authCart.version += 1;
    backend.guests.delete(guest.cartId);
    await fulfill(route, backend.authCart);
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

async function mockLogin(page: Page): Promise<void> {
  await page.route('**/auth/login', (route) => fulfill(route, TOKEN_PAIR));
  await page.route('**/auth/me', (route) => fulfill(route, ACTIVE_USER));
}

async function mockRefresh(page: Page): Promise<void> {
  await page.route('**/auth/refresh', (route) => fulfill(route, ROTATED_PAIR));
  await page.route('**/auth/me', (route) => fulfill(route, ACTIVE_USER));
}

/**
 * Hydration-safe fill: lazy page chunks can finish claiming their inputs
 * at any moment and reset them to control state, so a value only counts
 * once it survives an undisturbed observation window.
 */
async function fillField(page: Page, label: string, value: string, exact = false): Promise<void> {
  const field = page.getByLabel(label, { exact });
  await expect
    .poll(
      async () => {
        if ((await field.inputValue()) !== value) {
          await field.fill(value);
          return 'refilling';
        }
        await page.waitForTimeout(750);
        return field.inputValue();
      },
      { timeout: 20000 },
    )
    .toBe(value);
}

async function gotoCart(page: Page): Promise<void> {
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
}

async function guestIdOf(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), GUEST_KEY);
}

async function addRedTeeAsGuest(page: Page, quantity = 1): Promise<void> {
  await page.goto(`/catalog/products/${PRODUCT_ID}`);
  await expect(page.getByRole('heading', { name: 'Tee' })).toBeVisible();
  await page.getByRole('button', { name: 'Red / M' }).click();
  await expect(page.getByText('TEE-RED-M', { exact: true })).toBeVisible();
  for (let step = 1; step < quantity; step += 1) {
    await page.getByRole('button', { name: 'Increase quantity' }).click();
  }
  const add = page.getByRole('button', { name: 'Add to cart' });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByText('Added to cart.')).toBeVisible();
}

async function signIn(page: Page, returnUrl?: string): Promise<void> {
  await page.goto(returnUrl === undefined ? '/login' : `/login?returnUrl=${returnUrl}`);
  await expect(page.getByRole('link', { name: 'Login' }).first()).toBeVisible();
  await fillField(page, 'Email', 'ada@flux.local');
  await fillField(page, 'Password', 'Valid123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait for the authenticated shell BEFORE navigating anywhere: leaving
  // earlier aborts the login round-trip and strands the session.
  if (returnUrl === undefined) {
    await expect(page).toHaveURL(/\/$/);
  } else {
    await expect(page).toHaveURL(new RegExp(`${returnUrl}$`));
  }
  await expect(page.getByText('Ada Lovelace')).toBeVisible();
}

let backend: CartBackend;

test.beforeEach(async ({ page }) => {
  backend = createBackend();
  await mockStorefrontApi(page, backend);
});

test('completes the Guest → Login → Cart Merge → Authenticated Cart journey', async ({ page }) => {
  await mockLogin(page);
  await mockRefresh(page);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Discover products' })).toBeVisible();
  await page.getByRole('link', { name: 'Browse categories' }).click();

  await expect(page).toHaveURL(/\/catalog$/);
  await page.getByRole('link', { name: 'Apparel' }).click();

  const cardLink = page.locator('catalog-product-card a').first();
  await expect(cardLink).toHaveAttribute('href', `/catalog/products/${PRODUCT_ID}`);
  await cardLink.click();

  await addRedTeeAsGuest(page);

  await page.goto('/');
  await page.getByRole('link', { name: 'View your cart' }).click();
  await gotoCart(page);
  await expect(page.locator('.cart-items-line')).toHaveCount(1);
  await expect(page.getByText('TEE-RED-M', { exact: true })).toBeVisible();
  // Navigation boundary only — the suite never enters checkout.
  await expect(page.getByRole('link', { name: 'Proceed to checkout' })).toHaveAttribute(
    'href',
    '/checkout',
  );
  const guestId = await guestIdOf(page);
  expect(guestId).not.toBeNull();

  await page.getByRole('link', { name: 'Login' }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await fillField(page, 'Email', 'ada@flux.local');
  await fillField(page, 'Password', 'Valid123!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Ada Lovelace')).toBeVisible();

  await page.getByRole('link', { name: 'View your cart' }).click();
  await gotoCart(page);
  await expect(page.locator('.cart-items-line')).toHaveCount(1);
  await expect(page.getByText('TEE-RED-M', { exact: true })).toBeVisible();

  // Exactly one merge posted the stored guest identity; the bookmark died with it.
  // (The merge may fire at the login transition or on this mount — either
  // path converges here, and the count below pins no-duplicate-state.)
  expect(backend.mergeCalls).toHaveLength(1);
  expect(backend.mergeCalls).toEqual([{ guestCartId: guestId }]);
  expect(await guestIdOf(page)).toBeNull();

  // A repeated visit never re-merges and keeps backend state.
  await page.reload();
  await gotoCart(page);
  await expect(page.locator('.cart-items-line')).toHaveCount(1);
  expect(backend.mergeCalls).toHaveLength(1);
});

test('supports guest add, quantity update, and remove', async ({ page }) => {
  await addRedTeeAsGuest(page, 1);
  await gotoCart(page);
  await expect(page.locator('.cart-items-line')).toHaveCount(1);

  const quantity = page.getByRole('textbox', { name: 'Quantity' });
  await expect(quantity).toHaveValue('1');
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(quantity).toHaveValue('2');

  await page.getByRole('button', { name: 'Remove Tee' }).click();
  await expect(page.locator('.cart-items-line')).toHaveCount(0);
  await expect(page.getByText('Your cart is empty')).toBeVisible();
});

test('clears the guest cart into the empty state', async ({ page }) => {
  await addRedTeeAsGuest(page);
  await gotoCart(page);
  await expect(page.locator('.cart-items-line')).toHaveCount(1);

  await page.getByRole('button', { name: 'Clear cart' }).click();
  await expect(page.locator('.cart-items-line')).toHaveCount(0);
  await expect(page.getByText('Your cart is empty')).toBeVisible();

  await page.getByRole('link', { name: 'Browse the catalog' }).click();
  await expect(page).toHaveURL(/\/catalog$/);
});

test('supports authenticated add, update, remove, and clear', async ({ page }) => {
  await mockRefresh(page);
  await page.addInitScript(
    ({ key, session }) => window.localStorage.setItem(key, JSON.stringify(session)),
    {
      key: AUTH_KEY,
      session: {
        refreshToken: 'e2e-refresh-1',
        user: { ...ACTIVE_USER, displayName: null },
        authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
      },
    },
  );
  await gotoCart(page);
  await expect(page.getByText('Your cart is empty')).toBeVisible();

  await addRedTeeAsGuest(page);
  await gotoCart(page);
  await expect(page.locator('.cart-items-line')).toHaveCount(1);

  const quantity = page.getByRole('textbox', { name: 'Quantity' });
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(quantity).toHaveValue('2');

  await page.getByRole('button', { name: 'Remove Tee' }).click();
  await expect(page.getByText('Your cart is empty')).toBeVisible();

  await addRedTeeAsGuest(page);
  await gotoCart(page);
  await page.getByRole('button', { name: 'Clear cart' }).click();
  await expect(page.getByText('Your cart is empty')).toBeVisible();

  expect(backend.calls).toContain('POST /cart');
  expect(backend.calls).toContain('POST /cart/items');
  expect(backend.calls).toContain(`PUT /cart/items/${ACTIVE_VARIANT_ID}`);
  expect(backend.calls).toContain(`DELETE /cart/items/${ACTIVE_VARIANT_ID}`);
  expect(backend.calls).toContain('DELETE /cart');
});

test('persists carts across reloads (guest bookmark, backend truth)', async ({ page }) => {
  await addRedTeeAsGuest(page);
  await gotoCart(page);
  const guestId = await guestIdOf(page);

  await page.reload();
  await gotoCart(page);
  await expect(page.locator('.cart-items-line')).toHaveCount(1);
  expect(await guestIdOf(page)).toBe(guestId);
});

test('persists the authenticated cart across reloads through refresh', async ({ page }) => {
  await mockRefresh(page);
  backend.authCart = {
    cartId: 'auth-cart-1',
    userId: USER_ID,
    version: 1,
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:00:00Z',
    items: [
      {
        productId: PRODUCT_ID,
        variantId: ACTIVE_VARIANT_ID,
        sku: 'TEE-RED-M',
        productName: 'Tee',
        unitPriceAmount: 29.99,
        currency: 'USD',
        quantity: 2,
      },
    ],
    isGuest: false,
    isAuthenticated: true,
  };
  await page.addInitScript(
    ({ key, session }) => window.localStorage.setItem(key, JSON.stringify(session)),
    {
      key: AUTH_KEY,
      session: {
        refreshToken: 'e2e-refresh-1',
        user: { ...ACTIVE_USER, displayName: null },
        authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
      },
    },
  );
  await gotoCart(page);
  await expect(page.locator('.cart-items-line')).toHaveCount(1);

  await page.reload();
  await gotoCart(page);
  await expect(page.locator('.cart-items-line')).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: 'Quantity' })).toHaveValue('2');
});

test('consolidates duplicate variants server-side on merge (no client math)', async ({ page }) => {
  await mockLogin(page);
  await mockRefresh(page);
  backend.authCart = {
    cartId: 'auth-cart-1',
    userId: USER_ID,
    version: 2,
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:05:00Z',
    items: [
      {
        productId: PRODUCT_ID,
        variantId: ACTIVE_VARIANT_ID,
        sku: 'TEE-RED-M',
        productName: 'Tee',
        unitPriceAmount: 29.99,
        currency: 'USD',
        quantity: 3,
      },
    ],
    isGuest: false,
    isAuthenticated: true,
  };

  await addRedTeeAsGuest(page, 2);
  await signIn(page, '/cart');

  // Already on /cart via returnUrl: the mount merge settles here.
  await expect(page.locator('.cart-items-line')).toHaveCount(1);
  // 2 guest + 3 existing, consolidated by the backend merge only.
  await expect(page.getByRole('textbox', { name: 'Quantity' })).toHaveValue('5');
  expect(backend.mergeCalls).toHaveLength(1);
});

test('recovers gracefully when the merge fails, then retries into success', async ({ page }) => {
  await mockLogin(page);
  await mockRefresh(page);
  backend.mergeBehavior = 'failOnce';

  await addRedTeeAsGuest(page);
  await signIn(page, '/cart');

  await expect(page.getByText('Cart unavailable')).toBeVisible();

  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('.cart-items-line')).toHaveCount(1);
  await expect(page.getByText('TEE-RED-M', { exact: true })).toBeVisible();
  expect(backend.mergeCalls).toHaveLength(2);
});

test('renders an empty guest cart with recovery navigation', async ({ page }) => {
  await gotoCart(page);
  await expect(page.getByText('Your cart is empty')).toBeVisible();

  await page.getByRole('link', { name: 'Browse the catalog' }).click();
  await expect(page).toHaveURL(/\/catalog$/);
});

test('keeps the cart readable within mobile and desktop viewports', async ({ page }) => {
  await addRedTeeAsGuest(page);
  await gotoCart(page);
  await expect(page.locator('.cart-items-line')).toHaveCount(1);

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
});

test('renders Arabic RTL cart copy with logical layout', async ({ page }) => {
  await page.addInitScript(
    ([key, value]: string[]) => window.localStorage.setItem(key, value),
    [CULTURE_KEY, 'ar'],
  );
  await gotoCart(page);

  await expect(page.locator('html[dir="rtl"]')).toBeAttached();
  await expect(page.getByRole('heading', { name: 'سلة التسوق' })).toBeVisible();
  await expect(page.getByText('سلة التسوق فارغة')).toBeVisible();
});
