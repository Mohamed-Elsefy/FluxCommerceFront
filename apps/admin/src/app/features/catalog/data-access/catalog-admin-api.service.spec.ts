/**
 * Delegation tests for the Sub-Phase 13.2 `CatalogAdminApiService`.
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
import { CatalogAdminApiService } from './catalog-admin-api.service';

interface ApiCalls {
  paths: string[];
  options: unknown[];
}

function setup(): {
  service: CatalogAdminApiService;
  api: ApiClient;
  calls: ApiCalls;
  posts: { paths: string[]; bodies: unknown[]; options: unknown[] };
  puts: { paths: string[]; bodies: unknown[]; options: unknown[] };
} {
  const calls: ApiCalls = { paths: [], options: [] };
  const posts = { paths: [] as string[], bodies: [] as unknown[], options: [] as unknown[] };
  const puts = { paths: [] as string[], bodies: [] as unknown[], options: [] as unknown[] };
  const apiStub = {
    get: vi.fn((path: string, options: unknown = {}) => {
      calls.paths.push(path);
      calls.options.push(options);
      return of({ isSuccess: true, data: null });
    }),
    post: vi.fn((path: string, body: unknown, options: unknown = {}) => {
      posts.paths.push(path);
      posts.bodies.push(body);
      posts.options.push(options);
      return of({ isSuccess: true, data: 'new-id' });
    }),
    put: vi.fn((path: string, body: unknown, options: unknown = {}) => {
      puts.paths.push(path);
      puts.bodies.push(body);
      puts.options.push(options);
      return of(undefined);
    }),
  } as unknown as ApiClient;

  TestBed.configureTestingModule({
    providers: [CatalogAdminApiService, { provide: ApiClient, useValue: apiStub }],
  });
  return { service: TestBed.inject(CatalogAdminApiService), api: apiStub, calls, posts, puts };
}

describe('CatalogAdminApiService routes', () => {
  it('lists products with paging funneled through query params', () => {
    const { service, calls } = setup();
    service.listProducts({ pageNumber: 1, pageSize: 1 }).subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.listProducts.path]);
    expect(calls.options).toEqual([{ params: { pageNumber: 1, pageSize: 1 } }]);
  });

  it('reads a single product through the canonical route template', () => {
    const { service, calls } = setup();
    service.getProduct('prod-1').subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.getProduct.path]);
    expect(calls.options).toEqual([{ pathParams: { id: 'prod-1' } }]);
  });

  it('lists categories with paging funneled through query params', () => {
    const { service, calls } = setup();
    service.listCategories({ pageNumber: 1, pageSize: 20 }).subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.listCategories.path]);
    expect(calls.options).toEqual([{ params: { pageNumber: 1, pageSize: 20 } }]);
  });

  it('reads a single category through the canonical route template', () => {
    const { service, calls } = setup();
    service.getCategory('cat-1').subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.getCategory.path]);
    expect(calls.options).toEqual([{ pathParams: { id: 'cat-1' } }]);
  });

  it('searches the catalog with filters funneled through query params', () => {
    const { service, calls } = setup();
    service.searchCatalog({ searchTerm: 'tee', pageNumber: 1, pageSize: 20 }).subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.searchCatalog.path]);
    expect(calls.options).toEqual([{ params: { searchTerm: 'tee', pageNumber: 1, pageSize: 20 } }]);
  });
});

describe('CatalogAdminApiService passthrough', () => {
  it('passes envelopes through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: { items: [], totalCount: 0, pageNumber: 1, pageSize: 1 },
    };
    vi.mocked(api.get).mockReturnValueOnce(of(envelope));
    let observed: unknown;
    service.listProducts({ pageNumber: 1, pageSize: 1 }).subscribe((result) => {
      observed = result;
    });

    expect(observed).toBe(envelope);
  });

  it('propagates failures untouched for feature state to normalize', () => {
    const { service, api } = setup();
    const rejection = new ApiError({ status: 403, message: 'Forbidden.' });
    vi.mocked(api.get).mockReturnValueOnce(throwError(() => rejection));
    let observed: unknown;
    service.getProduct('prod-1').subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBe(rejection);
  });

  it('forwards request options (e.g. cancellation signal) to ApiClient', () => {
    const { service, calls } = setup();
    const controller = new AbortController();
    service.listCategories({ pageNumber: 1 }, { signal: controller.signal }).subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.listCategories.path]);
    expect(calls.options).toEqual([{ signal: controller.signal, params: { pageNumber: 1 } }]);
  });
});

describe('CatalogAdminApiService product writes (13.3)', () => {
  const BODY = {
    name: 'Tee',
    slug: 'tee',
    description: null,
    categoryId: 'cat-1',
    visibility: 0,
    seo: null,
  };

  it('creates a product through the canonical route with the body verbatim', () => {
    const { service, posts } = setup();
    service.createProduct(BODY).subscribe();

    expect(posts.paths).toEqual([CATALOG_ENDPOINTS.createProduct.path]);
    expect(posts.bodies).toEqual([BODY]);
    expect(posts.options).toEqual([{}]);
  });

  it('updates a product through the canonical route with the id as path param', () => {
    const { service, puts } = setup();
    service.updateProduct('prod-1', BODY).subscribe();

    expect(puts.paths).toEqual([CATALOG_ENDPOINTS.updateProduct.path]);
    expect(puts.bodies).toEqual([BODY]);
    expect(puts.options).toEqual([{ pathParams: { id: 'prod-1' } }]);
  });

  it('maps every lifecycle action to its canonical route template', () => {
    const { service, posts } = setup();
    const actions = {
      activate: CATALOG_ENDPOINTS.activateProduct.path,
      deactivate: CATALOG_ENDPOINTS.deactivateProduct.path,
      archive: CATALOG_ENDPOINTS.archiveProduct.path,
      'soft-delete': CATALOG_ENDPOINTS.softDeleteProduct.path,
      restore: CATALOG_ENDPOINTS.restoreProduct.path,
    } as const;
    for (const [action, path] of Object.entries(actions)) {
      service.transitionProduct('prod-1', action as keyof typeof actions).subscribe();
      expect(posts.paths.at(-1)).toBe(path);
    }
    expect(posts.bodies.every((body) => body === undefined)).toBe(true);
    expect(posts.options.at(-1)).toEqual({ pathParams: { id: 'prod-1' } });
  });

  it('propagates write failures untouched for callers to normalize', () => {
    const { service, api } = setup();
    const rejection = new ApiError({ status: 409, message: 'Conflict.' });
    vi.mocked(api.post).mockReturnValueOnce(throwError(() => rejection));
    let observed: unknown;
    service.transitionProduct('prod-1', 'activate').subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBe(rejection);
  });
});

describe('CatalogAdminApiService details reads (13.3)', () => {
  it('lists variants scoped to the product id', () => {
    const { service, calls } = setup();
    service.listVariants('prod-1').subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.listVariants.path]);
    expect(calls.options).toEqual([{ pathParams: { productId: 'prod-1' } }]);
  });

  it('lists images scoped to the product id', () => {
    const { service, calls } = setup();
    service.listProductImages('prod-1').subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.listProductImages.path]);
    expect(calls.options).toEqual([{ pathParams: { productId: 'prod-1' } }]);
  });

  it('lists specifications scoped to the product id', () => {
    const { service, calls } = setup();
    service.listSpecifications('prod-1').subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.listSpecifications.path]);
    expect(calls.options).toEqual([{ pathParams: { productId: 'prod-1' } }]);
  });
});
