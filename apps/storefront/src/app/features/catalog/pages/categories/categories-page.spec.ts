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
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject, of } from 'rxjs';
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
import { CatalogApiService } from '../../data-access/catalog-api.service';
import { CatalogState } from '../../state/catalog-state';
import type { CategoryList, ProductList, ProductListItem } from '../../models/catalog.models';
import { CategoriesPage, CATEGORY_NAV_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from './categories-page';

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
  routeQuery?: Record<string, string>;
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
        ...(options.routeQuery ?? {}),
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

    expect(loadProductsCalls).toEqual([{ categoryId, pageNumber: 1, pageSize: 20 }]);
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

  it('renders the no-products empty state for a bare category scope', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: emptyResource<ProductList>(productList()),
      categoryId,
    });
    const empty = element.querySelector(
      'section[aria-labelledby="products-title"] flux-empty-state',
    );

    expect(empty?.querySelector('.title')?.textContent).toBe('No products here yet');
    expect(empty?.querySelector('.message')?.textContent).toBe(
      'There are no products in Apparel yet.',
    );
    expect(element.querySelector('catalog-product-grid')).toBeNull();
  });

  it('falls back to a generic noun when the category name is unknown', () => {
    const { element } = setup({
      snapshot: emptyResource<CategoryList>({ ...categoryList(), items: [], totalCount: 0 }),
      productsSnapshot: emptyResource<ProductList>(productList()),
      categoryId,
    });
    const empty = element.querySelector(
      'section[aria-labelledby="products-title"] flux-empty-state',
    );

    expect(empty?.querySelector('.message')?.textContent).toBe(
      'There are no products in this category yet.',
    );
  });

  it('renders the no-results empty state for active search criteria', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: emptyResource<ProductList>(productList()),
      categoryId,
      routeQuery: { searchTerm: 'zzz-no-match' },
    });
    const empty = element.querySelector(
      'section[aria-labelledby="products-title"] flux-empty-state',
    );

    expect(empty?.querySelector('.title')?.textContent).toBe('No matching products');
    expect(empty?.querySelector('.message')?.textContent).toBe(
      'Try a different search or clear some filters.',
    );
  });

  it('renders the no-results empty state for active filter and sort criteria', () => {
    const filtered = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: emptyResource<ProductList>(productList()),
      categoryId,
      routeQuery: { status: '1' },
    });
    expect(
      filtered.element.querySelector(
        'section[aria-labelledby="products-title"] flux-empty-state .title',
      )?.textContent,
    ).toBe('No matching products');

    TestBed.resetTestingModule();
    const sorted = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: emptyResource<ProductList>(productList()),
      categoryId,
      routeQuery: { sortBy: 'Name', sortDirection: 'Ascending' },
    });
    expect(
      sorted.element.querySelector(
        'section[aria-labelledby="products-title"] flux-empty-state .title',
      )?.textContent,
    ).toBe('No matching products');
  });

  it('localizes the no-results empty state for the active culture', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: emptyResource<ProductList>(productList()),
      categoryId,
      routeQuery: { searchTerm: 'zzz' },
      culture: 'fr',
    });
    const empty = element.querySelector(
      'section[aria-labelledby="products-title"] flux-empty-state',
    );

    expect(empty?.querySelector('.title')?.textContent).toBe('Aucun produit correspondant');
    expect(empty?.querySelector('.message')?.textContent).toBe(
      'Essayez une autre recherche ou retirez certains filtres.',
    );
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

    expect(loadProductsCalls).toEqual([
      { categoryId, pageNumber: 1, pageSize: 20 },
      { categoryId, pageNumber: 1, pageSize: 20 },
    ]);
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

  it('preserves paging and search/sort route state in listing requests', () => {
    const { loadProductsCalls } = setup({
      snapshot: successResource(categoryList()),
      categoryId,
      routeQuery: {
        searchTerm: 'tee',
        sortBy: 'Name',
        sortDirection: 'Descending',
        pageNumber: '3',
      },
    });

    expect(loadProductsCalls).toEqual([
      {
        searchTerm: 'tee',
        categoryId,
        sortBy: 0,
        sortDirection: 1,
        pageNumber: 3,
        pageSize: 20,
      },
    ]);
  });

  it('ignores garbage route values and loads with field defaults', () => {
    const { loadProductsCalls } = setup({
      snapshot: successResource(categoryList()),
      categoryId,
      routeQuery: { pageNumber: 'zero', sortBy: 'Price' },
    });

    expect(loadProductsCalls).toEqual([{ categoryId, pageNumber: 1, pageSize: 20 }]);
  });
});

