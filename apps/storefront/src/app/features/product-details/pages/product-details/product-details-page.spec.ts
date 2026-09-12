/**
 * Page tests for the `ProductDetailsPage` (Sub-Phase 6.1 — Product Details
 * Foundation).
 *
 * `ProductDetailsState` is stubbed at its typed seam (its orchestration is
 * covered by `product-details-state.spec.ts`) so these tests own the page
 * logic: product load driven by the `:id` route parameter, graceful
 * missing/malformed ids (no fetch, invalid state, slot reset), loading /
 * error / success rendering, error retry, and the browser-only fetch rule
 * (the server prerenders the idle shell).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import {
  ApiError,
  errorResource,
  idleResource,
  loadingResource,
  successResource,
  type ResourceState,
} from '@flux/api';
import { CultureService } from '@flux/i18n';
import type { ProductResponse } from '@flux/models';
import { ProductDetailsState } from '../../state/product-details-state';
import type { ProductDetails } from '../../models/product-details.models';
import { ProductDetailsPage } from './product-details-page';

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

function setup(options: {
  snapshot?: ResourceState<ProductDetails>;
  productId?: string | null;
  platform?: 'browser' | 'server';
}): {
  fixture: ComponentFixture<ProductDetailsPage>;
  element: HTMLElement;
  loadCalls: unknown[];
  resetCalls: number;
} {
  const loadCalls: unknown[] = [];
  let resetCalls = 0;
  const stateStub = {
    product: signal(options.snapshot ?? idleResource<ProductDetails>()),
    loadProduct: ((id: unknown) => {
      loadCalls.push(id);
    }) as ProductDetailsState['loadProduct'],
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
  TestBed.inject(CultureService).setCulture('en');
  const fixture = TestBed.createComponent(ProductDetailsPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement, loadCalls, resetCalls };
}

describe('ProductDetailsPage route parameter', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the product for a valid route id on init', () => {
    const { loadCalls } = setup({ productId: PRODUCT_ID });

    expect(loadCalls).toEqual([PRODUCT_ID]);
  });

  it('never fetches and renders the invalid state for a missing id', () => {
    const { element, loadCalls, resetCalls } = setup({ productId: null });

    expect(loadCalls).toEqual([]);
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

  it('renders the error state on failure and retries the same id', () => {
    const { element, fixture, loadCalls } = setup({
      productId: PRODUCT_ID,
      snapshot: errorResource(new ApiError({ status: 404, message: 'Not found.' })),
    });

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    expect(loadCalls).toEqual([PRODUCT_ID]);

    element.querySelector('flux-error-state button')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(loadCalls).toEqual([PRODUCT_ID, PRODUCT_ID]);
  });

  it('renders the product name on success (foundation proof of data flow)', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
    });

    expect(element.querySelector('.product-details-name')?.textContent).toBe('Tee');
    expect(element.querySelector('flux-error-state')).toBeNull();
  });
});
