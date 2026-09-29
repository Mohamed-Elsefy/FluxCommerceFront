/**
 * Admin Catalog & Inventory E2E for Sub-Phase 13.11 — Phase Verification.
 *
 * Same backend reality as `admin-auth.spec.ts`: transports are fulfilled
 * with contract-exact payloads because no live API runs here. Sessions
 * are seeded through `localStorage`, then restoration + guards + the
 * real feature slices run: product list/create/edit/details, variant
 * management, category management, image/specification management on
 * the product page, stock lookup, reservation lookup, and inventory
 * adjustment with updated-state verification.
 *
 * Contract-honest coverage notes (13.1 audit): there is no stock list,
 * no reservation list, no product/category search, sort, or filter
 * endpoint — so those journeys assert single-resource lookups and the
 * paged tables instead of inventing list UX that the backend cannot
 * serve. Reservation "filtering" (phase text) maps to the supported
 * single-id lookup.
 */

import { expect, test, type Page, type Route } from '@playwright/test';

const STORAGE_KEY = 'fluxcommerce.auth.session.v1';

function userWithRoles(roles: string[]): Record<string, unknown> {
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

function product(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'prod-1',
    name: 'Tee',
    slug: 'tee',
    description: 'Cotton tee',
    seo: null,
    status: 1,
    visibility: 0,
    categoryId: 'cat-1',
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
    ...overrides,
  };
}

function category(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'cat-1',
    name: 'Alpha',
    slug: 'alpha',
    description: null,
    parentId: null,
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
    ...overrides,
  };
}

function variant(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'var-1',
    productId: 'prod-1',
    sku: 'TEE-BLK-M',
    name: 'Black / M',
    unitPriceAmount: 29.99,
    currency: 'USD',
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
    ...overrides,
  };
}

function image(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'img-1',
    productId: 'prod-1',
    imageUrl: '/images/tee.jpg',
    altText: 'Tee',
    displayOrder: 0,
    isPrimary: true,
    metadata: null,
    createdAtUtc: '2026-09-04T10:00:00Z',
    ...overrides,
  };
}

function spec(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'spec-1', productId: 'prod-1', name: 'Material', value: 'Cotton', ...overrides };
}

function stock(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sku: 'TEE-BLK-M',
    onHandQuantity: 100,
    reservedQuantity: 2,
    availableQuantity: 98,
    updatedAtUtc: '2026-09-04T10:00:00Z',
    ...overrides,
  };
}

function reservation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    reservationId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    orderId: '4fa85f64-5717-4562-b3fc-2c963f66afa6',
    sku: 'TEE-BLK-M',
    quantity: 2,
    status: 0,
    expiresAt: '2026-09-04T10:30:00Z',
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:00:00Z',
    ...overrides,
  };
}

function paged(items: unknown[], totalCount: number): Record<string, unknown> {
  return { items, totalCount, pageNumber: 1, pageSize: 20 };
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

/**
 * API origin behind `ApiClient` (the admin `environment.apiBaseUrl`).
 * Predicates match on origin AND pathname: several admin routes share
 * their pathname with the backend contract (`/catalog/products` is both
 * an SPA route and an API path), so pathname-only matching would
 * fulfill the document navigation itself with JSON.
 */
const API_ORIGIN = 'https://localhost:7119';

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
            contentType: status === 204 ? undefined : 'application/json',
            body: typeof body === 'string' ? body : JSON.stringify(body),
          })
        : route.fallback(),
  );
}

function json(data: unknown): Record<string, unknown> {
  return { isSuccess: true, message: 'Operation completed successfully.', data };
}

