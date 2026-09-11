/**
 * Page tests for the `CategoriesPage` (Sub-Phases 5.2–5.3: discovery +
 * listing).
 *
 * `CatalogState` is stubbed at its typed seam (its orchestration is
 * covered by `catalog-state.spec.ts`) so these tests own the page logic:
 * discovery load on init, listing load/clear driven by the `categoryId`
 * query parameter, loading/empty/error/success rendering for both slots,
 * localized copy per active culture, graceful unknown ids,
 * clear-selection navigation, and both retries. The router stays real to
 * prove link-target behavior.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import {
  ApiError,
  emptyResource,
  errorResource,
  idleResource,
  loadingResource,
  successResource,
  type ResourceState,
} from '@flux/api';
import { CultureService } from '@flux/i18n';
import type { CategoryResponse } from '@flux/models';
import { CatalogState } from '../../state/catalog-state';
import type { CategoryList, ProductList, ProductListItem } from '../../models/catalog.models';
import { CategoriesPage, CATEGORY_NAV_PAGE_SIZE } from './categories-page';

const CATEGORIES: readonly CategoryResponse[] = [
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Apparel',
    slug: 'apparel',
    description: null,
    parentId: null,
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Accessories',
    slug: 'accessories',
    description: null,
    parentId: null,
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  },
];

function categoryList(): CategoryList {
  return { items: [...CATEGORIES], totalCount: 2, pageNumber: 1, pageSize: 100 };
}

function productItem(id: string, name: string): ProductListItem {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    description: null,
    categoryId: '22222222-2222-2222-2222-222222222222',
    primaryImage: null,
  };
}

function productList(): ProductList {
  return {
    items: [
      productItem('11111111-1111-1111-1111-111111111111', 'Tee'),
      productItem('55555555-5555-5555-5555-555555555555', 'Hoodie'),
    ],
    totalCount: 2,
    pageNumber: 1,
    pageSize: 20,
  };
}

function setup(options: {
  snapshot?: ResourceState<CategoryList>;
  productsSnapshot?: ResourceState<ProductList>;
  categoryId?: string | null;
  culture?: 'en' | 'fr';
  platform?: 'browser' | 'server';
}): {
  fixture: ComponentFixture<CategoriesPage>;
  element: HTMLElement;
  loadCalls: unknown[];
  loadProductsCalls: unknown[];
  clearProductsCalls: number;
} {
  const loadCalls: unknown[] = [];
  const loadProductsCalls: unknown[] = [];
  let clearProductsCalls = 0;
  const stateStub = {
    categories: signal(options.snapshot ?? idleResource<CategoryList>()),
    products: signal(options.productsSnapshot ?? idleResource<ProductList>()),
    loadCategories: ((query: unknown) => {
      loadCalls.push(query);
    }) as CatalogState['loadCategories'],
    loadProducts: ((query: unknown) => {
      loadProductsCalls.push(query);
    }) as CatalogState['loadProducts'],
    clearProducts: (() => {
      clearProductsCalls += 1;
    }) as CatalogState['clearProducts'],
  } as unknown as CatalogState;
  const routeStub = {
    queryParamMap: of(
      convertToParamMap({
        ...(options.categoryId === undefined ? {} : { categoryId: options.categoryId }),
      }),
    ),
  } as unknown as ActivatedRoute;

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CatalogState, useValue: stateStub },
      { provide: ActivatedRoute, useValue: routeStub },
      ...(options.platform === undefined
        ? []
        : [{ provide: PLATFORM_ID, useValue: options.platform }]),
    ],
  });
  window.localStorage.clear();
  TestBed.inject(CultureService).setCulture(options.culture ?? 'en');
  const fixture = TestBed.createComponent(CategoriesPage);
  fixture.detectChanges();
  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    loadCalls,
    loadProductsCalls,
    clearProductsCalls,
  };
}

function categoryLinks(element: HTMLElement): HTMLAnchorElement[] {
  return [...element.querySelectorAll('catalog-category-nav nav a')].map(
    (link) => link as HTMLAnchorElement,
  );
}

describe('CategoriesPage loading', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the full discovery set on init', () => {
    const { loadCalls } = setup({});

    expect(loadCalls).toEqual([{ pageNumber: 1, pageSize: CATEGORY_NAV_PAGE_SIZE }]);
  });

  it('skips loading on the server (prerenders the idle shell)', () => {
    const { element, loadCalls } = setup({ platform: 'server' });

    expect(loadCalls).toEqual([]);
    expect(element.querySelector('flux-loading-indicator')).toBeNull();
    expect(element.querySelector('h1')?.textContent).toBe('Shop by category');
  });

  it('renders the loading state while categories fetch', () => {
    const { element } = setup({ snapshot: loadingResource<CategoryList>() });

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(element.querySelector('catalog-category-nav')).toBeNull();
  });
});

describe('CategoriesPage success', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders one listing link per category', () => {
    const { element } = setup({ snapshot: successResource(categoryList()) });

    expect(categoryLinks(element).map((link) => link.getAttribute('href'))).toEqual([
      '/catalog?categoryId=22222222-2222-2222-2222-222222222222',
      '/catalog?categoryId=33333333-3333-3333-3333-333333333333',
    ]);
  });

  it('marks the query-selected category and offers to clear it', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      categoryId: CATEGORIES[1]?.id ?? null,
    });
    const clear = element.querySelector('.categories-page > p a');

    expect(categoryLinks(element)[1]?.getAttribute('aria-current')).toBe('page');
    expect(categoryLinks(element)[0]?.getAttribute('aria-current')).toBeNull();
    expect(clear?.getAttribute('href')).toBe('/catalog');
    expect(clear?.textContent?.trim()).toBe('Show all categories');
  });

  it('selects nothing for an unknown category id', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      categoryId: 'unknown-category',
    });

    for (const link of categoryLinks(element)) {
      expect(link.getAttribute('aria-current')).toBeNull();
    }
  });

  it('renders localized copy for the active culture', () => {
    const { element } = setup({ snapshot: successResource(categoryList()) });
    expect(element.querySelector('h1')?.textContent).toBe('Shop by category');

    TestBed.resetTestingModule();
    const french = setup({ snapshot: successResource(categoryList()), culture: 'fr' });

    expect(french.element.querySelector('h1')?.textContent).toBe('Acheter par catégorie');
    expect(french.element.querySelector('catalog-category-nav')).not.toBeNull();
  });
});

describe('CategoriesPage empty and error', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the localized empty state when no categories exist', () => {
    const { element } = setup({ snapshot: emptyResource<CategoryList>(categoryList()) });
    const empty = element.querySelector('flux-empty-state');

    expect(empty?.querySelector('.title')?.textContent).toBe('No categories yet');
    expect(empty?.querySelector('.message')?.textContent).toBe(
      'Check back soon — new categories are on the way.',
    );
    expect(element.querySelector('catalog-category-nav')).toBeNull();
  });

  it('renders the localized error state with retry', () => {
    const { fixture, element, loadCalls } = setup({
      snapshot: errorResource<CategoryList>(
        new ApiError({ status: 500, message: 'Server error.' }),
      ),
    });
    const error = element.querySelector('flux-error-state');

    expect(error).not.toBeNull();
    expect(error?.querySelector('.title')?.textContent).toBe('Categories unavailable');
    expect(error?.querySelector('.message')?.textContent).toBe('An unexpected error occurred.');
    expect(error?.querySelector('button.retry')).not.toBeNull();

    (error?.querySelector('button.retry') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(loadCalls).toHaveLength(2);
  });
});

describe('CategoriesPage product listing', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  const categoryId = '22222222-2222-2222-2222-222222222222';

  it('loads the listing for the selected category on init', () => {
    const { loadProductsCalls, clearProductsCalls } = setup({
      snapshot: successResource(categoryList()),
      categoryId,
    });

    expect(loadProductsCalls).toEqual([{ categoryId }]);
    expect(clearProductsCalls).toBe(0);
  });

  it('clears the listing with no selection instead of loading', () => {
    const { element, loadProductsCalls, clearProductsCalls } = setup({
      snapshot: successResource(categoryList()),
    });

    expect(loadProductsCalls).toEqual([]);
    expect(clearProductsCalls).toBe(1);
    expect(element.querySelector('catalog-product-grid')).toBeNull();
    expect(element.querySelector('#products-title')).toBeNull();
  });

  it('renders the grid with a localized result count on success', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: successResource(productList()),
      categoryId,
    });
    const cards = [...element.querySelectorAll('catalog-product-card')];

    expect(element.querySelector('#products-title')?.textContent).toBe('Products');
    expect(
      element.querySelector('section[aria-labelledby="products-title"] > p')?.textContent,
    ).toBe('2 products');
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.querySelector('h3')?.textContent)).toEqual(['Tee', 'Hoodie']);
  });

  it('renders the localized listing loading state', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: loadingResource<ProductList>(),
      categoryId,
    });

    expect(element.querySelector('catalog-product-grid')).toBeNull();
    expect(element.querySelector('#products-title')).not.toBeNull();
  });

  it('renders the localized listing empty state', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: emptyResource<ProductList>(productList()),
      categoryId,
    });
    const empty = element.querySelector(
      'section[aria-labelledby="products-title"] flux-empty-state',
    );

    expect(empty?.querySelector('.title')?.textContent).toBe('No products found');
    expect(empty?.querySelector('.message')?.textContent).toBe(
      'Try another category — new products arrive often.',
    );
    expect(element.querySelector('catalog-product-grid')).toBeNull();
  });

  it('renders the localized listing error state with retry', () => {
    const { fixture, element, loadProductsCalls } = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: errorResource<ProductList>(
        new ApiError({ status: 500, message: 'Server error.' }),
      ),
      categoryId,
    });
    const error = element.querySelector(
      'section[aria-labelledby="products-title"] flux-error-state',
    );

    expect(error?.querySelector('.title')?.textContent).toBe('Products unavailable');
    expect(error?.querySelector('.message')?.textContent).toBe('An unexpected error occurred.');

    (error?.querySelector('button.retry') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(loadProductsCalls).toEqual([{ categoryId }, { categoryId }]);
  });

  it('renders French listing copy for the active culture', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: successResource(productList()),
      categoryId,
      culture: 'fr',
    });

    expect(element.querySelector('#products-title')?.textContent).toBe('Produits');
  });
});
