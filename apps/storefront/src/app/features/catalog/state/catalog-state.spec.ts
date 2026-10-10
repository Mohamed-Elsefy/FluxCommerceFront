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
import { PLATFORM_ID, TransferState } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError } from '@flux/api';
import type { CatalogProductListItem, CategoryResponse, ProductResponse } from '@flux/models';
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

function listedPage(totalCount: number, items: ProductResponse[]) {
  return { isSuccess: true, data: { items, totalCount, pageNumber: 1, pageSize: 20 } };
}

function categoryPage(totalCount: number, items: CategoryResponse[] = [CATEGORY]) {
  return { isSuccess: true, data: { items, totalCount, pageNumber: 1, pageSize: 20 } };
}

function setup(flows: {
  searchCatalog?: () => ReturnType<CatalogApiService['searchCatalog']>;
  listProducts?: () => ReturnType<CatalogApiService['listProducts']>;
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
    listProducts: ((...args: [unknown, { signal?: AbortSignal }?]) => {
      recordSignal(args[1]);
      return flows.listProducts?.() ?? of(productPage(1));
    }) as CatalogApiService['listProducts'],
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

  it('loads full product records with images through listProducts', () => {
    const full: ProductResponse = {
      ...PRODUCT_ITEM,
      seo: null,
      status: 1,
      visibility: 0,
      isDeleted: false,
      createdAtUtc: '2026-09-04T10:00:00Z',
      deletedAtUtc: null,
      primaryImage: {
        id: 'img-1',
        imageUrl: '/cdn/tee.jpg',
        altText: 'Tee',
        displayOrder: 0,
        isPrimary: true,
      },
    };
    const { state } = setup({
      listProducts: () => of(listedPage(1, [full])),
    });
    state.loadListedProducts({ searchTerm: 'tee' });

    const snapshot = state.products();
    expect(snapshot.status).toBe('success');
    expect(snapshot.data?.items[0]).toMatchObject({ status: 1 });
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

describe('CatalogState transfer state (5.10 hydration)', () => {
  const QUERY = { categoryId: '22222222-2222-2222-2222-222222222222' };
  const PAGE = {
    items: [PRODUCT_ITEM],
    totalCount: 1,
    pageNumber: 1,
    pageSize: 20,
  };

  interface TransferHarness {
    state: CatalogState;
    transfer: TransferState;
    apiCalls: unknown[];
  }

  /**
   * Builds an isolated state on the given platform. Sharing one
   * `TransferState` instance across a server/client pair simulates the
   * serialized HTML transfer (payloads are JSON-safe by contract).
   */
  function setupTransfer(options: {
    platform?: 'browser' | 'server';
    transfer?: TransferState;
    searchCatalog?: () => ReturnType<CatalogApiService['searchCatalog']>;
    listCategories?: () => ReturnType<CatalogApiService['listCategories']>;
  }): TransferHarness {
    const apiCalls: unknown[] = [];
    const apiStub = {
      searchCatalog: ((query: unknown) => {
        apiCalls.push(query);
        return options.searchCatalog?.() ?? of({ isSuccess: true, data: PAGE });
      }) as CatalogApiService['searchCatalog'],
      listCategories: ((query: unknown) => {
        apiCalls.push(query);
        return (
          options.listCategories?.() ??
          of({ isSuccess: true, data: { ...PAGE, items: [CATEGORY] } })
        );
      }) as CatalogApiService['listCategories'],
    } as CatalogApiService;

    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogApiService, useValue: apiStub },
        ...(options.transfer === undefined
          ? []
          : [{ provide: TransferState, useValue: options.transfer }]),
        ...(options.platform === undefined || options.platform === 'browser'
          ? []
          : [{ provide: PLATFORM_ID, useValue: 'server' }]),
        CatalogState,
      ],
    });
    return {
      state: TestBed.inject(CatalogState),
      transfer: TestBed.inject(TransferState),
      apiCalls,
    };
  }

  it('reuses server-rendered products on the client without refetching', () => {
    const server = setupTransfer({ platform: 'server' });
    server.state.loadProducts(QUERY);
    expect(server.state.products().status).toBe('success');
    expect(server.apiCalls).toHaveLength(1);
    TestBed.resetTestingModule();

    const client = setupTransfer({ transfer: server.transfer });
    client.state.loadProducts(QUERY);

    expect(client.apiCalls).toHaveLength(0);
    expect(client.state.products().status).toBe('success');
    expect(client.state.products().data).toEqual(PAGE);
  });

  it('reuses server-rendered categories on the client without refetching', () => {
    const server = setupTransfer({ platform: 'server' });
    server.state.loadCategories({ pageNumber: 1, pageSize: 100 });
    expect(server.state.categories().status).toBe('success');
    TestBed.resetTestingModule();

    const client = setupTransfer({ transfer: server.transfer });
    client.state.loadCategories({ pageNumber: 1, pageSize: 100 });

    expect(client.apiCalls).toHaveLength(0);
    expect(client.state.categories().status).toBe('success');
    expect(client.state.categories().data?.items).toEqual([CATEGORY]);
  });

  it('fetches live on transfer miss (different query)', () => {
    const server = setupTransfer({ platform: 'server' });
    server.state.loadProducts(QUERY);
    TestBed.resetTestingModule();

    const client = setupTransfer({ transfer: server.transfer });
    client.state.loadProducts({ ...QUERY, searchTerm: 'other' });

    expect(client.apiCalls).toHaveLength(1);
    expect(client.state.products().status).toBe('success');
  });

  it('consumes transfers once (second identical load refetches)', () => {
    const server = setupTransfer({ platform: 'server' });
    server.state.loadProducts(QUERY);
    TestBed.resetTestingModule();

    const client = setupTransfer({ transfer: server.transfer });
    client.state.loadProducts(QUERY);
    expect(client.apiCalls).toHaveLength(0);

    client.state.loadProducts(QUERY);
    expect(client.apiCalls).toHaveLength(1);
  });

  it('never stores server failures (the client retries live)', () => {
    const rejection = new ApiError({ status: 500, message: 'Server error.' });
    const server = setupTransfer({
      platform: 'server',
      searchCatalog: () => throwError(() => rejection),
    });
    server.state.loadProducts(QUERY);
    expect(server.state.products().status).toBe('error');
    TestBed.resetTestingModule();

    const client = setupTransfer({ transfer: server.transfer });
    client.state.loadProducts(QUERY);

    expect(client.apiCalls).toHaveLength(1);
    expect(client.state.products().status).toBe('success');
  });
});