async function mockCatalogReads(
  page: Page,
  options: {
    products?: unknown[];
    productsTotal?: number;
    categories?: unknown[];
    variants?: unknown[];
    images?: unknown[];
    specs?: unknown[];
    productOverrides?: Record<string, unknown>;
  } = {},
): Promise<void> {
  const products = options.products ?? [
    product(),
    product({ id: 'prod-2', name: 'Hoodie', slug: 'hoodie' }),
  ];
  await mock(
    page,
    'GET',
    '/catalog/products',
    200,
    json(paged(products, options.productsTotal ?? products.length)),
  );
  await mock(page, 'GET', '/catalog/products/prod-1', 200, json(product(options.productOverrides)));
  await mock(
    page,
    'GET',
    '/catalog/categories',
    200,
    json({
      items: options.categories ?? [category()],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 100,
    }),
  );
  await mock(
    page,
    'GET',
    '/catalog/products/prod-1/variants',
    200,
    json(options.variants ?? [variant()]),
  );
  await mock(
    page,
    'GET',
    '/catalog/products/prod-1/images',
    200,
    json(options.images ?? [image()]),
  );
  await mock(
    page,
    'GET',
    '/catalog/products/prod-1/specifications',
    200,
    json(options.specs ?? [spec()]),
  );
}

