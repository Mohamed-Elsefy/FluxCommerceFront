/**
 * Delegation tests for the Sub-Phase 5.1 `CatalogApiService`.
 *
 * `ApiClient` (the shared-lib HTTP boundary, already covered by `libs/api`
 * specs) is stubbed at its typed seam so these tests own the feature logic:
 * correct route templates from `CATALOG_ENDPOINTS`, correct `pathParams`
 * interpolation keys, query funneling through `toQueryParams`, envelope
 * passthrough without unwrapping, and request-options forwarding. Errors
 * propagate untouched — the service never catches.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiClient, ApiError, CATALOG_ENDPOINTS } from '@flux/api';
import { CatalogApiService } from './catalog-api.service';

interface ApiCalls {
  paths: string[];
  options: unknown[];
}

function setup(): { service: CatalogApiService; api: ApiClient; calls: ApiCalls } {
  const calls: ApiCalls = { paths: [], options: [] };
  const apiStub = {
    get: vi.fn((path: string, options: unknown = {}) => {
      calls.paths.push(path);
      calls.options.push(options);
      return of({ isSuccess: true, data: null });
    }),
  } as unknown as ApiClient;

  TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: apiStub }] });
  return { service: TestBed.inject(CatalogApiService), api: apiStub, calls };
}

describe('CatalogApiService routes', () => {
  it('reads a single product through the canonical route template', () => {
    const { service, calls } = setup();
    service.getProduct('prod-1').subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.getProduct.path]);
    expect(calls.options).toEqual([{ pathParams: { id: 'prod-1' } }]);
  });

  it('reads a single category through the canonical route template', () => {
    const { service, calls } = setup();
    service.getCategory('cat-1').subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.getCategory.path]);
    expect(calls.options).toEqual([{ pathParams: { id: 'cat-1' } }]);
  });

  it('lists products with paging funneled through query params', () => {
    const { service, calls } = setup();
    service.listProducts({ pageNumber: 2, pageSize: 10 }).subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.listProducts.path]);
    expect(calls.options).toEqual([{ params: { pageNumber: 2, pageSize: 10 } }]);
  });

  it('lists products with filters and sorting funneled through query params', () => {
    const { service, calls } = setup();
    service
      .listProducts({
        searchTerm: 'tee',
        categoryId: '22222222-2222-2222-2222-222222222222',
        status: 1,
        sortBy: 1,
        sortDirection: 1,
        pageNumber: 1,
        pageSize: 20,
      })
      .subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.listProducts.path]);
    expect(calls.options).toEqual([
      {
        params: {
          searchTerm: 'tee',
          categoryId: '22222222-2222-2222-2222-222222222222',
          status: 1,
          sortBy: 1,
          sortDirection: 1,
          pageNumber: 1,
          pageSize: 20,
        },
      },
    ]);
  });

  it('searches the storefront catalog with filters funneled through query params', () => {
    const { service, calls } = setup();
    service.searchCatalog({ searchTerm: 'tee', pageNumber: 1, pageSize: 20 }).subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.searchCatalog.path]);
    expect(calls.options).toEqual([{ params: { searchTerm: 'tee', pageNumber: 1, pageSize: 20 } }]);
  });

  it('lists categories with paging funneled through query params', () => {
    const { service, calls } = setup();
    service.listCategories({ pageNumber: 1, pageSize: 20 }).subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.listCategories.path]);
    expect(calls.options).toEqual([{ params: { pageNumber: 1, pageSize: 20 } }]);
  });
});

describe('CatalogApiService passthrough', () => {
  it('passes envelopes through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: { items: [], totalCount: 0, pageNumber: 1, pageSize: 20 },
    };
    vi.mocked(api.get).mockReturnValueOnce(of(envelope));
    let observed: unknown;
    service.searchCatalog({}).subscribe((result) => {
      observed = result;
    });

    expect(observed).toBe(envelope);
  });

  it('propagates failures untouched for feature state to normalize', () => {
    const { service, api } = setup();
    const rejection = new ApiError({ status: 404, message: 'Not found.' });
    vi.mocked(api.get).mockReturnValueOnce(throwError(() => rejection));
    let observed: unknown;
    service.getProduct('missing').subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBe(rejection);
  });

  it('forwards request options (e.g. cancellation signal) to ApiClient', () => {
    const { service, calls } = setup();
    const controller = new AbortController();
    service
      .listProducts({ pageNumber: 1, pageSize: 20 }, { signal: controller.signal })
      .subscribe();

    expect(calls.options[0]).toMatchObject({ signal: controller.signal });
  });
});
