/**
 * Page tests for the `ProductDetailsPage` (Sub-Phases 6.1–6.2 — Foundation
 * + Page & Information).
 *
 * `ProductDetailsState` is stubbed at its typed seam (its orchestration is
 * covered by `product-details-state.spec.ts`) so these tests own the page
 * logic: product + specifications loads driven by the `:id` route
 * parameter, graceful missing/malformed ids (no fetch, invalid state, slot
 * reset), loading / success / error / not-found rendering, error retry over
 * both slots, specification rendering (wire order, empty-hidden), and the
 * browser-only fetch rule (the server prerenders the idle shell).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import {
  ApiError,
  emptyResource,
  errorResource,
  idleResource,
  loadingResource,
  successResource,
  type ResourceState,
} from '@flux/api';
import { CultureService } from '@flux/i18n';
import type { ProductResponse } from '@flux/models';
import { ProductDetailsState } from '../../state/product-details-state';
import type { ProductDetails, ProductSpecification } from '../../models/product-details.models';
import { ProductDetailsPage } from './product-details-page';

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';

const PRODUCT: ProductResponse = {
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

const SPECIFICATIONS: ProductSpecification[] = [
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

function setup(options: {
  snapshot?: ResourceState<ProductDetails>;
  specificationsSnapshot?: ResourceState<ProductSpecification[]>;
  productId?: string | null;
  culture?: 'en' | 'fr';
  platform?: 'browser' | 'server';
}): {
  fixture: ComponentFixture<ProductDetailsPage>;
  element: HTMLElement;
  loadCalls: unknown[];
  loadSpecificationsCalls: unknown[];
  resetCalls: number;
} {
  const loadCalls: unknown[] = [];
  const loadSpecificationsCalls: unknown[] = [];
  let resetCalls = 0;
  const stateStub = {
    product: signal(options.snapshot ?? idleResource<ProductDetails>()),
    specifications: signal(
      options.specificationsSnapshot ?? idleResource<ProductSpecification[]>(),
    ),
    loadProduct: ((id: unknown) => {
      loadCalls.push(id);
    }) as ProductDetailsState['loadProduct'],
    loadSpecifications: ((id: unknown) => {
      loadSpecificationsCalls.push(id);
    }) as ProductDetailsState['loadSpecifications'],
    reset: (() => {
      resetCalls += 1;
    }) as ProductDetailsState['reset'],
  } as unknown as ProductDetailsState;
  const routeStub = {
    paramMap: of(
      convertToParamMap({
        ...(options.productId === undefined || options.productId === null
          ? {}
          : { id: options.productId }),
      }),
    ),
  } as unknown as ActivatedRoute;

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ProductDetailsState, useValue: stateStub },
      { provide: ActivatedRoute, useValue: routeStub },
      ...(options.platform === undefined
        ? []
        : [{ provide: PLATFORM_ID, useValue: options.platform }]),
    ],
  });
  window.localStorage.clear();
  TestBed.inject(CultureService).setCulture(options.culture ?? 'en');
  const fixture = TestBed.createComponent(ProductDetailsPage);
  fixture.detectChanges();
  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    loadCalls,
    loadSpecificationsCalls,
    resetCalls,
  };
}

describe('ProductDetailsPage route parameter', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the product and specifications for a valid route id on init', () => {
    const { loadCalls, loadSpecificationsCalls } = setup({ productId: PRODUCT_ID });

    expect(loadCalls).toEqual([PRODUCT_ID]);
    expect(loadSpecificationsCalls).toEqual([PRODUCT_ID]);
  });

  it('never fetches and renders the invalid state for a missing id', () => {
    const { element, loadCalls, loadSpecificationsCalls, resetCalls } = setup({ productId: null });

    expect(loadCalls).toEqual([]);
    expect(loadSpecificationsCalls).toEqual([]);
    expect(resetCalls).toBe(1);
    expect(element.querySelector('flux-empty-state')).not.toBeNull();
    expect(element.querySelector('flux-loading-indicator')).toBeNull();
  });

  it('never fetches and renders the invalid state for a malformed id', () => {
    const { element, loadCalls } = setup({ productId: 'not-a-product' });

    expect(loadCalls).toEqual([]);
    expect(element.querySelector('flux-empty-state')).not.toBeNull();
  });

  it('skips loading on the server (prerenders the idle shell)', () => {
    const { element, loadCalls } = setup({ productId: PRODUCT_ID, platform: 'server' });

    expect(loadCalls).toEqual([]);
    expect(element.querySelector('flux-loading-indicator')).toBeNull();
    expect(element.querySelector('h1')?.textContent).toBe('Product details');
  });
});

describe('ProductDetailsPage resource states', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the loading state while the product fetches', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: loadingResource<ProductDetails>(),
    });

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(element.querySelector('flux-error-state')).toBeNull();
  });

  it('renders the not-found state for 404 without an error state or retry', () => {
    const { element, fixture, loadCalls } = setup({
      productId: PRODUCT_ID,
      snapshot: errorResource(new ApiError({ status: 404, message: 'Not found.' })),
    });

    expect(element.querySelector('flux-empty-state')).not.toBeNull();
    expect(element.querySelector('flux-error-state')).toBeNull();
    expect(element.querySelector('.product-details-back a')?.getAttribute('href')).toBe('/catalog');
    expect(loadCalls).toEqual([PRODUCT_ID]);

    fixture.detectChanges();
    expect(loadCalls).toEqual([PRODUCT_ID]);
  });

  it('renders the error state on non-404 failures and retries both slots', () => {
    const { element, fixture, loadCalls, loadSpecificationsCalls } = setup({
      productId: PRODUCT_ID,
      snapshot: errorResource(new ApiError({ status: 500, message: 'Server error.' })),
    });

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    expect(element.querySelector('flux-empty-state')).toBeNull();
    expect(loadCalls).toEqual([PRODUCT_ID]);
    expect(loadSpecificationsCalls).toEqual([PRODUCT_ID]);

    element.querySelector('flux-error-state button')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(loadCalls).toEqual([PRODUCT_ID, PRODUCT_ID]);
    expect(loadSpecificationsCalls).toEqual([PRODUCT_ID, PRODUCT_ID]);
  });

  it('renders localized copy for the active culture', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: loadingResource<ProductDetails>(),
      culture: 'fr',
    });

    expect(element.querySelector('h1')?.textContent).toBe('Détails du produit');
    expect(element.querySelector('flux-loading-indicator')?.textContent).toContain(
      'Chargement du produit…',
    );
  });
});

describe('ProductDetailsPage information', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the product name as the heading with description and specifications', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      specificationsSnapshot: successResource(SPECIFICATIONS),
    });

    expect(element.querySelector('h1')?.textContent).toBe('Tee');
    expect(element.querySelector('.product-details-description')?.textContent?.trim()).toBe(
      'A comfortable cotton tee.',
    );
    const terms = [...element.querySelectorAll('.product-details-spec dt')].map((term) =>
      term.textContent?.trim(),
    );
    const values = [...element.querySelectorAll('.product-details-spec dd')].map((value) =>
      value.textContent?.trim(),
    );
    expect(terms).toEqual(['Material', 'Fit']);
    expect(values).toEqual(['Cotton', 'Regular']);
    expect(element.querySelector('flux-error-state')).toBeNull();
  });

  it('renders the localized fallback when the product has no description', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: successResource({ ...PRODUCT, description: null }),
      specificationsSnapshot: successResource(SPECIFICATIONS),
    });

    expect(element.querySelector('.product-details-description')?.textContent?.trim()).toBe(
      'No description available.',
    );
  });

  it('hides the specifications section when the product carries none', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      specificationsSnapshot: emptyResource<ProductSpecification[]>([]),
    });

    expect(element.querySelector('h1')?.textContent).toBe('Tee');
    expect(element.querySelector('.product-details-specs')).toBeNull();
  });

  it('still shows the product when specifications fail to load', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      specificationsSnapshot: errorResource(
        new ApiError({ status: 500, message: 'Server error.' }),
      ),
    });

    expect(element.querySelector('h1')?.textContent).toBe('Tee');
    expect(element.querySelector('.product-details-specs')).toBeNull();
    expect(element.querySelector('flux-error-state')).toBeNull();
  });
});
