/**
 * Product Details E2E journey for Sub-Phase 6.10 — Testing (guest
 * submission unblocked by the priced-variant contract change, ADR 018).
 *
 * Covers the critical customer flow end to end through the real
 * storefront (routing, param handling, components, resource states):
 *
 * ```text
 * Home → Category → Product Listing → Product Details →
 * Select Variant → SKU + backend-issued price binding →
 * Select Quantity → Guest Add to Cart → Added confirmation
 * ```
 *
 * Transport is mocked at the network boundary (`page.route`) with
 * backend-faithful fixtures (numeric wire enums, `ApiResponse` envelopes,
 * camelCase casing, `displayOrder` image ordering, backend-issued variant
 * pricing): no live backend runs in this environment — while the unit
 * integration spec (`product-details-integration.spec.ts`) proves the
 * live contract path with contract-exact fixtures. The handlers below
 * stay isolated in `mockProductDetailsApi` so the same journey runs live
 * by dropping them once seed data allows it.
 *
 * Submission (ADR 018): the priced-variant contract change provides the
 * wire snapshot, so the page mounts the control and submits guest lines
 * through the cart lifecycle; a dedicated test pins the exact guest
 * request body.
 */

import { expect, test, type Page, type Route } from '@playwright/test';

const APPAREL_ID = '22222222-2222-2222-2222-222222222222';
const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';
const ACTIVE_VARIANT_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const INACTIVE_VARIANT_ID = 'bbbbbbbb-2222-4222-8222-222222222222';
const CULTURE_KEY = 'fluxcommerce.culture.v1';

/** 1px PNG served for every fixture image (deterministic gallery rendering). */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function envelope(data: unknown): Record<string, unknown> {
  return { isSuccess: true, message: 'Operation completed successfully.', data };
}

function productPayload(): Record<string, unknown> {
  return {
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
  };
}

function specificationsPayload(): Record<string, unknown>[] {
  return [
    {
      id: 'a1a1a1a1-1111-4111-8111-111111111111',
      productId: PRODUCT_ID,
      name: 'Material',
      value: 'Cotton',
    },
    {
      id: 'b2b2b2b2-2222-4222-8222-222222222222',
      productId: PRODUCT_ID,
      name: 'Fit',
      value: 'Regular',
    },
  ];
}

function imagesPayload(): Record<string, unknown>[] {
  return [
    {
      id: 'c3c3c3c3-3333-4333-8333-333333333333',
      productId: PRODUCT_ID,
      imageUrl: '/images/e2e-tee-front.jpg',
      altText: 'Tee front view',
      displayOrder: 0,
      isPrimary: true,
      metadata: null,
      createdAtUtc: '2026-09-04T10:00:00Z',
    },
    {
      id: 'd4d4d4d4-4444-4444-8444-444444444444',
      productId: PRODUCT_ID,
      imageUrl: '/images/e2e-tee-back.jpg',
      altText: null,
      displayOrder: 1,
      isPrimary: false,
      metadata: null,
      createdAtUtc: '2026-09-04T10:00:00Z',
    },
  ];
}

function variantsPayload(): Record<string, unknown>[] {
  return [
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
  ];
}

const GUEST_CART_ID = '11111111-1111-4111-8111-111111111111';

function guestCartPayload(): Record<string, unknown> {
  return {
    cartId: GUEST_CART_ID,
    userId: null,
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
        quantity: 1,
      },
    ],
    isGuest: true,
    isAuthenticated: false,
  };
}

/** Development backend origin (dev `ng serve` environment, never the app itself). */
const DETAILS_API_ORIGIN = 'https://localhost:7119';

/** Installs the mocked product-details transport for one journey page. */
async function mockProductDetailsApi(page: Page): Promise<void> {
  // NOTE: matchers scope to the API origin on purpose — bare pathname
  // matchers would also intercept same-path page navigations.
  const api = (pathname: string) => (url: URL) =>
    url.origin === DETAILS_API_ORIGIN && url.pathname === pathname;
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
            primaryImage: {
              id: 'c3c3c3c3-3333-4333-8333-333333333333',
              imageUrl: '/images/e2e-tee-front.jpg',
              altText: 'Tee front view',
              displayOrder: 0,
              isPrimary: true,
            },
          },
        ],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 20,
      }),
    }),
  );
  await page.route(api(`/catalog/products/${PRODUCT_ID}`), (route) =>
    route.fulfill({ json: envelope(productPayload()) }),
  );
  await page.route(api(`/catalog/products/${PRODUCT_ID}/specifications`), (route) =>
    route.fulfill({ json: envelope(specificationsPayload()) }),
  );
  await page.route(api(`/catalog/products/${PRODUCT_ID}/images`), (route) =>
    route.fulfill({ json: envelope(imagesPayload()) }),
  );
  await page.route(api(`/catalog/products/${PRODUCT_ID}/variants`), (route) =>
    route.fulfill({ json: envelope(variantsPayload()) }),
  );
  await page.route(api('/cart/guest'), (route) =>
    route.fulfill({ status: 201, json: envelope({ ...guestCartPayload(), items: [] }) }),
  );
  await page.route(api(`/cart/guest/${GUEST_CART_ID}/items`), (route) =>
    route.fulfill({ json: envelope(guestCartPayload()) }),
  );
  await page.route(
    (url) => url.pathname.startsWith('/images/'),
    (route: Route) => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL_PNG }),
  );
}

