/**
 * Catalog discovery E2E journey for Sub-Phase 5.11 — Testing.
 *
 * Covers the critical customer flow end to end through the real
 * storefront (routing, query state, components, resource states):
 *
 * ```text
 * Home → Category → Product Listing → Search → Filter → Sort →
 * Pagination → Product Card navigation
 * ```
 *
 * Transport is mocked at the network boundary (`page.route`) with
 * backend-faithful semantics (filtering, name sorting, paging per the
 * `GET /catalog` contract): no backend in this environment seeds 20+
 * products in one category, so true pagination is unreachable against
 * live data — while the unit integration spec
 * (`catalog-integration.spec.ts`) proves the live contract path with
 * contract-exact fixtures. The handlers below stay isolated in
 * `mockCatalogApi` so the same journey runs live by dropping them once
 * seed data allows it.
 */

import { expect, test, type Page, type Route } from '@playwright/test';

const APPAREL_ID = '22222222-2222-2222-2222-222222222222';
const ACCESSORIES_ID = '33333333-3333-3333-3333-333333333333';

interface MockProduct {
  id: string;
  name: string;
  categoryId: string;
}

interface MockCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

const CATEGORIES: MockCategory[] = [
  { id: APPAREL_ID, name: 'Apparel', slug: 'apparel', description: null },
  { id: ACCESSORIES_ID, name: 'Accessories', slug: 'accessories', description: null },
];

/** 25 zero-padded products so lexicographic order matches numeric order. */
const PRODUCTS: MockProduct[] = Array.from({ length: 25 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    id: `11111111-1111-1111-1111-1111111111${number}`,
    name: `E2E Product ${number}`,
    categoryId: APPAREL_ID,
  };
});

function toListItem(product: MockProduct): Record<string, unknown> {
  return {
    id: product.id,
    name: product.name,
    slug: product.name.toLowerCase().replace(/\s+/g, '-'),
    description: null,
    categoryId: product.categoryId,
    primaryImage: null,
  };
}

function toCategoryPayload(category: MockCategory): Record<string, unknown> {
  return {
    ...category,
    parentId: null,
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function envelope(data: unknown): Record<string, unknown> {
  return { isSuccess: true, message: 'Operation completed successfully.', data };
}

/**
 * Backend-faithful `GET /catalog` handler: category/search/status/
 * visibility filtering, name sorting, and paging per the contract
 * (`items` = this page only, `totalCount` = matches across pages,
 * `pageNumber`/`pageSize` echoed).
 */
async function serveSearch(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const params = url.searchParams;
  const categoryId = params.get('categoryId');
  const searchTerm = (params.get('searchTerm') ?? '').trim().toLowerCase();
  const status = params.get('status');
  const visibility = params.get('visibility');
  const sortBy = params.get('sortBy');
  const sortDirection = params.get('sortDirection');
  const pageNumber = Math.max(1, Number.parseInt(params.get('pageNumber') ?? '1', 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(params.get('pageSize') ?? '20', 10) || 20),
  );

  let matches = [...PRODUCTS];
  if (categoryId !== null && categoryId !== '') {
    matches = matches.filter((product) => product.categoryId === categoryId);
  }
  if (searchTerm !== '') {
    matches = matches.filter((product) => product.name.toLowerCase().includes(searchTerm));
  }
  if (status !== null && status !== '' && status !== 'Active' && status !== '1') {
    matches = [];
  }
  if (visibility !== null && visibility !== '' && visibility !== 'Visible' && visibility !== '0') {
    matches = [];
  }
  if (sortBy === 'Name' || sortBy === '0') {
    matches.sort((a, b) => a.name.localeCompare(b.name));
    if (sortDirection === 'Descending' || sortDirection === '1') {
      matches.reverse();
    }
  }

  const items = matches.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
  await route.fulfill({
    json: envelope({
      items: items.map(toListItem),
      totalCount: matches.length,
      pageNumber,
      pageSize,
    }),
  });
}

async function serveCategories(route: Route): Promise<void> {
  await route.fulfill({
    json: envelope({
      items: CATEGORIES.map(toCategoryPayload),
      totalCount: CATEGORIES.length,
      pageNumber: 1,
      pageSize: 100,
    }),
  });
}

/** Development backend origin (dev `ng serve` environment, never the app itself). */
const CATALOG_API_ORIGIN = 'https://localhost:7119';

/** Installs the mocked catalog transport for one journey page. */
async function mockCatalogApi(page: Page): Promise<void> {
  // NOTE: matchers scope to the API origin on purpose — a bare pathname
  // matcher would also intercept the `/catalog` page navigation itself
  // and fulfill the document with JSON.
  await page.route(
    (url) => url.origin === CATALOG_API_ORIGIN && url.pathname === '/catalog/categories',
    (route) => serveCategories(route),
  );
  await page.route(
    (url) => url.origin === CATALOG_API_ORIGIN && url.pathname === '/catalog',
    (route) => serveSearch(route),
  );
}

test.beforeEach(async ({ page }) => {
  await mockCatalogApi(page);
});

test('discovers categories from the Home entry point', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Discover products' })).toBeVisible();
  await page.getByRole('link', { name: 'Browse categories' }).click();

  await expect(page).toHaveURL(/\/catalog$/);
  await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Apparel' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Accessories' })).toBeVisible();
});

