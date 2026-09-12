/**
 * State tests for the Sub-Phase 6.1–6.3 `ProductDetailsState`.
 *
 * `ProductDetailsApiService` (the feature HTTP boundary, covered by
 * `product-details-api.service.spec.ts`) is stubbed at its typed seam so
 * these tests own the feature logic: idle → loading → success | empty |
 * error transitions for the product, specifications, and images slots, data
 * retention across reloads, dataless-envelope violations, blank-id
 * rejection, cancellation passthrough, reset of every slot, and
 * feature-local scoping (no root singleton — every injection site gets an
 * independent instance).
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError } from '@flux/api';
import type {
  ProductImageResponse,
  ProductResponse,
  ProductSpecificationResponse,
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

function setup(flows: {
  getProduct?: () => ReturnType<ProductDetailsApiService['getProduct']>;
  listSpecifications?: () => ReturnType<ProductDetailsApiService['listSpecifications']>;
  listProductImages?: () => ReturnType<ProductDetailsApiService['listProductImages']>;
}): {
  state: ProductDetailsState;
  seenSignals: (AbortSignal | undefined)[];
  ids: unknown[];
  specificationIds: unknown[];
  imageIds: unknown[];
} {
  const seenSignals: (AbortSignal | undefined)[] = [];
  const ids: unknown[] = [];
  const specificationIds: unknown[] = [];
  const imageIds: unknown[] = [];
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
  };
}

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
    state.reset();

    expect(state.product().status).toBe('idle');
    expect(state.specifications().status).toBe('idle');
    expect(state.specifications().data).toBeNull();
    expect(state.images().status).toBe('idle');
    expect(state.images().data).toBeNull();
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
