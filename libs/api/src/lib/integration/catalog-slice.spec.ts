/**
 * Minimal vertical integration slice for Sub-Phase 1.11 — Real Backend
 * Integration Slice.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §1.11.
 *
 * Selected endpoint: `GET /catalog/products?pageNumber&pageSize`
 * (`API_CONTRACT.md` §2.1) — anonymous, envelope-wrapped, paginated, so one
 * endpoint exercises success, empty pages, validation errors, and paging.
 * `GET /catalog/products/{id}` covers the 404 path. No live backend is
 * reachable from this environment, so `HttpTestingController` stands in for
 * the ASP.NET Core API with contract-exact fixtures (enums as NUMBERS per
 * `ENUM_REFERENCE.md`, `ApiResponse`/`PagedResult` envelopes, 7-property
 * validation shape, `extensions: {}` business-error reality) — explicitly
 * permitted by §1.11 ("real backend or mock service handlers matching
 * contract specs").
 *
 * Chain under test (all production pieces, no business modules shipped):
 *
 * ```text
 * fixture (contract) → ApiClient → HttpClient → interceptors → resource
 * store → libs/ui primitives. `loadProductPage` plays the feature
 * data-access role (envelope unwrap + query building); UI copy and retry
 * actions are feature-owned, as in production.
 * ```
 */

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { map, type Subscription } from 'rxjs';
import {
  EmptyState as EmptyStateComponent,
  ErrorState as ErrorStateComponent,
  LoadingIndicator as LoadingIndicatorComponent,
} from '@flux/ui';
import type { ProductResponse } from '@flux/models';
import { ApiClient } from '../client/api-client';
import { provideAppEnvironment, type AppEnvironment } from '../client/app-environment';
import { provideApi } from '../client/api-providers';
import type { PagedApiResponse, PagedResult } from '../contracts/api-response';
import { ApiError, NETWORK_ERROR_CODE } from '../runtime/error-normalizer';
import {
  createResourceState,
  loadResourceState,
  type ResourceStateStore,
} from '../runtime/resource-state';
import { toQueryParams } from '../runtime/query';

const environment: AppEnvironment = {
  name: 'development',
  production: false,
  appName: 'test',
  apiBaseUrl: 'https://localhost:7119',
};

const CATEGORY_ID = '11111111-1111-1111-1111-111111111111';

