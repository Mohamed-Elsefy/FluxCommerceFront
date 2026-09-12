/**
 * Feature integration tests for Sub-Phase 6.10 — Testing.
 *
 * Verifies the production contract paths end to end with the real layers
 * wired and only HTTP stubbed:
 *
 * ```text
 * ProductDetailsState (feature state, real)
 *     ↓ ProductDetailsApiService (feature data access, real)
 *     ↓ ApiClient (shared transport, real — incl. interceptors)
 *     ↓ HttpTestingController (stands in for ASP.NET Core)
 *     ↓ Backend Catalog/Cart API contracts (contract-exact fixtures)
 * ```
 *
 * And the purchase path:
 *
 * ```text
 * Selected Variant + Quantity (+ explicit price snapshot — no
 * customer-readable contract source exists; see the integration note in
 * `../models`)
 *     ↓ POST /cart/items
 *     ↓ added | error
 * ```
 *
 * No live backend is reachable from this environment, so
 * `HttpTestingController` stands in with contract-exact fixtures (enums as
 * NUMBERS, `ApiResponse` envelopes, camelCase wire casing) — the same
 * convention as the Phase 5 catalog integration spec.
 */

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideApi, provideAppEnvironment, type AppEnvironment } from '@flux/api';
import { VariantStatus } from '@flux/models';
import type { CartResponse } from '@flux/models';
import { ProductDetailsApiService } from './product-details-api.service';
import { ProductDetailsState } from '../state/product-details-state';

const environment: AppEnvironment = {
  name: 'development',
  production: false,
  appName: 'test',
  apiBaseUrl: '/api',
};

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';
const ACTIVE_VARIANT_ID = 'aaaaaaaa-1111-4111-8111-111111111111';

