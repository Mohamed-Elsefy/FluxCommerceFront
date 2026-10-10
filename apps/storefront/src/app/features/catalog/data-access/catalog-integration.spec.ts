/**
 * Feature integration tests for Sub-Phase 5.11 — Testing.
 *
 * Verifies the production contract path end to end with the real layers
 * wired and only HTTP stubbed:
 *
 * ```text
 * CatalogState (feature state, real)
 *     ↓ CatalogApiService (feature data access, real)
 *     ↓ ApiClient (shared transport, real — incl. interceptors)
 *     ↓ HttpTestingController (stands in for ASP.NET Core)
 *     ↓ Backend Catalog API contract (contract-exact fixtures)
 * ```
 *
 * No live backend is reachable from this environment, so
 * `HttpTestingController` stands in with contract-exact fixtures (enums as
 * NUMBERS, `ApiResponse`/`PagedResult` envelopes, camelCase wire casing) —
 * the same convention as the Phase 1 slice (`libs/api` integration spec),
 * now extended to the storefront search contract (`GET /catalog`) with
 * category/filter/sort/paging, plus the category list and failure paths.
 */

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideApi, provideAppEnvironment, type AppEnvironment } from '@flux/api';
import type { CatalogProductListItem, CategoryResponse } from '@flux/models';
import {
  CatalogProductSortBy,
  CatalogProductSortDirection,
  ProductStatus,
  ProductVisibility,
} from '@flux/models';
import { CatalogApiService } from './catalog-api.service';
import { CatalogState } from '../state/catalog-state';

const environment: AppEnvironment = {
  name: 'development',
  production: false,
  appName: 'test',
  apiBaseUrl: '/api',
};

const APPAREL_ID = '22222222-2222-2222-2222-222222222222';

function productFixture(id: string, name: string): CatalogProductListItem {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    description: null,
    categoryId: APPAREL_ID,
    primaryImage: {
      id: `img-${id}`,
      imageUrl: `/cdn/${name.toLowerCase()}.jpg`,
      altText: `${name} front view`,
      displayOrder: 0,
      isPrimary: true,
    },
  };
}