test.describe('admin catalog journeys (13.11)', () => {
  test('admin login lands on the product list with rows and pager', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mockCatalogReads(page, { productsTotal: 25 });
    await page.goto('/catalog/products');

    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Tee', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Active' }).first()).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Product pages' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New product' })).toBeVisible();
  });

  test('product creation notifies and lands on details', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mockCatalogReads(page);
    await mock(page, 'POST', '/catalog/products', 201, json('prod-new'));
    await mock(page, 'GET', '/catalog/products/prod-new', 200, json(product({ id: 'prod-new' })));
    await mock(page, 'GET', '/catalog/products/prod-new/variants', 200, json([]));
    await mock(page, 'GET', '/catalog/products/prod-new/images', 200, json([]));
    await mock(page, 'GET', '/catalog/products/prod-new/specifications', 200, json([]));
    await page.goto('/catalog/products/new');

    await page.getByLabel('Name').fill('Tee');
    await page.getByLabel('Slug').fill('tee');
    await page.getByLabel('Category').selectOption('cat-1');
    await page.getByLabel('Visibility').selectOption('0');
    await page.getByRole('button', { name: 'Create product' }).click();

    await expect(page).toHaveURL(/\/catalog\/products\/prod-new$/);
    await expect(page.getByRole('heading', { name: 'Tee' })).toBeVisible();
    await expect(page.getByText('Product created')).toBeVisible();
  });

  test('product editing updates and notifies', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mockCatalogReads(page);
    await mock(page, 'PUT', '/catalog/products/prod-1', 204, '');
    await page.goto('/catalog/products/prod-1/edit');

    await page.getByLabel('Name').fill('Tee Updated');
    await page.getByRole('button', { name: 'Save product' }).click();

    await expect(page).toHaveURL(/\/catalog\/products\/prod-1$/);
    await expect(page.getByText('Product updated')).toBeVisible();
  });

  test('variant management lists and creates within the product context', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mockCatalogReads(page);
    await mock(page, 'POST', '/catalog/products/prod-1/variants', 201, json('var-new'));
    await mock(
      page,
      'GET',
      '/catalog/products/prod-1/variants/var-new',
      200,
      json(variant({ id: 'var-new' })),
    );
    await page.goto('/catalog/products/prod-1/variants');

    await expect(page.getByRole('heading', { name: 'Variants' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'TEE-BLK-M' })).toBeVisible();

    await page.goto('/catalog/products/prod-1/variants/new');
    await page.getByLabel('SKU').fill('TEE-WHT-S');
    await page.getByLabel('Name').fill('White / S');
    await page.getByLabel('Price').fill('24.99');
    await page.getByLabel('Currency').fill('USD');
    await page.getByRole('button', { name: 'Create variant' }).click();

    await expect(page).toHaveURL(/\/catalog\/products\/prod-1\/variants\/var-new$/);
    await expect(page.getByText('Variant created')).toBeVisible();
  });

  test('category management lists, creates, and deletes with confirmation', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/catalog/categories', 200, json(paged([category()], 1)));
    await mock(page, 'POST', '/catalog/categories', 201, json('cat-new'));
    await mock(page, 'GET', '/catalog/categories/cat-new', 200, json(category({ id: 'cat-new' })));
    await page.goto('/catalog/categories');

    await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Alpha', exact: true })).toBeVisible();

    await page.goto('/catalog/categories/new');
    await page.getByLabel('Name').fill('Beta');
    await page.getByLabel('Slug').fill('beta');
    await page.getByRole('button', { name: 'Create category' }).click();

    await expect(page).toHaveURL(/\/catalog\/categories\/cat-new$/);
    await expect(page.getByText('Category created')).toBeVisible();
  });

  test('category soft-delete confirms and offers restore', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(
      page,
      'GET',
      '/catalog/categories',
      200,
      json({ items: [category()], totalCount: 1, pageNumber: 1, pageSize: 100 }),
    );
    let reads = 0;
    await page.route(
      (url) => url.origin === API_ORIGIN && url.pathname === '/catalog/categories/cat-1',
      (route: Route) => {
        if (route.request().method() !== 'GET') {
          return route.fallback();
        }
        reads += 1;
        const deleted = reads > 1;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: ok(category({ isDeleted: deleted })),
        });
      },
    );
    await mock(page, 'POST', '/catalog/categories/cat-1/soft-delete', 204, '');
    await page.goto('/catalog/categories/cat-1');

    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByText('Status updated')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
  });

  test('image and specification management on the product page', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mockCatalogReads(page, {
      images: [
        image(),
        image({
          id: 'img-2',
          imageUrl: '/images/back.jpg',
          altText: null,
          displayOrder: 1,
          isPrimary: false,
        }),
      ],
    });
    await mock(page, 'POST', '/catalog/products/prod-1/images', 204, '');
    await mock(page, 'POST', '/catalog/products/prod-1/specifications', 204, '');
    await mock(page, 'POST', '/catalog/products/prod-1/images/img-2/set-primary', 204, '');
    await mock(page, 'DELETE', '/catalog/products/prod-1/specifications/spec-1', 204, '');
    await page.goto('/catalog/products/prod-1');

    const images = page.locator('section[aria-labelledby="product-details-images-title"]');
    await images.getByRole('button', { name: 'Add image' }).click();
    await page.getByLabel('Image URL').fill('/images/new.jpg');
    await page.getByLabel('Display order').fill('1');
    await page.locator('admin-dialog').getByRole('button', { name: 'Add image' }).click();
    await expect(page.getByText('Image added')).toBeVisible();

    const specs = page.locator('section[aria-labelledby="product-details-specs-title"]');
    await specs.getByRole('button', { name: 'Add specification' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Fit');
    await page.getByLabel('Value').fill('Slim');
    await page.locator('admin-dialog').getByRole('button', { name: 'Add specification' }).click();
    await expect(page.getByText('Specification added')).toBeVisible();

    await images.getByRole('button', { name: 'Set primary' }).click();
    await expect(page.getByText('Primary image updated')).toBeVisible();

    await specs.getByRole('button', { name: 'Delete' }).click();
    await page.locator('admin-dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Specification deleted')).toBeVisible();
  });

  test('unknown products render the error state', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/catalog/products/missing', 404, {
      type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
      title: 'Not Found',
      status: 404,
      detail: 'Not found.',
      extensions: {},
    });
    await page.goto('/catalog/products/missing');

    await expect(page.getByText('Could not load products')).toBeVisible();
  });
});

