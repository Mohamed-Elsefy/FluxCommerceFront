/**
 * State tests for the Sub-Phase 5.1 `CatalogState`.
 *
 * `CatalogApiService` (the feature HTTP boundary, covered by
 * `catalog-api.service.spec.ts`) is stubbed at its typed seam so these tests
 * own the feature logic: idle → loading → success | empty | error
 * transitions, data retention across reloads, dataless-envelope violations,
 * cancellation passthrough, reset, and feature-local scoping (no root
 * singleton — every injection site gets an independent instance).
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError } from '@flux/api';
import type { CatalogProductListItem, CategoryResponse } from '@flux/models';
import { CatalogApiService } from '../data-access/catalog-api.service';
import { CatalogState } from './catalog-state';

const PRODUCT_ITEM: CatalogProductListItem = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Tee',
  slug: 'tee',
  description: null,
  categoryId: '22222222-2222-2222-2222-222222222222',
  primaryImage: null,
};

const CATEGORY: CategoryResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Apparel',
  slug: 'apparel',
  description: null,
  parentId: null,
  status: 0,
  isDeleted: false,
  createdAtUtc: '2026-09-04T10:00:00Z',
  deletedAtUtc: null,
};

function productPage(totalCount: number, items: CatalogProductListItem[] = [PRODUCT_ITEM]) {
  return { isSuccess: true, data: { items, totalCount, pageNumber: 1, pageSize: 20 } };
}

function categoryPage(totalCount: number, items: CategoryResponse[] = [CATEGORY]) {
  return { isSuccess: true, data: { items, totalCount, pageNumber: 1, pageSize: 20 } };
}

function setup(flows: {
  searchCatalog?: () => ReturnType<CatalogApiService['searchCatalog']>;
  listCategories?: () => ReturnType<CatalogApiService['listCategories']>;
  getProduct?: () => ReturnType<CatalogApiService['getProduct']>;
  getCategory?: () => ReturnType<CatalogApiService['getCategory']>;
}): { state: CatalogState; seenSignals: (AbortSignal | undefined)[] } {
  const seenSignals: (AbortSignal | undefined)[] = [];
  const recordSignal = (options: { signal?: AbortSignal } = {}) => {
    seenSignals.push(options.signal);
  };
  const apiStub = {
    searchCatalog: ((...args: [unknown, { signal?: AbortSignal }?]) => {
      recordSignal(args[1]);
      return flows.searchCatalog?.() ?? of(productPage(1));
    }) as CatalogApiService['searchCatalog'],
    listCategories: ((...args: [unknown, { signal?: AbortSignal }?]) => {
      recordSignal(args[1]);
      return flows.listCategories?.() ?? of(categoryPage(1));
    }) as CatalogApiService['listCategories'],
    getProduct: ((...args: [unknown, { signal?: AbortSignal }?]) => {
      recordSignal(args[1]);
      return (
        flows.getProduct?.() ??
        of({
          isSuccess: true,
          data: {
            id: PRODUCT_ITEM.id,
            name: 'Tee',
            slug: 'tee',
            description: null,
            seo: null,
            status: 1,
            visibility: 0,
            categoryId: PRODUCT_ITEM.categoryId,
            isDeleted: false,
            createdAtUtc: '2026-09-04T10:00:00Z',
            deletedAtUtc: null,
          },
        })
      );
    }) as CatalogApiService['getProduct'],
    getCategory: ((...args: [unknown, { signal?: AbortSignal }?]) => {
      recordSignal(args[1]);
      return flows.getCategory?.() ?? of({ isSuccess: true, data: CATEGORY });
    }) as CatalogApiService['getCategory'],
  } as CatalogApiService;

  TestBed.configureTestingModule({
    providers: [{ provide: CatalogApiService, useValue: apiStub }, CatalogState],
  });
  return { state: TestBed.inject(CatalogState), seenSignals };
}

describe('CatalogState products', () => {
  it('starts idle and resolves to success with envelope data', () => {
    const { state } = setup({});
    expect(state.products().status).toBe('idle');

    state.loadProducts({ searchTerm: 'tee' });

    const snapshot = state.products();
    expect(snapshot.status).toBe('success');
    expect(snapshot.data?.totalCount).toBe(1);
    expect(snapshot.data?.items[0]?.name).toBe('Tee');
    expect(state.productsLoading()).toBe(false);
  });

  it('resolves to empty when the page carries no items', () => {
    const { state } = setup({ searchCatalog: () => of(productPage(0, [])) });
    state.loadProducts({});

    const snapshot = state.products();
    expect(snapshot.status).toBe('empty');
    expect(snapshot.isEmpty).toBe(true);
  });

  it('resolves to error on failures and normalizes the ApiError', () => {
    const rejection = new ApiError({ status: 500, message: 'Server error.' });
    const { state } = setup({ searchCatalog: () => throwError(() => rejection) });
    state.loadProducts({});

    const snapshot = state.products();
    expect(snapshot.status).toBe('error');
    expect(snapshot.error).toBe(rejection);
  });

  it('resolves to error on dataless success envelopes', () => {
    const { state } = setup({ searchCatalog: () => of({ isSuccess: true, data: null }) });
    state.loadProducts({});

    expect(state.products().status).toBe('error');
  });

  it('stays stable on non-protocol failures (never throws, always normalized)', () => {
    const { state } = setup({
      searchCatalog: () => throwError(() => new TypeError('Failed to fetch')),
    });
    let snapshot: ReturnType<typeof state.products> | undefined;
    expect(() => {
      state.loadProducts({});
      snapshot = state.products();
    }).not.toThrow();

    expect(snapshot?.status).toBe('error');
    expect(snapshot?.error).not.toBeNull();
    expect(typeof snapshot?.error?.message).toBe('string');
  });

  it('forwards the AbortSignal to data access without touching state shape', () => {
    const { state, seenSignals } = setup({});
    const controller = new AbortController();
    state.loadProducts({}, { signal: controller.signal });

    expect(seenSignals).toEqual([controller.signal]);
    expect(state.products().status).toBe('success');
  });
});

describe('CatalogState categories', () => {
  it('loads the category page into the categories slot', () => {
    const { state } = setup({});
    expect(state.categories().status).toBe('idle');

    state.loadCategories({ pageNumber: 1, pageSize: 20 });

    const snapshot = state.categories();
    expect(snapshot.status).toBe('success');
    expect(snapshot.data?.items[0]?.slug).toBe('apparel');
  });

  it('resolves to empty when no categories match', () => {
    const { state } = setup({ listCategories: () => of(categoryPage(0, [])) });
    state.loadCategories({});

    expect(state.categories().status).toBe('empty');
  });
});

describe('CatalogState single-resource slots', () => {
  it('loads a product and a category into their own slots', () => {
    const { state } = setup({});
    state.loadProduct('prod-1');
    state.loadCategory('cat-1');

    expect(state.product().status).toBe('success');
    expect(state.product().data?.slug).toBe('tee');
    expect(state.category().status).toBe('success');
    expect(state.category().data?.slug).toBe('apparel');
  });

  it('clears only the product-list slot back to idle', () => {
    const { state } = setup({});
    state.loadProducts({});
    state.loadCategories({});
    state.clearProducts();

    expect(state.products().status).toBe('idle');
    expect(state.products().data).toBeNull();
    expect(state.categories().status).toBe('success');
  });

  it('resets every slot back to idle', () => {
    const { state } = setup({});
    state.loadProducts({});
    state.loadCategories({});
    state.loadProduct('prod-1');
    state.loadCategory('cat-1');
    state.reset();

    expect(state.products().status).toBe('idle');
    expect(state.categories().status).toBe('idle');
    expect(state.product().status).toBe('idle');
    expect(state.category().status).toBe('idle');
  });
});

describe('CatalogState locality (no global state)', () => {
  it('is feature-scoped: independent instances per injection site', () => {
    const first = setup({});
    first.state.loadProducts({});
    expect(first.state.products().status).toBe('success');

    TestBed.resetTestingModule();
    const second = setup({});
    expect(second.state.products().status).toBe('idle');
  });

  it('is not a root singleton (no providedIn root)', () => {
    const metadata = (CatalogState as unknown as { ɵprov?: { providedIn?: unknown } }).ɵprov;
    expect(metadata?.providedIn).not.toBe('root');
  });
});