function categoryFixture(): CategoryResponse {
  return {
    id: APPAREL_ID,
    name: 'Apparel',
    slug: 'apparel',
    description: null,
    parentId: null,
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

describe('catalog feature integration (state → api → contract)', () => {
  let state: CatalogState;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideAppEnvironment(environment),
        provideApi(),
        provideHttpClientTesting(),
        CatalogApiService,
        CatalogState,
      ],
    });
    state = TestBed.inject(CatalogState);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('searches with backend field names and numeric enums into Success', () => {
    state.loadProducts({
      searchTerm: 'tee',
      categoryId: APPAREL_ID,
      status: ProductStatus.Active,
      visibility: ProductVisibility.Visible,
      sortBy: CatalogProductSortBy.Name,
      sortDirection: CatalogProductSortDirection.Descending,
      pageNumber: 1,
      pageSize: 20,
    });

    expect(state.productsLoading()).toBe(true);
    const pending = http.expectOne(
      '/api/catalog' +
        '?searchTerm=tee' +
        `&categoryId=${APPAREL_ID}` +
        '&status=1&visibility=0&sortBy=0&sortDirection=1' +
        '&pageNumber=1&pageSize=20',
    );
    expect(pending.request.method).toBe('GET');
    expect(pending.request.headers.has('Authorization')).toBe(false);

    pending.flush({
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: {
        items: [productFixture('11111111-1111-1111-1111-111111111111', 'Tee')],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 20,
      },
    });

    const snapshot = state.products();
    expect(snapshot.isSuccess).toBe(true);
    expect(snapshot.data?.items.map((item) => item.name)).toEqual(['Tee']);
    expect(snapshot.data?.items[0]?.primaryImage?.imageUrl).toBe('/cdn/tee.jpg');
    expect(snapshot.data?.totalCount).toBe(1);
    expect(snapshot.error).toBeNull();
  });

  it('lists full product records with images and sorting into Success', () => {
    state.loadListedProducts({
      searchTerm: 'tee',
      categoryId: APPAREL_ID,
      status: ProductStatus.Active,
      sortBy: CatalogProductSortBy.CreatedAtUtc,
      sortDirection: CatalogProductSortDirection.Descending,
      pageNumber: 1,
      pageSize: 20,
    });

    const pending = http.expectOne(
      '/api/catalog/products' +
        '?searchTerm=tee' +
        `&categoryId=${APPAREL_ID}` +
        '&status=1&sortBy=1&sortDirection=1' +
        '&pageNumber=1&pageSize=20',
    );
    expect(pending.request.method).toBe('GET');
    expect(pending.request.headers.has('Authorization')).toBe(false);

    pending.flush({
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: {
        items: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Tee',
            slug: 'tee',
            description: null,
            seo: null,
            status: 1,
            visibility: 0,
            categoryId: APPAREL_ID,
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
          },
        ],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 20,
      },
    });

    const snapshot = state.products();
    expect(snapshot.isSuccess).toBe(true);
    expect(snapshot.data?.items.map((item) => item.name)).toEqual(['Tee']);
    expect(snapshot.data?.items[0]?.primaryImage?.imageUrl).toBe('/cdn/tee.jpg');
    expect(snapshot.error).toBeNull();
  });

  it('routes an out-of-range page to Empty with retained paging', () => {
    state.loadProducts({ categoryId: APPAREL_ID, pageNumber: 99, pageSize: 20 });

    http.expectOne(`/api/catalog?categoryId=${APPAREL_ID}&pageNumber=99&pageSize=20`).flush({
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: { items: [], totalCount: 2, pageNumber: 99, pageSize: 20 },
    });

    const snapshot = state.products();
    expect(snapshot.isEmpty).toBe(true);
    expect(snapshot.data?.items).toEqual([]);
    expect(snapshot.data?.totalCount).toBe(2);
  });

  it('maps a 400 ValidationProblemDetail to field errors', () => {
    state.loadProducts({ pageNumber: 0, pageSize: 500 });

    http.expectOne('/api/catalog?pageNumber=0&pageSize=500').flush(
      {
        type: 'about:blank',
        title: 'Validation Failed',
        status: 400,
        detail: 'One or more validation errors occurred.',
        instance: '/catalog',
        traceId: 'trace-catalog-400',
        errors: {
          pageNumber: ['Page number must be at least 1.'],
          pageSize: ['Page size must be between 1 and 100.'],
        },
      },
      { status: 400, statusText: 'Bad Request' },
    );

    const snapshot = state.products();
    expect(snapshot.isError).toBe(true);
    expect(snapshot.error?.status).toBe(400);
    expect(snapshot.error?.validationErrors).toEqual({
      pageNumber: ['Page number must be at least 1.'],
      pageSize: ['Page size must be between 1 and 100.'],
    });
  });

  it('loads the category list through the paged contract', () => {
    state.loadCategories({ pageNumber: 1, pageSize: 100 });

    http.expectOne('/api/catalog/categories?pageNumber=1&pageSize=100').flush({
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: { items: [categoryFixture()], totalCount: 1, pageNumber: 1, pageSize: 100 },
    });

    const snapshot = state.categories();
    expect(snapshot.isSuccess).toBe(true);
    expect(snapshot.data?.items.map((category) => category.slug)).toEqual(['apparel']);
  });

  it('recovers through retry: Error → reload → Success', () => {
    state.loadCategories({ pageNumber: 1, pageSize: 100 });

    http
      .expectOne('/api/catalog/categories?pageNumber=1&pageSize=100')
      .flush(null, { status: 500, statusText: 'Server Error' });
    expect(state.categories().isError).toBe(true);

    state.loadCategories({ pageNumber: 1, pageSize: 100 });
    http.expectOne('/api/catalog/categories?pageNumber=1&pageSize=100').flush({
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: { items: [categoryFixture()], totalCount: 1, pageNumber: 1, pageSize: 100 },
    });

    expect(state.categories().isSuccess).toBe(true);
    expect(state.categories().error).toBeNull();
  });
});
