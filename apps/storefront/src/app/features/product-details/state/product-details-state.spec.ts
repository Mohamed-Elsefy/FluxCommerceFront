/**
 * State tests for the Sub-Phase 6.1–6.9 `ProductDetailsState`.
 *
 * `ProductDetailsApiService` (the feature HTTP boundary, covered by
 * `product-details-api.service.spec.ts`) is stubbed at its typed seam so
 * these tests own the feature logic: idle → loading → success | empty |
 * error transitions for the product, specifications, images, and variants
 * slots; variant selection (valid acceptance, invalid rejection, no
 * default, clearing, orderability guard); purchase quantity (valid start,
 * increment/decrement, minimum floor, invalid rejection, reset); add-to-cart
 * submission (guard rejection, duplicate lock, success/error transitions,
 * reset); SSR transfer-state hydration (server stores, client reuses once,
 * misses refetch, failures never stored); data retention across reloads;
 * dataless-envelope violations; blank-id rejection; cancellation
 * passthrough; reset of every slot; and feature-local scoping (no root
 * singleton — every injection site gets an independent instance).
 */

import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, TransferState } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { Observable, of, throwError } from 'rxjs';
import { ApiError, type ApiResponseWithData } from '@flux/api';
import { VariantStatus } from '@flux/models';
import type {
  AddCartItemRequest,
  CartResponse,
  ProductImageResponse,
  ProductResponse,
  ProductSpecificationResponse,
  VariantResponse,
} from '@flux/models';
import { ProductDetailsApiService } from '../data-access/product-details-api.service';
import { ProductDetailsState } from './product-details-state';

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';

const PRODUCT: ProductResponse = {
  id: PRODUCT_ID,
  name: 'Tee',
  slug: 'tee',
  description: null,
  seo: null,
  status: 1,
  visibility: 0,
  categoryId: '22222222-2222-2222-2222-222222222222',
  isDeleted: false,
  createdAtUtc: '2026-09-04T10:00:00Z',
  deletedAtUtc: null,
};

function productEnvelope() {
  return { isSuccess: true, data: PRODUCT };
}