describe('CategoriesPage listing effect stability (regression)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Regression test with the REAL `CatalogState` (the unit stub above
   * records calls without touching signals, so it cannot exhibit effect
   * dependency loops). Settled product results must not reschedule the
   * listing effect — otherwise every response refires a request forever.
   */
  it('fetches the listing exactly once per selection with live state', () => {
    const searchCalls: unknown[] = [];
    const apiStub = {
      searchCatalog: ((query: unknown) => {
        searchCalls.push(query);
        return of({ isSuccess: true, data: productList() });
      }) as CatalogApiService['searchCatalog'],
      listCategories: (() =>
        of({ isSuccess: true, data: categoryList() })) as CatalogApiService['listCategories'],
    } as unknown as CatalogApiService;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CatalogApiService, useValue: apiStub },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(
              convertToParamMap({ categoryId: '22222222-2222-2222-2222-222222222222' }),
            ),
          },
        },
        CatalogState,
      ],
    });
    window.localStorage.clear();
    TestBed.inject(CultureService).setCulture('en');
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();

    // Flush any scheduled effect re-runs: a dependency loop would refire
    // the listing effect (and its HTTP request) on every flush.
    fixture.detectChanges();
    fixture.detectChanges();
    fixture.detectChanges();

    expect(searchCalls).toHaveLength(1);
    expect(TestBed.inject(CatalogState).products().status).toBe('success');
    expect(TestBed.inject(CatalogState).products().data?.items).toHaveLength(2);
  });
});

describe('CategoriesPage search (5.5)', () => {
  const categoryId = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // Real timers: the runner is zoneless (`zone-testing` is unavailable, so
  // no `fakeAsync`); RxJS `debounceTime` runs on plain `setTimeout`.
  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  it('renders the localized search field bound to the committed query', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      categoryId,
      routeQuery: { searchTerm: 'tee' },
    });
    const field = element.querySelector('catalog-search-input');

    expect(field?.querySelector('.search-label')?.textContent).toBe('Search products');
    expect(field?.querySelector('input')?.getAttribute('placeholder')).toBe('Search by keyword…');
    // Controlled input echoes the committed (URL) text, not raw keystrokes.
    expect((field?.querySelector('input') as HTMLInputElement | null)?.value).toBe('tee');
  });

  it('debounces keystrokes into a single query commit', async () => {
    const { fixture } = setup({ snapshot: successResource(categoryList()), categoryId });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const page = fixture.componentInstance;

    page.onSearchChange('t');
    await sleep(100);
    page.onSearchChange('te');
    await sleep(100);
    page.onSearchChange('tee');
    await sleep(SEARCH_DEBOUNCE_MS + 100);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/catalog'], {
      queryParams: { searchTerm: 'tee', categoryId, pageNumber: 1, pageSize: 20 },
      replaceUrl: true,
    });
  });

  it('ignores repeated identical commits', async () => {
    const { fixture } = setup({ snapshot: successResource(categoryList()), categoryId });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const page = fixture.componentInstance;

    page.onSearchChange('tee');
    await sleep(SEARCH_DEBOUNCE_MS + 100);
    page.onSearchChange('tee');
    await sleep(SEARCH_DEBOUNCE_MS + 100);

    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('resets to the first page while preserving the category on search', async () => {
    const { fixture } = setup({
      snapshot: successResource(categoryList()),
      categoryId,
      routeQuery: { pageNumber: '3' },
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture.componentInstance.onSearchChange('tee');
    await sleep(SEARCH_DEBOUNCE_MS + 100);

    expect(navigate).toHaveBeenCalledWith(['/catalog'], {
      queryParams: { searchTerm: 'tee', categoryId, pageNumber: 1, pageSize: 20 },
      replaceUrl: true,
    });
  });

  it('drops the search key on clear, restoring the normal listing', async () => {
    const { fixture } = setup({
      snapshot: successResource(categoryList()),
      categoryId,
      routeQuery: { searchTerm: 'tee' },
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const page = fixture.componentInstance;

    page.onSearchChange('te');
    await sleep(SEARCH_DEBOUNCE_MS + 100);
    page.onSearchChange('');
    await sleep(SEARCH_DEBOUNCE_MS + 100);

    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenLastCalledWith(['/catalog'], {
      queryParams: { categoryId, pageNumber: 1, pageSize: 20 },
      replaceUrl: true,
    });
  });

  it('loads the listing for search text without a category', () => {
    const { element, loadProductsCalls } = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: successResource(productList()),
      routeQuery: { searchTerm: 'tee' },
    });

    expect(loadProductsCalls).toEqual([{ searchTerm: 'tee', pageNumber: 1, pageSize: 20 }]);
    expect(element.querySelector('catalog-product-grid')).not.toBeNull();
  });

  it('aborts the superseded listing request on query change', () => {
    const params = new BehaviorSubject(
      convertToParamMap({ categoryId: '22222222-2222-2222-2222-222222222222' }),
    );
    const seen: { query: unknown; signal?: AbortSignal }[] = [];
    const stateStub = {
      categories: signal(successResource(categoryList())),
      products: signal(idleResource<ProductList>()),
      loadCategories: (() => undefined) as unknown as CatalogState['loadCategories'],
      loadProducts: ((query: unknown, options: { signal?: AbortSignal } = {}) => {
        seen.push({ query, signal: options.signal });
      }) as CatalogState['loadProducts'],
      clearProducts: (() => undefined) as unknown as CatalogState['clearProducts'],
    } as unknown as CatalogState;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CatalogState, useValue: stateStub },
        { provide: ActivatedRoute, useValue: { queryParamMap: params.asObservable() } },
      ],
    });
    window.localStorage.clear();
    TestBed.inject(CultureService).setCulture('en');
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();

    params.next(
      convertToParamMap({
        categoryId: '22222222-2222-2222-2222-222222222222',
        searchTerm: 'tee',
      }),
    );
    fixture.detectChanges();
    fixture.detectChanges();

    expect(seen).toHaveLength(2);
    expect(seen[0]?.signal?.aborted).toBe(true);
    expect(seen[1]?.signal?.aborted).toBe(false);
    expect(seen[1]?.query).toMatchObject({ searchTerm: 'tee' });
  });
});