/** Contract-exact product (`ProductStatus.Active = 1`, `ProductVisibility.Visible = 0`). */
function productFixture(id: string, name: string, slug: string): ProductResponse {
  return {
    id,
    name,
    slug,
    description: null,
    seo: null,
    status: 1,
    visibility: 0,
    categoryId: CATEGORY_ID,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function pagedFixture(
  items: ProductResponse[],
  totalCount: number,
): PagedApiResponse<ProductResponse> {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: { items, totalCount, pageNumber: 1, pageSize: 20 },
  };
}

/**
 * Minimal feature data-access role: builds the typed query, calls the
 * shared client, unwraps the envelope. Production features follow this
 * exact shape (mapping/envelope ownership stays feature-side per §1.3).
 *
 * Two deliberate choices, both architectural (not shortcuts):
 * - Query values pass through RAW (no `normalizePagination`): this technical
 *   slice validates backend validation behavior, and normalization belongs
 *   to feature state (1.8), not data access.
 * - Emptiness is feature-owned (1.9): only this layer knows an empty catalog
 *   page means zero `items` — the default rule cannot infer it from the
 *   `PagedResult` envelope, so it is supplied explicitly.
 */
function loadProductPage(
  client: ApiClient,
  store: ResourceStateStore<PagedResult<ProductResponse>>,
  page: { pageNumber?: number; pageSize?: number },
  options: { signal?: AbortSignal } = {},
): Subscription {
  return loadResourceState(
    store,
    client
      .get<PagedApiResponse<ProductResponse>>('/catalog/products', {
        params: toQueryParams(page),
        signal: options.signal,
      })
      .pipe(map((response) => response.data as PagedResult<ProductResponse>)),
    { signal: options.signal, isEmpty: (paged) => paged.items.length === 0 },
  );
}

describe('catalog products integration slice', () => {
  let client: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideAppEnvironment(environment), provideApi(), provideHttpClientTesting()],
    });
    client = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('renders a successful paged response into Success state', () => {
    const store = createResourceState<PagedResult<ProductResponse>>();
    loadProductPage(client, store, { pageNumber: 1, pageSize: 20 });

    const pending = http.expectOne(
      'https://localhost:7119/catalog/products?pageNumber=1&pageSize=20',
    );
    expect(pending.request.method).toBe('GET');
    expect(pending.request.headers.has('Authorization')).toBe(false);
    expect(pending.request.headers.get('X-Correlation-ID')).toMatch(/^[0-9a-f-]{36}$/);

    pending.flush(
      pagedFixture(
        [productFixture('a1', 'Tee', 'tee'), productFixture('b2', 'Hoodie', 'hoodie')],
        2,
      ),
    );

    expect(store.isSuccess()).toBe(true);
    expect(store.data()?.items.map((item) => item.slug)).toEqual(['tee', 'hoodie']);
    expect(store.data()?.totalCount).toBe(2);
    expect(store.error()).toBeNull();
  });

  it('exposes Loading state while the response is in flight', () => {
    const store = createResourceState<PagedResult<ProductResponse>>();
    loadProductPage(client, store, { pageNumber: 1, pageSize: 20 });

    expect(store.isLoading()).toBe(true);
    expect(store.data()).toBeNull();

    const indicator = TestBed.createComponent(LoadingIndicatorComponent);
    indicator.componentInstance.label = 'Loading products';
    indicator.detectChanges();
    expect(
      (indicator.nativeElement as HTMLElement).querySelector('.label')?.textContent?.trim(),
    ).toBe('Loading products');

    http
      .expectOne('https://localhost:7119/catalog/products?pageNumber=1&pageSize=20')
      .flush(pagedFixture([], 0));
    expect(store.isLoading()).toBe(false);
  });

  it('routes an empty page to Empty state and the EmptyState primitive', () => {
    const store = createResourceState<PagedResult<ProductResponse>>();
    loadProductPage(client, store, { pageNumber: 9 });

    http
      .expectOne('https://localhost:7119/catalog/products?pageNumber=9')
      .flush(pagedFixture([], 0));

    expect(store.isEmpty()).toBe(true);
    expect(store.data()?.items).toEqual([]);

    const empty = TestBed.createComponent(EmptyStateComponent);
    empty.componentInstance.title = 'No products found';
    empty.componentInstance.message = 'Try a different search term.';
    empty.detectChanges();
    const element = empty.nativeElement as HTMLElement;
    expect(element.querySelector('.title')?.textContent?.trim()).toBe('No products found');
    expect(element.querySelector('.message')?.textContent?.trim()).toBe(
      'Try a different search term.',
    );
  });

  it('maps a 400 ValidationProblemDetail to field errors', () => {
    const store = createResourceState<PagedResult<ProductResponse>>();
    loadProductPage(client, store, { pageNumber: 0, pageSize: 200 });

    http.expectOne('https://localhost:7119/catalog/products?pageNumber=0&pageSize=200').flush(
      {
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
        title: 'Validation Failed',
        status: 400,
        detail: 'One or more validation errors occurred.',
        instance: '/catalog/products',
        traceId: 'trace-400',
        errors: {
          pageNumber: ['Page number must be at least 1.'],
          pageSize: ['Page size must be between 1 and 100.'],
        },
      },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(store.isError()).toBe(true);
    const error = store.error();
    expect(error).toBeInstanceOf(ApiError);
    expect(error?.status).toBe(400);
    expect(error?.validationErrors).toEqual({
      pageNumber: ['Page number must be at least 1.'],
      pageSize: ['Page size must be between 1 and 100.'],
    });
    expect(error?.traceId).toBe('trace-400');
  });

  it('normalizes a 404 ProblemDetail with wire-realistic empty extensions', () => {
    const store = createResourceState<PagedResult<ProductResponse>>();
    client
      .get<unknown>('/catalog/products/does-not-exist', {
        params: toQueryParams({}),
      })
      .subscribe({
        next: (data) => store.setSuccess(data as PagedResult<ProductResponse>),
        error: (error: unknown) => store.setError(error),
      });

    http.expectOne('https://localhost:7119/catalog/products/does-not-exist').flush(
      {
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
        title: 'Not Found',
        status: 404,
        detail: 'Product not found.',
        traceId: 'trace-404',
        extensions: {},
      },
      { status: 404, statusText: 'Not Found' },
    );

    expect(store.isError()).toBe(true);
    expect(store.error()?.status).toBe(404);
    expect(store.error()?.code).toBeUndefined();
    expect(store.error()?.message).toBe('Product not found.');
  });

  it('captures stable backend codes when present and traces correlation end to end', () => {
    const store = createResourceState<PagedResult<ProductResponse>>();
    loadProductPage(client, store, { pageNumber: 1, pageSize: 20 });

    const pending = http.expectOne(
      'https://localhost:7119/catalog/products?pageNumber=1&pageSize=20',
    );
    const sentId = pending.request.headers.get('X-Correlation-ID');
    pending.flush(
      {
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.8',
        title: 'Conflict',
        status: 409,
        detail: 'Product slug already exists.',
        traceId: 'trace-409',
        extensions: { code: 'Catalog.DuplicateProductSlug' },
      },
      { status: 409, statusText: 'Conflict' },
    );

    expect(store.error()?.code).toBe('Catalog.DuplicateProductSlug');
    expect(store.error()?.correlationId).toBe(sentId);

    const failure = TestBed.createComponent(ErrorStateComponent);
    failure.componentInstance.title = 'Could not load products';
    failure.componentInstance.message = store.error()?.message ?? null;
    failure.detectChanges();
    expect(
      (failure.nativeElement as HTMLElement).querySelector('.message')?.textContent?.trim(),
    ).toBe('Product slug already exists.');
  });

  it('classifies network failures distinctly from API errors', () => {
    const store = createResourceState<PagedResult<ProductResponse>>();
    loadProductPage(client, store, { pageNumber: 1, pageSize: 20 });

    http
      .expectOne('https://localhost:7119/catalog/products?pageNumber=1&pageSize=20')
      .error(new ProgressEvent('error'));

    expect(store.isError()).toBe(true);
    expect(store.error()?.status).toBe(0);
    expect(store.error()?.code).toBe(NETWORK_ERROR_CODE);
  });

  it('cancels silently on abort without entering Error state', () => {
    const controller = new AbortController();
    const store = createResourceState<PagedResult<ProductResponse>>();
    loadProductPage(client, store, { pageNumber: 1, pageSize: 20 }, { signal: controller.signal });

    const pending = http.expectOne(
      'https://localhost:7119/catalog/products?pageNumber=1&pageSize=20',
    );
    controller.abort();

    expect(pending.cancelled).toBe(true);
    expect(store.status()).toBe('loading');
    expect(store.isError()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('retries after failure: Error → retry action → Success', () => {
    const store = createResourceState<PagedResult<ProductResponse>>();
    const reload = (): void => {
      loadProductPage(client, store, { pageNumber: 1, pageSize: 20 });
    };
    reload();

    http
      .expectOne('https://localhost:7119/catalog/products?pageNumber=1&pageSize=20')
      .flush(null, { status: 500, statusText: 'Server Error' });
    expect(store.isError()).toBe(true);

    const failure = TestBed.createComponent(ErrorStateComponent);
    let retried = 0;
    failure.componentInstance.retry.subscribe(() => {
      retried += 1;
      reload();
    });
    failure.detectChanges();
    (failure.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('flux-retry-button button')
      ?.click();

    expect(retried).toBe(1);
    http
      .expectOne('https://localhost:7119/catalog/products?pageNumber=1&pageSize=20')
      .flush(pagedFixture([productFixture('c3', 'Cap', 'cap')], 1));

    expect(store.isSuccess()).toBe(true);
    expect(store.data()?.items.map((item) => item.slug)).toEqual(['cap']);
    expect(store.error()).toBeNull();
  });
});