test.describe('admin inventory journeys (13.11)', () => {
  test('stock lookup renders backend-issued facts', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'GET', '/inventory/TEE-BLK-M', 200, json(stock()));
    await page.goto('/inventory/stock');

    await page.getByLabel('SKU').fill('tee-blk-m');
    await page.getByRole('button', { name: 'Look up' }).click();

    await expect(page.getByText('TEE-BLK-M').first()).toBeVisible();
    await expect(page.getByText('98')).toBeVisible();
  });

  test('reservation lookup renders the lifecycle status', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(
      page,
      'GET',
      '/inventory/reservations/3fa85f64-5717-4562-b3fc-2c963f66afa6',
      200,
      json(reservation()),
    );
    await page.goto('/inventory/reservations');

    await page.getByLabel('Reservation ID').fill('3fa85f64-5717-4562-b3fc-2c963f66afa6');
    await page.getByRole('button', { name: 'Look up' }).click();

    await expect(page.getByText('Pending').first()).toBeVisible();
    await expect(page.getByText('TEE-BLK-M')).toBeVisible();
  });

  test('adjustment confirms and renders the backend-returned updated state', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(
      page,
      'PATCH',
      '/inventory/TEE-BLK-M',
      200,
      json(stock({ onHandQuantity: 125, availableQuantity: 123 })),
    );
    await page.goto('/inventory/adjustments');

    await page.getByLabel('SKU').fill('tee-blk-m');
    await page.getByLabel('Quantity').fill('25');
    await page.getByRole('button', { name: 'Adjust stock' }).click();
    await expect(page.getByText('Add 25 units to “TEE-BLK-M”?')).toBeVisible();
    await page.locator('admin-dialog').getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByText('Stock adjusted')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Updated stock' })).toBeVisible();
    await expect(page.getByText('125')).toBeVisible();
    await expect(page.getByText('123')).toBeVisible();
  });

  test('item creation onboards a new SKU and renders the created record', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(
      page,
      'POST',
      '/inventory',
      201,
      json(
        stock({
          sku: 'SSD-121',
          onHandQuantity: 0,
          reservedQuantity: 0,
          availableQuantity: 0,
        }),
      ),
    );
    await page.goto('/inventory/new');

    await page.getByLabel('SKU').fill('ssd-121');
    await page.getByLabel('On-hand quantity').fill('0');
    await page.getByRole('button', { name: 'Create item' }).click();

    await expect(page.getByText('Inventory item created')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Created stock' })).toBeVisible();
    await expect(page.getByText('SSD-121').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'View in stock lookup' })).toBeVisible();
  });

  test('adjustment on an untracked SKU links to prefilled item creation', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mock(page, 'PATCH', '/inventory/SSD-121', 404, {
      type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
      title: 'Not Found',
      status: 404,
      detail: 'Not found.',
      extensions: {},
    });
    await page.goto('/inventory/adjustments');

    await page.getByLabel('SKU').fill('ssd-121');
    await page.getByLabel('Quantity').fill('25');
    await page.getByRole('button', { name: 'Adjust stock' }).click();
    await page.locator('admin-dialog').getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByText('No inventory item exists for “SSD-121”.')).toBeVisible();
    await page.getByRole('link', { name: 'Create inventory item' }).click();

    await expect(page).toHaveURL(/\/inventory\/new\?sku=SSD-121$/);
    await expect(page.getByLabel('SKU')).toHaveValue('SSD-121');
  });
});

test.describe('admin catalog authorization + localization (13.11)', () => {
  test('customers land on forbidden for catalog and inventory routes', async ({ page }) => {
    await seed(page, ['Customer']);
    await mockSession(page, ['Customer']);
    await page.goto('/catalog/products');

    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test('French chrome localizes catalog and inventory journeys', async ({ page }) => {
    await seed(page, ['Admin']);
    await mockSession(page, ['Admin']);
    await mockCatalogReads(page);
    await page.addInitScript(() => window.localStorage.setItem('fluxcommerce.culture.v1', 'fr'));
    await page.goto('/catalog/products');

    await expect(page.getByRole('heading', { name: 'Produits' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Produits' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Stock' })).toBeVisible();
  });
});