describe('CategoriesPage filtering and sorting (5.6)', () => {
  const categoryId = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function selects(element: HTMLElement): HTMLSelectElement[] {
    return [...element.querySelectorAll('catalog-filter-select select')].map(
      (select) => select as HTMLSelectElement,
    );
  }

  function choose(element: HTMLElement, index: number, value: string): void {
    const boxes = selects(element);
    const box = boxes[index];
    if (box === undefined) {
      throw new Error(`Filter select ${index} did not render`);
    }
    box.value = value;
    box.dispatchEvent(new Event('change'));
  }

  it('renders backend-faithful filter and sort controls with reset options', () => {
    const { element } = setup({ snapshot: successResource(categoryList()), categoryId });
    const boxes = selects(element);

    expect(boxes).toHaveLength(3);
    expect([...boxes[0]?.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      'All',
      'Draft',
      'Active',
      'Inactive',
      'Archived',
    ]);
    expect([...boxes[1]?.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      'All',
      'Visible',
      'Hidden',
    ]);
    expect([...boxes[2]?.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      'Default',
      'Name (A–Z)',
      'Name (Z–A)',
      'Newest first',
      'Oldest first',
    ]);
  });

  it('offers no price or availability controls (not in the contract)', () => {
    const { element } = setup({ snapshot: successResource(categoryList()), categoryId });
    const labels = [...element.querySelectorAll('.catalog-filters')].map(
      (node) => node.textContent ?? '',
    );

    expect(element.querySelectorAll('catalog-filter-select')).toHaveLength(3);
    for (const text of labels) {
      expect(text.toLowerCase()).not.toContain('price');
    }
  });

  it('commits a status filter with page reset, preserving the category', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      categoryId,
      routeQuery: { pageNumber: '3' },
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    choose(element, 0, '1');

    expect(navigate).toHaveBeenCalledWith(['/catalog'], {
      queryParams: { categoryId, status: 1, pageNumber: 1, pageSize: 20 },
      replaceUrl: true,
    });
  });

  it('commits a visibility filter with page reset', () => {
    const { element } = setup({ snapshot: successResource(categoryList()), categoryId });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    choose(element, 1, '1');

    expect(navigate).toHaveBeenCalledWith(['/catalog'], {
      queryParams: { categoryId, visibility: 1, pageNumber: 1, pageSize: 20 },
      replaceUrl: true,
    });
  });

  it('commits a sort selection with page reset', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      categoryId,
      routeQuery: { pageNumber: '2' },
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    choose(element, 2, '1:1');

    expect(navigate).toHaveBeenCalledWith(['/catalog'], {
      queryParams: {
        categoryId,
        sortBy: 1,
        sortDirection: 1,
        pageNumber: 1,
        pageSize: 20,
      },
      replaceUrl: true,
    });
  });

  it('treats unknown select tokens as cleared dimensions', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      categoryId,
      routeQuery: { status: '1' },
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    choose(element, 0, 'bogus');

    expect(navigate).toHaveBeenCalledWith(['/catalog'], {
      queryParams: { categoryId, pageNumber: 1, pageSize: 20 },
      replaceUrl: true,
    });
  });

  it('hides clear-all by default and resets filters/sort through it', () => {
    const plain = setup({ snapshot: successResource(categoryList()), categoryId });
    expect(plain.element.querySelector('button.filters-clear')).toBeNull();

    TestBed.resetTestingModule();
    const { element } = setup({
      snapshot: successResource(categoryList()),
      categoryId,
      routeQuery: { searchTerm: 'tee', status: '1', sortBy: 'Name', sortDirection: 'Ascending' },
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const clear = element.querySelector('button.filters-clear') as HTMLButtonElement | null;

    expect(clear?.textContent?.trim()).toBe('Clear all filters');
    clear?.click();

    // Filters and sort drop; search and category keep their affordances.
    expect(navigate).toHaveBeenCalledWith(['/catalog'], {
      queryParams: { searchTerm: 'tee', categoryId, pageNumber: 1, pageSize: 20 },
      replaceUrl: true,
    });
  });

  it('loads the listing for a filter-only deep link', () => {
    const { element, loadProductsCalls } = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: successResource(productList()),
      routeQuery: { status: '1' },
    });

    expect(loadProductsCalls).toEqual([{ status: 1, pageNumber: 1, pageSize: 20 }]);
    expect(element.querySelector('catalog-product-grid')).not.toBeNull();
  });

  it('reflects committed filters and sort in French controls', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      culture: 'fr',
      routeQuery: { status: '1', sortBy: '0', sortDirection: '1' },
    });
    const boxes = selects(element);

    expect(boxes[0]?.value).toBe('1');
    expect(boxes[2]?.value).toBe('0:1');
    expect([...boxes[2]?.querySelectorAll('option')].map((option) => option.textContent)).toContain(
      'Plus récents',
    );
  });
});