test.beforeEach(async ({ page }) => {
  await mockProductDetailsApi(page);
});

test('completes the discovery-to-details journey with variant, SKU, and quantity selection', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Discover products' })).toBeVisible();
  await page.getByRole('link', { name: 'Browse categories' }).click();

  await expect(page).toHaveURL(/\/catalog$/);
  await page.getByRole('link', { name: 'Apparel' }).click();

  const cardLink = page.locator('catalog-product-card a').first();
  await expect(cardLink).toHaveAttribute('href', `/catalog/products/${PRODUCT_ID}`);
  await cardLink.click();

  await expect(page).toHaveURL(`/catalog/products/${PRODUCT_ID}`);
  await expect(page.getByRole('heading', { name: 'Tee' })).toBeVisible();
  await expect(page.getByText('A comfortable cotton tee.')).toBeVisible();
  await expect(page.getByText('Material')).toBeVisible();
  await expect(page.getByText('Cotton', { exact: true })).toBeVisible();

  const gallery = page.locator('product-details-gallery');
  await expect(gallery.locator('.product-gallery-main-image')).toBeVisible();
  await expect(gallery.locator('.product-gallery-thumb')).toHaveCount(2);
  await gallery.locator('.product-gallery-thumb').nth(1).click();
  await expect(gallery.locator('.product-gallery-main-image')).toHaveAttribute(
    'src',
    '/images/e2e-tee-back.jpg',
  );

  await page.getByRole('button', { name: 'Red / M' }).click();
  await expect(page.getByText('TEE-RED-M', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(page.getByRole('textbox', { name: 'Quantity' })).toHaveValue('2');
});

test('submits the guest line with the backend-issued price snapshot (ADR 018)', async ({
  page,
}) => {
  // Capture the exact wire body: the snapshot must come from the selected
  // backend-issued variant, never from local math or defaults.
  let submittedBody: unknown = null;
  await page.unroute(
    (url) =>
      url.origin === DETAILS_API_ORIGIN && url.pathname === `/cart/guest/${GUEST_CART_ID}/items`,
  );
  await page.route(
    (url) =>
      url.origin === DETAILS_API_ORIGIN && url.pathname === `/cart/guest/${GUEST_CART_ID}/items`,
    (route: Route) => {
      submittedBody = route.request().postDataJSON();
      route.fulfill({ json: envelope(guestCartPayload()) });
    },
  );

  await page.goto(`/catalog/products/${PRODUCT_ID}`);
  await expect(page.getByRole('heading', { name: 'Tee' })).toBeVisible();

  await page.getByRole('button', { name: 'Red / M' }).click();
  await expect(page.getByText('TEE-RED-M', { exact: true })).toBeVisible();
  await expect(page.getByText('$29.99', { exact: true })).toBeVisible();

  const add = page.getByRole('button', { name: 'Add to cart' });
  await expect(add).toBeEnabled();
  await add.click();

  await expect(page.getByText('Added to cart.')).toBeVisible();
  expect(submittedBody).toEqual({
    variantId: ACTIVE_VARIANT_ID,
    unitPriceAmount: 29.99,
    currency: 'USD',
    quantity: 1,
  });
});

test('shows Product Not Found with a working back link', async ({ page }) => {
  // Deterministic override: remove the default product handler, then serve
  // the 404 for the not-found scenario only.
  await page.unroute(
    (url) =>
      url.origin === DETAILS_API_ORIGIN && url.pathname === `/catalog/products/${PRODUCT_ID}`,
  );
  await page.route(
    (url) =>
      url.origin === DETAILS_API_ORIGIN && url.pathname === `/catalog/products/${PRODUCT_ID}`,
    (route: Route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: 'Product not found.',
        }),
      }),
  );

  await page.goto(`/catalog/products/${PRODUCT_ID}`);
  await expect(page.getByText('Product not found')).toBeVisible();

  await page.getByRole('link', { name: 'Back to catalog' }).click();
  await expect(page).toHaveURL(/\/catalog$/);
});

test('disables unavailable variants clearly', async ({ page }) => {
  await page.goto(`/catalog/products/${PRODUCT_ID}`);
  await expect(page.getByRole('heading', { name: 'Tee' })).toBeVisible();

  const unavailable = page.getByRole('button', { name: /Blue \/ M/ });
  await expect(unavailable).toBeDisabled();
  await expect(page.getByText('Unavailable')).toBeVisible();
});

test('renders Arabic RTL copy with logical layout', async ({ page }) => {
  await page.addInitScript(
    ([key, value]: string[]) => window.localStorage.setItem(key, value),
    ['fluxcommerce.culture.v1', 'ar'],
  );

  await page.goto(`/catalog/products/${PRODUCT_ID}`);
  await expect(page.locator('html[dir="rtl"]')).toBeAttached();
  await expect(page.getByRole('heading', { name: 'Tee' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الوصف' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'المواصفات' })).toBeVisible();
});

for (const viewport of [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  test(`details page has no horizontal overflow on ${viewport.name} viewports`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`/catalog/products/${PRODUCT_ID}`);

    await expect(page.getByRole('heading', { name: 'Tee' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