test('opens a category listing with grid, count, and pager', async ({ page }) => {
  await page.goto(`/catalog?categoryId=${APPAREL_ID}`);

  await expect(page.locator('catalog-product-card')).toHaveCount(20);
  await expect(page.getByText('25 products', { exact: true })).toBeVisible();
  const pager = page.locator('catalog-product-pagination nav');
  await expect(pager.getByRole('button', { name: '1' })).toBeVisible();
  await expect(pager.getByRole('button', { name: '2' })).toBeVisible();
});

test('searches and restores the listing on clear', async ({ page }) => {
  await page.goto(`/catalog?categoryId=${APPAREL_ID}`);
  await expect(page.locator('catalog-product-card')).toHaveCount(20);

  await page.getByLabel('Search products').fill('E2E Product 2');
  await expect(page).toHaveURL(/searchTerm=E2E%20Product%202/);
  await expect(page.locator('catalog-product-card')).toHaveCount(6);
  await expect(page.getByText('6 products', { exact: true })).toBeVisible();
  await expect(page.locator('catalog-product-card h3').first()).toContainText('E2E Product 20');

  await page.getByLabel('Search products').fill('');
  await expect(page).not.toHaveURL(/searchTerm=/);
  await expect(page.locator('catalog-product-card')).toHaveCount(20);
});

test('filters by status with an empty state and recovery', async ({ page }) => {
  await page.goto(`/catalog?categoryId=${APPAREL_ID}`);
  await expect(page.locator('catalog-product-card')).toHaveCount(20);

  await page.getByLabel('Status').selectOption('2');
  await expect(page).toHaveURL(/status=2/);
  await expect(page.getByText('No matching products')).toBeVisible();
  expect(await page.locator('catalog-product-card').count()).toBe(0);

  await page.getByLabel('Status').selectOption('');
  await expect(page).not.toHaveURL(/status=/);
  await expect(page.locator('catalog-product-card')).toHaveCount(20);
});

test('sorts by name descending', async ({ page }) => {
  await page.goto(`/catalog?categoryId=${APPAREL_ID}`);
  await expect(page.locator('catalog-product-card h3').first()).toContainText('E2E Product 01');

  await page.getByLabel('Sort by').selectOption('0:1');
  await expect(page).toHaveURL(/sortBy=0/);
  await expect(page.locator('catalog-product-card h3').first()).toContainText('E2E Product 25');
});

test('paginates while preserving the active query', async ({ page }) => {
  await page.goto(`/catalog?categoryId=${APPAREL_ID}`);
  await expect(page.locator('catalog-product-card')).toHaveCount(20);

  await page
    .locator('catalog-product-pagination nav')
    .getByRole('button', { name: 'Next' })
    .click();

  await expect(page).toHaveURL(/pageNumber=2/);
  await expect(page).toHaveURL(new RegExp(`categoryId=${APPAREL_ID}`));
  await expect(page.locator('catalog-product-card')).toHaveCount(5);
  await expect(page.locator('catalog-product-card h3').first()).toContainText('E2E Product 21');
  await expect(page.getByText('25 products', { exact: true })).toBeVisible();
});

test('navigates from a product card to the details route', async ({ page }) => {
  await page.goto(`/catalog?categoryId=${APPAREL_ID}`);
  const target = await page.locator('catalog-product-card a').first().getAttribute('href');

  expect(target).toMatch(/^\/catalog\/products\/[0-9a-f-]{36}$/);
  await page.locator('catalog-product-card a').first().click();
  await expect(page).toHaveURL(target ?? '');
});

for (const viewport of [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  test(`catalog has no horizontal overflow on ${viewport.name} viewports`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`/catalog?categoryId=${APPAREL_ID}`);

    await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible();
    await expect(page.locator('catalog-product-card').first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