function productPayload(): Record<string, unknown> {
  return {
    id: PRODUCT_ID,
    name: 'Tee',
    slug: 'tee',
    description: 'A comfortable cotton tee.',
    seo: null,
    status: 1,
    visibility: 0,
    categoryId: '22222222-2222-2222-2222-222222222222',
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function specificationsPayload(): Record<string, unknown>[] {
  return [
    {
      id: 'a1a1a1a1-1111-4111-8111-111111111111',
      productId: PRODUCT_ID,
      name: 'Material',
      value: 'Cotton',
    },
    {
      id: 'b2b2b2b2-2222-4222-8222-222222222222',
      productId: PRODUCT_ID,
      name: 'Fit',
      value: 'Regular',
    },
  ];
}

function imagesPayload(): Record<string, unknown>[] {
  return [
    {
      id: 'c3c3c3c3-3333-4333-8333-333333333333',
      productId: PRODUCT_ID,
      imageUrl: '/images/tee-front.jpg',
      altText: 'Tee front view',
      displayOrder: 0,
      isPrimary: true,
      metadata: null,
      createdAtUtc: '2026-09-04T10:00:00Z',
    },
    {
      id: 'd4d4d4d4-4444-4444-8444-444444444444',
      productId: PRODUCT_ID,
      imageUrl: '/images/tee-back.jpg',
      altText: null,
      displayOrder: 1,
      isPrimary: false,
      metadata: null,
      createdAtUtc: '2026-09-04T10:00:00Z',
    },
  ];
}

function variantsPayload(): Record<string, unknown>[] {
  return [
    {
      id: ACTIVE_VARIANT_ID,
      productId: PRODUCT_ID,
      sku: 'TEE-RED-M',
      name: 'Red / M',
      status: VariantStatus.Active,
      isDeleted: false,
      createdAtUtc: '2026-09-04T10:00:00Z',
      deletedAtUtc: null,
    },
    {
      id: 'bbbbbbbb-2222-4222-8222-222222222222',
      productId: PRODUCT_ID,
      sku: 'TEE-BLUE-M',
      name: 'Blue / M',
      status: VariantStatus.Inactive,
      isDeleted: false,
      createdAtUtc: '2026-09-04T10:00:00Z',
      deletedAtUtc: null,
    },
  ];
}

function cartPayload(): CartResponse {
  return {
    cartId: '99999999-9999-4999-8999-999999999999',
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    version: 2,
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:05:00Z',
    items: [
      {
        productId: PRODUCT_ID,
        variantId: ACTIVE_VARIANT_ID,
        sku: 'TEE-RED-M',
        productName: 'Tee',
        unitPriceAmount: 29.99,
        currency: 'USD',
        quantity: 2,
      },
    ],
    isGuest: false,
    isAuthenticated: true,
  };
}

function envelope(data: unknown): Record<string, unknown> {
  return { isSuccess: true, message: 'Operation completed successfully.', data };
}

describe('product-details feature integration (state → api → contract)', () => {
  let state: ProductDetailsState;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideAppEnvironment(environment),
        provideApi(),
        provideHttpClientTesting(),
        ProductDetailsApiService,
        ProductDetailsState,
      ],
    });
    state = TestBed.inject(ProductDetailsState);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('loads the product through the contract path into Success', () => {
    state.loadProduct(PRODUCT_ID);

    expect(state.productLoading()).toBe(true);
    const pending = http.expectOne(`/api/catalog/products/${PRODUCT_ID}`);
    expect(pending.request.method).toBe('GET');
    expect(pending.request.headers.has('Authorization')).toBe(false);

    pending.flush(envelope(productPayload()));

    const snapshot = state.product();
    expect(snapshot.isSuccess).toBe(true);
    expect(snapshot.data?.name).toBe('Tee');
    expect(snapshot.data?.description).toBe('A comfortable cotton tee.');
    expect(snapshot.error).toBeNull();
  });

  it('loads specifications, images, and variants through their contract paths in wire order', () => {
    state.loadSpecifications(PRODUCT_ID);
    state.loadProductImages(PRODUCT_ID);
    state.loadProductVariants(PRODUCT_ID);

    const specifications = http.expectOne(`/api/catalog/products/${PRODUCT_ID}/specifications`);
    expect(specifications.request.method).toBe('GET');
    specifications.flush(envelope(specificationsPayload()));

    const images = http.expectOne(`/api/catalog/products/${PRODUCT_ID}/images`);
    expect(images.request.method).toBe('GET');
    images.flush(envelope(imagesPayload()));

    const variants = http.expectOne(`/api/catalog/products/${PRODUCT_ID}/variants`);
    expect(variants.request.method).toBe('GET');
    variants.flush(envelope(variantsPayload()));

    expect(state.specifications().data?.map((spec) => spec.name)).toEqual(['Material', 'Fit']);
    expect(state.images().data?.map((image) => image.displayOrder)).toEqual([0, 1]);
    expect(state.images().data?.find((image) => image.isPrimary)?.altText).toBe('Tee front view');
    expect(state.variants().data?.map((variant) => variant.sku)).toEqual([
      'TEE-RED-M',
      'TEE-BLUE-M',
    ]);
  });

  it('maps a 404 product read to the error slot without throwing', () => {
    state.loadProduct('00000000-0000-0000-0000-000000000000');

    http.expectOne('/api/catalog/products/00000000-0000-0000-0000-000000000000').flush(
      {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Product not found.',
      },
      { status: 404, statusText: 'Not Found' },
    );

    const snapshot = state.product();
    expect(snapshot.isError).toBe(true);
    expect(snapshot.error?.status).toBe(404);
  });

  it('recovers through retry: Error → reload → Success', () => {
    state.loadProduct(PRODUCT_ID);

    http
      .expectOne(`/api/catalog/products/${PRODUCT_ID}`)
      .flush(null, { status: 500, statusText: 'Server Error' });
    expect(state.product().isError).toBe(true);

    state.loadProduct(PRODUCT_ID);
    http.expectOne(`/api/catalog/products/${PRODUCT_ID}`).flush(envelope(productPayload()));

    expect(state.product().isSuccess).toBe(true);
    expect(state.product().error).toBeNull();
  });

  it('submits the selected variant and quantity to the cart API with the exact body', () => {
    state.loadProductVariants(PRODUCT_ID);
    http
      .expectOne(`/api/catalog/products/${PRODUCT_ID}/variants`)
      .flush(envelope(variantsPayload()));

    state.selectVariant(ACTIVE_VARIANT_ID);
    state.setQuantity(2);
    state.submitAddToCart({ unitPriceAmount: 29.99, currency: 'USD' });

    const pending = http.expectOne('/api/cart/items');
    expect(pending.request.method).toBe('POST');
    expect(pending.request.body).toEqual({
      variantId: ACTIVE_VARIANT_ID,
      unitPriceAmount: 29.99,
      currency: 'USD',
      quantity: 2,
    });

    pending.flush(envelope(cartPayload()));

    expect(state.addToCartStatus()).toBe('added');
    expect(state.addToCartError()).toBeNull();
  });

  it('maps a cart 409 rejection to the error slot', () => {
    state.loadProductVariants(PRODUCT_ID);
    http
      .expectOne(`/api/catalog/products/${PRODUCT_ID}/variants`)
      .flush(envelope(variantsPayload()));

    state.selectVariant(ACTIVE_VARIANT_ID);
    state.submitAddToCart({ unitPriceAmount: 29.99, currency: 'USD' });

    http.expectOne('/api/cart/items').flush(
      {
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'Variant unavailable.',
      },
      { status: 409, statusText: 'Conflict' },
    );

    expect(state.addToCartStatus()).toBe('error');
    expect(state.addToCartError()?.status).toBe(409);
  });
});