const SPECIFICATIONS: ProductSpecificationResponse[] = [
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

function specificationsEnvelope(items: ProductSpecificationResponse[] = SPECIFICATIONS) {
  return { isSuccess: true, data: items };
}

const IMAGES: ProductImageResponse[] = [
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

function imagesEnvelope(items: ProductImageResponse[] = IMAGES) {
  return { isSuccess: true, data: items };
}

const ACTIVE_VARIANT_ID = 'aaaaaaaa-1111-4111-8111-111111111111';

const VARIANTS: VariantResponse[] = [
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

function variantsEnvelope(items: VariantResponse[] = VARIANTS) {
  return { isSuccess: true, data: items };
}

function setup(flows: {
  getProduct?: () => ReturnType<ProductDetailsApiService['getProduct']>;
  listSpecifications?: () => ReturnType<ProductDetailsApiService['listSpecifications']>;
  listProductImages?: () => ReturnType<ProductDetailsApiService['listProductImages']>;
  listProductVariants?: () => ReturnType<ProductDetailsApiService['listProductVariants']>;
  addAuthenticatedCartItem?: () => ReturnType<ProductDetailsApiService['addAuthenticatedCartItem']>;
}): {
  state: ProductDetailsState;
  seenSignals: (AbortSignal | undefined)[];
  ids: unknown[];
  specificationIds: unknown[];
  imageIds: unknown[];
  variantIds: unknown[];
  cartBodies: unknown[];
} {
  const seenSignals: (AbortSignal | undefined)[] = [];
  const ids: unknown[] = [];
  const specificationIds: unknown[] = [];
  const imageIds: unknown[] = [];
  const variantIds: unknown[] = [];
  const cartBodies: unknown[] = [];
  const apiStub = {
    getProduct: ((id: unknown, options: { signal?: AbortSignal } = {}) => {
      ids.push(id);
      seenSignals.push(options.signal);
      return flows.getProduct?.() ?? of(productEnvelope());
    }) as ProductDetailsApiService['getProduct'],
    listSpecifications: ((id: unknown, options: { signal?: AbortSignal } = {}) => {
      specificationIds.push(id);
      seenSignals.push(options.signal);
      return flows.listSpecifications?.() ?? of(specificationsEnvelope());
    }) as ProductDetailsApiService['listSpecifications'],
    listProductImages: ((id: unknown, options: { signal?: AbortSignal } = {}) => {
      imageIds.push(id);
      seenSignals.push(options.signal);
      return flows.listProductImages?.() ?? of(imagesEnvelope());
    }) as ProductDetailsApiService['listProductImages'],
    listProductVariants: ((id: unknown, options: { signal?: AbortSignal } = {}) => {
      variantIds.push(id);
      seenSignals.push(options.signal);
      return flows.listProductVariants?.() ?? of(variantsEnvelope());
    }) as ProductDetailsApiService['listProductVariants'],
    addAuthenticatedCartItem: (body: unknown, options: { signal?: AbortSignal } = {}) => {
      cartBodies.push(body);
      seenSignals.push(options.signal);
      return flows.addAuthenticatedCartItem?.() ?? of({ isSuccess: true, data: CART_RESULT });
    },
  } as ProductDetailsApiService;

  TestBed.configureTestingModule({
    providers: [{ provide: ProductDetailsApiService, useValue: apiStub }, ProductDetailsState],
  });
  return {
    state: TestBed.inject(ProductDetailsState),
    seenSignals,
    ids,
    specificationIds,
    imageIds,
    variantIds,
    cartBodies,
  };
}

const CART_RESULT: CartResponse = {
  cartId: '99999999-9999-4999-8999-999999999999',
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  version: 2,
  createdAtUtc: '2026-09-04T10:00:00Z',
  updatedAtUtc: '2026-09-04T10:05:00Z',
  items: [],
  isGuest: false,
  isAuthenticated: true,
};

const PRICING = { unitPriceAmount: 29.99, currency: 'USD' };

describe('ProductDetailsState product', () => {
  it('starts idle and resolves to success with envelope data', () => {
    const { state } = setup({});
    expect(state.product().status).toBe('idle');

    state.loadProduct(PRODUCT_ID);

    const snapshot = state.product();
    expect(snapshot.status).toBe('success');
    expect(snapshot.data?.name).toBe('Tee');
    expect(state.productLoading()).toBe(false);
  });

  it('transitions through loading while the request is in flight', () => {
    let settle: (() => void) | undefined;
    const pending = new Observable((subscriber) => {
      settle = () => {
        subscriber.next(productEnvelope());
        subscriber.complete();
      };
    });
    const { state } = setup({
      getProduct: () => pending as ReturnType<ProductDetailsApiService['getProduct']>,
    });
    expect(state.product().status).toBe('idle');

    state.loadProduct(PRODUCT_ID);
    expect(state.product().status).toBe('loading');
    expect(state.productLoading()).toBe(true);
    expect(state.product().data).toBeNull();

    settle?.();
    expect(state.product().status).toBe('success');
    expect(state.product().data?.name).toBe('Tee');
    expect(state.productLoading()).toBe(false);
  });

  it('resolves to error on failures and normalizes the ApiError', () => {
    const rejection = new ApiError({ status: 404, message: 'Not found.' });
    const { state } = setup({ getProduct: () => throwError(() => rejection) });
    state.loadProduct(PRODUCT_ID);

    const snapshot = state.product();
    expect(snapshot.status).toBe('error');
    expect(snapshot.error).toBe(rejection);
  });

  it('resolves to error on dataless success envelopes', () => {
    const { state } = setup({ getProduct: () => of({ isSuccess: true, data: null }) });
    state.loadProduct(PRODUCT_ID);

    expect(state.product().status).toBe('error');
  });

  it('stays stable on non-protocol failures (never throws, always normalized)', () => {
    const { state } = setup({
      getProduct: () => throwError(() => new TypeError('Failed to fetch')),
    });
    let status: string | undefined;
    expect(() => {
      state.loadProduct(PRODUCT_ID);
      status = state.product().status;
    }).not.toThrow();

    expect(status).toBe('error');
    expect(state.product().error).not.toBeNull();
    expect(typeof state.product().error?.message).toBe('string');
  });

  it('rejects blank ids without fetching and leaves state idle', () => {
    const { state, ids } = setup({});
    state.loadProduct('   ');

    expect(ids).toHaveLength(0);
    expect(state.product().status).toBe('idle');
  });

  it('forwards the AbortSignal to data access without touching state shape', () => {
    const { state, seenSignals } = setup({});
    const controller = new AbortController();
    state.loadProduct(PRODUCT_ID, { signal: controller.signal });

    expect(seenSignals).toEqual([controller.signal]);
    expect(state.product().status).toBe('success');
  });

  it('retains data across reloads until the next response settles', () => {
    const { state } = setup({});
    state.loadProduct(PRODUCT_ID);
    expect(state.product().data?.name).toBe('Tee');

    state.loadProduct(PRODUCT_ID);
    expect(state.product().status).toBe('success');
    expect(state.product().data?.name).toBe('Tee');
  });

  it('resets the slot back to idle', () => {
    const { state } = setup({});
    state.loadProduct(PRODUCT_ID);
    state.reset();

    expect(state.product().status).toBe('idle');
    expect(state.product().data).toBeNull();
  });
});

describe('ProductDetailsState specifications', () => {
  it('starts idle and resolves to success with envelope data in wire order', () => {
    const { state } = setup({});
    expect(state.specifications().status).toBe('idle');

    state.loadSpecifications(PRODUCT_ID);

    const snapshot = state.specifications();
    expect(snapshot.status).toBe('success');
    expect(snapshot.data?.map((spec) => spec.name)).toEqual(['Material', 'Fit']);
  });

  it('resolves to empty when the product carries no specifications', () => {
    const { state } = setup({ listSpecifications: () => of(specificationsEnvelope([])) });
    state.loadSpecifications(PRODUCT_ID);

    const snapshot = state.specifications();
    expect(snapshot.status).toBe('empty');
    expect(snapshot.isEmpty).toBe(true);
  });

  it('resolves to error on failures without touching the product slot', () => {
    const rejection = new ApiError({ status: 500, message: 'Server error.' });
    const { state } = setup({ listSpecifications: () => throwError(() => rejection) });
    state.loadProduct(PRODUCT_ID);
    state.loadSpecifications(PRODUCT_ID);

    expect(state.specifications().status).toBe('error');
    expect(state.specifications().error).toBe(rejection);
    expect(state.product().status).toBe('success');
  });

  it('resolves to error on dataless success envelopes', () => {
    const { state } = setup({ listSpecifications: () => of({ isSuccess: true, data: null }) });
    state.loadSpecifications(PRODUCT_ID);

    expect(state.specifications().status).toBe('error');
  });

  it('rejects blank ids without fetching and leaves state idle', () => {
    const { state, specificationIds } = setup({});
    state.loadSpecifications('   ');

    expect(specificationIds).toHaveLength(0);
    expect(state.specifications().status).toBe('idle');
  });

  it('forwards the AbortSignal to data access without touching state shape', () => {
    const { state, seenSignals } = setup({});
    const controller = new AbortController();
    state.loadSpecifications(PRODUCT_ID, { signal: controller.signal });

    expect(seenSignals).toEqual([controller.signal]);
    expect(state.specifications().status).toBe('success');
  });

  it('resets every slot back to idle', () => {
    const { state } = setup({});
    state.loadProduct(PRODUCT_ID);
    state.loadSpecifications(PRODUCT_ID);
    state.loadProductImages(PRODUCT_ID);
    state.loadProductVariants(PRODUCT_ID);
    state.selectVariant(ACTIVE_VARIANT_ID);
    state.setQuantity(4);
    state.reset();

    expect(state.product().status).toBe('idle');
    expect(state.specifications().status).toBe('idle');
    expect(state.specifications().data).toBeNull();
    expect(state.images().status).toBe('idle');
    expect(state.images().data).toBeNull();
    expect(state.variants().status).toBe('idle');
    expect(state.variants().data).toBeNull();
    expect(state.selectedVariantId()).toBeNull();
    expect(state.selectedVariant()).toBeNull();
    expect(state.quantity()).toBe(1);
    expect(state.addToCartStatus()).toBe('idle');
    expect(state.addToCartError()).toBeNull();
  });
});

describe('ProductDetailsState images', () => {
  it('starts idle and resolves to success with envelope data in wire order', () => {
    const { state } = setup({});
    expect(state.images().status).toBe('idle');

    state.loadProductImages(PRODUCT_ID);

    const snapshot = state.images();
    expect(snapshot.status).toBe('success');
    expect(snapshot.data?.map((image) => image.displayOrder)).toEqual([0, 1]);
  });

  it('resolves to empty when the product carries no images', () => {
    const { state } = setup({ listProductImages: () => of(imagesEnvelope([])) });
    state.loadProductImages(PRODUCT_ID);

    const snapshot = state.images();
    expect(snapshot.status).toBe('empty');
    expect(snapshot.isEmpty).toBe(true);
  });

  it('resolves to error on failures without touching the product slot', () => {
    const rejection = new ApiError({ status: 500, message: 'Server error.' });
    const { state } = setup({ listProductImages: () => throwError(() => rejection) });
    state.loadProduct(PRODUCT_ID);
    state.loadProductImages(PRODUCT_ID);

    expect(state.images().status).toBe('error');
    expect(state.images().error).toBe(rejection);
    expect(state.product().status).toBe('success');
  });

  it('resolves to error on dataless success envelopes', () => {
    const { state } = setup({ listProductImages: () => of({ isSuccess: true, data: null }) });
    state.loadProductImages(PRODUCT_ID);

    expect(state.images().status).toBe('error');
  });

  it('rejects blank ids without fetching and leaves state idle', () => {
    const { state, imageIds } = setup({});
    state.loadProductImages('   ');

    expect(imageIds).toHaveLength(0);
    expect(state.images().status).toBe('idle');
  });

  it('forwards the AbortSignal to data access without touching state shape', () => {
    const { state, seenSignals } = setup({});
    const controller = new AbortController();
    state.loadProductImages(PRODUCT_ID, { signal: controller.signal });

    expect(seenSignals).toEqual([controller.signal]);
    expect(state.images().status).toBe('success');
  });
});

describe('ProductDetailsState variants', () => {
  it('starts idle and resolves to success with envelope data in wire order', () => {
    const { state } = setup({});
    expect(state.variants().status).toBe('idle');

    state.loadProductVariants(PRODUCT_ID);

    const snapshot = state.variants();
    expect(snapshot.status).toBe('success');
    expect(snapshot.data?.map((variant) => variant.name)).toEqual(['Red / M', 'Blue / M']);
  });

  it('resolves to empty when the product carries no variants', () => {
    const { state } = setup({ listProductVariants: () => of(variantsEnvelope([])) });
    state.loadProductVariants(PRODUCT_ID);

    const snapshot = state.variants();
    expect(snapshot.status).toBe('empty');
    expect(snapshot.isEmpty).toBe(true);
  });

  it('resolves to error on failures without touching the product slot', () => {
    const rejection = new ApiError({ status: 500, message: 'Server error.' });
    const { state } = setup({ listProductVariants: () => throwError(() => rejection) });
    state.loadProduct(PRODUCT_ID);
    state.loadProductVariants(PRODUCT_ID);

    expect(state.variants().status).toBe('error');
    expect(state.variants().error).toBe(rejection);
    expect(state.product().status).toBe('success');
  });

  it('resolves to error on dataless success envelopes', () => {
    const { state } = setup({ listProductVariants: () => of({ isSuccess: true, data: null }) });
    state.loadProductVariants(PRODUCT_ID);

    expect(state.variants().status).toBe('error');
  });

  it('rejects blank ids without fetching and leaves state idle', () => {
    const { state, variantIds } = setup({});
    state.loadProductVariants('   ');

    expect(variantIds).toHaveLength(0);
    expect(state.variants().status).toBe('idle');
  });

  it('forwards the AbortSignal to data access without touching state shape', () => {
    const { state, seenSignals } = setup({});
    const controller = new AbortController();
    state.loadProductVariants(PRODUCT_ID, { signal: controller.signal });

    expect(seenSignals).toEqual([controller.signal]);
    expect(state.variants().status).toBe('success');
  });
});

describe('ProductDetailsState variant selection', () => {
  it('starts without a selection (no contract-defined default)', () => {
    const { state } = setup({});
    state.loadProductVariants(PRODUCT_ID);

    expect(state.selectedVariantId()).toBeNull();
    expect(state.selectedVariant()).toBeNull();
  });

  it('accepts a selectable variant and exposes it as the source of truth', () => {
    const { state } = setup({});
    state.loadProductVariants(PRODUCT_ID);
    state.selectVariant(ACTIVE_VARIANT_ID);

    expect(state.selectedVariantId()).toBe(ACTIVE_VARIANT_ID);
    expect(state.selectedVariant()?.sku).toBe('TEE-RED-M');
  });

  it('ignores unknown ids and preserves the current selection', () => {
    const { state } = setup({});
    state.loadProductVariants(PRODUCT_ID);
    state.selectVariant(ACTIVE_VARIANT_ID);
    state.selectVariant('dddddddd-4444-4444-8444-444444444444');

    expect(state.selectedVariantId()).toBe(ACTIVE_VARIANT_ID);
  });

  it('ignores inactive variants and preserves the current selection', () => {
    const { state } = setup({});
    state.loadProductVariants(PRODUCT_ID);
    state.selectVariant('bbbbbbbb-2222-4222-8222-222222222222');

    expect(state.selectedVariantId()).toBeNull();
    expect(state.selectedVariant()).toBeNull();
  });

  it('ignores selections before anything loads', () => {
    const { state } = setup({});
    state.selectVariant(ACTIVE_VARIANT_ID);

    expect(state.selectedVariantId()).toBeNull();
  });

  it('heals the derived variant to null when the selection leaves a fresh list', () => {
    let items = VARIANTS;
    const { state } = setup({ listProductVariants: () => of(variantsEnvelope(items)) });
    state.loadProductVariants(PRODUCT_ID);
    state.selectVariant(ACTIVE_VARIANT_ID);
    expect(state.selectedVariant()?.sku).toBe('TEE-RED-M');

    items = [];
    state.loadProductVariants(PRODUCT_ID);

    expect(state.variants().status).toBe('empty');
    expect(state.selectedVariant()).toBeNull();
  });

  it('clears the selection without touching the loaded list', () => {
    const { state } = setup({});
    state.loadProductVariants(PRODUCT_ID);
    state.selectVariant(ACTIVE_VARIANT_ID);
    state.clearVariantSelection();

    expect(state.selectedVariantId()).toBeNull();
    expect(state.selectedVariant()).toBeNull();
    expect(state.variants().status).toBe('success');
  });
});

describe('ProductDetailsState orderability guard', () => {
  it('is false before any selection', () => {
    const { state } = setup({});
    state.loadProductVariants(PRODUCT_ID);

    expect(state.selectedVariantSelectable()).toBe(false);
  });

  it('is true while a selectable variant is selected', () => {
    const { state } = setup({});
    state.loadProductVariants(PRODUCT_ID);
    state.selectVariant(ACTIVE_VARIANT_ID);

    expect(state.selectedVariantSelectable()).toBe(true);
  });

  it('turns false when the selection leaves the fresh list', () => {
    let items = VARIANTS;
    const { state } = setup({ listProductVariants: () => of(variantsEnvelope(items)) });
    state.loadProductVariants(PRODUCT_ID);
    state.selectVariant(ACTIVE_VARIANT_ID);
    expect(state.selectedVariantSelectable()).toBe(true);

    items = [];
    state.loadProductVariants(PRODUCT_ID);

    expect(state.selectedVariantSelectable()).toBe(false);
  });

  it('is false after reset', () => {
    const { state } = setup({});
    state.loadProductVariants(PRODUCT_ID);
    state.selectVariant(ACTIVE_VARIANT_ID);
    state.reset();

    expect(state.selectedVariantSelectable()).toBe(false);
  });
});

describe('ProductDetailsState quantity', () => {
  it('starts at the valid initial quantity', () => {
    const { state } = setup({});

    expect(state.quantity()).toBe(1);
  });

  it('increments by one per call', () => {
    const { state } = setup({});
    state.incrementQuantity();
    state.incrementQuantity();

    expect(state.quantity()).toBe(3);
  });

  it('decrements by one per call floored at the minimum', () => {
    const { state } = setup({});
    state.setQuantity(3);
    state.decrementQuantity();

    expect(state.quantity()).toBe(2);

    state.decrementQuantity();
    state.decrementQuantity();
    state.decrementQuantity();

    expect(state.quantity()).toBe(1);
  });

  it('accepts valid quantities and ignores invalid ones', () => {
    const { state } = setup({});
    state.setQuantity(5);
    expect(state.quantity()).toBe(5);

    state.setQuantity(0);
    state.setQuantity(-2);
    state.setQuantity(2.5);
    state.setQuantity(Number.NaN);

    expect(state.quantity()).toBe(5);
  });

  it('resets the quantity without touching the loaded slots', () => {
    const { state } = setup({});
    state.loadProductVariants(PRODUCT_ID);
    state.selectVariant(ACTIVE_VARIANT_ID);
    state.setQuantity(4);
    state.resetQuantity();

    expect(state.quantity()).toBe(1);
    expect(state.selectedVariantId()).toBe(ACTIVE_VARIANT_ID);
    expect(state.variants().status).toBe('success');
  });
});

describe('ProductDetailsState add-to-cart submission', () => {
  function submittable(): { state: ProductDetailsState; cartBodies: unknown[] } {
    const harness = setup({});
    harness.state.loadProductVariants(PRODUCT_ID);
    harness.state.selectVariant(ACTIVE_VARIANT_ID);
    harness.state.setQuantity(2);
    return harness;
  }

  it('starts idle without an error', () => {
    const { state } = setup({});

    expect(state.addToCartStatus()).toBe('idle');
    expect(state.addToCartError()).toBeNull();
  });

  it('submits the purchasable item, quantity, and pricing through the cart boundary', () => {
    const { state, cartBodies } = submittable();
    state.submitAddToCart(PRICING);

    expect(cartBodies).toEqual([
      {
        variantId: ACTIVE_VARIANT_ID,
        quantity: 2,
        unitPriceAmount: 29.99,
        currency: 'USD',
      } satisfies AddCartItemRequest,
    ]);
    expect(state.addToCartStatus()).toBe('added');
    expect(state.addToCartError()).toBeNull();
  });

  it('ignores submissions without a selectable variant or valid quantity', () => {
    const fresh = setup({});
    fresh.state.loadProductVariants(PRODUCT_ID);
    fresh.state.submitAddToCart(PRICING);
    expect(fresh.state.addToCartStatus()).toBe('idle');
    expect(fresh.cartBodies).toHaveLength(0);

    TestBed.resetTestingModule();
    const { state, cartBodies } = submittable();
    state.setQuantity(1);
    state.submitAddToCart({ unitPriceAmount: 0, currency: 'USD' });
    state.submitAddToCart({ unitPriceAmount: 29.99, currency: 'usd' });
    expect(cartBodies).toHaveLength(0);
    expect(state.addToCartStatus()).toBe('idle');
  });

  it('locks duplicate submissions while a request is in flight', () => {
    const { state, cartBodies } = setup({
      addAuthenticatedCartItem: () => new Observable<ApiResponseWithData<CartResponse>>(() => {}),
    });
    state.loadProductVariants(PRODUCT_ID);
    state.selectVariant(ACTIVE_VARIANT_ID);
    state.submitAddToCart(PRICING);
    state.submitAddToCart(PRICING);
    state.submitAddToCart(PRICING);

    expect(cartBodies).toHaveLength(1);
    expect(state.addToCartStatus()).toBe('adding');
  });

  it('resolves failures to error with a normalized ApiError', () => {
    const rejection = new ApiError({ status: 409, message: 'Conflict.' });
    const { state, cartBodies } = setup({
      addAuthenticatedCartItem: () => throwError(() => rejection),
    });
    state.loadProductVariants(PRODUCT_ID);
    state.selectVariant(ACTIVE_VARIANT_ID);
    state.submitAddToCart(PRICING);

    expect(cartBodies).toHaveLength(1);
    expect(state.addToCartStatus()).toBe('error');
    expect(state.addToCartError()).toBe(rejection);
  });

  it('resets stale feedback without touching the loaded slots', () => {
    const { state } = submittable();
    state.submitAddToCart(PRICING);
    expect(state.addToCartStatus()).toBe('added');

    state.resetAddToCartStatus();

    expect(state.addToCartStatus()).toBe('idle');
    expect(state.addToCartError()).toBeNull();
    expect(state.selectedVariantId()).toBe(ACTIVE_VARIANT_ID);
    expect(state.quantity()).toBe(2);
    expect(state.variants().status).toBe('success');
  });
});

describe('ProductDetailsState locality (no global state)', () => {
  it('is feature-scoped: independent instances per injection site', () => {
    const first = setup({});
    first.state.loadProduct(PRODUCT_ID);
    expect(first.state.product().status).toBe('success');

    TestBed.resetTestingModule();
    const second = setup({});
    expect(second.state.product().status).toBe('idle');
  });

  it('is not a root singleton (no providedIn root)', () => {
    const metadata = (ProductDetailsState as unknown as { ɵprov?: { providedIn?: unknown } }).ɵprov;
    expect(metadata?.providedIn).not.toBe('root');
  });
});

describe('ProductDetailsState transfer state (6.9 hydration)', () => {
  interface TransferHarness {
    state: ProductDetailsState;
    transfer: TransferState;
    apiCalls: string[];
  }

  /**
   * Builds an isolated state on the given platform. Sharing one
   * `TransferState` instance across a server/client pair simulates the
   * serialized HTML transfer (payloads are JSON-safe by contract).
   */
  function setupTransfer(options: {
    platform?: 'browser' | 'server';
    transfer?: TransferState;
    getProduct?: () => ReturnType<ProductDetailsApiService['getProduct']>;
    listSpecifications?: () => ReturnType<ProductDetailsApiService['listSpecifications']>;
    listProductImages?: () => ReturnType<ProductDetailsApiService['listProductImages']>;
    listProductVariants?: () => ReturnType<ProductDetailsApiService['listProductVariants']>;
  }): TransferHarness {
    const apiCalls: string[] = [];
    const apiStub = {
      getProduct: ((id: string) => {
        apiCalls.push(`product:${id}`);
        return options.getProduct?.() ?? of(productEnvelope());
      }) as ProductDetailsApiService['getProduct'],
      listSpecifications: ((id: string) => {
        apiCalls.push(`specifications:${id}`);
        return options.listSpecifications?.() ?? of(specificationsEnvelope());
      }) as ProductDetailsApiService['listSpecifications'],
      listProductImages: ((id: string) => {
        apiCalls.push(`images:${id}`);
        return options.listProductImages?.() ?? of(imagesEnvelope());
      }) as ProductDetailsApiService['listProductImages'],
      listProductVariants: ((id: string) => {
        apiCalls.push(`variants:${id}`);
        return options.listProductVariants?.() ?? of(variantsEnvelope());
      }) as ProductDetailsApiService['listProductVariants'],
    } as ProductDetailsApiService;

    TestBed.configureTestingModule({
      providers: [
        { provide: ProductDetailsApiService, useValue: apiStub },
        ...(options.transfer === undefined
          ? []
          : [{ provide: TransferState, useValue: options.transfer }]),
        ...(options.platform === undefined || options.platform === 'browser'
          ? []
          : [{ provide: PLATFORM_ID, useValue: 'server' }]),
        ProductDetailsState,
      ],
    });
    return {
      state: TestBed.inject(ProductDetailsState),
      transfer: TestBed.inject(TransferState),
      apiCalls,
    };
  }

  function loadAll(state: ProductDetailsState): void {
    state.loadProduct(PRODUCT_ID);
    state.loadSpecifications(PRODUCT_ID);
    state.loadProductImages(PRODUCT_ID);
    state.loadProductVariants(PRODUCT_ID);
  }

  it('reuses every server-rendered slot on the client without refetching', () => {
    const server = setupTransfer({ platform: 'server' });
    loadAll(server.state);
    expect(server.state.product().status).toBe('success');
    expect(server.state.specifications().status).toBe('success');
    expect(server.state.images().status).toBe('success');
    expect(server.state.variants().status).toBe('success');
    expect(server.apiCalls).toHaveLength(4);
    TestBed.resetTestingModule();

    const client = setupTransfer({ transfer: server.transfer });
    loadAll(client.state);

    expect(client.apiCalls).toHaveLength(0);
    expect(client.state.product().status).toBe('success');
    expect(client.state.product().data?.name).toBe('Tee');
    expect(client.state.specifications().status).toBe('success');
    expect(client.state.images().status).toBe('success');
    expect(client.state.variants().status).toBe('success');
  });

  it('reuses transferred empty lists as empty (gallery fallback, hidden sections)', () => {
    const server = setupTransfer({
      platform: 'server',
      listSpecifications: () => of(specificationsEnvelope([])),
      listProductImages: () => of(imagesEnvelope([])),
      listProductVariants: () => of(variantsEnvelope([])),
    });
    loadAll(server.state);
    expect(server.state.specifications().status).toBe('empty');
    expect(server.state.images().status).toBe('empty');
    expect(server.state.variants().status).toBe('empty');
    TestBed.resetTestingModule();

    const client = setupTransfer({ transfer: server.transfer });
    loadAll(client.state);

    expect(client.apiCalls).toHaveLength(0);
    expect(client.state.specifications().status).toBe('empty');
    expect(client.state.images().status).toBe('empty');
    expect(client.state.variants().status).toBe('empty');
  });

  it('fetches live on transfer miss (different product id)', () => {
    const server = setupTransfer({ platform: 'server' });
    server.state.loadProduct(PRODUCT_ID);
    TestBed.resetTestingModule();

    const client = setupTransfer({ transfer: server.transfer });
    client.state.loadProduct('22222222-2222-2222-2222-222222222222');

    expect(client.apiCalls).toHaveLength(1);
    expect(client.state.product().status).toBe('success');
  });

  it('consumes transfers once (second identical load refetches)', () => {
    const server = setupTransfer({ platform: 'server' });
    server.state.loadProduct(PRODUCT_ID);
    TestBed.resetTestingModule();

    const client = setupTransfer({ transfer: server.transfer });
    client.state.loadProduct(PRODUCT_ID);
    expect(client.apiCalls).toHaveLength(0);

    client.state.loadProduct(PRODUCT_ID);
    expect(client.apiCalls).toHaveLength(1);
  });

  it('never stores server failures (the client retries live, incl. 404)', () => {
    const rejection = new ApiError({ status: 404, message: 'Not found.' });
    const server = setupTransfer({
      platform: 'server',
      getProduct: () => throwError(() => rejection),
    });
    server.state.loadProduct(PRODUCT_ID);
    expect(server.state.product().status).toBe('error');
    TestBed.resetTestingModule();

    const client = setupTransfer({ transfer: server.transfer });
    client.state.loadProduct(PRODUCT_ID);

    expect(client.apiCalls).toHaveLength(1);
    expect(client.state.product().status).toBe('success');
  });
});
