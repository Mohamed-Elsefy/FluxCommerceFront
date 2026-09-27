/**
 * Behavior tests for the Sub-Phase 13.3 `ProductDetailsState`.
 *
 * `CatalogAdminApiService` (already covered by its own delegation spec) is
 * stubbed at its typed seam so these tests own the state logic: per-slot
 * lifecycles, section independence, lifecycle locking with success
 * reload, and failure propagation.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { defer, of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import type {
  ProductImageResponse,
  ProductResponse,
  ProductSpecificationResponse,
  VariantResponse,
} from '@flux/models';
import { CatalogAdminApiService } from '../data-access/catalog-admin-api.service';
import { ProductDetailsState } from './product-details-state';

function product(): ProductResponse {
  return {
    id: 'prod-1',
    name: 'Tee',
    slug: 'tee',
    description: null,
    seo: null,
    status: 1,
    visibility: 0,
    categoryId: 'cat-1',
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function envelope<T>(data: T) {
  return { isSuccess: true, message: 'Operation completed successfully.', data };
}

function variant(): VariantResponse {
  return {
    id: 'var-1',
    productId: 'prod-1',
    sku: 'TEE-BLK-M',
    name: 'Black / M',
    unitPriceAmount: 29.99,
    currency: 'USD',
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function image(): ProductImageResponse {
  return {
    id: 'img-1',
    productId: 'prod-1',
    imageUrl: '/images/tee.jpg',
    altText: 'Tee',
    displayOrder: 0,
    isPrimary: true,
    metadata: null,
    createdAtUtc: '2026-09-04T10:00:00Z',
  };
}

function spec(): ProductSpecificationResponse {
  return { id: 'spec-1', productId: 'prod-1', name: 'Material', value: 'Cotton' };
}

interface ServiceStub {
  getProduct: ReturnType<typeof vi.fn>;
  listVariants: ReturnType<typeof vi.fn>;
  listProductImages: ReturnType<typeof vi.fn>;
  listSpecifications: ReturnType<typeof vi.fn>;
  transitionProduct: ReturnType<typeof vi.fn>;
}

function setup(overrides: Partial<Record<keyof ServiceStub, () => Observable<unknown>>> = {}): {
  state: ProductDetailsState;
  api: ServiceStub;
} {
  const api: ServiceStub = {
    getProduct: vi.fn(() => overrides.getProduct?.() ?? of(envelope(product()))),
    listVariants: vi.fn(() => overrides.listVariants?.() ?? of(envelope([variant()]))),
    listProductImages: vi.fn(() => overrides.listProductImages?.() ?? of(envelope([image()]))),
    listSpecifications: vi.fn(() => overrides.listSpecifications?.() ?? of(envelope([spec()]))),
    transitionProduct: vi.fn(() => overrides.transitionProduct?.() ?? of(undefined)),
  };
  TestBed.configureTestingModule({
    providers: [ProductDetailsState, { provide: CatalogAdminApiService, useValue: api }],
  });
  return { state: TestBed.inject(ProductDetailsState), api };
}

describe('ProductDetailsState slots', () => {
  it('starts with every slot idle', () => {
    const { state } = setup();

    expect(state.product().status).toBe('idle');
    expect(state.variants().status).toBe('idle');
    expect(state.images().status).toBe('idle');
    expect(state.specifications().status).toBe('idle');
    expect(state.transitionInFlight()).toBe(false);
  });

  it('loads every slot for the product id', () => {
    const { state, api } = setup();
    state.load('prod-1');

    expect(api.getProduct).toHaveBeenCalledWith('prod-1');
    expect(api.listVariants).toHaveBeenCalledWith('prod-1');
    expect(api.listProductImages).toHaveBeenCalledWith('prod-1');
    expect(api.listSpecifications).toHaveBeenCalledWith('prod-1');
    expect(state.product().status).toBe('success');
    expect(state.variants().data).toHaveLength(1);
    expect(state.images().data?.[0]?.imageUrl).toBe('/images/tee.jpg');
    expect(state.specifications().data?.[0]?.name).toBe('Material');
  });

  it('keeps settled metadata when one section fails', () => {
    const rejection = new ApiError({ status: 404, message: 'Not found.' });
    const { state } = setup({ listProductImages: () => throwError(() => rejection) });
    state.load('prod-1');

    expect(state.product().status).toBe('success');
    expect(state.images().status).toBe('error');
    expect(state.images().error).toBe(rejection);
    expect(state.variants().status).toBe('success');
  });

  it('resolves empty sections to empty without touching metadata', () => {
    const { state } = setup({
      listVariants: () => of(envelope([])),
      listSpecifications: () => of(envelope([])),
    });
    state.load('prod-1');

    expect(state.product().status).toBe('success');
    expect(state.variants().status).toBe('empty');
    expect(state.specifications().status).toBe('empty');
  });
});

describe('ProductDetailsState product-only loads', () => {
  it('loads the product slot without touching display sections', () => {
    const { state, api } = setup();
    state.loadProduct('prod-1');

    expect(api.getProduct).toHaveBeenCalledWith('prod-1');
    expect(api.listVariants).not.toHaveBeenCalled();
    expect(api.listProductImages).not.toHaveBeenCalled();
    expect(api.listSpecifications).not.toHaveBeenCalled();
    expect(state.product().status).toBe('success');
    expect(state.variants().status).toBe('idle');
  });
});

describe('ProductDetailsState transitions', () => {
  it('runs the transition, unlocks, and reloads the product on success', () => {
    const { state, api } = setup();
    state.load('prod-1');
    expect(api.getProduct).toHaveBeenCalledTimes(1);

    let settled = false;
    state.transition('prod-1', 'archive')?.subscribe(() => {
      settled = true;
    });

    expect(settled).toBe(true);
    expect(api.transitionProduct).toHaveBeenCalledWith('prod-1', 'archive');
    expect(state.transitionInFlight()).toBe(false);
    expect(api.getProduct).toHaveBeenCalledTimes(2);
  });

  it('locks concurrent transitions (duplicate-submit prevention)', () => {
    let release!: (value: unknown) => void;
    const pending = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    const { state, api } = setup({ transitionProduct: () => defer(() => pending) });

    let settled = false;
    const first = state.transition('prod-1', 'archive');
    first?.subscribe(() => {
      settled = true;
    });
    const second = state.transition('prod-1', 'archive');

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(api.transitionProduct).toHaveBeenCalledTimes(1);
    expect(state.transitionInFlight()).toBe(true);
    release(undefined);
    return pending.then(() => {
      expect(settled).toBe(true);
      expect(state.transitionInFlight()).toBe(false);
    });
  });

  it('propagates transition failures untouched without reloading', () => {
    const rejection = new ApiError({ status: 409, message: 'Conflict.' });
    const { state, api } = setup({ transitionProduct: () => throwError(() => rejection) });
    state.load('prod-1');

    let observed: unknown;
    state.transition('prod-1', 'activate')?.subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBe(rejection);
    expect(state.transitionInFlight()).toBe(false);
    expect(api.getProduct).toHaveBeenCalledTimes(1);
  });
});