describe('CategoriesPage pagination (5.7)', () => {
  const categoryId = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function pagedList(pageNumber: number, totalCount: number): ProductList {
    return { ...productList(), pageNumber, totalCount, pageSize: 20 };
  }

  function pagerButtons(element: HTMLElement): HTMLButtonElement[] {
    return [...element.querySelectorAll('catalog-product-pagination nav button')].map(
      (button) => button as HTMLButtonElement,
    );
  }

  it('renders the pager from response-effective values', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: successResource(pagedList(1, 45)),
      categoryId,
    });
    const pager = element.querySelector('catalog-product-pagination nav');

    expect(pager?.getAttribute('aria-label')).toBe('Product pages');
    expect(pagerButtons(element).map((button) => button.textContent?.trim())).toEqual([
      'First',
      'Previous',
      '1',
      '2',
      '3',
      'Next',
      'Last',
    ]);
  });

  it('hides the pager for single-page results', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: successResource(productList()),
      categoryId,
    });

    expect(element.querySelector('catalog-product-grid')).not.toBeNull();
    expect(element.querySelector('catalog-product-pagination nav')).toBeNull();
  });

  it('preserves the full query across page navigation', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: successResource(pagedList(1, 45)),
      categoryId,
      routeQuery: {
        searchTerm: 'tee',
        status: '1',
        sortBy: 'Name',
        sortDirection: 'Descending',
        pageNumber: '1',
      },
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const next = pagerButtons(element).find((button) => button.textContent?.trim() === '2');

    next?.click();

    expect(navigate).toHaveBeenCalledWith(['/catalog'], {
      queryParams: {
        searchTerm: 'tee',
        categoryId,
        status: 1,
        sortBy: 0,
        sortDirection: 1,
        pageNumber: 2,
        pageSize: 20,
      },
      replaceUrl: true,
    });
  });

  it('renders the effective page, not the requested one', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: successResource(pagedList(2, 45)),
      categoryId,
      routeQuery: { pageNumber: '5' },
    });
    const current = pagerButtons(element).find(
      (button) => button.getAttribute('aria-current') === 'page',
    );

    expect(current?.textContent?.trim()).toBe('2');
  });

  it('handles out-of-range pages with an empty state and no crash', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: emptyResource<ProductList>({
        items: [],
        totalCount: 2,
        pageNumber: 99,
        pageSize: 20,
      }),
      categoryId,
      routeQuery: { pageNumber: '99' },
    });

    expect(
      element.querySelector('section[aria-labelledby="products-title"] flux-empty-state'),
    ).not.toBeNull();
    expect(element.querySelector('catalog-product-pagination nav')).toBeNull();
  });

  it('localizes pager controls for the active culture', () => {
    const { element } = setup({
      snapshot: successResource(categoryList()),
      productsSnapshot: successResource(pagedList(1, 45)),
      categoryId,
      culture: 'fr',
    });
    const pager = element.querySelector('catalog-product-pagination nav');

    expect(pager?.getAttribute('aria-label')).toBe('Pages de produits');
    expect(pagerButtons(element)[0]?.textContent?.trim()).toBe('Première');
  });
});
